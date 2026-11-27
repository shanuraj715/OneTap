import { DASHBOARD_WIDGET_IDS, evaluateSla,                     } from "@rasoipulse/config-schema";
import {
  CouponRedemptionModel,
  CustomerModel,
  FeedbackModel,
  MenuItemModel,
  NotificationLogModel,
  OrderModel,
  ReservationModel,
  tenantFilter,
  WalletLedgerModel,
                     
} from "@rasoipulse/db";
import { outletConfigFor, QUEUE_STATUSES, UNPAID_PREPAID } from "../orders/orders.service.js";

/*
 * "Today" on the dashboard is the INDIAN day (IST, UTC+5:30, no daylight saving) wherever the server's own clock is set: the hour chart was already
 * bucketed in India time, and a restaurant's day does not start at 05:30. Everything below is a plain millisecond sum from that midnight.
 */
const IST_MS = 5.5 * 3_600_000;
const DAY_MS = 86_400_000;

/** Midnight at the start of today in India, as an instant. */
function startOfToday()       {
  const ist = new Date(Date.now() + IST_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_MS);
}

function daysAgo(from      , n        )       {
  return new Date(from.getTime() - n * DAY_MS);
}

/** The Indian calendar day an instant falls on, "2026-11-27". */
function ymd(d      )         {
  return new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);
}

/**
 * The numbers the dashboard's widgets need. `widgets` is the list of widget ids this person's dashboard really shows (see the route): only the
 * queries behind THOSE are run, so a cook's dashboard never adds up the revenue and a store without Delivery never asks about deliveries.
 * Leave it out to get everything (the old behaviour). Anything not asked for comes back as zero / empty, never missing.
 *
 * Several small queries run in parallel rather than one giant aggregation — an admin polling a page, not a hot request path.
 */
export async function getDashboardStats(ctx               , { widgets } = {})                          {
  const want = new Set(widgets ?? DASHBOARD_WIDGET_IDS);
  const needs = (...ids) => ids.some((id) => want.has(id));
  const today0 = startOfToday();
  const tomorrow0 = new Date(today0.getTime() + DAY_MS);
  const trend14 = daysAgo(today0, 13);
  const week7 = daysAgo(today0, 6);
  const month30 = daysAgo(today0, 29);
  const paid = { status: { $ne: "cancelled" }, "payment.status": "paid" };

  // each entry starts its query straight away (so they run side by side) — and only when a widget needs it
  const q = {};
  if (needs("orders-today")) q.ordersToday = OrderModel.countDocuments(tenantFilter(ctx, { createdAt: { $gte: today0 } }));
  if (needs("revenue-today", "avg-order-value-today")) {
    q.revenueAgg = OrderModel.aggregate([
      { $match: tenantFilter(ctx, { createdAt: { $gte: today0 }, ...paid }) },
      { $group: { _id: null, revenue: { $sum: "$totals.grandTotal" }, n: { $sum: 1 } } },
    ]);
  }
  if (needs("active-queue", "missed-orders")) {
    q.activeOrders = OrderModel.find(tenantFilter(ctx, { status: { $in: QUEUE_STATUSES } }))
      .select("orderNumber status createdAt statusHistory scheduledFor")
      .lean();
  }
  if (needs("missed-orders")) q.config = outletConfigFor(ctx);
  if (needs("payment-pending")) q.paymentPending = OrderModel.countDocuments(tenantFilter(ctx, { ...UNPAID_PREPAID }));
  if (needs("new-customers-today")) q.newCustomers = CustomerModel.countDocuments({ brandId: ctx.brandId, createdAt: { $gte: today0 } });
  if (needs("coins-issued-today")) {
    q.coinsAgg = WalletLedgerModel.aggregate([
      { $match: tenantFilter(ctx, { kind: "earn", createdAt: { $gte: today0 } }) },
      { $group: { _id: null, coins: { $sum: "$coins" } } },
    ]);
  }
  if (needs("coupons-redeemed-today")) {
    q.couponAgg = CouponRedemptionModel.aggregate([
      { $match: tenantFilter(ctx, { createdAt: { $gte: today0 } }) },
      { $group: { _id: null, n: { $sum: 1 }, savings: { $sum: "$discount" } } },
    ]);
  }
  if (needs("notification-failures-today")) {
    q.notificationFailures = NotificationLogModel.countDocuments(tenantFilter(ctx, { status: { $in: ["failed", "skipped"] }, createdAt: { $gte: today0 } }));
  }
  if (needs("deliveries-active")) {
    // a delivery order that is ready is waiting for a rider; one out for delivery is on its way
    q.deliveryRows = OrderModel.aggregate([
      { $match: tenantFilter(ctx, { channel: "delivery", status: { $in: ["ready", "out_for_delivery"] } }) },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]);
  }
  if (needs("bookings-today")) {
    q.bookingRows = ReservationModel.aggregate([
      { $match: tenantFilter(ctx, { at: { $gte: today0, $lt: tomorrow0 } }) },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]);
  }
  if (needs("customer-rating")) {
    q.ratingAgg = FeedbackModel.aggregate([
      { $match: tenantFilter(ctx, { createdAt: { $gte: month30 } }) },
      { $group: { _id: null, average: { $avg: "$rating" }, n: { $sum: 1 } } },
    ]);
  }
  // the trend also gives the revenue card its "compared with yesterday" and its little line
  if (needs("revenue-trend", "revenue-today")) {
    q.revenueTrendRows = OrderModel.aggregate([
      { $match: tenantFilter(ctx, { createdAt: { $gte: trend14 }, ...paid }) },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } },
          revenue: { $sum: "$totals.grandTotal" },
          orders: { $sum: 1 },
        },
      },
    ]);
  }
  if (needs("orders-by-channel")) {
    q.channelRows = OrderModel.aggregate([
      { $match: tenantFilter(ctx, { createdAt: { $gte: week7 }, status: { $ne: "cancelled" } }) },
      { $group: { _id: "$channel", n: { $sum: 1 } } },
    ]);
  }
  if (needs("orders-by-status")) {
    q.statusRows = OrderModel.aggregate([
      { $match: tenantFilter(ctx, { createdAt: { $gte: today0 } }) },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]);
  }
  if (needs("orders-by-hour")) {
    q.hourRows = OrderModel.aggregate([
      { $match: tenantFilter(ctx, { createdAt: { $gte: today0 } }) },
      // India-only product — bucketing in the outlet's actual local hour is what makes a "rush hour" chart mean anything.
      { $group: { _id: { $hour: { date: "$createdAt", timezone: "Asia/Kolkata" } }, n: { $sum: 1 } } },
    ]);
  }
  if (needs("top-items")) {
    q.topItemRows = OrderModel.aggregate([
      { $match: tenantFilter(ctx, { createdAt: { $gte: week7 }, status: { $ne: "cancelled" } }) },
      { $unwind: "$lines" },
      { $group: { _id: "$lines.name", quantity: { $sum: "$lines.quantity" }, revenue: { $sum: "$lines.lineTotal" } } },
      { $sort: { quantity: -1 } },
      { $limit: 5 },
    ]);
  }
  if (needs("recent-orders")) {
    q.recentOrders = OrderModel.find(tenantFilter(ctx)).sort({ createdAt: -1 }).limit(8).select("orderNumber status totals customer createdAt").lean();
  }
  if (needs("low-stock")) q.lowStock = MenuItemModel.find(tenantFilter(ctx, { isAvailable: false })).select("name").limit(30).lean();

  const keys = Object.keys(q);
  const done = await Promise.all(keys.map((k) => q[k]));
  const r = Object.fromEntries(keys.map((k, i) => [k, done[i]]));

  const activeOrders = r.activeOrders ?? [];
  const missedOrders = r.config ? activeOrders.filter((o) => evaluateSla(o         , r.config.operations.sla) !== null).length : 0;
  const revenueAgg = r.revenueAgg ?? [];
  const byStatus = (rows = []) => Object.fromEntries(rows.map((x) => [x._id, x.n]));
  const delivery = byStatus(r.deliveryRows);
  const bookings = byStatus(r.bookingRows);

  const revenueByDay = new Map((r.revenueTrendRows ?? []).map((row) => [row._id          , row                                       ]));
  const revenueTrend = r.revenueTrendRows
    ? Array.from({ length: 14 }, (_, i) => {
        const date = ymd(daysAgo(today0, 13 - i));
        const row = revenueByDay.get(date);
        return { date, revenue: row?.revenue ?? 0, orders: row?.orders ?? 0 };
      })
    : [];

  const hourByBucket = new Map((r.hourRows ?? []).map((row) => [row._id          , row.n          ]));
  const ordersByHour = r.hourRows ? Array.from({ length: 24 }, (_, hour) => ({ hour, count: hourByBucket.get(hour) ?? 0 })) : [];

  const bookingsTotal = Object.values(bookings).reduce((x, y) => x + y, 0);
  return {
    generatedAt: new Date().toISOString(),
    today: {
      revenue: revenueAgg[0]?.revenue ?? 0,
      /** yesterday's paid revenue, for "compared with yesterday" (0 when the trend wasn't asked for) */
      revenueYesterday: revenueTrend[12]?.revenue ?? 0,
      orders: r.ordersToday ?? 0,
      avgOrderValue: revenueAgg[0]?.n ? Math.round(revenueAgg[0].revenue / revenueAgg[0].n) : 0,
      activeQueue: activeOrders.length,
      missedOrders,
      newCustomers: r.newCustomers ?? 0,
      coinsIssued: r.coinsAgg?.[0]?.coins ?? 0,
      couponsRedeemed: r.couponAgg?.[0]?.n ?? 0,
      couponSavings: r.couponAgg?.[0]?.savings ?? 0,
      paymentPending: r.paymentPending ?? 0,
      notificationFailures: r.notificationFailures ?? 0,
      deliveriesOut: delivery.out_for_delivery ?? 0,
      deliveriesWaiting: delivery.ready ?? 0,
      /** table bookings dated today: all of them, those waiting for a yes, and those still to come or being served */
      bookings: bookingsTotal,
      bookingsAwaiting: bookings.requested ?? 0,
      bookingsActive: (bookings.requested ?? 0) + (bookings.confirmed ?? 0) + (bookings.seated ?? 0),
      /** customers' average rating over the last 30 days (0 when nobody rated) and how many ratings that is */
      ratingAverage: r.ratingAgg?.[0]?.average ? Math.round(r.ratingAgg[0].average * 10) / 10 : 0,
      ratingCount: r.ratingAgg?.[0]?.n ?? 0,
    },
    revenueTrend,
    ordersByChannel: (r.channelRows ?? []).map((row) => ({ channel: row._id          , count: row.n           })),
    ordersByStatus: (r.statusRows ?? []).map((row) => ({ status: row._id          , count: row.n           })),
    ordersByHour,
    topItems: (r.topItemRows ?? []).map((row) => ({ name: row._id          , quantity: row.quantity          , revenue: row.revenue           })),
    recentOrders: (r.recentOrders ?? []).map((o) => ({
      id: String(o._id),
      orderNumber: o.orderNumber,
      customerName: o.customer?.name || "Walk-in",
      status: o.status,
      amount: o.totals.grandTotal,
      createdAt: (o.createdAt        ).toISOString(),
    })),
    lowStock: (r.lowStock ?? []).map((i) => ({ id: String(i._id), name: i.name })),
  };
}
