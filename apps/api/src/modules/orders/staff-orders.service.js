import { createHmac } from "node:crypto";
import { CustomerModel, TableModel, TableSessionModel, tenantFilter } from "@onetap/db";
import { env } from "../../env.js";
import { safeEqual } from "../../lib/crypto.js";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";
import { requestOtp, verifyCoinsCode } from "../customer/customer.service.js";
import { smsCodeSender } from "../notify/notify.service.js";
import { effectiveOutletConfig } from "../outlets/config.service.js";
import { openSession } from "../tables/tables.service.js";
import { placeOrder, quote, updateStatus } from "./orders.service.js";

/**
 * Staff taking an order at a table — the "Take order" screen.
 *
 * Every order is for a table (picked first), and the customer is identified by
 * mobile number so they're the same person here as on the storefront, where
 * sign-in stores the same 10 digits: their visits count up, completed orders
 * earn them coins, and they can spend coins (with a code read back from their
 * phone when the store sends SMS codes, directly when it doesn't).
 */

/** The 10-digit form the storefront's sign-in stores — anything else would be a second customer. */
export function normalizePhone(raw) {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length !== 10) throw new HttpError(400, "Enter the customer's 10-digit mobile number.");
  return digits;
}

const cleanEmail = (v) => (v?.trim() ? v.trim().toLowerCase() : undefined);

/** Find the customer by mobile, or create them. Fills in a missing name/email; never overwrites one. */
async function findOrCreateCustomer(brandId, phone, { name, email }) {
  const existing = await CustomerModel.findOne({ brandId, phone });
  if (!existing) {
    return CustomerModel.create({ brandId, phone, name: name?.trim() || undefined, email: cleanEmail(email) });
  }
  let dirty = false;
  if (name?.trim() && !existing.name) {
    existing.name = name.trim();
    dirty = true;
  }
  if (cleanEmail(email) && !existing.email) {
    existing.email = cleanEmail(email);
    dirty = true;
  }
  if (dirty) await existing.save();
  return existing;
}

/* ------------------------------------------------------------ coin approval */

const APPROVAL_MINUTES = 10;
const approvalSig = (brandId, customerId, exp) =>
  createHmac("sha256", env.ENCRYPTION_KEY).update(`coins|${brandId}|${customerId}|${exp}`).digest("base64url");

/** Proof that the customer read back their code — good for one order screen's worth of time. */
function issueCoinsApproval(brandId, customerId) {
  const exp = Date.now() + APPROVAL_MINUTES * 60 * 1000;
  return `${exp}.${approvalSig(brandId, customerId, exp)}`;
}

function coinsApprovalValid(token, brandId, customerId) {
  const [exp, sig] = String(token ?? "").split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(approvalSig(brandId, customerId, exp), sig);
}

/* ------------------------------------------------------------------ lookup */

/** What staff see after typing a mobile number: who it is, and whether coins can be used. */
export async function lookupCustomer(ctx, rawPhone) {
  const phone = normalizePhone(rawPhone);
  const [customer, config, sender] = await Promise.all([
    CustomerModel.findOne({ brandId: ctx.brandId, phone }).lean(),
    effectiveOutletConfig(ctx),
    smsCodeSender(ctx.brandId),
  ]);
  return {
    phone,
    customer: customer
      ? {
          id: String(customer._id),
          name: customer.name ?? null,
          email: customer.email ?? null,
          visits: customer.orderCount ?? 0,
          coins: customer.walletBalance ?? 0,
          hasEmail: Boolean(customer.email),
        }
      : null,
    wallet: {
      enabled: config.wallet.enabled,
      redeemValuePaise: config.wallet.redeemValuePaise,
      maxRedeemPercent: config.wallet.maxRedeemPercent,
    },
    smsCodes: Boolean(sender),
  };
}

/**
 * Customers whose mobile starts with what staff have typed so far — the
 * dropdown under the mobile field. Three digits minimum, most recent first.
 */
export async function searchCustomers(ctx, rawQuery) {
  const digits = String(rawQuery ?? "").replace(/\D/g, "").slice(0, 10);
  if (digits.length < 3) return [];
  const customers = await CustomerModel.find({ brandId: ctx.brandId, phone: { $regex: `^${digits}` } })
    .sort({ lastOrderAt: -1, createdAt: -1 })
    .limit(8)
    .lean();
  return customers.map((c) => ({
    id: String(c._id),
    name: c.name ?? null,
    phone: c.phone,
    email: c.email ?? null,
    visits: c.orderCount ?? 0,
    coins: c.walletBalance ?? 0,
  }));
}

/** The customer an order on this table would be for: the seated party's, or whoever owns this number. */
async function customerIdFor(ctx, { tableId, phone }) {
  if (tableId) {
    const table = await TableModel.findOne(tenantFilter(ctx, { _id: tableId })).lean();
    if (table?.activeSessionId) {
      const session = await TableSessionModel.findOne(tenantFilter(ctx, { _id: table.activeSessionId, status: "open" })).lean();
      if (session) return session.customerId;
    }
  }
  if (!phone) return null;
  const customer = await CustomerModel.findOne({ brandId: ctx.brandId, phone: normalizePhone(phone) }).lean();
  return customer ? String(customer._id) : null;
}

/** The live price for the order panel — the same `quote()` placement uses, coins included. */
export async function staffQuote(ctx, { cart, tableId, phone }) {
  const customerId = await customerIdFor(ctx, { tableId, phone });
  return quote(ctx, cart, { channel: "dine-in", customerId });
}

/* ------------------------------------------------------------- coin codes */

export async function sendCoinsCode(ctx, rawPhone) {
  const phone = normalizePhone(rawPhone);
  if (!(await smsCodeSender(ctx.brandId))) {
    throw new HttpError(409, "SMS codes aren't switched on for this store — coins can be used without a code.");
  }
  const customer = await CustomerModel.exists({ brandId: ctx.brandId, phone });
  if (!customer) throw new HttpError(404, "This number has no coins yet.");
  await requestOtp({ brandId: ctx.brandId, outletId: ctx.outletId, destination: phone, purpose: "coins" });
  return { sent: true };
}

export async function confirmCoinsCode(ctx, rawPhone, code) {
  const phone = normalizePhone(rawPhone);
  const customer = await CustomerModel.findOne({ brandId: ctx.brandId, phone }).lean();
  if (!customer) throw new HttpError(404, "This number has no coins yet.");
  await verifyCoinsCode({ brandId: ctx.brandId, phone, code });
  return { approval: issueCoinsApproval(ctx.brandId, String(customer._id)) };
}

/* ------------------------------------------------------------------- place */

/**
 * Place a staff order on a table and send it straight to the kitchen.
 *
 * A free table opens a new party for this customer; a seated table adds to
 * the party already there (a different mobile number is refused — that would
 * put this food on someone else's bill). The order is accepted on the spot,
 * through the same `updateStatus` an Approve tap uses, so kitchen tickets and
 * customer alerts fire exactly as they always do.
 */
export async function placeStaffOrder(ctx, user, input) {
  const table = await TableModel.findOne(tenantFilter(ctx, { _id: input.tableId }));
  if (!table) throw new HttpError(404, "That table doesn't exist.");
  if (!table.isActive) throw new HttpError(409, `Table ${table.number} isn't in service.`);

  let session = table.activeSessionId
    ? await TableSessionModel.findOne(tenantFilter(ctx, { _id: table.activeSessionId, status: "open" }))
    : null;

  let customer;
  if (session) {
    customer = await CustomerModel.findOne({ _id: session.customerId, brandId: ctx.brandId });
    if (input.phone) {
      const phone = normalizePhone(input.phone);
      if (customer?.phone && customer.phone !== phone) {
        throw new HttpError(409, `Table ${table.number} already has another party. Pick another table, or move them first.`);
      }
    }
  } else {
    if (!input.phone) throw new HttpError(400, "Enter the customer's mobile number.");
    customer = await findOrCreateCustomer(ctx.brandId, normalizePhone(input.phone), input);
  }
  const customerId = customer ? String(customer._id) : null;

  // Coins are checked before the table is touched, so a refused order never
  // leaves a table locked with nothing on it.
  if ((input.cart.redeemCoins ?? 0) > 0) {
    if (!customerId) throw new HttpError(409, "Coins need a customer with a mobile number.");
    if ((await smsCodeSender(ctx.brandId)) && !coinsApprovalValid(input.coinsApproval, ctx.brandId, customerId)) {
      throw new HttpError(403, "Ask the customer for the code sent to their phone before using their coins.");
    }
  }

  const openedHere = !session;
  const tableStatusBefore = table.status;
  if (openedHere) session = await openSession(ctx, String(table._id), customerId);

  let order;
  try {
    order = await placeOrder({
      ctx,
      cart: input.cart,
      channel: "dine-in",
      customer: {
        customerId: customerId ?? undefined,
        name: input.name?.trim() || customer?.name || undefined,
        phone: customer?.phone,
        email: customer?.email,
      },
      note: input.note,
      gateway: "cod",
      placedBy: "staff",
      staffId: String(user._id),
      staffName: user.name,
      tableId: String(table._id),
      sessionId: String(session._id),
    });
  } catch (err) {
    // Don't leave the table locked by a party that never got an order in.
    if (openedHere) {
      await TableSessionModel.deleteOne(tenantFilter(ctx, { _id: session._id }));
      await TableModel.updateOne(tenantFilter(ctx, { _id: table._id }), { $set: { activeSessionId: null, status: tableStatusBefore } });
    }
    throw err;
  }

  try {
    return await updateStatus(ctx, String(order._id), "accepted", String(user._id));
  } catch (err) {
    // The order exists either way — staff can still approve it from Orders.
    logger.error({ err, orderId: String(order._id) }, "staff order placed but couldn't be sent to the kitchen");
    return order;
  }
}
