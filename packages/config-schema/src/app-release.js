import { z } from "zod";

/**
 * Releases of the Rasoi Pulse Android apps (OMA, KDA, …). The platform admin uploads an APK for an app, says what changed and whether staff
 * MUST update; the app asks the server at every start whether a newer release of ITSELF exists.
 *
 * A version is `v-YY.MM.DD-NNN`: the day it was cut and a build number that only ever goes up (it is also Android's versionCode, so the
 * build number is what decides "newer"; every app has its own sequence). Versions made before 2026-11-27 look like `v-DDMMYY-NNN`: they are
 * still read (so what is already published keeps working) but a NEW version must use the new form. One file of rules for the server, the
 * console and the tests.
 */

/** The apps: one entry each. The id is what the app sends, the page address is /apps/<slug>. To add an app: add it here. */
export const APP_CATALOG = {
  oma: {
    id: "oma",
    slug: "oma",
    code: "OMA",
    name: "Rasoi Pulse OMA",
    tagline: "Order Management App",
    audience: "For restaurant staff who take orders at the table",
    description: "Take orders at the table from an Android phone or tablet, send them to the kitchen, and keep every table in view.",
  },
  kda: {
    id: "kda",
    slug: "kda",
    code: "KDA",
    name: "Rasoi Pulse KDA",
    tagline: "Kitchen Display App",
    audience: "For kitchen staff and kitchen managers",
    description: "See every order the moment it comes in, start and finish it, and mark a dish sold out or available, from an Android phone or tablet.",
  },
};
export const APP_IDS = Object.keys(APP_CATALOG);
export const OMA_APP = "oma";
export const KDA_APP = "kda";
export const DEFAULT_APP = OMA_APP;
/** Apps only some roles may sign in to: the server turns everyone else away at sign-in (OMA has no such rule, as before). */
export const APP_REQUIRED_PERMISSION = { kda: "kitchen:app" };
export const isAppId = (v) => typeof v === "string" && Object.prototype.hasOwnProperty.call(APP_CATALOG, v);
/** The public address of an app's page on the website: `/apps/oma`. */
export const appPagePath = (app) => `/apps/${APP_CATALOG[app]?.slug ?? app}`;

export const APP_PLATFORMS = ["android"];
export const RELEASE_STATUSES = ["draft", "published", "withdrawn"];
export const RELEASE_STATUS_LABELS = { draft: "Draft", published: "Published", withdrawn: "Withdrawn" };

const FORMAT = /^v-(\d{2})\.(\d{2})\.(\d{2})-(\d{3,})$/; // v-YY.MM.DD-NNN
const LEGACY_FORMAT = /^v-(\d{2})(\d{2})(\d{2})-(\d{3,})$/; // v-DDMMYY-NNN (before 2026-11-27)

/** `v-26.11.27-001` → { day, month, year, build, legacy }, or null when it isn't a version. (`v-271126-001` is read too: `legacy: true`.) */
export function parseAppVersion(version) {
  const text = String(version ?? "").trim();
  let m = FORMAT.exec(text);
  let legacy = false;
  let day, month, yy;
  if (m) { yy = Number(m[1]); month = Number(m[2]); day = Number(m[3]); }
  else if ((m = LEGACY_FORMAT.exec(text))) { legacy = true; day = Number(m[1]); month = Number(m[2]); yy = Number(m[3]); }
  else return null;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return { day, month, year: 2000 + yy, build: Number(m[4]), legacy };
}

/** A version in the form new versions must use (the old `v-DDMMYY-NNN` is readable but no longer accepted for a new upload). */
export const isCurrentAppVersion = (version) => parseAppVersion(version)?.legacy === false;

/** The Android versionCode of a version = its build number (0 when it isn't a version). */
export const versionCodeOf = (version) => parseAppVersion(version)?.build ?? 0;

/** The most an APK may weigh (MB). A debug build is ~100 MB, a release ~35 MB. */
export const MAX_APK_MB = 300;

export const appReleaseInputSchema = z.object({
  version: z
    .string()
    .trim()
    .refine(isCurrentAppVersion, "Use a version like v-26.11.27-003 (v-YY.MM.DD-NNN)."),
  /** which app this file is for */
  app: z.enum(APP_IDS).optional(),
  notes: z.string().max(3000, "Keep the release notes under 3,000 characters.").default(""),
  /** staff on any older version must update before they can use the app */
  force: z.boolean().default(false),
  /** make it available to staff straight away (otherwise it is saved as a draft) */
  publish: z.boolean().default(false),
});

export const appReleasePatchSchema = z.object({
  notes: z.string().max(3000).optional(),
  force: z.boolean().optional(),
  status: z.enum(["published", "withdrawn", "draft"]).optional(),
});

/**
 * What a phone on build `currentCode` should be told. `releases` = every release record (only the published ones count).
 *  - nothing newer is published → no update;
 *  - something newer → an update is available; and if ANY newer release is marked "force", the update is REQUIRED (a phone that skipped
 *    a forced release can't slip past it by waiting for the next one);
 *  - `whatsNew` lists the newest few releases above the phone's build, so someone who skipped versions sees every change.
 * An unknown build (0 / missing) is never told to update: the server can't judge it.
 */
export function decideUpdate(currentCode, releases, { maxNotes = 5 } = {}) {
  const published = (releases ?? []).filter((r) => r.status === "published").sort((a, b) => b.versionCode - a.versionCode);
  const latest = published[0] ?? null;
  const code = Number(currentCode);
  if (!latest || !(code > 0)) return { updateAvailable: false, force: false, latest, whatsNew: [] };
  const newer = published.filter((r) => r.versionCode > code);
  if (newer.length === 0) return { updateAvailable: false, force: false, latest, whatsNew: [] };
  return {
    updateAvailable: true,
    force: newer.some((r) => r.force),
    latest,
    whatsNew: newer.slice(0, maxNotes).map((r) => ({ version: r.version, versionCode: r.versionCode, notes: r.notes ?? "", force: Boolean(r.force) })),
  };
}

/** "34.2 MB" */
export const formatBytes = (n) => {
  const v = Number(n) || 0;
  if (v >= 1024 * 1024 * 1024) return `${(v / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (v >= 1024 * 1024) return `${(v / 1024 / 1024).toFixed(1)} MB`;
  if (v >= 1024) return `${Math.round(v / 1024)} KB`;
  return `${v} B`;
};
