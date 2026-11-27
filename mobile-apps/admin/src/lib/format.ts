/** Money is stored in paise. ₹1,23,456 — Indian digit grouping. */
export const rupees = (paise: number | null | undefined) => `₹${Math.round((paise ?? 0) / 100).toLocaleString("en-IN")}`;
/** ₹4.5 L · ₹1.2 Cr · ₹3.4 K — for a tile or an axis where the full number would not fit. */
export function rupeesShort(paise: number | null | undefined): string {
  const r = Math.round((paise ?? 0) / 100);
  const a = Math.abs(r);
  const s = r < 0 ? "-" : "";
  if (a >= 10_000_000) return `${s}₹${(a / 10_000_000).toFixed(a >= 100_000_000 ? 0 : 1)} Cr`;
  if (a >= 100_000) return `${s}₹${(a / 100_000).toFixed(a >= 1_000_000 ? 0 : 1)} L`;
  if (a >= 1_000) return `${s}₹${(a / 1_000).toFixed(a >= 10_000 ? 0 : 1)} K`;
  return `${s}₹${a}`;
}
/** A plain rupee amount (NOT paise): ₹2,499 · ₹999.50 — whole rupees without decimals, paise shown only when there are any. */
export const money = (rupee: number | null | undefined) => `₹${(rupee ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
/** The same, short, for a chart's axis: ₹2.5 K. */
export const moneyShort = (rupee: number | null | undefined) => rupeesShort(Math.round((rupee ?? 0) * 100));
export const count = (n: number | null | undefined) => (n ?? 0).toLocaleString("en-IN");
/** +6.1% / −3% / "–" when there is nothing to compare. */
export const changePct = (p: number | null | undefined) => (p === null || p === undefined ? "–" : `${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(p)}%`);
export const bytes = (n: number | null | undefined) => {
  const v = n ?? 0;
  if (v >= 1024 ** 3) return `${(v / 1024 ** 3).toFixed(1)} GB`;
  if (v >= 1024 ** 2) return `${(v / 1024 ** 2).toFixed(1)} MB`;
  if (v >= 1024) return `${Math.round(v / 1024)} KB`;
  return `${v} B`;
};
export const dateTime = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "Never");
export const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
/** "3 d 4 h", "5 h 12 min", "42 min": how long something has been up. */
export function uptime(sec: number | null | undefined): string {
  const s = Math.max(0, Math.round(sec ?? 0));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
}
/** A speed in bytes per second, as people read it ("1.2 MB/s"). */
export const perSecond = (n: number | null | undefined) => `${bytes(n)}/s`;
/** "12 s", "3 min", "2 h": a length of time in seconds. */
export const seconds = (n: number) => (n < 90 ? `${Math.round(n)} s` : n < 5400 ? `${Math.round(n / 60)} min` : `${Math.round(n / 3600)} h`);
/**
 * A length of time in words, from seconds: "30 seconds", "15 minutes", "1 hour", "1 hour 30 minutes", "1 minute 30 seconds"; 0 is "off".
 * (The same words the web console uses for the cache lifetime.) A fraction is rounded; something that isn't a number is "—".
 */
export function duration(secondsValue: number | null | undefined): string {
  if (secondsValue === null || secondsValue === undefined) return "—"; // no value is not "off"
  const total = Math.round(Number(secondsValue));
  if (!Number.isFinite(total) || total < 0) return "—";
  if (total === 0) return "off";
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  const part = (n: number, one: string, many: string) => (n ? `${n} ${n === 1 ? one : many}` : "");
  return [part(h, "hour", "hours"), part(m, "minute", "minutes"), part(s, "second", "seconds")].filter(Boolean).join(" ");
}
