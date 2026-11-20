import { Router,              } from "express";
import { z } from "zod";
import { outletBrand } from "../outlets/outlet-cache.js";
import { requireOutletContext, requireSuperAdmin } from "../../middleware/auth.js";
import { generateItemImages } from "../ai/ai.service.js";
import { HttpError } from "../../middleware/error.js";
import {
  createCategory,
  createItem,
  createModifierGroup,
  createCategories,
  deleteCategories,
  deleteCategory,
  deleteItem,
  deleteItems,
  moveCategory,
  reorderCategories,
  deleteModifierGroup,
  getMenu,
  importMenu,
  updateCategory,
  updateItem,
  updateModifierGroup,
} from "./menu.service.js";
import { limiter } from "../../middleware/rate-limit.js";
import { AI_ASPECT_RATIO_IDS, AI_MAX_IMAGES_AT_ONCE, AI_MAX_PROMPT_LENGTH } from "@onetap/config-schema";
import { suggestionsFor } from "./suggestions.service.js";

export const menuRouter         = Router();

/**
 * Menu queries need both brandId and outletId. The admin supplies them as headers;
 * the public storefront passes ?outletId= and we look up its brand.
 */
async function menuContext(req         )                         {
  const outletId =
    (typeof req.query.outletId === "string" ? req.query.outletId : undefined) ??
    req.header("x-onetap-outlet") ??
    undefined;
  if (!outletId) throw new HttpError(400, "outletId is required");

  const ref = await outletBrand(outletId);
  if (!ref) throw new HttpError(404, "Outlet not found");
  return { brandId: ref.brandId, outletId: ref.outletId };
}

/** Writes require a signed-in user whose role grants menu:update on this outlet. */
async function writeContext(req         )                         {
  return requireOutletContext(req, "menu:update");
}

/* --------------------------------------------------------------------- read */

menuRouter.get("/", async (req, res) => {
  res.json(await getMenu(await menuContext(req)));
});

/* --------------------------------------------------------------- categories */

const categoryImageBody = z.object({
  url: z.string().min(1),
  key: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

const categoryBody = z.object({
  name: z.string().min(1),
  /** the category this one goes inside; null = top level */
  parentId: z.string().nullable().optional(),
  /** a picture for the category; null removes it */
  image: categoryImageBody.nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  /** where everything in it is made (kitchen / bar); null = follow the category it is inside */
  prepStation: z.enum(["kitchen", "bar"]).nullable().optional(),
  /** the hours everything in it can be ordered; null = same as the category it is inside */
  availability: z.any().optional(),
});

menuRouter.post("/categories", async (req, res) => {
  const body = categoryBody.parse(req.body);
  res.status(201).json({ category: await createCategory(await writeContext(req), body) });
});

menuRouter.patch("/categories/:id", async (req, res) => {
  const body = categoryBody.partial().parse(req.body);
  res.json({ category: await updateCategory(await writeContext(req), req.params.id, body) });
});

/** Several categories at once, each with its own name and optional picture, inside a parent or at the top level. */
menuRouter.post("/categories/bulk", async (req, res) => {
  const body = z
    .object({
      parentId: z.string().nullable().optional(),
      categories: z.array(z.object({ name: z.string().max(120), image: categoryImageBody.nullable().optional() })).min(1).max(200),
      isActive: z.boolean().optional(),
    })
    .parse(req.body);
  res.status(201).json({ categories: await createCategories(await writeContext(req), body) });
});

/** Delete several categories at once — and the sub-categories inside them. Refuses if they hold items unless `deleteItems`. */
menuRouter.post("/categories/bulk-delete", limiter("destructive"), async (req, res) => {
  const body = z.object({ ids: z.array(z.string().min(1)).min(1).max(200), deleteItems: z.boolean().optional() }).parse(req.body);
  res.json(await deleteCategories(await writeContext(req), body.ids, { deleteItems: body.deleteItems === true }));
});

/** Drag-and-drop: move a category inside another (or to the top level), just before a given sibling (or to the end). */
menuRouter.post("/categories/move", async (req, res) => {
  const body = z.object({ id: z.string().min(1), parentId: z.string().nullable().optional(), beforeId: z.string().nullable().optional() }).parse(req.body);
  res.json(await moveCategory(await writeContext(req), body.id, { parentId: body.parentId ?? null, beforeId: body.beforeId ?? null }));
});

/** Put the categories of one level in a new order (the ids are that level, top to bottom). */
menuRouter.post("/categories/order", async (req, res) => {
  const body = z.object({ ids: z.array(z.string().min(1)).min(1).max(500) }).parse(req.body);
  await reorderCategories(await writeContext(req), body.ids);
  res.status(204).end();
});

menuRouter.delete("/categories/:id", async (req, res) => {
  await deleteCategory(await writeContext(req), req.params.id);
  res.status(204).end();
});

/* -------------------------------------------------------------------- items */

const variantBody = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  price: z.number().int().nonnegative(),
});

const imageBody = z.object({
  url: z.string().min(1),
  key: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

const itemBody = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  foodType: z.enum(["veg", "non-veg", "egg"]).optional(),
  tags: z.array(z.string()).optional(),
  images: z.array(imageBody).max(6).optional(),
  basePrice: z.number().int().nonnegative().optional(),
  variants: z.array(variantBody).optional(),
  modifierGroupIds: z.array(z.string()).optional(),
  gstRatePct: z.number().nonnegative().optional(),
  isAvailable: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  /** where this dish is made (kitchen / bar); null = same as its category */
  prepStation: z.enum(["kitchen", "bar"]).nullable().optional(),
  /** counted stock ({ tracked, left, daily, lowAt }); null = not counted — checked in the service */
  stock: z.any().optional(),
  /** its own hours ({ windows }); null = its category's */
  availability: z.any().optional(),
  /** the dishes a combo is made of ({ items }); null = a plain dish */
  combo: z.any().optional(),
  /** dishes suggested alongside it */
  pairsWith: z.array(z.string()).max(20).optional(),
});

/**
 * Public: what to suggest to someone with these dishes in their cart ("goes well with your order") — the dishes the
 * owner chose, then what other customers often ordered with them. Only dishes that can be ordered right now.
 */
menuRouter.post("/suggestions", limiter("public-compute"), async (req, res) => {
  const body = z.object({ outletId: z.string().min(1), itemIds: z.array(z.string()).max(60).default([]) }).parse(req.body);
  const ref = await outletBrand(body.outletId);
  if (!ref) throw new HttpError(404, "Outlet not found");
  res.json(await suggestionsFor({ brandId: ref.brandId, outletId: ref.outletId }, body.itemIds));
});

menuRouter.post("/items", async (req, res) => {
  const body = itemBody.parse(req.body);
  res.status(201).json({ item: await createItem(await writeContext(req), body) });
});

menuRouter.patch("/items/:id", async (req, res) => {
  const body = itemBody.partial().parse(req.body);
  res.json({ item: await updateItem(await writeContext(req), req.params.id, body) });
});

/** Delete several items at once. */
menuRouter.post("/items/bulk-delete", limiter("destructive"), async (req, res) => {
  const body = z.object({ ids: z.array(z.string().min(1)).min(1).max(500) }).parse(req.body);
  res.json(await deleteItems(await writeContext(req), body.ids));
});

/**
 * Make pictures of a dish with Gemini and add them to it. For the platform's super admin ONLY — a store owner never
 * sees the button and is refused here — because every picture is a paid call on the platform's own keys.
 */
menuRouter.post("/items/:id/generate-images", limiter("ai-images"), async (req, res) => {
  const admin = requireSuperAdmin(req);
  const ctx = await writeContext(req);
  const body = z
    .object({
      aspectRatio: z.enum(AI_ASPECT_RATIO_IDS),
      count: z.number().int().min(1).max(AI_MAX_IMAGES_AT_ONCE),
      prompt: z.string().max(AI_MAX_PROMPT_LENGTH).optional(),
    })
    .parse(req.body);
  res.json(await generateItemImages(ctx, req.params.id, body, String(admin._id)));
});

menuRouter.delete("/items/:id", async (req, res) => {
  await deleteItem(await writeContext(req), req.params.id);
  res.status(204).end();
});

/* ---------------------------------------------------------- modifier groups */

const groupBody = z.object({
  name: z.string().min(1),
  required: z.boolean().optional(),
  minSelect: z.number().int().nonnegative().optional(),
  maxSelect: z.number().int().positive().optional(),
  options: z
    .array(z.object({ id: z.string().optional(), label: z.string().min(1), priceDelta: z.number().int().optional() }))
    .optional(),
});

menuRouter.post("/modifier-groups", async (req, res) => {
  const body = groupBody.parse(req.body);
  res.status(201).json({ group: await createModifierGroup(await writeContext(req), body) });
});

menuRouter.patch("/modifier-groups/:id", async (req, res) => {
  const body = groupBody.partial().parse(req.body);
  res.json({ group: await updateModifierGroup(await writeContext(req), req.params.id, body) });
});

menuRouter.delete("/modifier-groups/:id", async (req, res) => {
  await deleteModifierGroup(await writeContext(req), req.params.id);
  res.status(204).end();
});

/* --------------------------------------------------------------- import menu */

const importBody = z.object({
  sourceOutletId: z.string().min(1),
  categoryIds: z.array(z.string()).optional(),
  itemIds: z.array(z.string()).optional(),
  targetCategoryId: z.string().optional(),
});

menuRouter.post("/import", limiter("upload"), async (req, res) => {
  const body = importBody.parse(req.body);
  res.status(201).json(await importMenu(await writeContext(req), body));
});

