import { evaluateSla, type DashboardStats } from "@onetap/config-schema";
import {
  CouponRedemptionModel,
  CustomerModel,
  MenuItemModel,
  NotificationLogModel,
  OrderModel,
  tenantFilter,
  WalletLedgerModel,
  type TenantContext,
} from "@onetap/db";
import { outletConfigFor, QUEUE_STATUSES, UNPAID_PREPAID } from "../orders/orders.service";

/** Midnight, server-local time — the same "today" the daily order-number counter uses. */
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(from: Date, n: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return d;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Everything every dashboard widget needs, computed once. Several small
 * queries run in parallel rather than one giant aggregation — this runs on
 * an admin polling a page, not a hot request path, so clarity wins over
 * shaving a few round trips.
 */
export async function getDashboardStats(ctx: TenantContext): Promise<DashboardStats> {
  const config = await outletConfigFor(ctx);
  const today0 = startOfToday();
  const trend14 = daysAgo(today0, 13);
  const week7 = daysAgo(today0, 6);

  const [
    ordersToday,
    revenueAgg,
    activeOrders,
    paymentPending,
    newCustomers,
    coinsAgg,
    couponAgg,
    notificationFailures,
    revenueTrendRows,
    channelRows,
    statusRows,
    hourRows,
    topItemRows,
    recentOrders,
    lowStock,
  ] = await Promise.all([
    OrderModel.countDocuments(tenantFilter(ctx, { createdAt: { $gte: today0 } })),
    OrderModel.aggregate([
      { $match: tenantFilter(ctx, { createdAt: { $gte: today0 }, status: { $ne: "cancelled" }, "payment.status": "paid" }) },
      { $group: { _id: null, revenue: { $sum: "$totals.grandTotal" }, n: { $sum: 1 } } },
    ]),
    OrderModel.find(tenantFilter(ctx, { status: { $in: QUEUE_STATUSES } }))
      .select("orderNumber status createdAt statusHistory")
      .lean(),
    OrderModel.countDocuments(tenantFilter(ctx, { ...UNPAID_PREPAID })),
    CustomerModel.countDocuments({ brandId: ctx.brandId, createdAt: { $gte: today0 } }),
    WalletLedgerModel.aggregate([
      { $match: tenantFilter(ctx, { kind: "earn", createdAt: { $gte: today0 } }) },
      { $group: { _id: null, coins: { $sum: "$coins" } } },
    ]),
    CouponRedemptionModel.aggregate([
      { $match: tenantFilter(ctx, { createdAt: { $gte: today0 } }) },
      { $group: { _id: null, n: { $sum: 1 }, savings: { $sum: "$discount" } } },
    ]),
    NotificationLogModel.countDocuments(tenantFilter(ctx, { status: { $in: ["failed", "skipped"] }, createdAt: { $gte: today0 } })),
    OrderModel.aggregate([
      { $match: tenantFilter(ctx, { createdAt: { $gte: trend14 }, status: { $ne: "cancelled" }, "payment.status": "paid" }) },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, revenue: { $sum: "$totals.grandTotal" }, orders: { $sum: 1 } } },
    ]),
    OrderModel.aggregate([
      { $match: tenantFilter(ctx, { createdAt: { $gte: week7 }, status: { $ne: "cancelled" } }) },
      { $group: { _id: "$channel", n: { $sum: 1 } } },
    ]),
    OrderModel.aggregate([
      { $match: tenantFilter(ctx, { createdAt: { $gte: today0 } }) },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]),
    OrderModel.aggregate([
      { $match: tenantFilter(ctx, { createdAt: { $gte: today0 } }) },
      // India-only product — bucketing in the outlet's actual local hour is
      // what makes a "rush hour" chart mean anything.
      { $group: { _id: { $hour: { date: "$createdAt", timezone: "Asia/Kolkata" } }, n: { $sum: 1 } } },
    ]),
    OrderModel.aggregate([
      { $match: tenantFilter(ctx, { createdAt: { $gte: week7 }, status: { $ne: "cancelled" } }) },
      { $unwind: "$lines" },
      { $group: { _id: "$lines.name", quantity: { $sum: "$lines.quantity" }, revenue: { $sum: "$lines.lineTotal" } } },
      { $sort: { quantity: -1 } },
      { $limit: 5 },
    ]),
    OrderModel.find(tenantFilter(ctx))
      .sort({ createdAt: -1 })
      .limit(8)
      .select("orderNumber status totals customer createdAt")
      .lean(),
    MenuItemModel.find(tenantFilter(ctx, { isAvailable: false })).select("name").limit(30).lean(),
  ]);

  const missedOrders = activeOrders.filter((o) => evaluateSla(o as never, config.operations.sla) !== null).length;

  const revenueByDay = new Map(revenueTrendRows.map((r) => [r._id as string, r as { revenue: number; orders: number }]));
  const revenueTrend = Array.from({ length: 14 }, (_, i) => {
    const date = ymd(daysAgo(today0, 13 - i));
    const row = revenueByDay.get(date);
    return { date, revenue: row?.revenue ?? 0, orders: row?.orders ?? 0 };
  });

  const hourByBucket = new Map(hourRows.map((r) => [r._id as number, r.n as number]));
  const ordersByHour = Array.from({ length: 24 }, (_, hour) => ({ hour, count: hourByBucket.get(hour) ?? 0 }));

  return {
    generatedAt: new Date().toISOString(),
    today: {
      revenue: revenueAgg[0]?.revenue ?? 0,
      orders: ordersToday,
      avgOrderValue: revenueAgg[0]?.n ? Math.round(revenueAgg[0].revenue / revenueAgg[0].n) : 0,
      activeQueue: activeOrders.length,
      missedOrders,
      newCustomers,
      coinsIssued: coinsAgg[0]?.coins ?? 0,
      couponsRedeemed: couponAgg[0]?.n ?? 0,
      couponSavings: couponAgg[0]?.savings ?? 0,
      paymentPending,
      notificationFailures,
    },
    revenueTrend,
    ordersByChannel: channelRows.map((r) => ({ channel: r._id as string, count: r.n as number })),
    ordersByStatus: statusRows.map((r) => ({ status: r._id as string, count: r.n as number })),
    ordersByHour,
    topItems: topItemRows.map((r) => ({ name: r._id as string, quantity: r.quantity as number, revenue: r.revenue as number })),
    recentOrders: recentOrders.map((o) => ({
      id: String(o._id),
      orderNumber: o.orderNumber,
      customerName: o.customer?.name || "Walk-in",
      status: o.status,
      amount: o.totals.grandTotal,
      createdAt: (o.createdAt as Date).toISOString(),
    })),
    lowStock: lowStock.map((i) => ({ id: String(i._id), name: i.name })),
  };
}
