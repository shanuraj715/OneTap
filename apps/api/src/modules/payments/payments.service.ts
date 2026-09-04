import {
  GATEWAY_FIELDS,
  GATEWAY_LABELS,
  outletConfigSchema,
  type Gateway,
} from "@onetap/config-schema";
import {
  OrderModel,
  OutletModel,
  PaymentCredentialModel,
  PaymentModel,
  tenantFilter,
  WebhookEventModel,
  type TenantContext,
} from "@onetap/db";
import { env } from "../../env";
import { decryptSecret, encryptSecret, maskSecret } from "../../lib/crypto";
import { logger } from "../../logger";
import { HttpError } from "../../middleware/error";
import { providerFor, type GatewayCredentials } from "./providers";

/* -------------------------------------------------------------- credentials */

/** Decrypted credentials for a gateway. Never leaves the API process. */
async function credentialsFor(ctx: TenantContext, gateway: Gateway): Promise<GatewayCredentials> {
  const doc = await PaymentCredentialModel.findOne(tenantFilter(ctx, { gateway })).lean();
  if (!doc) return {};

  const creds: GatewayCredentials = { ...(doc.publicFields ?? {}) };
  for (const [field, envelope] of Object.entries(doc.encryptedFields ?? {})) {
    try {
      creds[field] = decryptSecret(envelope);
    } catch {
      logger.error(`Could not decrypt ${gateway}.${field} — was ENCRYPTION_KEY rotated?`);
      throw new HttpError(500, "Stored payment credentials could not be read");
    }
  }
  return creds;
}

/** What the admin sees: which gateways are configured, secrets masked. */
export async function listGatewayConfig(ctx: TenantContext) {
  const docs = await PaymentCredentialModel.find(tenantFilter(ctx)).lean();
  const byGateway = new Map(docs.map((d) => [d.gateway, d]));

  return (Object.keys(GATEWAY_FIELDS) as Gateway[]).map((gateway) => {
    const provider = providerFor(gateway);
    const doc = byGateway.get(gateway);
    const fields = GATEWAY_FIELDS[gateway].map((f) => ({
      ...f,
      value: f.secret
        ? doc?.encryptedFields?.[f.key]
          ? maskSecret(doc.encryptedFields[f.key]!.slice(-12))
          : ""
        : (doc?.publicFields?.[f.key] ?? ""),
      isSet: f.secret ? Boolean(doc?.encryptedFields?.[f.key]) : Boolean(doc?.publicFields?.[f.key]),
    }));

    return {
      gateway,
      isOnline: provider.isOnline,
      requiredFields: provider.requiredFields,
      configured: provider.requiredFields.every((k) => fields.find((f) => f.key === k)?.isSet),
      available: gateway !== "mock" || env.ALLOW_MOCK_GATEWAY,
      fields,
      updatedAt: doc?.updatedAt ?? null,
    };
  });
}

export async function saveCredentials(
  ctx: TenantContext,
  gateway: Gateway,
  values: Record<string, string>,
  userId: string,
) {
  const spec = GATEWAY_FIELDS[gateway];
  if (!spec) throw new HttpError(400, "Unknown gateway");

  const doc =
    (await PaymentCredentialModel.findOne(tenantFilter(ctx, { gateway }))) ??
    new PaymentCredentialModel({ brandId: ctx.brandId, outletId: ctx.outletId, gateway });

  for (const field of spec) {
    const value = values[field.key];
    if (value === undefined) continue;

    if (field.secret) {
      // an empty string means "leave it alone"; the admin never sees the real value
      if (value === "") continue;
      doc.encryptedFields = { ...doc.encryptedFields, [field.key]: encryptSecret(value) };
    } else {
      doc.publicFields = { ...doc.publicFields, [field.key]: value };
    }
  }

  doc.updatedBy = userId;
  doc.markModified("publicFields");
  doc.markModified("encryptedFields");
  await doc.save();
}

export async function clearCredentials(ctx: TenantContext, gateway: Gateway) {
  await PaymentCredentialModel.deleteOne(tenantFilter(ctx, { gateway }));
}

/* ------------------------------------------------------------------ intents */

async function outletConfigFor(ctx: TenantContext) {
  const outlet = await OutletModel.findOne({ _id: ctx.outletId }, null, { allowGlobalQuery: true }).lean();
  if (!outlet) throw new HttpError(404, "Outlet not found");
  return outletConfigSchema.parse(outlet.config ?? {});
}

/** Create (or reuse) a payment intent for an order that still owes money. */
export async function createIntent(ctx: TenantContext, orderId: string) {
  const order = await OrderModel.findOne(tenantFilter(ctx, { _id: orderId }));
  if (!order) throw new HttpError(404, "Order not found");
  if (order.payment.status === "paid") throw new HttpError(409, "This order is already paid");

  const gateway = order.payment.gateway;
  const provider = providerFor(gateway);
  if (!provider?.isOnline) throw new HttpError(409, `${gateway} isn't an online gateway`);

  const config = await outletConfigFor(ctx);
  if (!config.payments.enabled.includes(gateway)) {
    throw new HttpError(409, `${gateway} is switched off for this outlet`);
  }
  if (gateway === "mock" && !env.ALLOW_MOCK_GATEWAY) {
    throw new HttpError(409, "The test gateway is disabled");
  }

  const creds = await credentialsFor(ctx, gateway);
  const missing = provider.requiredFields.filter((f) => !creds[f]);
  if (missing.length) throw new HttpError(409, `${gateway} is not fully configured (missing ${missing.join(", ")})`);

  // A failure from the gateway's own API is not an OneTap bug — surface the
  // real reason (bad keys, account not activated, amount limits) as a 502 so
  // the customer and the restaurant can see what to fix, not "Internal error".
  let intent;
  try {
    intent = await provider.createIntent(creds, {
      amount: order.totals.grandTotal,
      currency: "INR",
      receipt: order.orderNumber,
      notes: { orderId: String(order._id), outletId: ctx.outletId ?? "" },
    });
  } catch (e) {
    const detail = (e as Error).message || "unknown error";
    logger.warn({ err: e, gateway, orderId: String(order._id) }, "payment intent creation failed at the gateway");
    throw new HttpError(
      502,
      `${GATEWAY_LABELS[gateway] ?? gateway} could not start this payment: ${detail}. ` +
        `Check the ${gateway} keys in Admin → Payments.`,
    );
  }

  const payment = await PaymentModel.create({
    brandId: ctx.brandId,
    outletId: ctx.outletId,
    orderId: String(order._id),
    gateway,
    status: "pending",
    amount: order.totals.grandTotal,
    currency: "INR",
    gatewayOrderId: intent.gatewayOrderId,
    events: [{ at: new Date(), source: "server", type: "intent.created" }],
  });

  order.payment.paymentId = String(payment._id);
  await order.save();

  return { paymentId: String(payment._id), gateway, ...intent };
}

/** Verify what the gateway's client SDK handed back, then settle the order. */
export async function verifyPayment(
  ctx: TenantContext,
  paymentId: string,
  payload: Record<string, string>,
) {
  const payment = await PaymentModel.findOne(tenantFilter(ctx, { _id: paymentId }));
  if (!payment) throw new HttpError(404, "Payment not found");
  if (payment.status === "paid") return { status: "paid" as const, orderId: payment.orderId };

  const provider = providerFor(payment.gateway);
  const creds = await credentialsFor(ctx, payment.gateway);

  let result;
  try {
    result = await provider.verify(creds, {
      gatewayOrderId: payment.gatewayOrderId ?? "",
      payload,
    });
  } catch (e) {
    logger.warn({ err: e, gateway: payment.gateway, paymentId }, "payment verification threw");
    throw new HttpError(502, `Couldn't confirm the payment with ${GATEWAY_LABELS[payment.gateway] ?? payment.gateway}. ${(e as Error).message}`);
  }

  payment.events.push({ at: new Date(), source: "client", type: result.ok ? "verify.ok" : "verify.failed", payload: { reason: result.reason } });

  if (!result.ok) {
    payment.status = "failed";
    payment.failureReason = result.reason;
    await payment.save();
    throw new HttpError(400, result.reason ?? "Payment could not be verified");
  }

  payment.status = "paid";
  payment.gatewayPaymentId = result.gatewayPaymentId;
  await payment.save();
  await settleOrder(payment.orderId, ctx, "paid");

  return { status: "paid" as const, orderId: payment.orderId };
}

async function settleOrder(orderId: string, ctx: TenantContext, status: "paid" | "failed" | "refunded") {
  const order = await OrderModel.findOne(tenantFilter(ctx, { _id: orderId }));
  if (!order) return;
  order.payment.status = status;
  await order.save();
}

/* ----------------------------------------------------------------- webhooks */

/**
 * Gateways are the source of truth and they retry. Every event is signature-checked
 * and recorded, so a replay is a no-op instead of a double settlement.
 */
export async function handleWebhook(gateway: Gateway, rawBody: string, headers: Record<string, string | undefined>) {
  const provider = providerFor(gateway);
  if (!provider?.parseWebhook) throw new HttpError(404, "That gateway doesn't send webhooks");

  // Find which outlet this belongs to by looking up the payment it references.
  // We must verify the signature per-outlet, so parse first with each candidate's secret.
  const peek = JSON.parse(rawBody) as { payload?: { payment?: { entity?: { order_id?: string } } } };
  const gatewayOrderId = peek.payload?.payment?.entity?.order_id;
  if (!gatewayOrderId) throw new HttpError(400, "Webhook did not reference a payment");

  const payment = await PaymentModel.findOne({ gatewayOrderId }, null, { allowGlobalQuery: true });
  if (!payment) throw new HttpError(404, "Unknown payment");

  const ctx: TenantContext = { brandId: payment.brandId, outletId: payment.outletId };
  const creds = await credentialsFor(ctx, gateway);
  const event = await provider.parseWebhook(creds, { rawBody, headers });

  if (!event.verified) throw new HttpError(400, "Webhook signature did not verify");

  // idempotency — a unique index makes the race safe
  try {
    await WebhookEventModel.create({ gateway, eventId: event.eventId });
  } catch {
    logger.info(`Ignoring duplicate ${gateway} webhook ${event.eventId}`);
    return { duplicate: true };
  }

  payment.events.push({ at: new Date(), source: "webhook", type: event.eventType });
  if (event.status && payment.status !== event.status) {
    payment.status = event.status;
    if (event.gatewayPaymentId) payment.gatewayPaymentId = event.gatewayPaymentId;
    await settleOrder(payment.orderId, ctx, event.status);
  }
  await payment.save();

  return { duplicate: false, status: payment.status };
}

/** Payment history for an order — the admin's audit view. */
export function listPaymentsForOrder(ctx: TenantContext, orderId: string) {
  return PaymentModel.find(tenantFilter(ctx, { orderId })).sort({ createdAt: 1 }).lean();
}
