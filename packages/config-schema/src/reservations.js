import { z } from "zod";
import { shiftDay, formatClock, istDate, istParts, openWindow, relativeDay } from "./clock.js";

/**
 * Table bookings. A customer asks for a table for N people at a time; the restaurant confirms it (or it is confirmed
 * by itself when `autoConfirm` is on), seats the party when they arrive, and marks it done — or a no-show.
 *
 * A booking has a start and an END, chosen by the guest (between the shortest and the longest booking the outlet allows, in
 * steps of `slotMinutes`). A booking made without an end — an older client, a phone booking — takes the usual length
 * (`durationMinutes`).
 *
 * How full a time is: every active booking holds its seats from its start to its end. A booking fits while, at every moment of it,
 * the guests already seated plus the new party fit into the outlet's capacity — `maxGuestsPerSlot` when set, otherwise the seats of
 * all its tables added up (no tables and no number = no limit).
 *
 * Money: the outlet can charge per person per hour. The guest pays HALF of the booking amount in advance (online) and the rest at the
 * restaurant; a booking that isn't charged for (rate 0) needs no payment at all.
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

/** What a booking is for — the list the guest picks from (searchable); "Other" lets them type their own. */
export const BOOKING_EVENTS = [
  "Birthday",
  "Anniversary",
  "Date night",
  "Family get-together",
  "Friends' get-together",
  "Kitty party",
  "Business meeting",
  "Corporate lunch / team outing",
  "Farewell / send-off",
  "Engagement / ring ceremony",
  "Baby shower",
  "Bachelor / bachelorette party",
  "Festival celebration",
  "Graduation / promotion party",
  "Casual dining (no special event)",
];
export const BOOKING_EVENT_OTHER = "Other";
export const BOOKING_EVENT_MAX = 60;

/** The share of the booking amount paid online in advance; the rest is paid at the restaurant. */
export const PREPAY_PERCENT = 50;

/** The coupon "order type" that lets a coupon take money off a table booking (a coupon with none ticked works on food orders only). */
export const BOOKING_COUPON_CHANNEL = "booking";

/**
 * How a booking's advance payment stands: none (nothing to pay), pending (waiting for the guest — the seats are held a few minutes), paid, refund_due
 * (it was paid and the booking won't happen), refunded, or expired (it was never paid: the hold ran out or the guest gave up — the team never saw it).
 */
export const RESERVATION_PAYMENT_STATUSES = ["none", "pending", "paid", "refund_due", "refunded", "expired"];
/** How long a booking waits for its advance to be paid, holding its seats, before it is let go. */
export const PAYMENT_HOLD_MINUTES = 15;

export const reservationSettingsSchema = z.object({
  /** a booking can start every N minutes */
  slotMinutes: z.number().int().min(15).max(60).default(30),
  /** the usual length of a booking: what a booking made without an end time gets, and what the end time starts at */
  durationMinutes: z.number().int().min(30).max(300).default(90),
  /** the shortest and the longest booking a guest can choose */
  minDurationMinutes: z.number().int().min(30).max(300).default(60),
  maxDurationMinutes: z.number().int().min(60).max(720).default(240),
  /** what the table costs, in paise per person per hour (0 = no charge, so no advance either) */
  pricePerPersonHour: z.number().int().min(0).max(1_000_000).default(0),
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
  /**
   * The WhatsApp Business template used to tell a guest about their booking when no WhatsApp number is linked (Meta only lets a business start a
   * chat with an approved template). It needs ONE placeholder, {{1}}, which receives the whole message. Leave the name empty to use SMS instead.
   */
  whatsappTemplate: z.object({ name: z.string().max(120).default(""), languageCode: z.string().max(10).default("en") }).default({}),
});

/** What a customer sends to book. */
export const reservationRequestSchema = z.object({
  outletId: z.string().min(1),
  at: z.string().min(1),
  /** when the booking ends; leave it out for the usual length */
  endsAt: z.string().min(1).optional(),
  partySize: z.number().int().min(1).max(50),
  name: z.string().trim().min(1).max(80).optional(),
  /** a coupon code (made for table bookings) to take off the price */
  couponCode: z.string().trim().max(24).optional(),
  /** where the restaurant updates the guest (a 10-digit mobile number); the account's own number when left out */
  whatsapp: z.string().trim().max(20).optional(),
  /** what the booking is for: one of BOOKING_EVENTS, or whatever the guest typed after choosing "Other" */
  event: z.string().trim().max(BOOKING_EVENT_MAX, `The event name can be at most ${BOOKING_EVENT_MAX} characters.`).optional(),
  note: z.string().trim().max(300).optional(),
});

/** "98765 43210", "+91 98765-43210", "09876543210" → "9876543210"; anything that isn't a 10-digit Indian mobile → null. */
export function whatsappNumber(raw) {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/** The shortest, longest and usual booking length for an outlet, all in whole steps (`slotMinutes`) — whatever odd numbers the settings hold. */
export function reservationDurations(settings) {
  const step = settings.slotMinutes;
  const min = Math.max(step, Math.ceil(settings.minDurationMinutes / step) * step);
  const max = Math.max(min, Math.floor(settings.maxDurationMinutes / step) * step);
  const usual = Math.min(max, Math.max(min, Math.round(settings.durationMinutes / step) * step));
  return { step, min, max, usual };
}

/** "45 min", "1 hr", "2 hrs 30 min" */
export function formatDuration(minutes) {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  const hours = h ? `${h} ${h === 1 ? "hr" : "hrs"}` : "";
  const mins = rest ? `${rest} min` : "";
  return [hours, mins].filter(Boolean).join(" ") || "0 min";
}

/** "7:00 PM – 9:30 PM today", "7:00 – 9:30 PM, Sat 22 Nov": a booking's start and end, said the way a person would. */
export function formatRange(at, endsAt, now = Date.now()) {
  const s = istParts(at);
  const e = istParts(endsAt);
  const day = relativeDay(s.dayKey, now);
  const span = `${formatClock(s.minutes)} – ${formatClock(e.minutes)}`;
  const next = e.dayKey !== s.dayKey ? " (next day)" : "";
  return day === "Today" || day === "Tomorrow" ? `${span}${next} ${day.toLowerCase()}` : `${span}${next}, ${day}`;
}

/**
 * What a booking costs and how it is paid: `amountPaise` (rate × guests × hours, to the whole rupee), `prepayPaise` (half of it, paid online
 * now, to the whole rupee) and `remainingPaise` (the rest, paid at the restaurant). A rate of 0 costs nothing.
 */
export function bookingAmount(settings, partySize, minutes) {
  const rate = settings.pricePerPersonHour ?? 0;
  const gross = rate > 0 ? Math.round(((rate * partySize * minutes) / 60) / 100) * 100 : 0;
  return { ratePaise: rate, minutes, grossPaise: gross, discountPaise: 0, ...splitBookingAmount(gross) };
}

/** An amount split the way a booking is paid: half now (to the whole rupee), the rest at the restaurant. `amountPaise` is what is left to pay after any coupon. */
export function splitBookingAmount(amountPaise) {
  const amount = Math.max(0, Math.round(amountPaise));
  const prepayPaise = amount > 0 ? Math.min(amount, Math.round((amount * PREPAY_PERCENT) / 100 / 100) * 100) : 0;
  return { amountPaise: amount, prepayPaise, remainingPaise: amount - prepayPaise };
}

/** The days a customer can book, from today. */
export function reservationDays(settings, now = Date.now()) {
  const today = istParts(now).dayKey;
  return Array.from({ length: settings.maxDaysAhead + 1 }, (_, n) => {
    const dayKey = shiftDay(today, n);
    return { dayKey, label: relativeDay(dayKey, now) };
  });
}

/**
 * The most guests seated at the same moment between `start` and `end` (milliseconds): the busiest the room gets while a booking would be
 * sitting there. A booking that ends before another begins does not add to it.
 */
export function peakGuests(bookings, start, end) {
  const inside = bookings
    .map((b) => ({ s: new Date(b.at).getTime(), e: new Date(b.endsAt).getTime(), n: b.partySize }))
    .filter((b) => b.s < end && b.e > start);
  // the load only goes up where a booking starts, so the start of the window and each start inside it are the only moments to look at
  const moments = [start, ...inside.map((b) => b.s).filter((t) => t > start && t < end)];
  let peak = 0;
  for (const t of moments) {
    const load = inside.reduce((sum, b) => (b.s <= t && b.e > t ? sum + b.n : sum), 0);
    if (load > peak) peak = load;
  }
  return peak;
}

/**
 * The start times on one day, each with whether a party of `partySize` still fits.
 * `bookings` are the outlet's active bookings around that day ({ at, endsAt, partySize }); `capacity` is the guests it
 * can seat at once (Infinity for no limit).
 * @returns {{ at: string, label: string, available: boolean, seatsLeft: number | null }[]}
 */
export function reservationSlots(config, settings, dayKey, { now = Date.now(), partySize = 2, bookings = [], capacity = Infinity, durationMinutes } = {}) {
  const hours = config.operations.hours;
  const { open, close } = openWindow(hours.opensAt, hours.closesAt);
  const step = settings.slotMinutes;
  // a start time is offered while the SHORTEST booking still fits there; the guest then picks how long
  const durationMs = (durationMinutes ?? reservationDurations(settings).min) * 60_000;
  const earliest = new Date(now).getTime() + settings.minNoticeMinutes * 60_000;
  const last = close - settings.lastBookingBeforeCloseMinutes;
  const out = [];
  for (let m = Math.ceil(open / step) * step; m <= last; m += step) {
    const at = istDate(dayKey, m);
    if (at.getTime() < earliest) continue;
    const held = peakGuests(bookings, at.getTime(), at.getTime() + durationMs);
    const left = Number.isFinite(capacity) ? Math.max(0, capacity - held) : null;
    out.push({ at: at.toISOString(), label: formatClock(m % 1440), available: left === null || left >= partySize, seatsLeft: left });
  }
  return out;
}

/**
 * The end times a guest can choose for a booking that starts at `startAt` on `dayKey`: from the shortest to the longest booking, every step,
 * never past closing. Each says whether the room has space for the party for that long, and what it would cost.
 * @returns {{ at: string, label: string, minutes: number, available: boolean, amountPaise: number, prepayPaise: number, remainingPaise: number }[]}
 */
export function reservationEnds(config, settings, dayKey, startAt, { partySize = 2, bookings = [], capacity = Infinity } = {}) {
  const hours = config.operations.hours;
  const { close } = openWindow(hours.opensAt, hours.closesAt);
  const { min, max, step } = reservationDurations(settings);
  const start = new Date(startAt).getTime();
  const startMinute = Math.round((start - istDate(dayKey, 0).getTime()) / 60_000);
  const out = [];
  for (let d = min; d <= max; d += step) {
    if (startMinute + d > close) break;
    const end = start + d * 60_000;
    const held = peakGuests(bookings, start, end);
    const available = !Number.isFinite(capacity) || capacity - held >= partySize;
    out.push({ at: new Date(end).toISOString(), label: formatClock((startMinute + d) % 1440), minutes: d, available, ...bookingAmount(settings, partySize, d) });
  }
  return out;
}

/**
 * Can a party of `partySize` book from `at` for `durationMinutes`? The same rules as the times shown, said in a customer's words.
 * `explicitEnd` is true when the guest chose the end themselves: then the length must be a whole number of steps within the outlet's
 * shortest and longest booking, and the booking must end by closing time. (A booking with the usual length is not held to that.)
 */
export function checkReservationTime(config, settings, at, partySize, opts = {}) {
  const when = new Date(at);
  if (Number.isNaN(when.getTime())) return { ok: false, reason: "Choose a time for your booking." };
  if (partySize < settings.minPartySize) return { ok: false, reason: `Bookings are for ${settings.minPartySize} or more people.` };
  if (partySize > settings.maxPartySize) return { ok: false, reason: `For more than ${settings.maxPartySize} people, please call the restaurant.` };
  const now = opts.now ?? Date.now();
  const dur = reservationDurations(settings);
  const minutes = opts.durationMinutes ?? dur.usual;
  if (opts.explicitEnd) {
    if (minutes < dur.min) return { ok: false, reason: `Bookings are at least ${formatDuration(dur.min)} long — choose a later finish time.` };
    if (minutes > dur.max) return { ok: false, reason: `Bookings can be at most ${formatDuration(dur.max)} long online — choose an earlier finish time, or call the restaurant.` };
    if (minutes % dur.step !== 0) return { ok: false, reason: `Choose a finish time on the ${dur.step === 60 ? "hour" : `${dur.step}-minute mark`}.` };
  }
  const dayKey = istParts(when).dayKey;
  const days = reservationDays(settings, now).map((d) => d.dayKey);
  // a time after midnight in a late-closing restaurant belongs to the evening before
  const candidates = [dayKey, shiftDay(dayKey, -1)].filter((d) => days.includes(d));
  const iso = when.toISOString();
  for (const day of candidates) {
    const slot = reservationSlots(config, settings, day, { ...opts, partySize, durationMinutes: minutes }).find((s) => s.at === iso);
    if (!slot) continue;
    if (opts.explicitEnd) {
      const { close } = openWindow(config.operations.hours.opensAt, config.operations.hours.closesAt);
      const startMinute = Math.round((when.getTime() - istDate(day, 0).getTime()) / 60_000);
      if (startMinute + minutes > close) return { ok: false, reason: "That finish time is after closing — choose an earlier one." };
    }
    if (!slot.available) return { ok: false, reason: slot.seatsLeft ? `Only ${slot.seatsLeft} seats are left at that time — choose another time or a shorter stay.` : "That time is fully booked — choose another time." };
    return { ok: true };
  }
  return { ok: false, reason: "That time can't be booked — choose one of the times shown." };
}
