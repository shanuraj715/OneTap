import {
  ACTIVE_RESERVATION_STATUSES,
  checkReservationTime,
  formatWhen,
  istDate,
  istParts,
  RESERVATION_NEXT,
  RESERVATION_STATUS_LABELS,
  reservationDays,
  reservationSlots,
  shiftDay,
} from "@onetap/config-schema";
import { brandFilter, nextSequence, OutletModel, ReservationModel, TableModel, tenantFilter } from "@onetap/db";
import { logger } from "../../logger.js";
import { HttpError } from "../../middleware/error.js";
import { broadcast } from "../../realtime/hub.js";
import { firstNameOf } from "../notify/notify.service.js";
import { sendCustomerText } from "../notify/customer-text.js";
import { effectiveOutletConfig } from "../outlets/config.service.js";

/** A customer can hold this many upcoming bookings at one outlet at once. */
export const MAX_UPCOMING_PER_CUSTOMER = 3;

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export const shapeReservation = (r, { forCustomer = false } = {}) => ({
  id: String(r._id),
  code: r.code,
  status: r.status,
  statusLabel: RESERVATION_STATUS_LABELS[r.status] ?? r.status,
  at: r.at,
  endsAt: r.endsAt,
  partySize: r.partySize,
  note: r.note ?? "",
  tableNumber: r.tableNumber || "",
  ...(forCustomer
    ? {}
    : {
        customer: { customerId: r.customer?.customerId ?? null, name: r.customer?.name ?? "", phone: r.customer?.phone ?? "" },
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

/** Bookings that still hold seats anywhere between `from` and `to`. */
function activeBetween(ctx, from, to, exceptId) {
  return ReservationModel.find(tenantFilter(ctx, { status: { $in: ACTIVE_RESERVATION_STATUSES }, at: { $lt: to }, endsAt: { $gt: from }, ...(exceptId ? { _id: { $ne: exceptId } } : {}) }))
    .select("at endsAt partySize")
    .lean();
}

/** The outlet's booking settings as they apply (plan + its own switch). */
async function bookingConfig(ctx) {
  const config = await effectiveOutletConfig(ctx);
  return { config, settings: config.reservations, enabled: Boolean(config.features.reservations?.enabled) };
}

/** What the booking page shows: whether booking is on, the days, and the times on one day for a party size. */
export async function availability(ctx, { dayKey, partySize }) {
  const { config, settings, enabled } = await bookingConfig(ctx);
  const publicSettings = {
    minPartySize: settings.minPartySize,
    maxPartySize: settings.maxPartySize,
    durationMinutes: settings.durationMinutes,
    cancelUntilMinutes: settings.cancelUntilMinutes,
    autoConfirm: settings.autoConfirm,
    guestNote: settings.guestNote,
  };
  if (!enabled) return { enabled: false, settings: publicSettings, days: [], dayKey: null, slots: [] };
  const days = reservationDays(settings);
  const day = days.some((d) => d.dayKey === dayKey) ? dayKey : days[0].dayKey;
  const party = Math.min(Math.max(Number(partySize) || 2, settings.minPartySize), settings.maxPartySize);
  // the day's bookings, plus anything still holding seats from the evening before
  const from = istDate(shiftDay(day, -1), 0);
  const to = istDate(shiftDay(day, 2), 0);
  const [bookings, capacity] = await Promise.all([activeBetween(ctx, from, to), capacityOf(ctx, settings)]);
  const slots = reservationSlots(config, settings, day, { partySize: party, bookings, capacity });
  return { enabled: true, settings: publicSettings, days, dayKey: day, partySize: party, slots };
}

/** Send the guest a short message about their booking (never fails the booking). */
async function tellGuest(ctx, r, kind, reason = "") {
  try {
    const outlet = await OutletModel.findOne({ _id: ctx.outletId, brandId: ctx.brandId }).select("name config.identity.name").lean();
    const where = outlet?.config?.identity?.name || outlet?.name || "the restaurant";
    const name = firstNameOf(r.customer?.name) || "there";
    const when = formatWhen(r.at);
    const why = reason ? ` ${reason.trim().replace(/\.?$/, ".")}` : "";
    const text =
      kind === "confirmed"
        ? `Hi ${name}, your table for ${r.partySize} at ${where} is confirmed for ${when}. Booking ${r.code}. See you soon!`
        : kind === "declined"
          ? `Hi ${name}, sorry — ${where} can't take your booking for ${when}.${why} Please choose another time.`
          : `Hi ${name}, your booking ${r.code} at ${where} for ${when} has been cancelled by the restaurant.${why}`;
    const sent = await sendCustomerText(ctx, { phone: r.customer?.phone, name: r.customer?.name, text, channel: "auto", source: "order" });
    if (!sent.ok) logger.info({ reservation: r.code, reason: sent.reason }, "reservation message not sent");
  } catch (err) {
    logger.error({ err, reservation: r.code }, "reservation message failed");
  }
}

const changed = (ctx, r) => broadcast(ctx.outletId, { type: "reservation.changed", reservation: shapeReservation(r) });

/**
 * A new booking. A customer's must fit (the same rules as the times shown) and waits for the restaurant unless the
 * outlet confirms bookings by itself. A booking the team takes over the phone is confirmed at once and may go over
 * the capacity when they say so (`force`).
 */
export async function createReservation(ctx, { at, partySize, name, phone, note, customerId = null, source = "customer", force = false, byUserId = null }) {
  const { config, settings, enabled } = await bookingConfig(ctx);
  if (!enabled) throw new HttpError(403, "This outlet isn't taking table bookings.");
  const when = new Date(at);
  if (Number.isNaN(when.getTime())) throw new HttpError(400, "Choose a time for the booking.");
  const durationMs = settings.durationMinutes * 60_000;

  if (customerId) {
    const upcoming = await ReservationModel.countDocuments(tenantFilter(ctx, { "customer.customerId": String(customerId), status: { $in: ["requested", "confirmed"] }, at: { $gte: new Date() } }));
    if (upcoming >= MAX_UPCOMING_PER_CUSTOMER) throw new HttpError(409, `You already have ${upcoming} upcoming bookings here — cancel one to make another.`);
  }
  const [bookings, capacity] = await Promise.all([activeBetween(ctx, new Date(when.getTime() - durationMs), new Date(when.getTime() + durationMs)), capacityOf(ctx, settings)]);
  const check = checkReservationTime(config, settings, when, partySize, { bookings, capacity });
  if (!check.ok && !(source === "staff" && force)) throw new HttpError(409, check.reason, { code: "slot_unavailable" });

  const seq = await nextSequence(`booking:${ctx.outletId}`);
  const status = source === "staff" || settings.autoConfirm ? "confirmed" : "requested";
  const doc = await ReservationModel.create({
    brandId: ctx.brandId,
    outletId: ctx.outletId,
    code: `B-${String(seq).padStart(4, "0")}`,
    status,
    at: when,
    endsAt: new Date(when.getTime() + durationMs),
    partySize,
    customer: { customerId: customerId ? String(customerId) : null, name: (name ?? "").trim().slice(0, 80), phone: (phone ?? "").trim().slice(0, 20) },
    note: (note ?? "").trim().slice(0, 300),
    source,
    history: [{ status, at: new Date(), by: byUserId ?? undefined }],
  });
  const r = doc.toObject();
  changed(ctx, r);
  if (status === "confirmed") void tellGuest(ctx, r, "confirmed");
  return r;
}

/** One day's bookings (India time) for the dashboard, with the day's numbers and how many are waiting anywhere ahead. */
export async function bookingsForDay(ctx, dayKey) {
  const day = DAY_KEY.test(String(dayKey)) ? dayKey : istParts().dayKey;
  const [rows, waiting] = await Promise.all([
    ReservationModel.find(tenantFilter(ctx, { at: { $gte: istDate(day, 0), $lt: istDate(shiftDay(day, 1), 0) } })).sort({ at: 1, createdAt: 1 }).lean(),
    ReservationModel.countDocuments(tenantFilter(ctx, { status: "requested", at: { $gte: new Date() } })),
  ]);
  const live = rows.filter((r) => ACTIVE_RESERVATION_STATUSES.includes(r.status) || r.status === "completed");
  return {
    dayKey: day,
    reservations: rows.map((r) => shapeReservation(r)),
    counts: { bookings: live.length, guests: live.reduce((n, r) => n + r.partySize, 0), requested: rows.filter((r) => r.status === "requested").length, waitingAhead: waiting },
  };
}

/** Upcoming bookings still waiting to be confirmed (the sidebar badge). */
export const pendingCount = (ctx) => ReservationModel.countDocuments(tenantFilter(ctx, { status: "requested", at: { $gte: new Date() } }));

/**
 * The team moves a booking on (confirm, decline, seat, no-show, complete, cancel) and/or gives it a table or a note.
 * Only the next steps in RESERVATION_NEXT are allowed. The guest hears about a confirm, a decline and a cancel.
 */
export async function updateReservation(ctx, id, { status, tableId, staffNote, reason }, byUserId) {
  if (!/^[a-f\d]{24}$/i.test(String(id))) throw new HttpError(404, "Booking not found");
  const doc = await ReservationModel.findOne(tenantFilter(ctx, { _id: id }));
  if (!doc) throw new HttpError(404, "Booking not found");
  if (status && status !== doc.status) {
    if (!(RESERVATION_NEXT[doc.status] ?? []).includes(status)) {
      throw new HttpError(409, `A booking that's ${RESERVATION_STATUS_LABELS[doc.status].toLowerCase()} can't be marked ${RESERVATION_STATUS_LABELS[status].toLowerCase()}.`);
    }
    doc.status = status;
    doc.history.push({ status, at: new Date(), by: byUserId, reason: reason?.slice(0, 200) });
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
  if (status === "confirmed" || status === "declined" || status === "cancelled") void tellGuest(ctx, r, status, reason);
  return r;
}

/* ------------------------------------------------------------ the guest's own */

/** A customer's bookings at this store: upcoming first, then the last month's. */
export async function customerReservations({ brandId, customerId }) {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const rows = await ReservationModel.find(brandFilter({ brandId }, { "customer.customerId": String(customerId), at: { $gte: since } })).sort({ at: -1 }).limit(30).lean();
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
  await doc.save();
  const r = doc.toObject();
  changed(ctx, r);
  return shapeReservation(r, { forCustomer: true });
}
