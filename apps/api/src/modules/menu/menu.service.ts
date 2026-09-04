import { randomUUID } from "node:crypto";
import type { Menu, MenuCategory, MenuItem, ModifierGroup } from "@onetap/config-schema";
import {
  MenuCategoryModel,
  MenuItemModel,
  ModifierGroupModel,
  tenantFilter,
  type TenantContext,
} from "@onetap/db";
import { HttpError } from "../../middleware/error";

/*
 * Menu documents live UNDER an outlet, so every query is scoped by both
 * brandId and outletId via tenantFilter — the tenant-scope plugin refuses
 * anything unscoped.
 */

/* ------------------------------------------------------------------ mapping */

const toCategory = (d: { _id: unknown; name: string; sortOrder: number; isActive: boolean }): MenuCategory => ({
  id: String(d._id),
  name: d.name,
  sortOrder: d.sortOrder,
  isActive: d.isActive,
});

const toItem = (d: Record<string, any>): MenuItem => ({
  id: String(d._id),
  categoryId: d.categoryId,
  name: d.name,
  description: d.description ?? "",
  foodType: d.foodType ?? "veg",
  tags: d.tags ?? [],
  basePrice: d.basePrice ?? 0,
  variants: (d.variants ?? []).map((v: any) => ({ id: v.id, label: v.label, price: v.price })),
  modifierGroupIds: d.modifierGroupIds ?? [],
  gstRatePct: d.gstRatePct ?? 5,
  isAvailable: d.isAvailable ?? true,
  sortOrder: d.sortOrder ?? 0,
});

const toGroup = (d: Record<string, any>): ModifierGroup => ({
  id: String(d._id),
  name: d.name,
  required: d.required ?? false,
  minSelect: d.minSelect ?? 0,
  maxSelect: d.maxSelect ?? 1,
  options: (d.options ?? []).map((o: any) => ({ id: o.id, label: o.label, priceDelta: o.priceDelta ?? 0 })),
});

/* --------------------------------------------------------------------- read */

export async function getMenu(ctx: TenantContext): Promise<Menu> {
  const [categories, items, modifierGroups] = await Promise.all([
    MenuCategoryModel.find(tenantFilter(ctx)).sort({ sortOrder: 1, name: 1 }).lean(),
    MenuItemModel.find(tenantFilter(ctx)).sort({ sortOrder: 1, name: 1 }).lean(),
    ModifierGroupModel.find(tenantFilter(ctx)).sort({ name: 1 }).lean(),
  ]);

  return {
    categories: categories.map(toCategory),
    items: items.map(toItem),
    modifierGroups: modifierGroups.map(toGroup),
  };
}

/* --------------------------------------------------------------- categories */

export async function createCategory(ctx: TenantContext, input: { name: string; sortOrder?: number }) {
  const doc = await MenuCategoryModel.create({
    brandId: ctx.brandId,
    outletId: ctx.outletId,
    name: input.name,
    sortOrder: input.sortOrder ?? 0,
  });
  return toCategory(doc.toObject());
}

export async function updateCategory(
  ctx: TenantContext,
  id: string,
  patch: Partial<{ name: string; sortOrder: number; isActive: boolean }>,
) {
  const doc = await MenuCategoryModel.findOneAndUpdate(tenantFilter(ctx, { _id: id }), patch, { new: true }).lean();
  if (!doc) throw new HttpError(404, "Category not found");
  return toCategory(doc);
}

export async function deleteCategory(ctx: TenantContext, id: string) {
  const itemCount = await MenuItemModel.countDocuments(tenantFilter(ctx, { categoryId: id }));
  if (itemCount > 0) {
    throw new HttpError(409, `Category still has ${itemCount} item(s). Move or delete them first.`);
  }
  const res = await MenuCategoryModel.deleteOne(tenantFilter(ctx, { _id: id }));
  if (res.deletedCount === 0) throw new HttpError(404, "Category not found");
}

/* -------------------------------------------------------------------- items */

type ItemInput = Partial<Omit<MenuItem, "id" | "variants">> & {
  variants?: { id?: string; label: string; price: number }[];
};

function normalizeVariants(variants: ItemInput["variants"]) {
  return (variants ?? []).map((v) => ({ id: v.id ?? randomUUID(), label: v.label, price: v.price }));
}

export async function createItem(ctx: TenantContext, input: ItemInput & { categoryId: string; name: string }) {
  const doc = await MenuItemModel.create({
    brandId: ctx.brandId,
    outletId: ctx.outletId,
    categoryId: input.categoryId,
    name: input.name,
    description: input.description ?? "",
    foodType: input.foodType ?? "veg",
    tags: input.tags ?? [],
    basePrice: input.basePrice ?? 0,
    variants: normalizeVariants(input.variants),
    modifierGroupIds: input.modifierGroupIds ?? [],
    gstRatePct: input.gstRatePct ?? 5,
    isAvailable: input.isAvailable ?? true,
    sortOrder: input.sortOrder ?? 0,
  });
  return toItem(doc.toObject());
}

export async function updateItem(ctx: TenantContext, id: string, patch: ItemInput) {
  const update: Record<string, unknown> = { ...patch };
  if (patch.variants) update.variants = normalizeVariants(patch.variants);

  const doc = await MenuItemModel.findOneAndUpdate(tenantFilter(ctx, { _id: id }), update, { new: true }).lean();
  if (!doc) throw new HttpError(404, "Item not found");
  return toItem(doc);
}

export async function deleteItem(ctx: TenantContext, id: string) {
  const res = await MenuItemModel.deleteOne(tenantFilter(ctx, { _id: id }));
  if (res.deletedCount === 0) throw new HttpError(404, "Item not found");
}

/* ---------------------------------------------------------- modifier groups */

type GroupInput = Partial<Omit<ModifierGroup, "id" | "options">> & {
  options?: { id?: string; label: string; priceDelta?: number }[];
};

function normalizeOptions(options: GroupInput["options"]) {
  return (options ?? []).map((o) => ({
    id: o.id ?? randomUUID(),
    label: o.label,
    priceDelta: o.priceDelta ?? 0,
  }));
}

export async function createModifierGroup(ctx: TenantContext, input: GroupInput & { name: string }) {
  const doc = await ModifierGroupModel.create({
    brandId: ctx.brandId,
    outletId: ctx.outletId,
    name: input.name,
    required: input.required ?? false,
    minSelect: input.minSelect ?? 0,
    maxSelect: input.maxSelect ?? 1,
    options: normalizeOptions(input.options),
  });
  return toGroup(doc.toObject());
}

export async function updateModifierGroup(ctx: TenantContext, id: string, patch: GroupInput) {
  const update: Record<string, unknown> = { ...patch };
  if (patch.options) update.options = normalizeOptions(patch.options);

  const doc = await ModifierGroupModel.findOneAndUpdate(tenantFilter(ctx, { _id: id }), update, { new: true }).lean();
  if (!doc) throw new HttpError(404, "Modifier group not found");
  return toGroup(doc);
}

export async function deleteModifierGroup(ctx: TenantContext, id: string) {
  await MenuItemModel.updateMany(tenantFilter(ctx, { modifierGroupIds: id }), {
    $pull: { modifierGroupIds: id },
  });
  const res = await ModifierGroupModel.deleteOne(tenantFilter(ctx, { _id: id }));
  if (res.deletedCount === 0) throw new HttpError(404, "Modifier group not found");
}
