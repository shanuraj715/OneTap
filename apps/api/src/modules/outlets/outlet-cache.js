import { BrandModel, OutletModel } from "@rasoipulse/db";
import { cache } from "../cache/cache.js";
import { brandPlan, effectiveConfigWith } from "./config.service.js";

/**
 * The cached lookups behind every storefront page view.
 *
 * A visitor opens an address (acme.rasoipulse.in). To show the restaurant the
 * server needs: which store owns the address, that store's outlets with their
 * look as the plan allows it (theme, fonts, layout, features), and the menu.
 * Reading all that from the database on every page view is the same answer
 * over and over, so each step is kept for the configured lifetime
 * (Settings → Cache) and dropped at once when the data changes (see
 * modules/cache/invalidation.js) or when it is expired by hand.
 *
 *   address ──brandIdForHost──▶ store ──storefrontBundle──▶ outlets (public view) + the picker list
 *   outlet id ──outletBrand──▶ store
 *
 * Every public endpoint that is given only an outlet id used to read the
 * outlet from the database just to find out which store it belongs to; that
 * answer never changes, which makes it the safest thing here to keep.
 */

const OBJECT_ID = /^[0-9a-f]{24}$/i;

/** Which store a web address belongs to — `{ brandId }`, or null when no store uses it. */
export function brandIdForHost(host) {
  const address = String(host ?? "");
  if (!address || address.length > 255) return Promise.resolve(null);
  return cache.wrap(
    `host:${address}`,
    async () => {
      const outlet = await OutletModel.findOne({ hostnames: address }, null, { allowGlobalQuery: true }).select("brandId").lean();
      return outlet ? { brandId: outlet.brandId } : null;
    },
    { tags: (found) => (found ? [`brand:${found.brandId}`, "ns:host"] : ["neg:host", "ns:host"]) },
  );
}

/** The store with this slug (the "brandSlug/outletSlug" form used on a developer's machine) — `brandId` or null. */
export function brandIdForSlug(slug) {
  const key = String(slug ?? "").toLowerCase();
  if (!key || key.length > 80) return Promise.resolve(null);
  return cache.wrap(
    `brandslug:${key}`,
    async () => {
      const brand = await BrandModel.findOne({ slug: key }).select("_id").lean();
      return brand ? String(brand._id) : null;
    },
    { tags: (brandId) => (brandId ? [`brand:${brandId}`, "ns:host"] : ["neg:host", "ns:host"]) },
  );
}

/**
 * Which store an outlet belongs to — `{ brandId, outletId }`, or null for an unknown outlet.
 * A malformed id is "no such outlet", not an error.
 */
export function outletBrand(outletId) {
  const id = String(outletId ?? "").toLowerCase();
  if (!OBJECT_ID.test(id)) return Promise.resolve(null);
  return cache.wrap(
    `outlet:${id}`,
    async () => {
      const outlet = await OutletModel.findOne({ _id: id }, null, { allowGlobalQuery: true }).select("brandId").lean();
      return outlet ? { brandId: outlet.brandId, outletId: id } : null;
    },
    { cacheNull: false, tags: (found) => (found ? [`brand:${found.brandId}`, "ns:outlet"] : []) },
  );
}

/**
 * What the dashboard's request check needs to know about an outlet: which store it is, and whether it is blocked.
 * Every dashboard request asks, so the answer is kept (at most a minute — any change to the outlet drops it at once).
 */
export function outletAccess(outletId) {
  const id = String(outletId ?? "").toLowerCase();
  if (!OBJECT_ID.test(id)) return Promise.resolve(null);
  return cache.wrap(
    `outletaccess:${id}`,
    async () => {
      const outlet = await OutletModel.findOne({ _id: id }, null, { allowGlobalQuery: true }).select("brandId blocked").lean();
      return outlet ? { brandId: outlet.brandId, blocked: Boolean(outlet.blocked) } : null;
    },
    { cacheNull: false, maxAgeMs: 60_000, tags: (found) => (found ? [`brand:${found.brandId}`, "ns:outletaccess"] : []) },
  );
}

/**
 * Everything the storefront shows about one store: its name, and every outlet
 * (blocked ones included, flagged) with its config as customers see it —
 * the brand's shared look, limited to what the plan unlocks.
 *
 * A store the platform has switched off (late payment, say) shows to customers
 * exactly like a store whose every outlet is blocked: each outlet is flagged
 * blocked, so the storefront says "temporarily unavailable" and offers nothing,
 * and the picker has no outlets to list. Nothing about the store itself changes.
 *
 * `forHost` is the outlet picker's list (open outlets only), already shaped.
 */
export function storefrontBundle(brandId) {
  const id = String(brandId);
  return cache.wrap(`store:${id}`, () => loadBundle(id), { tags: [`brand:${id}`, "ns:store"] });
}

async function loadBundle(brandId) {
  const plan = await brandPlan(brandId); // null when the store can't be read
  const outlets = await OutletModel.find({ brandId }, null, { allowGlobalQuery: true }).sort({ createdAt: 1 }).lean();
  if (!plan && outlets.length === 0) return null;

  const brand = plan?.brand ?? (await BrandModel.findById(brandId).select("name slug").lean().then((b) => (b ? { id: String(b._id), name: b.name, slug: b.slug } : null)));
  const switchedOff = plan?.disabled ? { at: plan.disabled.at } : null;
  // `brandName` is what the storefront puts in its header and heading — the STORE's name, never one outlet's; an
  // outlet's own name is for the outlet switcher and for places that are really about that one outlet
  const publicOutlets = outlets.map((outlet) => ({ ...outlet, brandName: brand?.name ?? "", blocked: outlet.blocked ?? switchedOff, config: effectiveConfigWith(outlet, plan) }));
  const displayName = (o) => o.config.identity.name || o.name;
  const open = publicOutlets.filter((o) => !o.blocked);
  // Two outlets that call themselves the same ("Gazab Momos" twice) are told apart by their outlet names
  // ("Gazab Momos - Laxmi Nagar") in the lists a visitor picks from — otherwise the list would show two identical rows.
  const shownTwice = new Set(open.map(displayName).filter((n, i, all) => all.indexOf(n) !== i));

  return {
    brand,
    outlets: publicOutlets,
    forHost: brand
      ? {
          brand,
          outlets: open.map((o) => ({
            id: String(o._id),
            slug: o.slug,
            name: shownTwice.has(displayName(o)) ? o.name : displayName(o),
            address: o.config.identity.address || "",
            // null until the owner drops the map pin — lets the picker fall back to the manual list
            location: o.config.identity.location?.point ?? null,
            // what the outlet switcher needs to say, per outlet, how far it is and whether delivery reaches the visitor
            ordering: { takeaway: Boolean(o.config.features.ordering.takeaway), delivery: offersDelivery(o.config) },
            delivery: deliveryRulesOf(o.config),
          })),
        }
      : null,
  };
}

/**
 * Whether the outlet can really take a delivery order: switched on AND at least one online payment method — delivery
 * is always prepaid (the order service refuses cash on delivery), and the checkout page applies the same rule. `config`
 * is the plan-adjusted one, so a plan without online payments counts as having none. Keeps the menu page from
 * promising a delivery the checkout would then refuse.
 */
function offersDelivery(config) {
  return Boolean(config.features.ordering.delivery) && (config.payments?.enabled ?? []).some((g) => g !== "cod");
}

/**
 * The rules `checkDelivery` (config-schema) needs to say whether an address can be delivered to — all of it already
 * public (the storefront is served the same config). `null` when the outlet doesn't deliver, or hasn't dropped its
 * map pin, so there is nothing to measure from.
 */
function deliveryRulesOf(config) {
  if (!offersDelivery(config) || !config.identity.location?.point) return null;
  const { limits, prepTime } = config.operations;
  return {
    radiusKm: limits.deliveryRadiusKm,
    fee: limits.deliveryFee,
    freeDeliveryAbove: limits.freeDeliveryAbove,
    prepMinutes: prepTime.defaultMinutes + (prepTime.busyMode ? prepTime.busyExtraMinutes : 0),
    minutesPerKm: limits.deliveryMinutesPerKm,
    minEtaMinutes: limits.deliveryMinEtaMinutes,
  };
}

/** One outlet as customers see it (config after the plan), or null. */
export async function publicOutletById(outletId) {
  const ref = await outletBrand(outletId);
  if (!ref) return null;
  const bundle = await storefrontBundle(ref.brandId);
  return bundle?.outlets.find((o) => String(o._id) === ref.outletId) ?? null;
}
