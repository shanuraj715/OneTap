import { onModelWrite } from "@onetap/db";
import { cache } from "./cache.js";

/**
 * Throw away cached data the moment the data behind it changes. The models
 * that are cached announce every write themselves (packages/db write-events),
 * so no service has to remember to do this — including ones written later.
 */

/** Everything the storefront keeps about stores. */
const STORE_FAMILY = ["ns:host", "ns:store", "ns:plan", "ns:menu", "ns:outlet", "ns:cap", "ns:pages"];

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
