                                                 
import {
  checkDelivery,
  checkPickupTime,
  pickupSlots,
  evaluateCapacity,
  FEEDBACK_EDIT_DAYS,
  FEEDBACK_WINDOW_DAYS,
  nextStatusesFor,
  priceCart,
  PricingError,
  stockNeeds,
                      
            
                    
                   
               
                
                
                   
                   
} from "@onetap/config-schema";
import {
  brandFilter,
  CustomerModel,
  FeedbackModel,
  nextSequence,
  OrderModel,
  OutletModel,
  PrintJobModel,
  RiderModel,
  tenantFilter,
                
                     
} from "@onetap/db";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";
import { broadcast } from "../../realtime/hub.js";
import { checkCoupon, recordRedemption } from "../coupons/coupons.service.js";
import { cache } from "../cache/cache.js";
import { getMenu } from "../menu/menu.service.js";
import { holdStock, reholdStock, releaseStock, returnStock } from "../menu/stock.service.js";
import { markCartOrdered } from "../carts/carts.service.js";
import { assertOutletOpen, effectiveOutletConfig } from "../outlets/config.service.js";
import { publicOutletById } from "../outlets/outlet-cache.js";
import { fireOrderNotifications } from "../notify/notify.service.js";
import { autoPrintForOrder, printOrderChange } from "../printing/printing.service.js";
import { earnForOrder, previewRedeem, redeemForOrder, reverseRedeemForOrder, revokeEarnForOrder } from "../wallet/wallet.service.js";

/** Shape an order for the wire the same way the REST routes do. */
export function wire(o          ) {
  return {
    id: String(o._id),
    orderNumber: o.orderNumber,
    channel: o.channel,
    // Older orders predate this field — default to "customer", which is what
    // every order was before staff-placed orders existed.
    placedBy: o.placedBy ?? "customer",
    staffName: o.staffName ?? null,
    status: o.status,
    lines: o.lines,
    totals: o.totals,
    pricesIncludeTax: o.pricesIncludeTax,
    payment: o.payment,
    note: o.note ?? null,
    customer: o.customer,
    tableId: o.tableId ?? null,
    sessionId: o.sessionId ?? null,
    couponCode: o.couponCode ?? null,
    deliveryAddress: o.deliveryAddress ?? null,
    etaMinutes: o.etaMinutes ?? null,
    scheduledFor: o.scheduledFor ?? null,
    rider: o.rider?.name ? { riderId: o.rider.riderId ?? null, name: o.rider.name, phone: o.rider.phone ?? "", assignedAt: o.rider.assignedAt ?? null } : null,
    statusHistory: o.statusHistory ?? [],
    createdAt: o.createdAt,
  };
}

/** Give an order's counted stock back, never failing the caller (an order must still be cancellable if this fails). */
async function giveStockBack(ctx, order) {
  try {
    await releaseStock(ctx, order);
  } catch (err) {
    logger.error({ err, orderId: String(order._id) }, "stock: couldn't give an order's stock back");
  }
}

/**
 * Queue whatever the outlet has configured to print at this point in an order's
 * life. Deliberately fire-and-forget: a printer that is offline, out of paper or
 * misconfigured must never stop an order being taken or a status being moved.
 * The job lands in the queue either way, with its own retries.
 */
function firePrinters(ctx               , order          , status             )       {
  void autoPrintForOrder(ctx, order, status).catch((err) => {
    logger.error({ err, orderId: String(order._id), status }, "auto-print failed");
  });
}

/**
 * The order was edited after its kitchen ticket went out: the kitchen gets a short "ORDER CHANGED" ticket with only
 * what is different. Same fire-and-forget contract as {@link firePrinters}.
 */
function firePrintChange(ctx               , before                                          , after          )       {
  void printOrderChange(ctx, before, after).catch((err) => {
    logger.error({ err, orderId: String(after._id) }, "change-ticket print failed");
  });
}

/**
 * Queue whatever WhatsApp/SMS alert the outlet has configured for this status.
 * Same contract as {@link firePrinters}: not configured, misconfigured, or the
 * provider being down must never stop an order being taken or a status being
 * moved — every outcome, including "nothing to send", lands as a
 * NotificationLog row instead of an exception.
 */
function fireNotifications(ctx               , order          , status             )       {
  void fireOrderNotifications(ctx, order, status).catch((err) => {
    logger.error({ err, orderId: String(order._id), status }, "order notification dispatch failed");
  });
}

/** The outlet's config as it actually applies — the owner's settings within what the store's plan unlocks. */
export async function outletConfigFor(ctx               ) {
  return effectiveOutletConfig(ctx);
}

/** "In the queue" for load-management purposes — placed, accepted or preparing. */
export const QUEUE_STATUSES                = ["placed", "accepted", "preparing"];

/**
 * The live capacity read: how many orders are actually in the queue right
 * now, evaluated against the outlet's own thresholds. Used both to answer
 * `GET /api/orders/capacity` (public, for the storefront banner + admin
 * badge) and to gate delivery at placement time — always the SAME numbers,
 * so a customer is never shown "delivery is fine" and then refused it.
 */
export async function getCapacityStatus(ctx               , { cached = false } = {}                          ) {
  // `cached` is for the page that only DISPLAYS the level (it asks every 20 seconds while open):
  // the config comes from the cache and the counts are reused for 10 seconds. Placing an order
  // always checks the live numbers.
  const config = cached ? ((await publicOutletById(ctx.outletId))?.config ?? (await outletConfigFor(ctx))) : await outletConfigFor(ctx);
  if (!config.capacity.enabled) {
    return evaluateCapacity({ active: 0, activeDelivery: 0 }, config.capacity);
  }
  const count = () =>
    Promise.all([
      OrderModel.countDocuments(tenantFilter(ctx, { status: { $in: QUEUE_STATUSES } })),
      OrderModel.countDocuments(tenantFilter(ctx, { status: { $in: QUEUE_STATUSES }, channel: "delivery" })),
    ]);
  const [active, activeDelivery] = cached
    ? await cache.wrap(`cap:${ctx.outletId}`, count, { maxAgeMs: 10_000, tags: [`brand:${ctx.brandId}`, "ns:cap"] })
    : await count();
  return evaluateCapacity({ active, activeDelivery }, config.capacity);
}

;                              
                         
                             
                                                                   
                       
                                                                            
                                                                              
                                                                             
                           
 

/**
 * Re-price a cart against the live menu. Never trusts client prices.
 *
 * If `cart.couponCode` is set it's validated here — the same check order
 * placement runs — so a quote and the placed order can never disagree on the
 * discount.
 */
export async function quote(ctx               , cart      , opts               = {})                       {
  // what the customer pays comes from the database, never from the cache
  const [menu, config] = await Promise.all([getMenu(ctx, { fresh: true }), outletConfigFor(ctx)]);
  // `at`: when the food is wanted (a pre-order's pickup time) — what a dish's hours are checked against.
  // `ignoreTimes`: staff at the till may sell a dish outside its hours. `stockCredit`: an edit's own held stock.
  const pricing = { at: opts.at, ignoreTimes: opts.ignoreTimes, stockCredit: opts.stockCredit };

  let bare = null;
  const bareOf = () => {
    if (bare) return bare;
    try {
      bare = priceCart({ lines: cart.lines }, menu, config.tax, {}, pricing);
    } catch (e) {
      if (e instanceof PricingError) throw new HttpError(409, e.message);
      throw e;
    }
    return bare;
  };
  const subtotalOf = ()         => bareOf().totals.subtotal;

  const extras              = { deliveryFee: opts.deliveryFee };

  // Compute the delivery fee from the outlet's settings when a point is given.
  if (opts.channel === "delivery" && opts.deliveryPoint) {
    const limits = config.operations.limits;
    const prep = config.operations.prepTime;
    const check = checkDelivery(
      config.identity.location.point,
      opts.deliveryPoint,
      {
        radiusKm: limits.deliveryRadiusKm,
        fee: limits.deliveryFee,
        freeDeliveryAbove: limits.freeDeliveryAbove,
        prepMinutes: prep.defaultMinutes + (prep.busyMode ? prep.busyExtraMinutes : 0),
        minutesPerKm: limits.deliveryMinutesPerKm,
        minEtaMinutes: limits.deliveryMinEtaMinutes,
      },
      subtotalOf(),
    );
    extras.deliveryFee = check.serviceable ? check.fee : 0;
  }

  if (cart.couponCode?.trim()) {

    const check = await checkCoupon({
      ctx,
      code: cart.couponCode,
      subtotal: subtotalOf(),
      channel: opts.channel,
      customerId: opts.customerId ?? null,
      // a "buy X get Y free" coupon needs to see the dishes, not just the total
      lines: bareOf().lines,
      menu,
    });

    if (check.ok) {
      extras.discount = check.discount;
      extras.couponCode = check.code;
    } else {
      extras.couponError = check.reason;
    }
  }

  let coinsError                    ;
  if (cart.redeemCoins && cart.redeemCoins > 0) {
    const check = await previewRedeem(ctx, opts.customerId, cart.redeemCoins, subtotalOf() - (extras.discount ?? 0));
    if (check.ok) {
      extras.coinsRedeemed = check.coinsApplied;
      extras.coinsDiscount = check.discountPaise;
    } else {
      coinsError = check.reason;
    }
  }

  try {
    const priced = priceCart(cart, menu, config.tax, extras, pricing);
    if (coinsError) priced.coinsError = coinsError;
    // the counted stock this cart takes — for order placement; not part of what a quote sends back
    Object.defineProperty(priced, "stockNeeds", { value: stockNeeds(cart.lines, menu), enumerable: false });
    return priced;
  } catch (e) {
    if (e instanceof PricingError) throw new HttpError(409, e.message);
    throw e;
  }
}

/** How many pre-orders already have each upcoming pickup time (only counted when the outlet caps a time). */
async function takenPickupSlots(ctx, config) {
  const taken = new Map();
  if (!(config.operations.scheduling?.maxPerSlot > 0)) return taken;
  const rows = await OrderModel.find(tenantFilter(ctx, { scheduledFor: { $gte: new Date() }, status: { $ne: "cancelled" } })).select("scheduledFor").lean();
  for (const r of rows) {
    const key = new Date(r.scheduledFor).toISOString();
    taken.set(key, (taken.get(key) ?? 0) + 1);
  }
  return taken;
}

/** The pickup times a takeaway customer can choose right now (empty when the outlet doesn't take pre-orders). */
export async function pickupSlotsFor(ctx) {
  const config = await outletConfigFor(ctx);
  if (!config.operations.scheduling?.enabled) return { enabled: false, days: [] };
  return { enabled: true, days: pickupSlots(config, { taken: await takenPickupSlots(ctx, config) }) };
}

;                                 
                                                          
 

/**
 * Work out whether a delivery address is serviceable and what it costs, from
 * the outlet's own settings. Throws if the address is out of range — a delivery
 * order to an unreachable address must not be placeable.
 */
export async function resolveDelivery(
  ctx               ,
  address          ,
  orderSubtotal        ,
) {
  const config = await outletConfigFor(ctx);
  const limits = config.operations.limits;
  const shop = config.identity.location.point;

  const result = checkDelivery(shop, address, {
    radiusKm: limits.deliveryRadiusKm,
    fee: limits.deliveryFee,
    freeDeliveryAbove: limits.freeDeliveryAbove,
    prepMinutes: config.operations.prepTime.defaultMinutes + (config.operations.prepTime.busyMode ? config.operations.prepTime.busyExtraMinutes : 0),
    minutesPerKm: limits.deliveryMinutesPerKm,
    minEtaMinutes: limits.deliveryMinEtaMinutes,
  }, orderSubtotal);

  if (!result.serviceable) {
    throw new HttpError(409, result.reason ?? "We can't deliver to that address.");
  }
  return result;
}

/** `YYYYMMDD` for "today" — the counter resets on this boundary, so anything
 *  keyed or scoped by day must derive it from here, never recompute it. */
function orderDay()         {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

function orderNumberKey(outletId        , day        )         {
  return `order:${outletId}:${day}`;
}

export async function placeOrder(input   
                     
             
                        
                                                                                   
                
                    
                   
                     
                                            
                                                                                  
                                                                                     
                      
                                          
                   
                     
 )                    {
  const { ctx } = input;
  const placedBy           = input.placedBy ?? "customer";
  await assertOutletOpen(ctx.outletId);
  const config = await outletConfigFor(ctx);

  const enabled                                = {
    takeaway: config.features.ordering.takeaway,
    "dine-in": config.features.ordering.dineInQr,
    delivery: config.features.ordering.delivery,
  };
  // "Dine-in QR ordering" is about customers ordering for themselves from the
  // table QR. Staff taking an order at a table is a different thing and always
  // works — a restaurant can turn QR self-ordering off and still have its
  // waiters take orders on their phones.
  const staffAtTable = placedBy === "staff" && input.channel === "dine-in";
  if (!staffAtTable && !enabled[input.channel]) {
    throw new HttpError(409, `${input.channel} ordering is switched off for this outlet`);
  }

  // A pre-order: a takeaway for a later pickup time, which must be one of the times the outlet offers right now.
  let scheduledFor = null;
  if (input.scheduledFor) {
    if (input.channel !== "takeaway") throw new HttpError(409, "Only takeaway orders can be placed for a later time.");
    const check = checkPickupTime(config, input.scheduledFor, { taken: await takenPickupSlots(ctx, config) });
    if (!check.ok) throw new HttpError(409, check.reason, { code: "pickup_time" });
    scheduledFor = new Date(input.scheduledFor);
  }
  // A dish's hours are checked against when the food is wanted; staff at the till may sell outside them.
  const pricing = { at: scheduledFor ?? undefined, ignoreTimes: placedBy === "staff" };

  // Delivery: an address is mandatory, must be inside the delivery area, and
  // the order must be paid online — a rider shouldn't be collecting cash.
  let deliveryFee = 0;
  let etaMinutes                    ;
  let deliveryRecord                             ;
  if (input.channel === "delivery") {
    if ((input.gateway ?? "cod") === "cod") {
      throw new HttpError(409, "Delivery orders must be paid online, not cash on delivery.");
    }
    // Load management can switch delivery off on its own, independent of the
    // outlet's normal delivery toggle — either the whole queue is overloaded
    // or there simply aren't enough riders for what's already out. Staff
    // taking a call know the real situation in the kitchen better than a
    // threshold does, so this only applies to customers self-serving online.
    if (placedBy !== "staff") {
      const capacity = await getCapacityStatus(ctx);
      if (capacity.deliveryBlocked) {
        throw new HttpError(409, capacity.deliveryLevel === "stopped" ? capacity.deliveryMessage  : capacity.orderMessage );
      }
    }
    if (!input.deliveryAddress) throw new HttpError(400, "A delivery order needs an address.");
    const bare = await quote(ctx, { lines: input.cart.lines }, pricing);
    const check = await resolveDelivery(ctx, input.deliveryAddress, bare.totals.subtotal);
    deliveryFee = check.fee;
    etaMinutes = check.etaMinutes;
    deliveryRecord = {
      text: input.deliveryAddress.text,
      landmark: input.deliveryAddress.landmark,
      lat: input.deliveryAddress.lat,
      lng: input.deliveryAddress.lng,
      distanceKm: check.distanceKm,
    };
  } else {
    const prep = config.operations.prepTime;
    etaMinutes = prep.defaultMinutes + (prep.busyMode ? prep.busyExtraMinutes : 0);
  }

  // Minimum order value — a customer self-serving online, not a staff member
  // billing whoever is standing in front of them.
  if (placedBy !== "staff" && config.operations.limits.minOrderValue > 0) {
    const bare = await quote(ctx, { lines: input.cart.lines }, pricing);
    if (bare.totals.subtotal < config.operations.limits.minOrderValue) {
      const short = (config.operations.limits.minOrderValue - bare.totals.subtotal) / 100;
      throw new HttpError(409, `Minimum order is ₹${(config.operations.limits.minOrderValue / 100).toFixed(0)} — add ₹${short.toFixed(0)} more.`);
    }
  }

  const priced = await quote(ctx, input.cart, {
    channel: input.channel,
    customerId: input.customer.customerId ?? null,
    deliveryFee,
    ...pricing,
  });

  // A coupon the customer typed that turned out not to apply is a hard error at
  // placement — they must not be surprised by a different total than they saw.
  if (input.cart.couponCode?.trim() && priced.couponError) {
    throw new HttpError(409, priced.couponError);
  }
  // Same for coins they explicitly asked to spend.
  if (input.cart.redeemCoins && input.cart.redeemCoins > 0 && priced.coinsError) {
    throw new HttpError(409, priced.coinsError);
  }

  // Counted stock comes off the menu now — all of it or none (two people can't both get the last plate).
  const held = priced.stockNeeds?.size ? await holdStock(ctx, priced.stockNeeds) : [];

  const day = orderDay();
  let order;
  try {
    const seq = await nextSequence(orderNumberKey(ctx.outletId , day));
    order = await OrderModel.create({
      brandId: ctx.brandId,
      outletId: ctx.outletId,
      orderNumber: String(seq).padStart(4, "0"),
      orderDay: day,
      channel: input.channel,
      placedBy,
      staffId: input.staffId,
      staffName: input.staffName,
      status: "placed",
      customer: input.customer,
      lines: priced.lines,
      totals: priced.totals,
      pricesIncludeTax: priced.pricesIncludeTax,
      payment: { gateway: input.gateway ?? "cod", status: "pending" },
      tableId: input.tableId,
      sessionId: input.sessionId,
      couponCode: priced.coupon?.code,
      deliveryAddress: deliveryRecord,
      etaMinutes,
      scheduledFor,
      stockHold: held.length ? { held: true, lines: held } : undefined,
      note: input.note,
      statusHistory: [{ status: "placed", at: new Date() }],
    });
  } catch (e) {
    await returnStock(ctx, held);
    throw e;
  }

  if (priced.coupon) {
    await recordRedemption({
      ctx,
      code: priced.coupon.code,
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      customerId: input.customer.customerId ?? null,
      discount: priced.coupon.discount,
    });
  }

  if (priced.totals.coinsRedeemed > 0 && input.customer.customerId) {
    await redeemForOrder({
      ctx,
      customerId: input.customer.customerId,
      orderId: String(order._id),
      orderNumber: order.orderNumber,
      coins: priced.totals.coinsRedeemed,
    });
  }

  if (input.customer.customerId) {
    await CustomerModel.updateOne(
      { _id: input.customer.customerId },
      { $inc: { orderCount: 1 }, $set: { lastOrderAt: new Date() } },
    );
    // their saved cart is done with (and if a reminder brought them back, it counts as won back)
    void markCartOrdered(ctx, input.customer.customerId, order).catch((err) => logger.error({ err }, "cart: couldn't mark ordered"));
  }

  const placed = order.toObject();
  // Staff see a new order land without refreshing — which is the whole point of
  // the SLA clock that starts ticking on it right now.
  broadcast(ctx.outletId , { type: "order.created", order: wire(placed) });
  firePrinters(ctx, placed, "placed");
  fireNotifications(ctx, placed, "placed");
  return placed;
}

/**
 * A prepaid order that hasn't been paid for — an abandoned checkout, or a
 * payment that failed. It's not actionable by the kitchen, so the default order
 * list hides it; the count is surfaced so staff can still find them. A
 * cancelled one no longer counts.
 */
export const UNPAID_PREPAID = {
  "payment.gateway": { $ne: "cod" },
  "payment.status": "pending",
  status: { $ne: "cancelled" },
}         ;

export async function listOrders(
  ctx               ,
  opts                                                                                     = {},
) {
  const base                          = opts.status ? { status: opts.status } : {};

  const mode = opts.paymentPending ?? "hide";
  if (mode === "only") {
    Object.assign(base, UNPAID_PREPAID);
  } else if (mode === "hide") {
    // Everything except an unpaid prepaid order.
    base.$or = [{ "payment.gateway": "cod" }, { "payment.status": { $ne: "pending" } }];
  }

  const [orders, paymentPendingCount] = await Promise.all([
    OrderModel.find(tenantFilter(ctx, base))
      .sort({ createdAt: -1 })
      .limit(Math.min(opts.limit ?? 50, 200))
      .lean(),
    OrderModel.countDocuments(tenantFilter(ctx, { ...UNPAID_PREPAID })),
  ]);

  return { orders, counts: { paymentPending: paymentPendingCount } };
}

export async function getOrder(ctx               , id        ) {
  const order = await OrderModel.findOne(tenantFilter(ctx, { _id: id })).lean();
  if (!order) throw new HttpError(404, "Order not found");
  return order;
}

/**
 * Coin side-effects of a status change: an order that reaches "completed"
 * earns coins on what it actually cost (never at placement — a cancelled
 * order must never have paid out); one that's "cancelled" refunds whatever it
 * redeemed. Both are idempotent, so a rewound-then-repeated transition never
 * double-pays or double-refunds.
 */
async function settleWallet(ctx               , order                            , status             )                {
  if (status === "completed") {
    const coins = await earnForOrder(ctx, order);
    if (coins > 0) {
      order.totals.coinsEarned = coins;
      order.markModified("totals");
    }
  } else if (status === "cancelled") {
    await reverseRedeemForOrder(ctx, order);
  }
}

export async function updateStatus(
  ctx               ,
  id        ,
  status             ,
  byUserId         ,
) {
  const order = await OrderModel.findOne(tenantFilter(ctx, { _id: id }));
  if (!order) throw new HttpError(404, "Order not found");

  if (!nextStatusesFor(order.status, order.channel).includes(status)) {
    throw new HttpError(
      409,
      status === "out_for_delivery" && order.channel !== "delivery"
        ? "Only a delivery order can go out for delivery."
        : `An order that's ${order.status} can't move to ${status}`,
    );
  }

  order.status = status;
  order.statusHistory.push({ status, at: new Date(), by: byUserId });
  if (status === "completed" && order.payment.gateway === "cod" && order.payment.status === "pending") {
    order.payment.status = "paid";
  }
  await settleWallet(ctx, order, status);
  if (status === "cancelled") await giveStockBack(ctx, order);
  await order.save();

  const updated = order.toObject();
  broadcast(ctx.outletId , { type: "order.updated", order: wire(updated) });
  // The moment staff accept an order, the kitchen ticket and the counter receipt
  // both appear — whichever printers the outlet has pointed at this status.
  firePrinters(ctx, updated, status);
  fireNotifications(ctx, updated, status);
  return updated;
}

/**
 * Set the status directly, ignoring the forward-only transition map.
 *
 * Staff mis-tap. Without this, an order accidentally marked Completed is stuck
 * there forever and the only fix is a database edit. The correction is recorded
 * in the history as a manual override, so the audit trail shows a human chose it
 * rather than the order having flowed there naturally.
 */
export async function setStatusManual(
  ctx               ,
  id        ,
  status             ,
  byUserId         ,
  reason         ,
)                    {
  const order = await OrderModel.findOne(tenantFilter(ctx, { _id: id }));
  if (!order) throw new HttpError(404, "Order not found");

  const config = await outletConfigFor(ctx);
  if (status === "out_for_delivery" && order.channel !== "delivery") throw new HttpError(409, "Only a delivery order can go out for delivery.");
  const isRewind = !nextStatusesFor(order.status, order.channel).includes(status);
  if (isRewind && !config.operations.orders.allowStatusRewind) {
    throw new HttpError(409, "Manually changing an order's status is switched off for this outlet");
  }
  if (order.status === status) return order.toObject();

  const from = order.status;
  order.status = status;
  order.statusHistory.push({
    status,
    at: new Date(),
    by: byUserId,
    manual: true,
    from,
    reason: reason?.slice(0, 200),
  });
  if (status === "completed" && order.payment.gateway === "cod" && order.payment.status === "pending") {
    order.payment.status = "paid";
  }
  await settleWallet(ctx, order, status);
  if (status === "cancelled") await giveStockBack(ctx, order);
  await order.save();

  const updated = order.toObject();
  broadcast(ctx.outletId , { type: "order.updated", order: wire(updated) });
  firePrinters(ctx, updated, status);
  fireNotifications(ctx, updated, status);
  return updated;
}

/**
 * Force-cancel every still-open order on a table session — a party walked out,
 * or a table was claimed by mistake. Deliberately bypasses `allowStatusRewind`:
 * that gate is about a routine manual correction to one order, not this — staff
 * must always be able to void a table, whatever an order's current status.
 */
export async function cancelOrdersForSession(
  ctx               ,
  sessionId        ,
  byUserId         ,
  reason         ,
)                {
  const orders = await OrderModel.find(tenantFilter(ctx, { sessionId, status: { $nin: ["completed", "cancelled"] } }));
  for (const order of orders) {
    const from = order.status;
    order.status = "cancelled";
    order.statusHistory.push({ status: "cancelled", at: new Date(), by: byUserId, manual: true, from, reason: reason?.slice(0, 200) ?? "Table voided" });
    await settleWallet(ctx, order, "cancelled");
    await giveStockBack(ctx, order);
    await order.save();

    const updated = order.toObject();
    broadcast(ctx.outletId , { type: "order.updated", order: wire(updated) });
    firePrinters(ctx, updated, "cancelled");
    fireNotifications(ctx, updated, "cancelled");
  }
}

/**
 * Change what was ordered after the fact — the customer adds a drink, or the
 * kitchen is out of an item.
 *
 * The cart is re-priced from the live menu exactly as a new order would be, so
 * an edit can never be used to talk the total down. Locked once the order is far
 * enough along that the food is already made.
 */
export async function editOrder(
  ctx               ,
  id        ,
  input                                                                               ,
  byUserId         ,
)                    {
  const order = await OrderModel.findOne(tenantFilter(ctx, { _id: id }));
  if (!order) throw new HttpError(404, "Order not found");

  const config = await outletConfigFor(ctx);
  const ops = config.operations.orders;
  if (!ops.allowOrderEdit) throw new HttpError(409, "Editing orders is switched off for this outlet");

  const LOCK_ORDER                = ["placed", "accepted", "preparing", "ready", "out_for_delivery", "completed"];
  if (ops.editLockAfter !== "never") {
    const lockAt = LOCK_ORDER.indexOf(ops.editLockAfter               );
    if (lockAt >= 0 && LOCK_ORDER.indexOf(order.status) >= lockAt) {
      throw new HttpError(409, `This order is already ${order.status} and can no longer be edited`);
    }
  }
  if (order.status === "cancelled") throw new HttpError(409, "A cancelled order can't be edited");

  const before = order.totals.grandTotal;
  // what the kitchen was told, kept to work out what an edit changes
  const wasOrdered = { lines: order.toObject().lines, note: order.note };

  if (input.cart) {
    if (!input.cart.lines.length) throw new HttpError(400, "An order needs at least one item");
    // The stock this order already holds counts as still there for its own edit.
    const credit = new Map();
    if (order.stockHold?.held) for (const l of order.stockHold.lines ?? []) credit.set(l.itemId, (credit.get(l.itemId) ?? 0) + l.quantity);
    // Re-priced server-side; the client never states what anything costs. The
    // coupon and delivery fee already on the order are carried through.
    const priced = await quote(
      ctx,
      { lines: input.cart.lines, couponCode: order.couponCode },
      {
        channel: order.channel,
        customerId: order.customer.customerId ?? null,
        deliveryFee: order.totals.deliveryFee ?? 0,
        ignoreTimes: true,
        stockCredit: credit,
      },
    );
    // take what the edited order needs and give back what it no longer does — all or nothing
    if (priced.stockNeeds.size || order.stockHold?.held) {
      const lines = await reholdStock(ctx, order, priced.stockNeeds);
      order.stockHold = lines.length ? { held: true, lines } : { held: false, lines: [] };
    }
    order.lines = priced.lines;
    order.totals = priced.totals;
    order.pricesIncludeTax = priced.pricesIncludeTax;
    // A coupon that no longer clears its minimum after items were removed is
    // simply dropped from the edited order rather than blocking the edit.
    if (order.couponCode && !priced.coupon) order.couponCode = undefined;
  }
  if (input.note !== undefined) order.note = input.note;
  if (input.customerName !== undefined) order.customer.name = input.customerName;
  if (input.customerPhone !== undefined) order.customer.phone = input.customerPhone;

  order.statusHistory.push({
    status: order.status,
    at: new Date(),
    by: byUserId,
    edited: true,
    from: order.status,
    reason: input.cart
      ? `items edited · ${(before / 100).toFixed(2)} → ${(order.totals.grandTotal / 100).toFixed(2)}`
      : "details edited",
  });
  await order.save();

  const updated = order.toObject();
  broadcast(ctx.outletId , { type: "order.updated", order: wire(updated) });
  firePrintChange(ctx, wasOrdered, updated);
  return updated;
}

/* ------------------------------------------------------------ delivery riders */

/**
 * Hand a delivery order to a rider — one from the outlet's list (`riderId`), or a name and number typed in for a one-off
 * — and, with `sendOut`, mark it "out for delivery" in the same step (the customer's update then names the rider).
 * Without `sendOut` it only changes who is taking it; `riderId: null` with no name takes the rider off.
 */
export async function assignRider(ctx, id, { riderId, name, phone, sendOut = false }, user) {
  const order = await OrderModel.findOne(tenantFilter(ctx, { _id: id }));
  if (!order) throw new HttpError(404, "Order not found");
  if (order.channel !== "delivery") throw new HttpError(409, "Only a delivery order has a rider.");
  if (["completed", "cancelled"].includes(order.status)) throw new HttpError(409, `This order is already ${order.status}.`);

  let rider = null;
  if (riderId) {
    const found = /^[a-f\d]{24}$/i.test(String(riderId)) ? await RiderModel.findOne(tenantFilter(ctx, { _id: riderId })).lean() : null;
    if (!found) throw new HttpError(404, "That rider isn't on this outlet's list any more.");
    if (!found.isActive) throw new HttpError(409, `${found.name} is switched off in the rider list.`);
    rider = { riderId: String(found._id), name: found.name, phone: found.phone ?? "" };
  } else if (name?.trim()) {
    rider = { riderId: null, name: name.trim().slice(0, 60), phone: String(phone ?? "").trim().slice(0, 20) };
  }

  if (sendOut) {
    if (!nextStatusesFor(order.status, order.channel).includes("out_for_delivery")) {
      throw new HttpError(409, order.status === "out_for_delivery" ? "This order is already out for delivery." : "Mark the order Ready before it goes out for delivery.");
    }
    order.status = "out_for_delivery";
    order.statusHistory.push({ status: "out_for_delivery", at: new Date(), by: String(user._id), reason: rider ? `with ${rider.name}` : undefined });
  }
  order.rider = rider ? { ...rider, assignedAt: new Date(), assignedBy: String(user._id) } : undefined;
  await order.save();

  const updated = order.toObject();
  broadcast(ctx.outletId, { type: "order.updated", order: wire(updated) });
  if (sendOut) {
    firePrinters(ctx, updated, "out_for_delivery");
    fireNotifications(ctx, updated, "out_for_delivery");
  }
  return updated;
}

/* ----------------------------------------------------------------- delete an order */

/**
 * Delete an order from the Orders page. It is marked (not erased): from then on it is gone from the orders list,
 * the reports, the customer's history and a table's tab, but nothing is lost for good.
 *
 * Money and coins are put right first: coins the order redeemed go back to the customer and coins it earned are
 * taken back (never below zero); a ticket still waiting to print is cancelled. An order the customer already paid
 * for ONLINE can't be deleted — the money has really moved, and hiding the order would hide the payment; it must
 * be refunded with the payment gateway first.
 */
export async function deleteOrder(ctx, id, user) {
  const order = await OrderModel.findOne(tenantFilter(ctx, { _id: id }));
  if (!order) throw new HttpError(404, "Order not found");

  if (order.payment?.gateway === "razorpay" && order.payment?.status === "paid") {
    throw new HttpError(409, `Order #${order.orderNumber} was paid online. Refund it with the payment gateway first — deleting it would hide a real payment.`, { code: "order_paid_online" });
  }

  await reverseRedeemForOrder(ctx, order);
  await revokeEarnForOrder(ctx, order);
  // food that was never handed over goes back on the menu
  if (order.status !== "completed") await giveStockBack(ctx, order);
  await PrintJobModel.updateMany(tenantFilter(ctx, { orderId: String(order._id), status: "queued" }), { $set: { status: "cancelled", lastError: "The order was deleted" } });

  order.deletedAt = new Date();
  order.deletedBy = String(user._id);
  order.deletedByName = user.name ?? "";
  await order.save();

  // every dashboard watching this outlet refreshes its list (any "order.*" event does)
  broadcast(ctx.outletId, { type: "order.deleted", orderId: String(order._id), orderNumber: order.orderNumber });
  logger.info({ orderId: String(order._id), orderNumber: order.orderNumber, by: String(user._id) }, "order deleted");
  return { ok: true, orderNumber: order.orderNumber };
}

/* ------------------------------------------------------ a customer's own order history */

/**
 * The orders a signed-in customer has placed with this store (every outlet of it), newest first, in the form the
 * storefront's Account page shows: status, how it is paid and whether it has been, the items and the money.
 * `before` is the placed-at time of the last order already shown (paging); `limit` is capped at 30.
 */
export async function customerOrderHistory({ brandId, customerId, before, limit = 15, feedbackEnabled = false }) {
  const take = Math.min(Math.max(Math.floor(limit) || 15, 1), 30);
  // (orders the customer removed from their own account are left out — the store still has them)
  const filter = { "customer.customerId": String(customerId), customerHiddenAt: null };
  if (before) filter.createdAt = { $lt: before };
  const rows = await OrderModel.find(brandFilter({ brandId }, filter)).sort({ createdAt: -1, _id: -1 }).limit(take + 1).lean();
  const page = rows.slice(0, take);

  const outletIds = [...new Set(page.map((o) => o.outletId))];
  const [outlets, ratings] = await Promise.all([
    outletIds.length ? OutletModel.find({ brandId, _id: { $in: outletIds } }).select("name slug config.identity.name").lean() : [],
    page.length ? FeedbackModel.find(brandFilter({ brandId }, { orderId: { $in: page.map((o) => String(o._id)) } })).lean() : [],
  ]);
  const byId = new Map(outlets.map((o) => [String(o._id), { id: String(o._id), name: o.config?.identity?.name || o.name, slug: o.slug }]));
  const ratingOf = new Map(ratings.map((f) => [f.orderId, f]));
  const now = Date.now();

  return {
    orders: page.map((o) => {
      const f = ratingOf.get(String(o._id));
      const recent = now - new Date(o.createdAt).getTime() < FEEDBACK_WINDOW_DAYS * 86_400_000;
      return {
        id: String(o._id),
        orderNumber: o.orderNumber,
        placedAt: o.createdAt,
        channel: o.channel,
        status: o.status,
        payment: { gateway: o.payment?.gateway ?? "cod", status: o.payment?.status ?? "pending" },
        outlet: byId.get(o.outletId) ?? { id: o.outletId, name: "", slug: "" },
        items: (o.lines ?? []).map((l) => ({ name: l.name, variantLabel: l.variantLabel ?? null, quantity: l.quantity, lineTotal: l.lineTotal, modifiers: (l.modifiers ?? []).map((m) => m.name ?? m.label ?? "").filter(Boolean) })),
        totals: o.totals,
        couponCode: o.couponCode ?? null,
        deliveryAddress: o.deliveryAddress?.text ?? null,
        etaMinutes: o.etaMinutes ?? null,
        scheduledFor: o.scheduledFor ?? null,
        // the rider's name and number only while they are on the way — not for ever after
        rider: o.status === "out_for_delivery" && o.rider?.name ? { name: o.rider.name, phone: o.rider.phone ?? "" } : null,
        feedback: f ? { rating: f.rating, comment: f.comment ?? "", tags: f.tags ?? [], editable: now - new Date(f.createdAt).getTime() < FEEDBACK_EDIT_DAYS * 86_400_000 } : null,
        canRate: feedbackEnabled && o.status === "completed" && recent && !f,
      };
    }),
    nextBefore: rows.length > take ? page.at(-1).createdAt : null,
  };
}

/**
 * A customer removes one of their orders from their own Account page. Only that order, only for them: it is marked
 * hidden from their history and nothing else changes — the store keeps seeing it (orders list, reports, a table's
 * tab), and a payment or coins are untouched. Only the customer's own order can be hidden. Safe to repeat.
 */
export async function hideOrderFromCustomer({ brandId, customerId, orderId }) {
  if (!/^[a-f\d]{24}$/i.test(String(orderId))) throw new HttpError(404, "Order not found");
  const found = await OrderModel.updateOne(brandFilter({ brandId }, { _id: orderId, "customer.customerId": String(customerId) }), { $set: { customerHiddenAt: new Date() } });
  if (!found.matchedCount) throw new HttpError(404, "Order not found");
  return { ok: true };
}
