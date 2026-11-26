import { z } from "zod";

/**
 * Releases of the staff Android app ("Rasoi Pulse OMA"). The platform admin uploads an APK, says what changed and whether staff MUST
 * update; the app asks the server at every start whether a newer release exists.
 *
 * A version is `v-DDMMYY-NNN`: the day it was cut and a build number that only ever goes up (it is also Android's versionCode, so the
 * build number is what decides "newer"). One file of rules for the server, the console and the tests.
 */

export const OMA_APP = "oma";
export const APP_PLATFORMS = ["android"];
export const RELEASE_STATUSES = ["draft", "published", "withdrawn"];
export const RELEASE_STATUS_LABELS = { draft: "Draft", published: "Published", withdrawn: "Withdrawn" };

const FORMAT = /^v-(\d{2})(\d{2})(\d{2})-(\d{3,})$/;

/** `v-261126-001` → { day, month, year, build }, or null when it isn't a version. */
export function parseAppVersion(version) {
  const m = FORMAT.exec(String(version ?? "").trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return { day, month, year: 2000 + Number(m[3]), build: Number(m[4]) };
}

/** The Android versionCode of a version = its build number (0 when it isn't a version). */
export const versionCodeOf = (version) => parseAppVersion(version)?.build ?? 0;

/** The most an APK may weigh (MB). A debug build is ~100 MB, a release ~35 MB. */
export const MAX_APK_MB = 300;

export const appReleaseInputSchema = z.object({
  version: z
    .string()
    .trim()
    .refine((v) => parseAppVersion(v) !== null, "Use a version like v-261126-001 (v-DDMMYY-NNN)."),
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
