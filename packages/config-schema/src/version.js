/**
 * The version of the WEB side of Rasoi Pulse (the API, the storefront, the website and the admin panel): `v-YY.MM.DD-NNN` — the day it was cut and a
 * build number that only goes up within the day. It lives in ONE file, `version.json` at the repository root, and changes ONLY when the owner asks
 * for an upgrade (`pnpm version:bump -- --confirm`). The same shape the phone apps use, so a version reads the same everywhere.
 */
export const VERSION_FORMAT = /^v-(\d{2})\.(\d{2})\.(\d{2})-(\d{3,})$/;

const two = (n) => String(n).padStart(2, "0");

/** Everything wrong with a version string (an empty list = fine). */
export function versionProblems(version) {
  const m = VERSION_FORMAT.exec(String(version ?? ""));
  if (!m) return ["The version must look like v-YY.MM.DD-NNN, for example v-26.11.28-001."];
  const month = Number(m[2]);
  const day = Number(m[3]);
  const out = [];
  if (month < 1 || month > 12) out.push("The month is not a real month.");
  if (day < 1 || day > 31) out.push("The day is not a real day.");
  if (Number(m[4]) < 1) out.push("The build number starts at 001.");
  return out;
}

export const isValidVersion = (version) => versionProblems(version).length === 0;

/** The next version after `current`, cut on `now`'s day (India's date): a new day starts again at 001, the same day counts up. */
export function nextVersion(current, now = new Date()) {
  const ist = new Date(now.getTime() + 5.5 * 3_600_000);
  const stamp = `${two(ist.getUTCFullYear() % 100)}.${two(ist.getUTCMonth() + 1)}.${two(ist.getUTCDate())}`;
  const m = VERSION_FORMAT.exec(String(current ?? ""));
  const sameDay = m && `${m[1]}.${m[2]}.${m[3]}` === stamp;
  const build = sameDay ? Number(m[4]) + 1 : 1;
  return `v-${stamp}-${String(build).padStart(3, "0")}`;
}
