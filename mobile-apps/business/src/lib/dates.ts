/**
 * Days and periods, in India's time (what the server counts in). A DAY is "2026-11-28". The same rules as packages/config-schema/src/analytics.js
 * (presetRange, previousRange), kept in step by a test that runs both on the same dates.
 */
const IST_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-11-16" — the Indian calendar day of a moment. */
export const dayKey = (date: Date | number | string): string => {
  const d = new Date(new Date(date).getTime() + IST_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
export const today = (now: Date = new Date()) => dayKey(now);
const startOf = (key: string) => Date.parse(`${key}T00:00:00.000Z`);
export const addDays = (key: string, n: number): string => dayKey(new Date(startOf(key) - IST_MS + n * DAY_MS + 3_600_000));
export const daysBetween = (from: string, to: string): number => Math.round((startOf(to) - startOf(from)) / DAY_MS) + 1;
/** 0 = Sunday … 6 = Saturday */
export const weekdayOf = (key: string): number => new Date(`${key}T12:00:00.000Z`).getUTCDay();

export interface Range { from: string; to: string }

export const PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "thisWeek", label: "This week" },
  { id: "lastWeek", label: "Last week" },
  { id: "thisMonth", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "thisYear", label: "This year" },
  { id: "lastYear", label: "Last year" },
] as const;
export type PresetId = (typeof PRESETS)[number]["id"];

/** A preset as a range (weeks run Monday to Sunday). */
export function presetRange(id: PresetId, now: Date = new Date()): Range {
  const t = today(now);
  const [y, m] = t.split("-").map(Number) as [number, number];
  const monday = (key: string) => addDays(key, -((weekdayOf(key) + 6) % 7));
  const lastDayOfMonth = (yy: number, mm: number) => `${yy}-${pad(mm)}-${pad(new Date(Date.UTC(yy, mm, 0)).getUTCDate())}`;
  switch (id) {
    case "today": return { from: t, to: t };
    case "yesterday": return { from: addDays(t, -1), to: addDays(t, -1) };
    case "last7": return { from: addDays(t, -6), to: t };
    case "last30": return { from: addDays(t, -29), to: t };
    case "thisWeek": return { from: monday(t), to: addDays(monday(t), 6) };
    case "lastWeek": return { from: addDays(monday(t), -7), to: addDays(monday(t), -1) };
    case "thisMonth": return { from: `${y}-${pad(m)}-01`, to: lastDayOfMonth(y, m) };
    case "lastMonth": { const pm = m === 1 ? 12 : m - 1; const py = m === 1 ? y - 1 : y; return { from: `${py}-${pad(pm)}-01`, to: lastDayOfMonth(py, pm) }; }
    case "thisYear": return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "lastYear": return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    default: return { from: addDays(t, -29), to: t };
  }
}

/** The same number of days straight before a range: what "compared with the previous period" means. */
export function previousRange({ from, to }: Range): Range {
  const n = daysBetween(from, to);
  return { from: addDays(from, -n), to: addDays(from, -1) };
}

/** The same dates one year earlier (29 Feb becomes 28 Feb). */
export function lastYearRange({ from, to }: Range): Range {
  const back = (key: string) => {
    const [y, m, d] = key.split("-").map(Number) as [number, number, number];
    const last = new Date(Date.UTC(y - 1, m, 0)).getUTCDate();
    return `${y - 1}-${pad(m)}-${pad(Math.min(d, last))}`;
  };
  return { from: back(from), to: back(to) };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const parts = (key: string) => { const [y, m, d] = key.split("-").map(Number) as [number, number, number]; return { y, m, d }; };
/** "28 Nov 2026" */
export const prettyDay = (key: string) => { const p = parts(key); return `${p.d} ${MONTHS[p.m - 1]} ${p.y}`; };
/** "28 Nov" — for a chart's label */
export const shortDay = (key: string) => { const p = parts(key); return `${p.d} ${MONTHS[p.m - 1]}`; };
/** "Nov" or "Nov ’26" at the start of a year */
export const shortMonth = (key: string) => { const p = parts(key); return p.m === 1 ? `${MONTHS[0]} ’${String(p.y).slice(2)}` : MONTHS[p.m - 1]!; };

/** "28 Nov 2026" · "1 – 30 Nov 2026" · "28 Oct – 26 Nov 2026" · "1 Jan – 31 Dec 2026" · "28 Dec 2025 – 3 Jan 2026" */
export function rangeLabel({ from, to }: Range): string {
  if (from === to) return prettyDay(from);
  const a = parts(from), b = parts(to);
  if (a.y === b.y && a.m === b.m) return `${a.d} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  if (a.y === b.y) return `${a.d} ${MONTHS[a.m - 1]} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  return `${prettyDay(from)} – ${prettyDay(to)}`;
}

/** A chart's x label for one point of a series: a day, a week ("2026-W47" → its Monday), or a month. */
export function bucketLabel(key: string, granularity: "day" | "week" | "month"): string {
  if (granularity === "month") return shortMonth(`${key}-01`);
  if (granularity === "week") {
    const m = /^(\d{4})-W(\d{2})$/.exec(key);
    if (!m) return key;
    // ISO week: the week with the year's first Thursday is week 1
    const jan4 = `${m[1]}-01-04`;
    const week1Monday = addDays(jan4, -((weekdayOf(jan4) + 6) % 7));
    return shortDay(addDays(week1Monday, (Number(m[2]) - 1) * 7));
  }
  return shortDay(key);
}

/** "just now", "5 min ago", "3 hours ago", "yesterday", "4 days ago", "2 weeks ago", or the date when it is older — how long since something happened. */
export function since(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "never";
  const mins = Math.floor((now.getTime() - t) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = daysBetween(dayKey(t), dayKey(now)) - 1; // (daysBetween counts both ends)
  if (days <= 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return prettyDay(dayKey(t));
}

/** "7:30 pm" — the clock time of a moment, in India. */
export function clock12(iso: string): string {
  const t = new Date(iso);
  if (!Number.isFinite(t.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: false }).formatToParts(t);
  const h = Number(parts.find((x) => x.type === "hour")!.value) % 24;
  const m = parts.find((x) => x.type === "minute")!.value;
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? "am" : "pm"}`;
}
