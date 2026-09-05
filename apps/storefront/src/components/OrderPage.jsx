"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatINR, GATEWAY_LABELS } from "@onetap/config-schema";
import { ArrowLeft, Check, ChevronRight, Coins, MapPin, ShoppingBag, Sparkles, Tag, Utensils, Wallet, X } from "lucide-react";
import { api, payOnline } from "@/lib/clientApi";
import { useCapacity } from "@/lib/useCapacity";
import { useCartLines } from "@/lib/useCartLines";
import { useCustomer } from "@/lib/useCustomer";
import { useDineInSession } from "@/lib/useDineInSession";
import { AddressPicker } from "./AddressPicker";
import { CustomerGate } from "./CustomerGate";
import { Stepper } from "./Stepper";

/**
 * The dedicated order page — what used to be the "Your order" popup.
 *
 * Gated on sign-in before anything else renders: coupons and coin redemption
 * both need a real customer id to mean anything (the API already refuses to
 * redeem coins for a guest), so asking earlier rather than at the last step
 * is what makes those features usable at all, not just a UX preference.
 */
export function OrderPage({
  outletId,
  outletName,
  menu,
  gateways,
  dineIn,
  dineInEnabled = false,
  deliveryEnabled = false,
  menuHref,
}) {
  const { customer, loading: customerLoading, refresh } = useCustomer();
  const { lines, hydrated, setQty, clear: clearCart } = useCartLines(outletId);
  const capacity = useCapacity(outletId);
  const itemsById = useMemo(() => new Map(menu.items.map((i) => [i.id, i])), [menu.items]);

  const [placed, setPlaced] = useState(null);
  const { sessionId, setSessionId, tab, refreshTab } = useDineInSession(dineIn, outletId, placed?.id);

  const [fulfilment, setFulfilment] = useState("takeaway");
  const [tableNumber, setTableNumber] = useState("");
  const [tables, setTables] = useState([]);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [redeemCoins, setRedeemCoins] = useState(0);
  const [deliveryAddress, setDeliveryAddress] = useState(null);
  const [deliveryQuote, setDeliveryQuote] = useState(null);
  const [priced, setPriced] = useState(null);
  const [priceError, setPriceError] = useState(null);

  const effectiveChannel = dineIn ? "dine-in" : fulfilment === "dinein" ? "dine-in" : fulfilment;
  const prepaidGateways = useMemo(() => gateways.filter((g) => g !== "cod"), [gateways]);
  const deliveryAvailable = deliveryEnabled && prepaidGateways.length > 0 && !capacity?.deliveryBlocked;

  useEffect(() => {
    if (fulfilment === "delivery" && !deliveryAvailable) setFulfilment("takeaway");
  }, [fulfilment, deliveryAvailable]);

  useEffect(() => {
    if (fulfilment !== "dinein" || dineIn || tables.length) return;
    void api(`/api/tables/public?outletId=${encodeURIComponent(outletId)}`)
      .then((r) => setTables(r.tables ?? []))
      .catch(() => undefined);
  }, [fulfilment, dineIn, tables.length, outletId]);

  const reprice = useCallback(async () => {
    if (lines.length === 0) {
      setPriced(null);
      return;
    }
    try {
      const body = {
        outletId,
        cart: { lines, couponCode: appliedCoupon?.code, redeemCoins: redeemCoins || undefined },
        channel: effectiveChannel,
      };
      if (effectiveChannel === "delivery" && deliveryAddress) {
        body.deliveryPoint = { lat: deliveryAddress.lat, lng: deliveryAddress.lng };
      }
      const q = await api("/api/orders/quote", body);
      setPriced(q);
      if (appliedCoupon && q.couponError) {
        setAppliedCoupon(null);
        setPriceError(q.couponError);
      } else {
        setPriceError(null);
      }
    } catch (e) {
      setPriceError(e.message);
    }
    // Only once the customer is known — pricing before that would quote coin
    // redemption against no one and immediately show a "sign in" error that's
    // about to be replaced by the actual sign-in screen anyway.
  }, [lines, outletId, appliedCoupon, redeemCoins, effectiveChannel, deliveryAddress]);

  useEffect(() => {
    if (customer) void reprice();
  }, [reprice, customer]);

  const applyCoupon = async (code) => {
    try {
      const r = await api("/api/coupons/apply", { outletId, code, cart: { lines }, channel: effectiveChannel });
      if (!r.ok) return r.reason ?? "That coupon can't be used.";
      setAppliedCoupon({ code: r.code, discount: r.discount });
      return null;
    } catch (e) {
      return e.message;
    }
  };

  /* --------------------------------------------------------------- gating */

  if (customerLoading || !hydrated) {
    return <PageShell menuHref={menuHref} title="Your order" />;
  }

  if (lines.length === 0 && !placed) {
    return (
      <PageShell menuHref={menuHref} title="Your order">
        <EmptyCart menuHref={menuHref} />
      </PageShell>
    );
  }

  if (!customer || !customer.profileComplete) {
    return (
      <PageShell menuHref={menuHref} title={customer ? "Complete your profile" : "Sign in to order"}>
        <CustomerGate customer={customer} outletId={outletId} onSuccess={refresh} />
      </PageShell>
    );
  }

  if (placed) {
    return (
      <PageShell menuHref={menuHref} title="Order confirmed">
        <DoneView order={placed} dineIn={dineIn} tab={tab} channel={effectiveChannel} menuHref={menuHref} />
      </PageShell>
    );
  }

  return (
    <PageShell menuHref={menuHref} title="Your order" customer={customer}>
      <ReviewOrder
        outletId={outletId}
        outletName={outletName}
        lines={lines}
        priced={priced}
        priceError={priceError}
        itemsById={itemsById}
        onQty={setQty}
        dineIn={dineIn}
        dineInEnabled={dineInEnabled}
        deliveryAvailable={deliveryAvailable}
        capacity={capacity}
        fulfilment={fulfilment}
        onFulfilment={setFulfilment}
        tableNumber={tableNumber}
        onTableNumber={setTableNumber}
        tables={tables}
        appliedCoupon={appliedCoupon}
        onApplyCoupon={applyCoupon}
        onRemoveCoupon={() => setAppliedCoupon(null)}
        redeemCoins={redeemCoins}
        onRedeemCoins={setRedeemCoins}
        walletBalance={customer.walletBalance}
        deliveryAddress={deliveryAddress}
        deliveryQuote={deliveryQuote}
        onDelivery={(addr, q) => {
          setDeliveryAddress(addr);
          setDeliveryQuote(q);
        }}
        channel={effectiveChannel}
        gateways={effectiveChannel === "delivery" ? prepaidGateways : gateways}
        onSession={setSessionId}
        onPlaced={(order) => {
          setPlaced(order);
          // Clear the cart the placed order came from — otherwise a
          // navigation back to the menu and back here shows the same items
          // again, as though they were never ordered. Everything else here
          // resets too, so a second order on this visit starts clean.
          clearCart();
          setAppliedCoupon(null);
          setRedeemCoins(0);
          setDeliveryAddress(null);
          setDeliveryQuote(null);
          void refreshTab();
        }}
      />
    </PageShell>
  );
}

/* -------------------------------------------------------------------- shell */

function PageShell({ menuHref, title, customer, children }) {
  return (
    <div style={page}>
      <header style={topBar}>
        <Link href={menuHref} style={backLink} aria-label="Back to menu">
          <ArrowLeft size={19} />
        </Link>
        <h1 style={topBarTitle}>{title}</h1>
        {customer ? (
          <span style={walletChip} title="Your coin balance">
            <Coins size={13} /> {customer.walletBalance}
          </span>
        ) : (
          <span style={{ width: 19 }} aria-hidden />
        )}
      </header>
      <main style={main}>{children}</main>
    </div>
  );
}

function EmptyCart({ menuHref }) {
  return (
    <div style={emptyWrap}>
      <ShoppingBag size={38} style={{ color: "var(--color-text-muted)", opacity: 0.6 }} />
      <p style={{ margin: "14px 0 4px", fontWeight: 600, fontSize: 15.5 }}>Your cart is empty</p>
      <p style={{ margin: "0 0 20px", color: "var(--color-text-muted)", fontSize: 13.5 }}>Add something from the menu to get started.</p>
      <Link href={menuHref} style={primaryLinkBtn}>
        Browse the menu
      </Link>
    </div>
  );
}

/* --------------------------------------------------------------- the order */

function ReviewOrder({
  outletId,
  outletName,
  lines,
  priced,
  priceError,
  itemsById,
  onQty,
  dineIn,
  dineInEnabled,
  deliveryAvailable,
  capacity,
  fulfilment,
  onFulfilment,
  tableNumber,
  onTableNumber,
  tables,
  appliedCoupon,
  onApplyCoupon,
  onRemoveCoupon,
  redeemCoins,
  onRedeemCoins,
  walletBalance,
  deliveryAddress,
  deliveryQuote,
  onDelivery,
  channel,
  gateways,
  onSession,
  onPlaced,
}) {
  const [couponInput, setCouponInput] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState(null);
  const [coinInput, setCoinInput] = useState(redeemCoins > 0 ? String(redeemCoins) : "");
  const [gateway, setGateway] = useState(gateways[0] ?? "cod");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [pendingOrder, setPendingOrder] = useState(null);

  const t = priced?.totals;
  const subtotalPaise = priced?.totals.subtotal ?? 0;
  const isDineIn = channel === "dine-in";
  const cart = { lines, couponCode: appliedCoupon?.code, redeemCoins: redeemCoins || undefined };

  const deliveryBlocked = channel === "delivery" && (!deliveryAddress || !deliveryQuote?.serviceable);
  const tableMissing = fulfilment === "dinein" && !dineIn && !tableNumber.trim();

  const placeDineIn = async (session) => {
    const { order } = await api("/api/orders", { outletId, cart, channel: "dine-in", sessionId: session, note: note.trim() || undefined });
    onPlaced(order);
  };

  const runPlace = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const place = () =>
    runPlace(async () => {
      // A QR-scanned table is never asked to type its own number — that
      // branch below is only for a walk-in who opened the site directly. The
      // two used to be a single `isDineIn` check with no way to tell them
      // apart, which sent a QR visit down the walk-in branch and failed on a
      // table-number field that was never shown to them.
      //
      // This always calls the create-or-join endpoint rather than reusing
      // `sessionId` from the read-only GET the tab display uses — that GET
      // only ever returns a session that ALREADY exists, so on a table's very
      // first order of the visit it is permanently null and placing would
      // never have anything to place onto. `openSession` server-side already
      // rejoins an existing open session for this diner rather than opening a
      // second one, so calling it here on every order is exactly as safe as
      // the plain GET would have been, and is the only version that also
      // works for the first order.
      if (dineIn) {
        const r = await api(`/api/tables/scan/${dineIn.tableId}/session`, { token: dineIn.token });
        onSession(r.session.id);
        await placeDineIn(r.session.id);
        return;
      }
      if (isDineIn) {
        if (!tableNumber.trim()) throw new Error("Pick your table first");
        const r = await api("/api/tables/claim", { outletId, tableNumber: tableNumber.trim() });
        onSession(r.session.id);
        await placeDineIn(r.session.id);
        return;
      }

      let order = pendingOrder;
      if (!order) {
        const res = await api("/api/orders", {
          outletId,
          cart,
          channel,
          gateway,
          note: note.trim() || undefined,
          deliveryAddress: channel === "delivery" ? deliveryAddress : undefined,
        });
        order = res.order;
        setPendingOrder(order);
      }
      if (gateway !== "cod") await payOnline(outletId, order.id, gateway);
      onPlaced(order);
    });

  const placeDisabled = !priced || deliveryBlocked || tableMissing || (isDineIn && !dineIn && !tableNumber.trim());

  return (
    <>
      <Section icon={<ShoppingBag size={16} />} title={`${lines.length} item${lines.length === 1 ? "" : "s"} · ${outletName}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {lines.map((line, i) => {
            const item = itemsById.get(line.itemId);
            const pl = priced?.lines[i];
            return (
              <div key={`${line.itemId}-${i}`} style={itemRow}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>{item?.name ?? "Item"}</div>
                  <div style={itemMeta}>
                    {[pl?.variantLabel, ...(pl?.modifiers.map((m) => m.label) ?? [])].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <Stepper value={line.quantity} onChange={(q) => onQty(i, q)} small />
                <span style={itemPrice}>{pl ? formatINR(pl.lineTotal) : "…"}</span>
              </div>
            );
          })}
        </div>
        <label style={noteLabel}>
          <span>Note for the kitchen (optional)</span>
          <input style={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. less spicy" maxLength={200} />
        </label>
      </Section>

      {capacity?.orderMessage ? <Banner tone="warn">{capacity.orderMessage}</Banner> : null}
      {capacity?.deliveryMessage ? <Banner tone="warn">{capacity.deliveryMessage}</Banner> : null}

      {dineIn ? (
        <Section icon={<Utensils size={16} />} title={`Table ${dineIn.tableNumber}`}>
          <p style={muted}>This joins your running tab — settle everything together when you're done.</p>
        </Section>
      ) : showFulfilmentPicker(dineInEnabled, deliveryAvailable) ? (
        <Section icon={<Utensils size={16} />} title="How would you like it?">
          <div style={{ display: "flex", gap: 8 }}>
            <ChoiceBtn active={fulfilment === "takeaway"} onClick={() => onFulfilment("takeaway")} emoji="🥡" label="Takeaway" />
            {dineInEnabled ? <ChoiceBtn active={fulfilment === "dinein"} onClick={() => onFulfilment("dinein")} emoji="🍽️" label="At a table" /> : null}
            {deliveryAvailable ? <ChoiceBtn active={fulfilment === "delivery"} onClick={() => onFulfilment("delivery")} emoji="🛵" label="Delivery" /> : null}
          </div>

          {fulfilment === "dinein" ? (
            <div style={{ marginTop: 14 }}>
              <p style={{ ...muted, margin: "0 0 8px" }}>Your table number — it&apos;s printed on the table.</p>
              {tables.length ? (
                <div style={tableGrid}>
                  {tables.map((tb) => (
                    <button
                      key={tb.number}
                      type="button"
                      disabled={tb.occupied}
                      onClick={() => onTableNumber(tb.number)}
                      style={{ ...tableChip, ...(tableNumber === tb.number ? tableChipActive : {}), opacity: tb.occupied ? 0.4 : 1 }}
                    >
                      {tb.number}
                    </button>
                  ))}
                </div>
              ) : (
                <input style={input} value={tableNumber} onChange={(e) => onTableNumber(e.target.value)} placeholder="e.g. 7" inputMode="numeric" />
              )}
            </div>
          ) : null}

          {fulfilment === "delivery" ? (
            <div style={{ marginTop: 14 }}>
              <p style={{ ...muted, margin: "0 0 8px", display: "flex", alignItems: "center", gap: 5 }}>
                <MapPin size={13} /> Delivery orders are paid online.
              </p>
              <AddressPicker outletId={outletId} subtotal={subtotalPaise} onChange={onDelivery} />
            </div>
          ) : null}
        </Section>
      ) : null}

      <Section icon={<Tag size={16} />} title="Coupon">
        {appliedCoupon ? (
          <AppliedPill onRemove={onRemoveCoupon}>
            <strong>{appliedCoupon.code}</strong> applied — {formatINR(appliedCoupon.discount)} off
          </AppliedPill>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...input, textTransform: "uppercase" }}
              value={couponInput}
              onChange={(e) => {
                setCouponInput(e.target.value);
                setCouponError(null);
              }}
              placeholder="SAVE20"
            />
            <button
              type="button"
              style={applyBtn}
              disabled={couponBusy || couponInput.trim().length < 3}
              onClick={async () => {
                setCouponBusy(true);
                const err = await onApplyCoupon(couponInput.trim());
                setCouponBusy(false);
                if (err) setCouponError(err);
                else setCouponInput("");
              }}
            >
              {couponBusy ? "…" : "Apply"}
            </button>
          </div>
        )}
        {couponError ? <p style={errorText}>{couponError}</p> : null}
      </Section>

      {walletBalance > 0 ? (
        <Section icon={<Wallet size={16} />} title={`Redeem coins · ${walletBalance} available`}>
          {redeemCoins > 0 ? (
            <AppliedPill
              onRemove={() => {
                onRedeemCoins(0);
                setCoinInput("");
              }}
            >
              <strong>{redeemCoins}</strong> coin{redeemCoins === 1 ? "" : "s"} applied
              {t && t.coinsDiscount > 0 ? ` — ${formatINR(t.coinsDiscount)} off` : ""}
            </AppliedPill>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <input style={input} type="number" min={0} max={walletBalance} inputMode="numeric" value={coinInput} onChange={(e) => setCoinInput(e.target.value)} placeholder="0" />
              <button type="button" style={applyBtn} disabled={!coinInput || Number(coinInput) <= 0} onClick={() => onRedeemCoins(Math.floor(Number(coinInput)))}>
                Apply
              </button>
            </div>
          )}
          {priced?.coinsError ? <p style={errorText}>{priced.coinsError}</p> : null}
        </Section>
      ) : null}

      {!isDineIn && gateways.length > 1 ? (
        <Section icon={<Sparkles size={16} />} title="Pay with">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {gateways.map((g) => (
              <label key={g} style={payOption}>
                <input type="radio" name="gateway" checked={gateway === g} onChange={() => setGateway(g)} />
                <span>{GATEWAY_LABELS[g]}</span>
              </label>
            ))}
          </div>
        </Section>
      ) : null}

      {priceError ? <Banner tone="error">{priceError}</Banner> : null}

      {t ? (
        <Section icon={<Sparkles size={16} />} title="Total">
          <dl style={totalsList}>
            <TotalRow label="Item total" value={formatINR(t.subtotal)} />
            {t.discount > 0 ? <TotalRow label={`Discount${appliedCoupon ? ` (${appliedCoupon.code})` : ""}`} value={`− ${formatINR(t.discount)}`} tone="good" /> : null}
            {t.coinsDiscount > 0 ? <TotalRow label="Coins redeemed" value={`− ${formatINR(t.coinsDiscount)}`} tone="good" /> : null}
            {t.cgst > 0 ? <TotalRow label="CGST" value={formatINR(t.cgst)} /> : null}
            {t.sgst > 0 ? <TotalRow label="SGST" value={formatINR(t.sgst)} /> : null}
            {t.deliveryFee > 0 ? <TotalRow label="Delivery fee" value={formatINR(t.deliveryFee)} /> : null}
            {channel === "delivery" && deliveryQuote?.serviceable && t.deliveryFee === 0 ? <TotalRow label="Delivery" value="Free" tone="good" /> : null}
            {t.roundOff !== 0 ? <TotalRow label="Round off" value={formatINR(t.roundOff)} /> : null}
            <TotalRow label="To pay" value={formatINR(t.grandTotal)} strong />
          </dl>
          {channel === "delivery" && deliveryQuote?.serviceable ? (
            <p style={{ ...muted, margin: "8px 0 0" }}>Estimated delivery in about {deliveryQuote.etaMinutes} minutes.</p>
          ) : priced?.pricesIncludeTax ? (
            <p style={{ ...muted, margin: "8px 0 0" }}>Prices include GST.</p>
          ) : null}
        </Section>
      ) : null}

      {pendingOrder && error ? <Banner tone="warn">Order #{pendingOrder.orderNumber} is saved but not paid yet. Try the payment again below.</Banner> : null}
      {error ? <Banner tone="error">{error}</Banner> : null}

      {/* Spacer so content never sits under the sticky bottom bar. */}
      <div style={{ height: 8 }} />

      <div style={bottomBar}>
        <div>
          <div style={bottomBarLabel}>To pay</div>
          <div style={bottomBarPrice}>{t ? formatINR(t.grandTotal) : "…"}</div>
        </div>
        <button type="button" style={placeBtn} disabled={busy || placeDisabled} onClick={place}>
          {busy
            ? "Please wait…"
            : deliveryBlocked
              ? "Add delivery address"
              : tableMissing
                ? "Pick your table"
                : isDineIn
                  ? "Send to kitchen"
                  : pendingOrder
                    ? "Try payment again"
                    : gateway === "cod"
                      ? "Place order"
                      : "Pay & place order"}
          <ChevronRight size={16} />
        </button>
      </div>
    </>
  );
}

function showFulfilmentPicker(dineInEnabled, deliveryAvailable) {
  return dineInEnabled || deliveryAvailable;
}

/* -------------------------------------------------------------------- done */

function DoneView({ order, dineIn, tab, channel, menuHref }) {
  return (
    <div style={doneWrap} className="ot-anim-pop">
      <div style={doneCheck}>
        <Check size={30} strokeWidth={3} />
      </div>
      <h2 style={{ margin: "16px 0 4px", fontFamily: "var(--font-heading)", fontSize: 20 }}>Order #{order.orderNumber} placed</h2>
      <p style={muted}>
        {dineIn || channel === "dine-in"
          ? `Sent to the kitchen${dineIn ? ` for Table ${dineIn.tableNumber}` : ""}.`
          : channel === "delivery"
            ? `${formatINR(order.totals.grandTotal)} — on its way.${order.etaMinutes ? ` About ${order.etaMinutes} minutes.` : ""}`
            : `${formatINR(order.totals.grandTotal)} — the kitchen has it.${order.etaMinutes ? ` Ready in about ${order.etaMinutes} minutes.` : ""}`}
      </p>
      {(dineIn || channel === "dine-in") && tab !== null ? <p style={{ ...muted, fontWeight: 700, color: "var(--color-text)" }}>Running tab: {formatINR(tab)}</p> : null}
      <Link href={menuHref} style={primaryLinkBtn}>
        Back to menu
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ pieces */

function Section({ icon, title, children }) {
  return (
    <section style={section}>
      <h2 style={sectionTitle}>
        <span style={sectionIcon}>{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Banner({ tone, children }) {
  return <p style={{ ...banner, ...(tone === "error" ? bannerError : tone === "warn" ? bannerWarn : {}) }}>{children}</p>;
}

function AppliedPill({ children, onRemove }) {
  return (
    <div style={appliedPill}>
      <span>{children}</span>
      <button type="button" onClick={onRemove} style={pillRemove} aria-label="Remove">
        <X size={14} />
      </button>
    </div>
  );
}

function ChoiceBtn({ active, onClick, emoji, label }) {
  return (
    <button type="button" onClick={onClick} style={{ ...choiceBtn, ...(active ? choiceBtnActive : {}) }}>
      <span style={{ fontSize: 18 }}>{emoji}</span>
      {label}
    </button>
  );
}

function TotalRow({ label, value, strong, tone }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: strong ? 700 : 400, fontSize: strong ? 15.5 : 13.5, color: tone === "good" ? "var(--tone-success)" : undefined }}>
      <dt>{label}</dt>
      <dd style={{ margin: 0, fontVariantNumeric: "tabular-nums" }}>{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------- styles */

const page = { minHeight: "100dvh", background: "var(--color-surface, var(--color-bg))" };
const topBar = {
  position: "sticky",
  top: 0,
  zIndex: 30,
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "14px 16px",
  background: "var(--color-bg)",
  borderBottom: "1px solid var(--color-border)",
};
const backLink = { display: "inline-flex", color: "var(--color-text)", flexShrink: 0 };
const topBarTitle = { flex: 1, margin: 0, fontFamily: "var(--font-heading)", fontSize: 17, fontWeight: 700 };
const walletChip = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 12,
  fontWeight: 700,
  padding: "4px 9px",
  borderRadius: 999,
  color: "var(--tone-warning, #8A5A00)",
  background: "var(--tone-warning-wash, rgba(180,130,0,0.12))",
  flexShrink: 0,
};
const main = { maxWidth: 640, margin: "0 auto", padding: "16px 16px 100px" };
const section = { background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 14, padding: 16, marginBottom: 12 };
const sectionTitle = { display: "flex", alignItems: "center", gap: 8, margin: "0 0 12px", fontSize: 14, fontWeight: 700 };
const sectionIcon = { display: "inline-flex", color: "var(--color-primary)" };
const itemRow = { display: "flex", alignItems: "center", gap: 10, paddingBottom: 10, borderBottom: "1px solid var(--color-border)" };
const itemMeta = { fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 };
const itemPrice = { fontWeight: 700, fontVariantNumeric: "tabular-nums", minWidth: 64, textAlign: "right" };
const noteLabel = { display: "flex", flexDirection: "column", gap: 6, marginTop: 14, fontSize: 12.5, fontWeight: 600 };
const muted = { color: "var(--color-text-muted)", fontSize: 13, margin: 0, lineHeight: 1.5 };
const input = { width: "100%", font: "inherit", fontSize: 14.5, padding: "10px 12px", borderRadius: 9, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", boxSizing: "border-box" };
const applyBtn = { font: "inherit", fontSize: 13, fontWeight: 700, padding: "0 16px", borderRadius: 9, border: "1px solid var(--color-primary)", background: "var(--color-primary)", color: "var(--color-on-primary)", cursor: "pointer", flexShrink: 0 };
const appliedPill = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 12px", borderRadius: 9, background: "var(--tone-success-wash)", color: "var(--tone-success)", fontSize: 13 };
const pillRemove = { border: "none", background: "none", color: "inherit", cursor: "pointer", padding: 2, display: "inline-flex" };
const errorText = { color: "#B23B3B", fontSize: 12.5, margin: "8px 0 0" };
const banner = { fontSize: 12.5, lineHeight: 1.5, margin: "0 0 12px", padding: "10px 13px", borderRadius: 10, background: "color-mix(in srgb, var(--tone-warning, #B27B1A) 14%, var(--color-surface))", color: "var(--color-text)" };
const bannerWarn = {};
const bannerError = { background: "color-mix(in srgb, #B23B3B 14%, var(--color-surface))" };
const choiceBtn = { font: "inherit", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "12px 10px", borderRadius: 12, borderWidth: 1.5, borderStyle: "solid", borderColor: "var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" };
const choiceBtnActive = { borderColor: "var(--color-primary)", background: "color-mix(in srgb, var(--color-primary) 10%, var(--color-bg))", color: "var(--color-primary)" };
const tableGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))", gap: 7 };
const tableChip = { font: "inherit", fontSize: "0.9rem", fontWeight: 700, padding: "11px 4px", borderRadius: 10, borderWidth: 1.5, borderStyle: "solid", borderColor: "var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)" };
const tableChipActive = { borderColor: "var(--color-primary)", background: "var(--color-primary)", color: "var(--color-on-primary)" };
const payOption = { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--color-border)", borderRadius: 9, fontSize: 14, cursor: "pointer" };
const totalsList = { margin: 0, display: "flex", flexDirection: "column", gap: 7 };
const bottomBar = {
  position: "fixed",
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  padding: "12px 16px calc(12px + env(safe-area-inset-bottom, 0px))",
  background: "var(--color-bg)",
  borderTop: "1px solid var(--color-border)",
  boxShadow: "0 -8px 24px rgba(0,0,0,0.06)",
};
const bottomBarLabel = { fontSize: 11, color: "var(--color-text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" };
const bottomBarPrice = { fontSize: 19, fontWeight: 800, fontVariantNumeric: "tabular-nums" };
const placeBtn = { display: "inline-flex", alignItems: "center", gap: 6, font: "inherit", fontWeight: 700, fontSize: 15, padding: "13px 22px", borderRadius: 12, background: "var(--color-primary)", color: "var(--color-on-primary)", border: "none", cursor: "pointer" };
const emptyWrap = { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "80px 20px" };
const primaryLinkBtn = { display: "inline-block", font: "inherit", fontWeight: 700, fontSize: 14.5, padding: "12px 22px", borderRadius: 12, background: "var(--color-primary)", color: "var(--color-on-primary)", textDecoration: "none" };
const doneWrap = { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "60px 20px" };
const doneCheck = { width: 60, height: 60, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--tone-success-wash)", color: "var(--tone-success)" };
