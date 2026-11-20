import { z } from "zod";
import { FEATURES, FEATURE_KEYS, outletLimit, userLimit } from "./plan.js";
import { planAllowances, wantedFeatures } from "./onboarding.js";

/**
 * The price list behind the onboarding form's "estimated monthly price".
 *
 * A standard plan has its own monthly price (set on the plan itself). A client may want more than their plan has, or — for
 * a Custom plan — more than the biggest plan has. The price list says what each extra costs, per month in rupees before
 * GST, and the estimate adds those onto a plan's price: the price goes up in steps, it is never worked out from nothing.
 *
 *   • A standard plan  = that plan's price + each feature, outlet or person asked for beyond it.
 *   • The Custom plan  = the dearest standard plan's price (it has every feature) + each outlet / person beyond ITS limits.
 *                        So Custom always costs more than every standard plan.
 */

const money = z.number().min(0).max(1_000_000);

/**
 * Starting prices, worked out so the steps add up: going from Basic (₹999) to Pro (₹2,499) takes the nine features Pro adds
 * (₹775), two more outlets (₹500) and fifteen more people (₹225) — exactly ₹1,500. Edit them to suit.
 */
export const DEFAULT_FEATURE_PRICES = Object.freeze({
  takeaway: 100,
  dineInQr: 200,
  delivery: 100,
  onlinePayments: 50,
  coupons: 100,
  wallet: 75,
  printing: 200,
  notifications: 100,
  whatsappChat: 150,
  marketing: 100,
  analytics: 100,
  // added 2026-11-20 — starting guesses, not part of the Basic → Pro sum above; change them on the Price list page
  reservations: 100,
  scheduledOrders: 75,
  feedback: 50,
  cartReminders: 75,
  favicon: 50,
  customDomain: 50,
});

export const pricingSchema = z.object({
  /** per month, ₹, for one feature the plan doesn't include */
  features: z.record(z.string(), money).default({}),
  /** per month, ₹, for each outlet beyond what the plan allows */
  extraOutlet: money.default(250),
  /** per month, ₹, for each person (the owner counts) beyond what the plan allows */
  extraPerson: money.default(15),
  /** added on top of every price shown */
  gstPct: z.number().min(0).max(40).default(18),
});

/** The price list with every feature filled in (a feature never priced takes its starting price). */
export function resolvePricing(input) {
  const p = pricingSchema.parse(input ?? {});
  return { ...p, features: Object.fromEntries(FEATURE_KEYS.map((k) => [k, p.features[k] ?? DEFAULT_FEATURE_PRICES[k] ?? 0])) };
}

const monthlyOf = (plan) => Math.max(0, Math.round(plan?.marketing?.monthly ?? 0));
const label = (key) => FEATURES.find((f) => f.key === key)?.label ?? key;
const rupees = (n) => `₹${new Intl.NumberFormat("en-IN").format(Math.round(n))}`;

/** The standard (not Custom) plans that have a price, dearest first. */
const priced = (plans) => plans.filter((p) => !p.custom && !p.archived && monthlyOf(p) > 0).sort((a, b) => monthlyOf(b) - monthlyOf(a));

/**
 * The estimated monthly price for what the form asks for.
 *
 *   data     the form          plan     the plan chosen (null before one is)
 *   plans    every plan        pricing  the price list (see `resolvePricing`)
 *
 * Returns `null` when there is nothing to estimate yet, else the lines, the discount, GST, the yearly price, what else
 * would do (`fits`), and `notes` for anything that stops the number being trusted.
 */
export function estimatePrice({ data, plan, plans, pricing }) {
  if (!plan) return null;
  const price = resolvePricing(pricing);
  const allow = planAllowances(plan, data);
  const notes = [];
  const lines = [];
  const want = Object.keys(wantedFeatures(data));
  const people = data.setup.teamCount + 1;
  const outlets = data.outlets.length;
  const add = (text, amount, detail) => lines.push({ label: text, amount: Math.round(amount), detail });
  const featureLine = (key) => {
    const cost = price.features[key] ?? 0;
    if (!cost) notes.push(`${label(key)} has no price in the price list, so it adds ₹0.`);
    add(label(key), cost, "monthly add-on");
  };

  let startPlan = plan;
  let mode = "plan";
  if (plan.custom) {
    mode = "custom";
    startPlan = priced(plans)[0] ?? null;
    if (!startPlan) {
      return { mode, planName: plan.name, lines: [], subtotal: 0, notes: ["Custom starts from your dearest plan — give your Basic and Pro plans a monthly price (Plans → edit → Website) and the estimate appears."], fits: [], unavailable: true };
    }
    const startLimits = { outlets: outletLimit(startPlan.limits ?? {}), people: userLimit(startPlan.limits ?? {}) };
    const startFeatures = startPlan.entitlements?.features ?? FEATURE_KEYS;
    add(`${startPlan.name} plan — ${startFeatures.length >= FEATURE_KEYS.length ? "every feature" : `${startFeatures.length} features`}, up to ${Number.isFinite(startLimits.outlets) ? startLimits.outlets : "any number of"} outlet${startLimits.outlets === 1 ? "" : "s"} and ${Number.isFinite(startLimits.people) ? startLimits.people : "any number of"} people`, monthlyOf(startPlan), "where Custom starts");
    for (const key of want) if (!startFeatures.includes(key)) featureLine(key);
    const needOutlets = Math.max(allow.maxOutlets, outlets);
    const needPeople = Math.max(allow.maxUsers, people);
    if (needOutlets > startLimits.outlets) add(`${needOutlets - startLimits.outlets} more outlet${needOutlets - startLimits.outlets === 1 ? "" : "s"} (${needOutlets} in all) × ${rupees(price.extraOutlet)}`, (needOutlets - startLimits.outlets) * price.extraOutlet, "beyond the " + startPlan.name + " plan");
    if (needPeople > startLimits.people) add(`${needPeople - startLimits.people} more ${needPeople - startLimits.people === 1 ? "person" : "people"} (${needPeople} in all) × ${rupees(price.extraPerson)}`, (needPeople - startLimits.people) * price.extraPerson, "beyond the " + startPlan.name + " plan");
  } else {
    const base = monthlyOf(plan);
    if (!base) notes.push(`The ${plan.name} plan has no monthly price yet (Plans → edit → Website), so the estimate starts from ₹0.`);
    add(`${plan.name} plan`, base, "the plan's own price");
    for (const key of want) if (!allow.features.includes(key)) featureLine(key);
    if (outlets > allow.maxOutlets) add(`${outlets - allow.maxOutlets} extra outlet${outlets - allow.maxOutlets === 1 ? "" : "s"} × ${rupees(price.extraOutlet)}`, (outlets - allow.maxOutlets) * price.extraOutlet, `the plan allows ${allow.maxOutlets}`);
    if (people > allow.maxUsers) add(`${people - allow.maxUsers} extra ${people - allow.maxUsers === 1 ? "person" : "people"} × ${rupees(price.extraPerson)}`, (people - allow.maxUsers) * price.extraPerson, `the plan allows ${allow.maxUsers}`);
  }

  const subtotal = lines.reduce((a, l) => a + l.amount, 0);
  const discountPct = Math.min(100, Math.max(0, data.quote?.discountPct ?? 0));
  const discount = Math.round((subtotal * discountPct) / 100);
  const net = subtotal - discount;
  const gst = Math.round((net * price.gstPct) / 100);
  const yearlyPct = Math.max(0, startPlan?.marketing?.yearlyDiscount ?? 0);
  const yearlyNet = Math.round(net * 12 * (1 - yearlyPct / 100));
  const yearly = yearlyPct > 0 ? { discountPct: yearlyPct, net: yearlyNet, gst: Math.round((yearlyNet * price.gstPct) / 100), total: yearlyNet + Math.round((yearlyNet * price.gstPct) / 100), perMonth: Math.round(yearlyNet / 12), saves: net * 12 - yearlyNet } : null;

  // which standard plans would do as they are (nothing beyond them needed)
  const fits = priced(plans)
    .filter((p) => {
      const a = planAllowances(p, data);
      return want.every((k) => a.features.includes(k)) && outlets <= a.maxOutlets && people <= a.maxUsers;
    })
    .reverse()
    .map((p) => ({ id: p.id, name: p.name, monthly: monthlyOf(p) }));
  if (mode === "custom" && fits.length) notes.push(`These needs fit the ${fits[0].name} plan (${rupees(fits[0].monthly)} a month) — Custom is for clients who need more than the standard plans allow.`);

  return { mode, planName: plan.name, startsFrom: mode === "custom" ? startPlan.name : null, lines, subtotal, discountPct, discount, net, gstPct: price.gstPct, gst, monthlyWithGst: net + gst, yearly, fits, notes, unavailable: false };
}

/**
 * Do the prices add up? For each step from one plan up to the next dearer one: what the price list charges for what the
 * dearer plan adds (features, outlets, people) against how much dearer it really is. A gap of 0 means the list and the
 * plans agree, so a client who buys "Basic plus a few extras" pays about what the bigger plan would have cost.
 */
export function priceSteps(plans, pricing) {
  const price = resolvePricing(pricing);
  const list = priced(plans).reverse();
  const steps = [];
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1];
    const b = list[i];
    const fa = a.entitlements?.features ?? FEATURE_KEYS;
    const fb = b.entitlements?.features ?? FEATURE_KEYS;
    const added = fb.filter((k) => !fa.includes(k));
    const oa = outletLimit(a.limits ?? {});
    const ob = outletLimit(b.limits ?? {});
    const ua = userLimit(a.limits ?? {});
    const ub = userLimit(b.limits ?? {});
    const finite = Number.isFinite(ob) && Number.isFinite(oa) && Number.isFinite(ub) && Number.isFinite(ua);
    const outlets = finite ? Math.max(0, ob - oa) : null;
    const people = finite ? Math.max(0, ub - ua) : null;
    const featureCost = added.reduce((sum, k) => sum + (price.features[k] ?? 0), 0);
    const rateCard = featureCost + (outlets ?? 0) * price.extraOutlet + (people ?? 0) * price.extraPerson;
    const planDifference = monthlyOf(b) - monthlyOf(a);
    steps.push({ from: a.name, to: b.name, features: added.map(label), outlets, people, rateCard, planDifference, gap: planDifference - rateCard, comparable: finite });
  }
  return steps;
}

