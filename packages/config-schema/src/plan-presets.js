/**
 * The plans a Rasoi Pulse install starts with, in one place: `seed-plans.js` creates them, `update-plans.js` brings plans that already exist up to
 * date with them, and the tests check them. A plan is a product decision, so the reasoning is written next to each choice.
 *
 *  Starter  one outlet, five tables, a small team: take orders (takeaway, QR dine-in), print the kitchen ticket, give coupons — plus two things that cost the
 *           restaurant nothing to run and win it customers: PRE-ORDERS (a later pickup time) and RATINGS (customers rate an order; happy ones
 *           are pointed to the Google reviews). Both work with what Starter already has.
 *  Business every feature, now and in the future (`allFeatures`), up to three outlets, twenty tables and twenty people. This is where the things that need a
 *           running team or a sender account live: delivery and riders, online payments, the coin wallet, WhatsApp / SMS alerts and chat,
 *           marketing, abandoned-cart reminders, analytics, the kitchen display (and the KDA app), table bookings, own favicon and domain.
 *  Custom   nothing by itself: each store's limits and features are set by hand on its page.
 */
import { FEATURE_KEYS } from "./plan.js";

/** the features of the smallest plan */
export const STARTER_FEATURES = Object.freeze(["takeaway", "dineInQr", "coupons", "printing", "scheduledOrders", "feedback"]);

export const PLAN_PRESETS = Object.freeze([
  {
    /** the names this plan has had (the first is the current one): `update-plans.js` finds an existing plan by any of them */
    names: ["Starter", "Basic"],
    description: "One outlet, a small team, the essentials.",
    limits: { maxUsers: 5, multiOutlet: false, maxOutlets: 1, maxTables: 5 },
    entitlements: { allFeatures: false, features: [...STARTER_FEATURES], effects: ["glass", "neumorph"], qrCardFamilies: ["minimal", "headline", "frame"] },
  },
  {
    names: ["Business", "Pro"],
    description: "Up to three outlets, delivery and every look.",
    limits: { maxUsers: 20, multiOutlet: true, maxOutlets: 3, maxTables: 20 },
    // `allFeatures`: new features reach this plan on their own (the list is just today's copy)
    entitlements: { allFeatures: true, features: [...FEATURE_KEYS] },
  },
]);
