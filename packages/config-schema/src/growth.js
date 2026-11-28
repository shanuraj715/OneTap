import { z } from "zod";
import { parseHHMM } from "./clock.js";

/* ------------------------------------------------------------- ratings & feedback */

/**
 * After an order is completed the customer can rate it (1–5 stars) and leave a comment, from their Account page.
 * A happy customer (`googleMinStars` or more) is then offered the store's Google review page, if it has one.
 */
export const feedbackSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  /** the store's "write a review" link on Google — empty = don't offer it */
  googleReviewUrl: z
    .string()
    .trim()
    .max(400)
    .refine((v) => v === "" || /^https:\/\//i.test(v), "Paste the full https:// link")
    .default(""),
  googleMinStars: z.number().int().min(3).max(5).default(4),
});

/** A rating a customer can change for this long after giving it. */
export const FEEDBACK_EDIT_DAYS = 7;
/** An order can be rated for this long after it was placed. */
export const FEEDBACK_WINDOW_DAYS = 30;

export const FEEDBACK_TAGS = {
  good: ["Tasty", "Hot & fresh", "Good portion", "Good packing", "On time", "Friendly staff"],
  bad: ["Cold", "Late", "Small portion", "Missing item", "Packing", "Too spicy"],
};

/** One dish of the order rated on its own: which dish, 1–5 stars and an optional short note. */
export const feedbackItemInputSchema = z.object({
  itemId: z.string().min(1).max(40),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(200).default(""),
});

export const feedbackInputSchema = z.object({
  outletId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).default(""),
  tags: z.array(z.string().max(30)).max(6).default([]),
  /** each dish rated on its own (optional). Left out = the dish ratings stay as they were; an empty list = remove them. */
  items: z.array(feedbackItemInputSchema).max(30).optional(),
});

/* ----------------------------------------------------------------- suggestions */

/**
 * "Goes well with your order" on the order page: the dishes the owner chose for what is in the cart ("Goes well
 * with" on a dish), then — when `auto` is on — what other customers most often ordered together with them.
 */
export const upsellSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  auto: z.boolean().default(true),
  title: z.string().trim().max(60).default("Goes well with your order"),
});

/** How many suggestions the order page shows at most. */
export const MAX_SUGGESTIONS = 6;

/* --------------------------------------------------------------- menu by the hour */

export const menuTimesSchema = z.object({
  /** dishes outside their hours: hidden (true) or shown greyed with their hours (false) */
  hideOutsideHours: z.boolean().default(false),
});

/* ------------------------------------------------------------ abandoned-cart reminders */

/**
 * One store-wide setting (not per outlet). A signed-in customer who puts food in the cart and leaves without ordering
 * gets ONE reminder after `delayMinutes` — only inside the sending hours, never more than once in `minDaysBetween`
 * days, never for a cart older than a day, and never if they ordered since.
 */
export const CART_REMINDER_CHANNELS = ["auto", "linked", "sms"];
export const CART_REMINDER_CHANNEL_LABELS = {
  auto: "WhatsApp from your linked number, else SMS",
  linked: "WhatsApp from your linked number only",
  sms: "SMS only",
};
export const DEFAULT_CART_REMINDER = "Hi {{name}}, you left {{items}} in your cart at {{store}}. It's still waiting for you — order here: {{link}}";
export const CART_REMINDER_VARIABLES = {
  name: "The customer's first name (or \"there\")",
  items: "What is in the cart, e.g. 2× Veg Momos, 1× Masala Chai",
  total: "The cart's value, e.g. ₹349",
  store: "Your store's name",
  outlet: "The outlet the cart is from",
  link: "A link straight to their cart",
};

const hhmm = z.string().refine((v) => parseHHMM(v) !== null, "Use a time like 10:00");

export const cartRemindersSchema = z.object({
  enabled: z.boolean().default(false),
  /** how long a cart must sit untouched before the reminder */
  delayMinutes: z.number().int().min(15).max(720).default(30),
  /** reminders only go out between these times (India time) */
  sendFrom: hhmm.default("10:00"),
  sendUntil: hhmm.default("21:00"),
  /** at most one reminder per customer in this many days */
  minDaysBetween: z.number().int().min(1).max(30).default(3),
  channel: z.enum(CART_REMINDER_CHANNELS).default("auto"),
  message: z.string().trim().max(600).default(""),
});

/** Carts older than this are never reminded about — the moment has passed. */
export const CART_REMINDER_MAX_AGE_HOURS = 24;
/** An order within this long of a reminder counts as won back by it. */
export const CART_RECOVERY_HOURS = 48;

/** "2× Veg Momos, 1× Masala Chai and 2 more" */
export function cartItemsText(lines, max = 3) {
  const parts = lines.map((l) => `${l.quantity}× ${l.name}`);
  if (parts.length <= max) return parts.join(", ");
  return `${parts.slice(0, max).join(", ")} and ${parts.length - max} more`;
}
