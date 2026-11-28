import { APP_CATALOG } from "@rasoipulse/config-schema";
import { AppModel, AppSettingModel } from "@rasoipulse/db";

/**
 * The list of Rasoi Pulse apps: it lives in the database (the console's App Management adds, edits and removes them), not in the code. The built-in apps
 * (OMA, KDA, RDA, Admin, Business) are copied in from the defaults in config-schema the first time the list is read, with the public / private choice the
 * console had already made for them (so nothing that was set is lost), and the console owns them from then on.
 *
 * The list is kept in memory for a few seconds (every app request asks "do I know this app?"); a change made here clears it at once, and any other
 * process sees it within TTL_MS.
 */
const TTL_MS = 15_000;
let cache = { at: 0, apps: /** @type {object[]} */ ([]) };

const shape = (a) => ({
  slug: a.slug,
  id: a.slug,
  name: a.name,
  code: a.code,
  tagline: a.tagline ?? "",
  audience: a.audience ?? "",
  description: a.description ?? "",
  isPublic: Boolean(a.isPublic),
  usesRefreshInterval: Boolean(a.usesRefreshInterval),
  liveMode: a.liveMode === "polling" ? "polling" : "websocket",
  builtIn: Boolean(a.builtIn),
  sortOrder: a.sortOrder ?? 100,
  createdAt: a.createdAt ?? null,
  updatedAt: a.updatedAt ?? null,
});

/** Put the built-in apps that are not in the database yet there (safe to run again and from several processes at once). */
async function ensureBuiltIns(rows) {
  const have = new Set(rows.map((r) => r.slug));
  const missing = Object.values(APP_CATALOG).filter((a) => !have.has(a.slug));
  if (!missing.length) return false;
  const settings = await AppSettingModel.find().select("app isPublic").lean();
  const chosen = Object.fromEntries(settings.map((s) => [s.app, s.isPublic]));
  const order = Object.keys(APP_CATALOG);
  await AppModel.bulkWrite(
    missing.map((a) => ({
      updateOne: {
        filter: { slug: a.slug },
        update: {
          $setOnInsert: {
            slug: a.slug, name: a.name, code: a.code, tagline: a.tagline, audience: a.audience, description: a.description,
            isPublic: typeof chosen[a.id] === "boolean" ? chosen[a.id] : a.listed !== false,
            usesRefreshInterval: a.usesRefreshInterval !== false, builtIn: true, sortOrder: (order.indexOf(a.id) + 1) * 10,
          },
        },
        upsert: true,
      },
    })),
  );
  return true;
}

/** Every app, in the console's order (the built-in ones first, then the ones added, oldest first). */
export async function loadApps({ fresh = false } = {}) {
  if (!fresh && Date.now() - cache.at < TTL_MS) return cache.apps;
  let rows = await AppModel.find().lean();
  if (await ensureBuiltIns(rows)) rows = await AppModel.find().lean();
  const apps = rows.map(shape).sort((a, b) => a.sortOrder - b.sortOrder || new Date(a.createdAt) - new Date(b.createdAt));
  cache = { at: Date.now(), apps };
  return apps;
}

/** Forget the list (after an app was added, changed or removed): the next question reads the database. */
export const invalidateApps = () => { cache = { at: 0, apps: [] }; };

export async function getApp(slug) {
  if (typeof slug !== "string" || !slug) return null;
  return (await loadApps()).find((a) => a.slug === slug) ?? null;
}

/** Is this the id of an app we know — a built-in one or one added in the console? Never throws: a failing database means "not known" for a moment. */
export async function isKnownApp(slug) {
  try { return Boolean(await getApp(slug)); } catch { return Object.prototype.hasOwnProperty.call(APP_CATALOG, slug); }
}
