import { z } from "zod";

/** Money is always integer paise. ₹110.00 => 11000. */
export function formatINR(paise: number): string {
  const rupees = paise / 100;
  return "₹" + rupees.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export const foodTypeSchema = z.enum(["veg", "non-veg", "egg"]);
export type FoodType = z.infer<typeof foodTypeSchema>;

/** A size / preparation choice, e.g. "Half plate (5 pcs)" — absolute price. */
export const variantSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  price: z.number().int().nonnegative(),
});
export type Variant = z.infer<typeof variantSchema>;

export const modifierOptionSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  priceDelta: z.number().int().default(0),
});
export type ModifierOption = z.infer<typeof modifierOptionSchema>;

export const modifierGroupSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  required: z.boolean().default(false),
  minSelect: z.number().int().nonnegative().default(0),
  maxSelect: z.number().int().positive().default(1),
  options: z.array(modifierOptionSchema).default([]),
});
export type ModifierGroup = z.infer<typeof modifierGroupSchema>;

export const menuItemSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  name: z.string().min(1),
  description: z.string().default(""),
  foodType: foodTypeSchema.default("veg"),
  tags: z.array(z.string()).default([]),
  /** used when there are no variants */
  basePrice: z.number().int().nonnegative().default(0),
  variants: z.array(variantSchema).default([]),
  modifierGroupIds: z.array(z.string()).default([]),
  gstRatePct: z.number().nonnegative().default(5),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
export type MenuItem = z.infer<typeof menuItemSchema>;

export const menuCategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});
export type MenuCategory = z.infer<typeof menuCategorySchema>;

/** The full menu payload sent to the storefront and the admin editor. */
export const menuSchema = z.object({
  categories: z.array(menuCategorySchema),
  items: z.array(menuItemSchema),
  modifierGroups: z.array(modifierGroupSchema),
});
export type Menu = z.infer<typeof menuSchema>;

/** Lowest applicable price for an item, in paise. */
export function itemFromPrice(item: Pick<MenuItem, "basePrice" | "variants">): number {
  if (item.variants.length === 0) return item.basePrice;
  return Math.min(...item.variants.map((v) => v.price));
}

/** Display string: a single price or a range. */
export function itemPriceLabel(item: Pick<MenuItem, "basePrice" | "variants">): string {
  if (item.variants.length === 0) return formatINR(item.basePrice);
  const prices = item.variants.map((v) => v.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatINR(min) : `${formatINR(min)} – ${formatINR(max)}`;
}
