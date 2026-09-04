import mongoose, { type Model } from "mongoose";
import { tenantScope } from "../tenant-scope";

const { Schema, model, models } = mongoose;

export const WALLET_LEDGER_KINDS = ["earn", "redeem", "reverse"] as const;
export type WalletLedgerKind = (typeof WALLET_LEDGER_KINDS)[number];

/**
 * One row per coin movement — the audit trail for the loyalty wallet, and the
 * mechanism that makes crediting/debiting idempotent. The unique
 * (orderId, kind) index means a retried order placement or a re-delivered
 * status update can never double-spend or double-pay coins: the second
 * attempt's `create` just hits a duplicate-key error and is treated as a
 * no-op, exactly like {@link CouponRedemptionModel}.
 */
export interface WalletLedgerDoc {
  _id: string;
  brandId: string;
  outletId: string;
  customerId: string;
  /** absent for a manual balance correction — every other kind is order-bound */
  orderId?: string;
  orderNumber?: string;
  kind: WalletLedgerKind;
  /** positive = credited to the wallet, negative = debited */
  coins: number;
  /** the wallet balance immediately after this entry, for a readable statement */
  balanceAfter: number;
  reason: string;
  createdAt: Date;
}

const walletLedgerSchema = new Schema<WalletLedgerDoc>(
  {
    customerId: { type: String, required: true, index: true },
    orderId: { type: String },
    orderNumber: { type: String },
    kind: { type: String, enum: WALLET_LEDGER_KINDS, required: true },
    coins: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    reason: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
walletLedgerSchema.plugin(tenantScope);
walletLedgerSchema.index(
  { orderId: 1, kind: 1 },
  { unique: true, partialFilterExpression: { orderId: { $exists: true } } },
);
walletLedgerSchema.index({ brandId: 1, outletId: 1, customerId: 1, createdAt: -1 });

export const WalletLedgerModel: Model<WalletLedgerDoc> =
  (models.WalletLedger as Model<WalletLedgerDoc> | undefined) ??
  model<WalletLedgerDoc>("WalletLedger", walletLedgerSchema);
