                                                 
import {
  checkDelivery,
  evaluateCapacity,
  NEXT_STATUSES,
  outletConfigSchema,
  priceCart,
  PricingError,
                      
            
                    
                   
               
                
                
                   
                   
} from "@onetap/config-schema";
import {
  CustomerModel,
  nextSequence,
  OrderModel,
  OutletModel,
  tenantFilter,
                
                     
} from "@onetap/db";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";
import { broadcast } from "../../realtime/hub.js";
import { checkCoupon, recordRedemption } from "../coupons/coupons.service.js";
import { getMenu } from "../menu/menu.service.js";
import { fireOrderNotifications } from "../notify/notify.service.js";
import { autoPrintForOrder } from "../printing/printing.service.js";
import { earnForOrder, previewRedeem, redeemForOrder, reverseRedeemForOrder } from "../wallet/wallet.service.js";

/** Shape an order for the wire the same way the REST routes do. */
function wire(o          ) {
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
    couponCode: o.couponCode ?? null,
    deliveryAddress: o.deliveryAddress ?? null,
    etaMinutes: o.etaMinutes ?? null,
    statusHistory: o.statusHistory ?? [],
    createdAt: o.createdAt,
  };
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

export async function outletConfigFor(ctx               ) {
  const outlet = await OutletModel.findOne({ _id: ctx.outletId }, null, { allowGlobalQuery: true }).lean();
  if (!outlet) throw new HttpError(404, "Outlet not found");
  return outletConfigSchema.parse(outlet.config ?? {});
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
export async function getCapacityStatus(ctx               )                          {
  const config = await outletConfigFor(ctx);
  if (!config.capacity.enabled) {
    return evaluateCapacity({ active: 0, activeDelivery: 0 }, config.capacity);
  }
  const [active, activeDelivery] = await Promise.all([
    OrderModel.countDocuments(tenantFilter(ctx, { status: { $in: QUEUE_STATUSES } })),
    OrderModel.countDocuments(tenantFilter(ctx, { status: { $in: QUEUE_STATUSES }, channel: "delivery" })),
  ]);
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
  const [menu, config] = await Promise.all([getMenu(ctx), outletConfigFor(ctx)]);

  let bareSubtotal                = null;
  const subtotalOf = ()         => {
    if (bareSubtotal !== null) return bareSubtotal;
    try {
      bareSubtotal = priceCart({ lines: cart.lines }, menu, config.tax).totals.subtotal;
    } catch (e) {
      if (e instanceof PricingError) throw new HttpError(409, e.message);
      throw e;
    }
    return bareSubtotal;
  };

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
    const priced = priceCart(cart, menu, config.tax, extras);
    if (coinsError) priced.coinsError = coinsError;
    return priced;
  } catch (e) {
    if (e instanceof PricingError) throw new HttpError(409, e.message);
    throw e;
  }
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

function orderNumberKey(outletId        )         {
  const d = new Date();
  const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `order:${outletId}:${day}`;
}

export async function placeOrder(input   
                     
             
                        
                                                                                   
                
                    
                   
                     
                                            
                                                                                  
                                                                                     
                      
                                          
                   
                     
 )                    {
  const { ctx } = input;
  const placedBy           = input.placedBy ?? "customer";
  const config = await outletConfigFor(ctx);

  const enabled                                = {
    takeaway: config.features.ordering.takeaway,
    "dine-in": config.features.ordering.dineInQr,
    delivery: config.features.ordering.delivery,
  };
  if (!enabled[input.channel]) {
    throw new HttpError(409, `${input.channel} ordering is switched off for this outlet`);
  }

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
    const bare = await quote(ctx, { lines: input.cart.lines });
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
    const bare = await quote(ctx, { lines: input.cart.lines });
    if (bare.totals.subtotal < config.operations.limits.minOrderValue) {
      const short = (config.operations.limits.minOrderValue - bare.totals.subtotal) / 100;
      throw new HttpError(409, `Minimum order is ₹${(config.operations.limits.minOrderValue / 100).toFixed(0)} — add ₹${short.toFixed(0)} more.`);
    }
  }

  const priced = await quote(ctx, input.cart, {
    channel: input.channel,
    customerId: input.customer.customerId ?? null,
    deliveryFee,
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

  const seq = await nextSequence(orderNumberKey(ctx.outletId ));

  const order = await OrderModel.create({
    brandId: ctx.brandId,
    outletId: ctx.outletId,
    orderNumber: String(seq).padStart(4, "0"),
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
    note: input.note,
    statusHistory: [{ status: "placed", at: new Date() }],
  });

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

  if (!NEXT_STATUSES[order.status].includes(status)) {
    throw new HttpError(409, `An order that's ${order.status} can't move to ${status}`);
  }

  order.status = status;
  order.statusHistory.push({ status, at: new Date(), by: byUserId });
  if (status === "completed" && order.payment.gateway === "cod" && order.payment.status === "pending") {
    order.payment.status = "paid";
  }
  await settleWallet(ctx, order, status);
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
  const isRewind = !NEXT_STATUSES[order.status].includes(status);
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
  await order.save();

  const updated = order.toObject();
  broadcast(ctx.outletId , { type: "order.updated", order: wire(updated) });
  firePrinters(ctx, updated, status);
  fireNotifications(ctx, updated, status);
  return updated;
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

  const LOCK_ORDER                = ["placed", "accepted", "preparing", "ready", "completed"];
  if (ops.editLockAfter !== "never") {
    const lockAt = LOCK_ORDER.indexOf(ops.editLockAfter               );
    if (lockAt >= 0 && LOCK_ORDER.indexOf(order.status) >= lockAt) {
      throw new HttpError(409, `This order is already ${order.status} and can no longer be edited`);
    }
  }
  if (order.status === "cancelled") throw new HttpError(409, "A cancelled order can't be edited");

  const before = order.totals.grandTotal;

  if (input.cart) {
    if (!input.cart.lines.length) throw new HttpError(400, "An order needs at least one item");
    // Re-priced server-side; the client never states what anything costs. The
    // coupon and delivery fee already on the order are carried through.
    const priced = await quote(
      ctx,
      { lines: input.cart.lines, couponCode: order.couponCode },
      {
        channel: order.channel,
        customerId: order.customer.customerId ?? null,
        deliveryFee: order.totals.deliveryFee ?? 0,
      },
    );
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
  return updated;
}
