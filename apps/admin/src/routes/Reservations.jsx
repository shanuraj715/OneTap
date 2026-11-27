import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DatePickerInput } from "@rasoipulse/ui";
import { formatClock, formatDay, formatDuration, formatINR, formatRange, istDayKey, istParts, relativeDay, RESERVATION_NEXT, RESERVATION_STATUS_LABELS, RESERVATION_STATUSES, shiftDay } from "@rasoipulse/config-schema";
import { CalendarDays, Check, MessageCircle, MoreVertical, PartyPopper, Plus, Send, StickyNote, Users, Wallet, X } from "lucide-react";
import * as api from "../lib/api";
import { useAuth } from "../lib/useAuth";
import { useCreateStaffReservation, useReservations, useReservationSlots, useUpdateReservation } from "../lib/useGrowth";
import { useOrderStream } from "../lib/useOrderStream";
import { useOutlet } from "../lib/useOutlet";
import { useStorePlan } from "../lib/useStorePlan";
import { useTables } from "../lib/useTables";
import { Button, Card, Empty, Field, Menu, Modal, Note, PageHeader, Pill, Select, TextInput, Toast } from "../ui";

const TONE = { requested: "warn", confirmed: "info", seated: "ok", completed: "neutral", declined: "error", cancelled: "neutral", no_show: "error" };
const timeOf = (iso) => formatClock(istParts(iso).minutes);
const SCOPES = [
  ["upcoming", "Upcoming"],
  ["earlier", "Earlier"],
  ["all", "All"],
];
/** What the guest is told, and the heading of the window that asks the team, for the three answers. */
const ANSWERS = {
  confirmed: { title: "Approve this booking", verb: "Approve", sending: "Approve & send message", quiet: "Approve without a message" },
  declined: { title: "Decline this booking", verb: "Decline", sending: "Decline & send message", quiet: "Decline without a message" },
  cancelled: { title: "Cancel this booking", verb: "Cancel", sending: "Cancel booking & send message", quiet: "Cancel without a message" },
};

/**
 * Table bookings — EVERY upcoming booking in one list, soonest first, grouped by day (so nobody has to hunt through dates);
 * "Earlier" shows the ones before today and "All" both. The date is only a filter: pick one and the list shows just that day.
 * Bookings waiting to be confirmed are marked; each booking shows who, when (start to end), the occasion, the WhatsApp number and the money.
 * Approving, declining or cancelling asks whether to tell the guest — and sends the message through whatever the store has (linked WhatsApp,
 * WhatsApp Business or SMS, chosen automatically). Any booking's status can also be changed by hand ("Change status"), so a "No-show"
 * marked by mistake is never stuck. Bookings taken over the phone are added here and are confirmed at once.
 */
export function Reservations() {
  const { outlet } = useOutlet();
  const { can } = useAuth();
  const { hasFeature } = useStorePlan();
  const allowed = can("reservation:read") && hasFeature("reservations");
  const canManage = can("reservation:manage");
  const [scope, setScope] = useState("upcoming");
  const [day, setDay] = useState(""); // "" = no date filter
  const list = useReservations(outlet, { scope, day }, allowed);
  const update = useUpdateReservation(outlet);
  const tables = useTables(outlet, allowed && can("table:read"));
  useOrderStream(outlet, allowed && can("order:read"));
  const [adding, setAdding] = useState(false);
  const [seating, setSeating] = useState(null); // { booking, manual }
  const [answering, setAnswering] = useState(null); // { booking, status, manual }
  const [plain, setPlain] = useState(null); // { booking, status } — a status change that needs no message

  const header = (
    <PageHeader
      title="Table bookings"
      icon={<CalendarDays size={23} />}
      subtitle="Every booking from your storefront and the phone, soonest first. Use the date to look at one day."
      action={allowed && canManage ? (
        <Button onClick={() => setAdding(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6 }} data-testid="new-booking">
          <Plus size={14} /> New booking
        </Button>
      ) : null}
    />
  );
  if (!allowed) {
    return (
      <>
        {header}
        <Card>{hasFeature("reservations") ? "Your role can't see table bookings." : "Table reservations aren't included in your plan."}</Card>
      </>
    );
  }
  const bookingsOn = outlet?.config?.features?.reservations?.enabled;
  const rows = list.data?.reservations ?? [];
  const counts = list.data?.counts;
  const today = istDayKey();

  // grouped by day, in the order the list came in (soonest first; "Earlier" newest first)
  const groups = [];
  for (const r of rows) {
    const key = istParts(r.at).dayKey;
    const last = groups.at(-1);
    if (last && last.key === key) last.rows.push(r);
    else groups.push({ key, rows: [r] });
  }
  const title = (key) => (relativeDay(key) === formatDay(key) ? formatDay(key) : `${relativeDay(key)} · ${formatDay(key)}`);

  /** The team chose a status for a booking (the buttons, or "Change status"): which window it needs. */
  const choose = (status, booking, manual) => {
    if (status === "seated") return setSeating({ booking, manual });
    if (status === "confirmed" || status === "declined" || status === "cancelled") return setAnswering({ booking, status, manual });
    return setPlain({ booking, status, manual });
  };
  const statusOptions = (r) =>
    RESERVATION_STATUSES.filter((s) => s !== r.status).map((s) => ({ value: s, label: RESERVATION_STATUS_LABELS[s], testId: `booking-set-${s}`, danger: s === "declined" || s === "cancelled" || s === "no_show" }));

  return (
    <>
      {header}
      {!bookingsOn ? <Note>Customers can't book online yet — switch on <strong>Table bookings</strong> in Settings → Outlet Settings. You can still add bookings here.</Note> : null}

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span role="tablist" aria-label="Which bookings" style={{ display: "inline-flex", border: "1px solid var(--color-border)", borderRadius: 9, overflow: "hidden", opacity: day ? 0.5 : 1 }}>
              {SCOPES.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={!day && scope === id}
                  data-testid={`booking-scope-${id}`}
                  onClick={() => { setDay(""); setScope(id); }}
                  style={{ font: "inherit", fontSize: 13, fontWeight: 600, padding: "8px 14px", border: "none", cursor: "pointer", background: !day && scope === id ? "var(--color-primary)" : "var(--color-bg)", color: !day && scope === id ? "var(--color-on-primary)" : "var(--color-text)" }}
                >
                  {label}
                </button>
              ))}
            </span>
            <span style={{ width: 210 }} data-testid="booking-filter-day">
              <DatePickerInput
                variant="filled"
                fullWidth
                value={day}
                placeholder="Filter by date"
                ariaLabel="Filter by date"
                testId="booking-filter-date"
                triggerStyle={{ minHeight: 36, padding: "6px 12px" }}
                formatValue={(d) => formatDay(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`) + `, ${d.getFullYear()}`}
                onChange={(str) => str && setDay(str)}
              />
            </span>
            {day ? (
              <Button variant="outline" onClick={() => setDay("")} data-testid="booking-filter-clear">
                <X size={13} /> Show all upcoming
              </Button>
            ) : null}
          </span>
          {counts ? (
            <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }} data-testid="booking-counts">
              <Pill tone="info">{counts.bookings} booking{counts.bookings === 1 ? "" : "s"}</Pill>
              <Pill tone="info"><Users size={11} /> {counts.guests} guests</Pill>
              {counts.requested ? <Pill tone="warn">{counts.requested} to confirm</Pill> : null}
              {!day && counts.waitingAhead > counts.requested ? <Pill tone="warn">{counts.waitingAhead} waiting in all</Pill> : null}
            </span>
          ) : null}
        </div>
        {day ? <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--color-text-muted)" }} data-testid="booking-filter-note">Showing only {title(day)}. {day < today ? "That day has passed." : ""}</p> : null}
      </Card>

      {update.error ? <Toast kind="error">{update.error.message}</Toast> : null}

      <Card>
        {list.isLoading ? (
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>Loading…</p>
        ) : !rows.length ? (
          <Empty icon={<CalendarDays size={28} />} title={day ? "No bookings on this day" : scope === "earlier" ? "No earlier bookings" : "No upcoming bookings"}>Bookings made on your storefront, and ones you add here, show up in this list.</Empty>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-testid="booking-list">
            {groups.map((g) => (
              <section key={g.key} data-day={g.key} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <h3 style={{ margin: "6px 0 0", fontSize: 12.5, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--color-text-muted)" }} data-testid="booking-group">{title(g.key)}</h3>
                {g.rows.map((r) => {
                  const next = RESERVATION_NEXT[r.status] ?? [];
                  return (
                    <div key={r.id} style={{ ...bookingRow, ...(r.status === "requested" ? { borderColor: "var(--tone-warning)", background: "color-mix(in srgb, var(--tone-warning-wash) 60%, var(--color-surface))" } : {}) }} data-testid={`booking-${r.code}`} data-status={r.status}>
                      <div style={{ minWidth: 76 }}>
                        <div style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{timeOf(r.at)}</div>
                        {r.endsAt ? <div style={{ fontSize: 11.5, color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums" }} data-testid="booking-until">to {timeOf(r.endsAt)}{r.minutes ? ` · ${formatDuration(r.minutes)}` : ""}</div> : null}
                        <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>{r.code}</div>
                      </div>
                      <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                        <div style={{ fontWeight: 700 }}>
                          {r.customer.name || "Guest"} <span style={{ fontWeight: 500, color: "var(--color-text-muted)" }}>· {r.partySize} {r.partySize === 1 ? "person" : "people"}</span>
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
                          {r.customer.phone || "no phone"} · {r.source === "staff" ? "taken by the team" : "booked online"}
                          {r.tableNumber ? ` · Table ${r.tableNumber}` : ""}
                        </div>
                        {r.event ? (
                          <div style={{ fontSize: 12.5, marginTop: 3, display: "flex", gap: 5, alignItems: "center" }} data-testid="booking-event">
                            <PartyPopper size={12} /> {r.event}
                          </div>
                        ) : null}
                        {r.customer.whatsapp ? (
                          <div style={{ fontSize: 12.5, marginTop: 3, display: "flex", gap: 5, alignItems: "center" }} data-testid="booking-whatsapp">
                            <MessageCircle size={12} /> WhatsApp +91 {r.customer.whatsapp}
                          </div>
                        ) : null}
                        {r.pricing?.amountPaise || r.pricing?.discountPaise ? (
                          <div style={{ fontSize: 12.5, marginTop: 3, display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }} data-testid="booking-money">
                            <Wallet size={12} />
                            {formatINR(r.pricing.amountPaise)}
                            {r.pricing.couponCode ? ` after ${r.pricing.couponCode} (−${formatINR(r.pricing.discountPaise)})` : ""}
                            {r.payment?.status === "paid" ? ` · ${formatINR(r.pricing.prepayPaise)} paid in advance, ${formatINR(r.pricing.remainingPaise)} at the restaurant` : r.payment?.status === "refund_due" || r.payment?.status === "refunded" ? ` · advance ${formatINR(r.pricing.prepayPaise)}` : " · pay at the restaurant"}
                            {r.payment?.status === "refund_due" ? <Pill tone="error">Refund {formatINR(r.pricing.prepayPaise)} due</Pill> : null}
                            {r.payment?.status === "refunded" ? <Pill tone="neutral">Advance refunded</Pill> : null}
                          </div>
                        ) : null}
                        {r.note ? (
                          <div style={{ fontSize: 12.5, marginTop: 4, color: "var(--tone-warning)", fontWeight: 600, display: "flex", gap: 5, alignItems: "flex-start" }}>
                            <StickyNote size={12} style={{ marginTop: 2 }} /> {r.note}
                          </div>
                        ) : null}
                      </div>
                      <Pill tone={TONE[r.status]} testid="booking-status">{RESERVATION_STATUS_LABELS[r.status]}</Pill>
                      {canManage && r.payment?.status === "refund_due" ? (
                        <Button variant="outline" data-testid="booking-refunded" onClick={() => { if (window.confirm(`Mark the ${formatINR(r.pricing.prepayPaise)} advance as refunded? Do this once you have sent the money back to ${r.customer.name || "the guest"} (from your payment gateway).`)) update.mutate({ id: r.id, body: { refunded: true } }); }}>
                          Mark refunded
                        </Button>
                      ) : null}
                      {canManage ? (
                        <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
                          {next.includes("confirmed") ? <Button onClick={() => choose("confirmed", r, false)} data-testid="booking-confirm"><Check size={13} /> Approve</Button> : null}
                          {next.includes("seated") ? <Button onClick={() => choose("seated", r, false)} data-testid="booking-seat">Seat</Button> : null}
                          {next.includes("completed") ? <Button onClick={() => choose("completed", r, false)} data-testid="booking-complete">Done</Button> : null}
                          {next.includes("no_show") ? <Button variant="outline" onClick={() => choose("no_show", r, false)}>No-show</Button> : null}
                          {next.includes("declined") ? <Button variant="outline" onClick={() => choose("declined", r, false)} data-testid="booking-decline">Decline</Button> : null}
                          {next.includes("cancelled") ? <Button variant="outline" onClick={() => choose("cancelled", r, false)} aria-label="Cancel booking" data-testid="booking-cancel"><X size={13} /></Button> : null}
                          <Menu
                            header="Change status by hand"
                            width={250}
                            options={statusOptions(r)}
                            onSelect={(s) => choose(s, r, !next.includes(s))}
                            trigger={({ toggle, open }) => (
                              <Button variant="outline" onClick={toggle} aria-label={`Change the status of ${r.code}`} aria-expanded={open} data-testid={`booking-status-menu-${r.code}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <MoreVertical size={14} /> Status
                              </Button>
                            )}
                          />
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </section>
            ))}
            {list.data?.more ? <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "var(--color-text-muted)" }}>Showing the first {rows.length}. Use the date to look further.</p> : null}
          </div>
        )}
      </Card>

      {adding ? <NewBooking outlet={outlet} defaultDay={day && day >= today ? day : today} onClose={() => setAdding(false)} onBooked={() => { setDay(""); setScope("upcoming"); }} /> : null}
      {seating ? (
        <SeatDialog
          booking={seating.booking}
          tables={(tables.data?.tables ?? []).filter((t) => t.isActive)}
          busy={update.isPending}
          onClose={() => setSeating(null)}
          onSeat={(tableId) => update.mutate({ id: seating.booking.id, body: { status: "seated", tableId: tableId || null, ...(seating.manual ? { manual: true } : {}) } }, { onSuccess: () => setSeating(null) })}
        />
      ) : null}
      {answering ? (
        <AnswerDialog
          outlet={outlet}
          booking={answering.booking}
          status={answering.status}
          busy={update.isPending}
          error={update.error?.message}
          onClose={() => setAnswering(null)}
          onSubmit={(body) => update.mutate({ id: answering.booking.id, body: { status: answering.status, ...(answering.manual ? { manual: true } : {}), ...body } }, { onSuccess: () => setAnswering(null) })}
        />
      ) : null}
      {plain ? (
        <Modal onClose={() => setPlain(null)} width={420} ariaLabel="Change the status">
          <div style={{ padding: "20px 22px 6px" }} data-testid="status-dialog">
            <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-heading)" }}>Mark as {RESERVATION_STATUS_LABELS[plain.status].toLowerCase()}?</h3>
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-text-muted)", lineHeight: 1.55 }}>
              {plain.booking.customer.name || "The guest"} · {formatRange(plain.booking.at, plain.booking.endsAt)} · now {RESERVATION_STATUS_LABELS[plain.booking.status].toLowerCase()}.
              {plain.status === "no_show" ? " A no-show keeps the advance." : ""}
              {plain.status === "requested" ? " It goes back to the list of bookings waiting to be confirmed." : ""}
              {plain.manual ? " This is a manual change — nothing checks that it fits the table." : ""}
            </p>
          </div>
          <footer style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 22px 18px" }}>
            <Button variant="outline" onClick={() => setPlain(null)}>Cancel</Button>
            <Button data-testid="status-submit" disabled={update.isPending} onClick={() => update.mutate({ id: plain.booking.id, body: { status: plain.status, ...(plain.manual ? { manual: true } : {}) } }, { onSuccess: () => setPlain(null) })}>
              {update.isPending ? "Saving…" : `Mark ${RESERVATION_STATUS_LABELS[plain.status].toLowerCase()}`}
            </Button>
          </footer>
        </Modal>
      ) : null}
    </>
  );
}

/**
 * The window that opens when a booking is approved, declined or cancelled: a reason (for the last two), and whether to tell the guest. The message
 * is already written (and can be edited); the line under it says which way it will go — the store's linked WhatsApp, WhatsApp Business or SMS,
 * picked automatically in that order — or that the store has no way to send one.
 */
function AnswerDialog({ outlet, booking, status, busy, error, onClose, onSubmit }) {
  const words = ANSWERS[status];
  const [reason, setReason] = useState("");
  const [send, setSend] = useState(true);
  const [text, setText] = useState("");
  const [edited, setEdited] = useState(false);
  const [asked, setAsked] = useState(reason);
  // the written message follows the reason (a moment after typing stops) until someone edits it by hand
  useEffect(() => {
    const t = setTimeout(() => setAsked(reason), 350);
    return () => clearTimeout(t);
  }, [reason]);
  const preview = useQuery({
    queryKey: ["reservation-message", booking.id, status, asked],
    queryFn: () => api.reservationMessage(outlet, booking.id, status, asked),
    staleTime: 0,
  });
  useEffect(() => {
    if (preview.data && !edited) setText(preview.data.text);
  }, [preview.data, edited]);
  const channel = preview.data?.channel ?? null;
  const canSend = Boolean(channel);
  useEffect(() => {
    if (preview.data && !preview.data.channel) setSend(false);
  }, [preview.data]);
  const refund = booking.payment?.status === "paid" && status !== "confirmed" && booking.pricing?.prepayPaise > 0;
  const number = booking.customer.whatsapp || booking.customer.phone;

  return (
    <Modal onClose={onClose} width={540} ariaLabel={words.title}>
      <div style={{ padding: "20px 22px 6px" }} data-testid="notify-dialog">
        <h3 style={{ margin: "0 0 4px", fontFamily: "var(--font-heading)" }}>{words.title}</h3>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--color-text-muted)" }}>
          {booking.customer.name || "Guest"} · {booking.partySize} {booking.partySize === 1 ? "person" : "people"} · {formatRange(booking.at, booking.endsAt)} · {booking.code}
        </p>
        {status !== "confirmed" ? (
          <Field label="Reason (the guest will see it)" style={{ maxWidth: "none" }}>
            <TextInput value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder={status === "declined" ? "e.g. We're fully booked that evening" : "e.g. A private event came up"} aria-label="Reason" data-testid="notify-reason" autoFocus />
          </Field>
        ) : null}
        {refund ? (
          <Note>Their advance of <strong>{formatINR(booking.pricing.prepayPaise)}</strong> will be marked <strong>refund due</strong> — send it back from your payment gateway, then press “Mark refunded” on the booking.</Note>
        ) : null}
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, margin: "14px 0 8px", cursor: canSend ? "pointer" : "not-allowed", opacity: canSend ? 1 : 0.6 }}>
          <input type="checkbox" checked={send && canSend} disabled={!canSend} onChange={(e) => setSend(e.target.checked)} data-testid="notify-send" style={{ width: 16, height: 16, accentColor: "var(--color-primary)", margin: 0 }} />
          <Send size={14} /> Tell {booking.customer.name?.split(" ")[0] || "the guest"} on WhatsApp
        </label>
        <p style={{ margin: "0 0 8px", fontSize: 12.5, color: "var(--color-text-muted)" }} data-testid="notify-channel" data-channel={channel ?? "none"}>
          {preview.isLoading ? "Checking how this can be sent…" : channel ? <>Sent automatically through <strong>{preview.data.channelLabel}</strong> to <strong>+91 {number}</strong>.</> : <>This store has no way to send a message (link a WhatsApp number, set up WhatsApp Business or an SMS gateway in Settings → Notifications). The guest will still see the new status on their account page.</>}
        </p>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setEdited(true); }}
          disabled={!send || !canSend}
          rows={5}
          maxLength={900}
          aria-label="Message to the guest"
          data-testid="notify-message"
          style={{ width: "100%", boxSizing: "border-box", font: "inherit", fontSize: 13.5, lineHeight: 1.5, padding: "10px 12px", border: "1px solid var(--color-border)", borderRadius: 9, background: "var(--color-bg)", color: "var(--color-text)", resize: "vertical", opacity: send && canSend ? 1 : 0.55 }}
        />
        {error ? <Toast kind="error">{error}</Toast> : null}
      </div>
      <footer style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 22px 18px", flexWrap: "wrap" }}>
        <Button variant="outline" onClick={onClose}>Back</Button>
        <Button data-testid="notify-submit" disabled={busy || preview.isLoading || (send && canSend && !text.trim())} onClick={() => onSubmit({ ...(reason.trim() ? { reason: reason.trim() } : {}), notify: send && canSend ? { send: true, message: text.trim() } : { send: false } })} variant={status === "confirmed" ? undefined : "outline"} style={status === "confirmed" ? undefined : { color: "var(--tone-danger)", borderColor: "var(--tone-danger)" }}>
          {busy ? "Saving…" : send && canSend ? words.sending : words.quiet}
        </Button>
      </footer>
    </Modal>
  );
}

function SeatDialog({ booking, tables, busy, onClose, onSeat }) {
  const [tableId, setTableId] = useState(booking.tableId ?? "");
  const fitting = useMemo(() => [...tables].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })), [tables]);
  return (
    <Modal onClose={onClose} width={400} ariaLabel="Seat the booking">
      <div style={{ padding: "20px 22px 6px" }}>
        <h3 style={{ margin: "0 0 6px", fontFamily: "var(--font-heading)" }}>Seat {booking.customer.name || "the guests"} ({booking.partySize})</h3>
        <Field label="Table">
          <Select value={tableId} onChange={(e) => setTableId(e.target.value)} aria-label="Table">
            <option value="">No particular table</option>
            {fitting.map((t) => (
              <option key={t.id} value={t.id}>
                Table {t.number} · {t.seats} seats{t.activeSessionId ? " · in use" : ""}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <footer style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 22px 18px" }}>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onSeat(tableId)} disabled={busy} data-testid="seat-submit">{busy ? "Saving…" : "Seat them"}</Button>
      </footer>
    </Modal>
  );
}

/** A booking taken over the phone — confirmed at once; a full time can be taken anyway when the team chooses to. */
function NewBooking({ outlet, defaultDay, onClose, onBooked }) {
  const [day, setDay] = useState(defaultDay);
  const [party, setParty] = useState(2);
  const [at, setAt] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [force, setForce] = useState(false);
  const slots = useReservationSlots(outlet, day, party);
  const create = useCreateStaffReservation(outlet);
  const list = slots.data?.slots ?? [];
  const chosen = list.find((s) => s.at === at);

  return (
    <Modal onClose={onClose} width={520} ariaLabel="New booking">
      <div style={{ padding: "20px 22px 6px" }} data-testid="new-booking-form">
        <h3 style={{ margin: "0 0 12px", fontFamily: "var(--font-heading)" }}>New booking</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 10 }}>
          <Field label="Day" as="div">
            <DatePickerInput
              variant="filled"
              fullWidth
              value={day}
              minDate={istDayKey()}
              placeholder="Choose a day"
              ariaLabel="Booking day"
              testId="new-booking-day"
              triggerStyle={{ minHeight: 35, padding: "7px 12px" }}
              formatValue={(d) => formatDay(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`) + `, ${d.getFullYear()}`}
              onChange={(str) => {
                if (str && str !== day) {
                  setDay(str);
                  setAt("");
                }
              }}
            />
          </Field>
          <Field label="People">
            <TextInput type="number" min={1} max={200} value={party} onChange={(e) => setParty(Math.max(1, Math.min(200, Number(e.target.value) || 1)))} aria-label="Party size" />
          </Field>
        </div>
        <Field label="Time">
          <Select value={at} onChange={(e) => setAt(e.target.value)} aria-label="Booking time">
            <option value="">{slots.isLoading ? "Loading times…" : list.length ? "Choose a time" : "No times on this day (check opening hours)"}</option>
            {list.map((s) => (
              <option key={s.at} value={s.at}>
                {s.label}{s.available ? (s.seatsLeft !== null ? ` · ${s.seatsLeft} seats free` : "") : " · full"}
              </option>
            ))}
          </Select>
        </Field>
        {chosen && !chosen.available ? (
          <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 13, margin: "-4px 0 8px" }}>
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} /> That time is full — book it anyway
          </label>
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Field label="Guest's name">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="Guest name" />
          </Field>
          <Field label="Phone">
            <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} inputMode="tel" aria-label="Guest phone" />
          </Field>
        </div>
        <Field label="Note (optional)">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Birthday, high chair, window seat…" aria-label="Booking note" />
        </Field>
        {create.error ? <Toast kind="error">{create.error.message}</Toast> : null}
      </div>
      <footer style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 22px 18px" }}>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          disabled={!at || !name.trim() || create.isPending || (chosen && !chosen.available && !force)}
          onClick={() => create.mutate({ at, partySize: party, name: name.trim(), phone: phone.trim(), note: note.trim(), force }, { onSuccess: () => { onBooked(); onClose(); } })}
          data-testid="new-booking-submit"
        >
          {create.isPending ? "Booking…" : "Book — confirmed"}
        </Button>
      </footer>
    </Modal>
  );
}

const bookingRow = { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "12px 14px", border: "1px solid var(--color-border)", borderRadius: 12, background: "var(--color-surface)" };
