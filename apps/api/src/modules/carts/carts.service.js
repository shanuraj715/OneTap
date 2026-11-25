import {
  CART_RECOVERY_HOURS,
  CART_REMINDER_MAX_AGE_HOURS,
  cartItemsText,
  cartRemindersSchema,
  DEFAULT_CART_REMINDER,
  formatINR,
  istParts,
  parseHHMM,
  renderTemplate,
} from "@rasoipulse/config-schema";
import { BrandModel, CartModel, CartReminderModel, CustomerModel, OutletModel, tenantFilter } from "@rasoipulse/db";
import { env } from "../../env.js";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";
import { getMenu } from "../menu/menu.service.js";
import { firstNameOf } from "../notify/notify.service.js";
import { sendCustomerText } from "../notify/customer-text.js";
import { storefrontOriginFor } from "../outlets/domains.js";
import { storePlan } from "../platform/plan.service.js";

/**
 * Abandoned-cart reminders. The storefront keeps the cart in the browser; for a SIGNED-IN customer it also sends a
 * copy here whenever the cart changes (only while the store has reminders switched on — otherwise nothing is kept).
 * A worker then looks for carts nobody has touched for `delayMinutes` and sends ONE reminder, inside the sending hours,
 * never twice to the same customer within `minDaysBetween` days, never for a cart older than a day, and never once
 * they have ordered. An order within 48 hours of a reminder counts as won back.
 */

const has = async (brandId, feature) => (await storePlan(brandId)).entitlements.features.includes(feature);

/** The store's reminder settings, with defaults — and whether its plan allows them at all. */
export async function cartReminderSettings(brandId) {
  const brand = await BrandModel.findById(brandId).select("cartReminders name").lean();
  const settings = cartRemindersSchema.parse(brand?.cartReminders ?? {});
  return { settings, planAllows: await has(brandId, "cartReminders"), storeName: brand?.name ?? "" };
}

/** Are reminders on for this store right now (plan AND the store's own switch)? */
async function remindersOn(brandId) {
  const { settings, planAllows } = await cartReminderSettings(brandId);
  return planAllows && settings.enabled ? settings : null;
}

export async function saveCartReminderSettings(ctx, input) {
  if (!(await has(ctx.brandId, "cartReminders"))) throw new HttpError(403, "Abandoned-cart reminders aren't included in your plan.");
  const parsed = cartRemindersSchema.safeParse(input);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Check the settings and try again.");
  const s = parsed.data;
  if (parseHHMM(s.sendFrom) >= parseHHMM(s.sendUntil)) throw new HttpError(400, "The sending hours must start before they end (e.g. 10:00 to 21:00).");
  await BrandModel.updateOne({ _id: ctx.brandId }, { $set: { cartReminders: s } });
  return cartReminderSettings(ctx.brandId);
}

/** What reminders did in the last `days` days (the whole store): sent, failed to send, won back (and their value). */
export async function cartReminderStats(ctx, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);
  const base = { brandId: ctx.brandId, remindedAt: { $gte: since } };
  const [sent, failed, recovered, value, waiting, recent] = await Promise.all([
    CartReminderModel.countDocuments({ ...base, status: { $in: ["sent", "recovered"] } }),
    CartReminderModel.countDocuments({ ...base, status: "failed" }),
    CartReminderModel.countDocuments({ ...base, status: "recovered" }),
    CartReminderModel.aggregate([{ $match: { ...base, status: "recovered" } }, { $group: { _id: null, v: { $sum: "$recoveredValue" } } }]),
    CartModel.countDocuments({ brandId: ctx.brandId, status: "open", itemCount: { $gt: 0 } }),
    CartReminderModel.find(base).sort({ remindedAt: -1 }).limit(20).lean(),
  ]);
  return {
    days,
    sent,
    failed,
    recovered,
    recoveredValue: value[0]?.v ?? 0,
    waiting,
    recent: recent.map((c) => ({
      id: String(c._id),
      name: c.name || "",
      phone: c.phone ? `${c.phone.slice(0, 2)}xxxxxx${c.phone.slice(-2)}` : "",
      items: c.items,
      value: c.value,
      remindedAt: c.remindedAt,
      channel: c.channel,
      error: c.error,
      status: c.status,
      recoveredValue: c.recoveredValue,
    })),
  };
}

/* ----------------------------------------------------------- the storefront's copy */

/**
 * The storefront saving a signed-in customer's cart. Nothing is kept unless the store has reminders on. An empty cart
 * removes the saved copy. The value is worked out from the live menu (dishes no longer on it are left out).
 */
export async function saveCart(ctx, customer, lines) {
  if (!(await remindersOn(ctx.brandId))) return { saved: false, off: true };
  const key = tenantFilter(ctx, { customerId: String(customer._id) });
  if (!lines.length) {
    await CartModel.deleteOne(key);
    return { saved: false };
  }
  const menu = await getMenu(ctx);
  const byId = new Map(menu.items.map((i) => [i.id, i]));
  const kept = [];
  let value = 0;
  for (const l of lines) {
    const item = byId.get(l.itemId);
    if (!item) continue;
    const variant = item.variants.find((v) => v.id === l.variantId);
    const unit = variant ? variant.price : item.basePrice;
    value += unit * l.quantity;
    kept.push({ itemId: l.itemId, variantId: l.variantId ?? null, modifierOptionIds: l.modifierOptionIds ?? [], quantity: l.quantity, name: item.name });
  }
  if (!kept.length) {
    await CartModel.deleteOne(key);
    return { saved: false };
  }
  const same = await CartModel.findOne(key).lean();
  if (same && JSON.stringify(same.lines) === JSON.stringify(kept)) return { saved: true };
  // A cart filled again after an order (or a day after a reminder) is a new cart that may be reminded about — the
  // per-customer gap still decides whether it actually is. One changed just after its reminder stays reminded.
  const fresh =
    !same ||
    ["ordered", "recovered"].includes(same.status) ||
    (same.status === "reminded" && (!same.remindedAt || Date.now() - new Date(same.remindedAt).getTime() > CART_REMINDER_MAX_AGE_HOURS * 3_600_000));
  await CartModel.updateOne(
    key,
    {
      $set: {
        lines: kept,
        itemCount: kept.reduce((n, l) => n + l.quantity, 0),
        value,
        touchedAt: new Date(),
        phone: customer.phone ?? "",
        name: customer.name ?? "",
        ...(fresh ? { status: "open", remindedAt: null, remindError: "", remindChannel: "", recoveredOrderId: null, recoveredValue: 0 } : {}),
      },
    },
    { upsert: true },
  );
  return { saved: true };
}

/** The saved lines of a cart, for the "your cart is waiting" link on another phone (no personal details). */
export async function cartLinesById(ctx, cartId) {
  if (!/^[a-f\d]{24}$/i.test(String(cartId))) throw new HttpError(404, "Cart not found");
  const cart = await CartModel.findOne(tenantFilter(ctx, { _id: cartId })).lean();
  if (!cart) throw new HttpError(404, "Cart not found");
  return { lines: (cart.lines ?? []).map((l) => ({ itemId: l.itemId, variantId: l.variantId ?? undefined, modifierOptionIds: l.modifierOptionIds ?? [], quantity: l.quantity })) };
}

/**
 * A customer placed an order: their cart here is done with — and if a reminder about a cart at this outlet went out in
 * the last 48 hours, that reminder won them back (recorded once, with the order's value).
 */
export async function markCartOrdered(ctx, customerId, order) {
  const cart = await CartModel.findOne(tenantFilter(ctx, { customerId: String(customerId) })).lean();
  const reminder = await CartReminderModel.findOneAndUpdate(
    tenantFilter(ctx, { customerId: String(customerId), status: "sent", remindedAt: { $gte: new Date(Date.now() - CART_RECOVERY_HOURS * 3_600_000) } }),
    { $set: { status: "recovered", recoveredOrderId: String(order._id), recoveredValue: order.totals?.grandTotal ?? 0 } },
    { sort: { remindedAt: -1 }, new: true },
  ).lean();
  if (!cart) return;
  await CartModel.updateOne(tenantFilter(ctx, { _id: cart._id }), {
    $set: reminder ? { status: "recovered", recoveredOrderId: String(order._id), recoveredValue: order.totals?.grandTotal ?? 0, lines: [], itemCount: 0 } : { status: "ordered", lines: [], itemCount: 0 },
  });
}

/* ------------------------------------------------------------------ the worker */

/** Is `now` inside the sending hours (India time)? */
function inSendingHours(settings, now) {
  const m = istParts(now).minutes;
  return m >= parseHHMM(settings.sendFrom) && m < parseHHMM(settings.sendUntil);
}

/**
 * One pass: every store with reminders on, every cart that has waited long enough. Exposed for the tests (with a fake
 * `now`). Returns how many reminders went out.
 */
export async function remindTick(now = Date.now()) {
  const brands = await BrandModel.find({ "cartReminders.enabled": true, disabled: null }).select("_id name cartReminders").lean();
  let sent = 0;
  for (const brand of brands) {
    const brandId = String(brand._id);
    try {
      const settings = await remindersOn(brandId);
      if (!settings || !inSendingHours(settings, now)) continue;
      const due = await CartModel.find({
        brandId,
        status: "open",
        itemCount: { $gt: 0 },
        touchedAt: { $lte: new Date(now - settings.delayMinutes * 60_000), $gte: new Date(now - CART_REMINDER_MAX_AGE_HOURS * 3_600_000) },
      })
        .sort({ touchedAt: 1 })
        .limit(50)
        .lean();
      for (const cart of due) sent += (await remindOne(brand, settings, cart, now)) ? 1 : 0;
    } catch (err) {
      logger.error({ err, brandId }, "cart reminders: a store's pass failed");
    }
  }
  return sent;
}

async function remindOne(brand, settings, cart, now) {
  const brandId = String(brand._id);
  const ctx = { brandId, outletId: cart.outletId };
  const customer = await CustomerModel.findOne({ _id: cart.customerId, brandId }).select("name phone cartRemindedAt").lean();
  // one reminder per customer per `minDaysBetween` days, whichever outlet the cart is at
  const recent = customer?.cartRemindedAt && now - new Date(customer.cartRemindedAt).getTime() < settings.minDaysBetween * 86_400_000;
  // claim it first, so two workers (or two passes) can never send it twice
  const claimed = await CartModel.findOneAndUpdate(
    { _id: cart._id, brandId, status: "open", touchedAt: cart.touchedAt },
    recent ? { $set: { status: "reminded", remindedAt: null, remindError: "skipped — reminded recently" } } : { $set: { status: "reminded", remindedAt: new Date(now) } },
    { new: true },
  ).lean();
  if (!claimed || recent) return false;

  const outlet = await OutletModel.findOne({ _id: cart.outletId, brandId }).select("name slug hostnames canonicalHostname blocked config.identity.name").lean();
  const phone = customer?.phone || cart.phone;
  if (!outlet || outlet.blocked || !phone) {
    await CartModel.updateOne({ _id: cart._id, brandId }, { $set: { remindError: !phone ? "no phone number" : "outlet unavailable" } });
    return false;
  }
  const link = `${storefrontOriginFor(outlet)}/${outlet.slug}/order?cart=${cart._id}`;
  const text = renderTemplate(settings.message?.trim() || DEFAULT_CART_REMINDER, {
    name: firstNameOf(customer?.name || cart.name) || "there",
    items: cartItemsText(cart.lines ?? []),
    total: formatINR(cart.value ?? 0),
    store: brand.name,
    outlet: outlet.config?.identity?.name || outlet.name,
    link,
  });
  const result = await sendCustomerText(ctx, { phone, name: customer?.name || cart.name, text, channel: settings.channel, source: "broadcast" });
  const error = result.ok ? "" : String(result.reason ?? "couldn't send").slice(0, 300);
  await CartModel.updateOne({ _id: cart._id, brandId }, { $set: { remindChannel: result.channel ?? "", remindError: error } });
  await CartReminderModel.create({
    brandId,
    outletId: cart.outletId,
    cartId: String(cart._id),
    customerId: cart.customerId,
    name: customer?.name || cart.name || "",
    phone,
    items: cartItemsText(cart.lines ?? []),
    value: cart.value ?? 0,
    remindedAt: new Date(now),
    channel: result.channel ?? "",
    status: result.ok ? "sent" : "failed",
    error,
  });
  if (result.ok) await CustomerModel.updateOne({ _id: cart.customerId, brandId }, { $set: { cartRemindedAt: new Date(now) } });
  return result.ok;
}

let timer = null;
let busy = false;

/**
 * Runs in the API process that sends messages (WHATSAPP_WORKER=on or MARKETING_WORKER=on) — like the other senders,
 * a development API pointed at a shared database must never message real customers.
 */
export function startCartReminderWorker() {
  if (env.WHATSAPP_WORKER !== "on" && env.MARKETING_WORKER !== "on") {
    logger.info("Cart reminders are off in this process (they run where WHATSAPP_WORKER or MARKETING_WORKER is on)");
    return;
  }
  if (timer) return;
  timer = setInterval(() => {
    if (busy) return;
    busy = true;
    remindTick()
      .catch((err) => logger.error({ err }, "cart reminder pass failed"))
      .finally(() => {
        busy = false;
      });
  }, 60_000);
  timer.unref();
  logger.info("Cart reminder worker started");
}
