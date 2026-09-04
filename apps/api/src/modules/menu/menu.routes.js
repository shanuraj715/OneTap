import { Router,              } from "express";
import { z } from "zod";
import { OutletModel,                    } from "@onetap/db";
import { requireOutletContext } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/error.js";
import {
  createCategory,
  createItem,
  createModifierGroup,
  deleteCategory,
  deleteItem,
  deleteModifierGroup,
  getMenu,
  updateCategory,
  updateItem,
  updateModifierGroup,
} from "./menu.service.js";

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

  const outlet = await OutletModel.findOne({ _id: outletId }, null, { allowGlobalQuery: true }).lean();
  if (!outlet) throw new HttpError(404, "Outlet not found");
  return { brandId: outlet.brandId, outletId: String(outlet._id) };
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

const categoryBody = z.object({
  name: z.string().min(1),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

menuRouter.post("/categories", async (req, res) => {
  const body = categoryBody.parse(req.body);
  res.status(201).json({ category: await createCategory(await writeContext(req), body) });
});

menuRouter.patch("/categories/:id", async (req, res) => {
  const body = categoryBody.partial().parse(req.body);
  res.json({ category: await updateCategory(await writeContext(req), req.params.id, body) });
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

const itemBody = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  foodType: z.enum(["veg", "non-veg", "egg"]).optional(),
  tags: z.array(z.string()).optional(),
  basePrice: z.number().int().nonnegative().optional(),
  variants: z.array(variantBody).optional(),
  modifierGroupIds: z.array(z.string()).optional(),
  gstRatePct: z.number().nonnegative().optional(),
  isAvailable: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

menuRouter.post("/items", async (req, res) => {
  const body = itemBody.parse(req.body);
  res.status(201).json({ item: await createItem(await writeContext(req), body) });
});

menuRouter.patch("/items/:id", async (req, res) => {
  const body = itemBody.partial().parse(req.body);
  res.json({ item: await updateItem(await writeContext(req), req.params.id, body) });
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
