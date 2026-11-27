import { createHmac, randomBytes } from "node:crypto";
import QRCode from "qrcode";
                                                         
import {
  CustomerModel,
  OrderModel,
  TableModel,
  TableSessionModel,
  tenantFilter,
                
                     
} from "@rasoipulse/db";
import { normalizeTableStatus, tableLimit } from "@rasoipulse/config-schema";
import { env } from "../../env.js";
import { safeEqual } from "../../lib/crypto.js";
import { HttpError } from "../../middleware/error.js";
import { cancelOrdersForSession } from "../orders/orders.service.js";
import { assertOutletOpen } from "../outlets/config.service.js";
import { invalidateStoreUsage, storePlan } from "../platform/plan.service.js";

/* ---------------------------------------------------------------------- QR */

/**
 * The QR carries table id + a signature. Rotating a table's `qrSecret`
 * invalidates every code already printed for it.
 */
export function tableToken(table                                                 )         {
  return createHmac("sha256", env.ENCRYPTION_KEY)
    .update(`${table.outletId}|${String(table._id)}|${table.qrSecret}`)
    .digest("base64url")
    .slice(0, 24);
}

export function tableUrl(storefrontOrigin        , table          )         {
  return `${storefrontOrigin.replace(/\/$/, "")}/t/${String(table._id)}?k=${tableToken(table)}`;
}

export async function qrDataUrl(url        )                  {
  return QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 512 });
}

/* ------------------------------------------------------------------ tables */

const shape = (t          ) => ({
  id: String(t._id),
  number: t.number,
  zone: t.zone,
  seats: t.seats,
  status: normalizeTableStatus(t.status),
  isActive: t.isActive,
  activeSessionId: t.activeSessionId ?? null,
});

export async function listTables(ctx               ) {
  const tables = await TableModel.find(tenantFilter(ctx)).sort({ zone: 1, number: 1 }).lean();
  return tables.map((t) => shape(t            ));
}

/**
 * Every table with its signed URL, in one query. The card designer prints a
 * sheet of forty cards and needs forty distinct codes, so this exists to keep
 * that a single round trip rather than one request per table.
 *
 * `qrSecret` never leaves this function — only the signed URL derived from it.
 */
export async function listTableQrUrls(ctx               , storefrontOrigin        ) {
  const tables = await TableModel.find(tenantFilter(ctx)).sort({ zone: 1, number: 1 }).lean();
  return tables.map((t) => ({
    ...shape(t            ),
    url: tableUrl(storefrontOrigin, t            ),
  }));
}

/** Another table with the same number, ignoring capital letters — "T9" and "t9" are the same table to a person. */
async function sameNumber(ctx, number, exceptId) {
  const escaped = String(number).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return TableModel.findOne(tenantFilter(ctx, { number: new RegExp(`^${escaped}$`, "i"), ...(exceptId ? { _id: { $ne: exceptId } } : {}) }))
    .select("number")
    .lean();
}

/**
 * The plan decides how many tables a store may have, all its outlets together (sold in fives: 5, 10, 15 …). The count is read fresh — a store
 * adding tables one after another must never get ahead of a remembered number. The platform itself can always add.
 */
const tableLimitError = (max) => new HttpError(409, `Your plan allows ${max} tables and all are in use. Remove a table, or ask Rasoi Pulse to add more (tables are added 5 at a time).`, { code: "table_limit" });

/** The store's table limit (`Infinity` when it has none); throws when the store is already full. */
async function assertRoomForTable(ctx) {
  const plan = await storePlan(ctx.brandId);
  const max = tableLimit(plan.limits);
  if (Number.isFinite(max) && (await TableModel.countDocuments({ brandId: ctx.brandId })) >= max) throw tableLimitError(max);
  return max;
}

export async function createTable(ctx               , input                                                   , { asPlatform = false } = {}) {
  const max = asPlatform ? Infinity : await assertRoomForTable(ctx);
  const twin = await sameNumber(ctx, input.number);
  if (twin) {
    throw new HttpError(409, twin.number === input.number ? `Table ${twin.number} already exists.` : `Table ${twin.number} already exists — table numbers don't care about capital letters, so "${input.number}" is the same table.`);
  }

  const doc = await TableModel.create({
    brandId: ctx.brandId,
    outletId: ctx.outletId,
    number: input.number,
    zone: input.zone ?? "",
    seats: input.seats ?? 4,
    qrSecret: randomBytes(16).toString("base64url"),
  });
  // Several tables added in the same instant all see room before any is saved. So once saved, a table keeps its place only if it is among the first
  // `max` of the store (by creation order); the ones past that are taken back out. Nobody is turned away who should have fitted.
  if (Number.isFinite(max) && (await TableModel.countDocuments({ brandId: ctx.brandId, _id: { $lte: doc._id } })) > max) {
    await TableModel.deleteOne(tenantFilter(ctx, { _id: doc._id }));
    throw tableLimitError(max);
  }
  invalidateStoreUsage(ctx.brandId); // the store's "tables in use" changed
  return shape(doc.toObject());
}

export async function updateTable(
  ctx               ,
  id        ,
  patch                                                                                                  ,
) {
  if (patch.number !== undefined) {
    const twin = await sameNumber(ctx, patch.number, id);
    if (twin) throw new HttpError(409, `Table ${twin.number} already exists — table numbers don't care about capital letters.`);
  }
  const doc = await TableModel.findOneAndUpdate(tenantFilter(ctx, { _id: id }), patch, { new: true }).lean();
  if (!doc) throw new HttpError(404, "Table not found");
  return shape(doc            );
}

export async function deleteTable(ctx               , id        ) {
  const table = await TableModel.findOne(tenantFilter(ctx, { _id: id }));
  if (!table) throw new HttpError(404, "Table not found");
  if (table.activeSessionId) throw new HttpError(409, "Close the open session before removing this table");
  await TableModel.deleteOne(tenantFilter(ctx, { _id: id }));
  invalidateStoreUsage(ctx.brandId);
}

/** Rotating the secret kills every QR already printed for this table. */
export async function rotateQr(ctx               , id        ) {
  const table = await TableModel.findOne(tenantFilter(ctx, { _id: id }));
  if (!table) throw new HttpError(404, "Table not found");
  table.qrSecret = randomBytes(16).toString("base64url");
  await table.save();
  return table;
}

export async function getTable(ctx               , id        )                    {
  const table = await TableModel.findOne(tenantFilter(ctx, { _id: id })).lean();
  if (!table) throw new HttpError(404, "Table not found");
  return table            ;
}

/* ---------------------------------------------------------------- sessions */

/** Public: a diner has scanned a QR. Validates the signature before revealing anything. */
export async function resolveScan(tableId        , token        ) {
  const table = await TableModel.findOne({ _id: tableId }, null, { allowGlobalQuery: true }).lean();
  if (!table) throw new HttpError(404, "That table code isn't valid");

  const t = table            ;
  if (!safeEqual(tableToken(t), token)) {
    throw new HttpError(403, "That table code has expired — please ask staff for a fresh one");
  }
  if (!t.isActive) throw new HttpError(409, "That table isn't in service");

  return { table: t, ctx: { brandId: t.brandId, outletId: t.outletId }                  };
}

export async function openSession(ctx               , tableId        , customerId        ) {
  await assertOutletOpen(ctx.outletId);
  const table = await TableModel.findOne(tenantFilter(ctx, { _id: tableId }));
  if (!table) throw new HttpError(404, "Table not found");

  // Rejoin an open session if this diner already has one at this table.
  if (table.activeSessionId) {
    const existing = await TableSessionModel.findOne(
      tenantFilter(ctx, { _id: table.activeSessionId, status: "open" }),
    );
    if (existing) {
      if (existing.customerId !== customerId) {
        throw new HttpError(409, "Another party is already seated at this table. Please ask staff.", {
          code: "table_taken",
          tableId: String(table._id),
          tableNumber: table.number,
          occupied: true,
        });
      }
      return existing;
    }
  }

  const session = await TableSessionModel.create({
    brandId: ctx.brandId,
    outletId: ctx.outletId,
    tableId,
    customerId,
    status: "open",
    tableHistory: [{ tableId, number: table.number, at: new Date() }],
  });

  // Claim the table in ONE step, only if nobody has taken it since we looked (what we saw in `activeSessionId` is still
  // there). Two people opening the same free table at the same moment can't both win: the second claim matches nothing.
  const claimed = await TableModel.updateOne(
    tenantFilter(ctx, { _id: table._id, activeSessionId: table.activeSessionId ?? null }),
    { $set: { activeSessionId: String(session._id), status: "seated" } },
  );
  if (claimed.modifiedCount !== 1) {
    await TableSessionModel.deleteOne(tenantFilter(ctx, { _id: session._id }));
    throw new HttpError(409, `Table ${table.number} was just taken by someone else.`, {
      code: "table_taken",
      tableId: String(table._id),
      tableNumber: table.number,
      occupied: true,
    });
  }
  return session;
}

export async function sessionForCustomer(ctx               , customerId        ) {
  return TableSessionModel.findOne(tenantFilter(ctx, { customerId, status: "open" })).lean();
}

/** Every order on a session, plus the running tab and what's still unpaid. */
export async function sessionTab(ctx               , sessionId        ) {
  const orders = await OrderModel.find(tenantFilter(ctx, { sessionId })).sort({ createdAt: 1 }).lean();
  const open = orders.filter((o) => o.status !== "cancelled");
  const unpaid = open.filter((o) => o.payment.status !== "paid");
  return {
    orders: open.map((o) => ({
      id: String(o._id),
      orderNumber: o.orderNumber,
      status: o.status,
      lines: o.lines,
      totals: o.totals,
      payment: o.payment,
      createdAt: o.createdAt,
    })),
    tab: open.reduce((sum, o) => sum + o.totals.grandTotal, 0),
    unpaidTotal: unpaid.reduce((sum, o) => sum + o.totals.grandTotal, 0),
    allPaid: unpaid.length === 0,
  };
}

/** Unlocks a table once its session is done with it — free for the next party
 *  to claim, once staff have physically cleared it (see `updateTable`). */
async function unlockTable(ctx               , session                          ) {
  const table = await TableModel.findOne(tenantFilter(ctx, { _id: session.tableId }));
  if (table) {
    table.activeSessionId = null;
    table.status = "free"; // the next party can sit straight away
    await table.save();
  }
}

/**
 * Mark every unpaid order on a session as paid — the owner has confirmed cash
 * (or whatever was owed) actually changed hands. This is what `closeSession`
 * requires before it will unlock the table.
 */
export async function confirmSessionPayment(ctx               , sessionId        ) {
  const session = await TableSessionModel.findOne(tenantFilter(ctx, { _id: sessionId, status: "open" })).lean();
  if (!session) throw new HttpError(404, "No open session here");

  await OrderModel.updateMany(
    tenantFilter(ctx, { sessionId, status: { $ne: "cancelled" }, "payment.status": { $ne: "paid" } }),
    { $set: { "payment.status": "paid" } },
  );

  return sessionTab(ctx, sessionId);
}

/**
 * A party walked out, or a table was claimed by mistake — free it without
 * requiring payment. Every still-open order on the session is cancelled first
 * (see {@link cancelOrdersForSession}), so nothing is left dangling in the
 * kitchen queue for a table nobody is sitting at any more.
 */
export async function voidSession(ctx               , sessionId        , byUserId         , reason         ) {
  const session = await TableSessionModel.findOne(tenantFilter(ctx, { _id: sessionId, status: "open" }));
  if (!session) throw new HttpError(404, "No open session to void");

  await cancelOrdersForSession(ctx, sessionId, byUserId, reason);

  session.status = "closed";
  session.closedAt = new Date();
  session.closedBy = byUserId;
  await session.save();

  await unlockTable(ctx, session);
  return session.toObject();
}

/**
 * Move a seated party to another table — the "they shifted from 5 to 7" case.
 * The session, its orders and the running tab all follow; both tables' state and
 * the session's table history are updated.
 */
export async function moveSession(ctx               , sessionId        , toTableId        , byUserId         ) {
  const session = await TableSessionModel.findOne(tenantFilter(ctx, { _id: sessionId, status: "open" }));
  if (!session) throw new HttpError(404, "No open session to move");
  if (session.tableId === toTableId) throw new HttpError(409, "That party is already at this table");

  const [from, to] = await Promise.all([
    TableModel.findOne(tenantFilter(ctx, { _id: session.tableId })),
    TableModel.findOne(tenantFilter(ctx, { _id: toTableId })),
  ]);
  if (!to) throw new HttpError(404, "Destination table not found");
  if (to.activeSessionId && to.activeSessionId !== sessionId) {
    throw new HttpError(409, `Table ${to.number} is already occupied`);
  }

  // orders follow the party
  await OrderModel.updateMany(tenantFilter(ctx, { sessionId }), { $set: { tableId: toTableId } });

  session.tableId = toTableId;
  session.tableHistory.push({ tableId: toTableId, number: to.number, at: new Date(), by: byUserId });
  await session.save();

  if (from) {
    from.activeSessionId = null;
    from.status = "free";
    await from.save();
  }
  to.activeSessionId = sessionId;
  to.status = "seated";
  await to.save();

  return { session: session.toObject(), from: from ? shape(from.toObject()) : null, to: shape(to.toObject()) };
}

/** Tables that are in service and have nobody at them — what an operator can pick from. */
export async function freeTablesList(ctx) {
  const tables = await TableModel.find(tenantFilter(ctx, { isActive: true, activeSessionId: null })).sort({ zone: 1, number: 1 }).lean();
  return tables.filter((t) => normalizeTableStatus(t.status) === "free").map((t) => ({ id: String(t._id), number: t.number, zone: t.zone ?? "", seats: t.seats }));
}

/**
 * An order that was Completed (or Cancelled) is put back to being worked on, by hand. If it was a dine-in order, its table must be
 * seated again — otherwise the table shows FREE while an order for it is being cooked, and another party can be sat on top of it.
 *
 *  - the party's session is still open (other orders were running): nothing to do;
 *  - the session was closed and its table is still free: the session is opened again, the table seated again;
 *  - the table has another party now: the answer is a 409 `table_taken` with the list of free tables, so the person can pick one;
 *    called again with `toTableId`, the session is opened again on THAT table (the orders follow it).
 *
 * Done before the order itself changes, so a refusal leaves everything as it was. Returns null when there is nothing to do, else
 * `{ table, moved, undo }` — `undo()` puts it back if the status change that follows fails.
 */
export async function reseatForReopenedOrder(ctx, order, { toTableId, byUserId } = {}) {
  if (order.channel !== "dine-in" || !order.sessionId) return null;
  const session = await TableSessionModel.findOne(tenantFilter(ctx, { _id: order.sessionId }));
  if (!session || session.status === "open") return null;

  const original = await TableModel.findOne(tenantFilter(ctx, { _id: session.tableId }));
  const chosen = toTableId && toTableId !== session.tableId ? await TableModel.findOne(tenantFilter(ctx, { _id: toTableId })) : original;
  if (toTableId && !chosen) throw new HttpError(404, "That table doesn't exist.");
  const isFree = (t) => Boolean(t && t.isActive && !t.activeSessionId && normalizeTableStatus(t.status) === "free");

  if (!isFree(chosen)) {
    const label = original?.number ?? "its table";
    throw new HttpError(
      409,
      chosen && chosen !== original
        ? `Table ${chosen.number} isn't free. Pick another table.`
        : `Table ${label} has another party now. Pick a different table for this order.`,
      { code: "table_taken", tableId: String(original?._id ?? session.tableId), tableNumber: original?.number ?? null, occupied: true, freeTables: await freeTablesList(ctx) },
    );
  }

  // Claim the table in ONE step, only if nobody has sat down since we looked.
  const claimed = await TableModel.updateOne(tenantFilter(ctx, { _id: chosen._id, activeSessionId: null }), { $set: { activeSessionId: String(session._id), status: "seated" } });
  if (claimed.modifiedCount !== 1) {
    throw new HttpError(409, `Table ${chosen.number} was just taken. Pick another table.`, {
      code: "table_taken", tableId: String(chosen._id), tableNumber: chosen.number, occupied: true, freeTables: await freeTablesList(ctx),
    });
  }

  const moved = String(chosen._id) !== String(session.tableId);
  const previous = { tableId: session.tableId, closedAt: session.closedAt, closedBy: session.closedBy };
  try {
    session.status = "open";
    session.closedAt = undefined;
    session.closedBy = undefined;
    if (moved) {
      session.tableId = String(chosen._id);
      session.tableHistory.push({ tableId: String(chosen._id), number: chosen.number, at: new Date(), by: byUserId });
      await OrderModel.updateMany(tenantFilter(ctx, { sessionId: String(session._id) }), { $set: { tableId: String(chosen._id) } });
    }
    await session.save();
  } catch (err) {
    await TableModel.updateOne(tenantFilter(ctx, { _id: chosen._id }), { $set: { activeSessionId: null, status: "free" } });
    throw err;
  }

  return {
    table: { id: String(chosen._id), number: chosen.number, zone: chosen.zone ?? "", seats: chosen.seats },
    moved,
    /** put everything back (the status change that was meant to follow did not happen) */
    undo: async () => {
      await TableModel.updateOne(tenantFilter(ctx, { _id: chosen._id }), { $set: { activeSessionId: null, status: "free" } });
      await TableSessionModel.updateOne(tenantFilter(ctx, { _id: session._id }), { $set: { status: "closed", tableId: previous.tableId, closedAt: previous.closedAt, closedBy: previous.closedBy } });
      if (moved) await OrderModel.updateMany(tenantFilter(ctx, { sessionId: String(session._id) }), { $set: { tableId: previous.tableId } });
    },
  };
}

export async function closeSession(ctx               , sessionId        , byUserId         ) {
  const session = await TableSessionModel.findOne(tenantFilter(ctx, { _id: sessionId, status: "open" }));
  if (!session) throw new HttpError(404, "No open session to close");

  const { allPaid, unpaidTotal } = await sessionTab(ctx, sessionId);
  if (!allPaid) {
    throw new HttpError(
      409,
      `Confirm payment before marking this table vacant — ₹${(unpaidTotal / 100).toFixed(0)} still unpaid.`,
    );
  }

  session.status = "closed";
  session.closedAt = new Date();
  session.closedBy = byUserId;
  await session.save();

  await unlockTable(ctx, session);
  return session.toObject();
}

/** Staff view: every open session with its table and running tab. */
export async function listActiveSessions(ctx               ) {
  const sessions = await TableSessionModel.find(tenantFilter(ctx, { status: "open" })).sort({ openedAt: 1 }).lean();
  const tables = await TableModel.find(tenantFilter(ctx)).lean();
  const byId = new Map(tables.map((t) => [String(t._id), t]));
  // who's sitting there — staff recognise a party by name, and the Take order
  // screen locks a seated table's customer to them
  const customers = await CustomerModel.find({ brandId: ctx.brandId, _id: { $in: sessions.map((s) => s.customerId) } }).lean();
  const customerById = new Map(customers.map((c) => [String(c._id), c]));

  return Promise.all(
    sessions.map(async (s) => {
      const { orders, tab, unpaidTotal, allPaid } = await sessionTab(ctx, String(s._id));
      // still being made / served — a party with none left and nothing unpaid is done
      const openOrders = orders.filter((o) => o.status !== "completed").length;
      return {
        id: String(s._id),
        tableId: s.tableId,
        tableNumber: byId.get(s.tableId)?.number ?? "?",
        customerId: s.customerId,
        customerName: customerById.get(s.customerId)?.name ?? null,
        customerPhone: customerById.get(s.customerId)?.phone ?? null,
        openedAt: s.openedAt,
        orderCount: orders.length,
        openOrders,
        tab,
        unpaidTotal,
        allPaid,
        tableHistory: s.tableHistory,
      };
    }),
  );
}
