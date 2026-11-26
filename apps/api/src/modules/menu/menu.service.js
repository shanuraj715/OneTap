import { createHash, randomUUID } from "node:crypto";
import { availabilitySchema, imageRatioOf, menuForNow, limitImages, categoryHeight, cleanCategoryName, comboSchema, duplicateCategoryName, categoryLevel, categorySubtreeIds, istDayKey, itemStockSchema, MAX_CATEGORIES_AT_ONCE, MAX_CATEGORY_DEPTH, planCategoryMove } from "@rasoipulse/config-schema";
import { refillDailyStock } from "./stock.service.js";
import {
  MenuCategoryModel,
  MenuItemModel,
  ModifierGroupModel,
  OutletModel,
  tenantFilter,
} from "@rasoipulse/db";
import { HttpError } from "../../middleware/error.js";
import { cache } from "../cache/cache.js";
import { removeObject } from "../storage/storage.service.js";

/*
 * Menu documents live UNDER an outlet, so every query is scoped by both
 * brandId and outletId via tenantFilter — the tenant-scope plugin refuses
 * anything unscoped.
 */

/* ------------------------------------------------------------------ mapping */

const toCategory = (d) => ({
  id: String(d._id),
  name: d.name,
  parentId: d.parentId ?? null,
  image: d.image?.url ? { url: d.image.url, key: d.image.key ?? "", ...(d.image.width ? { width: d.image.width } : {}), ...(d.image.height ? { height: d.image.height } : {}) } : null,
  sortOrder: d.sortOrder,
  isActive: d.isActive,
  prepStation: d.prepStation ?? null,
  availability: d.availability?.windows?.length ? { windows: d.availability.windows } : null,
});

const toStock = (s) =>
  s?.tracked ? { tracked: true, left: Math.max(0, s.left ?? 0), daily: s.daily ?? null, lowAt: s.lowAt ?? 5 } : null;

const toItem = (d                     )           => ({
  id: String(d._id),
  categoryId: d.categoryId,
  name: d.name,
  description: d.description ?? "",
  foodType: d.foodType ?? "veg",
  tags: d.tags ?? [],
  images: (d.images ?? []).map((im     ) => ({
    url: im.url,
    key: im.key ?? "",
    ...(im.width ? { width: im.width } : {}),
    ...(im.height ? { height: im.height } : {}),
    // a picture saved before shapes existed has none: it is a square one
    ratio: imageRatioOf(im),
  })),
  basePrice: d.basePrice ?? 0,
  variants: (d.variants ?? []).map((v     ) => ({ id: v.id, label: v.label, price: v.price })),
  modifierGroupIds: d.modifierGroupIds ?? [],
  gstRatePct: d.gstRatePct ?? 5,
  isAvailable: d.isAvailable ?? true,
  sortOrder: d.sortOrder ?? 0,
  prepStation: d.prepStation ?? null,
  stock: toStock(d.stock),
  availability: d.availability?.windows?.length ? { windows: d.availability.windows } : null,
  combo: d.combo?.items?.length ? { items: d.combo.items.map((p) => ({ itemId: String(p.itemId), variantId: p.variantId ?? null, quantity: p.quantity ?? 1 })) } : null,
  pairsWith: (d.pairsWith ?? []).map(String),
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

/**
 * A short fingerprint of what the menu IS — names, prices, sizes, add-ons, pictures, categories, hours. How many of a counted dish
 * are left is left out on purpose: that changes with every order, and says nothing about whether the app's copy of the menu is old.
 * The staff app keeps one copy of the menu and asks only "what can't be ordered now?" afterwards; this tells it when its copy is stale.
 */
export function menuVersion(menu) {
  const items = menu.items.map(({ stock, ...rest }) => ({ ...rest, stock: stock ? { tracked: stock.tracked, daily: stock.daily } : null }));
  return createHash("sha1").update(JSON.stringify({ c: menu.categories, i: items, m: menu.modifierGroups })).digest("base64url").slice(0, 12);
}

/**
 * Only the dishes that can't be ordered RIGHT NOW (switched off, counted stock at zero, outside their serving hours, a combo with a
 * part that is out) — a few lines instead of the whole menu. A dish that is not in the list can be ordered. Same rule as the
 * storefront and the order check (`unavailability` in config-schema), worked out at the moment of the call.
 */
export async function unavailableNow(ctx, at = Date.now()) {
  const menu = await getMenu(ctx);
  const now = menuForNow(menu, at);
  const unavailable = [];
  const low = [];
  for (const item of now.items) {
    if (!item.isAvailable) unavailable.push({ id: item.id, label: item.unavailableLabel ?? "Sold out" });
    else if (item.lowStock != null) low.push({ id: item.id, left: item.lowStock });
  }
  return { version: menu.version ?? menuVersion(menu), unavailable, low, at: new Date(at).toISOString() };
}

/**
 * An outlet's whole menu. Page views are served from the cache (dropped the
 * moment any menu item, category or modifier group of the outlet changes).
 * Anything that decides what a customer PAYS — placing or editing an order —
 * must pass `fresh: true` and read the prices straight from the database.
 */
export async function getMenu(ctx               , { fresh = false } = {}) {
  // a new day (India time) refills the dishes counted per day — before anything reads how many are left
  await refillDailyStock(ctx);
  const load = async () => {
    const [categories, items, modifierGroups] = await Promise.all([
      MenuCategoryModel.find(tenantFilter(ctx)).sort({ sortOrder: 1, name: 1 }).lean(),
      MenuItemModel.find(tenantFilter(ctx)).sort({ sortOrder: 1, name: 1 }).lean(),
      ModifierGroupModel.find(tenantFilter(ctx)).sort({ name: 1 }).lean(),
    ]);

    const menu = {
      categories: categories.map(toCategory),
      items: items.map(toItem),
      modifierGroups: modifierGroups.map(toGroup),
    };
    return { ...menu, version: menuVersion(menu) };
  };
  if (fresh) return load();
  return cache.wrap(`menu:${ctx.brandId}:${ctx.outletId}`, load, {
    tags: [`brand:${ctx.brandId}`, `menu:${ctx.outletId}`, "ns:menu"],
  });
}

/* --------------------------------------------------------------- categories */

/** one category's picture, cleaned up — or null for "no picture" */
function normalizeCategoryImage(image) {
  if (!image || typeof image.url !== "string" || !image.url) return null;
  return {
    url: image.url,
    key: typeof image.key === "string" ? image.key : "",
    ...(Number(image.width) > 0 ? { width: Math.round(Number(image.width)) } : {}),
    ...(Number(image.height) > 0 ? { height: Math.round(Number(image.height)) } : {}),
  };
}

/** Hours for a dish or category: null clears them (any time / same as the parent); undefined leaves them alone. */
function normalizeAvailability(value) {
  if (value === undefined) return undefined;
  if (!value || !value.windows?.length) return null;
  const parsed = availabilitySchema.safeParse(value);
  if (!parsed.success) throw new HttpError(400, `Hours: ${parsed.error.issues[0]?.message ?? "check the days and times"}`);
  for (const w of parsed.data.windows) if (w.from === w.to) throw new HttpError(400, "Hours: a time window can't start and end at the same time.");
  return { windows: parsed.data.windows.map((w) => ({ days: [...new Set(w.days)].sort((a, b) => a - b), from: w.from, to: w.to })) };
}

/**
 * Counted stock as the editor sends it. Turning counting on (or typing a new number) stamps today as the refill day,
 * so the morning refill doesn't overwrite a count the owner just set.
 */
function normalizeStock(value) {
  if (value === undefined) return undefined;
  if (!value || value.tracked === false) return null;
  const parsed = itemStockSchema.safeParse(value);
  if (!parsed.success) throw new HttpError(400, `Stock: ${parsed.error.issues[0]?.message ?? "check the numbers"}`);
  return { tracked: true, left: parsed.data.left, daily: parsed.data.daily, lowAt: parsed.data.lowAt, resetDay: istDayKey() };
}

/**
 * A combo's parts: dishes of this outlet, not the combo itself, not other combos (no combos inside combos), and a
 * size that dish really has. Null = not a combo.
 */
async function normalizeCombo(ctx, value, selfId = null) {
  if (value === undefined) return undefined;
  if (!value || !value.items?.length) return null;
  const parsed = comboSchema.safeParse(value);
  if (!parsed.success) throw new HttpError(400, `Combo: ${parsed.error.issues[0]?.message ?? "check the dishes"}`);
  const ids = [...new Set(parsed.data.items.map((p) => p.itemId))];
  if (selfId && ids.includes(String(selfId))) throw new HttpError(400, "A combo can't contain itself.");
  const docs = await MenuItemModel.find(tenantFilter(ctx, { _id: { $in: ids.filter((id) => /^[a-f\d]{24}$/i.test(id)) } })).select("name variants combo").lean();
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  for (const p of parsed.data.items) {
    const it = byId.get(p.itemId);
    if (!it) throw new HttpError(400, "Combo: one of its dishes isn't on this outlet's menu.");
    if (it.combo?.items?.length) throw new HttpError(400, `Combo: “${it.name}” is a combo itself — a combo can only hold plain dishes.`);
    if (p.variantId && !(it.variants ?? []).some((v) => v.id === p.variantId)) throw new HttpError(400, `Combo: “${it.name}” doesn't have that size any more.`);
  }
  return { items: parsed.data.items.map((p) => ({ itemId: p.itemId, variantId: p.variantId ?? null, quantity: p.quantity })) };
}

/** "Goes well with": other dishes of this outlet (unknown ones are dropped, not refused — a dish may have been deleted). */
async function normalizePairs(ctx, value, selfId = null) {
  if (value === undefined) return undefined;
  const ids = [...new Set((value ?? []).map(String))].filter((id) => /^[a-f\d]{24}$/i.test(id) && id !== String(selfId ?? ""));
  if (!ids.length) return [];
  const docs = await MenuItemModel.find(tenantFilter(ctx, { _id: { $in: ids } })).select("_id").lean();
  const known = new Set(docs.map((d) => String(d._id)));
  return ids.filter((id) => known.has(id)).slice(0, 8);
}

/** The outlet's categories as the tree helpers want them (id / parentId only). */
async function categoryList(ctx) {
  const docs = await MenuCategoryModel.find(tenantFilter(ctx)).select("name parentId sortOrder").lean();
  return docs.map((d) => ({ id: String(d._id), name: d.name, parentId: d.parentId ?? null, sortOrder: d.sortOrder ?? 0 }));
}

/**
 * A picture file is deleted only when nothing else still shows it — an imported menu copies the picture's address
 * from the outlet it came from, so two outlets can point at one file.
 */
async function removeImageIfUnused(ctx, key) {
  if (!key) return;
  const [items, categories] = await Promise.all([
    MenuItemModel.countDocuments({ brandId: ctx.brandId, "images.key": key }),
    MenuCategoryModel.countDocuments({ brandId: ctx.brandId, "image.key": key }),
  ]);
  if (items + categories === 0) void removeObject(ctx, key);
}

export async function createCategory(ctx, input) {
  const all = await categoryList(ctx);
  let parentId = input.parentId ?? null;
  if (parentId) {
    if (!all.some((c) => c.id === parentId)) throw new HttpError(400, "That parent category doesn't exist");
    if (categoryLevel(all, parentId) + 1 > MAX_CATEGORY_DEPTH) {
      throw new HttpError(400, `Categories can go ${MAX_CATEGORY_DEPTH} levels deep at most.`);
    }
  } else parentId = null;

  const doc = await MenuCategoryModel.create({
    brandId: ctx.brandId,
    outletId: ctx.outletId,
    name: input.name,
    parentId,
    ...(normalizeCategoryImage(input.image) ? { image: normalizeCategoryImage(input.image) } : {}),
    // new ones go to the end of their own level
    sortOrder: input.sortOrder ?? all.filter((c) => c.parentId === parentId).length,
    ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
    prepStation: input.prepStation ?? null,
    availability: normalizeAvailability(input.availability) ?? null,
  });
  return toCategory(doc.toObject());
}

/**
 * Several categories at once, inside `parentId` (null = top level), in the order given — each with its own name and,
 * if it has one, picture. Names are cleaned like the form does; a missing name, a name given twice or more than
 * MAX_CATEGORIES_AT_ONCE is refused, and everything is checked BEFORE the first one is created so a refusal never
 * leaves half of them behind. The new ones go to the end of their level.
 */
export async function createCategories(ctx, { parentId = null, categories: wanted, isActive }) {
  const list = (Array.isArray(wanted) ? wanted : []).map((c) => ({ name: cleanCategoryName(c?.name), image: normalizeCategoryImage(c?.image) }));
  if (list.length === 0) throw new HttpError(400, "Give at least one category.");
  if (list.length > MAX_CATEGORIES_AT_ONCE) throw new HttpError(400, `Add ${MAX_CATEGORIES_AT_ONCE} categories or fewer at a time.`);
  if (list.some((c) => !c.name)) throw new HttpError(400, "Every category needs a name.");
  const twice = duplicateCategoryName(list.map((c) => c.name));
  if (twice) throw new HttpError(400, `“${twice}” is in the list twice.`);

  const all = await categoryList(ctx);
  const parent = parentId || null;
  if (parent) {
    if (!all.some((c) => c.id === parent)) throw new HttpError(400, "That parent category doesn't exist");
    if (categoryLevel(all, parent) + 1 > MAX_CATEGORY_DEPTH) throw new HttpError(400, `Categories can go ${MAX_CATEGORY_DEPTH} levels deep at most.`);
  }
  let sortOrder = all.filter((c) => c.parentId === parent).length;
  const created = [];
  for (const { name, image } of list) {
    const doc = await MenuCategoryModel.create({
      brandId: ctx.brandId,
      outletId: ctx.outletId,
      name,
      parentId: parent,
      ...(image ? { image } : {}),
      sortOrder: sortOrder++,
      ...(isActive === undefined ? {} : { isActive }),
    });
    created.push(toCategory(doc.toObject()));
  }
  return created;
}

export async function updateCategory(ctx, id, patch) {
  const update = { ...patch };
  if (patch.availability !== undefined) update.availability = normalizeAvailability(patch.availability);
  const before = await MenuCategoryModel.findOne(tenantFilter(ctx, { _id: id })).lean();
  if (!before) throw new HttpError(404, "Category not found");

  // moving it inside another category (or back to the top)
  if (patch.parentId !== undefined) {
    const parentId = patch.parentId || null;
    update.parentId = parentId;
    if ((before.parentId ?? null) !== parentId) {
      const all = await categoryList(ctx);
      if (parentId) {
        if (!all.some((c) => c.id === parentId)) throw new HttpError(400, "That parent category doesn't exist");
        if (categorySubtreeIds(all, id).includes(parentId)) throw new HttpError(400, "A category can't be moved inside itself or inside one of its own sub-categories.");
        if (categoryLevel(all, parentId) + categoryHeight(all, id) > MAX_CATEGORY_DEPTH) {
          throw new HttpError(400, `Categories can go ${MAX_CATEGORY_DEPTH} levels deep at most — that move would go deeper.`);
        }
      }
      // it joins the end of its new level, unless the caller said where
      if (patch.sortOrder === undefined) update.sortOrder = all.filter((c) => c.parentId === parentId && c.id !== id).length;
    }
  }

  // a new picture, or none
  let oldKey = "";
  if (patch.image !== undefined) {
    const next = normalizeCategoryImage(patch.image);
    if (next) update.image = next;
    else {
      delete update.image;
      update.$unset = { image: 1 };
    }
    if ((before.image?.key ?? "") !== (next?.key ?? "")) oldKey = before.image?.key ?? "";
  }

  const doc = await MenuCategoryModel.findOneAndUpdate(tenantFilter(ctx, { _id: id }), update, { new: true }).lean();
  if (!doc) throw new HttpError(404, "Category not found");
  await removeImageIfUnused(ctx, oldKey);
  return toCategory(doc);
}

/** Put one level of categories in a new order (every id must sit under the same parent). */
export async function reorderCategories(ctx, ids) {
  const docs = await MenuCategoryModel.find(tenantFilter(ctx, { _id: { $in: ids } })).select("parentId").lean();
  if (docs.length !== new Set(ids).size) throw new HttpError(404, "Category not found");
  if (new Set(docs.map((d) => d.parentId ?? null)).size > 1) throw new HttpError(400, "Only categories on the same level can be put in order together");
  await Promise.all(ids.map((id, index) => MenuCategoryModel.updateOne(tenantFilter(ctx, { _id: id }), { sortOrder: index })));
}

/**
 * Drag-and-drop: put a category inside `parentId` (null = top level), just before `beforeId` (null = at the end), and
 * renumber the level it lands in. The rule is the shared `planCategoryMove`, so the editor shows exactly this.
 */
export async function moveCategory(ctx, id, { parentId = null, beforeId = null } = {}) {
  const all = await categoryList(ctx);
  const plan = planCategoryMove(all, id, parentId, beforeId);
  if (!plan.ok) throw new HttpError(plan.reason === "Category not found" ? 404 : 400, plan.reason);
  // one update at a time (not a bulk write) so the menu cache is dropped the way it is for every other change
  await Promise.all(
    plan.changes.map((c) => MenuCategoryModel.updateOne(tenantFilter(ctx, { _id: c.id }), { $set: { sortOrder: c.sortOrder, ...(c.parentId !== undefined ? { parentId: c.parentId } : {}) } })),
  );
  return { changes: plan.changes };
}

/**
 * Delete categories — and everything inside them: each one's sub-categories (all the way down) go too. Items are
 * never removed by accident: if any category being deleted holds items the call is refused (409, with how many)
 * unless the caller says `deleteItems`, in which case those items are deleted with their pictures.
 * Returns what was removed.
 */
export async function deleteCategories(ctx, ids, { deleteItems = false } = {}) {
  const all = await categoryList(ctx);
  const known = new Set(all.map((c) => c.id));
  const wanted = [...new Set(ids)];
  if (wanted.some((id) => !known.has(id))) throw new HttpError(404, "Category not found");

  const doomed = [...new Set(wanted.flatMap((id) => categorySubtreeIds(all, id)))];
  const items = await MenuItemModel.find(tenantFilter(ctx, { categoryId: { $in: doomed } })).select("images").lean();
  if (items.length > 0 && !deleteItems) {
    throw new HttpError(409, `${items.length === 1 ? "There is 1 item" : `There are ${items.length} items`} in ${doomed.length === 1 ? "this category" : "these categories"}. Move ${items.length === 1 ? "it" : "them"} to another category first, or delete ${items.length === 1 ? "it" : "them"} too.`, {
      code: "category_has_items",
      itemCount: items.length,
      categoryCount: doomed.length,
    });
  }

  const categories = await MenuCategoryModel.find(tenantFilter(ctx, { _id: { $in: doomed } })).select("image").lean();
  if (items.length) await MenuItemModel.deleteMany(tenantFilter(ctx, { categoryId: { $in: doomed } }));
  await MenuCategoryModel.deleteMany(tenantFilter(ctx, { _id: { $in: doomed } }));

  // pictures last, once the database no longer points at them
  const keys = [...items.flatMap((i) => (i.images ?? []).map((im) => im.key)), ...categories.map((c) => c.image?.key)].filter(Boolean);
  for (const key of new Set(keys)) await removeImageIfUnused(ctx, key);
  return { deletedCategories: doomed.length, deletedItems: items.length };
}

export const deleteCategory = (ctx, id) => deleteCategories(ctx, [id]);

/* -------------------------------------------------------------------- items */

;                                                              
                                                             
  

function normalizeVariants(variants                       ) {
  return (variants ?? []).map((v) => ({ id: v.id ?? randomUUID(), label: v.label, price: v.price }));
}

/**
 * A dish's pictures as they are stored: each with its shape (a picture without one is square — what every dish had
 * before shapes), and each shape within what it can hold (6 square, 1 each of landscape / wide / portrait).
 */
function normalizeImages(images) {
  return limitImages(
    (images ?? [])
      .filter((im) => im && typeof im.url === "string" && im.url)
      .map((im) => ({
        url: im.url,
        key: typeof im.key === "string" ? im.key : "",
        ...(Number(im.width) > 0 ? { width: Math.round(Number(im.width)) } : {}),
        ...(Number(im.height) > 0 ? { height: Math.round(Number(im.height)) } : {}),
        ratio: imageRatioOf(im),
      })),
  );
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
    images: normalizeImages(input.images),
    basePrice: input.basePrice ?? 0,
    variants: normalizeVariants(input.variants),
    modifierGroupIds: input.modifierGroupIds ?? [],
    gstRatePct: input.gstRatePct ?? 5,
    isAvailable: input.isAvailable ?? true,
    sortOrder: input.sortOrder ?? 0,
    prepStation: input.prepStation ?? null,
    stock: normalizeStock(input.stock) ?? null,
    availability: normalizeAvailability(input.availability) ?? null,
    combo: (await normalizeCombo(ctx, input.combo)) ?? null,
    pairsWith: (await normalizePairs(ctx, input.pairsWith)) ?? [],
  });
  return toItem(doc.toObject());
}

export async function updateItem(ctx               , id        , patch           ) {
  const update                          = { ...patch };
  if (patch.variants) update.variants = normalizeVariants(patch.variants);
  if (patch.stock !== undefined) update.stock = normalizeStock(patch.stock);
  if (patch.availability !== undefined) update.availability = normalizeAvailability(patch.availability);
  if (patch.combo !== undefined) update.combo = await normalizeCombo(ctx, patch.combo, id);
  if (patch.pairsWith !== undefined) update.pairsWith = await normalizePairs(ctx, patch.pairsWith, id);
  // a dish that other combos are made of can't become a combo itself
  if (update.combo) {
    const usedIn = await MenuItemModel.findOne(tenantFilter(ctx, { "combo.items.itemId": String(id) })).select("name").lean();
    if (usedIn) throw new HttpError(400, `This dish is part of the combo “${usedIn.name}”, so it can't be a combo itself.`);
  }

  let removedImageKeys           = [];
  if (patch.images !== undefined) {
    const next = normalizeImages(patch.images);
    update.images = next;
    const prev = await MenuItemModel.findOne(tenantFilter(ctx, { _id: id }), { images: 1 }).lean();
    const keptKeys = new Set(next.map((im) => im.key).filter(Boolean));
    removedImageKeys = (prev?.images ?? [])
      .map((im     ) => im.key)
      .filter((k        ) => k && !keptKeys.has(k));
  }

  const doc = await MenuItemModel.findOneAndUpdate(tenantFilter(ctx, { _id: id }), update, { new: true }).lean();
  if (!doc) throw new HttpError(404, "Item not found");

  // Delete files an edit dropped — after the DB is the source of truth.
  for (const key of removedImageKeys) void removeObject(ctx, key);

  return toItem(doc);
}

export async function deleteItem(ctx               , id        ) {
  const doc = await MenuItemModel.findOne(tenantFilter(ctx, { _id: id }), { images: 1 }).lean();
  const res = await MenuItemModel.deleteOne(tenantFilter(ctx, { _id: id }));
  if (res.deletedCount === 0) throw new HttpError(404, "Item not found");
  await forgetItems(ctx, [String(id)]);
  for (const im of doc?.images ?? []) if (im.key) void removeObject(ctx, im.key);
}

/** Deleted dishes stop being suggested with others. (A combo that held one shows "not available" until it is edited.) */
async function forgetItems(ctx, ids) {
  await MenuItemModel.updateMany(tenantFilter(ctx, { pairsWith: { $in: ids } }), { $pull: { pairsWith: { $in: ids } } });
}

/** Delete several items at once (with their pictures). Returns how many went. */
export async function deleteItems(ctx, ids) {
  const wanted = [...new Set(ids)];
  const docs = await MenuItemModel.find(tenantFilter(ctx, { _id: { $in: wanted } })).select("images").lean();
  if (docs.length !== wanted.length) throw new HttpError(404, "Item not found");
  await MenuItemModel.deleteMany(tenantFilter(ctx, { _id: { $in: wanted } }));
  await forgetItems(ctx, wanted.map(String));
  for (const key of new Set(docs.flatMap((d) => (d.images ?? []).map((im) => im.key)).filter(Boolean))) await removeImageIfUnused(ctx, key);
  return { deletedItems: docs.length };
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

/* --------------------------------------------------------------- import menu */

export async function importMenu(ctx, input) {
  const { sourceOutletId, categoryIds = [], itemIds = [], targetCategoryId } = input;
  if (!sourceOutletId) throw new HttpError(400, "sourceOutletId is required");
  if (sourceOutletId === ctx.outletId) {
    throw new HttpError(400, "Source and destination outlet cannot be the same");
  }

  const sourceOutlet = await OutletModel.findOne({ _id: sourceOutletId }, null, {
    allowGlobalQuery: true,
  }).lean();
  if (!sourceOutlet) throw new HttpError(404, "Source outlet not found");

  if (!ctx.isSuperAdmin && String(sourceOutlet.brandId) !== String(ctx.brandId)) {
    throw new HttpError(403, "Cannot import from an outlet belonging to another brand");
  }

  // Fetch source menu
  const srcScope = { brandId: String(sourceOutlet.brandId), outletId: sourceOutletId };
  const [sourceCategories, sourceItems, sourceGroups] = await Promise.all([
    MenuCategoryModel.find(tenantFilter(srcScope)).lean(),
    MenuItemModel.find(tenantFilter(srcScope)).lean(),
    ModifierGroupModel.find(tenantFilter(srcScope)).lean(),
  ]);

  // Fetch target menu
  const [targetCategories, targetGroups, targetItemMaxSort] = await Promise.all([
    MenuCategoryModel.find(tenantFilter(ctx)).lean(),
    ModifierGroupModel.find(tenantFilter(ctx)).lean(),
    MenuItemModel.findOne(tenantFilter(ctx)).sort({ sortOrder: -1 }).select("sortOrder").lean(),
  ]);

  // Verify targetCategoryId if provided
  if (targetCategoryId) {
    const validTargetCat = targetCategories.some((c) => String(c._id) === targetCategoryId);
    if (!validTargetCat) throw new HttpError(400, "Selected target category does not exist");
  }

  // Category mapping: sourceCategoryId -> targetCategoryId.
  // Categories are matched by their place in the tree — the same name under the same parent — not by name alone, so
  // "Dosa" inside "South Indian" is never merged with a "Dosa" somewhere else. A category's parents are brought
  // across first, so an imported "Dosa" still sits inside "South Indian".
  const categoryMap = new Map();
  const sourceById = new Map(sourceCategories.map((c) => [String(c._id), c]));
  const slot = (parentId, name) => `${parentId ?? ""}|${name.trim().toLowerCase()}`;
  const targetBySlot = new Map(targetCategories.map((c) => [slot(c.parentId ?? null, c.name), String(c._id)]));
  const siblingCount = new Map();
  for (const c of targetCategories) siblingCount.set(c.parentId ?? null, (siblingCount.get(c.parentId ?? null) ?? 0) + 1);

  let importedCategoriesCount = 0;

  async function resolveTargetCategory(srcCatId, guard = 0) {
    if (categoryMap.has(srcCatId)) return categoryMap.get(srcCatId);
    const srcCat = sourceById.get(srcCatId);
    if (!srcCat) return null;

    const srcParent = srcCat.parentId && sourceById.has(srcCat.parentId) && guard < MAX_CATEGORY_DEPTH ? srcCat.parentId : null;
    const parentTargetId = srcParent ? await resolveTargetCategory(srcParent, guard + 1) : null;

    const where = slot(parentTargetId, srcCat.name);
    if (targetBySlot.has(where)) {
      const existingId = targetBySlot.get(where);
      categoryMap.set(srcCatId, existingId);
      return existingId;
    }

    const image = normalizeCategoryImage(srcCat.image);
    const newCat = await MenuCategoryModel.create({
      brandId: ctx.brandId,
      outletId: ctx.outletId,
      name: srcCat.name,
      parentId: parentTargetId,
      ...(image ? { image } : {}),
      sortOrder: siblingCount.get(parentTargetId) ?? 0,
      isActive: srcCat.isActive ?? true,
      prepStation: srcCat.prepStation ?? null,
      availability: srcCat.availability ?? null,
    });
    siblingCount.set(parentTargetId, (siblingCount.get(parentTargetId) ?? 0) + 1);
    const newId = String(newCat._id);
    categoryMap.set(srcCatId, newId);
    targetBySlot.set(where, newId);
    importedCategoriesCount++;
    return newId;
  }

  // 1. Process categories explicitly selected for import
  for (const srcCatId of categoryIds) {
    await resolveTargetCategory(srcCatId);
  }

  // 2. Modifier group mapping: sourceGroupId -> targetGroupId
  const groupMap = new Map();
  const targetGroupByName = new Map(
    targetGroups.map((g) => [g.name.trim().toLowerCase(), String(g._id)])
  );
  let importedModifierGroupsCount = 0;

  async function resolveTargetModifierGroup(srcGroupId) {
    if (groupMap.has(srcGroupId)) return groupMap.get(srcGroupId);
    const srcGroup = sourceGroups.find((g) => String(g._id) === srcGroupId);
    if (!srcGroup) return null;

    const normalizedName = srcGroup.name.trim().toLowerCase();
    if (targetGroupByName.has(normalizedName)) {
      const existingId = targetGroupByName.get(normalizedName);
      groupMap.set(srcGroupId, existingId);
      return existingId;
    }

    const newGroup = await ModifierGroupModel.create({
      brandId: ctx.brandId,
      outletId: ctx.outletId,
      name: srcGroup.name,
      required: srcGroup.required ?? false,
      minSelect: srcGroup.minSelect ?? 0,
      maxSelect: srcGroup.maxSelect ?? 1,
      options: (srcGroup.options ?? []).map((o) => ({
        id: randomUUID(),
        label: o.label,
        priceDelta: o.priceDelta ?? 0,
      })),
    });
    const newId = String(newGroup._id);
    groupMap.set(srcGroupId, newId);
    targetGroupByName.set(normalizedName, newId);
    importedModifierGroupsCount++;
    return newId;
  }

  // 3. Process items to import
  const selectedItems = sourceItems.filter((i) => itemIds.includes(String(i._id)));
  let nextItemSortOrder = (targetItemMaxSort?.sortOrder ?? 0) + 1;
  let importedItemsCount = 0;

  for (const srcItem of selectedItems) {
    let destCatId = targetCategoryId;
    if (!destCatId) {
      destCatId = await resolveTargetCategory(srcItem.categoryId);
    }
    if (!destCatId) continue;

    const targetModGroupIds = [];
    for (const srcGid of srcItem.modifierGroupIds ?? []) {
      const mappedGid = await resolveTargetModifierGroup(srcGid);
      if (mappedGid) targetModGroupIds.push(mappedGid);
    }

    await MenuItemModel.create({
      brandId: ctx.brandId,
      outletId: ctx.outletId,
      categoryId: destCatId,
      name: srcItem.name,
      description: srcItem.description ?? "",
      foodType: srcItem.foodType ?? "veg",
      tags: srcItem.tags ?? [],
      images: normalizeImages(srcItem.images),
      basePrice: srcItem.basePrice ?? 0,
      variants: normalizeVariants(srcItem.variants),
      modifierGroupIds: targetModGroupIds,
      gstRatePct: srcItem.gstRatePct ?? 5,
      isAvailable: srcItem.isAvailable ?? true,
      sortOrder: nextItemSortOrder++,
      prepStation: srcItem.prepStation ?? null,
      // hours travel with the dish; its stock count, combo parts and pairings belong to the other outlet
      availability: srcItem.availability ?? null,
    });
    importedItemsCount++;
  }

  return {
    importedCategoriesCount,
    importedItemsCount,
    importedModifierGroupsCount,
  };
}
