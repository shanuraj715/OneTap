import {
  ACTIVE_RESERVATION_STATUSES,
  bookingAmount,
  checkReservationTime,
  formatINR,
  formatRange,
  istDate,
  istParts,
  PAYMENT_HOLD_MINUTES,
  PREPAY_PERCENT,
  RESERVATION_NEXT,
  RESERVATION_STATUS_LABELS,
  reservationDays,
  reservationDurations,
  reservationEnds,
  reservationSlots,
  shiftDay,
  splitBookingAmount,
  whatsappNumber,
} from "@rasoipulse/config-schema";
import { brandFilter, nextSequence, OutletModel, ReservationModel, TableModel, tenantFilter } from "@rasoipulse/db";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";
import { broadcast } from "../../realtime/hub.js";
import { firstNameOf } from "../notify/notify.service.js";
import { customerTextRoute, sendCustomerText } from "../notify/customer-text.js";
import { checkCoupon, recordRedemption, releaseRedemption } from "../coupons/coupons.service.js";
import { effectiveOutletConfig } from "../outlets/config.service.js";
import { bookingGatewayFor } from "../payments/payments.service.js";

/** A customer can hold this many upcoming bookings at one outlet at once. */
export const MAX_UPCOMING_PER_CUSTOMER = 3;

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** How long ago a booking's advance was asked for counts against its hold: past this, an unpaid one is let go. */
const holdCutoff = () => new Date(Date.now() - PAYMENT_HOLD_MINUTES * 60_000);

/** A booking in either of these payment states never reached the team: it is still waiting for its advance, or was given up on before paying. */
const UNSEEN_PAYMENT = ["pending", "expired"];

/** Is this booking still waiting for its advance, inside the minutes its seats are held? */
const awaitingPayment = (r) => r.payment?.status === "pending" && new Date(r.createdAt).getTime() >= holdCutoff().getTime();

export const shapeReservation = (r, { forCustomer = false } = {}) => ({
  id: String(r._id),
  code: r.code,
  status: r.status,
  statusLabel: RESERVATION_STATUS_LABELS[r.status] ?? r.status,
  at: r.at,
  endsAt: r.endsAt,
  minutes: Math.round((new Date(r.endsAt).getTime() - new Date(r.at).getTime()) / 60_000),
  partySize: r.partySize,
  event: r.event ?? "",
  note: r.note ?? "",
  tableNumber: r.tableNumber || "",
  pricing: {
    grossPaise: r.pricing?.grossPaise || r.pricing?.amountPaise || 0,
    discountPaise: r.pricing?.discountPaise ?? 0,
    couponCode: r.pricing?.couponCode ?? "",
    amountPaise: r.pricing?.amountPaise ?? 0,
    prepayPaise: r.pricing?.prepayPaise ?? 0,
    remainingPaise: r.pricing?.remainingPaise ?? 0,
  },
  payment: { status: r.payment?.status ?? "none", paidAt: r.payment?.paidAt ?? null },
  ...(forCustomer
    ? {}
    : {
        customer: { customerId: r.customer?.customerId ?? null, name: r.customer?.name ?? "", phone: r.customer?.phone ?? "", whatsapp: r.customer?.whatsapp ?? "" },
        staffNote: r.staffNote ?? "",
        tableId: r.tableId ?? null,
        source: r.source,
        history: r.history ?? [],
        createdAt: r.createdAt,
      }),
});

/** How many guests the outlet can seat at once: its own number, else its tables' seats added up, else no limit. */
async function capacityOf(ctx, settings) {
  if (settings.maxGuestsPerSlot > 0) return settings.maxGuestsPerSlot;
  const tables = await TableModel.find(tenantFilter(ctx, { isActive: true })).select("seats").lean();
  const seats = tables.reduce((n, t) => n + (t.seats ?? 0), 0);
  return seats > 0 ? seats : Infinity;
}

/**
 * Bookings that still hold seats anywhere between `from` and `to`. One whose advance hasn't been paid holds its seats only for the few minutes it is
 * given to pay (PAYMENT_HOLD_MINUTES) — a guest who wandered off must not keep a table from everyone else.
 */
function activeBetween(ctx, from, to, exceptId) {
  return ReservationModel.find(
    tenantFilter(ctx, {
      status: { $in: ACTIVE_RESERVATION_STATUSES },
      at: { $lt: to },
      endsAt: { $gt: from },
      $or: [{ "payment.status": { $ne: "pending" } }, { createdAt: { $gte: holdCutoff() } }],
      ...(exceptId ? { _id: { $ne: exceptId } } : {}),
    }),
  )
    .select("at endsAt partySize")
    .lean();
}

/** The outlet's booking settings as they apply (plan + its own switch). */
async function bookingConfig(ctx) {
  const config = await effectiveOutletConfig(ctx);
  return { config, settings: config.reservations, enabled: Boolean(config.features.reservations?.enabled) };
}

/**
 * What the booking page shows: whether booking is on, the days, the start times on one day for a party size, how long a booking can be, what it
 * costs and whether an advance can be paid online — and, once the guest has chosen a start (`startAt`), the end times they can pick with the
 * price of each.
 */
export async function availability(ctx, { dayKey, partySize, startAt }) {
  const { config, settings, enabled } = await bookingConfig(ctx);
  const durations = reservationDurations(settings);
  const rate = settings.pricePerPersonHour ?? 0;
  // an advance can be taken only when the booking costs something AND the outlet has an online way to be paid
  const gateway = enabled && rate > 0 ? await bookingGatewayFor(ctx) : null;
  const publicSettings = {
    minPartySize: settings.minPartySize,
    maxPartySize: settings.maxPartySize,
    durationMinutes: durations.usual,
    minDurationMinutes: durations.min,
    maxDurationMinutes: durations.max,
    stepMinutes: durations.step,
    cancelUntilMinutes: settings.cancelUntilMinutes,
    autoConfirm: settings.autoConfirm,
    guestNote: settings.guestNote,
  };
  const pricing = { ratePaise: rate, prepayPercent: PREPAY_PERCENT, prepayAvailable: Boolean(gateway), gateway: gateway ?? null };
  if (!enabled) return { enabled: false, settings: publicSettings, pricing, days: [], dayKey: null, slots: [], start: null, ends: [] };
  const days = reservationDays(settings);
  const day = days.some((d) => d.dayKey === dayKey) ? dayKey : days[0].dayKey;
  const party = Math.min(Math.max(Number(partySize) || 2, settings.minPartySize), settings.maxPartySize);
  // the day's bookings, plus anything still holding seats from the evening before
  const from = istDate(shiftDay(day, -1), 0);
  const to = istDate(shiftDay(day, 2), 0);
  const [bookings, capacity] = await Promise.all([activeBetween(ctx, from, to), capacityOf(ctx, settings)]);
  const slots = reservationSlots(config, settings, day, { partySize: party, bookings, capacity });
  const start = startAt ? new Date(startAt) : null;
  const chosen = start && !Number.isNaN(start.getTime()) ? slots.find((x) => x.at === start.toISOString() && x.available) : null;
  const ends = chosen ? reservationEnds(config, settings, day, chosen.at, { partySize: party, bookings, capacity }) : [];
  return { enabled: true, settings: publicSettings, pricing, days, dayKey: day, partySize: party, slots, start: chosen ? chosen.at : null, ends };
}

/** Where the restaurant reaches the guest: the WhatsApp number they gave, else the number they signed in with. */
const guestNumber = (r) => r.customer?.whatsapp || r.customer?.phone || "";

/** The words the guest gets for a booking's news: "received", "confirmed", "declined" or "cancelled" — said with where, when, what was paid and what is left. */
async function guestText(ctx, r, kind, reason = "") {
  const outlet = await OutletModel.findOne({ _id: ctx.outletId, brandId: ctx.brandId }).select("name config.identity.name").lean();
  const where = outlet?.config?.identity?.name || outlet?.name || "the restaurant";
  const name = firstNameOf(r.customer?.name) || "there";
  const when = formatRange(r.at, r.endsAt);
  const why = reason ? ` ${reason.trim().replace(/\.?$/, ".")}` : "";
  const advance = r.payment?.status === "paid" || r.payment?.status === "refund_due" ? r.pricing?.prepayPaise ?? 0 : 0;
  const refund = (r.payment?.status === "refund_due" || r.payment?.status === "paid") && kind !== "confirmed" && kind !== "received" && (r.pricing?.prepayPaise ?? 0) > 0 ? ` Your advance of ${formatINR(r.pricing.prepayPaise)} will be refunded.` : "";
  const rest = r.pricing?.remainingPaise ?? 0;
  const food = " Your food and drinks are paid for separately, at the restaurant.";
  if (kind === "received") {
    return `Hi ${name}, we've received your table request ${r.code} at ${where} for ${when} (${r.partySize} ${r.partySize === 1 ? "guest" : "guests"}${r.event ? `, ${r.event}` : ""}).${advance ? ` Your advance of ${formatINR(advance)} is paid.` : ""} We check every request ourselves and will confirm it here on WhatsApp shortly.`;
  }
  if (kind === "confirmed") {
    return `Hi ${name}, your table for ${r.partySize} at ${where} is confirmed for ${when}. Booking ${r.code}.${advance ? ` You paid ${formatINR(advance)} in advance; the remaining ${formatINR(rest)} is paid at the restaurant.` : rest ? ` ${formatINR(rest)} is paid at the restaurant.` : ""}${rest || advance ? food : ""} See you soon!`;
  }
  if (kind === "declined") return `Hi ${name}, sorry — ${where} can't take your booking ${r.code} for ${when}.${why}${refund} Please choose another time.`;
  return `Hi ${name}, your booking ${r.code} at ${where} for ${when} has been cancelled by the restaurant.${why}${refund}`;
}

/** Send the guest a short message about their booking (never fails the booking). `text` is a message the team wrote or edited; without it, the usual words. */
async function tellGuest(ctx, r, kind, reason = "", { text } = {}) {
  try {
    const { settings } = await bookingConfig(ctx);
    const message = text?.trim() ? text.trim() : await guestText(ctx, r, kind, reason);
    const sent = await sendCustomerText(ctx, { phone: guestNumber(r), name: r.customer?.name, text: message, channel: "auto", source: "order", business: settings.whatsappTemplate });
    if (!sent.ok) logger.info({ reservation: r.code, reason: sent.reason }, "reservation message not sent");
    return sent;
  } catch (err) {
    logger.error({ err, reservation: r.code }, "reservation message failed");
    return { ok: false, reason: err?.message || "unexpected error" };
  }
}

/**
 * What the team is shown before answering a booking: the message the guest would get and the way it would go (linked WhatsApp, WhatsApp Business or
 * SMS — whichever the store has, in that order; `channel: null` = no way to send). The words are built as if the booking had already been
 * given `status`, so a refund line is there when a paid booking is declined.
 */
export async function guestMessagePreview(ctx, id, status, reason = "") {
  if (!/^[a-f\d]{24}$/i.test(String(id))) throw new HttpError(404, "Booking not found");
  if (!["confirmed", "declined", "cancelled"].includes(status)) throw new HttpError(400, "That answer has no message.");
  const doc = await ReservationModel.findOne(tenantFilter(ctx, { _id: id })).lean();
  if (!doc) throw new HttpError(404, "Booking not found");
  const { settings } = await bookingConfig(ctx);
  const as = status !== "confirmed" && doc.payment?.status === "paid" ? { ...doc, payment: { ...doc.payment, status: "refund_due" } } : doc;
  const [text, route] = await Promise.all([guestText(ctx, as, status, reason), customerTextRoute(ctx, { business: settings.whatsappTemplate, phone: guestNumber(doc) })]);
  return { text, channel: route.channel, channelLabel: route.label, to: guestNumber(doc) };
}

const changed = (ctx, r) => broadcast(ctx.outletId, { type: "reservation.changed", reservation: shapeReservation(r) });

/**
 * What a stay costs for a party, and what a coupon takes off: `{ grossPaise, discountPaise, amountPaise, prepayPaise, remainingPaise, coupon }`.
 * `coupon` is `{ ok, code, reason }` when a code was given. The coupon is a booking coupon only (see `evaluateCoupon`); a stay with no price has nothing to
 * take a coupon off. The same call prices a booking when it is made, so the guest is never charged anything other than what they were shown.
 */
export async function quoteBooking(ctx, { settings, partySize, minutes, couponCode, customerId = null }) {
  const base = bookingAmount(settings, partySize, minutes);
  const code = String(couponCode ?? "").trim().toUpperCase();
  if (!code) return { ...base, coupon: null };
  if (base.grossPaise <= 0) return { ...base, coupon: { ok: false, code, reason: "There's no booking charge to take a coupon off." } };
  const check = await checkCoupon({ ctx, code, subtotal: base.grossPaise, channel: "booking", customerId: customerId ? String(customerId) : null });
  if (!check.ok) return { ...base, coupon: { ok: false, code, reason: check.reason ?? "That coupon doesn't work here." } };
  const net = Math.max(0, base.grossPaise - check.discount);
  return { ...base, discountPaise: check.discount, ...splitBookingAmount(net), couponCode: check.code, coupon: { ok: true, code: check.code } };
}

/** The coupon box on the booking page: what a code is worth for the stay the guest has chosen. (Per-guest rules are checked when they book.) */
export async function previewBookingCoupon(ctx, { at, endsAt, partySize, code, customerId = null }) {
  const { settings, enabled } = await bookingConfig(ctx);
  if (!enabled) throw new HttpError(403, "This outlet isn't taking table bookings.");
  const start = new Date(at);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) throw new HttpError(400, "Choose the start and finish times first.");
  const durations = reservationDurations(settings);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  if (minutes < durations.min || minutes > durations.max) throw new HttpError(400, "Choose a stay of a length this restaurant takes.");
  const q = await quoteBooking(ctx, { settings, partySize, minutes, couponCode: code, customerId });
  return { ok: Boolean(q.coupon?.ok), code: q.coupon?.code ?? String(code).trim().toUpperCase(), reason: q.coupon?.reason ?? "", grossPaise: q.grossPaise, discountPaise: q.discountPaise, amountPaise: q.amountPaise, prepayPaise: q.prepayPaise, remainingPaise: q.remainingPaise };
}

/**
 * A new booking. A customer's must fit (the same rules as the times shown) and waits for the restaurant unless the
 * outlet confirms bookings by itself. A booking the team takes over the phone is confirmed at once and may go over
 * the capacity when they say so (`force`).
 *
 * The guest chooses when it ends (`endsAt`); without one it takes the usual length. If it costs something and the outlet can take an
 * online payment, a customer's booking starts out waiting for its advance (half the amount): its seats are held for a few minutes, the
 * team doesn't see it and the guest isn't told anything until the advance is paid (see `settleReservationPayment`).
 */
export async function createReservation(ctx, { at, endsAt, partySize, name, phone, whatsapp, event, note, couponCode, customerId = null, source = "customer", force = false, byUserId = null }) {
  const { config, settings, enabled } = await bookingConfig(ctx);
  if (!enabled) throw new HttpError(403, "This outlet isn't taking table bookings.");
  const when = new Date(at);
  if (Number.isNaN(when.getTime())) throw new HttpError(400, "Choose a time for the booking.");
  const durations = reservationDurations(settings);
  let minutes = durations.usual;
  let explicitEnd = false;
  if (endsAt) {
    const end = new Date(endsAt);
    if (Number.isNaN(end.getTime()) || end <= when) throw new HttpError(400, "Choose a finish time after the start time.");
    minutes = Math.round((end.getTime() - when.getTime()) / 60_000);
    explicitEnd = true;
  }
  const durationMs = minutes * 60_000;

  let wa = "";
  if (whatsapp) {
    wa = whatsappNumber(whatsapp) ?? "";
    if (!wa) throw new HttpError(400, "Enter a 10-digit WhatsApp number — we'll send the update there.");
  }

  if (customerId) {
    const upcoming = await ReservationModel.countDocuments(tenantFilter(ctx, { "customer.customerId": String(customerId), status: { $in: ["requested", "confirmed"] }, at: { $gte: new Date() } }));
    if (upcoming >= MAX_UPCOMING_PER_CUSTOMER) throw new HttpError(409, `You already have ${upcoming} upcoming bookings here — cancel one to make another.`);
  }
  const [bookings, capacity] = await Promise.all([activeBetween(ctx, when, new Date(when.getTime() + durationMs)), capacityOf(ctx, settings)]);
  const check = checkReservationTime(config, settings, when, partySize, { bookings, capacity, durationMinutes: minutes, explicitEnd });
  if (!check.ok && !(source === "staff" && force)) throw new HttpError(409, check.reason, { code: "slot_unavailable" });

  // what it costs (a coupon taken off), and whether the guest pays half of it now
  let pricing = bookingAmount(settings, partySize, minutes);
  if (source === "customer" && couponCode) {
    const q = await quoteBooking(ctx, { settings, partySize, minutes, couponCode, customerId });
    // a coupon the guest asked for that doesn't work now is told to them — never silently dropped (they would pay more than they were shown)
    if (!q.coupon?.ok) throw new HttpError(409, q.coupon?.reason || "That coupon doesn't work for this booking.", { code: "coupon_invalid" });
    pricing = q;
  }
  let paying = false;
  if (source === "customer" && pricing.prepayPaise > 0) {
    paying = Boolean(await bookingGatewayFor(ctx));
    // no online way to pay: nothing is charged in advance, the whole amount is paid at the restaurant
    if (!paying) pricing = { ...pricing, prepayPaise: 0, remainingPaise: pricing.amountPaise };
  } else if (source !== "customer") {
    pricing = { ...pricing, prepayPaise: 0, remainingPaise: pricing.amountPaise };
  }
  const { coupon: _checked, ...money } = pricing;

  const seq = await nextSequence(`booking:${ctx.outletId}`);
  const status = source === "staff" || (settings.autoConfirm && !paying) ? "confirmed" : "requested";
  const doc = await ReservationModel.create({
    brandId: ctx.brandId,
    outletId: ctx.outletId,
    code: `B-${String(seq).padStart(4, "0")}`,
    status,
    at: when,
    endsAt: new Date(when.getTime() + durationMs),
    partySize,
    customer: { customerId: customerId ? String(customerId) : null, name: (name ?? "").trim().slice(0, 80), phone: (phone ?? "").trim().slice(0, 20), whatsapp: wa },
    event: (event ?? "").trim().slice(0, 60),
    pricing: { ...money, couponCode: money.couponCode ?? "" },
    payment: { status: paying ? "pending" : "none" },
    note: (note ?? "").trim().slice(0, 300),
    source,
    history: [{ status, at: new Date(), by: byUserId ?? undefined, reason: paying ? "Waiting for the advance payment" : undefined }],
  });
  // the coupon is used up from the moment the booking exists (and given back if the advance is never paid — see `sweepUnpaidBookings`)
  if (money.couponCode && money.discountPaise > 0) {
    await recordRedemption({ ctx, code: money.couponCode, orderId: String(doc._id), orderNumber: doc.code, customerId: customerId ? String(customerId) : null, discount: money.discountPaise });
  }
  const r = doc.toObject();
  if (paying) return r; // nobody hears about it until the advance is paid
  changed(ctx, r);
  if (status === "confirmed") void tellGuest(ctx, r, "confirmed");
  else if (source === "customer") void tellGuest(ctx, r, "received");
  return r;
}

/**
 * The guest's advance was paid (the payment gateway confirmed it). The booking now goes to the team — or is confirmed straight away when
 * the outlet confirms by itself — and the guest is told on WhatsApp. If the booking was let go in the meantime (the hold ran out and the
 * payment came in late), the money is marked to be refunded instead. Safe to call twice.
 */
export async function settleReservationPayment(ctx, reservationId, paymentId = "") {
  const doc = await ReservationModel.findOne(tenantFilter(ctx, { _id: reservationId }));
  if (!doc || doc.payment?.status === "paid" || doc.payment?.status === "refund_due" || doc.payment?.status === "refunded") return null;
  const { settings } = await bookingConfig(ctx);
  doc.payment.paidAt = new Date();
  doc.payment.paymentId = String(paymentId || "");
  if (doc.status !== "requested") {
    doc.payment.status = "refund_due";
    doc.history.push({ status: doc.status, at: new Date(), by: "system", reason: "The advance arrived after this booking had been let go — it needs to be refunded" });
  } else {
    doc.payment.status = "paid";
    if (settings.autoConfirm) {
      doc.status = "confirmed";
      doc.history.push({ status: "confirmed", at: new Date(), by: "system", reason: `Advance of ${formatINR(doc.pricing?.prepayPaise ?? 0)} paid` });
    } else {
      doc.history.push({ status: "requested", at: new Date(), by: "system", reason: `Advance of ${formatINR(doc.pricing?.prepayPaise ?? 0)} paid` });
    }
  }
  await doc.save();
  const r = doc.toObject();
  changed(ctx, r);
  if (doc.payment.status === "paid") void tellGuest(ctx, r, r.status === "confirmed" ? "confirmed" : "received");
  return r;
}

/** Bookings whose advance was never paid, once their seats' hold has run out, are let go (cancelled) so nobody is left waiting on them. */
export async function sweepUnpaidBookings() {
  const rows = await ReservationModel.find({ "payment.status": "pending", createdAt: { $lt: holdCutoff() } }, null, { allowGlobalQuery: true }).limit(200);
  let released = 0;
  for (const doc of rows) {
    try {
      if (doc.status === "requested") {
        doc.status = "cancelled";
        doc.history.push({ status: "cancelled", at: new Date(), by: "system", reason: "The advance wasn't paid in time" });
      }
      doc.payment.status = "expired";
      await doc.save();
      if (doc.pricing?.couponCode) await releaseRedemption({ ctx: { brandId: doc.brandId, outletId: doc.outletId }, orderId: String(doc._id) });
      released += 1;
    } catch (err) {
      logger.error({ err, reservation: doc.code }, "couldn't let go of an unpaid booking");
    }
  }
  return released;
}

let sweeper = null;
/** Every 5 minutes, in every API process (the release is per booking and harmless to repeat). */
export function startBookingSweeper() {
  if (sweeper) return;
  sweeper = setInterval(() => {
    sweepUnpaidBookings().catch((err) => logger.error({ err }, "booking sweep failed"));
  }, 5 * 60_000);
  sweeper.unref();
}

/** How many bookings a list shows at most (the rest is reached with the date). */
const LIST_LIMIT = 300;

/**
 * The bookings for the dashboard. With `day` ("YYYY-MM-DD"): that one day (India time). Otherwise by `scope`: "upcoming" (today onwards, soonest first — the
 * default, so nobody has to go looking through dates), "earlier" (before today, newest first) or "all". Bookings still waiting for their advance are never in it.
 */
export async function listBookings(ctx, { day, scope = "upcoming" } = {}) {
  const base = { "payment.status": { $nin: UNSEEN_PAYMENT } };
  const today0 = istDate(istParts().dayKey, 0);
  let query;
  let sort = { at: 1, createdAt: 1 };
  let dayKey = null;
  if (DAY_KEY.test(String(day))) {
    dayKey = day;
    query = { ...base, at: { $gte: istDate(day, 0), $lt: istDate(shiftDay(day, 1), 0) } };
  } else if (scope === "earlier") {
    query = { ...base, at: { $lt: today0 } };
    sort = { at: -1, createdAt: -1 };
  } else if (scope === "all") {
    query = base;
  } else {
    query = { ...base, at: { $gte: today0 } };
  }
  const [found, waiting] = await Promise.all([
    ReservationModel.find(tenantFilter(ctx, query)).sort(sort).limit(LIST_LIMIT + 1).lean(),
    ReservationModel.countDocuments(tenantFilter(ctx, { status: "requested", at: { $gte: new Date() }, ...base })),
  ]);
  const rows = found.slice(0, LIST_LIMIT);
  const live = rows.filter((r) => ACTIVE_RESERVATION_STATUSES.includes(r.status) || r.status === "completed");
  return {
    scope: dayKey ? "day" : scope === "earlier" || scope === "all" ? scope : "upcoming",
    dayKey,
    reservations: rows.map((r) => shapeReservation(r)),
    counts: { bookings: live.length, guests: live.reduce((n, r) => n + r.partySize, 0), requested: rows.filter((r) => r.status === "requested").length, waitingAhead: waiting },
    more: found.length > LIST_LIMIT,
  };
}

/** One day's bookings (India time) — the same as `listBookings` with a day. */
export const bookingsForDay = (ctx, dayKey) => listBookings(ctx, { day: DAY_KEY.test(String(dayKey)) ? dayKey : istParts().dayKey });

/** Upcoming bookings still waiting to be confirmed (the sidebar badge). */
export const pendingCount = (ctx) => ReservationModel.countDocuments(tenantFilter(ctx, { status: "requested", at: { $gte: new Date() }, "payment.status": { $nin: UNSEEN_PAYMENT } }));

/**
 * The team moves a booking on (confirm, decline, seat, no-show, complete, cancel) and/or gives it a table or a note.
 * Only the next steps in RESERVATION_NEXT are allowed. The guest hears about a confirm, a decline and a cancel.
 */
export async function updateReservation(ctx, id, { status, tableId, staffNote, reason, refunded, manual = false, notify }, byUserId) {
  if (!/^[a-f\d]{24}$/i.test(String(id))) throw new HttpError(404, "Booking not found");
  const doc = await ReservationModel.findOne(tenantFilter(ctx, { _id: id }));
  if (!doc) throw new HttpError(404, "Booking not found");
  const prevStatus = doc.status;
  if (status && status !== doc.status) {
    // the usual steps only — unless the team changes the status BY HAND ("Change status"), which can put a booking in any state (a no-show marked by mistake,
    // a declined booking brought back). A by-hand change doesn't re-check that the table is free: the team knows the floor.
    if (!manual && !(RESERVATION_NEXT[doc.status] ?? []).includes(status)) {
      throw new HttpError(409, `A booking that's ${RESERVATION_STATUS_LABELS[doc.status].toLowerCase()} can't be marked ${RESERVATION_STATUS_LABELS[status].toLowerCase()}.`);
    }
    const was = doc.status;
    doc.status = status;
    const why = manual && !(RESERVATION_NEXT[was] ?? []).includes(status) ? `Changed by hand from ${RESERVATION_STATUS_LABELS[was].toLowerCase()}${reason ? ` — ${reason}` : ""}` : reason;
    doc.history.push({ status, at: new Date(), by: byUserId, reason: why?.slice(0, 200) });
    // a booking that won't happen gives the advance back (declined, cancelled); a no-show keeps it
    if ((status === "declined" || status === "cancelled") && doc.payment?.status === "paid") doc.payment.status = "refund_due";
    // …and one brought back to life keeps its advance again (if it was already sent back, the restaurant has to ask for it again — it stays "refunded")
    else if (status !== "declined" && status !== "cancelled" && doc.payment?.status === "refund_due") doc.payment.status = "paid";
  }
  if (refunded === true) {
    if (doc.payment?.status !== "refund_due") throw new HttpError(409, "There's no refund waiting on this booking.");
    doc.payment.status = "refunded";
    doc.payment.refundedAt = new Date();
    doc.history.push({ status: doc.status, at: new Date(), by: byUserId, reason: `Advance of ${formatINR(doc.pricing?.prepayPaise ?? 0)} refunded` });
  }
  if (tableId !== undefined) {
    if (tableId) {
      const table = /^[a-f\d]{24}$/i.test(String(tableId)) ? await TableModel.findOne(tenantFilter(ctx, { _id: tableId })).lean() : null;
      if (!table) throw new HttpError(404, "That table isn't at this outlet.");
      doc.tableId = String(table._id);
      doc.tableNumber = table.number;
    } else {
      doc.tableId = null;
      doc.tableNumber = "";
    }
  }
  if (staffNote !== undefined) doc.staffNote = String(staffNote).slice(0, 300);
  await doc.save();
  const r = doc.toObject();
  changed(ctx, r);
  if (status && status !== prevStatus && (status === "confirmed" || status === "declined" || status === "cancelled")) {
    // the team decides whether the guest is told, and in what words ({ send: false } = nobody is messaged); with no answer, the usual message goes
    if (notify?.send !== false) void tellGuest(ctx, r, status, reason, { text: notify?.message });
  }
  return r;
}

/* ------------------------------------------------------------ the guest's own */

/** A customer's bookings at this store: upcoming first, then the last month's. */
export async function customerReservations({ brandId, customerId }) {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const found = await ReservationModel.find(brandFilter({ brandId }, { "customer.customerId": String(customerId), at: { $gte: since } })).sort({ at: -1 }).limit(30).lean();
  // one still waiting for its advance is shown while its seats are held (so it can be paid); one whose hold ran out is as good as gone
  const rows = found.filter((r) => (r.payment?.status !== "pending" || awaitingPayment(r)) && r.payment?.status !== "expired");
  const outletIds = [...new Set(rows.map((r) => r.outletId))];
  const outlets = outletIds.length ? await OutletModel.find({ brandId, _id: { $in: outletIds } }).select("name slug config.identity.name config.reservations.cancelUntilMinutes").lean() : [];
  const byId = new Map(outlets.map((o) => [String(o._id), o]));
  const now = Date.now();
  return rows.map((r) => {
    const o = byId.get(r.outletId);
    const cancelUntil = (o?.config?.reservations?.cancelUntilMinutes ?? 60) * 60_000;
    return {
      ...shapeReservation(r, { forCustomer: true }),
      outlet: { id: r.outletId, name: o?.config?.identity?.name || o?.name || "", slug: o?.slug ?? "" },
      canCancel: ["requested", "confirmed"].includes(r.status) && new Date(r.at).getTime() - now >= cancelUntil,
      /** the advance is still to be paid (and can be, for a few minutes) */
      canPay: awaitingPayment(r),
    };
  });
}

/** A customer cancels their own booking — while it is still ahead by the outlet's cancel window. */
export async function cancelOwnReservation({ brandId, customerId, id }) {
  if (!/^[a-f\d]{24}$/i.test(String(id))) throw new HttpError(404, "Booking not found");
  const doc = await ReservationModel.findOne(brandFilter({ brandId }, { _id: id, "customer.customerId": String(customerId) }));
  if (!doc) throw new HttpError(404, "Booking not found");
  if (!["requested", "confirmed"].includes(doc.status)) throw new HttpError(409, "This booking can't be cancelled any more.");
  const ctx = { brandId, outletId: doc.outletId };
  const { settings } = await bookingConfig(ctx);
  if (new Date(doc.at).getTime() - Date.now() < settings.cancelUntilMinutes * 60_000) {
    throw new HttpError(409, `Bookings can be cancelled online until ${settings.cancelUntilMinutes} minutes before — please call the restaurant.`);
  }
  doc.status = "cancelled";
  doc.history.push({ status: "cancelled", at: new Date(), by: "customer", reason: "Cancelled by the guest" });
  // an advance already paid goes back to the guest (the team marks it refunded once it has been sent); one never paid is just dropped
  if (doc.payment?.status === "paid") doc.payment.status = "refund_due";
  else if (doc.payment?.status === "pending") doc.payment.status = "expired"; // it never reached the team, and still doesn't show to them
  await doc.save();
  if (doc.payment?.status === "expired" && doc.pricing?.couponCode) await releaseRedemption({ ctx: { brandId: doc.brandId, outletId: doc.outletId }, orderId: String(doc._id) });
  const r = doc.toObject();
  changed(ctx, r);
  return shapeReservation(r, { forCustomer: true });
}
