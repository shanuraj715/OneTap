import { randomUUID } from "node:crypto";
import {
  charsFor,
  DEFAULT_MAX_ATTEMPTS,
  defaultTemplate,
  isThermal,
  nextRetryDelaySec,
  outletConfigSchema,
  PRINT_DOCS,
  printTemplateSchema,
  STATION_DEFAULT_DOC,
  type OrderStatus,
  type PrintDocType,
  type Printer,
  type PrintJobView,
  type PrintTarget,
  type PrintTemplate,
} from "@onetap/config-schema";
import {
  OrderModel,
  OutletModel,
  PrinterModel,
  PrintJobModel,
  PrintTemplateModel,
  TableModel,
  tenantFilter,
  type OrderDoc,
  type PrinterDoc,
  type PrintJobDoc,
  type PrintJobDocument,
  type PrintTemplateDoc,
  type TenantContext,
} from "@onetap/db";
import { encryptSecret, maskSecret } from "../../lib/crypto";
import { logger } from "../../logger";
import { HttpError } from "../../middleware/error";
import { broadcast } from "../../realtime/hub";
import { toEscPos } from "./escpos";
import { providerFor } from "./providers";
import { renderHtml, renderText, type RenderInput, type RenderOrder, type RenderOutlet } from "./render";

/* ------------------------------------------------------------------ shaping */

/** The cloud API key never leaves the server. */
export function shapePrinter(p: PrinterDoc): Printer & { cloudApiKeySet: boolean; configError: string | null } {
  const { cloudApiKey, ...connection } = p.connection ?? ({} as PrinterDoc["connection"]);
  return {
    id: String(p._id),
    name: p.name,
    station: p.station,
    docType: p.docType,
    target: p.target,
    paperWidth: p.paperWidth,
    templateId: p.templateId,
    connection: { ...connection, cloudApiKey: cloudApiKey ? maskSecret(cloudApiKey) : "" },
    autoPrintOn: p.autoPrintOn ?? [],
    channels: p.channels ?? [],
    copies: p.copies,
    cutAfter: p.cutAfter,
    openDrawer: p.openDrawer,
    isActive: p.isActive,
    lastOkAt: p.lastOkAt ? p.lastOkAt.toISOString() : null,
    lastErrorAt: p.lastErrorAt ? p.lastErrorAt.toISOString() : null,
    lastError: p.lastError,
    cloudApiKeySet: Boolean(cloudApiKey),
    configError: providerFor(p.target).configError(p),
  };
}

export function shapeTemplate(t: PrintTemplateDoc): PrintTemplate {
  return printTemplateSchema.parse({
    id: String(t._id),
    name: t.name,
    docType: t.docType,
    paperWidth: t.paperWidth,
    colorMode: t.colorMode,
    logoUrl: t.logoUrl,
    logoWidthPct: t.logoWidthPct,
    logoThreshold: t.logoThreshold,
    logoRaster: t.logoRaster ?? null,
    blocks: t.blocks,
    charsPerLine: t.charsPerLine,
    feedLines: t.feedLines,
    isDefault: t.isDefault,
  });
}

export function shapeJob(j: PrintJobDoc): PrintJobView {
  return {
    id: String(j._id),
    status: j.status,
    docType: j.docType,
    printerId: j.printerId,
    printerName: j.printerName,
    station: j.station,
    target: j.target,
    orderId: j.orderId,
    orderNumber: j.orderNumber,
    attemptCount: j.attemptCount,
    maxAttempts: j.maxAttempts,
    lastError: j.lastError,
    nextAttemptAt: j.nextAttemptAt ? j.nextAttemptAt.toISOString() : null,
    isReprint: j.isReprint,
    reprintOf: j.reprintOf,
    copies: j.copies,
    createdAt: j.createdAt.toISOString(),
    printedAt: j.printedAt ? j.printedAt.toISOString() : null,
  };
}

/* ---------------------------------------------------------------- printers */

export async function listPrinters(ctx: TenantContext) {
  const printers = await PrinterModel.find(tenantFilter(ctx)).sort({ station: 1, name: 1 });
  return printers.map(shapePrinter);
}

async function getPrinterDoc(ctx: TenantContext, id: string) {
  const p = await PrinterModel.findOne(tenantFilter(ctx, { _id: id }));
  if (!p) throw new HttpError(404, "Printer not found");
  return p;
}

export interface PrinterInput {
  name: string;
  station: PrinterDoc["station"];
  docType: PrintDocType;
  target: PrintTarget;
  paperWidth: PrinterDoc["paperWidth"];
  templateId?: string | null;
  connection?: Partial<PrinterDoc["connection"]>;
  autoPrintOn?: string[];
  channels?: string[];
  copies?: number;
  cutAfter?: boolean;
  openDrawer?: boolean;
  isActive?: boolean;
}

/** A blank string means "leave the stored key alone"; it is never a way to read it. */
function mergeConnection(
  existing: PrinterDoc["connection"] | undefined,
  patch: Partial<PrinterDoc["connection"]> | undefined,
): PrinterDoc["connection"] {
  const base = { ...(existing ?? {}) } as PrinterDoc["connection"];
  if (!patch) return base;
  const { cloudApiKey, ...rest } = patch;
  Object.assign(base, rest);
  if (cloudApiKey) base.cloudApiKey = encryptSecret(cloudApiKey);
  return base;
}

export async function createPrinter(ctx: TenantContext, input: PrinterInput) {
  const dupe = await PrinterModel.findOne(tenantFilter(ctx, { name: input.name }));
  if (dupe) throw new HttpError(409, `A printer called "${input.name}" already exists at this outlet`);

  const printer = await PrinterModel.create({
    brandId: ctx.brandId,
    outletId: ctx.outletId,
    ...input,
    docType: input.docType ?? STATION_DEFAULT_DOC[input.station],
    connection: mergeConnection(undefined, input.connection),
  });
  return shapePrinter(printer);
}

export async function updatePrinter(ctx: TenantContext, id: string, patch: Partial<PrinterInput>) {
  const printer = await getPrinterDoc(ctx, id);
  const { connection, ...rest } = patch;
  Object.assign(printer, rest);
  printer.connection = mergeConnection(printer.connection, connection);
  await printer.save();
  return shapePrinter(printer);
}

export async function deletePrinter(ctx: TenantContext, id: string) {
  const printer = await getPrinterDoc(ctx, id);
  // Jobs keep the denormalised printer name, so the queue stays readable.
  await PrintJobModel.updateMany(
    tenantFilter(ctx, { printerId: id, status: { $in: ["queued", "printing"] } }),
    { $set: { status: "cancelled", lastError: "Printer was removed" } },
  );
  await PrinterModel.deleteOne(tenantFilter(ctx, { _id: String(printer._id) }));
}

/* --------------------------------------------------------------- templates */

export async function listTemplates(ctx: TenantContext) {
  const t = await PrintTemplateModel.find(tenantFilter(ctx)).sort({ docType: 1, name: 1 });
  return t.map(shapeTemplate);
}

/** Every outlet starts with one working template per document type. */
export async function ensureDefaultTemplates(ctx: TenantContext) {
  const existing = await PrintTemplateModel.find(tenantFilter(ctx, { isDefault: true }));
  const have = new Set(existing.map((t) => t.docType));
  const missing = PRINT_DOCS.filter((d) => !have.has(d));
  if (!missing.length) return;

  await PrintTemplateModel.insertMany(
    missing.map((docType) => {
      const { id: _id, ...rest } = defaultTemplate(docType);
      return { brandId: ctx.brandId, outletId: ctx.outletId, ...rest };
    }),
  );
}

export async function createTemplate(ctx: TenantContext, input: Partial<PrintTemplate> & { name: string; docType: PrintDocType }) {
  const base = defaultTemplate(input.docType, input.paperWidth);
  const { id: _id, ...rest } = { ...base, ...input, isDefault: false };
  const doc = await PrintTemplateModel.create({ brandId: ctx.brandId, outletId: ctx.outletId, ...rest });
  return shapeTemplate(doc);
}

export async function updateTemplate(ctx: TenantContext, id: string, patch: Partial<PrintTemplate>) {
  const doc = await PrintTemplateModel.findOne(tenantFilter(ctx, { _id: id }));
  if (!doc) throw new HttpError(404, "Template not found");
  const { id: _ignored, ...rest } = patch;
  Object.assign(doc, rest);
  await doc.save();
  return shapeTemplate(doc);
}

export async function deleteTemplate(ctx: TenantContext, id: string) {
  const doc = await PrintTemplateModel.findOne(tenantFilter(ctx, { _id: id }));
  if (!doc) throw new HttpError(404, "Template not found");
  if (doc.isDefault) throw new HttpError(409, "The built-in template for a document type can't be deleted");

  const inUse = await PrinterModel.countDocuments(tenantFilter(ctx, { templateId: id }));
  if (inUse) throw new HttpError(409, `${inUse} printer(s) still use this template`);

  await PrintTemplateModel.deleteOne(tenantFilter(ctx, { _id: id }));
}

/**
 * Which template a printer prints with. Falls back to the outlet default for the
 * document type, and finally to the built-in — a printer must never be unable to
 * print because a template was deleted.
 */
export async function templateForPrinter(ctx: TenantContext, printer: PrinterDoc): Promise<PrintTemplate> {
  if (printer.templateId) {
    const chosen = await PrintTemplateModel.findOne(tenantFilter(ctx, { _id: printer.templateId }));
    if (chosen) return { ...shapeTemplate(chosen), paperWidth: printer.paperWidth };
  }
  const fallback = await PrintTemplateModel.findOne(
    tenantFilter(ctx, { docType: printer.docType, isDefault: true }),
  );
  if (fallback) return { ...shapeTemplate(fallback), paperWidth: printer.paperWidth };
  return defaultTemplate(printer.docType, printer.paperWidth);
}

/* ------------------------------------------------------------ render input */

async function outletIdentity(ctx: TenantContext): Promise<RenderOutlet> {
  const outlet = await OutletModel.findOne({ _id: ctx.outletId }, null, { allowGlobalQuery: true }).lean();
  if (!outlet) throw new HttpError(404, "Outlet not found");
  const config = outletConfigSchema.parse(outlet.config ?? {});
  const id = config.identity;
  return {
    name: id.name || outlet.name,
    address: id.address || undefined,
    phone: id.phone || undefined,
    website: (id as { website?: string }).website || undefined,
    fssaiLicense: id.fssaiLicense || undefined,
    gstin: id.gstin || undefined,
  };
}

async function toRenderOrder(ctx: TenantContext, order: OrderDoc): Promise<RenderOrder> {
  let tableNumber: string | undefined;
  if (order.tableId) {
    const table = await TableModel.findOne(tenantFilter(ctx, { _id: order.tableId })).lean();
    tableNumber = table?.number;
  }
  return {
    orderNumber: order.orderNumber,
    channel: order.channel,
    status: order.status,
    createdAt: order.createdAt,
    tableNumber,
    customer: order.customer ? { name: order.customer.name, phone: order.customer.phone } : undefined,
    note: order.note,
    lines: order.lines.map((l) => ({
      name: l.name,
      variantLabel: l.variantLabel,
      modifiers: l.modifiers ?? [],
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
      note: l.note,
    })),
    totals: order.totals,
    pricesIncludeTax: order.pricesIncludeTax,
    payment: { gateway: order.payment.gateway, status: order.payment.status },
  };
}

/** A realistic order for previewing a template and for test prints. */
export function sampleOrder(): RenderOrder {
  return {
    orderNumber: "0042",
    channel: "dine-in",
    status: "accepted",
    createdAt: new Date(),
    tableNumber: "7",
    customer: { name: "Aarav Sharma", phone: "98xxxxxx10" },
    note: "Less spicy, extra chutney",
    lines: [
      { name: "Steam Momo", variantLabel: "Full plate", modifiers: [{ label: "Extra chutney", priceDelta: 1000 }], quantity: 2, unitPrice: 11000, lineTotal: 22000 },
      { name: "Fried Momo", variantLabel: "Half plate", modifiers: [], quantity: 1, unitPrice: 7000, lineTotal: 7000, note: "no onion" },
      { name: "Masala Chai", modifiers: [], quantity: 3, unitPrice: 2000, lineTotal: 6000 },
    ],
    totals: {
      subtotal: 35000, taxable: 33334, cgst: 833, sgst: 833,
      taxAmount: 1666, serviceCharge: 0, roundOff: 0, grandTotal: 35000,
    },
    pricesIncludeTax: true,
    payment: { gateway: "cod", status: "pending" },
  };
}

/** Encode the QR block's content once, so the sync renderers can just embed it. */
async function qrForTemplate(template: PrintTemplate): Promise<string | undefined> {
  const block = template.blocks.find((b) => b.key === "qr" && b.enabled && b.text.trim());
  if (!block) return undefined;
  try {
    const QRCode = (await import("qrcode")).default;
    return await QRCode.toDataURL(block.text.trim(), { errorCorrectionLevel: "M", margin: 1, width: 256 });
  } catch {
    // A bad QR must not stop the receipt printing.
    return undefined;
  }
}

export async function buildRenderInput(
  ctx: TenantContext,
  template: PrintTemplate,
  order: RenderOrder | null,
  opts: { isReprint?: boolean; copies?: number; copyOf?: number } = {},
): Promise<RenderInput> {
  const [outlet, qrDataUrl] = await Promise.all([outletIdentity(ctx), qrForTemplate(template)]);
  return { template, outlet, order, qrDataUrl, ...opts };
}

/* -------------------------------------------------------------- enqueueing */

interface EnqueueArgs {
  ctx: TenantContext;
  printer: PrinterDoc;
  order: OrderDoc | null;
  /** what caused this — becomes part of the idempotency key */
  trigger: string;
  isReprint?: boolean;
  requestedBy?: string;
}

/**
 * Render now, store the result, print later.
 *
 * The rendered bytes are frozen into the job on purpose: a retry three hours
 * after a printer ran out of paper must produce the slip the kitchen was
 * originally sent, not one re-rendered against a menu that has since changed.
 */
export async function enqueueJob(args: EnqueueArgs): Promise<PrintJobView | null> {
  const { ctx, printer, order, trigger } = args;

  const template = await templateForPrinter(ctx, printer);
  const renderOrder = order ? await toRenderOrder(ctx, order) : sampleOrder();
  const input = await buildRenderInput(ctx, template, renderOrder, {
    isReprint: args.isReprint,
    copies: printer.copies,
  });

  const payload: PrintJobDoc["payload"] = {
    text: renderText(input),
    html: renderHtml(input),
    meta: { cols: charsFor(template), paperWidth: template.paperWidth, colorMode: template.colorMode },
  };
  // Only thermal targets can take raw bytes; a sheet printer goes via the driver.
  if (isThermal(template.paperWidth) && providerFor(printer.target).target !== "browser") {
    payload.escpos = toEscPos(input, { cutAfter: printer.cutAfter, openDrawer: printer.openDrawer }).toString("base64");
  }

  const idempotencyKey = args.isReprint
    ? `reprint:${randomUUID()}`
    : `${ctx.outletId}:${order ? String(order._id) : "test"}:${printer._id}:${trigger}`;

  try {
    const job = await PrintJobModel.create({
      brandId: ctx.brandId,
      outletId: ctx.outletId,
      printerId: String(printer._id),
      printerName: printer.name,
      station: printer.station,
      target: printer.target,
      docType: printer.docType,
      status: "queued",
      orderId: order ? String(order._id) : null,
      orderNumber: order ? order.orderNumber : null,
      payload,
      copies: printer.copies,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      nextAttemptAt: new Date(),
      idempotencyKey,
      isReprint: Boolean(args.isReprint),
      reprintOf: null,
      requestedBy: args.requestedBy ?? null,
    });
    return shapeJob(job);
  } catch (e) {
    // 11000 is the unique index doing its job: this order already fired this
    // printer for this trigger. Not an error.
    if ((e as { code?: number }).code === 11000) return null;
    throw e;
  }
}

/* ------------------------------------------------------------- auto-routing */

/**
 * An order reached a status. Fire every printer configured to care.
 *
 * This is what makes a kitchen ticket and a counter receipt appear together the
 * moment staff accept an order, with nobody pressing print.
 */
export async function autoPrintForOrder(ctx: TenantContext, order: OrderDoc, status: OrderStatus): Promise<number> {
  const printers = await PrinterModel.find(tenantFilter(ctx, { isActive: true, autoPrintOn: status }));

  let queued = 0;
  for (const printer of printers) {
    // An empty channel list means the printer takes every channel.
    if (printer.channels?.length && !printer.channels.includes(order.channel)) continue;
    try {
      const job = await enqueueJob({ ctx, printer, order, trigger: `auto:${status}` });
      if (job) queued++;
    } catch (e) {
      // One misconfigured printer must never block the others, or the order.
      logger.error({ err: e, printerId: String(printer._id), orderId: String(order._id) }, "auto-print enqueue failed");
    }
  }
  return queued;
}

/* -------------------------------------------------------------- job queries */

export async function listJobs(
  ctx: TenantContext,
  opts: { status?: string; orderId?: string; limit?: number } = {},
) {
  const filter: Record<string, unknown> = {};
  if (opts.status) filter.status = opts.status;
  if (opts.orderId) filter.orderId = opts.orderId;

  const jobs = await PrintJobModel.find(tenantFilter(ctx, filter))
    .sort({ createdAt: -1 })
    .limit(Math.min(opts.limit ?? 60, 200));
  return jobs.map(shapeJob);
}

/** The per-order badge in the orders list: did this order actually print? */
export async function printStatusForOrders(ctx: TenantContext, orderIds: string[]) {
  if (!orderIds.length) return {};
  const jobs = await PrintJobModel.find(tenantFilter(ctx, { orderId: { $in: orderIds } }))
    .select("orderId status station")
    .lean();

  const byOrder: Record<string, { printed: number; failed: number; pending: number; total: number }> = {};
  for (const j of jobs) {
    const id = j.orderId!;
    const e = (byOrder[id] ??= { printed: 0, failed: 0, pending: 0, total: 0 });
    e.total++;
    if (j.status === "printed") e.printed++;
    else if (j.status === "failed") e.failed++;
    else if (j.status === "queued" || j.status === "printing") e.pending++;
  }
  return byOrder;
}

export async function getJobDoc(ctx: TenantContext, id: string) {
  const job = await PrintJobModel.findOne(tenantFilter(ctx, { _id: id }));
  if (!job) throw new HttpError(404, "Print job not found");
  return job;
}

/* -------------------------------------------------------- claim / complete */

/**
 * A client on site takes jobs it can execute. Claiming is a single atomic
 * update so two open admin tabs can never print the same ticket twice.
 */
export async function claimJobs(
  ctx: TenantContext,
  opts: { targets: PrintTarget[]; claimedBy: string; agentId?: string; limit?: number },
): Promise<PrintJobDocument[]> {
  const limit = Math.min(opts.limit ?? 5, 20);
  const claimed: PrintJobDocument[] = [];
  // Jobs released because they belong to a different agent. Without this the
  // loop would re-claim the one it just put back and never reach the next job.
  const skipped: string[] = [];

  for (let i = 0; i < limit; i++) {
    const filter: Record<string, unknown> = {
      brandId: ctx.brandId,
      outletId: ctx.outletId,
      status: "queued",
      target: { $in: opts.targets },
      nextAttemptAt: { $lte: new Date() },
    };
    if (skipped.length) filter._id = { $nin: skipped };

    const job = await PrintJobModel.findOneAndUpdate(
      filter,
      { $set: { status: "printing", claimedBy: opts.claimedBy, claimedAt: new Date() } },
      { new: true, sort: { createdAt: 1 } },
    );
    if (!job) break;

    // An agent only prints its own printers.
    if (opts.agentId) {
      const printer = await PrinterModel.findOne(tenantFilter(ctx, { _id: job.printerId }));
      if (printer && printer.connection.agentId !== opts.agentId) {
        job.status = "queued";
        job.claimedBy = null;
        job.claimedAt = null;
        await job.save();
        skipped.push(String(job._id));
        continue;
      }
    }
    claimed.push(job);
  }
  return claimed;
}

/**
 * The client reports back. Success is terminal; failure goes back onto the retry
 * ladder until the attempts run out, then waits for a human.
 */
export async function completeJob(
  ctx: TenantContext,
  id: string,
  result: { ok: boolean; error?: string; ms?: number; by?: string },
): Promise<PrintJobView> {
  const job = await getJobDoc(ctx, id);

  job.attemptCount += 1;
  job.attempts.push({
    at: new Date(),
    ok: result.ok,
    error: result.error?.slice(0, 400),
    ms: result.ms,
    by: result.by,
  });
  job.claimedBy = null;
  job.claimedAt = null;

  if (result.ok) {
    job.status = "printed";
    job.printedAt = new Date();
    job.lastError = null;
    job.nextAttemptAt = null;
    await PrinterModel.updateOne(
      tenantFilter(ctx, { _id: job.printerId }),
      { $set: { lastOkAt: new Date(), lastError: null } },
    );
  } else {
    job.lastError = result.error?.slice(0, 400) ?? "Printing failed";
    if (job.attemptCount >= job.maxAttempts) {
      // Out of automatic retries. It stays visible in the queue with a Retry
      // button — someone has to load paper or fix the network.
      job.status = "failed";
      job.nextAttemptAt = null;
    } else {
      job.status = "queued";
      job.nextAttemptAt = new Date(Date.now() + nextRetryDelaySec(job.attemptCount) * 1000);
    }
    await PrinterModel.updateOne(
      tenantFilter(ctx, { _id: job.printerId }),
      { $set: { lastErrorAt: new Date(), lastError: job.lastError } },
    );
  }

  await job.save();
  const view = shapeJob(job);
  // The Orders table's print badge updates itself as jobs succeed or fail.
  broadcast(ctx.outletId!, { type: "print.updated", job: view });
  return view;
}

/** Manual "try again" — resets the ladder so a fixed printer gets a fair run. */
export async function retryJob(ctx: TenantContext, id: string, by?: string): Promise<PrintJobView> {
  const job = await getJobDoc(ctx, id);
  if (job.status === "printed") throw new HttpError(409, "That job already printed. Use Print again instead.");

  job.status = "queued";
  job.attemptCount = 0;
  job.maxAttempts = DEFAULT_MAX_ATTEMPTS;
  job.lastError = null;
  job.nextAttemptAt = new Date();
  job.claimedBy = null;
  job.claimedAt = null;
  job.requestedBy = by ?? job.requestedBy;
  await job.save();
  return shapeJob(job);
}

export async function cancelJob(ctx: TenantContext, id: string): Promise<PrintJobView> {
  const job = await getJobDoc(ctx, id);
  if (job.status === "printed") throw new HttpError(409, "That job already printed");
  job.status = "cancelled";
  job.nextAttemptAt = null;
  await job.save();
  return shapeJob(job);
}

/**
 * Print again — for the slip that tore, smudged, or never made it off the
 * counter. Always a NEW job, so the original stays in the audit trail and the
 * reprint is marked as one on the paper.
 */
export async function reprintJob(ctx: TenantContext, id: string, by?: string): Promise<PrintJobView> {
  const original = await getJobDoc(ctx, id);
  const printer = await PrinterModel.findOne(tenantFilter(ctx, { _id: original.printerId }));
  if (!printer) throw new HttpError(409, "That printer no longer exists. Pick another printer to reprint on.");

  const order = original.orderId
    ? await OrderModel.findOne(tenantFilter(ctx, { _id: original.orderId }))
    : null;

  const job = await enqueueJob({
    ctx,
    printer,
    order: order ? (order.toObject() as OrderDoc) : null,
    trigger: "reprint",
    isReprint: true,
    requestedBy: by,
  });
  if (!job) throw new HttpError(500, "Could not queue the reprint");

  await PrintJobModel.updateOne(tenantFilter(ctx, { _id: job.id }), { $set: { reprintOf: String(original._id) } });
  return { ...job, reprintOf: String(original._id) };
}

/** Print an order on a chosen printer, on demand. */
export async function printOrder(
  ctx: TenantContext,
  orderId: string,
  printerId: string,
  by?: string,
): Promise<PrintJobView> {
  const order = await OrderModel.findOne(tenantFilter(ctx, { _id: orderId }));
  if (!order) throw new HttpError(404, "Order not found");
  const printer = await getPrinterDoc(ctx, printerId);

  const job = await enqueueJob({
    ctx,
    printer,
    order: order.toObject() as OrderDoc,
    // A manual print is always allowed, even if this order already auto-printed.
    trigger: `manual:${randomUUID()}`,
    requestedBy: by,
  });
  if (!job) throw new HttpError(500, "Could not queue the job");
  return job;
}

/** A sample slip, to prove the printer works before service starts. */
export async function testPrint(ctx: TenantContext, printerId: string, by?: string): Promise<PrintJobView> {
  const printer = await getPrinterDoc(ctx, printerId);
  const job = await enqueueJob({
    ctx,
    printer,
    order: null,
    trigger: `test:${randomUUID()}`,
    requestedBy: by,
  });
  if (!job) throw new HttpError(500, "Could not queue the test print");
  return job;
}

/* -------------------------------------------------------------- dispatcher */

const STALE_CLAIM_MS = 90_000;

/**
 * Push a batch of `cloud` jobs and rescue anything a client claimed and then
 * died holding. Pull targets are not touched here — their clients come to us.
 */
export async function dispatchDue(limit = 10): Promise<{ pushed: number; recovered: number }> {
  const recovered = await sweepStaleClaims();

  const due = await PrintJobModel.find({
    status: "queued",
    target: "cloud",
    nextAttemptAt: { $lte: new Date() },
  })
    .sort({ createdAt: 1 })
    .limit(limit)
    .setOptions({ allowGlobalQuery: true });

  let pushed = 0;
  for (const job of due) {
    const ctx: TenantContext = { brandId: job.brandId, outletId: job.outletId };
    const printer = await PrinterModel.findOne(tenantFilter(ctx, { _id: job.printerId }));
    if (!printer) {
      await completeJob(ctx, String(job._id), { ok: false, error: "Printer no longer exists" });
      continue;
    }

    const provider = providerFor(job.target);
    const configError = provider.configError(printer);
    if (configError || !provider.send) {
      await completeJob(ctx, String(job._id), { ok: false, error: configError ?? "No sender for this target" });
      continue;
    }

    const started = Date.now();
    const claimed = await PrintJobModel.findOneAndUpdate(
      { _id: job._id, status: "queued" },
      { $set: { status: "printing", claimedBy: "server", claimedAt: new Date() } },
      { new: true },
    ).setOptions({ allowGlobalQuery: true });
    if (!claimed) continue; // another worker took it

    // A provider that throws instead of returning must not take down the tick
    // and leave every other job stuck behind it.
    const result = await provider
      .send(claimed, printer)
      .catch((err: Error) => ({ ok: false, error: err.message }));

    await completeJob(ctx, String(job._id), { ...result, ms: Date.now() - started, by: "server" });
    if (result.ok) pushed++;
  }

  return { pushed, recovered };
}

/** A browser tab closed mid-print leaves a job stuck in `printing`. Free it. */
export async function sweepStaleClaims(): Promise<number> {
  const res = await PrintJobModel.updateMany(
    { status: "printing", claimedAt: { $lt: new Date(Date.now() - STALE_CLAIM_MS) } },
    { $set: { status: "queued", claimedBy: null, claimedAt: null } },
  ).setOptions({ allowGlobalQuery: true });
  return res.modifiedCount ?? 0;
}
