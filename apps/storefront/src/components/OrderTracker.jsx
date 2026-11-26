"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { statusLabelFor } from "@rasoipulse/config-schema";
import { fx } from "@rasoipulse/ui";
import { AlertTriangle, ArrowLeft, Bike, Clock, Phone, RefreshCw, XCircle } from "lucide-react";
import { api } from "@/lib/clientApi";
import { useCustomer } from "@/lib/useCustomer";
import { ACTIVE, CHANNEL_LABEL, Details, Pill, paymentInfo, STATUS_TONE, statusLine, Tracker } from "./AccountView";
import { CustomerGate } from "./CustomerGate";

/**
 * Follow one order — `/<outlet>/order/<id>`. Where the order is right now (accepted, being prepared, ready, on its way…),
 * a step-by-step bar, what happened and when, how long it should take, and a clear note when the restaurant is running
 * late. It asks the store every few seconds while the order is still going — straight from the database, never from a
 * saved copy — and stops once it is finished or cancelled. Only the signed-in customer's own order opens here.
 */

const POLL_MS = 6_000;
const clock = (iso) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

export function OrderTracker({ outletId, outletSlug, orderId }) {
  const { customer, loading, refresh } = useCustomer();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null); // { status, message }
  const [updatedAt, setUpdatedAt] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [now, setNow] = useState(Date.now());
  const done = useRef(false);

  const load = useCallback(async () => {
    setFetching(true);
    try {
      const r = await api(`/api/customer/orders/${encodeURIComponent(orderId)}?outletId=${encodeURIComponent(outletId)}`);
      setOrder(r.order);
      setError(null);
      setUpdatedAt(Date.now());
      done.current = !ACTIVE.includes(r.order.status);
    } catch (e) {
      setError({ status: e.status, message: e.message });
    } finally {
      setFetching(false);
    }
  }, [orderId, outletId]);

  // look now, then every few seconds while the order is still going; a tab brought back to the front looks at once
  useEffect(() => {
    if (!customer) return undefined;
    done.current = false;
    void load();
    const timer = setInterval(() => {
      if (!done.current && document.visibilityState === "visible") void load();
    }, POLL_MS);
    const wake = () => {
      if (document.visibilityState === "visible" && !done.current) void load();
    };
    document.addEventListener("visibilitychange", wake);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [customer, load]);

  // a second hand for "updated 12 s ago"
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const menuHref = `/${outletSlug}`;

  if (loading) return <section className="ot-page-px" style={wrap}><p style={muted}>One moment…</p></section>;
  if (!customer) {
    return (
      <CustomerGate
        customer={null}
        outletId={outletId}
        heading="Sign in to follow your order"
        intro="Use the mobile number you ordered with. We'll text you a code — there's nothing to remember."
        onSuccess={() => void refresh()}
      />
    );
  }
  if (error && !order) {
    return (
      <section className="ot-page-px" style={wrap} data-testid="tracker-error">
        <Link href={menuHref} style={backLink}><ArrowLeft size={15} /> Back to the menu</Link>
        <h1 style={h1}>{error.status === 404 ? "We can't find that order" : "We couldn't load your order"}</h1>
        <p style={muted}>
          {error.status === 404
            ? "It may belong to a different mobile number, or the link is wrong. Your own orders are all on your account page."
            : error.message}
        </p>
        <Link href={`${menuHref}/account`} style={primaryLink}>See my orders</Link>
      </section>
    );
  }
  if (!order) return <section className="ot-page-px" style={wrap}><p style={muted}>Loading your order…</p></section>;

  const active = ACTIVE.includes(order.status);
  const pay = paymentInfo(order);
  const ago = updatedAt ? Math.max(0, Math.round((now - updatedAt) / 1000)) : null;

  return (
    <section className="ot-page-px" style={wrap} data-testid="tracker-page" data-status={order.status}>
      <Link href={menuHref} style={backLink}><ArrowLeft size={15} /> Back to the menu</Link>

      <div style={head}>
        <div>
          <h1 style={h1}>Order #{order.orderNumber}</h1>
          <p style={muted}>
            {CHANNEL_LABEL[order.channel] ?? order.channel}
            {order.outlet?.name ? ` · ${order.outlet.name}` : ""} · placed {clock(order.placedAt)}
          </p>
        </div>
        <Pill tone={STATUS_TONE[order.status]} testid="tracker-status">
          {statusLabelFor(order.status, order.channel)}
        </Pill>
      </div>

      <div className="ot-fx-card" style={fx("card", card)}>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.4 }} data-testid="tracker-line">
          {statusLine(order)}
        </p>

        {order.status === "cancelled" ? (
          <div style={cancelBox} data-testid="tracker-cancelled">
            <XCircle size={18} style={{ flexShrink: 0 }} />
            <span>
              {order.cancelReason ? `${order.cancelReason}. ` : ""}
              {pay.label === "Not charged" ? "You haven't been charged." : pay.label === "Refunded" ? "Your payment has been refunded." : "If you paid online, the restaurant will sort out the refund."}
            </span>
          </div>
        ) : null}

        {active ? <Tracker status={order.status} channel={order.channel} /> : null}

        {order.late ? (
          <div style={lateBox} role="status" data-testid="tracker-late">
            <AlertTriangle size={18} style={{ flexShrink: 0 }} />
            <span>
              {order.late.kind === "accept"
                ? "The restaurant hasn't accepted your order yet — it's taking longer than usual. We're keeping an eye on it."
                : "Your order is taking a little longer than usual. It's still being made."}
            </span>
          </div>
        ) : null}

        {active && order.etaMinutes && !order.scheduledFor && order.status !== "ready" && order.status !== "out_for_delivery" ? (
          <p style={{ ...muted, margin: "12px 0 0", display: "flex", alignItems: "center", gap: 6 }} data-testid="tracker-eta">
            <Clock size={14} /> {order.channel === "delivery" ? "Usually arrives" : "Usually ready"} in about {order.etaMinutes} minutes from when it was accepted.
          </p>
        ) : null}

        {order.status === "out_for_delivery" && order.rider?.name ? (
          <div style={riderBox} data-testid="tracker-rider">
            <Bike size={16} />
            <span style={{ flex: 1 }}>
              <strong>{order.rider.name}</strong> is bringing your order
            </span>
            {order.rider.phone ? (
              <a href={`tel:${order.rider.phone.replace(/\s/g, "")}`} style={callLink}>
                <Phone size={13} /> Call
              </a>
            ) : null}
          </div>
        ) : null}

        {order.status === "out_for_delivery" && order.deliveryCode ? (
          <div style={codeBox} data-testid="tracker-delivery-code">
            <span style={{ flex: 1 }}>
              <strong>Your delivery code</strong>
              <span style={{ display: "block", fontSize: 12, opacity: 0.85 }}>Tell this to the rider when your food arrives. Don&apos;t share it before.</span>
            </span>
            <span style={codeDigits} aria-label={`Delivery code ${order.deliveryCode.split("").join(" ")}`}>{order.deliveryCode}</span>
          </div>
        ) : null}
      </div>

      <h2 style={h2}>What happened</h2>
      <ol style={history} data-testid="tracker-history" aria-label="Order history">
        {(order.history ?? []).map((h, i) => (
          <li key={`${h.status}-${i}`} style={historyRow}>
            <span style={historyDot} aria-hidden="true" />
            <span style={{ flex: 1, fontWeight: 600 }}>{h.status === "placed" ? "Order placed" : statusLabelFor(h.status, order.channel)}</span>
            <span style={muted}>{clock(h.at)}</span>
          </li>
        ))}
      </ol>

      <h2 style={h2}>Your order</h2>
      <Details order={order} />

      <div style={{ ...muted, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 14 }} data-testid="tracker-payment">
        <Pill tone={pay.tone} small>
          {pay.label}
        </Pill>
        <span>{pay.mode}</span>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 22 }}>
        <Link href={`${menuHref}/account`} style={primaryLink}>
          All my orders
        </Link>
        {active ? (
          <button type="button" className="ot-press" style={ghostBtn} onClick={() => void load()} disabled={fetching} data-testid="tracker-refresh">
            <RefreshCw size={13} className={fetching ? "ot-spin" : undefined} /> Check now
          </button>
        ) : null}
        {active ? (
          <span style={muted} data-testid="tracker-updated">
            {ago === null ? "" : ago < 3 ? "Updated just now" : `Updated ${ago} s ago`} · refreshes by itself
          </span>
        ) : null}
      </div>
    </section>
  );
}

const wrap = { maxWidth: 640, margin: "0 auto", padding: "24px 16px 56px", boxSizing: "border-box" };
const muted = { fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5, margin: "4px 0 0" };
const head = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", margin: "14px 0 16px" };
const h1 = { margin: 0, fontFamily: "var(--font-heading)", fontSize: "clamp(1.5rem, 5vw, 2rem)", lineHeight: 1.15 };
const h2 = { margin: "24px 0 10px", fontFamily: "var(--font-heading)", fontSize: 17 };
const card = { background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: "calc(var(--radius-card) + 2px)", padding: "18px 16px 16px" };
const backLink = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--color-text-muted)", textDecoration: "none" };
const primaryLink = { display: "inline-block", font: "inherit", fontWeight: 700, fontSize: 14, padding: "11px 20px", borderRadius: "var(--radius-card)", background: "var(--color-primary)", color: "var(--color-on-primary)", textDecoration: "none" };
const ghostBtn = { font: "inherit", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: "var(--radius-card)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", cursor: "pointer" };
const lateBox = { display: "flex", gap: 10, alignItems: "flex-start", marginTop: 14, padding: "11px 13px", borderRadius: "calc(var(--radius-card) - 2px)", background: "var(--tone-warning-wash)", color: "var(--tone-warning)", fontSize: 13.5, fontWeight: 600, lineHeight: 1.45 };
const cancelBox = { display: "flex", gap: 10, alignItems: "flex-start", marginTop: 14, padding: "11px 13px", borderRadius: "calc(var(--radius-card) - 2px)", background: "var(--tone-danger-wash)", color: "var(--tone-danger)", fontSize: 13.5, fontWeight: 600, lineHeight: 1.45 };
const riderBox = { display: "flex", alignItems: "center", gap: 10, marginTop: 14, padding: "10px 12px", borderRadius: "calc(var(--radius-card) - 2px)", background: "var(--tone-info-wash)", color: "var(--tone-info)", fontSize: 13.5 };
const codeBox = { display: "flex", alignItems: "center", gap: 12, marginTop: 10, padding: "10px 12px", borderRadius: "calc(var(--radius-card) - 2px)", background: "var(--tone-success-wash)", color: "var(--tone-success)", fontSize: 13.5 };
const codeDigits = { fontSize: 26, fontWeight: 800, letterSpacing: 6, fontVariantNumeric: "tabular-nums", color: "var(--color-text)" };
const callLink = { display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 700, fontSize: 13, color: "var(--tone-info)", textDecoration: "none" };
const history = { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 };
const historyRow = { display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 };
const historyDot = { width: 9, height: 9, borderRadius: 99, background: "var(--color-primary)", flexShrink: 0 };
