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

/* ---------------------------------------------------------------------- the kitchen board */

export type FoodType = "veg" | "egg" | "non-veg";
export const stageSchema = z.enum(["new", "preparing", "ready"]);
export type Stage = z.infer<typeof stageSchema>;
export const stationSchema = z.enum(["kitchen", "bar"]);
export type Station = z.infer<typeof stationSchema>;
export type Screen = "all" | Station;

/** One order on the kitchen's screen: what to make, where it is going, how long it has waited, and where each prep station is with it. */
export const kitchenOrderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  channel: z.enum(["takeaway", "dine-in", "delivery"]),
  tableNumber: z.string().nullable(),
  customerName: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: z.string(),
  acceptedAt: z.string(),
  scheduledFor: z.string().nullable(),
  stage: stageSchema,
  stations: z.array(z.object({ station: stationSchema, stage: stageSchema })),
  lines: z.array(z.object({ name: z.string(), variantLabel: z.string().default(""), modifiers: z.array(z.string()).default([]), quantity: z.number(), note: z.string().default(""), station: stationSchema })),
});
export type KitchenOrder = z.infer<typeof kitchenOrderSchema>;

export const kitchenBoardSchema = z.object({
  screen: z.string(),
  now: z.number(),
  settings: z.object({ warnAfterMinutes: z.number(), lateAfterMinutes: z.number(), notifyWaiter: z.boolean().default(false) }),
  orders: z.array(kitchenOrderSchema),
});
export type KitchenBoard = z.infer<typeof kitchenBoardSchema>;

/* ---------------------------------------------------------------------- dishes: available / sold out / unavailable */

export const itemStateSchema = z.enum(["available", "sold-out", "unavailable"]);
export type ItemState = z.infer<typeof itemStateSchema>;

export const kitchenItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  categoryId: z.string().nullable(),
  categoryName: z.string().default(""),
  foodType: z.string().default("veg"),
  image: z.string().nullable().default(null),
  state: itemStateSchema,
  switchedOff: z.boolean(),
  /** a dish that is counted (so many left today); null = not counted */
  stock: z.object({ left: z.number(), daily: z.number().nullable(), lowAt: z.number() }).nullable(),
  low: z.boolean().default(false),
  changedAt: z.string().nullable().default(null),
});
export type KitchenItem = z.infer<typeof kitchenItemSchema>;

export const kitchenItemsSchema = z.object({ items: z.array(kitchenItemSchema), categories: z.array(z.object({ id: z.string(), name: z.string() })) });
export const itemSetSchema = z.object({ item: kitchenItemSchema.extend({ stillSoldOut: z.boolean().default(false) }) });

/* ---------------------------------------------------------------------- the manager's numbers */

export const summarySchema = z.object({
  now: z.object({ new: z.number().default(0), preparing: z.number().default(0), ready: z.number().default(0) }),
  today: z.object({
    ready: z.number(),
    averageMinutes: z.number().nullable(),
    lateCount: z.number(),
    slowest: z.object({ orderNumber: z.string(), minutes: z.number() }).nullable(),
    topDishes: z.array(z.object({ name: z.string(), quantity: z.number() })),
  }),
  settings: z.object({ warnAfterMinutes: z.number(), lateAfterMinutes: z.number() }),
});
export type Summary = z.infer<typeof summarySchema>;

export const stagedSchema = z.object({ order: z.unknown() });

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
