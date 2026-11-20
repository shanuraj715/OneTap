/**
 * Restaurant time. Every store is in India, so "the time" for opening hours, pickup slots, table bookings, a breakfast
 * menu or the daily stock refill is India time (IST, UTC+05:30, no daylight saving) — whatever clock the server or
 * the visitor's phone happens to run on. One set of helpers for the API, the dashboard and the storefront, so they can
 * never disagree about what "today" or "8:30 PM" means.
 *
 * Days are "YYYY-MM-DD" strings ("day keys"); a time of day is minutes after midnight (510 = 8:30 AM).
 */

export const IST_OFFSET_MINUTES = 330;
const IST_MS = IST_OFFSET_MINUTES * 60_000;
const DAY_MS = 86_400_000;

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n) => String(n).padStart(2, "0");

/** The India-time calendar day, minute of the day and weekday (0 = Sunday) of an instant. */
export function istParts(at = Date.now()) {
  const d = new Date(new Date(at).getTime() + IST_MS);
  return {
    dayKey: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    dow: d.getUTCDay(),
  };
}

/** Today's India-time day key. */
export const istDayKey = (at = Date.now()) => istParts(at).dayKey;

/** "08:30" → 510. Anything that isn't a time of day → null. "24:00" is allowed (the end of the day). */
export function parseHHMM(text) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(text ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

/** 510 → "08:30" */
export const toHHMM = (minutes) => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;

/** The instant a day key + minute of the day is, in India time. */
export function istDate(dayKey, minutes = 0) {
  const [y, m, d] = String(dayKey).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + minutes * 60_000 - IST_MS);
}

/** The day key `n` days after `dayKey` (negative goes back). */
export function shiftDay(dayKey, n) {
  const [y, m, d] = String(dayKey).split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d) + n * DAY_MS);
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

/** The weekday (0 = Sunday) of a day key. */
export function dayOfWeek(dayKey) {
  const [y, m, d] = String(dayKey).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** 510 → "8:30 AM", 1230 → "8:30 PM", 720 → "12 PM" (minutes are left out on the hour when `short`). */
export function formatClock(minutes, { short = false } = {}) {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 < 12 ? "AM" : "PM";
  return short && mm === 0 ? `${h12} ${ampm}` : `${h12}:${pad(mm)} ${ampm}`;
}

/** "Sat 22 Nov" */
export function formatDay(dayKey) {
  const [, m, d] = String(dayKey).split("-").map(Number);
  return `${WEEKDAY_SHORT[dayOfWeek(dayKey)]} ${d} ${MONTHS[m - 1]}`;
}

/** "Today", "Tomorrow" or "Sat 22 Nov" — relative to the India-time day of `now`. */
export function relativeDay(dayKey, now = Date.now()) {
  const today = istDayKey(now);
  if (dayKey === today) return "Today";
  if (dayKey === shiftDay(today, 1)) return "Tomorrow";
  return formatDay(dayKey);
}

/** "8:30 PM today", "1:00 PM tomorrow", "7:00 PM, Sat 22 Nov" — an instant, said the way a person would. */
export function formatWhen(at, now = Date.now()) {
  const p = istParts(at);
  const day = relativeDay(p.dayKey, now);
  const time = formatClock(p.minutes);
  return day === "Today" || day === "Tomorrow" ? `${time} ${day.toLowerCase()}` : `${time}, ${day}`;
}

/**
 * An opening time and a closing time as minutes, for one day. A closing time at or before the opening time means the
 * place closes after midnight (18:00 → 02:00): the closing minute is then pushed past 1440.
 */
export function openWindow(opensAt, closesAt) {
  const open = parseHHMM(opensAt) ?? 0;
  let close = parseHHMM(closesAt) ?? 1440;
  if (close <= open) close += 1440;
  return { open, close };
}
