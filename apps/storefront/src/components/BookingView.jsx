"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  couponSummary,
  BOOKING_EVENT_MAX,
  BOOKING_EVENT_OTHER,
  BOOKING_EVENTS,
  formatDuration,
  formatINR,
  formatRange,
  PREPAY_PERCENT,
  whatsappNumber,
} from "@rasoipulse/config-schema";
import { DatePickerInput, fx, SearchSelect, TimePickerInput } from "@rasoipulse/ui";
import { CalendarCheck2, CalendarDays, Clock, Info, MessageCircle, PartyPopper, Phone, Tag, Users, Wallet, X } from "lucide-react";
import { api, payBookingAdvance } from "@/lib/clientApi";
import { useCustomer } from "@/lib/useCustomer";
import { CustomerGate } from "./CustomerGate";
import { Stepper } from "./Stepper";

/**
 * Book a table: how many people, the day (a calendar), from when to when (two time pickers), what the occasion is (a searchable list with "Other"),
 * the WhatsApp number to update, and an optional note — with the length of the stay and the estimated price worked out as the guest chooses.
 *
 * Nothing stands in the guest's way until the very end: the whole form is open to anyone. Signing in (the restaurant needs a number it can reach) is
 * asked for only AFTER the form is filled and the guest presses the last button — so they are never sent off to sign in before they have even seen
 * what they are booking, and everything they chose is still there when they come back from signing in.
 *
 * If the stay costs something and the outlet takes online payments, half of the amount is paid now and the rest at the restaurant; the restaurant
 * then approves the request by hand and the guest gets the answer on WhatsApp.
 */

const OTHER = BOOKING_EVENT_OTHER;
const EVENT_OPTIONS = [...BOOKING_EVENTS, OTHER].map((e) => ({ value: e, label: e }));
const digitsOf = (phone) => whatsappNumber(phone) ?? String(phone ?? "").replace(/\D/g, "").slice(-10);
const longDay = (dayKey) => new Date(`${dayKey}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

export function BookingView({ outletId, outletName, outletSlug, phone }) {
  const { customer, loading, refresh } = useCustomer();
  const [party, setParty] = useState(2);
  const [day, setDay] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [event, setEvent] = useState("");
  const [eventOther, setEventOther] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [note, setNote] = useState("");
  const [data, setData] = useState(null);
  const [tried, setTried] = useState(false); // the guest pressed the last button: from now on, what is still missing is pointed out
  const [askLogin, setAskLogin] = useState(false); // the form is complete and the guest isn't signed in: the sign-in step is shown
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(null); // a booking made but not yet paid: the guest can try the payment again
  // a coupon: the code typed, and what the server made of it for this stay ({ ok, code, reason, discountPaise, amountPaise, prepayPaise, remainingPaise })
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [offers, setOffers] = useState([]);
  const [booked, setBooked] = useState(null);
  const [reload, setReload] = useState(0);
  const loginRef = useRef(null);
  const formRef = useRef(null);

  // what is on offer for this party, day and start time (the end times come once a start is chosen)
  useEffect(() => {
    let live = true;
    const q = new URLSearchParams({ outletId, party: String(party) });
    if (day) q.set("day", day);
    if (start) q.set("start", start);
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
  }, [outletId, party, day, start, reload]);

  // a start that no longer fits the party (it changed, or someone else booked) is let go, and so is an end that is no longer offered
  useEffect(() => {
    if (!data?.slots) return;
    if (start && !data.slots.some((s) => s.at === start && s.available)) {
      setStart("");
      setEnd("");
    }
  }, [data, start]);
  // (the end times belong to the start they were asked for: until the answer for the current start arrives there are none)
  const ends = data?.start && data.start === start ? data.ends : [];
  useEffect(() => {
    if (start && ends.length && end && !ends.some((e) => e.at === end && e.available)) setEnd("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, start, end]);

  // a first end time as soon as a start is chosen: the usual length of a stay, or the nearest one that is free
  useEffect(() => {
    if (!start || end || !ends.length) return;
    const usual = data.settings.durationMinutes;
    const free = ends.filter((e) => e.available);
    const pick = free.find((e) => e.minutes === usual) ?? free[0];
    if (pick) setEnd(pick.at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, start, end]);

  // the WhatsApp box starts with the number the guest signed in with (once they have — nothing is asked before that)
  useEffect(() => {
    if (customer?.phone && !whatsapp) setWhatsapp(digitsOf(customer.phone));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer?.phone]);

  // the offers the restaurant has for table bookings (coupons ticked "Table booking")
  useEffect(() => {
    let live = true;
    api(`/api/coupons/public?outletId=${encodeURIComponent(outletId)}`)
      .then((r) => live && setOffers((r.coupons ?? []).filter((c) => (c.channels ?? []).includes("booking") && c.discountType !== "bogo")))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [outletId]);

  const settings = data?.settings;
  const pricing = data?.pricing;
  const slots = data?.slots ?? [];
  const chosenEnd = ends.find((e) => e.at === end) ?? null;
  const minutes = chosenEnd?.minutes ?? 0;

  /** Ask the server what a coupon is worth for this stay (it works the price out itself — nothing here is trusted). */
  const applyCoupon = async (code = couponCode, quiet = false) => {
    const c = code.trim();
    if (!c || !chosenEnd) return;
    if (!quiet) setCouponBusy(true);
    try {
      const r = await api("/api/reservations/coupon", { outletId, code: c, at: start, endsAt: end, partySize: party });
      setCoupon(r);
      if (r.ok) setCouponCode(r.code);
    } catch (e) {
      setCoupon({ ok: false, code: c, reason: e.message });
    } finally {
      setCouponBusy(false);
    }
  };
  // when the stay or the party changes, an applied coupon is worked out again for the new price (and dropped if it no longer works)
  useEffect(() => {
    if (coupon?.ok && chosenEnd) void applyCoupon(coupon.code, true);
    if (coupon?.ok && !chosenEnd) setCoupon(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end, party, chosenEnd?.amountPaise]);
  const eventName = event === OTHER ? eventOther.trim() : event;
  const waDigits = whatsappNumber(whatsapp);
  // the price: the stay's own price, or — with a working coupon — what is left after it
  const withCoupon = coupon?.ok && chosenEnd ? coupon : null;
  const gross = chosenEnd?.amountPaise ?? 0;
  const discount = withCoupon?.discountPaise ?? 0;
  const amount = withCoupon ? withCoupon.amountPaise : gross;
  const advance = pricing?.prepayAvailable && chosenEnd ? (withCoupon ? withCoupon.prepayPaise : chosenEnd.prepayPaise) : 0;
  const remaining = amount - advance;
  const locked = Boolean(pending); // a booking is waiting to be paid: the form is kept as it was

  /** What is still missing, in the order the form asks for it. */
  const problems = useMemo(() => {
    const out = [];
    if (!day) out.push({ id: "day", text: "Choose a day." });
    if (!start) out.push({ id: "start", text: "Choose a start time." });
    else if (!end) out.push({ id: "end", text: "Choose a finish time." });
    if (!event) out.push({ id: "event", text: "Choose what the booking is for." });
    else if (event === OTHER && !eventOther.trim()) out.push({ id: "eventOther", text: "Type the name of your event." });
    if (!waDigits) out.push({ id: "whatsapp", text: "Enter the 10-digit WhatsApp number we should update you on." });
    return out;
  }, [day, start, end, event, eventOther, waDigits]);
  const problem = (id) => (tried ? problems.find((p) => p.id === id)?.text : null);

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
    const paid = booked.payment?.status === "paid" ? booked.pricing.prepayPaise : 0;
    return (
      <section className="ot-page-px" style={{ ...wrap, textAlign: "center" }} data-testid="booking-done">
        <span style={doneIcon}>
          <CalendarCheck2 size={30} />
        </span>
        <h1 style={{ ...h1, marginTop: 18 }}>{booked.status === "confirmed" ? "Your table is booked" : "Booking request received"}</h1>
        <p style={{ ...muted, fontSize: 15 }}>
          {formatRange(booked.at, booked.endsAt)} · table for {booked.partySize} · {booked.code}
        </p>
        {booked.event ? <p style={{ ...muted, fontSize: 14, marginTop: -6 }}>{booked.event}</p> : null}
        {booked.pricing?.couponCode ? (
          <p style={{ ...muted, fontSize: 14, marginTop: -6 }} data-testid="booking-coupon-done">Coupon {booked.pricing.couponCode} saved you {formatINR(booked.pricing.discountPaise)}.</p>
        ) : null}
        {paid ? (
          <p style={{ ...muted, fontSize: 14 }} data-testid="booking-paid">
            You paid {formatINR(paid)} in advance{booked.pricing.remainingPaise ? ` · ${formatINR(booked.pricing.remainingPaise)} is paid at the restaurant, along with whatever you eat and drink` : ""}.
          </p>
        ) : booked.pricing?.amountPaise ? (
          <p style={{ ...muted, fontSize: 14 }}>Estimated {formatINR(booked.pricing.amountPaise)} — paid at the restaurant, along with whatever you eat and drink.</p>
        ) : null}
        <p style={{ ...muted, fontSize: 14 }}>
          {booked.status === "confirmed"
            ? `See you then! We'll also message you on WhatsApp (+91 ${waDigits ?? ""}).`
            : `We'll check your request ourselves and update you on WhatsApp (+91 ${waDigits ?? ""}) shortly. You can also see it on your account page.`}
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

  const finish = async (b) => {
    // the booking exists and waits for its advance: pay it, then read back how it stands
    setPending(b);
    await payBookingAdvance(outletId, b.id);
    let final = { ...b, payment: { ...b.payment, status: "paid" } };
    try {
      const mine = await api(`/api/reservations/mine?outletId=${encodeURIComponent(outletId)}`);
      final = mine.reservations.find((x) => x.id === b.id) ?? final;
    } catch {
      /* the page still says it was paid */
    }
    setPending(null);
    setBooked(final);
  };

  const submit = async () => {
    setTried(true);
    setError(null);
    if (problems.length) {
      const first = problems[0].id === "end" ? "start" : problems[0].id; // (the finish time sits in the same card as the start)
      document.querySelector(`[data-field="${first}"]`)?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      return;
    }
    // everything is filled in. A guest who isn't signed in is asked to NOW — not before.
    if (!customer) {
      setAskLogin(true);
      setTimeout(() => loginRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" }), 60);
      return;
    }
    setBusy(true);
    try {
      let b = pending;
      if (!b) {
        const r = await api("/api/reservations", {
          outletId,
          at: start,
          endsAt: end,
          partySize: party,
          event: eventName,
          whatsapp: waDigits,
          note: note.trim() || undefined,
          couponCode: withCoupon ? withCoupon.code : undefined,
          name: customer.name || undefined,
        });
        b = r.reservation;
      }
      if (b.payment?.status === "pending") await finish(b);
      else setBooked(b);
    } catch (e) {
      setError(e.message === "Payment was cancelled" ? "The payment wasn't completed. Your table is held for a few minutes — press the button to try the payment again." : e.message);
      // the times may have changed under us — fetch them again
      if (!pending) setReload((n) => n + 1);
    } finally {
      setBusy(false);
    }
  };

  const changeDetails = async () => {
    // let go of the unpaid request (best effort — it would expire by itself) and open the form again
    const b = pending;
    setPending(null);
    setError(null);
    if (b) api(`/api/reservations/${b.id}/cancel`, { outletId }).catch(() => undefined);
    setReload((n) => n + 1);
  };

  const buttonLabel = busy
    ? pending
      ? "Opening payment…"
      : "Sending…"
    : !customer
      ? "Continue"
      : advance > 0
        ? `Pay ${formatINR(advance)} & request booking`
        : "Request booking";

  const fieldProps = (id) => ({ "data-field": id });
  const inputFx = fx("input", { background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 10, color: "var(--color-text)" });
  const manual = !settings.autoConfirm;
  const charged = pricing.ratePaise > 0;

  return (
    <section className="ot-page-px" style={wrap} data-testid="booking" ref={formRef}>
      <h1 style={h1}>Book a table</h1>
      <p style={{ ...muted, margin: "6px 0 14px" }}>
        at {outletName}
        {settings.guestNote ? ` · ${settings.guestNote}` : ""}
      </p>

      <div style={notice} data-testid="booking-notice" role="note">
        <MessageCircle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>
          {manual ? (
            <>
              <strong>We approve every booking request ourselves.</strong> You&apos;ll get the update on <strong>WhatsApp</strong> — so we&apos;ll ask for your WhatsApp number below.
            </>
          ) : (
            <>
              <strong>Your booking is confirmed as soon as it is paid.</strong> We&apos;ll send you the details on <strong>WhatsApp</strong> — so we&apos;ll ask for your WhatsApp number below.
            </>
          )}
        </span>
      </div>

      {charged ? (
        <div style={{ ...notice, background: "var(--tone-warning-wash)", color: "var(--tone-warning)" }} data-testid="booking-money-notice" role="note">
          <Wallet size={17} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            <strong>{PREPAY_PERCENT}% of the booking amount is paid online</strong>{pricing.prepayAvailable ? " when you book" : ""}; the rest is paid at the restaurant. <strong>Your food and drinks are extra</strong> — you pay the booking amount <em>plus</em> whatever you eat and drink.
          </span>
        </div>
      ) : null}

      <fieldset disabled={locked} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
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

        <div className="ot-fx-card" style={fx("card", card)} {...fieldProps("day")}>
          <div style={label}>
            <CalendarDays size={15} /> Which day?
          </div>
          <DatePickerInput
            variant="filled"
            fullWidth
            disabled={locked}
            value={day}
            minDate={data.days[0]?.dayKey}
            maxDate={data.days.at(-1)?.dayKey}
            formatValue={(d) => longDay(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)}
            placeholder="Choose a day"
            ariaLabel="Booking day"
            testId="booking-day"
            triggerClassName="ot-fx-input"
            triggerStyle={{ ...inputFx, minHeight: 44, padding: "10px 12px", fontSize: 14.5 }}
            onChange={(str) => {
              if (str && str !== day) {
                setDay(str);
                setStart("");
                setEnd("");
              }
            }}
          />
          <p style={{ ...muted, margin: "8px 0 0" }}>
            Up to {data.days.length - 1} days ahead{day ? ` · ${data.days.find((d) => d.dayKey === day)?.label ?? ""}` : ""}.
          </p>
        </div>

        <div className="ot-fx-card" style={fx("card", card)} {...fieldProps("start")}>
          <div style={label}>
            <Clock size={15} /> What time?
          </div>
          {slots.length ? (
            <>
              <div style={twoCol}>
                <TimePickerInput
                  label="From"
                  value={start}
                  placeholder="Start time"
                  testId="booking-start"
                  groupByPeriod
                  options={slots.map((s) => ({ value: s.at, label: s.label, disabled: !s.available, hint: "Fully booked for your party" }))}
                  triggerClassName="ot-fx-input"
                  triggerStyle={inputFx}
                  onChange={(v) => {
                    setStart(v);
                    setEnd("");
                  }}
                />
                <TimePickerInput
                  label="To"
                  value={end}
                  placeholder={start ? "Finish time" : "Pick a start first"}
                  testId="booking-end"
                  disabled={!start}
                  emptyText="No finish times for this start — try another start time."
                  options={ends.map((e) => ({ value: e.at, label: `${e.label} · ${formatDuration(e.minutes)}`, disabled: !e.available, hint: "The table isn't free that long" }))}
                  triggerClassName="ot-fx-input"
                  triggerStyle={inputFx}
                  onChange={(v) => setEnd(v)}
                />
              </div>
              {problem("start") || problem("end") ? (
                <p style={fieldError} role="alert">
                  {problem("start") || problem("end")}
                </p>
              ) : null}
              <p style={{ ...muted, margin: "8px 0 0" }}>
                A stay is {formatDuration(settings.minDurationMinutes)} to {formatDuration(settings.maxDurationMinutes)}, in steps of {settings.stepMinutes} minutes.
              </p>
            </>
          ) : (
            <p style={{ ...muted, margin: 0 }}>No times left on this day — try another day.</p>
          )}
        </div>

        <div className="ot-fx-card" style={fx("card", card)} {...fieldProps("event")}>
          <div style={label}>
            <PartyPopper size={15} /> What&apos;s the occasion?
          </div>
          <SearchSelect
            value={event}
            options={EVENT_OPTIONS}
            placeholder="Choose an event"
            searchPlaceholder="Search events…"
            ariaLabel="Event"
            testId="booking-event"
            triggerClassName="ot-fx-input"
            triggerStyle={inputFx}
            onChange={(v) => setEvent(v)}
          />
          {problem("event") ? (
            <p style={fieldError} role="alert">
              {problem("event")}
            </p>
          ) : null}
          {event === OTHER ? (
            <div style={{ marginTop: 10 }} {...fieldProps("eventOther")}>
              <label style={{ ...muted, display: "block", marginBottom: 5 }} htmlFor="booking-event-other">
                Name of your event
              </label>
              <input
                id="booking-event-other"
                data-testid="booking-event-other"
                className="ot-fx-input"
                style={fx("input", input)}
                value={eventOther}
                maxLength={BOOKING_EVENT_MAX}
                onChange={(e) => setEventOther(e.target.value)}
                placeholder="e.g. Reunion dinner"
                autoFocus
              />
              {problem("eventOther") ? (
                <p style={fieldError} role="alert">
                  {problem("eventOther")}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="ot-fx-card" style={fx("card", card)} {...fieldProps("whatsapp")}>
          <label style={label} htmlFor="booking-whatsapp">
            <MessageCircle size={15} /> Your WhatsApp number
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ ...muted, fontSize: 14.5, fontWeight: 600 }}>+91</span>
            <input
              id="booking-whatsapp"
              data-testid="booking-whatsapp"
              className="ot-fx-input"
              style={fx("input", input)}
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value.replace(/[^\d ]/g, "").slice(0, 12))}
              placeholder="98765 43210"
              aria-invalid={Boolean(problem("whatsapp"))}
            />
          </div>
          <p style={{ ...muted, margin: "8px 0 0" }}>We&apos;ll send the answer to this number on WhatsApp.</p>
          {problem("whatsapp") ? (
            <p style={fieldError} role="alert">
              {problem("whatsapp")}
            </p>
          ) : null}
        </div>

        <div className="ot-fx-card" style={fx("card", card)}>
          <label style={label} htmlFor="booking-note">
            Anything we should know? (optional)
          </label>
          <input id="booking-note" className="ot-fx-input" style={fx("input", input)} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="High chair, window seat, a cake on the way…" />
        </div>

        {charged ? (
          <div className="ot-fx-card" style={fx("card", card)} data-testid="booking-coupon" {...fieldProps("coupon")}>
            <label style={label} htmlFor="booking-coupon-code">
              <Tag size={15} /> Have a coupon?
            </label>
            {withCoupon ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "9px 12px", borderRadius: 10, background: "var(--tone-success-wash)", color: "var(--tone-success)", fontWeight: 700, fontSize: 14 }} data-testid="booking-coupon-applied">
                <Tag size={14} /> {withCoupon.code} — you save {formatINR(withCoupon.discountPaise)}
                <button type="button" style={{ ...linkBtn, marginLeft: "auto", color: "inherit", display: "inline-flex", alignItems: "center", gap: 3 }} onClick={() => { setCoupon(null); setCouponCode(""); }} data-testid="booking-coupon-remove">
                  <X size={13} /> Remove
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    id="booking-coupon-code"
                    data-testid="booking-coupon-code"
                    className="ot-fx-input"
                    style={fx("input", { ...input, textTransform: "uppercase" })}
                    value={couponCode}
                    maxLength={24}
                    placeholder="Enter your code"
                    autoComplete="off"
                    onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); if (coupon) setCoupon(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void applyCoupon(); } }}
                  />
                  <button type="button" className="ot-fx-btn" style={fx("btn", { ...applyBtn, opacity: couponCode.trim() && chosenEnd ? 1 : 0.5 })} disabled={!couponCode.trim() || !chosenEnd || couponBusy} onClick={() => applyCoupon()} data-testid="booking-coupon-apply">
                    {couponBusy ? "Checking…" : "Apply"}
                  </button>
                </div>
                {!chosenEnd ? <p style={{ ...muted, margin: "8px 0 0" }}>Choose your times first — a coupon is worked out on the price of your stay.</p> : null}
                {coupon && !coupon.ok ? (
                  <p style={fieldError} role="alert" data-testid="booking-coupon-error">
                    {coupon.reason}
                  </p>
                ) : null}
                {offers.length ? (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }} data-testid="booking-offers">
                    {offers.map((c) => (
                      <button key={c.id} type="button" className="ot-fx-chip" style={fx("chip", { ...offerChip })} disabled={!chosenEnd} onClick={() => { setCouponCode(c.code); void applyCoupon(c.code); }} title={c.description || undefined} data-offer={c.code}>
                        <strong>{c.code}</strong> · {couponSummary(c)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </fieldset>

      {/* the length of the stay and what it costs, worked out from what was chosen */}
      <div className="ot-fx-card" style={fx("card", { ...card, borderColor: "var(--color-primary)" })} data-testid="booking-summary">
        <div style={label}>
          <Wallet size={15} /> Your booking
        </div>
        {chosenEnd ? (
          <dl style={summaryList}>
            <Row k="Day" v={day ? longDay(day) : "—"} />
            <Row k="Time" v={`${slots.find((s) => s.at === start)?.label ?? ""} – ${chosenEnd.label}`} testId="booking-range" />
            <Row k="Total time" v={formatDuration(minutes)} testId="booking-total-time" strong />
            <Row k="Guests" v={String(party)} />
            {eventName ? <Row k="Occasion" v={eventName} /> : null}
            {pricing.ratePaise > 0 ? (
              <>
                <Row k="Estimated booking price" v={formatINR(gross)} testId="booking-price" strong={!withCoupon} note={`${formatINR(pricing.ratePaise)} per person per hour × ${party} ${party === 1 ? "guest" : "guests"} × ${formatDuration(minutes)}`} />
                {withCoupon ? (
                  <>
                    <Row k={`Coupon ${withCoupon.code}`} v={`− ${formatINR(discount)}`} testId="booking-discount" good />
                    <Row k="Booking amount after the coupon" v={formatINR(amount)} testId="booking-amount" strong />
                  </>
                ) : null}
                {amount === 0 ? (
                  <Row k="Pay now" v="Nothing" note="The coupon covers the whole booking amount." testId="booking-advance" strong accent />
                ) : advance > 0 ? (
                  <>
                    <Row k={`Pay now (${PREPAY_PERCENT}%)`} v={formatINR(advance)} testId="booking-advance" strong accent />
                    <Row k="Pay at the restaurant" v={`${formatINR(remaining)} + your food & drinks`} testId="booking-remaining" note="The rest of the booking amount, and whatever you eat and drink, are paid at the restaurant." />
                  </>
                ) : (
                  <Row k="Pay at the restaurant" v={`${formatINR(amount)} + your food & drinks`} testId="booking-remaining" note="No advance is needed right now." />
                )}
              </>
            ) : (
              <Row k="Booking price" v="No booking charge" testId="booking-price" />
            )}
          </dl>
        ) : (
          <p style={{ ...muted, margin: 0 }} data-testid="booking-summary-empty">
            Choose a start and a finish time to see how long you&apos;ll be seated and the estimated price.
          </p>
        )}
        {advance > 0 ? (
          <p style={{ ...muted, margin: "10px 0 0", display: "flex", gap: 6 }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              {PREPAY_PERCENT}% of the booking amount is paid online now to hold the table. The rest — and everything you eat and drink — is paid at the restaurant. {manual ? "If we can't take the booking, your advance is refunded." : ""}
            </span>
          </p>
        ) : null}
      </div>

      {error ? (
        <p style={errorBox} role="alert" data-testid="booking-error">
          {error}
        </p>
      ) : null}

      <button type="button" className="ot-fx-btn" style={fx("btn", bookBtn)} disabled={busy} onClick={submit} data-testid="booking-submit">
        {buttonLabel}
      </button>
      {locked ? (
        <p style={{ textAlign: "center", marginTop: 8 }}>
          <button type="button" style={linkBtn} onClick={changeDetails} data-testid="booking-change">
            Change the details
          </button>
        </p>
      ) : null}
      {!customer ? (
        <p style={{ ...muted, textAlign: "center", marginTop: 8 }}>You&apos;ll sign in with your mobile number as the last step — nothing you&apos;ve filled in is lost.</p>
      ) : null}

      {/* the sign-in step: shown only once the form is complete */}
      {!customer && askLogin ? (
        <div ref={loginRef} style={{ marginTop: 16 }} data-testid="booking-login">
          <CustomerGate
            customer={null}
            outletId={outletId}
            heading="One last step — sign in"
            intro="Your mobile number lets the restaurant reach you about this booking. We'll text you a code. Everything you filled in above is kept."
            onSuccess={() => {
              setAskLogin(false);
              void refresh();
            }}
          />
        </div>
      ) : null}

      {phone ? (
        <p style={{ ...muted, textAlign: "center", marginTop: 12 }}>
          <Phone size={12} style={{ verticalAlign: -1 }} /> Questions? Call {phone}
        </p>
      ) : null}
    </section>
  );
}

/** One line of the booking summary. */
function Row({ k, v, note, strong, accent, good, testId }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "2px 12px", alignItems: "baseline", padding: "6px 0", borderBottom: "1px dashed var(--color-border)" }}>
      <dt style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}>{k}</dt>
      <dd data-testid={testId} style={{ margin: 0, fontSize: strong ? 16 : 14, fontWeight: strong ? 800 : 600, fontVariantNumeric: "tabular-nums", textAlign: "right", color: accent ? "var(--color-primary-text, var(--color-primary))" : good ? "var(--tone-success)" : "var(--color-text)" }}>
        {v}
      </dd>
      {note ? <dd style={{ gridColumn: "1 / -1", margin: 0, fontSize: 12, color: "var(--color-text-muted)" }}>{note}</dd> : null}
    </div>
  );
}

const wrap = { maxWidth: 640, margin: "0 auto", padding: "28px 16px 56px", boxSizing: "border-box" };
const h1 = { margin: 0, fontFamily: "var(--font-heading)", fontSize: "clamp(1.6rem, 4.5vw, 2.1rem)", lineHeight: 1.15 };
const muted = { fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5 };
const card = { background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 14, padding: 16, marginBottom: 12 };
const label = { display: "flex", alignItems: "center", gap: 7, fontWeight: 700, fontSize: 14, marginBottom: 10 };
const twoCol = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 };
const input = { width: "100%", font: "inherit", fontSize: 14.5, padding: "10px 12px", borderRadius: 9, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", boxSizing: "border-box", minHeight: 44 };
const bookBtn = { width: "100%", marginTop: 8, font: "inherit", fontWeight: 700, fontSize: 16, padding: "14px 18px", borderRadius: "var(--radius-card)", background: "var(--color-primary)", color: "var(--color-on-primary)", border: "none", cursor: "pointer" };
const errorBox = { color: "var(--tone-danger)", background: "var(--tone-danger-wash)", fontSize: 13, padding: "10px 12px", borderRadius: 10, margin: "8px 0" };
const fieldError = { color: "var(--tone-danger)", fontSize: 12.5, margin: "8px 0 0" };
const notice = { display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, lineHeight: 1.5, padding: "11px 13px", borderRadius: 12, marginBottom: 14, background: "var(--tone-info-wash)", color: "var(--tone-info)" };
const summaryList = { margin: 0, padding: 0 };
const linkBtn = { font: "inherit", fontSize: 13.5, fontWeight: 600, background: "none", border: "none", color: "var(--color-primary-text, var(--color-primary))", cursor: "pointer", textDecoration: "underline" };
const applyBtn = { font: "inherit", fontWeight: 700, fontSize: 14, padding: "0 18px", borderRadius: 10, background: "var(--color-primary)", color: "var(--color-on-primary)", border: "none", cursor: "pointer", minHeight: 44, whiteSpace: "nowrap" };
const offerChip = { font: "inherit", fontSize: 12.5, padding: "6px 11px", borderRadius: 999, border: "1.5px dashed var(--color-primary)", background: "var(--color-bg)", color: "var(--color-text)", cursor: "pointer" };
const doneIcon = { display: "inline-grid", placeItems: "center", width: 70, height: 70, borderRadius: "50%", background: "var(--tone-success-wash)", color: "var(--tone-success)" };
const primaryLink = { display: "inline-block", font: "inherit", fontWeight: 700, fontSize: 14.5, padding: "12px 22px", borderRadius: 12, background: "var(--color-primary)", color: "var(--color-on-primary)", textDecoration: "none" };
const secondaryLink = { display: "inline-block", fontWeight: 700, fontSize: 14.5, padding: "12px 10px", color: "var(--color-primary-text, var(--color-primary))" };
