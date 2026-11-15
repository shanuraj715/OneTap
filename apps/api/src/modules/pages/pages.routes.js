import { Router } from "express";
import { z } from "zod";
import { requireOutletContext, requireUser } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/error.js";
import { createPage, createStarterPages, deletePage, getPage, listPages, publishedPages, reorderPages, updatePage } from "./pages.service.js";

export const pagesRouter = Router();

/* ------------------------------------------------------------------- public */

const outletIdOf = (req) => {
  const id = typeof req.query.outletId === "string" ? req.query.outletId : "";
  if (!id) throw new HttpError(400, "outletId is required");
  return id;
};

/** The links: every published page of the outlet (title, address, where it is linked) — without the page bodies. */
pagesRouter.get("/public", async (req, res) => {
  const found = await publishedPages(outletIdOf(req));
  if (!found) throw new HttpError(404, "Outlet not found");
  res.json({ pages: found.pages.map(({ blocks: _blocks, ...link }) => link) });
});

/** One published page, with its blocks. */
pagesRouter.get("/public/:slug", async (req, res) => {
  const found = await publishedPages(outletIdOf(req));
  if (!found) throw new HttpError(404, "Outlet not found");
  const page = found.pages.find((p) => p.slug === String(req.params.slug).toLowerCase());
  if (!page) throw new HttpError(404, "Page not found");
  res.json({ page });
});

/* ---------------------------------------------------------------- dashboard */

pagesRouter.get("/", async (req, res) => {
  const ctx = await requireOutletContext(req, "page:manage");
  res.json({ pages: await listPages(ctx) });
});

/** Create the ready-made pages the outlet doesn't have yet — as drafts. */
pagesRouter.post("/starter", async (req, res) => {
  const ctx = await requireOutletContext(req, "page:manage");
  res.status(201).json(await createStarterPages(ctx, String(requireUser(req)._id)));
});

pagesRouter.put("/order", async (req, res) => {
  const ctx = await requireOutletContext(req, "page:manage");
  const { ids } = z.object({ ids: z.array(z.string()).max(100) }).parse(req.body);
  res.json({ pages: await reorderPages(ctx, ids) });
});

/** The body is checked as a whole page by the service (the shared schema), so it can be any partial page here. */
const pageBody = z.record(z.string(), z.unknown());

pagesRouter.post("/", async (req, res) => {
  const ctx = await requireOutletContext(req, "page:manage");
  res.status(201).json({ page: await createPage(ctx, pageBody.parse(req.body ?? {}), String(requireUser(req)._id)) });
});

pagesRouter.get("/:id", async (req, res) => {
  const ctx = await requireOutletContext(req, "page:manage");
  res.json({ page: await getPage(ctx, req.params.id) });
});

pagesRouter.patch("/:id", async (req, res) => {
  const ctx = await requireOutletContext(req, "page:manage");
  res.json({ page: await updatePage(ctx, req.params.id, pageBody.parse(req.body ?? {}), String(requireUser(req)._id)) });
});

pagesRouter.delete("/:id", async (req, res) => {
  const ctx = await requireOutletContext(req, "page:manage");
  await deletePage(ctx, req.params.id);
  res.status(204).end();
});
