import { Router } from "express";
import { z } from "zod";
import {
  alignSchema,
  colorModeSchema,
  paperWidthSchema,
  printBlockSchema,
  printDocSchema,
  printJobStatusSchema,
  printStationSchema,
  printTargetSchema,
  PRINT_TARGETS,
  sizeSchema,
                   
} from "@onetap/config-schema";
import { PrinterModel, tenantFilter } from "@onetap/db";
import { requireOutletContext, requireUser } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/error.js";
import { agentToken, verifyAgentToken } from "./agent-auth.js";
import {
  buildRenderInput,
  cancelJob,
  claimJobs,
  completeJob,
  createPrinter,
  createTemplate,
  deletePrinter,
  deleteTemplate,
  ensureDefaultTemplates,
  listJobs,
  listPrinters,
  listTemplates,
  printOrder,
  printStatusForOrders,
  reprintJob,
  retryJob,
  sampleOrder,
  shapeJob,
  templateForPrinter,
  testPrint,
  updatePrinter,
  updateTemplate,
} from "./printing.service.js";
import { renderHtml, renderText } from "./render.js";

export const printingRouter         = Router();

/* ---------------------------------------------------------------- printers */

const connectionBody = z.object({
  host: z.string().max(120).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  useTls: z.boolean().optional(),
  deviceId: z.string().max(60).optional(),
  cloudPrinterId: z.string().max(120).optional(),
  cloudApiKey: z.string().max(400).optional(),
  agentId: z.string().max(120).optional(),
  queueName: z.string().max(120).optional(),
});

const printerBody = z.object({
  name: z.string().min(1).max(60),
  station: printStationSchema,
  docType: printDocSchema,
  target: printTargetSchema,
  paperWidth: paperWidthSchema,
  templateId: z.string().nullable().optional(),
  connection: connectionBody.optional(),
  autoPrintOn: z.array(z.string()).max(10).optional(),
  channels: z.array(z.string()).max(10).optional(),
  copies: z.number().int().min(1).max(5).optional(),
  cutAfter: z.boolean().optional(),
  openDrawer: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

printingRouter.get("/printers", async (req, res) => {
  const ctx = await requireOutletContext(req, "printer:read");
  res.json({ printers: await listPrinters(ctx) });
});

printingRouter.post("/printers", async (req, res) => {
  const ctx = await requireOutletContext(req, "printer:manage");
  res.status(201).json({ printer: await createPrinter(ctx, printerBody.parse(req.body)) });
});

printingRouter.patch("/printers/:id", async (req, res) => {
  const ctx = await requireOutletContext(req, "printer:manage");
  res.json({ printer: await updatePrinter(ctx, req.params.id, printerBody.partial().parse(req.body)) });
});

printingRouter.delete("/printers/:id", async (req, res) => {
  const ctx = await requireOutletContext(req, "printer:manage");
  await deletePrinter(ctx, req.params.id);
  res.status(204).end();
});

/** Queue a sample slip so staff can confirm the printer works before a rush. */
printingRouter.post("/printers/:id/test", async (req, res) => {
  const ctx = await requireOutletContext(req, "print:job");
  const user = requireUser(req);
  res.status(201).json({ job: await testPrint(ctx, req.params.id, String(user._id)) });
});

/** The credential to paste into the print agent's installer. Shown on demand. */
printingRouter.get("/printers/:id/agent-token", async (req, res) => {
  const ctx = await requireOutletContext(req, "printer:manage");
  const printer = await PrinterModel.findOne(tenantFilter(ctx, { _id: req.params.id }));
  if (!printer) throw new HttpError(404, "Printer not found");
  if (!printer.connection.agentId) throw new HttpError(409, "Give this printer an agent id first");
  res.json({ token: agentToken(ctx.outletId , printer.connection.agentId), agentId: printer.connection.agentId });
});

/* --------------------------------------------------------------- templates */

const blockBody = z.object({
  key: printBlockSchema,
  enabled: z.boolean().default(true),
  align: alignSchema.default("left"),
  size: sizeSchema.default("md"),
  bold: z.boolean().default(false),
  rule: z.boolean().default(false),
  text: z.string().max(400).default(""),
});

const templateBody = z.object({
  name: z.string().min(1).max(60),
  docType: printDocSchema,
  paperWidth: paperWidthSchema.optional(),
  colorMode: colorModeSchema.optional(),
  logoUrl: z.string().max(2000).optional(),
  logoWidthPct: z.number().int().min(10).max(100).optional(),
  logoThreshold: z.number().int().min(1).max(254).optional(),
  logoRaster: z
    .object({
      width: z.number().int().min(8).max(2048),
      height: z.number().int().min(8).max(2048),
      data: z.string().max(400_000),
    })
    .nullable()
    .optional(),
  blocks: z.array(blockBody).max(40).optional(),
  charsPerLine: z.number().int().min(20).max(120).nullable().optional(),
  feedLines: z.number().int().min(0).max(10).optional(),
});

printingRouter.get("/templates", async (req, res) => {
  const ctx = await requireOutletContext(req, "printer:read");
  await ensureDefaultTemplates(ctx);
  res.json({ templates: await listTemplates(ctx) });
});

printingRouter.post("/templates", async (req, res) => {
  const ctx = await requireOutletContext(req, "printer:manage");
  res.status(201).json({ template: await createTemplate(ctx, templateBody.parse(req.body)) });
});

printingRouter.patch("/templates/:id", async (req, res) => {
  const ctx = await requireOutletContext(req, "printer:manage");
  res.json({ template: await updateTemplate(ctx, req.params.id, templateBody.partial().parse(req.body)) });
});

printingRouter.delete("/templates/:id", async (req, res) => {
  const ctx = await requireOutletContext(req, "printer:manage");
  await deleteTemplate(ctx, req.params.id);
  res.status(204).end();
});

/**
 * Render a template without printing it. Powers the live preview in the template
 * editor — the same renderer the queue uses, so what you see is what tears off.
 */
const previewBody = z.object({
  template: templateBody.extend({ id: z.string().optional() }),
  orderId: z.string().optional(),
  isReprint: z.boolean().optional(),
});

printingRouter.post("/preview", async (req, res) => {
  const ctx = await requireOutletContext(req, "printer:read");
  const body = previewBody.parse(req.body);

  const { printTemplateSchema } = await import("@onetap/config-schema");
  const template = printTemplateSchema.parse({ id: "preview", ...body.template });

  const input = await buildRenderInput(ctx, template, sampleOrder(), { isReprint: body.isReprint });
  res.json({ html: renderHtml(input), text: renderText(input) });
});

/* -------------------------------------------------------------------- jobs */

printingRouter.get("/jobs", async (req, res) => {
  const ctx = await requireOutletContext(req, "printer:read");
  const status = req.query.status;
  res.json({
    jobs: await listJobs(ctx, {
      status: typeof status === "string" && status ? printJobStatusSchema.parse(status) : undefined,
      orderId: typeof req.query.orderId === "string" ? req.query.orderId : undefined,
      limit: Number(req.query.limit) || 60,
    }),
  });
});

/** Print-status badges for a page of orders, in one round trip. */
printingRouter.get("/jobs/by-order", async (req, res) => {
  const ctx = await requireOutletContext(req, "printer:read");
  const ids = typeof req.query.ids === "string" ? req.query.ids.split(",").filter(Boolean).slice(0, 100) : [];
  res.json({ status: await printStatusForOrders(ctx, ids) });
});

printingRouter.post("/jobs/:id/retry", async (req, res) => {
  const ctx = await requireOutletContext(req, "print:job");
  const user = requireUser(req);
  res.json({ job: await retryJob(ctx, req.params.id, String(user._id)) });
});

printingRouter.post("/jobs/:id/reprint", async (req, res) => {
  const ctx = await requireOutletContext(req, "print:job");
  const user = requireUser(req);
  res.status(201).json({ job: await reprintJob(ctx, req.params.id, String(user._id)) });
});

printingRouter.post("/jobs/:id/cancel", async (req, res) => {
  const ctx = await requireOutletContext(req, "print:job");
  res.json({ job: await cancelJob(ctx, req.params.id) });
});

/** Print an existing order on a chosen printer. */
printingRouter.post("/orders/:orderId/print", async (req, res) => {
  const ctx = await requireOutletContext(req, "print:job");
  const user = requireUser(req);
  const { printerId } = z.object({ printerId: z.string().min(1) }).parse(req.body);
  res.status(201).json({ job: await printOrder(ctx, req.params.orderId, printerId, String(user._id)) });
});

/* ------------------------------------------------- pull clients (in-browser) */

const claimBody = z.object({
  targets: z.array(printTargetSchema).min(1).default(["browser"]),
  clientId: z.string().min(1).max(80),
  limit: z.number().int().min(1).max(20).optional(),
});

/**
 * The admin tab asks for work it can execute. Only browser and ePOS targets are
 * offered here — an agent has its own authenticated endpoint below.
 */
printingRouter.post("/jobs/claim", async (req, res) => {
  const ctx = await requireOutletContext(req, "print:job");
  const body = claimBody.parse(req.body);

  const allowed                = body.targets.filter((t) => t === "browser" || t === "epos-lan");
  if (!allowed.length) throw new HttpError(400, "A browser can only run browser and epos-lan jobs");

  const jobs = await claimJobs(ctx, { targets: allowed, claimedBy: body.clientId, limit: body.limit });

  // Pull clients need the rendered document, not just the metadata.
  res.json({
    jobs: jobs.map((j) => ({
      ...shapeJob(j),
      html: j.payload.html,
      escpos: j.payload.escpos ?? null,
      connection: null           ,
    })),
  });
});

const resultBody = z.object({
  ok: z.boolean(),
  error: z.string().max(400).optional(),
  ms: z.number().int().min(0).max(600_000).optional(),
});

printingRouter.post("/jobs/:id/result", async (req, res) => {
  const ctx = await requireOutletContext(req, "print:job");
  const user = requireUser(req);
  const body = resultBody.parse(req.body);
  res.json({ job: await completeJob(ctx, req.params.id, { ...body, by: String(user._id) }) });
});

/**
 * An ePOS client needs the printer's address to POST to. It is deliberately a
 * separate call from claiming, and never includes the cloud API key.
 */
printingRouter.get("/printers/:id/endpoint", async (req, res) => {
  const ctx = await requireOutletContext(req, "print:job");
  const printer = await PrinterModel.findOne(tenantFilter(ctx, { _id: req.params.id }));
  if (!printer) throw new HttpError(404, "Printer not found");
  if (printer.target !== "epos-lan") throw new HttpError(409, "That printer isn't an ePOS printer");

  const { host, port, useTls, deviceId } = printer.connection;
  res.json({
    url: `${useTls ? "https" : "http"}://${host}:${port}/cgi-bin/epos/service.cgi?devid=${encodeURIComponent(deviceId || "local_printer")}&timeout=10000`,
    deviceId: deviceId || "local_printer",
  });
});

/* ------------------------------------------------------------- print agent */

/** The agent authenticates with its own signed token, not a staff session. */
async function agentContext(req                           ) {
  const header = req.header("x-onetap-agent");
  if (!header) throw new HttpError(401, "Missing agent token");
  return verifyAgentToken(header);
}

printingRouter.get("/agent/jobs", async (req, res) => {
  const { ctx, agentId } = await agentContext(req);
  const jobs = await claimJobs(ctx, {
    targets: ["agent"],
    claimedBy: `agent:${agentId}`,
    agentId,
    limit: Number(req.query.limit) || 5,
  });

  res.json({
    jobs: jobs.map((j) => ({
      id: String(j._id),
      docType: j.docType,
      copies: j.copies,
      // The agent prints raw bytes where we have them, otherwise the HTML.
      escpos: j.payload.escpos ?? null,
      html: j.payload.escpos ? null : j.payload.html,
      queueName: null                 ,
    })),
  });
});

printingRouter.post("/agent/jobs/:id/result", async (req, res) => {
  const { ctx, agentId } = await agentContext(req);
  const body = resultBody.parse(req.body);
  res.json({ job: await completeJob(ctx, req.params.id, { ...body, by: `agent:${agentId}` }) });
});

/** What the admin shows in the "how do I connect this" panel. */
printingRouter.get("/targets", (_req, res) => {
  res.json({ targets: PRINT_TARGETS });
});

/* -------------------------------------------------------- resolved template */

/** Which template a given printer will actually use, after all the fallbacks. */
printingRouter.get("/printers/:id/template", async (req, res) => {
  const ctx = await requireOutletContext(req, "printer:read");
  const printer = await PrinterModel.findOne(tenantFilter(ctx, { _id: req.params.id }));
  if (!printer) throw new HttpError(404, "Printer not found");
  res.json({ template: await templateForPrinter(ctx, printer) });
});
