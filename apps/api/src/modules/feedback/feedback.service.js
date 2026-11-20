import { FEEDBACK_EDIT_DAYS, FEEDBACK_TAGS, FEEDBACK_WINDOW_DAYS } from "@onetap/config-schema";
import { brandFilter, FeedbackModel, OrderModel, tenantFilter } from "@onetap/db";
import { HttpError } from "../../middleware/error.js";
import { effectiveOutletConfig } from "../outlets/config.service.js";

const KNOWN_TAGS = new Set([...FEEDBACK_TAGS.good, ...FEEDBACK_TAGS.bad]);

const shape = (f) => ({
  id: String(f._id),
  orderId: f.orderId,
  orderNumber: f.orderNumber,
  channel: f.channel,
  rating: f.rating,
  comment: f.comment ?? "",
  tags: f.tags ?? [],
  items: f.items ?? [],
  orderTotal: f.orderTotal ?? 0,
  customerName: f.customerName ?? "",
  customerPhone: f.customerPhone ?? "",
  createdAt: f.createdAt,
  updatedAt: f.updatedAt,
});

/**
 * A customer rates one of their own completed orders: 1–5 stars, a comment, a few quick tags. One rating per order;
 * rating again within a week replaces it. Only while the store takes ratings (plan + outlet setting), and only for an
 * order from the last month. A happy rating comes back with the store's Google review link, when it has one.
 */
export async function rateOrder({ brandId, customer, orderId, input }) {
  if (!/^[a-f\d]{24}$/i.test(String(orderId))) throw new HttpError(404, "Order not found");
  const order = await OrderModel.findOne(brandFilter({ brandId }, { _id: orderId, "customer.customerId": String(customer._id) })).lean();
  if (!order) throw new HttpError(404, "Order not found");
  const ctx = { brandId, outletId: order.outletId };
  const config = await effectiveOutletConfig(ctx);
  if (!config.feedback?.enabled) throw new HttpError(403, "This restaurant isn't taking ratings right now.");
  if (order.status !== "completed") throw new HttpError(409, "You can rate an order once it has been completed.");
  if (Date.now() - new Date(order.createdAt).getTime() > FEEDBACK_WINDOW_DAYS * 86_400_000) throw new HttpError(409, `Orders can be rated for ${FEEDBACK_WINDOW_DAYS} days.`);

  const existing = await FeedbackModel.findOne(tenantFilter(ctx, { orderId: String(order._id) })).lean();
  if (existing && Date.now() - new Date(existing.createdAt).getTime() > FEEDBACK_EDIT_DAYS * 86_400_000) {
    throw new HttpError(409, `A rating can be changed for ${FEEDBACK_EDIT_DAYS} days after it was given.`);
  }
  const fields = {
    rating: input.rating,
    comment: input.comment ?? "",
    tags: [...new Set(input.tags ?? [])].filter((t) => KNOWN_TAGS.has(t)).slice(0, 6),
    orderNumber: order.orderNumber,
    channel: order.channel,
    customerName: customer.name ?? order.customer?.name ?? "",
    customerPhone: customer.phone ?? order.customer?.phone ?? "",
    items: (order.lines ?? []).map((l) => `${l.quantity}× ${l.name}${l.variantLabel ? ` (${l.variantLabel})` : ""}`).slice(0, 30),
    orderTotal: order.totals?.grandTotal ?? 0,
  };
  const saved = await FeedbackModel.findOneAndUpdate(
    tenantFilter(ctx, { orderId: String(order._id) }),
    { $set: fields, $setOnInsert: { brandId, outletId: order.outletId, orderId: String(order._id), customerId: String(customer._id) } },
    { upsert: true, new: true },
  ).lean();
  const url = config.feedback.googleReviewUrl;
  return {
    ok: true,
    feedback: { rating: saved.rating, comment: saved.comment, tags: saved.tags, editable: true },
    google: url && input.rating >= (config.feedback.googleMinStars ?? 4) ? url : null,
  };
}

/**
 * The outlet's ratings for the dashboard: the summary over the last `days` days (count, average, how many of each
 * star, how many with a comment) and the ratings themselves, newest first, filtered by stars and paged with `before`.
 */
export async function listFeedback(ctx, { days = 30, stars = [], withComment = false, before, limit = 30 } = {}) {
  const since = new Date(Date.now() - days * 86_400_000);
  const period = tenantFilter(ctx, { createdAt: { $gte: since } });
  const [byStar, comments] = await Promise.all([
    FeedbackModel.aggregate([{ $match: period }, { $group: { _id: "$rating", n: { $sum: 1 } } }]),
    FeedbackModel.countDocuments({ ...period, comment: { $ne: "" } }),
  ]);
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of byStar) counts[r._id] = r.n;
  const count = Object.values(counts).reduce((a, b) => a + b, 0);
  const average = count ? Object.entries(counts).reduce((sum, [s, n]) => sum + Number(s) * n, 0) / count : 0;

  const filter = { ...period };
  if (stars.length) filter.rating = { $in: stars };
  if (withComment) filter.comment = { $ne: "" };
  if (before) filter.createdAt = { $gte: since, $lt: before };
  const take = Math.min(Math.max(limit, 1), 100);
  const rows = await FeedbackModel.find(filter).sort({ createdAt: -1 }).limit(take + 1).lean();
  const page = rows.slice(0, take);
  return {
    summary: { days, count, average: Math.round(average * 10) / 10, byStars: counts, withComments: comments },
    ratings: page.map(shape),
    nextBefore: rows.length > take ? page.at(-1).createdAt : null,
  };
}
