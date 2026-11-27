import {
  GATEWAY_FIELDS,
  GATEWAY_LABELS,
  PAYMENT_HOLD_MINUTES,
               
} from "@rasoipulse/config-schema";
import {
  OrderModel,
  PaymentCredentialModel,
  PaymentModel,
  ReservationModel,
  tenantFilter,
  WebhookEventModel,
                     
} from "@rasoipulse/db";
import { env } from "../../env.js";
import { decryptSecret, encryptSecret, maskSecret } from "../../lib/crypto.js";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";
import { effectiveOutletConfig } from "../outlets/config.service.js";
import { providerFor,                         } from "./providers/index.js";

/* -------------------------------------------------------------- credentials */

/** Decrypted credentials for a gateway. Never leaves the API process. */
async function credentialsFor(ctx               , gateway         )                              {
  const doc = await PaymentCredentialModel.findOne(tenantFilter(ctx, { gateway })).lean();
  if (!doc) return {};

  const creds                     = { ...(doc.publicFields ?? {}) };
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
export async function listGatewayConfig(ctx               ) {
  const docs = await PaymentCredentialModel.find(tenantFilter(ctx)).lean();
  const byGateway = new Map(docs.map((d) => [d.gateway, d]));

  return (Object.keys(GATEWAY_FIELDS)             ).map((gateway) => {
    const provider = providerFor(gateway);
    const doc = byGateway.get(gateway);
    const fields = GATEWAY_FIELDS[gateway].map((f) => ({
      ...f,
      value: f.secret
        ? doc?.encryptedFields?.[f.key]
          ? maskSecret(doc.encryptedFields[f.key] .slice(-12))
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
  ctx               ,
  gateway         ,
  values                        ,
  userId        ,
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

export async function clearCredentials(ctx               , gateway         ) {
  await PaymentCredentialModel.deleteOne(tenantFilter(ctx, { gateway }));
}

/* ------------------------------------------------------------------ intents */

async function outletConfigFor(ctx               ) {
  return effectiveOutletConfig(ctx);
}

/**
 * Open a payment with a gateway: checks the gateway is online, switched on for the outlet and fully set up, then asks it for an intent.
 * A failure from the gateway's own API is not a Rasoi Pulse bug — the real reason (bad keys, account not activated, amount limits) is
 * surfaced as a 502 so the customer and the restaurant can see what to fix, not "Internal error".
 */
async function openIntent(ctx               , gateway         , { amount, receipt, notes, what })                                                                    {
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

  try {
    return await provider.createIntent(creds, { amount, currency: "INR", receipt, notes });
  } catch (e) {
    const detail = (e         ).message || "unknown error";
    logger.warn({ err: e, gateway, what }, "payment intent creation failed at the gateway");
    throw new HttpError(
      502,
      `${GATEWAY_LABELS[gateway] ?? gateway} could not start this payment: ${detail}. ` +
        `Check the ${gateway} keys in Admin → Payments.`,
    );
  }
}

/** Create (or reuse) a payment intent for an order that still owes money. */
export async function createIntent(ctx               , orderId        ) {
  const order = await OrderModel.findOne(tenantFilter(ctx, { _id: orderId }));
  if (!order) throw new HttpError(404, "Order not found");
  if (order.payment.status === "paid") throw new HttpError(409, "This order is already paid");

  const gateway = order.payment.gateway;
  const intent = await openIntent(ctx, gateway, {
    amount: order.totals.grandTotal,
    receipt: order.orderNumber,
    notes: { orderId: String(order._id), outletId: ctx.outletId ?? "" },
    what: `order ${String(order._id)}`,
  });

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

/* ------------------------------------------------------------ table bookings */

/**
 * The online gateway an outlet takes a table booking's advance with, or null when it has none it can use right now (nothing online switched on,
 * or its keys aren't filled in). The real gateway is preferred over the test one.
 */
export async function bookingGatewayFor(ctx               ) {
  const config = await outletConfigFor(ctx);
  const online = config.payments.enabled.filter((g) => providerFor(g)?.isOnline && (g !== "mock" || env.ALLOW_MOCK_GATEWAY));
  const ordered = [...online.filter((g) => g !== "mock"), ...online.filter((g) => g === "mock")];
  for (const gateway of ordered) {
    const provider = providerFor(gateway);
    const creds = await credentialsFor(ctx, gateway).catch(() => ({}));
    if (provider.requiredFields.every((f) => creds[f])) return gateway;
  }
  return null;
}

/** Start the payment of a table booking's advance (half of its amount). Only for a booking that is still waiting for it, inside its hold. */
export async function createBookingIntent(ctx               , reservationId        ) {
  const booking = await ReservationModel.findOne(tenantFilter(ctx, { _id: reservationId }));
  if (!booking) throw new HttpError(404, "Booking not found");
  if (booking.payment?.status === "paid") throw new HttpError(409, "The advance for this booking is already paid");
  const expired = new Date(booking.createdAt).getTime() < Date.now() - PAYMENT_HOLD_MINUTES * 60_000;
  if (booking.payment?.status !== "pending" || booking.status !== "requested" || expired) {
    throw new HttpError(409, "This booking request has expired — please book again.");
  }
  const gateway = await bookingGatewayFor(ctx);
  if (!gateway) throw new HttpError(409, "Online payment isn't available right now.");
  const amount = booking.pricing?.prepayPaise ?? 0;
  if (amount <= 0) throw new HttpError(409, "There's no advance to pay for this booking.");

  const intent = await openIntent(ctx, gateway, {
    amount,
    receipt: booking.code,
    notes: { reservationId: String(booking._id), outletId: ctx.outletId ?? "" },
    what: `booking ${booking.code}`,
  });
  const payment = await PaymentModel.create({
    brandId: ctx.brandId,
    outletId: ctx.outletId,
    subject: "reservation",
    orderId: String(booking._id),
    gateway,
    status: "pending",
    amount,
    currency: "INR",
    gatewayOrderId: intent.gatewayOrderId,
    events: [{ at: new Date(), source: "server", type: "intent.created" }],
  });
  return { paymentId: String(payment._id), gateway, ...intent };
}

/** A payment that was verified or confirmed by the gateway: settle whatever it was for. */
async function settleSubject(payment, ctx               , status                                ) {
  if (payment.subject === "reservation") {
    if (status === "paid") {
      const { settleReservationPayment } = await import("../reservations/reservations.service.js");
      await settleReservationPayment(ctx, payment.orderId, payment.gatewayPaymentId ?? "");
    }
    return; // a failed advance leaves the booking waiting; it is let go when its hold runs out
  }
  await settleOrder(payment.orderId, ctx, status);
}

/** Who may pay for this payment: it must belong to the signed-in customer's own order or booking. Returns what it is for. */
export async function paymentSubject(ctx               , paymentId        ) {
  const payment = await PaymentModel.findOne(tenantFilter(ctx, { _id: paymentId })).lean();
  if (!payment) throw new HttpError(404, "Payment not found");
  return { subject: payment.subject ?? "order", id: payment.orderId };
}

/** Verify what the gateway's client SDK handed back, then settle the order. */
export async function verifyPayment(
  ctx               ,
  paymentId        ,
  payload                        ,
) {
  const payment = await PaymentModel.findOne(tenantFilter(ctx, { _id: paymentId }));
  if (!payment) throw new HttpError(404, "Payment not found");
  if (payment.status === "paid") return { status: "paid"         , orderId: payment.orderId };

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
    throw new HttpError(502, `Couldn't confirm the payment with ${GATEWAY_LABELS[payment.gateway] ?? payment.gateway}. ${(e         ).message}`);
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
  await settleSubject(payment, ctx, "paid");

  return { status: "paid"         , orderId: payment.orderId, subject: payment.subject ?? "order" };
}

async function settleOrder(orderId        , ctx               , status                                ) {
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
export async function handleWebhook(gateway         , rawBody        , headers                                    ) {
  const provider = providerFor(gateway);
  if (!provider?.parseWebhook) throw new HttpError(404, "That gateway doesn't send webhooks");

  // Find which outlet this belongs to by looking up the payment it references.
  // We must verify the signature per-outlet, so parse first with each candidate's secret.
  const peek = JSON.parse(rawBody)                                                                  ;
  const gatewayOrderId = peek.payload?.payment?.entity?.order_id;
  if (!gatewayOrderId) throw new HttpError(400, "Webhook did not reference a payment");

  const payment = await PaymentModel.findOne({ gatewayOrderId }, null, { allowGlobalQuery: true });
  if (!payment) throw new HttpError(404, "Unknown payment");

  const ctx                = { brandId: payment.brandId, outletId: payment.outletId };
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
    await payment.save();
    await settleSubject(payment, ctx, event.status);
  }
  await payment.save();

  return { duplicate: false, status: payment.status };
}

/** Payment history for an order — the admin's audit view. */
export function listPaymentsForOrder(ctx               , orderId        ) {
  return PaymentModel.find(tenantFilter(ctx, { orderId })).sort({ createdAt: 1 }).lean();
}
