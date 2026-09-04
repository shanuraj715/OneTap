import { createHmac, randomBytes } from "node:crypto";
import QRCode from "qrcode";
                                                         
import {
  OrderModel,
  TableModel,
  TableSessionModel,
  tenantFilter,
                
                     
} from "@onetap/db";
import { env } from "../../env.js";
import { safeEqual } from "../../lib/crypto.js";
import { HttpError } from "../../middleware/error.js";

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
  status: t.status,
  isActive: t.isActive,
  activeSessionId: t.activeSessionId ?? null,
});

export async function listTables(ctx               ) {
  const tables = await TableModel.find(tenantFilter(ctx)).sort({ zone: 1, number: 1 }).lean();
  return tables.map((t) => shape(t            ));
}

export async function createTable(ctx               , input                                                   ) {
  const exists = await TableModel.exists(tenantFilter(ctx, { number: input.number }));
  if (exists) throw new HttpError(409, `Table ${input.number} already exists`);

  const doc = await TableModel.create({
    brandId: ctx.brandId,
    outletId: ctx.outletId,
    number: input.number,
    zone: input.zone ?? "",
    seats: input.seats ?? 4,
    qrSecret: randomBytes(16).toString("base64url"),
  });
  return shape(doc.toObject());
}

export async function updateTable(
  ctx               ,
  id        ,
  patch                                                                                                  ,
) {
  const doc = await TableModel.findOneAndUpdate(tenantFilter(ctx, { _id: id }), patch, { new: true }).lean();
  if (!doc) throw new HttpError(404, "Table not found");
  return shape(doc            );
}

export async function deleteTable(ctx               , id        ) {
  const table = await TableModel.findOne(tenantFilter(ctx, { _id: id }));
  if (!table) throw new HttpError(404, "Table not found");
  if (table.activeSessionId) throw new HttpError(409, "Close the open session before removing this table");
  await TableModel.deleteOne(tenantFilter(ctx, { _id: id }));
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
  const table = await TableModel.findOne(tenantFilter(ctx, { _id: tableId }));
  if (!table) throw new HttpError(404, "Table not found");

  // Rejoin an open session if this diner already has one at this table.
  if (table.activeSessionId) {
    const existing = await TableSessionModel.findOne(
      tenantFilter(ctx, { _id: table.activeSessionId, status: "open" }),
    );
    if (existing) {
      if (existing.customerId !== customerId) {
        throw new HttpError(409, "Another party is already seated at this table. Please ask staff.");
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

  table.activeSessionId = String(session._id);
  table.status = "seated";
  await table.save();
  return session;
}

export async function sessionForCustomer(ctx               , customerId        ) {
  return TableSessionModel.findOne(tenantFilter(ctx, { customerId, status: "open" })).lean();
}

/** Every order on a session, plus the running tab. */
export async function sessionTab(ctx               , sessionId        ) {
  const orders = await OrderModel.find(tenantFilter(ctx, { sessionId })).sort({ createdAt: 1 }).lean();
  const open = orders.filter((o) => o.status !== "cancelled");
  return {
    orders: open.map((o) => ({
      id: String(o._id),
      orderNumber: o.orderNumber,
      status: o.status,
      lines: o.lines,
      totals: o.totals,
      createdAt: o.createdAt,
    })),
    tab: open.reduce((sum, o) => sum + o.totals.grandTotal, 0),
  };
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
    from.status = "needs-cleaning";
    await from.save();
  }
  to.activeSessionId = sessionId;
  to.status = "seated";
  await to.save();

  return { session: session.toObject(), from: from ? shape(from.toObject()) : null, to: shape(to.toObject()) };
}

export async function closeSession(ctx               , sessionId        , byUserId         ) {
  const session = await TableSessionModel.findOne(tenantFilter(ctx, { _id: sessionId, status: "open" }));
  if (!session) throw new HttpError(404, "No open session to close");

  session.status = "closed";
  session.closedAt = new Date();
  session.closedBy = byUserId;
  await session.save();

  const table = await TableModel.findOne(tenantFilter(ctx, { _id: session.tableId }));
  if (table) {
    table.activeSessionId = null;
    table.status = "needs-cleaning";
    await table.save();
  }
  return session.toObject();
}

/** Staff view: every open session with its table and running tab. */
export async function listActiveSessions(ctx               ) {
  const sessions = await TableSessionModel.find(tenantFilter(ctx, { status: "open" })).sort({ openedAt: 1 }).lean();
  const tables = await TableModel.find(tenantFilter(ctx)).lean();
  const byId = new Map(tables.map((t) => [String(t._id), t]));

  return Promise.all(
    sessions.map(async (s) => {
      const { orders, tab } = await sessionTab(ctx, String(s._id));
      return {
        id: String(s._id),
        tableId: s.tableId,
        tableNumber: byId.get(s.tableId)?.number ?? "?",
        customerId: s.customerId,
        openedAt: s.openedAt,
        orderCount: orders.length,
        tab,
        tableHistory: s.tableHistory,
      };
    }),
  );
}
