import { onModelWrite } from "@rasoipulse/db";
import { logger } from "../logger.js";
import { unavailableNow } from "../modules/menu/menu.service.js";
import { notifyApps, outletsListeningFor, recheckClients } from "./hub.js";

/**
 * What tells the staff apps (OMA, KDA, RDA) that something changed — so they ask the API for new data when there IS some, instead of
 * asking every few seconds whether there is.
 *
 * Nothing here knows about screens or routes. The database layer announces every write to a model (packages/db/src/write-events.js),
 * whichever code made it — an order placed on the storefront, a waiter's tap, the kitchen board, a webhook, the dashboard, a background
 * sweep — so the apps hear about all of them and no service has to remember to say so:
 *
 *   Order                               → "orders" (OMA, KDA)  and "deliveries" (RDA)
 *   Table, TableSession                 → "tables" (OMA)
 *   MenuItem, MenuCategory, ModifierGroup → "menu"  (OMA: what can't be ordered · KDA: the dishes list)
 *   Rider                               → that rider's connection is checked again (switched off? new PIN?)
 *
 * One more thing is not a write at all: a dish goes out of its serving hours when the clock says so. A small watcher compares, for
 * each outlet that has an app listening, the list of dishes that can't be ordered right now with the one it saw last time.
 */

const KINDS = {
  Order: ["orders", "deliveries"],
  Table: ["tables"],
  TableSession: ["tables"],
  MenuItem: ["menu"],
  MenuCategory: ["menu"],
  ModifierGroup: ["menu"],
};

const WATCH_MS = 30_000;

let unsubscribe = null;
let watcher = null;
const seen = new Map(); // outletId → the "can't be ordered now" fingerprint at the last look

function onWrite(event) {
  if (event.model === "Rider") {
    // a rider switched off, given a new PIN or removed: their live connection is checked again at once
    void recheckClients((c) => c.app === "rda" && (!event.id || c.riderId === event.id) && (!event.brandId || c.brandId === event.brandId));
    return;
  }
  const kinds = KINDS[event.model];
  if (!kinds) return;
  const scope = { brandId: event.brandId, outletId: event.outletId };
  for (const kind of kinds) notifyApps(scope, kind);
}

/** The list of dishes that can't be ordered right now, as one comparable string. */
const fingerprint = (now) => JSON.stringify([now.unavailable.map((u) => `${u.id}:${u.label}`).sort(), now.low.map((l) => `${l.id}:${l.left}`).sort()]);

async function watchAvailability() {
  const outlets = outletsListeningFor("menu");
  for (const outletId of [...seen.keys()]) if (!outlets.has(outletId)) seen.delete(outletId); // nobody listening any more: forget it
  for (const [outletId, brandId] of outlets) {
    try {
      const now = fingerprint(await unavailableNow({ brandId, outletId }));
      const before = seen.get(outletId);
      seen.set(outletId, now);
      if (before !== undefined && before !== now) notifyApps({ brandId, outletId }, "menu");
    } catch (err) {
      logger.debug({ err, outletId }, "app feed: availability check failed");
    }
  }
}

/** Start listening (safe to call more than once). Returns a function that stops it (used by tests). */
export function installAppFeed() {
  unsubscribe ??= onModelWrite(onWrite);
  watcher ??= setInterval(() => void watchAvailability(), WATCH_MS);
  watcher.unref?.();
  return () => {
    unsubscribe?.();
    unsubscribe = null;
    if (watcher) clearInterval(watcher);
    watcher = null;
    seen.clear();
  };
}

/** For tests: run one look at the clock-driven availability right now. */
export const checkAvailabilityNow = watchAvailability;
