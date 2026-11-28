import { z } from "zod";

/**
 * Releases of the Rasoi Pulse Android apps (OMA, KDA, RDA, …). The platform admin uploads an APK for an app, says what changed and whether staff
 * MUST update; the app asks the server at every start whether a newer release of ITSELF exists.
 *
 * A version is `v-YY.MM.DD-NNN`: the day it was cut and a build number that only ever goes up (it is also Android's versionCode, so the
 * build number is what decides "newer"; every app has its own sequence). Versions made before 2026-11-27 look like `v-DDMMYY-NNN`: they are
 * still read (so what is already published keeps working) but a NEW version must use the new form. One file of rules for the server, the
 * console and the tests.
 */

/**
 * The apps that SHIP with Rasoi Pulse: their defaults. This is NOT the list of apps any more — the list lives in the database and is managed in the
 * console (App Management: add an app, change its words, make it public or private, upload its versions). These entries are copied into the database
 * the first time it is read (so a new install starts with them), and they carry what code has to know about a built-in app: the sign-in rules
 * (`APP_REQUIRED_PERMISSION`, `APP_ACCESS_NOTE` below). An app added in the console has no sign-in rule here: it is a download page with versions.
 *   listed              the app's default on the website: true = in the public list of apps; false = private (not listed; its page still opens
 *                       for anyone with the link, so a team can download it).
 *   usesRefreshInterval the app asks the server for new data by the console's "Refresh interval" number (the staff apps); the others refresh on their own.
 */
export const APP_CATALOG = {
  oma: {
    id: "oma",
    slug: "oma",
    listed: true,
    usesRefreshInterval: true,
    code: "OMA",
    name: "Rasoi Pulse OMA",
    tagline: "Order Management App",
    audience: "For restaurant staff who take orders at the table",
    description: "Take orders at the table from an Android phone or tablet, send them to the kitchen, and keep every table in view.",
  },
  kda: {
    id: "kda",
    slug: "kda",
    listed: true,
    usesRefreshInterval: true,
    code: "KDA",
    name: "Rasoi Pulse KDA",
    tagline: "Kitchen Display App",
    audience: "For kitchen staff and kitchen managers",
    description: "See every order the moment it comes in, start and finish it, and mark a dish sold out or available, from an Android phone or tablet.",
  },
  rda: {
    id: "rda",
    slug: "rda",
    listed: true,
    usesRefreshInterval: true,
    code: "RDA",
    name: "Rasoi Pulse RDA",
    tagline: "Rider Delivery App",
    audience: "For delivery riders",
    description: "See the deliveries handed to you, get directions in your own maps app, call or message the customer, and mark each order delivered, from an Android phone.",
  },
  admin: {
    id: "admin",
    slug: "admin",
    listed: false,
    usesRefreshInterval: false,
    code: "ADM",
    name: "Rasoi Pulse Admin",
    tagline: "Platform Team App",
    audience: "For the Rasoi Pulse team",
    description: "Manage the Rasoi Pulse platform from an Android phone or tablet: the dashboard, stores, plans, onboarding, leads, the server and security.",
  },
  business: {
    id: "business",
    slug: "business",
    listed: false,
    usesRefreshInterval: false,
    code: "BIZ",
    name: "Rasoi Pulse Business",
    tagline: "Business Insights App",
    audience: "For restaurant owners",
    description: "See your sales by day, week, month and year, compare them, find your best-selling dishes, track expenses, stock, bookings and staff, and download Excel and PDF reports, from an Android phone or tablet.",
  },
};
/** The ids of the built-in apps (an app added in the console has its own id; ask the registry). */
export const APP_IDS = Object.keys(APP_CATALOG);
export const OMA_APP = "oma";
export const KDA_APP = "kda";
export const RDA_APP = "rda";
export const BUSINESS_APP = "business";
export const DEFAULT_APP = OMA_APP;
/** Apps only some roles may sign in to: the server turns everyone else away at sign-in (OMA has no such rule, as before). */
export const APP_REQUIRED_PERMISSION = { kda: "kitchen:app", business: "analytics:read" };
/** Said to a person who signs in to an app that is not for their role: who the app IS for. */
export const APP_ACCESS_NOTE = {
  kda: "the kitchen team (kitchen staff, kitchen managers and owners)",
  business: "store owners and the people they share reports with (managers and accountants)",
};
/** Is this one of the BUILT-IN apps? (Any app, including those added in the console, is checked against the database: see the API's app registry.) */
export const isBuiltInApp = (v) => typeof v === "string" && Object.prototype.hasOwnProperty.call(APP_CATALOG, v);
/** @deprecated the old name of {@link isBuiltInApp}: it only knows the built-in apps */
export const isAppId = isBuiltInApp;

/* ---- apps added in the console */

/** An app's id: lowercase letters, digits and single hyphens, 2–30 long (it is also its page's address). */
export const APP_SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const appSlugSchema = z
  .string({ required_error: "Give the app an address (letters, numbers and hyphens)." })
  .trim()
  .min(2, "The address needs at least 2 characters.")
  .max(30, "The address can be 30 characters at most.")
  .regex(APP_SLUG_PATTERN, "Use lowercase letters, numbers and single hyphens only, for example rasoi-pulse-pos.");
/** "Rasoi Pulse POS" → "rasoi-pulse-pos" (cut to 30, never ending in a hyphen). */
export function slugifyAppName(name) {
  return String(name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
}
/** The short code on an app's icon, from its name: the capitals of its words, or its first letters ("Rasoi Pulse POS" → "RPP"). 2–5 letters or digits. */
export function codeFromAppName(name) {
  const words = String(name ?? "").replace(/[^A-Za-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  const caps = words.map((w) => w[0].toUpperCase()).join("");
  const code = caps.length >= 2 ? caps : (words[0] ?? "").slice(0, 3).toUpperCase();
  return code.slice(0, 5);
}
const appText = (label, max) => z.string().trim().max(max, `${label} can be ${max} characters at most.`);
const appFields = {
  name: z.string({ required_error: "Give the app a name." }).trim().min(2, "The name needs at least 2 characters.").max(60, "The name can be 60 characters at most."),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,5}$/, "The code is 2 to 5 letters or numbers, for example POS."),
  tagline: appText("The tagline", 60),
  audience: appText("The 'who it is for' line", 100),
  description: appText("The description", 400),
};
/** Adding an app in the console. The address (`slug`) is made from the name when it is left out; the code too. */
export const appCreateSchema = z.object({
  name: appFields.name,
  slug: appSlugSchema.optional(),
  code: appFields.code.optional(),
  tagline: appFields.tagline.default(""),
  audience: appFields.audience.default(""),
  description: appFields.description.default(""),
  isPublic: z.boolean().default(false),
  usesRefreshInterval: z.boolean().default(false),
});
/** Changing an app's words (its address never changes: releases and phones know the app by it). */
export const appPatchSchema = z.object({
  name: appFields.name.optional(),
  code: appFields.code.optional(),
  tagline: appFields.tagline.optional(),
  audience: appFields.audience.optional(),
  description: appFields.description.optional(),
  usesRefreshInterval: z.boolean().optional(),
});
/** The public address of an app's page on the website: `/apps/oma`. */
export const appPagePath = (app) => `/apps/${APP_CATALOG[app]?.slug ?? app}`;

/**
 * How often an app asks the server for new data (a new order, a new delivery), in seconds. ONE number per app, set by the platform admin in the
 * console (App Management → the app's tab → Refresh interval) and told to the app in the `x-refresh-seconds` header of every answer, so a change
 * reaches a phone with its very next request. The apps keep these same numbers (`REFRESH_DEFAULT_SECONDS` …) in their own config, and their tests
 * fail if the two drift apart.
 */
export const APP_REFRESH = { default: 8, min: 3, max: 600 };
export const APP_REFRESH_HEADER = "x-refresh-seconds";
export const appSettingsInputSchema = z.object({
  refreshSeconds: z
    .number({ invalid_type_error: `Enter a whole number of seconds, from ${APP_REFRESH.min} to ${APP_REFRESH.max}.`, required_error: "Enter how many seconds to wait between refreshes." })
    .int(`Enter a whole number of seconds, from ${APP_REFRESH.min} to ${APP_REFRESH.max}.`)
    .min(APP_REFRESH.min, `At least ${APP_REFRESH.min} seconds: asking more often than that only loads the server.`)
    .max(APP_REFRESH.max, `At most ${APP_REFRESH.max} seconds (${APP_REFRESH.max / 60} minutes): longer than that and new orders would show far too late.`),
});

/**
 * HOW AN APP GETS NEW DATA (console → App Management → the app's tab → Live connection). The apps that can listen (`APPS_WITH_LIVE`: OMA, KDA, RDA)
 * keep ONE live connection (a WebSocket) to the server; the server says "something changed" and the app asks for the new data at once.
 *   "websocket" — the live connection is used (the default). If it is down or can't be made, the app asks on a timer — the Refresh interval above — until it is back.
 *   "polling"   — no live connection at all: the app only asks on that timer.
 * Polling is the backup in BOTH modes; the choice is only whether the live connection is tried first.
 */
export const LIVE_MODES = ["websocket", "polling"];
export const DEFAULT_LIVE_MODE = "websocket";
export const APPS_WITH_LIVE = ["oma", "kda", "rda"];
export const appLiveModeInputSchema = z.object({
  liveMode: z.enum(LIVE_MODES, { errorMap: () => ({ message: "Choose “live connection” (websocket) or “polling”." }) }),
});

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
  app: z.string().trim().max(40).optional(),
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
