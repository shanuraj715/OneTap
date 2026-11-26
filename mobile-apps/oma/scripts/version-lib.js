/**
 * The app's version: `v-DDMMYY-NNN` — the day the version was cut (DDMMYY) and a build number NNN that only ever goes up.
 * The first version is `v-261126-001`. The Android versionCode is the build number, so Android always sees an increase.
 *
 * Plain CommonJS so the command line (scripts/version.js), the app config (app.config.ts) and the tests can all use it.
 */
const FORMAT = /^v-(\d{2})(\d{2})(\d{2})-(\d{3,})$/;

/** @returns {{ day: number, month: number, year: number, build: number } | null} */
function parseVersion(version) {
  const m = FORMAT.exec(String(version));
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  return { day, month, year: Number(m[3]), build: Number(m[4]) };
}

const two = (n) => String(n).padStart(2, "0");

/** DDMMYY of a date (the day on the developer's own clock). */
function ddmmyy(date) {
  return `${two(date.getDate())}${two(date.getMonth() + 1)}${two(date.getFullYear() % 100)}`;
}

function isoDay(date) {
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}

function formatVersion(date, build) {
  return `v-${ddmmyy(date)}-${String(build).padStart(3, "0")}`;
}

/** Everything that is wrong with a version record (an empty list = fine). */
function problems(record) {
  const out = [];
  const p = parseVersion(record && record.version);
  if (!p) {
    out.push(`"${record && record.version}" is not a version like v-261126-001 (v-DDMMYY-NNN)`);
    return out;
  }
  if (!Number.isInteger(record.versionCode) || record.versionCode < 1) out.push("versionCode must be a whole number from 1");
  else if (record.versionCode !== p.build) out.push(`versionCode (${record.versionCode}) must equal the build number in the version (${p.build})`);
  if (typeof record.cutOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(record.cutOn)) out.push("cutOn must be a date like 2026-11-26");
  else {
    const d = new Date(`${record.cutOn}T00:00:00`);
    if (Number.isNaN(d.getTime())) out.push("cutOn is not a real date");
    else if (ddmmyy(d) !== `${two(p.day)}${two(p.month)}${two(p.year)}`) out.push(`cutOn (${record.cutOn}) does not match the date in the version`);
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

module.exports = { FORMAT, parseVersion, formatVersion, ddmmyy, isoDay, problems, nextVersion };
