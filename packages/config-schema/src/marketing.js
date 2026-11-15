import { z } from "zod";
import { customerGenderSchema } from "./customer.js";
import { normalizeWaPhone } from "./whatsapp.js";

/**
 * Marketing — a message from the store to its customers, over whichever of the three ways to reach them the store
 * has set up. Shared by the API (validates and builds the audience) and the dashboard (draws the forms).
 */

/* ----------------------------------------------------------------- channels */

/** The three ways to reach a customer. */
export const MARKETING_CHANNELS = ["wa-linked", "sms", "wa-api"];
export const MARKETING_CHANNEL_LABELS = {
  "wa-linked": "WhatsApp (linked numbers)",
  sms: "SMS",
  "wa-api": "WhatsApp Business API",
};
export const MARKETING_CHANNEL_HELP = {
  "wa-linked": "Sent from the WhatsApp numbers you linked in WhatsApp → Numbers. Free text, sent slowly and carefully so the numbers stay safe.",
  sms: "Sent through your SMS gateway (Settings → Notifications). Free text — your gateway may need it to match a registered template.",
  "wa-api": "Sent through Meta's WhatsApp Business API. Meta only allows pre-approved templates for messages you start.",
};

/** Words in a message that are replaced with each person's own details. */
export const MARKETING_VARIABLES = [
  { key: "customerName", label: "Customer name", sample: "Asha", fallback: "there" },
  { key: "storeName", label: "Store name", sample: "Your Store", fallback: "" },
];

/** Fill `{{customerName}}`-style words. Unknown words are left as written. */
export function renderMarketing(text, values) {
  return String(text ?? "").replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key) => (key in values ? String(values[key]) : m));
}

/** The most one campaign may go to — a safety net against a mis-click, not a business limit. */
export const MARKETING_MAX_RECIPIENTS = 20000;
export const MARKETING_SMS_MAX = 1000;

/* ------------------------------------------------------------------ filters */

export const TIME_UNITS = ["days", "weeks", "months"];
export const TIME_UNIT_LABELS = { days: "days", weeks: "weeks", months: "months" };
const spanSchema = z.object({ value: z.number().int().min(1).max(3650), unit: z.enum(TIME_UNITS) });

/** a span like 2 months → the date that long ago */
export function dateAgo(span, now = new Date()) {
  const d = new Date(now);
  if (span.unit === "days") d.setDate(d.getDate() - span.value);
  else if (span.unit === "weeks") d.setDate(d.getDate() - span.value * 7);
  else d.setMonth(d.getMonth() - span.value);
  return d;
}

export const MARKETING_ORDER_TYPES = ["takeaway", "delivery", "dine-in"];
export const MARKETING_ORDER_TYPE_LABELS = { takeaway: "Takeaway", delivery: "Delivery", "dine-in": "Dine-in" };

/**
 * Every filter is optional (null = not used); the ones that are used must ALL match.
 * Anything about orders is counted over `outletIds` — empty means the whole store.
 */
export const marketingFiltersSchema = z.object({
  /** "has not visited for more than N days / weeks / months" */
  lastOrder: z
    .object({
      olderThan: spanSchema,
      /** also include people who signed up but never ordered */
      includeNeverOrdered: z.boolean().default(false),
    })
    .nullable()
    .default(null),
  /** ordered these items (matched by name, across the chosen outlets) */
  items: z
    .object({
      names: z.array(z.string().trim().min(1).max(120)).min(1).max(30),
      /** any one of them, or all of them */
      match: z.enum(["any", "all"]).default("any"),
      /** at least this many in total (per item when match = all) */
      minQuantity: z.number().int().min(1).max(10000).default(1),
    })
    .nullable()
    .default(null),
  /** their age TODAY — one age, or a range (it grows with the years, see currentAge) */
  age: z
    .object({
      exact: z.number().int().min(1).max(120).nullable().default(null),
      min: z.number().int().min(1).max(120).nullable().default(null),
      max: z.number().int().min(1).max(120).nullable().default(null),
    })
    .nullable()
    .default(null),
  gender: z.array(customerGenderSchema).default([]),
  /** "more takeaways": at least N orders of one type */
  orderType: z
    .object({
      channel: z.enum(MARKETING_ORDER_TYPES),
      minOrders: z.number().int().min(1).max(10000).default(1),
    })
    .nullable()
    .default(null),
  /** delivered to an address that mentions this, and/or within N km of a point (from their delivery orders) */
  area: z
    .object({
      text: z.string().trim().max(120).default(""),
      near: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), km: z.number().min(0.1).max(100) }).nullable().default(null),
    })
    .nullable()
    .default(null),
  /** the outlets the order-based filters look at; empty = the whole store */
  outletIds: z.array(z.string()).default([]),
  /** only count orders from the last N days / weeks / months (items and order-type filters); null = ever */
  window: spanSchema.nullable().default(null),
});

export const marketingAudienceSchema = z.object({
  /** people who have ordered / signed up with the store, narrowed by the filters */
  customers: z.object({ enabled: z.boolean().default(false), filters: marketingFiltersSchema.default({}) }).default({}),
  /** people who messaged the store on its linked WhatsApp numbers (they may not be customers) */
  waChats: z.boolean().default(false),
  /** saved contact lists */
  listIds: z.array(z.string()).default([]),
  /** numbers typed or pasted in — one per line, optionally with a name */
  numbers: z.string().max(400_000).default(""),
});

/** The text for each way of reaching them, per channel. */
export const marketingCampaignSchema = z
  .object({
    name: z.string().trim().min(1, "Give the campaign a name").max(80),
    channel: z.enum(MARKETING_CHANNELS),
    message: z.string().trim().max(3000).default(""),
    /** WhatsApp Business API: the Meta-approved template, and what fills its {{1}}, {{2}}… */
    template: z
      .object({
        name: z.string().trim().min(1).max(120),
        language: z.string().trim().min(2).max(10).default("en"),
        /** one entry per template placeholder: a variable key, or "text:literal words" */
        params: z.array(z.string().max(300)).max(10).default([]),
      })
      .nullable()
      .default(null),
    audience: marketingAudienceSchema,
  })
  .superRefine((c, ctx) => {
    if (c.channel === "wa-api") {
      if (!c.template) ctx.addIssue({ code: "custom", path: ["template"], message: "Enter the approved template's name" });
    } else if (!c.message) {
      ctx.addIssue({ code: "custom", path: ["message"], message: "Write the message" });
    }
    if (c.channel === "sms" && c.message.length > MARKETING_SMS_MAX) {
      ctx.addIssue({ code: "custom", path: ["message"], message: `Keep an SMS under ${MARKETING_SMS_MAX} characters` });
    }
  });

/* ------------------------------------------------------------ pasted numbers */

const looksLikePhone = (token) => token.replace(/\D/g, "").length >= 7;

/**
 * Turn pasted / uploaded text into people: one number per line, optionally with a name ("Asha, 98765 43210" or
 * "98765 43210, Asha"); a line of several numbers separated by commas works too. Returns the usable numbers
 * (normalised, de-duplicated), the lines that weren't usable and why, and how many repeats were dropped.
 */
export function parseContacts(text) {
  const valid = [];
  const invalid = [];
  const seen = new Set();
  let duplicates = 0;
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const tokens = line
      .split(/[,;\t]/)
      .map((t) => t.trim().replace(/^"|"$/g, "").trim())
      .filter(Boolean);
    const phones = tokens.filter(looksLikePhone);
    if (!phones.length) {
      // a header row ("name, phone") has no digits at all — skip it quietly
      if (!/\d/.test(line)) continue;
      invalid.push({ line, reason: "No phone number found" });
      continue;
    }
    const names = tokens.filter((t) => !looksLikePhone(t));
    const name = phones.length === 1 ? (names[0] ?? "").slice(0, 80) : "";
    for (const p of phones) {
      const phone = normalizeWaPhone(p);
      // a 12-digit Indian number must be a mobile (starts 6-9 after the 91)
      const indianOk = !(phone.length === 12 && phone.startsWith("91")) || /^[6-9]/.test(phone.slice(2));
      if (!phone || !indianOk) {
        invalid.push({ line: p, reason: "Not a valid mobile number" });
        continue;
      }
      if (seen.has(phone)) {
        duplicates++;
        continue;
      }
      seen.add(phone);
      valid.push({ phone, name });
    }
  }
  return { valid, invalid, duplicates };
}

/** "919876543210" → what an SMS gateway usually wants for an Indian number: the 10 digits. */
export const smsNumber = (digits) => (String(digits).length === 12 && String(digits).startsWith("91") ? String(digits).slice(2) : String(digits));
