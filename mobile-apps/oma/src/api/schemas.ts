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
  /** takeaway/delivery orders only (a table's order has none of these) */
  deliveryFee: z.number().optional(),
  coinsDiscount: z.number().optional(),
  cgst: z.number().optional(),
  sgst: z.number().optional(),
});
export type Totals = z.infer<typeof totalsSchema>;

export const quoteSchema = z.object({ lines: z.array(lineSchema), totals: totalsSchema, pricesIncludeTax: z.boolean() });
export type Quote = z.infer<typeof quoteSchema>;

const nullable = <T extends z.ZodType>(t: T) => t.nullish().transform((v) => v ?? null);

/** One step of an order's life: what it became, when, by whom (an id — names are not sent), and whether a person forced it or edited the order. */
export const statusStepSchema = z.object({
  status: z.string(),
  at: z.string(),
  by: nullable(z.string()),
  manual: z.boolean().optional(),
  edited: z.boolean().optional(),
  from: nullable(z.string()),
  reason: nullable(z.string()),
});
export type StatusStep = z.infer<typeof statusStepSchema>;

export const deliveryAddressSchema = z.object({ text: nullable(z.string()), landmark: nullable(z.string()), lat: nullable(z.number()), lng: nullable(z.number()), distanceKm: nullable(z.number()) });
export const orderRiderSchema = z.object({ riderId: nullable(z.string()), name: z.string(), phone: nullable(z.string()), assignedAt: nullable(z.string()) });

export const orderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  /** "dine-in" | "takeaway" | "delivery" */
  channel: z.string().default("dine-in"),
  status: z.string(),
  lines: z.array(lineSchema),
  totals: totalsSchema,
  pricesIncludeTax: z.boolean().default(true),
  payment: z.object({ gateway: z.string().nullish(), status: z.string(), paymentId: nullable(z.string()) }),
  note: z.string().nullish().transform((v) => v ?? null),
  customer: z.object({ name: z.string().nullish(), phone: z.string().nullish(), email: z.string().nullish() }).nullish(),
  tableId: z.string().nullish().transform((v) => v ?? null),
  sessionId: z.string().nullish().transform((v) => v ?? null),
  couponCode: nullable(z.string()),
  deliveryAddress: deliveryAddressSchema.nullish().transform((v) => v ?? null),
  etaMinutes: nullable(z.number()),
  /** a pre-order: when the customer wants it */
  scheduledFor: nullable(z.string()),
  rider: orderRiderSchema.nullish().transform((v) => v ?? null),
  statusHistory: z.array(statusStepSchema).default([]),
  placedBy: z.string().optional(),
  staffName: z.string().nullish().transform((v) => v ?? null),
  createdAt: z.string(),
});
export type Order = z.infer<typeof orderSchema>;
export const placedOrderSchema = z.object({ order: orderSchema });
export const ordersSchema = z.object({ orders: z.array(orderSchema) });

/* ------------------------------------------------------- managing an order */

/** After a status change: the order, and — when a re-opened order had to be seated again — the table. */
export const orderChangedSchema = z.object({ order: orderSchema, table: z.object({ id: z.string().optional(), number: z.string().optional(), moved: z.boolean().optional() }).passthrough().optional() });
export const orderDeletedSchema = z.object({ ok: z.boolean().optional(), orderNumber: z.string().optional() });
export const riderSchema = z.object({ id: z.string(), name: z.string(), phone: nullable(z.string()), isActive: z.boolean().default(true) });
export type Rider = z.infer<typeof riderSchema>;
export const ridersSchema = z.object({ riders: z.array(riderSchema) });
export const printerSchema = z.object({ id: z.string(), name: z.string(), station: z.string(), docType: z.string(), target: z.string(), isActive: z.boolean().default(true), configError: nullable(z.string()) });
export type Printer = z.infer<typeof printerSchema>;
export const printersSchema = z.object({ printers: z.array(printerSchema) });
export const printJobSchema = z.object({ job: z.object({ id: z.string(), status: z.string(), printerName: nullable(z.string()), docType: nullable(z.string()), lastError: nullable(z.string()) }) });

/* --------------------------------------------------------- table actions */

export const moveSchema = z.object({ session: z.object({ _id: z.string(), tableId: z.string() }), from: tableSchema, to: tableSchema });
export const paymentSchema = z.object({ tab: z.number(), unpaidTotal: z.number(), allPaid: z.boolean() });
export const closedSchema = z.object({ session: z.object({ _id: z.string(), status: z.string() }) });

/** One published version of this app, as the server describes it (the file's address included). */
export const releaseSchema = z.object({
  id: z.string(),
  version: z.string(),
  versionCode: z.number(),
  notes: z.string().default(""),
  force: z.boolean().default(false),
  size: z.number().default(0),
  downloadUrl: z.string().default(""),
});
export type Release = z.infer<typeof releaseSchema>;

/** What changed in a version newer than this one (up to five, newest first). */
export const whatsNewSchema = z.object({ version: z.string(), versionCode: z.number(), notes: z.string().default(""), force: z.boolean().default(false) });
export type WhatsNew = z.infer<typeof whatsNewSchema>;

/** The answer to "is there a newer version of the app than the one on this phone?" Needs no sign-in. */
export const updateCheckSchema = z.object({
  updateAvailable: z.boolean(),
  /** some version newer than this one is marked "required": this phone has to update before it can be used */
  force: z.boolean(),
  latest: releaseSchema.nullable(),
  whatsNew: z.array(whatsNewSchema).default([]),
  /** the website page people download the app from (opened in the phone's browser) */
  pageUrl: z.string(),
});
export type UpdateCheck = z.infer<typeof updateCheckSchema>;

/** The extra facts of the server's "426 update_required" refusal (an old build trying to sign in while an update is required). */
export const updateRequiredSchema = z.object({ code: z.literal("update_required"), pageUrl: z.string(), latest: releaseSchema.nullable().optional() });
export type UpdateRequired = z.infer<typeof updateRequiredSchema>;
