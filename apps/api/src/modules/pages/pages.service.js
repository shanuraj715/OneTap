import { slugFromTitle, starterPages, storePageSchema } from "@rasoipulse/config-schema";
import { OutletModel, StorePageModel, tenantFilter } from "@rasoipulse/db";
import { HttpError } from "../../middleware/error.js";
import { cache } from "../cache/cache.js";
import { outletBrand } from "../outlets/outlet-cache.js";

/**
 * A store's own storefront pages (About us, Contact, policies…), one set per outlet.
 *
 * The dashboard reads and writes them fresh. What visitors see is the outlet's PUBLISHED pages, read once and
 * kept in the API's cache (key `pages:<outlet>`); saving any page drops it at once (see cache/invalidation.js).
 */

const OBJECT_ID = /^[0-9a-f]{24}$/i;

/** A page as the API sends it. The list leaves the (long) blocks out and says how many there are. */
function shape(page, { blocks = true } = {}) {
  return {
    id: String(page._id),
    slug: page.slug,
    title: page.title,
    status: page.status,
    description: page.description ?? "",
    showInHeader: Boolean(page.showInHeader),
    showInFooter: Boolean(page.showInFooter),
    sortOrder: page.sortOrder ?? 0,
    updatedAt: page.updatedAt,
    ...(blocks ? { blocks: page.blocks ?? [] } : { blockCount: (page.blocks ?? []).length }),
  };
}

/** Validate with the shared schema, and turn the first problem into a plain sentence the owner can act on. */
function parsePage(input) {
  const result = storePageSchema.safeParse(input);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const where = issue.path[0] === "blocks" && typeof issue.path[1] === "number" ? ` (block ${issue.path[1] + 1})` : "";
  throw new HttpError(400, `${issue.message}${where}`);
}

async function nextSortOrder(ctx) {
  const last = await StorePageModel.findOne(tenantFilter(ctx)).sort({ sortOrder: -1 }).select("sortOrder").lean();
  return (last?.sortOrder ?? -1) + 1;
}

async function assertSlugFree(ctx, slug, exceptId) {
  const taken = await StorePageModel.exists(tenantFilter(ctx, { slug, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }));
  if (taken) throw new HttpError(409, "Another page already uses that address.");
}

async function load(ctx, id) {
  if (!OBJECT_ID.test(String(id))) throw new HttpError(404, "Page not found");
  const page = await StorePageModel.findOne(tenantFilter(ctx, { _id: id }));
  if (!page) throw new HttpError(404, "Page not found");
  return page;
}

/* ---------------------------------------------------------------- dashboard */

/** Every page of the outlet, drafts included, in the order they appear in the menu and footer. */
export async function listPages(ctx) {
  const pages = await StorePageModel.find(tenantFilter(ctx)).sort({ sortOrder: 1, createdAt: 1 }).lean();
  return pages.map((p) => shape(p, { blocks: false }));
}

export async function getPage(ctx, id) {
  return shape(await load(ctx, id));
}

export async function createPage(ctx, input, userId) {
  const data = parsePage({ ...input, slug: input.slug || slugFromTitle(input.title) });
  await assertSlugFree(ctx, data.slug);
  const page = await StorePageModel.create({ ...data, brandId: ctx.brandId, outletId: ctx.outletId, sortOrder: await nextSortOrder(ctx), updatedBy: userId });
  return shape(page.toObject());
}

/** Change some fields of a page. The result is validated as a whole, so a half-edit can't leave a broken page. */
export async function updatePage(ctx, id, patch, userId) {
  const page = await load(ctx, id);
  const merged = parsePage({
    title: page.title,
    slug: page.slug,
    status: page.status,
    description: page.description,
    showInHeader: page.showInHeader,
    showInFooter: page.showInFooter,
    blocks: page.blocks,
    ...patch,
  });
  if (merged.slug !== page.slug) await assertSlugFree(ctx, merged.slug, page._id);
  Object.assign(page, merged, { updatedBy: userId });
  page.markModified("blocks");
  await page.save();
  return shape(page.toObject());
}

export async function deletePage(ctx, id) {
  const page = await load(ctx, id);
  // scoped by store and outlet like every other query on a store's data
  await StorePageModel.deleteOne(tenantFilter(ctx, { _id: page._id }));
}

/** Put the pages in this order (the ids listed), for the menu and footer links. Anything not listed keeps its place after them. */
export async function reorderPages(ctx, ids) {
  const wanted = ids.filter((id) => OBJECT_ID.test(String(id)));
  await Promise.all(wanted.map((id, i) => StorePageModel.updateOne(tenantFilter(ctx, { _id: id }), { $set: { sortOrder: i } })));
  return listPages(ctx);
}

/**
 * Create the ready-made pages this outlet doesn't have yet (About us, Contact, Gallery, FAQ, policies) — all as
 * DRAFTS, so nothing goes live until the owner has read it. Pages already there are left exactly as they are.
 */
export async function createStarterPages(ctx, userId) {
  const outlet = await OutletModel.findOne({ _id: ctx.outletId }, null, { allowGlobalQuery: true }).select("name config.identity.name").lean();
  const name = outlet?.config?.identity?.name || outlet?.name;
  const have = new Set((await StorePageModel.find(tenantFilter(ctx)).select("slug").lean()).map((p) => p.slug));
  let order = await nextSortOrder(ctx);
  const created = [];
  for (const starter of starterPages({ name })) {
    if (have.has(starter.slug)) continue;
    const data = parsePage({ ...starter, status: "draft" });
    await StorePageModel.create({ ...data, brandId: ctx.brandId, outletId: ctx.outletId, sortOrder: order++, updatedBy: userId });
    created.push(starter.slug);
  }
  return { created, pages: await listPages(ctx) };
}

/* ------------------------------------------------------------------- public */

/**
 * An outlet's published pages (with their blocks) — what the storefront shows. `null` for an unknown outlet.
 * Cached; dropped the moment any of the outlet's pages is saved.
 */
export function publishedPages(outletId) {
  const id = String(outletId ?? "").toLowerCase();
  if (!OBJECT_ID.test(id)) return Promise.resolve(null);
  return cache.wrap(
    `pages:${id}`,
    async () => {
      const ref = await outletBrand(id);
      if (!ref) return null;
      const pages = await StorePageModel.find(tenantFilter(ref, { status: "published" })).sort({ sortOrder: 1, createdAt: 1 }).lean();
      return { brandId: ref.brandId, pages: pages.map((p) => shape(p)) };
    },
    { cacheNull: false, tags: (found) => (found ? [`brand:${found.brandId}`, `pages:${id}`, "ns:pages"] : []) },
  );
}
