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
  { key: "favicon", label: "Own favicon", description: "The store's own icon in the browser tab, on every outlet's pages." },
  {
    key: "customDomain",
    label: "Own domain name",
    description: "The storefront opens on the restaurant's own domain (like dominos.com). Without it, the store gets a TablePe address.",
  },
];
export const FEATURE_KEYS = FEATURES.map((f) => f.key);

export const QR_CARD_FAMILY_IDS = CARD_TEMPLATE_FAMILIES.map((f) => f.id);

/** `null` means unlimited. */
export const planLimitsSchema = z.object({
  /** everyone with access to the store, owners included */
  maxUsers: z.number().int().min(1).nullable().default(null),
  /** off → the store is capped at one outlet, whatever maxOutlets says */
  multiOutlet: z.boolean().default(true),
  maxOutlets: z.number().int().min(1).nullable().default(null),
});

export const entitlementsSchema = z.object({
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
  limits: Object.freeze({ maxUsers: 1, multiOutlet: false, maxOutlets: 1 }),
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

const defined = (obj = {}) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined));

/** The limits and entitlements that actually apply to a store: its plan, with the store's overrides on top. */
export function resolvePlan(plan, overrides) {
  const base = !plan
    ? UNLIMITED
    : plan.custom
      ? CUSTOM_PLAN_BASE
      : { limits: planLimitsSchema.parse(plan.limits ?? {}), entitlements: entitlementsSchema.parse(plan.entitlements ?? {}) };
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
    },
    wallet: { ...config.wallet, enabled: config.wallet.enabled && has("wallet") },
    payments: { ...config.payments, enabled: gateways.length ? gateways : ["cod"] },
    effect: effectAllowed(entitlements, config.effect.style) ? config.effect : { ...config.effect, style: "none" },
    branding: has("favicon") ? config.branding : { ...config.branding, faviconUrl: "" },
  };
}
