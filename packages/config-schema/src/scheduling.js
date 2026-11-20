import { z } from "zod";
import { shiftDay, formatClock, istDate, istParts, openWindow, relativeDay } from "./clock.js";

/**
 * Pre-orders: a takeaway customer picks a later pickup time ("today 8:30 PM", "tomorrow 1 PM") instead of "as soon
 * as possible". The times offered are the outlet's opening hours (Settings → Opening hours), cut into slots, starting
 * no sooner than `minLeadMinutes` from now, for up to `maxDaysAhead` days. ONE function makes the list — the storefront
 * shows it and the API checks a chosen time against it — so a customer can never pick a time the server refuses.
 */
export const SLOT_SIZES = [10, 15, 20, 30, 60];

export const scheduledOrdersSchema = z.object({
  /** customers may choose a later pickup time for takeaway */
  enabled: z.boolean().default(false),
  /** how many days ahead they may choose: 0 = later today only */
  maxDaysAhead: z.number().int().min(0).max(7).default(2),
  /** the earliest pickup offered is at least this many minutes from now */
  minLeadMinutes: z.number().int().min(10).max(720).default(30),
  /** a pickup time every N minutes */
  slotMinutes: z.number().int().min(10).max(60).default(15),
  /** at most this many pre-orders for one pickup time; 0 = no limit */
  maxPerSlot: z.number().int().min(0).max(500).default(0),
});

/** A pre-order's accept alert starts this long before its pickup time (see evaluateSla) — not when it was placed. */
export const SCHEDULED_ACCEPT_LEAD_MINUTES = 60;

/**
 * The pickup times a customer can choose, grouped by day.
 * `taken` is a Map of slot ISO string → pre-orders already booked for it (only matters with a `maxPerSlot`).
 * @returns {{ dayKey: string, label: string, slots: { at: string, label: string, full: boolean }[] }[]}
 */
export function pickupSlots(config, { now = Date.now(), taken = new Map() } = {}) {
  const s = config.operations?.scheduling;
  if (!s?.enabled) return [];
  const hours = config.operations.hours;
  const prep = config.operations.prepTime?.defaultMinutes ?? 15;
  const { open, close } = openWindow(hours.opensAt, hours.closesAt);
  const step = Math.min(60, Math.max(10, s.slotMinutes));
  const earliest = new Date(now).getTime() + s.minLeadMinutes * 60_000;
  const today = istParts(now).dayKey;

  const days = [];
  for (let n = 0; n <= s.maxDaysAhead; n += 1) {
    const dayKey = shiftDay(today, n);
    const slots = [];
    // the kitchen needs its prep time after opening before the first pickup; the last pickup is at closing time
    const first = Math.ceil((open + prep) / step) * step;
    for (let m = first; m <= close; m += step) {
      const at = istDate(dayKey, m);
      if (at.getTime() < earliest) continue;
      const iso = at.toISOString();
      const booked = taken.get(iso) ?? 0;
      slots.push({ at: iso, label: formatClock(m % 1440), full: s.maxPerSlot > 0 && booked >= s.maxPerSlot });
    }
    if (slots.length) days.push({ dayKey, label: relativeDay(dayKey, now), slots });
  }
  return days;
}

/** Is `at` one of the pickup times on offer right now? Says why not, in words a customer understands. */
export function checkPickupTime(config, at, { now = Date.now(), taken = new Map() } = {}) {
  const when = new Date(at);
  if (Number.isNaN(when.getTime())) return { ok: false, reason: "Choose a pickup time." };
  if (!config.operations?.scheduling?.enabled) return { ok: false, reason: "This outlet doesn't take orders for later." };
  const iso = when.toISOString();
  const slot = pickupSlots(config, { now, taken })
    .flatMap((d) => d.slots)
    .find((x) => x.at === iso);
  if (!slot) return { ok: false, reason: "That pickup time isn't available any more — please choose another." };
  if (slot.full) return { ok: false, reason: "That pickup time is fully booked — please choose another." };
  return { ok: true };
}
