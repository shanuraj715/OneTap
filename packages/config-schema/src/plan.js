import { z } from "zod";
import { EFFECT_IDS } from "./effect.js";
import { CARD_TEMPLATE_FAMILIES } from "./qr-card-templates.js";

/**
 * Platform plans: what a client store has bought. The platform super admin
 * defines plans (limits + which features/effects/QR card styles they unlock),
 * assigns one to each store, and can override any single value per store.
 *
 * A store with NO plan is a legacy store: unlimited, everything unlocked —
 * so stores created before plans existed behave exactly as they always did.
 */

/** Things a plan can unlock. The owner can still switch an unlocked feature off. */
export const FEATURES = [
  { key: "takeaway", label: "Takeaway ordering", description: "Customers order online and collect at the counter." },
  { key: "dineInQr", label: "Dine-in QR ordering", description: "Customers scan the table QR and order from their seat." },
  { key: "delivery", label: "Delivery", description: "Home delivery orders, paid online." },
  { key: "onlinePayments", label: "Online payments", description: "Razorpay checkout (UPI, cards, wallets)." },
  { key: "coupons", label: "Coupons", description: "Discount codes customers enter at checkout." },
  { key: "wallet", label: "Coin wallet", description: "Customers earn and spend loyalty coins." },
  { key: "printing", label: "Printing", description: "Kitchen tickets and receipts on connected printers." },
  { key: "notifications", label: "WhatsApp & SMS alerts", description: "Order updates sent to customers." },
  {
    key: "whatsappChat",
    label: "WhatsApp chat",
    description: "Link the store's own WhatsApp numbers to chat with customers, send order updates and offers from the dashboard.",
  },
  {
    key: "marketing",
    label: "Marketing",
    description: "Send offers and announcements to customers, chosen by filters, over the channels the store has set up (linked WhatsApp, SMS, WhatsApp Business API).",
  },
  {
    key: "analytics",
    label: "Analytics & reports",
    description: "Sales, items, customers and outlets analysed on charts, a profit & loss calculator, stock suggestions, and reports to export (Excel, CSV, PDF).",
  },
  { key: "kitchenDisplay", label: "Kitchen display (KDS)", description: "A screen for the kitchen and the bar at /kitchen: new orders as cards by station, Start and Ready taps, late-order colours, and an optional bell for the waiter." },
  { key: "reservations", label: "Table reservations", description: "Customers book a table online; the team confirms, seats and tracks every booking." },
  { key: "scheduledOrders", label: "Pre-orders", description: "Takeaway customers choose a later pickup time — later today or the coming days." },
  { key: "feedback", label: "Ratings & feedback", description: "Customers rate completed orders; the store sees every rating and comment, and happy customers are pointed to its Google reviews." },
  {
    key: "cartReminders",
    label: "Abandoned-cart reminders",
    description: "A WhatsApp or SMS reminder to signed-in customers who left food in their cart without ordering.",
  },
  { key: "favicon", label: "Own favicon", description: "The store's own icon in the browser tab, on every outlet's pages." },
  {
    key: "customDomain",
    label: "Own domain name",
    description: "The storefront opens on the restaurant's own domain (like dominos.com). Without it, the store gets a Rasoi Pulse address.",
  },
];
export const FEATURE_KEYS = FEATURES.map((f) => f.key);

/**
 * Features that do nothing without another one. A plan (or a Custom store's unlocks) that has the first but not the second is a mistake the
 * console warns about: the customer would pay for something that can't work. `featureProblems` lists them in plain words.
 */
export const FEATURE_REQUIRES = Object.freeze({
  delivery: [["onlinePayments", "delivery orders are paid online"]],
  scheduledOrders: [["takeaway", "pre-orders are for takeaway"]],
  cartReminders: [["notifications", "a reminder is sent as a WhatsApp or SMS message"]],
  marketing: [["notifications", "offers are sent as WhatsApp or SMS messages"]],
});

/** What is wrong with a set of features: [{ feature, needs, why, text }] (empty = fine). */
export function featureProblems(keys) {
  const have = new Set(keys);
  const label = (k) => FEATURES.find((f) => f.key === k)?.label ?? k;
  const out = [];
  for (const [feature, needs] of Object.entries(FEATURE_REQUIRES)) {
    if (!have.has(feature)) continue;
    for (const [need, why] of needs) if (!have.has(need)) out.push({ feature, needs: need, why, text: `${label(feature)} needs ${label(need)} (${why}).` });
  }
  return out;
}

export const QR_CARD_FAMILY_IDS = CARD_TEMPLATE_FAMILIES.map((f) => f.id);

/**
 * Tables are sold in blocks of five: a plan offers 5, 10, 15 … tables, never 12 or 19, and the price list charges per block of five.
 * (A restaurant with 12 tables is on the 15 plan — the limit is a size, not a count.)
 */
export const TABLE_STEP = 5;

/** How many blocks of five cover `tables` tables (12 → 3). */
export const tableBlocks = (tables) => Math.ceil(Math.max(0, tables) / TABLE_STEP);

/** The smallest allowed table limit that holds `tables` (never below one block): 0 → 5, 5 → 5, 12 → 15. */
export const roundUpTables = (tables) => Math.max(1, tableBlocks(tables)) * TABLE_STEP;

/** `null` means unlimited. */
export const planLimitsSchema = z.object({
  /** everyone with access to the store, owners included */
  maxUsers: z.number().int().min(1).nullable().default(null),
  /** off → the store is capped at one outlet, whatever maxOutlets says */
  multiOutlet: z.boolean().default(true),
  maxOutlets: z.number().int().min(1).nullable().default(null),
  /** tables in the whole store (every outlet together), in steps of 5; `null` = unlimited */
  maxTables: z
    .number()
    .int()
    .min(TABLE_STEP, `A plan has at least ${TABLE_STEP} tables.`)
    .max(5000, "That is more tables than a plan can hold.")
    .refine((n) => n % TABLE_STEP === 0, `Tables go up in fives: 5, 10, 15, 20 …`)
    .nullable()
    .default(null),
});

export const entitlementsSchema = z.object({
  /**
   * On: the plan includes EVERY feature, also the ones added to the product later (a plan's own list is a snapshot, so a feature shipped after the
   * plan was made would otherwise never reach it). The list below is then just a copy of what exists today.
   */
  allFeatures: z.boolean().default(false),
  features: z.array(z.enum(FEATURE_KEYS)).default(() => [...FEATURE_KEYS]),
  /** "none" is always allowed, listed or not */
  effects: z.array(z.enum(EFFECT_IDS)).default(() => [...EFFECT_IDS]),
  qrCardFamilies: z.array(z.string()).default(() => [...QR_CARD_FAMILY_IDS]),
});

export const planSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().max(300).default(""),
  /**
   * A custom plan includes nothing by itself: each store on it gets exactly
   * the limits and features the super admin sets on that store. Its own
   * limits/entitlements are ignored (see `CUSTOM_PLAN_BASE`).
   */
  custom: z.boolean().default(false),
  limits: planLimitsSchema.default({}),
  entitlements: entitlementsSchema.default({}),
});

/**
 * What a store on a custom plan starts from before its own settings: the
 * owner alone, one outlet, nothing unlocked. Every store on a custom plan
 * carries its own limits (filled in when it's put on the plan), so in
 * practice this only shows through if those are cleared.
 */
export const CUSTOM_PLAN_BASE = Object.freeze({
  // (tables: no cap until one is set — a store that was on a custom plan before tables had a limit keeps all it has)
  limits: Object.freeze({ maxUsers: 1, multiOutlet: false, maxOutlets: 1, maxTables: null }),
  entitlements: Object.freeze({ features: [], effects: [], qrCardFamilies: [] }),
});

/** Per item: inherit from the plan unless listed — `unlock` grants it on top of the plan, `lock` takes it away. */
const adjustSchema = z.object({
  unlock: z.array(z.string()).default([]),
  lock: z.array(z.string()).default([]),
});

/**
 * Per-store overrides. A limit left undefined inherits the plan's value
 * (`null` means "unlimited"). Entitlements are adjustments rather than whole
 * lists, so locking one feature for one store doesn't freeze the rest — a
 * later change to the plan still reaches everything that wasn't overridden.
 */
export const planOverridesSchema = z.object({
  limits: planLimitsSchema.partial().default({}),
  entitlements: z
    .object({
      features: adjustSchema.default({}),
      effects: adjustSchema.default({}),
      qrCardFamilies: adjustSchema.default({}),
    })
    .default({}),
});

const UNLIMITED = Object.freeze({
  limits: planLimitsSchema.parse({}),
  entitlements: entitlementsSchema.parse({}),
});

/** The features a plan's entitlements really give: every feature when `allFeatures` is on, otherwise its list. */
export const effectiveFeatures = (entitlements) => (entitlements?.allFeatures ? [...FEATURE_KEYS] : (entitlements?.features ?? []));

const defined = (obj = {}) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

/** The limits and entitlements that actually apply to a store: its plan, with the store's overrides on top. */
export function resolvePlan(plan, overrides) {
  const base = !plan
    ? UNLIMITED
    : plan.custom
      ? CUSTOM_PLAN_BASE
      : (() => {
          const entitlements = entitlementsSchema.parse(plan.entitlements ?? {});
          return { limits: planLimitsSchema.parse(plan.limits ?? {}), entitlements: { ...entitlements, features: effectiveFeatures(entitlements) } };
        })();
  const o = planOverridesSchema.parse(overrides ?? {});
  const adjust = (list, { unlock, lock }) => [...new Set([...list, ...unlock])].filter((k) => !lock.includes(k));
  return {
    limits: { ...base.limits, ...defined(o.limits) },
    entitlements: {
      features: adjust(base.entitlements.features, o.entitlements.features),
      effects: adjust(base.entitlements.effects, o.entitlements.effects),
      qrCardFamilies: adjust(base.entitlements.qrCardFamilies, o.entitlements.qrCardFamilies),
    },
  };
}

/** How many outlets a store may have — 1 when multi-outlet is off, `Infinity` when unlimited. */
export function outletLimit(limits) {
  if (!limits.multiOutlet) return 1;
  return limits.maxOutlets ?? Infinity;
}

export const userLimit = (limits) => limits.maxUsers ?? Infinity;

/** How many tables a store may have, all outlets together — `Infinity` when unlimited. */
export const tableLimit = (limits) => limits.maxTables ?? Infinity;

export const hasFeature = (entitlements, key) => entitlements.features.includes(key);

export const effectAllowed = (entitlements, style) => style === "none" || entitlements.effects.includes(style);

export const qrFamilyAllowed = (entitlements, family) => entitlements.qrCardFamilies.includes(family);

/**
 * The outlet config the storefront and the API act on: what the owner switched
 * on, AND what the plan unlocks. The stored config is never changed — unlock a
 * feature again and the owner's own setting comes straight back.
 */
export function applyEntitlements(config, entitlements) {
  const has = (key) => hasFeature(entitlements, key);
  const ordering = config.features.ordering;
  const gateways = has("onlinePayments") ? config.payments.enabled : config.payments.enabled.filter((g) => g === "cod");

  return {
    ...config,
    features: {
      ...config.features,
      ordering: {
        takeaway: ordering.takeaway && has("takeaway"),
        dineInQr: ordering.dineInQr && has("dineInQr"),
        delivery: ordering.delivery && has("delivery"),
      },
      coupons: config.features.coupons !== false && has("coupons"),
      reservations: { ...config.features.reservations, enabled: config.features.reservations.enabled && has("reservations") },
    },
    operations: {
      ...config.operations,
      // pre-orders are for takeaway, so they need takeaway as well as the plan feature
      scheduling: { ...config.operations.scheduling, enabled: config.operations.scheduling.enabled && has("scheduledOrders") && ordering.takeaway && has("takeaway") },
    },
    feedback: { ...config.feedback, enabled: config.feedback.enabled && has("feedback") },
    wallet: { ...config.wallet, enabled: config.wallet.enabled && has("wallet") },
    payments: { ...config.payments, enabled: gateways.length ? gateways : ["cod"] },
    effect: effectAllowed(entitlements, config.effect.style) ? config.effect : { ...config.effect, style: "none" },
    branding: has("favicon") ? config.branding : { ...config.branding, faviconUrl: "" },
  };
}
