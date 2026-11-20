"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatINR, GATEWAY_LABELS, ORDER_STATUS_LABELS } from "@onetap/config-schema";
import { fx } from "@onetap/ui";
import { Banknote, CheckCircle2, ChevronDown, Clock, Coins, CreditCard, LogOut, Receipt, ShoppingBag, Trash2, XCircle } from "lucide-react";
import { api, apiDelete } from "@/lib/clientApi";
import { useCustomer } from "@/lib/useCustomer";
import { CustomerGate } from "./CustomerGate";

/**
 * The customer's Account page: who they are, their coins (only when the store has coins switched on), and every
 * order they have placed with this store — what it is doing now, how it is being paid for and whether it has been,
 * what was in it and what it cost. Orders still being prepared refresh by themselves every 20 seconds.
 *
 * Signing in uses the same card as ordering (name + mobile + code) — there is no separate account to create.
 */

const ACTIVE = ["placed", "accepted", "preparing", "ready"];
const STEPS = ["placed", "accepted", "preparing", "ready", "completed"];
const REFRESH_MS = 20_000;

const CHANNEL_LABEL = { takeaway: "Takeaway", "dine-in": "Dine-in", delivery: "Delivery" };

/** one friendly sentence for where the order is, given how it will reach the customer */
function statusLine(order) {
  const { status, channel } = order;
  if (status === "placed") return "We've got your order — waiting for the restaurant to accept it.";
  if (status === "accepted") return "The restaurant has accepted your order.";
  if (status === "preparing") return order.etaMinutes ? `It's being prepared — about ${order.etaMinutes} minutes.` : "It's being prepared.";
  if (status === "ready") return channel === "delivery" ? "Ready — on its way to you." : channel === "dine-in" ? "Ready — it's coming to your table." : "Ready — you can collect it now.";
  if (status === "completed") return "Completed. Thank you!";
  return "This order was cancelled.";
}

const STATUS_TONE = { placed: "info", accepted: "info", preparing: "warning", ready: "success", completed: "success", cancelled: "danger" };

/** how it is paid for, and whether it has been */
function paymentInfo(order) {
  const { gateway, status } = order.payment;
  const mode =
    gateway === "razorpay"
      ? `Online — ${GATEWAY_LABELS.razorpay}`
      : gateway === "mock"
        ? "Online — test payment"
        : order.channel === "delivery"
          ? "Cash on delivery"
          : order.channel === "dine-in"
            ? "Pay at the table"
            : "Pay at the counter";
  if (status === "paid") return { mode, label: "Paid", tone: "success" };
  if (status === "failed") return { mode, label: "Payment failed", tone: "danger" };
  if (status === "refunded") return { mode, label: "Refunded", tone: "info" };
  if (order.status === "cancelled") return { mode, label: "Not charged", tone: "neutral" };
  return { mode, label: gateway === "cod" ? "To pay" : "Payment pending", tone: "warning" };
}

const when = (iso) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export function AccountView({ outletId, menuHref }) {
  const { customer, loading, refresh, logout } = useCustomer();
  const [orders, setOrders] = useState(null);
  const [coins, setCoins] = useState({ enabled: false, balance: 0, valuePaise: 0 });
  const [nextBefore, setNextBefore] = useState(null);
  const [error, setError] = useState(null);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState(() => new Set());
  // the order the customer is being asked about ("Remove this order from your account?"), and one being removed
  const [asking, setAsking] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [removeError, setRemoveError] = useState(null);
  const loadedFor = useRef(null);

  const load = useCallback(
    async ({ reset = true, quiet = false } = {}) => {
      try {
        const q = new URLSearchParams({ outletId, limit: "15" });
        if (!reset && nextBefore) q.set("before", new Date(nextBefore).toISOString());
        const r = await api(`/api/customer/orders?${q}`);
        setCoins(r.coins);
        if (quiet) {
          // a refresh while looking: update the newest orders in place, keep any older ones already loaded
          setOrders((prev) => {
            if (!prev) return r.orders;
            const oldest = r.orders.length ? new Date(r.orders.at(-1).placedAt).getTime() : 0;
            return [...r.orders, ...prev.filter((p) => new Date(p.placedAt).getTime() < oldest)];
          });
          setNextBefore((cur) => cur ?? r.nextBefore);
        } else {
          setNextBefore(r.nextBefore);
          setOrders((prev) => (reset || !prev ? r.orders : [...prev, ...r.orders]));
        }
        setError(null);
      } catch (e) {
        // a session that ended while the page was open: back to the sign-in card
        if (e.status === 401 || e.status === 403) void refresh();
        else if (!quiet) setError(e.message);
      }
    },
    [outletId, nextBefore, refresh],
  );

  // load the first page once we know who is here
  useEffect(() => {
    if (!customer || loadedFor.current === customer.id) return;
    loadedFor.current = customer.id;
    void load({ reset: true });
  }, [customer, load]);

  // while any order is still being prepared, keep it fresh (only the first page — what is current)
  const anyActive = useMemo(() => (orders ?? []).some((o) => ACTIVE.includes(o.status)), [orders]);
  useEffect(() => {
    if (!anyActive) return undefined;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load({ reset: true, quiet: true });
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, [anyActive, load]);

  // Take one order off the customer's own list. Only their list: the restaurant keeps its record of it.
  const remove = async (id) => {
    setRemoving(id);
    setRemoveError(null);
    try {
      await apiDelete(`/api/customer/orders/${id}?outletId=${encodeURIComponent(outletId)}`);
      setAsking(null);
      const left = (orders ?? []).filter((o) => o.id !== id);
      setOrders(left);
      // the page may now be empty while older orders exist: bring the next ones up
      if (left.length === 0 && nextBefore) void load({ reset: true });
    } catch (e) {
      setRemoveError(e.message);
    } finally {
      setRemoving(null);
    }
  };

  if (loading) {
    return (
      <section className="ot-page-px" style={wrap} aria-busy="true">
        <p style={muted}>Loading your account…</p>
      </section>
    );
  }

  if (!customer) {
    return (
      <CustomerGate
        customer={null}
        outletId={outletId}
        heading="Sign in to see your orders"
        intro="Use the mobile number you order with. We'll text you a code — there's nothing to remember."
        onSuccess={() => {
          loadedFor.current = null;
          void refresh();
        }}
      />
    );
  }

  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="ot-page-px" style={wrap} data-testid="account">
      <header style={head}>
        <div>
          <h1 style={h1}>Your account</h1>
          <p style={{ ...muted, margin: "4px 0 0" }} data-testid="account-who">
            {customer.name ? `${customer.name} · ` : ""}
            {customer.phone ?? customer.email ?? ""}
          </p>
        </div>
        <button
          type="button"
          className="ot-press"
          style={ghostBtn}
          onClick={async () => {
            await logout();
            loadedFor.current = null;
            setOrders(null);
          }}
        >
          <LogOut size={14} /> Sign out
        </button>
      </header>

      {coins.enabled ? (
        <div className="ot-fx-card" style={fx("card", coinCard)} data-testid="account-coins">
          <span style={coinIcon}>
            <Coins size={20} />
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", fontWeight: 600 }}>Your coins</div>
            <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.15 }}>{coins.balance}</div>
          </div>
          <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", textAlign: "right", maxWidth: 160 }}>
            {coins.balance > 0 ? `Worth ${formatINR(coins.valuePaise)} off your next order.` : "Earn coins on completed orders."}
          </div>
        </div>
      ) : null}

      <h2 style={h2}>Your orders</h2>

      {error ? (
        <div style={errorBox} role="alert">
          {error}{" "}
          <button type="button" style={linkBtn} onClick={() => load({ reset: true })}>
            Try again
          </button>
        </div>
      ) : null}

      {orders === null && !error ? <p style={muted}>Loading your orders…</p> : null}

      {orders && orders.length === 0 ? (
        <div className="ot-fx-card" style={fx("card", { ...card, textAlign: "center", padding: "32px 20px" })} data-testid="account-empty">
          <ShoppingBag size={26} style={{ color: "var(--color-text-muted)" }} />
          <p style={{ margin: "10px 0 14px", fontWeight: 600 }}>No orders yet</p>
          <Link href={menuHref} className="ot-press" style={primaryLink}>
            Browse the menu
          </Link>
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {(orders ?? []).map((o) => {
          const pay = paymentInfo(o);
          const isOpen = open.has(o.id);
          const active = ACTIVE.includes(o.status);
          const summary = o.items.map((i) => `${i.quantity} × ${i.name}`).join(", ");
          return (
            <article key={o.id} className="ot-fx-card" style={fx("card", card)} data-order={o.orderNumber} data-status={o.status}>
              <div style={rowBetween}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>Order #{o.orderNumber}</div>
                  <div style={muted}>
                    {when(o.placedAt)}
                    {o.outlet?.name ? ` · ${o.outlet.name}` : ""} · {CHANNEL_LABEL[o.channel] ?? o.channel}
                  </div>
                </div>
                <Pill tone={STATUS_TONE[o.status]} testid="order-status">
                  {ORDER_STATUS_LABELS[o.status] ?? o.status}
                </Pill>
              </div>

              <p style={{ margin: "10px 0 0", fontSize: 13.5 }} data-testid="order-status-line">
                {statusLine(o)}
              </p>

              {active ? <Tracker status={o.status} /> : null}

              <div style={{ ...rowBetween, marginTop: 12, alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }} data-testid="order-payment">
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--color-text-muted)" }}>
                    {o.payment.gateway === "cod" ? <Banknote size={14} /> : <CreditCard size={14} />} {pay.mode}
                  </span>
                  <Pill tone={pay.tone} small testid="payment-status">
                    {pay.label}
                  </Pill>
                </div>
                <div style={{ fontWeight: 800, fontSize: 16 }} data-testid="order-total">
                  {formatINR(o.totals.grandTotal)}
                </div>
              </div>

              <p style={{ ...muted, margin: "10px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isOpen ? "normal" : "nowrap" }} title={summary}>
                {summary}
              </p>

              <div style={{ ...rowBetween, alignItems: "center" }}>
                <button type="button" className="ot-press" style={linkBtn} onClick={() => toggle(o.id)} aria-expanded={isOpen}>
                  {isOpen ? "Hide details" : "View details"} <ChevronDown size={14} style={{ verticalAlign: -3, transform: isOpen ? "rotate(180deg)" : "none" }} />
                </button>
                <button
                  type="button"
                  className="ot-press"
                  style={{ ...linkBtn, color: "var(--color-text-muted)", fontWeight: 600 }}
                  onClick={() => {
                    setRemoveError(null);
                    setAsking(asking === o.id ? null : o.id);
                  }}
                  aria-label={`Remove order ${o.orderNumber} from my account`}
                  data-testid="order-remove"
                >
                  <Trash2 size={13} style={{ verticalAlign: -2 }} /> Remove
                </button>
              </div>

              {asking === o.id ? (
                <div style={askBox} role="alertdialog" aria-label="Remove this order from your account?" data-testid="order-remove-ask">
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 13.5 }}>Remove this order from your account?</p>
                  <p style={{ ...muted, margin: "4px 0 10px" }}>
                    {active ? "It is still being prepared and will carry on as normal — it just won't be listed here. " : ""}
                    It only disappears from your list; the restaurant keeps its own record of it.
                  </p>
                  {removeError ? (
                    <p role="alert" style={{ color: "var(--tone-danger)", fontSize: 12.5, margin: "0 0 8px" }}>
                      {removeError}
                    </p>
                  ) : null}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="ot-press" style={{ ...dangerBtn }} disabled={removing === o.id} onClick={() => remove(o.id)}>
                      {removing === o.id ? "Removing…" : "Remove"}
                    </button>
                    <button type="button" className="ot-press" style={ghostBtn} disabled={removing === o.id} onClick={() => setAsking(null)}>
                      Keep it
                    </button>
                  </div>
                </div>
              ) : null}

              {isOpen ? <Details order={o} /> : null}
            </article>
          );
        })}
      </div>

      {nextBefore ? (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button
            type="button"
            className="ot-press"
            style={ghostBtn}
            disabled={more}
            onClick={async () => {
              setMore(true);
              await load({ reset: false });
              setMore(false);
            }}
          >
            {more ? "Loading…" : "Show older orders"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

/* ----------------------------------------------------------------------- pieces */

function Tracker({ status }) {
  const at = STEPS.indexOf(status);
  return (
    <ol style={trackerList} aria-label="Order progress">
      {STEPS.map((s, i) => (
        <li key={s} style={{ ...trackerStep, color: i <= at ? "var(--color-text)" : "var(--color-text-muted)" }} aria-current={i === at ? "step" : undefined}>
          <span style={{ ...dot, background: i <= at ? "var(--color-primary)" : "var(--color-border)" }}>{i < at ? <CheckCircle2 size={11} color="var(--color-on-primary)" /> : null}</span>
          {ORDER_STATUS_LABELS[s]}
        </li>
      ))}
    </ol>
  );
}

function Details({ order: o }) {
  const t = o.totals;
  const row = (label, value, strong) => (
    <div style={{ ...rowBetween, fontWeight: strong ? 800 : 400, fontSize: strong ? 15 : 13 }} key={label}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
  return (
    <div style={detailBox} data-testid="order-details">
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {o.items.map((i, n) => (
          <li key={n} style={rowBetween}>
            <span style={{ fontSize: 13.5 }}>
              {i.quantity} × {i.name}
              {i.variantLabel ? ` (${i.variantLabel})` : ""}
              {i.modifiers.length ? <span style={{ ...muted, display: "block" }}>{i.modifiers.join(", ")}</span> : null}
            </span>
            <span style={{ fontSize: 13.5 }}>{formatINR(i.lineTotal)}</span>
          </li>
        ))}
      </ul>
      <div style={{ borderTop: "1px solid var(--color-border)", margin: "12px 0", paddingTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
        {row("Items", formatINR(t.subtotal))}
        {t.discount > 0 ? row(`Coupon${o.couponCode ? ` (${o.couponCode})` : ""}`, `− ${formatINR(t.discount)}`) : null}
        {t.coinsDiscount > 0 ? row(`Coins used (${t.coinsRedeemed})`, `− ${formatINR(t.coinsDiscount)}`) : null}
        {t.deliveryFee > 0 ? row("Delivery", formatINR(t.deliveryFee)) : null}
        {t.serviceCharge > 0 ? row("Service charge", formatINR(t.serviceCharge)) : null}
        {t.taxAmount > 0 ? row("Taxes", formatINR(t.taxAmount)) : null}
        {row("Total", formatINR(t.grandTotal), true)}
      </div>
      {t.coinsEarned > 0 ? (
        <p style={{ ...muted, margin: "0 0 6px", display: "flex", alignItems: "center", gap: 6 }}>
          <Coins size={13} /> You earned {t.coinsEarned} coins on this order.
        </p>
      ) : null}
      {o.deliveryAddress ? <p style={{ ...muted, margin: "0 0 4px" }}>Delivering to: {o.deliveryAddress}</p> : null}
      <p style={{ ...muted, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
        <Receipt size={13} /> Placed {when(o.placedAt)}
      </p>
    </div>
  );
}

const TONES = {
  info: ["var(--tone-info-wash)", "var(--tone-info)"],
  warning: ["var(--tone-warning-wash)", "var(--tone-warning)"],
  success: ["var(--tone-success-wash)", "var(--tone-success)"],
  danger: ["var(--tone-danger-wash)", "var(--tone-danger)"],
  neutral: ["var(--color-surface)", "var(--color-text-muted)"],
};

function Pill({ tone = "neutral", small, children, testid }) {
  const [bg, fg] = TONES[tone] ?? TONES.neutral;
  const Icon = tone === "success" ? CheckCircle2 : tone === "danger" ? XCircle : tone === "warning" ? Clock : null;
  return (
    <span data-testid={testid} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: bg, color: fg, fontWeight: 700, fontSize: small ? 11.5 : 12.5, padding: small ? "2px 8px" : "4px 11px", borderRadius: 999, whiteSpace: "nowrap" }}>
      {Icon ? <Icon size={small ? 11 : 13} /> : null}
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------------- styles */

const wrap = { maxWidth: 720, margin: "0 auto", padding: "32px 16px 56px", boxSizing: "border-box" };
const head = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: 18 };
const h1 = { margin: 0, fontFamily: "var(--font-heading)", fontSize: "clamp(1.6rem, 4.5vw, 2.1rem)", lineHeight: 1.15 };
const h2 = { margin: "26px 0 12px", fontFamily: "var(--font-heading)", fontSize: 18 };
const muted = { fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 };
const rowBetween = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 };
const card = {
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: "calc(var(--radius-card) + 2px)",
  padding: "16px 16px 12px",
};
const coinCard = { ...card, display: "flex", alignItems: "center", gap: 14, padding: "16px", borderLeft: "3px solid var(--color-primary)" };
const coinIcon = { display: "grid", placeItems: "center", width: 42, height: 42, borderRadius: 12, background: "var(--tone-warning-wash)", color: "var(--tone-warning)" };
const ghostBtn = { font: "inherit", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: "var(--radius-card)", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", cursor: "pointer" };
const linkBtn = { font: "inherit", fontSize: 12.5, fontWeight: 700, padding: "10px 0 2px", background: "none", border: "none", color: "var(--color-primary)", cursor: "pointer" };
const primaryLink = { display: "inline-block", font: "inherit", fontWeight: 700, fontSize: 14, padding: "11px 20px", borderRadius: "var(--radius-card)", background: "var(--color-primary)", color: "var(--color-on-primary)", textDecoration: "none" };
const errorBox = { color: "var(--tone-danger)", background: "var(--tone-danger-wash)", fontSize: 13, fontWeight: 500, padding: "10px 12px", borderRadius: "calc(var(--radius-card) - 2px)", marginBottom: 12 };
const askBox = { marginTop: 8, padding: "12px 14px", borderRadius: "calc(var(--radius-card) - 2px)", background: "var(--color-surface)", border: "1px solid var(--color-border)" };
const dangerBtn = { font: "inherit", fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: "var(--radius-card)", border: "none", background: "var(--tone-danger)", color: "#fff", cursor: "pointer" };
const trackerList = { listStyle: "none", margin: "12px 0 0", padding: 0, display: "flex", justifyContent: "space-between", gap: 4 };
const trackerStep = { display: "flex", flexDirection: "column", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, flex: 1, textAlign: "center" };
const dot = { display: "grid", placeItems: "center", width: 16, height: 16, borderRadius: 999 };
const detailBox = { marginTop: 10, paddingTop: 12, borderTop: "1px dashed var(--color-border)" };
