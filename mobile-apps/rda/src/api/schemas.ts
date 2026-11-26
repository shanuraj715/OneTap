import { z } from "zod";

/**
 * What the app expects from the server. Every answer is checked against these, so a change on the server shows up as one clear message
 * ("the app and the server do not agree") instead of a screen that quietly breaks. Fields the app does not use are not listed.
 */

/** The rider who is signed in, and where they work. */
export const riderSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().default(""),
  outletId: z.string(),
  outletName: z.string().default(""),
  storeName: z.string().default(""),
});
export type Rider = z.infer<typeof riderSchema>;

export const riderLoginSchema = z.object({ token: z.string().min(20), expiresAt: z.string(), rider: riderSchema });
export type RiderLogin = z.infer<typeof riderLoginSchema>;
export const meSchema = z.object({ rider: riderSchema });

/** Whether this phone's address is blocked from signing in right now (after too many wrong PINs). */
export const guardSchema = z.object({ blocked: z.boolean(), retryAfterSec: z.number().optional(), attemptsLeft: z.number().optional() });
export type Guard = z.infer<typeof guardSchema>;

/* ---------------------------------------------------------------------- the deliveries */

export const deliveryStatusSchema = z.enum(["placed", "accepted", "preparing", "ready", "out_for_delivery", "completed", "cancelled"]);
export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;

/** One delivery handed to this rider: where to, who to call, what is in the bag. (The server never sends the delivery code.) */
export const deliverySchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  status: deliveryStatusSchema,
  placedAt: z.string(),
  assignedAt: z.string().nullable().default(null),
  pickedUpAt: z.string().nullable().default(null),
  deliveredAt: z.string().nullable().default(null),
  customer: z.object({ name: z.string().default(""), phone: z.string().default("") }),
  address: z.object({
    text: z.string().default(""),
    landmark: z.string().default(""),
    lat: z.number().nullable().default(null),
    lng: z.number().nullable().default(null),
    distanceKm: z.number().nullable().default(null),
  }),
  items: z.array(z.object({ name: z.string(), variantLabel: z.string().default(""), quantity: z.number(), modifiers: z.array(z.string()).default([]), note: z.string().default("") })),
  note: z.string().default(""),
  payment: z.object({ gateway: z.string().default("cod"), status: z.string().default("pending") }),
  /** the customer has a 4-digit code to tell the rider before the order can be marked delivered */
  needsCode: z.boolean().default(false),
});
export type Delivery = z.infer<typeof deliverySchema>;

export const deliveriesSchema = z.object({ deliveries: z.array(deliverySchema), deliveredToday: z.array(deliverySchema).default([]), now: z.number().optional() });
export type Deliveries = z.infer<typeof deliveriesSchema>;
export const deliveryResultSchema = z.object({ delivery: deliverySchema });

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
