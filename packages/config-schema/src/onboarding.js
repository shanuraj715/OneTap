import { z } from "zod";
import { EFFECT_IDS } from "./effect.js";
import { FEATURES, FEATURE_KEYS, outletLimit, resolvePlan, roundUpTables, TABLE_STEP, tableLimit } from "./plan.js";
import { FONT_FAMILIES } from "./typography.js";
import { isReservedOutletSlug, slugSchema } from "./slug.js";

/**
 * The client onboarding form: everything a Rasoi Pulse representative asks a new restaurant, kept as a draft, printed, and finally
 * turned into a real store (brand + outlets + owner + settings).
 *
 * This file is the one definition of the form. The console draws it, the API validates and publishes it, and the PDF prints it.
 * Money in the form is in rupees (what people say aloud); publishing converts to the paise the app stores.
 */

/* ------------------------------------------------------------------------------------------------ small helpers */

export const slugifyName = (s) =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (max = 200) => z.string().max(max).default("");

/* ------------------------------------------------------------------------------------------------ what it knows about */

/** How a customer can order from an outlet. `feature` is the plan feature each one needs. */
export const ORDER_MODES = [
  { key: "takeaway", feature: "takeaway", label: "Takeaway", help: "Customers order online and collect at the counter." },
  { key: "dineIn", feature: "dineInQr", label: "Dine-in (table QR)", help: "Customers scan the QR on their table and order from their seat." },
  { key: "delivery", feature: "delivery", label: "Delivery", help: "Home delivery within a distance of the outlet, paid online." },
];
const ORDERING_FEATURES = ORDER_MODES.map((m) => m.feature);

/** The features the form lists as a checklist — the ordering ones are chosen per outlet instead. */
export const CHECKLIST_FEATURES = FEATURES.filter((f) => !ORDERING_FEATURES.includes(f.key));

export const BUSINESS_TYPES = ["Café", "Quick-service restaurant", "Cloud kitchen", "Restaurant with seating", "Restaurant chain", "Bakery / sweets", "Other"];
export const MENU_SOURCES = ["Client enters it themselves", "Client sends photos / PDF", "Client sends an Excel / CSV", "Rasoi Pulse enters it", "Not decided yet"];
export const THEME_MODES = [
  { id: "system", label: "Follow the visitor's device" },
  { id: "light", label: "Always light" },
  { id: "dark", label: "Always dark" },
  { id: "visitor-toggle", label: "Visitor can switch" },
];
export const LOGO_STATES = [
  { id: "will-send", label: "Client will send it" },
  { id: "link", label: "They gave a link" },
  { id: "none", label: "No logo yet" },
];

/** Ready colour schemes the representative can point at in the meeting. */
export const ONBOARDING_PALETTES = [
  { id: "classic-red", name: "Classic red", primary: "#C6362F", background: "#FFFFFF", surface: "#F6F6F4", text: "#1A1A1A" },
  { id: "fresh-green", name: "Fresh green", primary: "#2E7D46", background: "#FFFFFF", surface: "#F1F6F2", text: "#16231A" },
  { id: "royal-blue", name: "Royal blue", primary: "#1F4FA8", background: "#FFFFFF", surface: "#F1F4FA", text: "#14203A" },
  { id: "warm-orange", name: "Warm orange", primary: "#D9731A", background: "#FFFBF5", surface: "#FBF1E4", text: "#2A1B0C" },
  { id: "plum", name: "Plum", primary: "#7B2D6B", background: "#FFFFFF", surface: "#F7F0F6", text: "#23101F" },
  { id: "charcoal", name: "Charcoal & gold", primary: "#B8860B", background: "#161616", surface: "#222222", text: "#F3EFE6" },
];

/** Black or white text, whichever reads on `hex` (the brand colour). */
export function readableOn(hex) {
  if (!HEX.test(hex ?? "")) return "#FFFFFF";
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? "#1A1A1A" : "#FFFFFF";
}

/**
 * The Custom plan is always on offer, even on a server where nobody has created it yet. This stands in for it until a
 * real one exists (publishing a form on it creates the real one).
 */
export const CUSTOM_PLAN_ID = "custom";
export const VIRTUAL_CUSTOM_PLAN = Object.freeze({
  id: CUSTOM_PLAN_ID,
  name: "Custom",
  description: "Built around one restaurant — only the features and limits you agree on.",
  custom: true,
  archived: false,
  virtual: true,
  limits: {},
  entitlements: {},
  marketing: { monthly: 0, yearlyDiscount: 0 },
});

/* ------------------------------------------------------------------------------------------------ the form's shape */

export const onboardingOutletSchema = z.object({
  /** a stable key for this card while the form is edited (not the database id) */
  id: z.string().min(1).max(40),
  name: text(80),
  slug: text(63),
  phone: text(30),
  address: text(300),
  /** what the representative pasted: a Google Maps link or "lat, lng" */
  mapsLink: text(600),
  /** where that resolved to — the origin of every delivery-distance check */
  point: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).nullable().default(null),
  modes: z
    .object({
      takeaway: z.boolean().default(true),
      dineIn: z.boolean().default(false),
      delivery: z.boolean().default(false),
    })
    .default({}),
  delivery: z
    .object({
      radiusKm: z.number().min(0).max(50).default(5),
      fee: z.number().min(0).max(100000).default(0),
      freeAbove: z.number().min(0).max(1000000).default(0),
      minOrder: z.number().min(0).max(1000000).default(0),
    })
    .default({}),
  hours: z
    .object({
      useCommon: z.boolean().default(true),
      opensAt: z.string().default("11:00"),
      closesAt: z.string().default("23:00"),
      lastOrderBufferMinutes: z.number().int().min(0).max(180).default(30),
    })
    .default({}),
});

export const onboardingSchema = z.object({
  version: z.literal(1).default(1),
  meeting: z.object({ repName: text(80), date: text(10), goLive: text(10), notes: text(2000) }).default({}),
  /** the plan comes first — it decides what the rest of the form may ask for */
  planId: text(40),
  /** a Custom plan has no limits of its own: the representative sets them here */
  customLimits: z
    .object({
      maxOutlets: z.number().int().min(1).max(500).default(1),
      maxUsers: z.number().int().min(1).max(5000).default(3),
      /** tables, in steps of 5 */
      maxTables: z.number().int().min(TABLE_STEP).max(5000).default(TABLE_STEP),
    })
    .default({}),
  business: z
    .object({
      storeName: text(80),
      tagline: text(120),
      type: text(60),
      ownerName: text(80),
      ownerPhone: text(30),
      ownerEmail: text(120),
      whatsapp: text(30),
      city: text(60),
      gstin: text(20),
      fssai: text(20),
    })
    .default({}),
  /** the optional features the client wants (the ordering types are per outlet) */
  features: z.array(z.enum(FEATURE_KEYS)).default([]),
  /** things the plan doesn't include that the representative has chosen to add for this client anyway: "feature:delivery", "outlets", "users", "effect:glass" */
  forced: z.array(z.string().max(60)).default([]),
  outlets: z.array(onboardingOutletSchema).max(100).default([]),
  common: z
    .object({
      hours: z
        .object({
          opensAt: z.string().default("11:00"),
          closesAt: z.string().default("23:00"),
          lastOrderBufferMinutes: z.number().int().min(0).max(180).default(30),
        })
        .default({}),
      prepMinutes: z.number().int().min(1).max(180).default(15),
      payments: z.object({ cash: z.boolean().default(true), online: z.boolean().default(false) }).default({}),
      tax: z
        .object({
          pricesIncludeTax: z.boolean().default(true),
          gstRatePct: z.number().min(0).max(40).default(5),
          serviceChargePct: z.number().min(0).max(25).default(0),
        })
        .default({}),
    })
    .default({}),
  look: z
    .object({
      paletteId: z.string().max(30).default("classic-red"),
      primary: z.string().default("#C6362F"),
      background: z.string().default("#FFFFFF"),
      surface: z.string().default("#F6F6F4"),
      text: z.string().default("#1A1A1A"),
      mode: z.enum(["light", "dark", "system", "visitor-toggle"]).default("system"),
      effect: z.enum(EFFECT_IDS).default("none"),
      font: z.string().max(30).default("inter"),
      logo: z.enum(["none", "will-send", "link"]).default("will-send"),
      logoLink: text(600),
      references: text(600),
    })
    .default({}),
  address: z.object({ subdomain: text(40), ownDomain: text(200) }).default({}),
  /** the price estimate's one input that belongs to this client: a negotiated discount, in percent */
  quote: z.object({ discountPct: z.number().min(0).max(100).default(0) }).default({}),
  setup: z
    .object({
      menuSource: text(60),
      itemCount: text(20),
      printers: text(120),
      teamCount: z.number().int().min(0).max(500).default(0),
      /** tables the client will have (all outlets together), in steps of 5; 0 = not known / no tables */
      tableCount: z.number().int().min(0).max(5000).default(0),
      notes: text(2000),
    })
    .default({}),
});

let nextCard = 1;
/** A fresh outlet card (the ids only need to be unique inside one form). */
export function newOnboardingOutlet(over = {}) {
  return onboardingOutletSchema.parse({ id: `o${Date.now().toString(36)}${nextCard++}`, ...over });
}

/** An empty form: one outlet card, the standard defaults everywhere. */
export function blankOnboarding() {
  const data = onboardingSchema.parse({});
  data.outlets = [newOnboardingOutlet()];
  return data;
}

/** The store's own web address label, as the form implies it. */
export const onboardingSubdomain = (data) => slugifyName(data.address.subdomain || data.business.storeName);
export const onboardingOutletSlug = (o) => slugifyName(o.slug || o.name);

/* ------------------------------------------------------------------------------------------------ what the plan allows */

const featureLabel = (key) => FEATURES.find((f) => f.key === key)?.label ?? key;
const modeFeature = (modeKey) => ORDER_MODES.find((m) => m.key === modeKey).feature;

/**
 * Everything the form asks for that is a plan feature, and where it was asked.
 * `{ featureKey: [reasons…] }` — the reasons are what the alert quotes.
 */
export function wantedFeatures(data) {
  const wanted = {};
  const want = (key, why) => (wanted[key] ??= []).push(why);
  for (const key of data.features) want(key, "ticked in the features list");
  data.outlets.forEach((o, i) => {
    const name = o.name || `Outlet ${i + 1}`;
    for (const m of ORDER_MODES) if (o.modes[m.key]) want(m.feature, `${m.label} at ${name}`);
  });
  if (data.address.ownDomain.trim()) want("customDomain", "an own domain name");
  if (data.common.payments.online) want("onlinePayments", "online payments");
  return wanted;
}

/**
 * What the chosen plan allows, from the plan record (the shape the console and API both hold).
 * `null` until a plan is chosen. A Custom plan allows whatever the representative asks for — the limits typed on the form.
 */
export function planAllowances(planDoc, data) {
  if (!planDoc) return null;
  if (planDoc.custom) {
    return {
      name: planDoc.name,
      custom: true,
      maxOutlets: Math.max(data.customLimits.maxOutlets, data.outlets.length || 1),
      maxUsers: Math.max(data.customLimits.maxUsers, data.setup.teamCount + 1),
      maxTables: Math.max(roundUpTables(data.customLimits.maxTables), roundUpTables(data.setup.tableCount)),
      features: null,
      effects: null,
    };
  }
  const { limits, entitlements } = resolvePlan(planDoc, {});
  return {
    name: planDoc.name,
    custom: false,
    maxOutlets: outletLimit(limits),
    maxUsers: limits.maxUsers ?? Infinity,
    maxTables: tableLimit(limits),
    features: entitlements.features,
    effects: entitlements.effects,
  };
}

/** Can the plan do this feature? (A Custom plan can: the feature gets unlocked for the store.) */
export const planHasFeature = (allow, key) => !allow || allow.custom || allow.features.includes(key);
export const planHasEffect = (allow, effect) => !allow || allow.custom || effect === "none" || allow.effects.includes(effect);

const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * Compare the form with the plan. Every problem is an issue with a plain-words message; an issue the representative has
 * chosen to "add for this client" (its id is in `data.forced`) stays listed as added but no longer blocks publishing.
 */
export function planFit(data, allow) {
  if (!allow) {
    return { issues: [{ id: "plan", kind: "plan", forced: false, message: "Choose the plan first — what the client may have depends on it." }], blocking: true };
  }
  const forced = new Set(data.forced);
  const issues = [];
  const add = (issue) => issues.push({ ...issue, forced: forced.has(issue.id) });
  const planName = allow.name;

  if (!allow.custom) {
    for (const [key, reasons] of Object.entries(wantedFeatures(data))) {
      if (allow.features.includes(key)) continue;
      add({
        id: `feature:${key}`,
        kind: "feature",
        key,
        message: `${featureLabel(key)} isn't in the ${planName} plan (asked for: ${[...new Set(reasons)].join(", ")}). Untick it, choose another plan, or add it for this client.`,
      });
    }
    if (!planHasEffect(allow, data.look.effect)) {
      add({ id: `effect:${data.look.effect}`, kind: "effect", key: data.look.effect, message: `The "${data.look.effect}" style isn't in the ${planName} plan. Choose another style, another plan, or add it for this client.` });
    }
    if (data.outlets.length > allow.maxOutlets) {
      add({
        id: "outlets",
        kind: "outlets",
        message: `The ${planName} plan allows ${count(allow.maxOutlets, "outlet", "outlets")} and this form has ${data.outlets.length}. Remove outlets, choose another plan, or add the extra ones for this client.`,
      });
    }
    if (data.setup.teamCount + 1 > allow.maxUsers) {
      add({
        id: "users",
        kind: "users",
        message: `The ${planName} plan allows ${count(allow.maxUsers, "person", "people")} (owner included) and this form expects ${data.setup.teamCount + 1}. Reduce the team, choose another plan, or add the extra people for this client.`,
      });
    }
    if (roundUpTables(data.setup.tableCount) > allow.maxTables && data.setup.tableCount > 0) {
      add({
        id: "tables",
        kind: "tables",
        message: `The ${planName} plan allows ${count(allow.maxTables, "table", "tables")} and this form has ${data.setup.tableCount}. Reduce the tables, choose another plan, or add the extra ones for this client (tables are added 5 at a time).`,
      });
    }
  }
  return { issues, blocking: issues.some((i) => !i.forced) };
}

/**
 * The per-store overrides to publish with, so the store gets exactly what was agreed:
 * whatever the plan lacks that the form asks for (and that was allowed), or — on a Custom plan — everything asked for.
 */
export function forcedOverrides(data, allow) {
  const overrides = { limits: {}, entitlements: { features: { unlock: [], lock: [] }, effects: { unlock: [], lock: [] }, qrCardFamilies: { unlock: [], lock: [] } } };
  if (!allow) return overrides;
  const wanted = Object.keys(wantedFeatures(data));
  if (allow.custom) {
    overrides.entitlements.features.unlock = wanted;
    overrides.limits = { maxOutlets: allow.maxOutlets, multiOutlet: allow.maxOutlets > 1, maxUsers: allow.maxUsers, maxTables: allow.maxTables };
    if (data.look.effect !== "none") overrides.entitlements.effects.unlock = [data.look.effect];
    return overrides;
  }
  overrides.entitlements.features.unlock = wanted.filter((k) => !allow.features.includes(k));
  if (!planHasEffect(allow, data.look.effect)) overrides.entitlements.effects.unlock = [data.look.effect];
  if (data.outlets.length > allow.maxOutlets) overrides.limits = { ...overrides.limits, multiOutlet: true, maxOutlets: data.outlets.length };
  if (data.setup.teamCount + 1 > allow.maxUsers) overrides.limits = { ...overrides.limits, maxUsers: data.setup.teamCount + 1 };
  if (data.setup.tableCount > 0 && roundUpTables(data.setup.tableCount) > allow.maxTables) overrides.limits = { ...overrides.limits, maxTables: roundUpTables(data.setup.tableCount) };
  return overrides;
}

/* ------------------------------------------------------------------------------------------------ is it complete? */

/**
 * What is missing or wrong before the form can become a store. `[{ path, message }]` — `path` says where, for the form to point at.
 * (A draft may be saved half-filled; only Publish needs this to be empty.)
 */
export function validateOnboarding(data) {
  const errors = [];
  const bad = (path, message) => errors.push({ path, message });
  const b = data.business;

  if (!data.planId) bad("planId", "Choose a plan.");
  if (!b.storeName.trim()) bad("business.storeName", "Enter the store's name.");
  else if (!slugSchema.safeParse(slugifyName(b.storeName)).success) bad("business.storeName", "The store name needs some letters or numbers (they become its address).");
  if (!b.ownerName.trim()) bad("business.ownerName", "Enter the owner's name.");
  if (!EMAIL.test(b.ownerEmail.trim())) bad("business.ownerEmail", "Enter the owner's email — it is their sign-in.");
  if (b.ownerPhone.replace(/\D/g, "").length < 10) bad("business.ownerPhone", "Enter the owner's phone number (at least 10 digits).");

  if (!onboardingSubdomain(data) && !data.address.ownDomain.trim()) bad("address.subdomain", "Give the store a Rasoi Pulse address or its own domain.");
  else if (onboardingSubdomain(data) && !slugSchema.safeParse(onboardingSubdomain(data)).success) bad("address.subdomain", "The Rasoi Pulse address can only have letters, numbers and single hyphens.");

  const timeOk = (t) => HHMM.test(t);
  if (!timeOk(data.common.hours.opensAt) || !timeOk(data.common.hours.closesAt)) bad("common.hours", "Enter the common opening and closing times (like 11:00 and 23:00).");
  else if (data.common.hours.opensAt === data.common.hours.closesAt) bad("common.hours", "The common opening and closing times can't be the same.");

  if (data.outlets.length === 0) bad("outlets", "Add at least one outlet.");
  const seen = new Set();
  data.outlets.forEach((o, i) => {
    const at = (field) => `outlets.${o.id}.${field}`;
    const label = o.name.trim() || `Outlet ${i + 1}`;
    if (!o.name.trim()) bad(at("name"), `${label}: enter the outlet's name.`);
    const slug = onboardingOutletSlug(o);
    if (!slugSchema.safeParse(slug).success) bad(at("slug"), `${label}: the web address (slug) needs letters or numbers.`);
    else if (isReservedOutletSlug(slug)) bad(at("slug"), `${label}: "${slug}" is reserved — pick another slug.`);
    else if (seen.has(slug)) bad(at("slug"), `${label}: another outlet already uses the slug "${slug}".`);
    seen.add(slug);
    if (!o.address.trim()) bad(at("address"), `${label}: enter the address.`);
    if (!Object.values(o.modes).some(Boolean)) bad(at("modes"), `${label}: choose at least one way to order (takeaway, dine-in, delivery).`);
    if (o.modes.delivery) {
      if (!o.point) bad(at("point"), `${label}: delivery needs the map location — paste a Google Maps link or coordinates.`);
      if (!(o.delivery.radiusKm > 0)) bad(at("delivery"), `${label}: enter how far it delivers (km).`);
    }
    if (!o.hours.useCommon) {
      if (!timeOk(o.hours.opensAt) || !timeOk(o.hours.closesAt)) bad(at("hours"), `${label}: enter its own opening and closing times.`);
      else if (o.hours.opensAt === o.hours.closesAt) bad(at("hours"), `${label}: opening and closing can't be the same time.`);
    }
  });

  for (const k of ["primary", "background", "surface", "text"]) if (!HEX.test(data.look[k])) bad(`look.${k}`, "Colours must look like #C6362F.");
  return errors;
}

/** What publishing will do to each outlet's stored settings (paise, not rupees). Shared by the API and the preview of it. */
export function outletConfigPatch(data, o) {
  const hours = o.hours.useCommon ? data.common.hours : o.hours;
  const patch = {
    identity: {
      name: o.name.trim(),
      tagline: data.business.tagline.trim(),
      phone: o.phone.trim() || data.business.ownerPhone.trim(),
      email: data.business.ownerEmail.trim(),
      address: o.address.trim(),
      gstin: data.business.gstin.trim(),
      fssaiLicense: data.business.fssai.trim(),
      location: { point: o.point, formattedAddress: o.address.trim() },
    },
    features: {
      ordering: { takeaway: o.modes.takeaway, dineInQr: o.modes.dineIn, delivery: o.modes.delivery },
      payments: { cod: data.common.payments.cash, razorpay: false },
    },
    operations: {
      hours: { enabled: true, opensAt: hours.opensAt, closesAt: hours.closesAt, lastOrderBufferMinutes: hours.lastOrderBufferMinutes },
      prepTime: { defaultMinutes: data.common.prepMinutes },
      limits: o.modes.delivery
        ? {
            deliveryRadiusKm: o.delivery.radiusKm,
            deliveryFee: Math.round(o.delivery.fee * 100),
            freeDeliveryAbove: Math.round(o.delivery.freeAbove * 100),
            minOrderValue: Math.round(o.delivery.minOrder * 100),
          }
        : { minOrderValue: Math.round(o.delivery.minOrder * 100) },
    },
    tax: { pricesIncludeTax: data.common.tax.pricesIncludeTax, defaultGstRatePct: data.common.tax.gstRatePct, serviceChargePct: data.common.tax.serviceChargePct },
  };
  return patch;
}

/** The store-wide look (shared by every outlet) from the form's Look & feel section. */
export function lookPatch(data) {
  const l = data.look;
  const font = FONT_FAMILIES.find((f) => f.id === l.font) ? l.font : "inter";
  return {
    theme: {
      mode: l.mode,
      light: { colorPrimary: l.primary, colorOnPrimary: readableOn(l.primary), colorBg: l.background, colorSurface: l.surface, colorText: l.text },
    },
    effect: { style: l.effect },
    typography: { headingFont: font, bodyFont: font },
  };
}
