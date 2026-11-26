import { z } from "zod";

/**
 * What the app expects from the server. Every answer is checked against these, so a change on the server shows up as one clear message
 * ("the app and the server do not agree") instead of a screen that quietly breaks. Fields the app does not use are not listed.
 * Money is in paise (whole numbers), as the server sends it.
 */

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  isSuperAdmin: z.boolean(),
  role: z.string().nullable(),
  brandId: z.string().nullable(),
  permissions: z.array(z.string()),
});
export type User = z.infer<typeof userSchema>;

export const appLoginSchema = z.object({ token: z.string().min(20), expiresAt: z.string(), user: userSchema });
export type AppLogin = z.infer<typeof appLoginSchema>;

export const meSchema = z.object({ user: userSchema });

/** Whether this phone's address is blocked from signing in right now (after too many wrong passwords). */
export const guardSchema = z.object({ blocked: z.boolean(), retryAfterSec: z.number().optional(), attemptsLeft: z.number().optional() });
export type Guard = z.infer<typeof guardSchema>;

/** The server calls an outlet's id `_id`; the app only ever sees `id`. An outlet the platform has blocked (over its plan's limit) is marked `blocked`. */
export const outletSchema = z
  .object({ _id: z.string(), name: z.string(), slug: z.string(), brandId: z.string(), brandName: z.string().optional(), blocked: z.unknown().nullish() })
  .transform((o) => ({ id: o._id, name: o.name, slug: o.slug, brandId: o.brandId, brandName: o.brandName ?? "", blocked: Boolean(o.blocked) }));
export type Outlet = z.output<typeof outletSchema>;
export const outletsSchema = z.object({ outlets: z.array(outletSchema) });

/* ---------------------------------------------------------------- the menu */

export const foodTypeSchema = z.enum(["veg", "non-veg", "egg"]);
export type FoodType = z.infer<typeof foodTypeSchema>;

export const variantSchema = z.object({ id: z.string(), label: z.string(), price: z.number() });
export const modifierOptionSchema = z.object({ id: z.string(), label: z.string(), priceDelta: z.number() });
export const modifierGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  required: z.boolean(),
  minSelect: z.number(),
  maxSelect: z.number(),
  options: z.array(modifierOptionSchema),
});
export type ModifierGroup = z.infer<typeof modifierGroupSchema>;
export type ModifierOption = z.infer<typeof modifierOptionSchema>;

export const menuItemSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  name: z.string(),
  description: z.string().default(""),
  foodType: foodTypeSchema,
  tags: z.array(z.string()).default([]),
  images: z.array(z.object({ url: z.string(), ratio: z.string().optional() })).default([]),
  basePrice: z.number(),
  variants: z.array(variantSchema).default([]),
  modifierGroupIds: z.array(z.string()).default([]),
  isAvailable: z.boolean(),
  sortOrder: z.number().default(0),
});
/** A dish as the order screen uses it: the server's dish, plus what the "unavailable now" answer says about it. */
export type MenuItem = z.infer<typeof menuItemSchema> & { unavailableLabel?: string | null; lowLeft?: number | null };

export const menuCategorySchema = z.object({ id: z.string(), name: z.string(), parentId: z.string().nullable(), isActive: z.boolean(), sortOrder: z.number().default(0) });
export type MenuCategory = z.infer<typeof menuCategorySchema>;

/** `version` is a fingerprint of what the menu IS (not of how many are left): the app compares it to know when its copy is old. */
export const menuSchema = z.object({ categories: z.array(menuCategorySchema), items: z.array(menuItemSchema), modifierGroups: z.array(modifierGroupSchema), version: z.string().optional() });
export type Menu = z.infer<typeof menuSchema>;

/** What can't be ordered RIGHT NOW (a few lines, not the whole menu). A dish that is not in `unavailable` can be ordered. */
export const unavailableSchema = z.object({
  version: z.string().optional(),
  unavailable: z.array(z.object({ id: z.string(), label: z.string().default("Sold out") })).default([]),
  low: z.array(z.object({ id: z.string(), left: z.number() })).default([]),
  at: z.string().optional(),
});
export type Unavailable = z.infer<typeof unavailableSchema>;

/* ----------------------------------------------------------------- customers */

/** A customer the typed digits match (the dropdown under the mobile-number box). */
export const customerHitSchema = z.object({
  id: z.string(),
  name: z.string().nullish().transform((v) => v ?? null),
  phone: z.string(),
  email: z.string().nullish().transform((v) => v ?? null),
  visits: z.number().default(0),
  coins: z.number().default(0),
});
export type CustomerHit = z.infer<typeof customerHitSchema>;
export const customersSchema = z.object({ customers: z.array(customerHitSchema) });

/* ------------------------------------------------------------------ tables */

export const TABLE_STATUSES = ["free", "seated", "bill-requested", "reserved"] as const;
export const tableSchema = z.object({
  id: z.string(),
  number: z.string(),
  zone: z.string().nullish().transform((z0) => z0 ?? ""),
  seats: z.number(),
  status: z.enum(TABLE_STATUSES),
  isActive: z.boolean(),
  activeSessionId: z.string().nullish().transform((v) => v ?? null),
});
export type Table = z.infer<typeof tableSchema>;
export const tablesSchema = z.object({ tables: z.array(tableSchema) });

export const sessionSchema = z.object({
  id: z.string(),
  tableId: z.string(),
  tableNumber: z.string(),
  customerName: z.string().nullish().transform((v) => v ?? null),
  customerPhone: z.string().nullish().transform((v) => v ?? null),
  openedAt: z.string(),
  orderCount: z.number(),
  openOrders: z.number(),
  tab: z.number(),
  unpaidTotal: z.number(),
  allPaid: z.boolean(),
});
export type Session = z.infer<typeof sessionSchema>;
export const sessionsSchema = z.object({ sessions: z.array(sessionSchema) });

/* ------------------------------------------------------------------ orders */

export const lineSchema = z.object({
  itemId: z.string(),
  name: z.string(),
  foodType: foodTypeSchema,
  variantId: z.string().nullish().transform((v) => v ?? null),
  variantLabel: z.string().nullish().transform((v) => v ?? null),
  modifiers: z.array(modifierOptionSchema).default([]),
  quantity: z.number(),
  unitPrice: z.number(),
  lineTotal: z.number(),
  note: z.string().nullish().transform((v) => v ?? null),
});
export type OrderLine = z.infer<typeof lineSchema>;

export const totalsSchema = z.object({
  subtotal: z.number(),
  discount: z.number(),
  taxAmount: z.number(),
  serviceCharge: z.number(),
  roundOff: z.number(),
  grandTotal: z.number(),
});
export type Totals = z.infer<typeof totalsSchema>;

export const quoteSchema = z.object({ lines: z.array(lineSchema), totals: totalsSchema, pricesIncludeTax: z.boolean() });
export type Quote = z.infer<typeof quoteSchema>;

export const orderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  status: z.string(),
  lines: z.array(lineSchema),
  totals: totalsSchema,
  payment: z.object({ gateway: z.string().nullish(), status: z.string() }),
  note: z.string().nullish().transform((v) => v ?? null),
  customer: z.object({ name: z.string().nullish(), phone: z.string().nullish() }).nullish(),
  tableId: z.string().nullish().transform((v) => v ?? null),
  sessionId: z.string().nullish().transform((v) => v ?? null),
  placedBy: z.string().optional(),
  staffName: z.string().nullish().transform((v) => v ?? null),
  createdAt: z.string(),
});
export type Order = z.infer<typeof orderSchema>;
export const placedOrderSchema = z.object({ order: orderSchema });
export const ordersSchema = z.object({ orders: z.array(orderSchema) });

/* --------------------------------------------------------- table actions */

export const moveSchema = z.object({ session: z.object({ _id: z.string(), tableId: z.string() }), from: tableSchema, to: tableSchema });
export const paymentSchema = z.object({ tab: z.number(), unpaidTotal: z.number(), allPaid: z.boolean() });
export const closedSchema = z.object({ session: z.object({ _id: z.string(), status: z.string() }) });
