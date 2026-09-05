import { Router } from "express";
import { z } from "zod";
import { tableStatusSchema } from "@onetap/config-schema";
import { env } from "../../env.js";
import { requireOutletContext, requireUser } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/error.js";
import { currentCustomer } from "../customer/customer.routes.js";
import {
  closeSession,
  createTable,
  deleteTable,
  getTable,
  listActiveSessions,
  listTableQrUrls,
  listTables,
  moveSession,
  openSession,
  qrDataUrl,
  resolveScan,
  rotateQr,
  sessionForCustomer,
  sessionTab,
  tableUrl,
  updateTable,
} from "./tables.service.js";

export const tablesRouter         = Router();

/**
 * From the validated env, not `process.env` directly — reading it here is how
 * it stayed unset in production without anything noticing. `env.js` refuses to
 * start with a localhost value when NODE_ENV is production.
 */
const STOREFRONT_ORIGIN = env.STOREFRONT_ORIGIN;

/* -------------------------------------------------------------- staff CRUD */

tablesRouter.get("/", async (req, res) => {
  const ctx = await requireOutletContext(req, "table:read");
  res.json({ tables: await listTables(ctx) });
});

const createBody = z.object({
  number: z.string().min(1).max(20),
  zone: z.string().max(40).optional(),
  seats: z.number().int().positive().max(50).optional(),
});

tablesRouter.post("/", async (req, res) => {
  const ctx = await requireOutletContext(req, "table:manage");
  res.status(201).json({ table: await createTable(ctx, createBody.parse(req.body)) });
});

const updateBody = createBody.partial().extend({
  status: tableStatusSchema.optional(),
  isActive: z.boolean().optional(),
});

tablesRouter.patch("/:id", async (req, res) => {
  const ctx = await requireOutletContext(req, "table:manage");
  res.json({ table: await updateTable(ctx, req.params.id, updateBody.parse(req.body)) });
});

tablesRouter.delete("/:id", async (req, res) => {
  const ctx = await requireOutletContext(req, "table:manage");
  await deleteTable(ctx, req.params.id);
  res.status(204).end();
});

/* ----------------------------------------------------------------- QR codes */

/**
 * Every table's signed URL in one call — what the card designer needs to print
 * a sheet of forty cards without forty round trips. Deliberately returns URLs
 * rather than images: the designer draws its own QR from the module matrix so
 * it can style it, which a baked PNG cannot support.
 *
 * `origin` comes back so the editor can check it. STOREFRONT_ORIGIN falling
 * back to localhost is silent and catastrophic here — the cards print fine and
 * every one of them is useless.
 */
tablesRouter.get("/qr-urls", async (req, res) => {
  const ctx = await requireOutletContext(req, "table:read");
  res.json({ origin: STOREFRONT_ORIGIN, tables: await listTableQrUrls(ctx, STOREFRONT_ORIGIN) });
});

tablesRouter.get("/:id/qr", async (req, res) => {
  const ctx = await requireOutletContext(req, "table:read");
  const table = await getTable(ctx, req.params.id);
  const url = tableUrl(STOREFRONT_ORIGIN, table);
  res.json({ url, dataUrl: await qrDataUrl(url), number: table.number });
});

/** Rotating invalidates every code already printed for this table. */
tablesRouter.post("/:id/qr/rotate", async (req, res) => {
  const ctx = await requireOutletContext(req, "table:manage");
  const table = await rotateQr(ctx, req.params.id);
  const url = tableUrl(STOREFRONT_ORIGIN, table);
  res.json({ url, dataUrl: await qrDataUrl(url), number: table.number });
});

/* ------------------------------------------------------------ staff sessions */

tablesRouter.get("/sessions/active", async (req, res) => {
  const ctx = await requireOutletContext(req, "table:read");
  res.json({ sessions: await listActiveSessions(ctx) });
});

tablesRouter.post("/sessions/:id/move", async (req, res) => {
  const ctx = await requireOutletContext(req, "table:manage");
  const user = requireUser(req);
  const { toTableId } = z.object({ toTableId: z.string().min(1) }).parse(req.body);
  res.json(await moveSession(ctx, req.params.id, toTableId, String(user._id)));
});

tablesRouter.post("/sessions/:id/close", async (req, res) => {
  const ctx = await requireOutletContext(req, "table:manage");
  const user = requireUser(req);
  res.json({ session: await closeSession(ctx, req.params.id, String(user._id)) });
});

/* ------------------------------------------------------------ diner (public) */

/** Scan landing: validate the signed code and say which table this is. */
tablesRouter.get("/scan/:tableId", async (req, res) => {
  const token = typeof req.query.k === "string" ? req.query.k : "";
  const { table, ctx } = await resolveScan(req.params.tableId, token);

  const customer = await currentCustomer(req);
  const session = customer ? await sessionForCustomer(ctx, String(customer._id)) : null;

  res.json({
    outletId: ctx.outletId,
    table: { id: String(table._id), number: table.number, zone: table.zone, seats: table.seats },
    occupiedByOther: Boolean(table.activeSessionId && (!session || String(session._id) !== table.activeSessionId)),
    session: session ? { id: String(session._id), tableId: session.tableId } : null,
  });
});

/** Open (or rejoin) a session — requires a verified diner. */
tablesRouter.post("/scan/:tableId/session", async (req, res) => {
  const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
  const { table, ctx } = await resolveScan(req.params.tableId, token);

  const customer = await currentCustomer(req);
  if (!customer) throw new HttpError(401, "Verify your mobile or email before ordering");
  if (customer.brandId !== ctx.brandId) throw new HttpError(403, "Verify again for this restaurant");

  const session = await openSession(ctx, String(table._id), String(customer._id));
  res.json({ session: { id: String(session._id), tableId: session.tableId }, outletId: ctx.outletId });
});

/**
 * Tables a diner can pick from when they came to the site directly rather than
 * scanning a code. Only the number and whether it is taken — no ids, no QR
 * secrets, nothing that would let someone forge a scan.
 */
tablesRouter.get("/public", async (req, res) => {
  const outletId = typeof req.query.outletId === "string" ? req.query.outletId : "";
  if (!outletId) throw new HttpError(400, "outletId is required");

  const { OutletModel, TableModel } = await import("@onetap/db");
  const outlet = await OutletModel.findOne({ _id: outletId }, null, { allowGlobalQuery: true }).lean();
  if (!outlet) throw new HttpError(404, "Outlet not found");

  const tables = await TableModel.find({ brandId: outlet.brandId, outletId, isActive: true })
    .sort({ number: 1 })
    .lean();

  res.json({
    tables: tables.map((t) => ({
      number: t.number,
      zone: t.zone,
      seats: t.seats,
      occupied: Boolean(t.activeSessionId),
    })),
  });
});

/**
 * Claim a table by its number, for a diner who walked in and opened the site
 * directly instead of scanning.
 *
 * This is deliberately weaker than a scan: the number is written on the table,
 * so anyone in the room can type it. What keeps it honest is that the caller
 * must already be a verified customer, the table must not be occupied by another
 * party, and the claim is recorded against them. A scan stays the better path
 * and is what the QR flow uses.
 */
tablesRouter.post("/claim", async (req, res) => {
  const { outletId, tableNumber } = z
    .object({ outletId: z.string().min(1), tableNumber: z.string().min(1).max(20) })
    .parse(req.body);

  const customer = await currentCustomer(req);
  if (!customer) throw new HttpError(401, "Verify your mobile or email before choosing a table");

  const { OutletModel, TableModel } = await import("@onetap/db");
  const outlet = await OutletModel.findOne({ _id: outletId }, null, { allowGlobalQuery: true }).lean();
  if (!outlet) throw new HttpError(404, "Outlet not found");
  if (customer.brandId !== outlet.brandId) throw new HttpError(403, "Verify again for this restaurant");

  const ctx = { brandId: outlet.brandId, outletId };
  const table = await TableModel.findOne({ ...ctx, number: tableNumber.trim(), isActive: true });
  if (!table) throw new HttpError(404, `There's no table ${tableNumber} here. Check the number on your table.`);

  // Someone else's tab is already open here — sending food to it would put this
  // order on their bill.
  if (table.activeSessionId) {
    const { TableSessionModel } = await import("@onetap/db");
    const existing = await TableSessionModel.findOne({ ...ctx, _id: table.activeSessionId, status: "open" }).lean();
    if (existing && existing.customerId !== String(customer._id)) {
      throw new HttpError(409, `Table ${tableNumber} is already in use. Please ask a member of staff.`);
    }
  }

  const session = await openSession(ctx, String(table._id), String(customer._id));
  res.json({
    session: { id: String(session._id), tableId: session.tableId },
    table: { number: table.number, zone: table.zone },
  });
});

/** The diner's own running tab. */
tablesRouter.get("/sessions/:id/tab", async (req, res) => {
  const outletId = typeof req.query.outletId === "string" ? req.query.outletId : "";
  if (!outletId) throw new HttpError(400, "outletId is required");

  const customer = await currentCustomer(req);
  if (!customer) throw new HttpError(401, "Sign in to see your tab");

  const ctx = { brandId: customer.brandId, outletId };
  const { TableSessionModel } = await import("@onetap/db");
  const session = await TableSessionModel.findOne({
    _id: req.params.id,
    brandId: ctx.brandId,
    outletId,
    customerId: String(customer._id),
  }).lean();
  if (!session) throw new HttpError(403, "That isn't your table");

  res.json(await sessionTab(ctx, req.params.id));
});
