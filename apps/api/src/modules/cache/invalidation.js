import { onModelWrite } from "@rasoipulse/db";
import { cache } from "./cache.js";

/**
 * Throw away cached data the moment the data behind it changes. The models
 * that are cached announce every write themselves (packages/db write-events),
 * so no service has to remember to do this — including ones written later.
 */

/** Everything the storefront keeps about stores. */
const STORE_FAMILY = ["ns:host", "ns:store", "ns:plan", "ns:menu", "ns:outlet", "ns:outletaccess", "ns:cfg", "ns:cap", "ns:pages", "ns:coupons"];

export function expireForWrite(event) {
  switch (event.model) {
    case "Brand":
    case "Outlet": {
      if (event.brandId) cache.expireTag(`brand:${event.brandId}`);
      else cache.expireTags(STORE_FAMILY); // a write whose store isn't known: be safe
      // an address nobody used yesterday may belong to a store now
      cache.expireTag("neg:host");
      cache.expireTag("ns:dash");
      break;
    }
    case "Plan":
    case "PlatformSettings":
      // what stores on a plan may do, the grace period, and the Pricing on the website
      cache.expireTags([...STORE_FAMILY, "ns:site", "ns:dash"]);
      break;
    case "MenuCategory":
    case "MenuItem":
    case "ModifierGroup":
      if (event.outletId) cache.expireTag(`menu:${event.outletId}`);
      else cache.expireTag("ns:menu");
      break;
    case "User":
    case "Session":
    case "PlatformRole":
      // who is signed in (and what they may do) — any change to a person, a sign-in or a platform role drops every remembered sign-in
      cache.expireTag("ns:auth");
      break;
    case "Customer":
      // one customer changed (their coins, their name…) → only theirs; a bulk change → all of them
      if (event.id) cache.expireTag(`cauth:${event.id}`);
      else cache.expireTag("ns:cauth");
      break;
    case "CustomerSession":
      cache.expireTag("ns:cauth");
      break;
    case "Coupon":
      // the offers a storefront shows (and how many are left) for one outlet
      if (event.outletId) cache.expireTag(`coupons:${event.outletId}`);
      else cache.expireTag("ns:coupons");
      break;
    case "StorePage":
      // an outlet's published pages (and the links to them)
      if (event.outletId) cache.expireTag(`pages:${event.outletId}`);
      else cache.expireTag("ns:pages");
      break;
    case "SitePage":
    case "SiteSettings":
      cache.expireTag("ns:site");
      break;
    default:
      break;
  }
}

let unsubscribe = null;

/** Start listening. Safe to call more than once. */
export function installCacheInvalidation() {
  unsubscribe ??= onModelWrite(expireForWrite);
  return () => {
    unsubscribe?.();
    unsubscribe = null;
  };
}
