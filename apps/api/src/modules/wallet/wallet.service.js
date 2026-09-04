import {
  checkRedeem,
  coinsEarnedFor,
  outletConfigSchema,
                   
                      
} from "@onetap/config-schema";
import {
  CustomerModel,
  OutletModel,
  WalletLedgerModel,
                
                     
} from "@onetap/db";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";

async function walletSettingsFor(ctx               )                          {
  const outlet = await OutletModel.findOne({ _id: ctx.outletId }, null, { allowGlobalQuery: true }).lean();
  if (!outlet) throw new HttpError(404, "Outlet not found");
  return outletConfigSchema.parse(outlet.config ?? {}).wallet;
}

/**
 * How many of the coins a customer asked to spend can actually be applied to
 * this cart — the same check used at placement, so a checkout preview and the
 * placed order can never disagree. Never trusts a client-stated balance.
 */
export async function previewRedeem(
  ctx               ,
  customerId                           ,
  requestedCoins        ,
  subtotalPaise        ,
)                       {
  const settings = await walletSettingsFor(ctx);
  if (!customerId) {
    return { ok: false, coinsApplied: 0, discountPaise: 0, reason: "Sign in to use your coins." };
  }
  const customer = await CustomerModel.findOne({ _id: customerId, brandId: ctx.brandId }).lean();
  const balance = customer?.walletBalance ?? 0;
  return checkRedeem(requestedCoins, balance, subtotalPaise, settings);
}

/** A customer's current balance, for the storefront wallet view. */
export async function balanceFor(ctx               , customerId        )                  {
  const customer = await CustomerModel.findOne({ _id: customerId, brandId: ctx.brandId }).lean();
  return customer?.walletBalance ?? 0;
}

/**
 * Debit the coins an order actually redeemed. Idempotent via the unique
 * (orderId, kind) index on {@link WalletLedgerModel} — a retried order
 * placement debits once. Guarded against going negative with a conditional
 * `$gte` update; on the very rare race where the balance changed between the
 * quote and this debit, the redeem is logged and left un-debited rather than
 * blocking the order — the order total was already fixed at placement.
 */
export async function redeemForOrder(input   
                     
                     
                  
                      
                
 )                {
  const { ctx, customerId, orderId, orderNumber, coins } = input;
  if (coins <= 0) return;

  try {
    await WalletLedgerModel.create({
      brandId: ctx.brandId,
      outletId: ctx.outletId,
      customerId,
      orderId,
      orderNumber,
      kind: "redeem",
      coins: -coins,
      balanceAfter: -1,
      reason: `Redeemed on order #${orderNumber}`,
    });
  } catch (e) {
    if ((e                     ).code !== 11000) throw e;
    return; // already debited for this order
  }

  const updated = await CustomerModel.findOneAndUpdate(
    { _id: customerId, brandId: ctx.brandId, walletBalance: { $gte: coins } },
    { $inc: { walletBalance: -coins } },
    { new: true },
  );
  if (!updated) {
    logger.error({ orderId, customerId, coins }, "wallet redeem: balance changed before debit — coins not deducted");
    return;
  }
  await WalletLedgerModel.updateOne(
    { brandId: ctx.brandId, orderId, kind: "redeem" },
    { balanceAfter: updated.walletBalance },
  );
}

/**
 * Credit what an order earns. Called when an order reaches "completed" — not
 * at placement — so an order that's later cancelled never paid out coins.
 * Idempotent the same way as {@link redeemForOrder}.
 */
export async function earnForOrder(ctx               , order          )                  {
  if (!order.customer.customerId) return 0;
  const settings = await walletSettingsFor(ctx);
  const coins = coinsEarnedFor(order.totals.grandTotal, settings);
  if (coins <= 0) return 0;

  const orderId = String(order._id);
  try {
    await WalletLedgerModel.create({
      brandId: ctx.brandId,
      outletId: ctx.outletId,
      customerId: order.customer.customerId,
      orderId,
      orderNumber: order.orderNumber,
      kind: "earn",
      coins,
      balanceAfter: -1,
      reason: `Earned on order #${order.orderNumber}`,
    });
  } catch (e) {
    if ((e                     ).code !== 11000) throw e;
    return 0; // already credited
  }

  const updated = await CustomerModel.findOneAndUpdate(
    { _id: order.customer.customerId, brandId: ctx.brandId },
    { $inc: { walletBalance: coins } },
    { new: true },
  );
  if (updated) {
    await WalletLedgerModel.updateOne(
      { brandId: ctx.brandId, orderId, kind: "earn" },
      { balanceAfter: updated.walletBalance },
    );
  }
  return coins;
}

/**
 * Refund coins an order redeemed, when the order is cancelled. Idempotent —
 * safe to call on every cancellation regardless of whether one actually
 * redeemed anything (a no-op when `coinsRedeemed` is 0).
 */
export async function reverseRedeemForOrder(ctx               , order          )                {
  const coins = order.totals.coinsRedeemed;
  if (!order.customer.customerId || !coins || coins <= 0) return;

  const orderId = String(order._id);
  try {
    await WalletLedgerModel.create({
      brandId: ctx.brandId,
      outletId: ctx.outletId,
      customerId: order.customer.customerId,
      orderId,
      orderNumber: order.orderNumber,
      kind: "reverse",
      coins,
      balanceAfter: -1,
      reason: `Refunded — order #${order.orderNumber} cancelled`,
    });
  } catch (e) {
    if ((e                     ).code !== 11000) throw e;
    return;
  }

  const updated = await CustomerModel.findOneAndUpdate(
    { _id: order.customer.customerId, brandId: ctx.brandId },
    { $inc: { walletBalance: coins } },
    { new: true },
  );
  if (updated) {
    await WalletLedgerModel.updateOne(
      { brandId: ctx.brandId, orderId, kind: "reverse" },
      { balanceAfter: updated.walletBalance },
    );
  }
}

/** A customer's coin history, for the admin's customer detail view. */
export function ledgerFor(ctx               , customerId        , limit = 50) {
  return WalletLedgerModel.find({ brandId: ctx.brandId, outletId: ctx.outletId, customerId })
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, 200))
    .lean();
}
