import { FEEDBACK_EDIT_DAYS, FEEDBACK_TAGS, FEEDBACK_WINDOW_DAYS } from "@rasoipulse/config-schema";
import { brandFilter, FeedbackModel, OrderModel, tenantFilter } from "@rasoipulse/db";
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
  /** how each dish was rated on its own (the customer may rate only some) */
  itemRatings: (f.itemRatings ?? []).map((i) => ({ itemId: i.itemId, name: i.name ?? "", rating: i.rating, comment: i.comment ?? "" })),
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
  // each dish rated on its own: only dishes that were really in THIS order (the name comes from the order, never from the phone); the same dish twice counts once
  let itemRatings;
  if (input.items) {
    const inOrder = new Map();
    for (const l of order.lines ?? []) if (l.itemId && !inOrder.has(String(l.itemId))) inOrder.set(String(l.itemId), l.name ?? "");
    const picked = new Map();
    for (const i of input.items) {
      if (!inOrder.has(String(i.itemId))) throw new HttpError(400, "One of those dishes wasn't in this order.");
      picked.set(String(i.itemId), { itemId: String(i.itemId), name: inOrder.get(String(i.itemId)), rating: i.rating, comment: i.comment ?? "" });
    }
    itemRatings = [...picked.values()];
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
    ...(itemRatings ? { itemRatings } : {}),
  };
  const saved = await FeedbackModel.findOneAndUpdate(
    tenantFilter(ctx, { orderId: String(order._id) }),
    { $set: fields, $setOnInsert: { brandId, outletId: order.outletId, orderId: String(order._id), customerId: String(customer._id) } },
    { upsert: true, new: true },
  ).lean();
  const url = config.feedback.googleReviewUrl;
  return {
    ok: true,
    feedback: { rating: saved.rating, comment: saved.comment, tags: saved.tags, items: (saved.itemRatings ?? []).map((i) => ({ itemId: i.itemId, name: i.name, rating: i.rating, comment: i.comment ?? "" })), editable: true },
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


/* ------------------------------------------------------------------------------------------------ the views by outlet, customer and dish */

const DAY = 86_400_000;
const since = (days) => new Date(Date.now() - days * DAY);
const round1 = (n) => Math.round(n * 10) / 10;
const escapeRegex = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** the ratings of these outlets in the last `days` days (every query below starts here, so one store can never see another's) */
const scope = (ctx, outletIds, days, extra = {}) => ({ brandId: ctx.brandId, outletId: { $in: outletIds }, createdAt: { $gte: since(days) }, ...extra });
const emptyStars = () => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
const average = (sum, n) => (n ? round1(sum / n) : 0);

/**
 * Ratings outlet by outlet: for each outlet the person may look at — how many ratings, the average, how the stars split, how many
 * came with a comment and how many dishes were rated on their own — and the same for all of them together.
 */
export async function feedbackByOutlet(ctx, { days = 30, outlets }) {
  const ids = outlets.map((o) => o.id);
  const rows = ids.length
    ? await FeedbackModel.aggregate([
        { $match: scope(ctx, ids, days) },
        { $group: { _id: { outletId: "$outletId", rating: "$rating" }, n: { $sum: 1 }, comments: { $sum: { $cond: [{ $ne: ["$comment", ""] }, 1, 0] } }, dishes: { $sum: { $size: { $ifNull: ["$itemRatings", []] } } } } },
      ])
    : [];
  const by = new Map(outlets.map((o) => [o.id, { id: o.id, name: o.name, title: o.title, count: 0, sum: 0, byStars: emptyStars(), withComments: 0, dishRatings: 0 }]));
  for (const r of rows) {
    const o = by.get(r._id.outletId);
    if (!o) continue;
    o.count += r.n; o.sum += r.n * r._id.rating; o.byStars[r._id.rating] += r.n; o.withComments += r.comments; o.dishRatings += r.dishes;
  }
  const shaped = [...by.values()].map(({ sum, ...o }) => ({ ...o, average: average(sum, o.count), happyShare: o.count ? Math.round(((o.byStars[4] + o.byStars[5]) / o.count) * 100) : 0 }));
  const total = shaped.reduce((t, o) => { t.count += o.count; t.sum += o.average * o.count; for (const k of [1, 2, 3, 4, 5]) t.byStars[k] += o.byStars[k]; t.withComments += o.withComments; t.dishRatings += o.dishRatings; return t; }, { count: 0, sum: 0, byStars: emptyStars(), withComments: 0, dishRatings: 0 });
  // (the all-outlets average is worked out from the stars, not from the rounded outlet averages)
  const starSum = [1, 2, 3, 4, 5].reduce((n, k) => n + k * total.byStars[k], 0);
  return { days, outlets: shaped, total: { count: total.count, average: average(starSum, total.count), byStars: total.byStars, withComments: total.withComments, dishRatings: total.dishRatings } };
}

const CUSTOMER_SORTS = { recent: { last: -1 }, lowest: { average: 1, count: -1 }, highest: { average: -1, count: -1 }, most: { count: -1, last: -1 } };

/** Ratings customer by customer: who rated, how often, their average, their lowest, and what they said last. `search` finds by name or phone. */
export async function feedbackByCustomer(ctx, { days = 30, outlets, search = "", sort = "recent", page = 1, limit = 30 }) {
  const ids = outlets.map((o) => o.id);
  const take = Math.min(Math.max(Math.floor(limit) || 30, 1), 60);
  const at = Math.max(1, Math.floor(page) || 1);
  const names = new Map(outlets.map((o) => [o.id, o.name]));
  const q = String(search ?? "").trim();
  const [out] = ids.length
    ? await FeedbackModel.aggregate([
        { $match: scope(ctx, ids, days) },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: "$customerId", name: { $first: "$customerName" }, phone: { $first: "$customerPhone" }, count: { $sum: 1 }, sum: { $sum: "$rating" },
            lowest: { $min: "$rating" }, highest: { $max: "$rating" }, last: { $first: "$createdAt" }, lastRating: { $first: "$rating" }, lastComment: { $first: "$comment" },
            lastOrder: { $first: "$orderNumber" }, comments: { $sum: { $cond: [{ $ne: ["$comment", ""] }, 1, 0] } }, outlets: { $addToSet: "$outletId" },
            dishRatings: { $sum: { $size: { $ifNull: ["$itemRatings", []] } } },
          },
        },
        { $addFields: { average: { $divide: ["$sum", "$count"] } } },
        ...(q ? [{ $match: { $or: [{ name: { $regex: escapeRegex(q), $options: "i" } }, { phone: { $regex: escapeRegex(q.replace(/\s+/g, "")) } }] } }] : []),
        { $facet: { rows: [{ $sort: CUSTOMER_SORTS[sort] ?? CUSTOMER_SORTS.recent }, { $skip: (at - 1) * take }, { $limit: take }], total: [{ $count: "n" }] } },
      ])
    : [{ rows: [], total: [] }];
  const total = out.total[0]?.n ?? 0;
  return {
    days, sort: CUSTOMER_SORTS[sort] ? sort : "recent", page: at, pageSize: take, total, pages: Math.max(1, Math.ceil(total / take)),
    customers: out.rows.map((r) => ({
      id: String(r._id), name: r.name || "A customer", phone: r.phone || "", count: r.count, average: round1(r.average), lowest: r.lowest, highest: r.highest,
      last: r.last, lastRating: r.lastRating, lastComment: r.lastComment || "", lastOrder: r.lastOrder || "", withComments: r.comments, dishRatings: r.dishRatings,
      outlets: r.outlets.map((id) => names.get(id)).filter(Boolean),
    })),
  };
}

const ITEM_SORTS = { most: { count: -1, average: -1 }, best: { average: -1, count: -1 }, worst: { average: 1, count: -1 } };
const itemKey = (name) => String(name ?? "").trim().toLowerCase();

/**
 * Ratings dish by dish. The same dish at several outlets is ONE row (grouped by its name): how many times it was rated, its average, how the
 * stars split, how many came with a note, and how each outlet rated it. `sort`: most rated, best rated, worst rated.
 */
export async function feedbackByItem(ctx, { days = 30, outlets, search = "", sort = "most", limit = 50 }) {
  const ids = outlets.map((o) => o.id);
  const take = Math.min(Math.max(Math.floor(limit) || 50, 1), 200);
  const q = itemKey(search);
  const star = (n) => ({ $sum: { $cond: [{ $eq: ["$itemRatings.rating", n] }, 1, 0] } });
  const base = [{ $match: { ...scope(ctx, ids, days), "itemRatings.0": { $exists: true } } }, { $unwind: "$itemRatings" }, { $addFields: { key: { $toLower: { $trim: { input: "$itemRatings.name" } } } } }, ...(q ? [{ $match: { key: { $regex: escapeRegex(q) } } }] : [])];
  const [rows, perOutlet] = ids.length
    ? await Promise.all([
        FeedbackModel.aggregate([
          ...base,
          { $sort: { createdAt: 1 } },
          { $group: { _id: "$key", name: { $last: "$itemRatings.name" }, count: { $sum: 1 }, sum: { $sum: "$itemRatings.rating" }, s1: star(1), s2: star(2), s3: star(3), s4: star(4), s5: star(5), notes: { $sum: { $cond: [{ $ne: ["$itemRatings.comment", ""] }, 1, 0] } }, last: { $max: "$createdAt" } } },
          { $addFields: { average: { $divide: ["$sum", "$count"] } } },
          { $sort: ITEM_SORTS[sort] ?? ITEM_SORTS.most },
          { $limit: take },
        ]),
        FeedbackModel.aggregate([...base, { $group: { _id: { key: "$key", outletId: "$outletId" }, count: { $sum: 1 }, sum: { $sum: "$itemRatings.rating" } } }]),
      ])
    : [[], []];
  const names = new Map(outlets.map((o) => [o.id, o.name]));
  const breakdown = new Map();
  for (const p of perOutlet) breakdown.set(p._id.key, [...(breakdown.get(p._id.key) ?? []), { id: p._id.outletId, name: names.get(p._id.outletId) ?? "", count: p.count, average: average(p.sum, p.count) }]);
  return {
    days, sort: ITEM_SORTS[sort] ? sort : "most",
    items: rows.map((r) => ({
      key: r._id, name: r.name, count: r.count, average: round1(r.average), byStars: { 1: r.s1, 2: r.s2, 3: r.s3, 4: r.s4, 5: r.s5 }, withNotes: r.notes, last: r.last,
      outlets: (breakdown.get(r._id) ?? []).sort((a, b) => b.count - a.count),
    })),
  };
}

/** Everything customers said about ONE dish (by its grouped name): the dish's own stars and note, with the whole order's stars and review beside it. Newest first. */
export async function feedbackForItem(ctx, { key, days = 30, outlets, limit = 50 }) {
  const ids = outlets.map((o) => o.id);
  const names = new Map(outlets.map((o) => [o.id, o.name]));
  const want = itemKey(key);
  if (!want || !ids.length) return { key: want, reviews: [] };
  const docs = await FeedbackModel.find({ ...scope(ctx, ids, days), itemRatings: { $elemMatch: { name: { $regex: `^\\s*${escapeRegex(want)}\\s*$`, $options: "i" } } } }).sort({ createdAt: -1 }).limit(Math.min(Math.max(Math.floor(limit) || 50, 1), 100)).lean();
  return {
    key: want,
    reviews: docs.flatMap((f) => (f.itemRatings ?? []).filter((i) => itemKey(i.name) === want).map((i) => ({
      id: String(f._id), dishRating: i.rating, dishNote: i.comment ?? "", orderRating: f.rating, orderComment: f.comment ?? "", customerName: f.customerName || "A customer",
      orderNumber: f.orderNumber, outlet: names.get(f.outletId) ?? "", createdAt: f.createdAt,
    }))),
  };
}
