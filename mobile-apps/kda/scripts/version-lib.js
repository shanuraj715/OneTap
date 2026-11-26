/**
 * The app's version: `v-YY.MM.DD-NNN` — the day the version was cut (year, month, day) and a build number NNN that only ever goes up.
 * The Android versionCode is the build number, so Android always sees an increase (each app counts its own builds).
 * Versions made before 2026-11-27 look like `v-DDMMYY-NNN` (e.g. v-261126-002): they are still READ, so an app whose record is in the old
 * form keeps working, but every NEW version made with `version:bump` uses the new form.
 *
 * Plain CommonJS so the command line (scripts/version.js), the app config (app.config.ts) and the tests can all use it.
 */
const FORMAT = /^v-(\d{2})\.(\d{2})\.(\d{2})-(\d{3,})$/; // v-26.11.27-003
const LEGACY_FORMAT = /^v-(\d{2})(\d{2})(\d{2})-(\d{3,})$/; // v-261126-002 (before 2026-11-27)

/** @returns {{ day: number, month: number, year: number, build: number, legacy: boolean } | null}  (year = the two digits, 26 for 2026) */
function parseVersion(version) {
  const text = String(version);
  let m = FORMAT.exec(text);
  let legacy = false;
  let day, month, year;
  if (m) { year = Number(m[1]); month = Number(m[2]); day = Number(m[3]); }
  else if ((m = LEGACY_FORMAT.exec(text))) { legacy = true; day = Number(m[1]); month = Number(m[2]); year = Number(m[3]); }
  else return null;
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return { day, month, year, build: Number(m[4]), legacy };
}

const two = (n) => String(n).padStart(2, "0");

/** YY.MM.DD of a date (the day on the developer's own clock). */
function yymmdd(date) {
  return `${two(date.getFullYear() % 100)}.${two(date.getMonth() + 1)}.${two(date.getDate())}`;
}

function isoDay(date) {
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

function formatVersion(date, build) {
  return `v-${yymmdd(date)}-${String(build).padStart(3, "0")}`;
}

/** Everything that is wrong with a version record (an empty list = fine). */
function problems(record) {
  const out = [];
  const p = parseVersion(record && record.version);
  if (!p) {
    out.push(`"${record && record.version}" is not a version like v-26.11.27-001 (v-YY.MM.DD-NNN)`);
    return out;
  }
  if (!Number.isInteger(record.versionCode) || record.versionCode < 1) out.push("versionCode must be a whole number from 1");
  else if (record.versionCode !== p.build) out.push(`versionCode (${record.versionCode}) must equal the build number in the version (${p.build})`);
  if (typeof record.cutOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(record.cutOn)) out.push("cutOn must be a date like 2026-11-26");
  else {
    const d = new Date(`${record.cutOn}T00:00:00`);
    if (Number.isNaN(d.getTime())) out.push("cutOn is not a real date");
    else if (d.getFullYear() % 100 !== p.year || d.getMonth() + 1 !== p.month || d.getDate() !== p.day) out.push(`cutOn (${record.cutOn}) does not match the date in the version`);
  }
  return out;
}

/** The record for the NEXT version: today's date, the next build number. Never changes anything by itself — only the bump command writes it. */
function nextVersion(record, today = new Date()) {
  const bad = problems(record);
  if (bad.length) throw new Error(`The current version is not valid: ${bad.join("; ")}`);
  const build = record.versionCode + 1;
  return { version: formatVersion(today, build), versionCode: build, cutOn: isoDay(today) };
}

module.exports = { FORMAT, LEGACY_FORMAT, parseVersion, formatVersion, yymmdd, isoDay, problems, nextVersion };
