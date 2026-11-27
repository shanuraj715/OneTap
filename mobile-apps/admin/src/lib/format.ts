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
