"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatWhen } from "@onetap/config-schema";
import { fx } from "@onetap/ui";
import { CalendarCheck2, CalendarDays, Clock, Phone, Users } from "lucide-react";
import { api } from "@/lib/clientApi";
import { useCustomer } from "@/lib/useCustomer";
import { CustomerGate } from "./CustomerGate";
import { Stepper } from "./Stepper";

/**
 * Book a table: how many people, which day, a time that still has room for them, and an optional note. Signed-in
 * customers only (the restaurant needs to be able to reach them). Times come from the API with how full they are, so
 * a time that can't take the party is shown but can't be picked.
 */
export function BookingView({ outletId, outletName, outletSlug, phone }) {
  const { customer, loading, refresh } = useCustomer();
  const [party, setParty] = useState(2);
  const [day, setDay] = useState("");
  const [data, setData] = useState(null);
  const [at, setAt] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [booked, setBooked] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    const q = new URLSearchParams({ outletId, party: String(party) });
    if (day) q.set("day", day);
    api(`/api/reservations/availability?${q}`)
      .then((r) => {
        if (!live) return;
        setData(r);
        if (!day && r.dayKey) setDay(r.dayKey);
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [outletId, party, day, reload]);

  // a time that no longer fits the party (it changed, or someone else booked) is let go
  useEffect(() => {
    if (at && data?.slots && !data.slots.some((s) => s.at === at && s.available)) setAt("");
  }, [data, at]);

  if (loading || !data) {
    return (
      <section className="ot-page-px" style={wrap} aria-busy="true">
        <p style={muted}>Loading…</p>
      </section>
    );
  }

  if (!data.enabled) {
    return (
      <section className="ot-page-px" style={wrap}>
        <h1 style={h1}>Book a table</h1>
        <p style={muted}>{outletName} isn&apos;t taking table bookings online right now.{phone ? ` Call us on ${phone}.` : ""}</p>
      </section>
    );
  }

  if (booked) {
    return (
      <section className="ot-page-px" style={{ ...wrap, textAlign: "center" }} data-testid="booking-done">
        <span style={doneIcon}>
          <CalendarCheck2 size={30} />
        </span>
        <h1 style={{ ...h1, marginTop: 18 }}>{booked.status === "confirmed" ? "Your table is booked" : "Booking request sent"}</h1>
        <p style={{ ...muted, fontSize: 15 }}>
          {formatWhen(booked.at)} · table for {booked.partySize} · {booked.code}
        </p>
        <p style={{ ...muted, fontSize: 14 }}>
          {booked.status === "confirmed" ? "See you then!" : "The restaurant will confirm it shortly — you'll get a message, and you can see it on your account page."}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20, flexWrap: "wrap" }}>
          <Link href={`/${outletSlug}/account`} className="ot-fx-btn" style={fx("btn", primaryLink)}>
            My bookings
          </Link>
          <Link href={`/${outletSlug}`} style={secondaryLink}>
            Back to the menu
          </Link>
        </div>
      </section>
    );
  }

  const settings = data.settings;
  const slots = data.slots ?? [];
  const book = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api("/api/reservations", { outletId, at, partySize: party, note: note.trim() || undefined, name: customer?.name || undefined });
      setBooked(r.reservation);
    } catch (e) {
      setError(e.message);
      // the times may have changed under us — fetch them again
      setReload((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ot-page-px" style={wrap} data-testid="booking">
      <h1 style={h1}>Book a table</h1>
      <p style={{ ...muted, margin: "6px 0 18px" }}>
        at {outletName}
        {settings.guestNote ? ` · ${settings.guestNote}` : ""}
      </p>

      <div className="ot-fx-card" style={fx("card", card)}>
        <div style={label}>
          <Users size={15} /> How many people?
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Stepper value={party} onChange={(n) => setParty(Math.max(settings.minPartySize, Math.min(settings.maxPartySize, n)))} />
          <span style={muted}>
            {settings.minPartySize}–{settings.maxPartySize} online{phone ? ` · more? call ${phone}` : ""}
          </span>
        </div>
      </div>

      <div className="ot-fx-card" style={fx("card", card)}>
        <div style={label}>
          <CalendarDays size={15} /> Which day?
        </div>
        <div style={chips}>
          {data.days.map((d) => (
            <button key={d.dayKey} type="button" className="ot-fx-chip" data-active={d.dayKey === day} aria-pressed={d.dayKey === day} style={fx("chip", { ...chip, ...(d.dayKey === day ? chipOn : {}) })} onClick={() => { setDay(d.dayKey); setAt(""); }}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ot-fx-card" style={fx("card", card)}>
        <div style={label}>
          <Clock size={15} /> What time?
        </div>
        {slots.length ? (
          <div style={slotGrid}>
            {slots.map((s) => (
              <button
                key={s.at}
                type="button"
                disabled={!s.available}
                className="ot-fx-chip"
                data-testid="booking-slot"
                data-active={at === s.at}
                aria-pressed={at === s.at}
                title={s.available ? undefined : "Fully booked for your party"}
                onClick={() => setAt(s.at)}
                style={fx("chip", { ...chip, textAlign: "center", ...(at === s.at ? chipOn : {}), ...(s.available ? {} : { opacity: 0.4, cursor: "not-allowed", textDecoration: "line-through" }) })}
              >
                {s.label}
              </button>
            ))}
          </div>
        ) : (
          <p style={{ ...muted, margin: 0 }}>No times left on this day — try another day.</p>
        )}
      </div>

      <div className="ot-fx-card" style={fx("card", card)}>
        <label style={label} htmlFor="booking-note">
          Anything we should know? (optional)
        </label>
        <input id="booking-note" className="ot-fx-input" style={fx("input", input)} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Birthday, high chair, window seat…" />
      </div>

      {!customer ? (
        <div style={{ marginTop: 14 }}>
          <CustomerGate customer={null} outletId={outletId} heading="Sign in to book" intro="Your mobile number lets the restaurant confirm your booking. We'll text you a code." onSuccess={() => void refresh()} />
        </div>
      ) : (
        <>
          {error ? (
            <p style={errorBox} role="alert">
              {error}
            </p>
          ) : null}
          <button type="button" className="ot-fx-btn" style={fx("btn", bookBtn)} disabled={!at || busy} onClick={book} data-testid="booking-submit">
            {busy ? "Booking…" : at ? `Book for ${party} · ${formatWhen(at)}` : "Choose a time"}
          </button>
          {phone ? (
            <p style={{ ...muted, textAlign: "center", marginTop: 10 }}>
              <Phone size={12} style={{ verticalAlign: -1 }} /> Questions? Call {phone}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

const wrap = { maxWidth: 640, margin: "0 auto", padding: "28px 16px 56px", boxSizing: "border-box" };
const h1 = { margin: 0, fontFamily: "var(--font-heading)", fontSize: "clamp(1.6rem, 4.5vw, 2.1rem)", lineHeight: 1.15 };
const muted = { fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5 };
const card = { background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 14, padding: 16, marginBottom: 12 };
const label = { display: "flex", alignItems: "center", gap: 7, fontWeight: 700, fontSize: 14, marginBottom: 10 };
const chips = { display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 };
const chip = { font: "inherit", fontSize: 13, fontWeight: 600, padding: "8px 13px", borderRadius: 999, border: "1.5px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", cursor: "pointer", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" };
const chipOn = { borderColor: "var(--color-primary)", background: "color-mix(in srgb, var(--color-primary) 10%, var(--color-bg))", color: "var(--color-primary)" };
const slotGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: 6 };
const input = { width: "100%", font: "inherit", fontSize: 14.5, padding: "10px 12px", borderRadius: 9, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", boxSizing: "border-box" };
const bookBtn = { width: "100%", marginTop: 8, font: "inherit", fontWeight: 700, fontSize: 16, padding: "14px 18px", borderRadius: "var(--radius-card)", background: "var(--color-primary)", color: "var(--color-on-primary)", border: "none", cursor: "pointer" };
const errorBox = { color: "var(--tone-danger)", background: "var(--tone-danger-wash)", fontSize: 13, padding: "10px 12px", borderRadius: 10, margin: "8px 0" };
const doneIcon = { display: "inline-grid", placeItems: "center", width: 70, height: 70, borderRadius: "50%", background: "var(--tone-success-wash)", color: "var(--tone-success)" };
const primaryLink = { display: "inline-block", font: "inherit", fontWeight: 700, fontSize: 14.5, padding: "12px 22px", borderRadius: 12, background: "var(--color-primary)", color: "var(--color-on-primary)", textDecoration: "none" };
const secondaryLink = { display: "inline-block", fontWeight: 700, fontSize: 14.5, padding: "12px 10px", color: "var(--color-primary)" };
