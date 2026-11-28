import type { Delivery } from "@/api/schemas";

/** How many delivered orders the server sends back at most for one day (so a day with more is shown as "30+"). */
export const DONE_LIMIT = 30;

export interface DaySummary {
  delivered: number;
  /** the server held back the rest: the real number is at least this */
  capped: boolean;
  /** the distances of the orders, added up (orders with no distance are left out) */
  km: number;
  /** minutes from "I have the food" to "delivered", averaged over the orders that have both times; null when none do */
  avgMinutes: number | null;
  fastestMinutes: number | null;
  firstAt: string | null;
  lastAt: string | null;
}

/** A trip longer than this is a forgotten tap, not a trip: it is left out of the average. */
const MAX_TRIP_MIN = 6 * 60;

/** The day's work in four numbers, from the orders the rider delivered today. Pure: the same orders always give the same summary. */
export function daySummary(done: Pick<Delivery, "pickedUpAt" | "deliveredAt" | "address">[], limit = DONE_LIMIT): DaySummary {
  const trips = done.flatMap((d) => {
    if (!d.pickedUpAt || !d.deliveredAt) return [];
    const m = (new Date(d.deliveredAt).getTime() - new Date(d.pickedUpAt).getTime()) / 60_000;
    return Number.isFinite(m) && m >= 0 && m <= MAX_TRIP_MIN ? [m] : [];
  });
  const times = done.map((d) => d.deliveredAt).filter((t): t is string => Boolean(t)).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const km = done.reduce((n, d) => n + (typeof d.address.distanceKm === "number" ? d.address.distanceKm : 0), 0);
  return {
    delivered: done.length,
    capped: done.length >= limit,
    km: Math.round(km * 10) / 10,
    avgMinutes: trips.length ? Math.round(trips.reduce((a, b) => a + b, 0) / trips.length) : null,
    fastestMinutes: trips.length ? Math.round(Math.min(...trips)) : null,
    firstAt: times[0] ?? null,
    lastAt: times.at(-1) ?? null,
  };
}
