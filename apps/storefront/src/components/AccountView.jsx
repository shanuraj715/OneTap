"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FEEDBACK_TAGS, formatINR, formatWhen, GATEWAY_LABELS, statusLabelFor } from "@rasoipulse/config-schema";
import { fx } from "@rasoipulse/ui";
import { Banknote, Bike, CalendarDays, CheckCircle2, ChevronDown, Clock, Coins, CreditCard, LogOut, Phone, Receipt, RotateCcw, ShoppingBag, Star, Trash2, XCircle } from "lucide-react";
import { api, apiDelete } from "@/lib/clientApi";
import { useCustomer } from "@/lib/useCustomer";
import { CustomerGate } from "./CustomerGate";
import { startNavProgress } from "./NavProgress";

/**
 * The customer's Account page: who they are, their coins (only when the store has coins switched on), and every
 * order they have placed with this store — what it is doing now, how it is being paid for and whether it has been,
 * what was in it and what it cost. Orders still being prepared refresh by themselves every 20 seconds.
 *
 * Signing in uses the same card as ordering (name + mobile + code) — there is no separate account to create.
 */

export const ACTIVE = ["placed", "accepted", "preparing", "ready", "out_for_delivery"];
export const STEPS = ["placed", "accepted", "preparing", "ready", "completed"];
// a delivery order has one more step: on its way
export const DELIVERY_STEPS = ["placed", "accepted", "preparing", "ready", "out_for_delivery", "completed"];
const REFRESH_MS = 20_000;

export const CHANNEL_LABEL = { takeaway: "Takeaway", "dine-in": "Dine-in", delivery: "Delivery" };

/** one friendly sentence for where the order is, given how it will reach the customer */
export function statusLine(order) {
  const { status, channel } = order;
  const pickup = order.scheduledFor ? formatWhen(order.scheduledFor) : null;
  if (status === "placed") return pickup ? `Pre-order for pickup ${pickup} — waiting for the restaurant to accept it.` : "We've got your order — waiting for the restaurant to accept it.";
  if (status === "accepted") return pickup ? `Accepted — it will be ready for pickup ${pickup}.` : "The restaurant has accepted your order.";
  if (status === "out_for_delivery") return order.rider?.name ? `On its way — ${order.rider.name} is bringing it.` : "On its way to you.";
  if (status === "completed" && channel === "delivery") return "Delivered. Enjoy your meal!";
  if (status === "preparing") return order.etaMinutes ? `It's being prepared — about ${order.etaMinutes} minutes.` : "It's being prepared.";
  if (status === "ready") return channel === "delivery" ? "Ready — it leaves the kitchen soon." : channel === "dine-in" ? "Ready — it's coming to your table." : "Ready — you can collect it now.";
  if (status === "completed") return "Completed. Thank you!";
  return "This order was cancelled.";
}

export const STATUS_TONE = { placed: "info", accepted: "info", preparing: "warning", ready: "success", out_for_delivery: "info", completed: "success", cancelled: "danger" };

/** how it is paid for, and whether it has been */
export function paymentInfo(order) {
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

export function AccountView({ outletId, menuHref, outletSlug, reservationsEnabled = false }) {
  const router = useRouter();
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
  // rating an order (which order's box is open), "order again" (which one is being added), and the store's rating setup
  const [rating, setRating] = useState(null);
  const [again, setAgain] = useState(null);
  const [againError, setAgainError] = useState(null);
  const [feedbackCfg, setFeedbackCfg] = useState({ enabled: false, googleReviewUrl: "", googleMinStars: 4 });
  const loadedFor = useRef(null);

  /**
   * "Order again": the API rebuilds the old order against today's menu; the dishes go into that outlet's cart (added
   * to whatever is already there), a note says what couldn't come back, and the customer lands on the order page.
   */
  const orderAgain = async (o) => {
    setAgain(o.id);
    setAgainError(null);
    try {
      const r = await api(`/api/customer/orders/${o.id}/reorder`, { outletId });
      if (!r.lines.length) throw new Error(r.skipped.length ? `None of these dishes can be ordered right now (${r.skipped.map((s) => s.name).join(", ")}).` : "Nothing to add.");
      const key = `rasoipulse.cart.${r.outletId}`;
      let cart = [];
      try {
        cart = JSON.parse(window.localStorage.getItem(key) || "[]");
      } catch {
        cart = [];
      }
      window.localStorage.setItem(key, JSON.stringify([...(Array.isArray(cart) ? cart : []), ...r.lines]));
      if (r.skipped.length || r.notes.length) window.sessionStorage.setItem(`rasoipulse.reorderNotice.${r.outletId}`, JSON.stringify({ skipped: r.skipped, notes: r.notes }));
      startNavProgress();
      router.push(`/${r.outletSlug}/order`);
    } catch (e) {
      setAgainError({ id: o.id, message: e.message });
      setAgain(null);
    }
  };

  const load = useCallback(
    async ({ reset = true, quiet = false } = {}) => {
      try {
        const q = new URLSearchParams({ outletId, limit: "15" });
        if (!reset && nextBefore) q.set("before", new Date(nextBefore).toISOString());
        const r = await api(`/api/customer/orders?${q}`);
        setCoins(r.coins);
        if (r.feedback) setFeedbackCfg(r.feedback);
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

      {reservationsEnabled ? <MyBookings outletId={outletId} bookHref={outletSlug ? `/${outletSlug}/book` : null} /> : null}

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
                  {statusLabelFor(o.status, o.channel)}
                </Pill>
              </div>

              <p style={{ margin: "10px 0 0", fontSize: 13.5 }} data-testid="order-status-line">
                {statusLine(o)}
              </p>

              {active ? <Tracker status={o.status} channel={o.channel} /> : null}
              {active ? (
                <Link href={`/${o.outlet?.slug || outletSlug}/order/${o.id}`} style={{ display: "inline-block", marginTop: 10, fontSize: 13, fontWeight: 700, color: "var(--color-primary-text, var(--color-primary))" }} data-testid="order-follow">
                  Follow this order →
                </Link>
              ) : null}

              {o.status === "out_for_delivery" && o.rider?.name ? (
                <div style={riderBox} data-testid="order-rider">
                  <Bike size={16} />
                  <span style={{ flex: 1 }}>
                    <strong>{o.rider.name}</strong> is bringing your order
                  </span>
                  {o.rider.phone ? (
                    <a href={`tel:${o.rider.phone.replace(/\s/g, "")}`} style={callLink}>
                      <Phone size={13} /> Call
                    </a>
                  ) : null}
                </div>
              ) : null}

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

              {o.feedback || o.canRate || !active ? (
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
                  {o.feedback ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }} data-testid="order-rating">
                      <StarRow value={o.feedback.rating} /> You rated it
                      {o.feedback.editable ? (
                        <button type="button" style={{ ...linkBtn, padding: 0 }} onClick={() => setRating(rating === o.id ? null : o.id)}>
                          Change
                        </button>
                      ) : null}
                    </span>
                  ) : o.canRate ? (
                    <button type="button" className="ot-press" style={rateBtn} onClick={() => setRating(rating === o.id ? null : o.id)} data-testid="order-rate">
                      <Star size={14} /> Rate this order
                    </button>
                  ) : null}
                  {!active && o.outlet?.slug ? (
                    <button type="button" className="ot-press" style={againBtn} onClick={() => orderAgain(o)} disabled={again === o.id} data-testid="order-again">
                      <RotateCcw size={14} /> {again === o.id ? "Adding…" : "Order again"}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {againError?.id === o.id ? <p style={{ color: "var(--tone-danger)", fontSize: 12.5, margin: "6px 0 0" }}>{againError.message}</p> : null}
              {rating === o.id ? (
                <RateBox
                  outletId={outletId}
                  order={o}
                  googleMinStars={feedbackCfg.googleMinStars}
                  onDone={(fb) => {
                    setOrders((prev) => (prev ?? []).map((x) => (x.id === o.id ? { ...x, feedback: fb, canRate: false } : x)));
                  }}
                  onClose={() => setRating(null)}
                />
              ) : null}

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

export function Tracker({ status, channel }) {
  const steps = channel === "delivery" ? DELIVERY_STEPS : STEPS;
  const at = steps.indexOf(status);
  return (
    <ol style={trackerList} aria-label="Order progress">
      {steps.map((s, i) => (
        <li key={s} style={{ ...trackerStep, color: i <= at ? "var(--color-text)" : "var(--color-text-muted)" }} aria-current={i === at ? "step" : undefined}>
          <span style={{ ...dot, background: i <= at ? "var(--color-primary)" : "var(--color-border)" }}>{i < at ? <CheckCircle2 size={11} color="var(--color-on-primary)" /> : null}</span>
          {statusLabelFor(s, channel)}
        </li>
      ))}
    </ol>
  );
}

export function Details({ order: o }) {
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

export const TONES = {
  info: ["var(--tone-info-wash)", "var(--tone-info)"],
  warning: ["var(--tone-warning-wash)", "var(--tone-warning)"],
  success: ["var(--tone-success-wash)", "var(--tone-success)"],
  danger: ["var(--tone-danger-wash)", "var(--tone-danger)"],
  neutral: ["var(--color-surface)", "var(--color-text-muted)"],
};

export function Pill({ tone = "neutral", small, children, testid }) {
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
const linkBtn = { font: "inherit", fontSize: 12.5, fontWeight: 700, padding: "10px 0 2px", background: "none", border: "none", color: "var(--color-primary-text, var(--color-primary))", cursor: "pointer" };
const primaryLink = { display: "inline-block", font: "inherit", fontWeight: 700, fontSize: 14, padding: "11px 20px", borderRadius: "var(--radius-card)", background: "var(--color-primary)", color: "var(--color-on-primary)", textDecoration: "none" };
const errorBox = { color: "var(--tone-danger)", background: "var(--tone-danger-wash)", fontSize: 13, fontWeight: 500, padding: "10px 12px", borderRadius: "calc(var(--radius-card) - 2px)", marginBottom: 12 };
const askBox = { marginTop: 8, padding: "12px 14px", borderRadius: "calc(var(--radius-card) - 2px)", background: "var(--color-surface)", border: "1px solid var(--color-border)" };
const dangerBtn = { font: "inherit", fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: "var(--radius-card)", border: "none", background: "var(--tone-danger)", color: "#fff", cursor: "pointer" };
const trackerList = { listStyle: "none", margin: "12px 0 0", padding: 0, display: "flex", justifyContent: "space-between", gap: 4 };
const trackerStep = { display: "flex", flexDirection: "column", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, flex: 1, textAlign: "center" };
const dot = { display: "grid", placeItems: "center", width: 16, height: 16, borderRadius: 999 };
const detailBox = { marginTop: 10, paddingTop: 12, borderTop: "1px dashed var(--color-border)" };

/* ----------------------------------------------------------------- ratings */

function StarRow({ value, size = 14 }) {
  return (
    <span style={{ display: "inline-flex", gap: 1 }} aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} fill={n <= value ? "#F5A524" : "none"} color={n <= value ? "#F5A524" : "var(--color-border)"} />
      ))}
    </span>
  );
}

/**
 * Rate one completed order: stars, a few quick tags (praise for 4–5 stars, what went wrong for 1–3) and an optional
 * comment. A happy rating is offered the store's Google review page, when it has one.
 */
function RateBox({ outletId, order, onDone, onClose }) {
  const [stars, setStars] = useState(order.feedback?.rating ?? 0);
  const [tags, setTags] = useState(order.feedback?.tags ?? []);
  const [comment, setComment] = useState(order.feedback?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const pool = stars >= 4 ? FEEDBACK_TAGS.good : FEEDBACK_TAGS.bad;
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api(`/api/customer/orders/${order.id}/feedback`, { outletId, rating: stars, comment: comment.trim(), tags: tags.filter((t) => pool.includes(t)) });
      setDone(r);
      onDone(r.feedback);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (done) {
    return (
      <div style={rateBox} data-testid="rate-thanks">
        <p style={{ margin: 0, fontWeight: 700 }}>Thank you for rating your order!</p>
        {done.google ? (
          <p style={{ margin: "6px 0 0", fontSize: 13.5 }}>
            Glad you enjoyed it. Would you tell others on Google?{" "}
            <a href={done.google} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, color: "var(--color-primary-text, var(--color-primary))" }} data-testid="rate-google">
              Write a Google review
            </a>
          </p>
        ) : null}
        <button type="button" style={{ ...linkBtn, padding: "8px 0 0" }} onClick={onClose}>
          Close
        </button>
      </div>
    );
  }
  return (
    <div style={rateBox} data-testid="rate-box">
      <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 14 }}>How was order #{order.orderNumber}?</p>
      <div style={{ display: "flex", gap: 6 }} role="radiogroup" aria-label="Stars">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => setStars(n)} style={starBtn} data-testid={`rate-${n}`}>
            <Star size={28} fill={n <= stars ? "#F5A524" : "none"} color={n <= stars ? "#F5A524" : "var(--color-border)"} />
          </button>
        ))}
      </div>
      {stars ? (
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0" }}>
            {pool.map((t) => {
              const on = tags.includes(t);
              return (
                <button key={t} type="button" aria-pressed={on} onClick={() => setTags((x) => (on ? x.filter((y) => y !== t) : [...x, t]))} style={{ ...tagBtn, ...(on ? tagBtnOn : {}) }}>
                  {t}
                </button>
              );
            })}
          </div>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} rows={2} placeholder={stars >= 4 ? "What did you like? (optional)" : "What went wrong? (optional)"} style={commentBox} aria-label="Comment" />
          {error ? <p style={{ color: "var(--tone-danger)", fontSize: 12.5, margin: "6px 0 0" }}>{error}</p> : null}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" className="ot-press" style={sendBtn} onClick={send} disabled={busy} data-testid="rate-send">
              {busy ? "Sending…" : "Send rating"}
            </button>
            <button type="button" className="ot-press" style={ghostBtn} onClick={onClose} disabled={busy}>
              Not now
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- bookings */

const BOOKING_TONE = { requested: "warning", confirmed: "success", seated: "success", completed: "neutral", declined: "danger", cancelled: "neutral", no_show: "danger" };

/** The customer's table bookings at this store (upcoming first), with cancel while it is still allowed. */
function MyBookings({ outletId, bookHref }) {
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api(`/api/reservations/mine?outletId=${encodeURIComponent(outletId)}`)
      .then((r) => setList(r.reservations ?? []))
      .catch(() => setList([]));
  }, [outletId]);
  const cancel = async (b) => {
    if (!window.confirm(`Cancel your booking ${b.code} for ${formatWhen(b.at)}?`)) return;
    setBusy(b.id);
    setError(null);
    try {
      const r = await api(`/api/reservations/${b.id}/cancel`, { outletId });
      setList((prev) => prev.map((x) => (x.id === b.id ? { ...x, ...r.reservation, canCancel: false } : x)));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };
  if (!list) return null;
  const upcoming = list.filter((b) => new Date(b.at).getTime() > Date.now() - 3 * 3_600_000);
  return (
    <>
      <h2 style={{ ...h2, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span>Your table bookings</span>
        {bookHref ? (
          <Link href={bookHref} style={{ fontSize: 13, fontWeight: 700, color: "var(--color-primary-text, var(--color-primary))" }} data-testid="account-book">
            <CalendarDays size={14} style={{ verticalAlign: -2 }} /> Book a table
          </Link>
        ) : null}
      </h2>
      {error ? <div style={errorBox}>{error}</div> : null}
      {!upcoming.length ? (
        <p style={{ ...muted, margin: "0 0 4px" }}>No upcoming bookings.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-testid="account-bookings">
          {upcoming.map((b) => (
            <article key={b.id} className="ot-fx-card" style={fx("card", { ...card, padding: "12px 14px" })} data-booking={b.code} data-status={b.status}>
              <div style={rowBetween}>
                <div>
                  <div style={{ fontWeight: 800 }}>{formatWhen(b.at)}</div>
                  <div style={muted}>
                    Table for {b.partySize} · {b.outlet?.name} · {b.code}
                    {b.tableNumber ? ` · Table ${b.tableNumber}` : ""}
                  </div>
                </div>
                <Pill tone={BOOKING_TONE[b.status]} small>
                  {b.statusLabel}
                </Pill>
              </div>
              {b.canCancel ? (
                <button type="button" style={{ ...linkBtn, color: "var(--tone-danger)" }} onClick={() => cancel(b)} disabled={busy === b.id} data-testid="booking-cancel">
                  {busy === b.id ? "Cancelling…" : "Cancel booking"}
                </button>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </>
  );
}

const riderBox = { display: "flex", alignItems: "center", gap: 10, marginTop: 12, padding: "10px 12px", borderRadius: "calc(var(--radius-card) - 2px)", background: "var(--tone-info-wash)", color: "var(--tone-info)", fontSize: 13.5 };
const callLink = { display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 700, fontSize: 13, color: "inherit", textDecoration: "none", padding: "6px 10px", borderRadius: 999, background: "var(--color-bg)" };
const rateBtn = { font: "inherit", fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, border: "1px solid #F5A524", background: "color-mix(in srgb, #F5A524 12%, var(--color-bg))", color: "var(--color-text)", cursor: "pointer" };
const againBtn = { font: "inherit", fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, border: "1px solid var(--color-primary)", background: "var(--color-bg)", color: "var(--color-primary-text, var(--color-primary))", cursor: "pointer" };
const rateBox = { marginTop: 10, padding: "12px 14px", borderRadius: "calc(var(--radius-card) - 2px)", background: "var(--color-surface)", border: "1px solid var(--color-border)" };
const starBtn = { border: "none", background: "none", padding: 2, cursor: "pointer", lineHeight: 0 };
const tagBtn = { font: "inherit", fontSize: 12.5, fontWeight: 600, padding: "5px 10px", borderRadius: 999, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", cursor: "pointer" };
const tagBtnOn = { borderColor: "var(--color-primary)", background: "color-mix(in srgb, var(--color-primary) 10%, var(--color-bg))", color: "var(--color-primary-text, var(--color-primary))" };
const commentBox = { width: "100%", boxSizing: "border-box", font: "inherit", fontSize: 13.5, padding: "8px 10px", borderRadius: 9, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", resize: "vertical" };
const sendBtn = { font: "inherit", fontSize: 13, fontWeight: 700, padding: "8px 14px", borderRadius: "var(--radius-card)", border: "none", background: "var(--color-primary)", color: "var(--color-on-primary)", cursor: "pointer" };
