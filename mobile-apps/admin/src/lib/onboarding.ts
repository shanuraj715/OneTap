import type { OnboardingData, OnboardingOutlet, Plan } from "@/api/endpoints";
import type { IconName } from "@/ui/primitives";

/** The same rule the server uses for a web address: letters and numbers, single hyphens. */
export const slugify = (s: string) =>
  String(s ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

let n = 1;
export function newOutlet(over: Partial<OnboardingOutlet> = {}): OnboardingOutlet {
  return {
    id: `o${Date.now().toString(36)}${n++}`, name: "", slug: "", phone: "", address: "", mapsLink: "", point: null,
    modes: { takeaway: true, dineIn: false, delivery: false },
    delivery: { radiusKm: 5, fee: 0, freeAbove: 0, minOrder: 0 },
    hours: { useCommon: true, opensAt: "11:00", closesAt: "23:00", lastOrderBufferMinutes: 30 },
    ...over,
  };
}

/** An empty form. Whatever it leaves out (the look, the quote …) the server fills with its own defaults when it is saved. */
export function blankForm(): OnboardingData {
  return {
    meeting: { repName: "", date: "", goLive: "", notes: "" },
    planId: "",
    customLimits: { maxOutlets: 1, maxUsers: 3, maxTables: 5 },
    business: { storeName: "", tagline: "", type: "", ownerName: "", ownerPhone: "", ownerEmail: "", whatsapp: "", city: "", gstin: "", fssai: "" },
    features: [], forced: [], outlets: [newOutlet()],
    common: { hours: { opensAt: "11:00", closesAt: "23:00", lastOrderBufferMinutes: 30 }, prepMinutes: 15, payments: { cash: true, online: false }, tax: { pricesIncludeTax: true, gstRatePct: 5, serviceChargePct: 0 } },
    address: { subdomain: "", ownDomain: "" },
    setup: { menuSource: "", itemCount: "", printers: "", teamCount: 0, tableCount: 0, notes: "" },
  };
}

/** The optional features a client can ask for (the three ways to order are chosen per outlet instead). Same keys as the plans. */
export const FEATURE_CHOICES: readonly { key: string; label: string; icon: IconName }[] = [
  { key: "onlinePayments", label: "Online payments", icon: "card" }, { key: "coupons", label: "Coupons", icon: "tag" }, { key: "wallet", label: "Coin wallet", icon: "wallet" }, { key: "printing", label: "Printing", icon: "printer" },
  { key: "notifications", label: "WhatsApp & SMS alerts", icon: "bell" }, { key: "whatsappChat", label: "WhatsApp chat", icon: "chat" }, { key: "marketing", label: "Marketing", icon: "megaphone" }, { key: "analytics", label: "Analytics & reports", icon: "chart" },
  { key: "kitchenDisplay", label: "Kitchen display (KDS)", icon: "chef" }, { key: "reservations", label: "Table reservations", icon: "calendarCheck" }, { key: "scheduledOrders", label: "Pre-orders", icon: "calendarClock" }, { key: "feedback", label: "Ratings & feedback", icon: "star" },
  { key: "cartReminders", label: "Abandoned-cart reminders", icon: "timer" }, { key: "favicon", label: "Own favicon", icon: "image" }, { key: "customDomain", label: "Own domain name", icon: "globe" },
];
export const ORDER_MODE_CHOICES: readonly { key: "takeaway" | "dineIn" | "delivery"; feature: string; label: string; icon: IconName }[] = [
  { key: "takeaway", feature: "takeaway", label: "Takeaway", icon: "bag" }, { key: "dineIn", feature: "dineInQr", label: "Dine-in (table QR)", icon: "qr" }, { key: "delivery", feature: "delivery", label: "Delivery", icon: "truck" },
];
export const BUSINESS_TYPES = ["Café", "Quick-service restaurant", "Cloud kitchen", "Restaurant with seating", "Restaurant chain", "Bakery / sweets", "Other"];
export const MENU_SOURCES = ["Client enters it themselves", "Client sends photos / PDF", "Client sends an Excel / CSV", "Rasoi Pulse enters it", "Not decided yet"];

export const CUSTOM_PLAN_ID = "custom";
/** The plans the form may offer: the live ones, and "Custom" (a plan with nothing included, set by hand) even if none exists yet. */
export function offeredPlans(plans: Plan[]): Plan[] {
  const live = plans.filter((p) => !p.archived);
  return live.some((p) => p.custom) ? live : [...live, { id: CUSTOM_PLAN_ID, name: "Custom", description: "Limits and features set by hand for this client.", custom: true, limits: { maxUsers: null, maxOutlets: null, maxTables: null }, entitlements: { allFeatures: true, features: [] }, archived: false, storeCount: 0 }];
}
/** Is a feature part of the chosen plan? "in" / "out", or null when there is no plan yet or a Custom plan (there everything is chosen by hand). */
export const planState = (plan: Plan | undefined, feature: string): "in" | "out" | null => (!plan || plan.custom ? null : planHas(plan, feature) ? "in" : "out");
export const planHas = (plan: Plan | undefined, feature: string) => !plan || plan.custom || plan.entitlements.allFeatures || plan.entitlements.features.includes(feature);

/** What the form asks for that the plan does not include, as the "forced" ids the server understands ("feature:delivery", "outlets", "users"). */
export function beyondPlan(data: OnboardingData, plan: Plan | undefined): { id: string; label: string }[] {
  if (!plan || plan.custom) return [];
  const out: { id: string; label: string }[] = [];
  const ask = new Set<string>(data.features);
  for (const o of data.outlets) for (const m of ORDER_MODE_CHOICES) if (o.modes[m.key]) ask.add(m.feature);
  for (const f of [...ORDER_MODE_CHOICES.map((m) => ({ key: m.feature, label: m.label })), ...FEATURE_CHOICES]) if (ask.has(f.key) && !planHas(plan, f.key)) out.push({ id: `feature:${f.key}`, label: f.label });
  const maxO = plan.limits.maxOutlets;
  if (maxO !== null && data.outlets.length > maxO) out.push({ id: "outlets", label: `${data.outlets.length} outlets (the plan allows ${maxO})` });
  const maxU = plan.limits.maxUsers;
  if (maxU !== null && data.setup.teamCount + 1 > maxU) out.push({ id: "users", label: `${data.setup.teamCount + 1} people (the plan allows ${maxU})` });
  return out;
}

/** Take away the "allowed anyway" marks that no longer apply (the thing was unticked, or the plan changed) so nothing stays unlocked by accident. */
export const pruneForced = (data: OnboardingData, plan: Plan | undefined): string[] => {
  const live = new Set(beyondPlan(data, plan).map((b) => b.id));
  return data.forced.filter((f) => live.has(f) || f.startsWith("effect:"));
};

export const isHHMM = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
/** A Google Maps link or "lat, lng" that already carries its point (the server opens short links). */
export function pointFrom(text: string): { lat: number; lng: number } | null {
  const t = text.trim();
  let m = /^(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)$/.exec(t) ?? /@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/.exec(t) ?? /[?&](?:q|ll|query)=(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/.exec(t);
  if (!m) m = /!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/.exec(t);
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
