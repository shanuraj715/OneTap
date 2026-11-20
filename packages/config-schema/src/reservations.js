import { z } from "zod";
import { shiftDay, formatClock, istDate, istParts, openWindow, relativeDay } from "./clock.js";

/**
 * Table bookings. A customer asks for a table for N people at a time; the restaurant confirms it (or it is confirmed
 * by itself when `autoConfirm` is on), seats the party when they arrive, and marks it done — or a no-show.
 *
 * How full a time is: every active booking holds its seats for `durationMinutes` from its start. A time can take a
 * new booking while the guests already holding seats then, plus the new party, fit into the outlet's capacity —
 * `maxGuestsPerSlot` when set, otherwise the seats of all its tables added up (no tables and no number = no limit).
 */

export const RESERVATION_STATUSES = ["requested", "confirmed", "seated", "completed", "declined", "cancelled", "no_show"];
export const reservationStatusSchema = z.enum(RESERVATION_STATUSES);

export const RESERVATION_STATUS_LABELS = {
  requested: "Waiting to be confirmed",
  confirmed: "Confirmed",
  seated: "Seated",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
  no_show: "No-show",
};

/** Bookings that still hold their seats. */
export const ACTIVE_RESERVATION_STATUSES = ["requested", "confirmed", "seated"];

/** What the team can do next with a booking in each state. */
export const RESERVATION_NEXT = {
  requested: ["confirmed", "declined", "cancelled"],
  confirmed: ["seated", "no_show", "cancelled"],
  seated: ["completed"],
  completed: [],
  declined: [],
  cancelled: [],
  no_show: [],
};

export const reservationSettingsSchema = z.object({
  /** a booking can start every N minutes */
  slotMinutes: z.number().int().min(15).max(60).default(30),
  /** how long a booking holds its seats */
  durationMinutes: z.number().int().min(30).max(300).default(90),
  minPartySize: z.number().int().min(1).max(20).default(1),
  maxPartySize: z.number().int().min(1).max(50).default(10),
  /** how far ahead customers can book */
  maxDaysAhead: z.number().int().min(0).max(60).default(14),
  /** the earliest booking is at least this many minutes from now */
  minNoticeMinutes: z.number().int().min(0).max(2880).default(60),
  /** the last booking starts this many minutes before closing */
  lastBookingBeforeCloseMinutes: z.number().int().min(0).max(240).default(60),
  /** guests seated at one time; 0 = the seats of all the outlet's tables */
  maxGuestsPerSlot: z.number().int().min(0).max(2000).default(0),
  /** confirm bookings straight away instead of waiting for the team */
  autoConfirm: z.boolean().default(false),
  /** customers may cancel their own booking until this many minutes before it */
  cancelUntilMinutes: z.number().int().min(0).max(2880).default(60),
  /** shown on the booking page, e.g. "We hold your table for 15 minutes." */
  guestNote: z.string().max(300).default(""),
});

/** What a customer sends to book. */
export const reservationRequestSchema = z.object({
  outletId: z.string().min(1),
  at: z.string().min(1),
  partySize: z.number().int().min(1).max(50),
  name: z.string().trim().min(1).max(80).optional(),
  note: z.string().trim().max(300).optional(),
});

/** The days a customer can book, from today. */
export function reservationDays(settings, now = Date.now()) {
  const today = istParts(now).dayKey;
  return Array.from({ length: settings.maxDaysAhead + 1 }, (_, n) => {
    const dayKey = shiftDay(today, n);
    return { dayKey, label: relativeDay(dayKey, now) };
  });
}

/** Guests already holding seats during [start, start + duration). */
function guestsDuring(bookings, start, durationMs) {
  const end = start + durationMs;
  let guests = 0;
  for (const b of bookings) {
    const s = new Date(b.at).getTime();
    const e = new Date(b.endsAt).getTime();
    if (s < end && e > start) guests += b.partySize;
  }
  return guests;
}

/**
 * The start times on one day, each with whether a party of `partySize` still fits.
 * `bookings` are the outlet's active bookings around that day ({ at, endsAt, partySize }); `capacity` is the guests it
 * can seat at once (Infinity for no limit).
 * @returns {{ at: string, label: string, available: boolean, seatsLeft: number | null }[]}
 */
export function reservationSlots(config, settings, dayKey, { now = Date.now(), partySize = 2, bookings = [], capacity = Infinity } = {}) {
  const hours = config.operations.hours;
  const { open, close } = openWindow(hours.opensAt, hours.closesAt);
  const step = settings.slotMinutes;
  const durationMs = settings.durationMinutes * 60_000;
  const earliest = new Date(now).getTime() + settings.minNoticeMinutes * 60_000;
  const last = close - settings.lastBookingBeforeCloseMinutes;
  const out = [];
  for (let m = Math.ceil(open / step) * step; m <= last; m += step) {
    const at = istDate(dayKey, m);
    if (at.getTime() < earliest) continue;
    const held = guestsDuring(bookings, at.getTime(), durationMs);
    const left = Number.isFinite(capacity) ? Math.max(0, capacity - held) : null;
    out.push({ at: at.toISOString(), label: formatClock(m % 1440), available: left === null || left >= partySize, seatsLeft: left });
  }
  return out;
}

/** Can a party of `partySize` book at `at`? The same rules as the list of times, said in a customer's words. */
export function checkReservationTime(config, settings, at, partySize, opts = {}) {
  const when = new Date(at);
  if (Number.isNaN(when.getTime())) return { ok: false, reason: "Choose a time for your booking." };
  if (partySize < settings.minPartySize) return { ok: false, reason: `Bookings are for ${settings.minPartySize} or more people.` };
  if (partySize > settings.maxPartySize) return { ok: false, reason: `For more than ${settings.maxPartySize} people, please call the restaurant.` };
  const now = opts.now ?? Date.now();
  const dayKey = istParts(when).dayKey;
  const days = reservationDays(settings, now).map((d) => d.dayKey);
  // a time after midnight in a late-closing restaurant belongs to the evening before
  const candidates = [dayKey, shiftDay(dayKey, -1)].filter((d) => days.includes(d));
  const iso = when.toISOString();
  for (const day of candidates) {
    const slot = reservationSlots(config, settings, day, { ...opts, partySize }).find((s) => s.at === iso);
    if (!slot) continue;
    if (!slot.available) return { ok: false, reason: slot.seatsLeft ? `Only ${slot.seatsLeft} seats are left at that time — choose another time.` : "That time is fully booked — choose another time." };
    return { ok: true };
  }
  return { ok: false, reason: "That time can't be booked — choose one of the times shown." };
}
