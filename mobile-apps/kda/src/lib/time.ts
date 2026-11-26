/** How long ago, in words a cook reads at a glance: "just now", "12 min", "1 h 05 min", "2 d". */
export function elapsed(fromIso: string | null | undefined, now: number = Date.now()): string {
  if (!fromIso) return "";
  const ms = now - new Date(fromIso).getTime();
  if (!Number.isFinite(ms)) return "";
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${String(minutes % 60).padStart(2, "0")} min`;
  return `${Math.floor(hours / 24)} d`;
}

/** "7:42 pm" in the phone's own time zone. */
export function clock(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, "0")} ${h >= 12 ? "pm" : "am"}`;
}

/** "1 min 05 s" / "45 s" — for the countdown after too many sign-in attempts. */
export function countdown(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${String(s % 60).padStart(2, "0")} s`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}
