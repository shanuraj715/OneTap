import { randomUUID } from "node:crypto";
                                                                                         
import {
  MenuCategoryModel,
  MenuItemModel,
  ModifierGroupModel,
  tenantFilter,
                     
} from "@onetap/db";
import { HttpError } from "../../middleware/error.js";

/*
 * Menu documents live UNDER an outlet, so every query is scoped by both
 * brandId and outletId via tenantFilter — the tenant-scope plugin refuses
 * anything unscoped.
 */

/* ------------------------------------------------------------------ mapping */

const toCategory = (d                                                                      )               => ({
  id: String(d._id),
  name: d.name,
  sortOrder: d.sortOrder,
  isActive: d.isActive,
});

const toItem = (d                     )           => ({
  id: String(d._id),
  categoryId: d.categoryId,
  name: d.name,
  description: d.description ?? "",
  foodType: d.foodType ?? "veg",
  tags: d.tags ?? [],
  basePrice: d.basePrice ?? 0,
  variants: (d.variants ?? []).map((v     ) => ({ id: v.id, label: v.label, price: v.price })),
  modifierGroupIds: d.modifierGroupIds ?? [],
  gstRatePct: d.gstRatePct ?? 5,
  isAvailable: d.isAvailable ?? true,
  sortOrder: d.sortOrder ?? 0,
});

const toGroup = (d                     )                => ({
  id: String(d._id),
  name: d.name,
  required: d.required ?? false,
  minSelect: d.minSelect ?? 0,
  maxSelect: d.maxSelect ?? 1,
  options: (d.options ?? []).map((o     ) => ({ id: o.id, label: o.label, priceDelta: o.priceDelta ?? 0 })),
});

/* --------------------------------------------------------------------- read */

export async function getMenu(ctx               )                {
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

export async function createCategory(ctx               , input                                      ) {
  const doc = await MenuCategoryModel.create({
    brandId: ctx.brandId,
    outletId: ctx.outletId,
    name: input.name,
    sortOrder: input.sortOrder ?? 0,
  });
  return toCategory(doc.toObject());
}

export async function updateCategory(
  ctx               ,
  id        ,
  patch                                                                 ,
) {
  const doc = await MenuCategoryModel.findOneAndUpdate(tenantFilter(ctx, { _id: id }), patch, { new: true }).lean();
  if (!doc) throw new HttpError(404, "Category not found");
  return toCategory(doc);
}

export async function deleteCategory(ctx               , id        ) {
  const itemCount = await MenuItemModel.countDocuments(tenantFilter(ctx, { categoryId: id }));
  if (itemCount > 0) {
    throw new HttpError(409, `Category still has ${itemCount} item(s). Move or delete them first.`);
  }
  const res = await MenuCategoryModel.deleteOne(tenantFilter(ctx, { _id: id }));
  if (res.deletedCount === 0) throw new HttpError(404, "Category not found");
}

/* -------------------------------------------------------------------- items */

;                                                              
                                                             
  

function normalizeVariants(variants                       ) {
  return (variants ?? []).map((v) => ({ id: v.id ?? randomUUID(), label: v.label, price: v.price }));
}

export async function createItem(ctx               , input                                                  ) {
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

export async function updateItem(ctx               , id        , patch           ) {
  const update                          = { ...patch };
  if (patch.variants) update.variants = normalizeVariants(patch.variants);

  const doc = await MenuItemModel.findOneAndUpdate(tenantFilter(ctx, { _id: id }), update, { new: true }).lean();
  if (!doc) throw new HttpError(404, "Item not found");
  return toItem(doc);
}

export async function deleteItem(ctx               , id        ) {
  const res = await MenuItemModel.deleteOne(tenantFilter(ctx, { _id: id }));
  if (res.deletedCount === 0) throw new HttpError(404, "Item not found");
}

/* ---------------------------------------------------------- modifier groups */

;                                                                   
                                                                  
  

function normalizeOptions(options                       ) {
  return (options ?? []).map((o) => ({
    id: o.id ?? randomUUID(),
    label: o.label,
    priceDelta: o.priceDelta ?? 0,
  }));
}

export async function createModifierGroup(ctx               , input                               ) {
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

export async function updateModifierGroup(ctx               , id        , patch            ) {
  const update                          = { ...patch };
  if (patch.options) update.options = normalizeOptions(patch.options);

  const doc = await ModifierGroupModel.findOneAndUpdate(tenantFilter(ctx, { _id: id }), update, { new: true }).lean();
  if (!doc) throw new HttpError(404, "Modifier group not found");
  return toGroup(doc);
}

export async function deleteModifierGroup(ctx               , id        ) {
  await MenuItemModel.updateMany(tenantFilter(ctx, { modifierGroupIds: id }), {
    $pull: { modifierGroupIds: id },
  });
  const res = await ModifierGroupModel.deleteOne(tenantFilter(ctx, { _id: id }));
  if (res.deletedCount === 0) throw new HttpError(404, "Modifier group not found");
}
