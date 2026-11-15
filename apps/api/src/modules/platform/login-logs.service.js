import { LoginLogModel } from "@onetap/db";

/** The sign-in log for the platform dashboard — newest first, filterable, one page at a time. */

const OBJECT_ID = /^[0-9a-f]{24}$/i;
export const LOGIN_FILTERS = {
  all: {},
  success: { success: true },
  failed: { success: false },
  platform: { scope: "platform" },
  stores: { scope: "store" },
};

const shape = (row) => ({
  id: String(row._id),
  at: row.createdAt,
  email: row.email,
  name: row.name ?? null,
  success: row.success,
  reason: row.reason || null,
  scope: row.scope,
  role: row.role ?? null,
  store: row.brandName ?? null,
  storeId: row.brandId ?? null,
  // an IPv4 address that arrives wrapped as ::ffff:1.2.3.4 is shown as plain 1.2.3.4
  ip: row.ip ? row.ip.replace(/^::ffff:/i, "") : null,
  device: row.device ?? null,
});

async function summary() {
  const day = new Date(Date.now() - 24 * 3_600_000);
  const week = new Date(Date.now() - 7 * 24 * 3_600_000);
  const [signedIn24h, failed24h, failed7d, people7d, lastPlatform] = await Promise.all([
    LoginLogModel.countDocuments({ success: true, createdAt: { $gte: day } }),
    LoginLogModel.countDocuments({ success: false, createdAt: { $gte: day } }),
    LoginLogModel.countDocuments({ success: false, createdAt: { $gte: week } }),
    LoginLogModel.distinct("email", { success: true, createdAt: { $gte: week } }),
    LoginLogModel.findOne({ success: true, scope: "platform" }).sort({ _id: -1 }).lean(),
  ]);
  return { signedIn24h, failed24h, failed7d, people7d: people7d.length, lastPlatformSignIn: lastPlatform ? shape(lastPlatform) : null };
}

/** One page of the log. Never cached: it is a security record, and has to be current. */
export async function listLoginLogs({ filter = "all", cursor, limit = 25 } = {}) {
  const where = { ...(LOGIN_FILTERS[filter] ?? {}) };
  if (cursor && OBJECT_ID.test(cursor)) where._id = { $lt: cursor };
  const take = Math.min(Math.max(Number(limit) || 25, 1), 100);
  const rows = await LoginLogModel.find(where).sort({ _id: -1 }).limit(take + 1).lean();
  const page = rows.slice(0, take);
  return {
    logs: page.map(shape),
    nextCursor: rows.length > take ? String(page.at(-1)._id) : null,
    // totals only with the first page — they don't change as you scroll
    summary: cursor ? undefined : await summary(),
  };
}
