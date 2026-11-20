import { useMemo, useState } from "react";
import { formatClock, formatDay, istDayKey, istParts, relativeDay, RESERVATION_NEXT, RESERVATION_STATUS_LABELS, shiftDay } from "@onetap/config-schema";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Plus, StickyNote, Users, X } from "lucide-react";
import { useAuth } from "../lib/useAuth";
import { useCreateStaffReservation, useReservations, useReservationSlots, useUpdateReservation } from "../lib/useGrowth";
import { useOrderStream } from "../lib/useOrderStream";
import { useOutlet } from "../lib/useOutlet";
import { useStorePlan } from "../lib/useStorePlan";
import { useTables } from "../lib/useTables";
import { Button, Card, Empty, Field, Modal, Note, PageHeader, Pill, Select, TextInput, Toast } from "../ui";

const TONE = { requested: "warn", confirmed: "info", seated: "ok", completed: "neutral", declined: "error", cancelled: "neutral", no_show: "error" };
const timeOf = (iso) => formatClock(istParts(iso).minutes);

/**
 * Table bookings — one day at a time (today first). Bookings waiting to be confirmed are marked; each booking shows
 * only the steps that make sense next (confirm / decline → seat / no-show / cancel → complete). Bookings taken over the
 * phone are added here and are confirmed at once.
 */
export function Reservations() {
  const { outlet } = useOutlet();
  const { can } = useAuth();
  const { hasFeature } = useStorePlan();
  const allowed = can("reservation:read") && hasFeature("reservations");
  const canManage = can("reservation:manage");
  const [day, setDay] = useState(() => istDayKey());
  const list = useReservations(outlet, day, allowed);
  const update = useUpdateReservation(outlet);
  const tables = useTables(outlet, allowed && can("table:read"));
  useOrderStream(outlet, allowed && can("order:read"));
  const [adding, setAdding] = useState(false);
  const [seating, setSeating] = useState(null);

  const header = (
    <PageHeader
      title="Table bookings"
      icon={<CalendarDays size={23} />}
      subtitle="Bookings from your storefront and the phone, a day at a time."
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
  const move = (status, r, reason) => update.mutate({ id: r.id, body: { status, ...(reason ? { reason } : {}) } });

  return (
    <>
      {header}
      {!bookingsOn ? <Note>Customers can't book online yet — switch on <strong>Table bookings</strong> in Settings → Outlet Settings. You can still add bookings here.</Note> : null}

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "space-between" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Button variant="outline" onClick={() => setDay(shiftDay(day, -1))} aria-label="Previous day"><ChevronLeft size={14} /></Button>
            <strong style={{ minWidth: 150, textAlign: "center", fontSize: 15 }} data-testid="booking-day">{relativeDay(day) === formatDay(day) ? formatDay(day) : `${relativeDay(day)} · ${formatDay(day)}`}</strong>
            <Button variant="outline" onClick={() => setDay(shiftDay(day, 1))} aria-label="Next day"><ChevronRight size={14} /></Button>
            {day !== today ? <Button variant="outline" onClick={() => setDay(today)}>Today</Button> : null}
            <TextInput type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} style={{ width: 150 }} aria-label="Pick a day" />
          </span>
          {counts ? (
            <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }} data-testid="booking-counts">
              <Pill tone="info">{counts.bookings} booking{counts.bookings === 1 ? "" : "s"}</Pill>
              <Pill tone="info"><Users size={11} /> {counts.guests} guests</Pill>
              {counts.requested ? <Pill tone="warn">{counts.requested} to confirm</Pill> : null}
              {counts.waitingAhead > counts.requested ? <Pill tone="warn">{counts.waitingAhead} waiting in all</Pill> : null}
            </span>
          ) : null}
        </div>
      </Card>

      {update.error ? <Toast kind="error">{update.error.message}</Toast> : null}

      <Card>
        {list.isLoading ? (
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>Loading…</p>
        ) : !rows.length ? (
          <Empty icon={<CalendarDays size={28} />} title="No bookings this day">Bookings made on your storefront, and ones you add here, show up on their day.</Empty>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rows.map((r) => {
              const next = RESERVATION_NEXT[r.status] ?? [];
              return (
                <div key={r.id} style={{ ...bookingRow, ...(r.status === "requested" ? { borderColor: "var(--tone-warning)", background: "color-mix(in srgb, var(--tone-warning-wash) 60%, var(--color-surface))" } : {}) }} data-testid={`booking-${r.code}`} data-status={r.status}>
                  <div style={{ minWidth: 76 }}>
                    <div style={{ fontSize: 17, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{timeOf(r.at)}</div>
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
                    {r.note ? (
                      <div style={{ fontSize: 12.5, marginTop: 4, color: "var(--tone-warning)", fontWeight: 600, display: "flex", gap: 5, alignItems: "flex-start" }}>
                        <StickyNote size={12} style={{ marginTop: 2 }} /> {r.note}
                      </div>
                    ) : null}
                  </div>
                  <Pill tone={TONE[r.status]}>{RESERVATION_STATUS_LABELS[r.status]}</Pill>
                  {canManage && next.length ? (
                    <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      {next.includes("confirmed") ? <Button onClick={() => move("confirmed", r)} data-testid="booking-confirm"><Check size={13} /> Confirm</Button> : null}
                      {next.includes("seated") ? <Button onClick={() => setSeating(r)} data-testid="booking-seat">Seat</Button> : null}
                      {next.includes("completed") ? <Button onClick={() => move("completed", r)} data-testid="booking-complete">Done</Button> : null}
                      {next.includes("no_show") ? <Button variant="outline" onClick={() => move("no_show", r)}>No-show</Button> : null}
                      {next.includes("declined") ? (
                        <Button variant="outline" onClick={() => { const why = window.prompt("Why can't you take this booking? (sent to the guest — optional)", ""); if (why !== null) move("declined", r, why); }} data-testid="booking-decline">
                          Decline
                        </Button>
                      ) : null}
                      {next.includes("cancelled") ? (
                        <Button variant="outline" onClick={() => { const why = window.prompt("Cancel this booking? A reason for the guest (optional):", ""); if (why !== null) move("cancelled", r, why); }} aria-label="Cancel booking">
                          <X size={13} />
                        </Button>
                      ) : null}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {adding ? <NewBooking outlet={outlet} defaultDay={day} onClose={() => setAdding(false)} onBooked={(d) => setDay(d)} /> : null}
      {seating ? (
        <SeatDialog
          booking={seating}
          tables={(tables.data?.tables ?? []).filter((t) => t.isActive)}
          busy={update.isPending}
          onClose={() => setSeating(null)}
          onSeat={(tableId) => update.mutate({ id: seating.id, body: { status: "seated", tableId: tableId || null } }, { onSuccess: () => setSeating(null) })}
        />
      ) : null}
    </>
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
          <Field label="Day">
            <TextInput type="date" value={day} onChange={(e) => { setDay(e.target.value); setAt(""); }} aria-label="Booking day" />
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
          onClick={() => create.mutate({ at, partySize: party, name: name.trim(), phone: phone.trim(), note: note.trim(), force }, { onSuccess: () => { onBooked(day); onClose(); } })}
          data-testid="new-booking-submit"
        >
          {create.isPending ? "Booking…" : "Book — confirmed"}
        </Button>
      </footer>
    </Modal>
  );
}

const bookingRow = { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "12px 14px", border: "1px solid var(--color-border)", borderRadius: 12, background: "var(--color-surface)" };
