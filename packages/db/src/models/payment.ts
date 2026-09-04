import mongoose, { type Model } from "mongoose";
import { GATEWAYS, PAYMENT_STATUSES, type Gateway, type PaymentStatus } from "@onetap/config-schema";
import { tenantScope } from "../tenant-scope";

const { Schema, model, models } = mongoose;

/**
 * Per-outlet gateway credentials. Deliberately NOT part of `outlet.config` —
 * that blob is served to the public storefront. Secret fields are stored
 * encrypted and never leave the API.
 */
export interface PaymentCredentialDoc {
  _id: string;
  brandId: string;
  outletId: string;
  gateway: Gateway;
  /** non-secret fields as-is (e.g. keyId) */
  publicFields: Record<string, string>;
  /** secret fields, each an AES-256-GCM envelope */
  encryptedFields: Record<string, string>;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const credentialSchema = new Schema<PaymentCredentialDoc>(
  {
    gateway: { type: String, enum: GATEWAYS, required: true },
    publicFields: { type: Schema.Types.Mixed, default: {} },
    encryptedFields: { type: Schema.Types.Mixed, default: {} },
    updatedBy: String,
  },
  { timestamps: true },
);
credentialSchema.plugin(tenantScope);
credentialSchema.index({ brandId: 1, outletId: 1, gateway: 1 }, { unique: true });

export const PaymentCredentialModel: Model<PaymentCredentialDoc> =
  (models.PaymentCredential as Model<PaymentCredentialDoc> | undefined) ??
  model<PaymentCredentialDoc>("PaymentCredential", credentialSchema);

/* ----------------------------------------------------------------- payments */

/** One payment attempt against one order. The audit trail for money. */
export interface PaymentDoc {
  _id: string;
  brandId: string;
  outletId: string;
  orderId: string;
  gateway: Gateway;
  status: PaymentStatus;
  /** integer paise */
  amount: number;
  currency: string;
  /** the gateway's order/intent id */
  gatewayOrderId?: string;
  /** the gateway's payment id, once captured */
  gatewayPaymentId?: string;
  failureReason?: string;
  /** raw gateway events, newest last — kept for reconciliation */
  events: { at: Date; source: "client" | "webhook" | "server"; type: string; payload?: unknown }[];
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<PaymentDoc>(
  {
    orderId: { type: String, required: true, index: true },
    gateway: { type: String, enum: GATEWAYS, required: true },
    status: { type: String, enum: PAYMENT_STATUSES, default: "pending", index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    gatewayOrderId: { type: String, index: true },
    gatewayPaymentId: { type: String, index: true },
    failureReason: String,
    events: {
      type: [new Schema({ at: Date, source: String, type: String, payload: Schema.Types.Mixed }, { _id: false })],
      default: [],
    },
  },
  { timestamps: true },
);
paymentSchema.plugin(tenantScope);
paymentSchema.index({ brandId: 1, outletId: 1, createdAt: -1 });

export const PaymentModel: Model<PaymentDoc> =
  (models.Payment as Model<PaymentDoc> | undefined) ?? model<PaymentDoc>("Payment", paymentSchema);

/* -------------------------------------------------------- webhook idempotency */

/** Gateways retry webhooks. This makes replays cheap and safe. */
export interface WebhookEventDoc {
  _id: string;
  gateway: Gateway;
  /** the gateway's own event id, or a hash of the payload */
  eventId: string;
  processedAt: Date;
}

const webhookSchema = new Schema<WebhookEventDoc>({
  gateway: { type: String, enum: GATEWAYS, required: true },
  eventId: { type: String, required: true },
  processedAt: { type: Date, default: () => new Date() },
});
webhookSchema.index({ gateway: 1, eventId: 1 }, { unique: true });
// keep 30 days of replay protection
webhookSchema.index({ processedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export const WebhookEventModel: Model<WebhookEventDoc> =
  (models.WebhookEvent as Model<WebhookEventDoc> | undefined) ??
  model<WebhookEventDoc>("WebhookEvent", webhookSchema);
