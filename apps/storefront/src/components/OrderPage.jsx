"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { formatINR, formatWhen, GATEWAY_LABELS, ORDER_TYPE_STORAGE_KEY } from "@onetap/config-schema";
import { DropdownSoft, fx, ProgressSteps } from "@onetap/ui";
import { ArrowLeft, Check, ChevronRight, Coins, MapPin, ShoppingBag, Sparkles, Tag, Utensils, Wallet, X } from "lucide-react";
import { api, payOnline } from "@/lib/clientApi";
import { useCapacity } from "@/lib/useCapacity";
import { useCartLines } from "@/lib/useCartLines";
import { useCartSync } from "@/lib/useCartSync";
import { useCustomer } from "@/lib/useCustomer";
import { useDineInSession } from "@/lib/useDineInSession";
import { AddressPicker } from "./AddressPicker";
import { CustomerGate } from "./CustomerGate";
import { Stepper } from "./Stepper";

/**
 * The whole checkout journey, not just what any one screen collects. "Items
 * selected" is already true by the time any of this can render — you only
 * reach it with something in the cart. The last step's own label is decided
 * per fulfilment (see `journeyStepLabel` below) since "Delivery address"
 * would be a lie for a takeaway order.
 */
const JOURNEY_STEPS = ["Items selected", "Your details", "About you", "Delivery address"];

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
  takeawayEnabled = true,
  couponsEnabled = true,
  preordersEnabled = false,
  menuHref,
}) {
  const { customer, loading: customerLoading, refresh } = useCustomer();
  const { lines, hydrated, setQty, addLine, setAll, clear: clearCart } = useCartLines(outletId);
  const capacity = useCapacity(outletId);
  const itemsById = useMemo(() => new Map(menu.items.map((i) => [i.id, i])), [menu.items]);
  // the store keeps a signed-in customer's cart for its forgotten-cart reminders (when it has them on)
  useCartSync(outletId, lines, { enabled: Boolean(customer), hydrated });

  // A reminder's link (".../order?cart=<id>") opened on a phone whose cart is empty brings the cart back.
  const restored = useRef(false);
  useEffect(() => {
    if (!hydrated || restored.current || lines.length) return;
    const id = new URLSearchParams(window.location.search).get("cart");
    if (!id) return;
    restored.current = true;
    void api(`/api/customer/cart/${encodeURIComponent(id)}?outletId=${encodeURIComponent(outletId)}`)
      .then((r) => r.lines?.length && setAll(r.lines))
      .catch(() => undefined);
  }, [hydrated, lines.length, outletId, setAll]);

  // "Order again" from the Account page leaves a note of what couldn't come back (sold out, no longer on the menu)
  const [reorderNote, setReorderNote] = useState(null);
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(`onetap.reorderNotice.${outletId}`);
      if (raw) {
        setReorderNote(JSON.parse(raw));
        window.sessionStorage.removeItem(`onetap.reorderNotice.${outletId}`);
      }
    } catch {
      /* private window */
    }
  }, [outletId]);

  // a pre-order: "now" (as soon as possible) or "later" at a pickup time the outlet offers
  const [when, setWhen] = useState("now");
  const [pickupAt, setPickupAt] = useState("");

  const [placed, setPlaced] = useState(null);
  const { sessionId, setSessionId, tab, refreshTab } = useDineInSession(dineIn, outletId, placed?.id);
  // Which of CustomerGate's own steps it's currently showing — the `customer`
  // prop alone can't tell us this, since a fresh signup never touches it until
  // the whole gate succeeds. CustomerGate reports it directly.
  const [gateStep, setGateStep] = useState("details");

  const [fulfilment, setFulfilment] = useState("takeaway");
  // Set by the visitor on this page — from then on their choice here wins over the one remembered from the menu page.
  const choseHere = useRef(false);
  const chooseFulfilment = (value) => {
    choseHere.current = true;
    setFulfilment(value);
    try {
      if (value === "takeaway" || value === "delivery") window.localStorage.setItem(ORDER_TYPE_STORAGE_KEY, value);
    } catch {
      /* not remembered */
    }
  };
  const [tableNumber, setTableNumber] = useState("");
  const [tables, setTables] = useState([]);
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [redeemCoins, setRedeemCoins] = useState(0);
  const [deliveryAddress, setDeliveryAddress] = useState(null);
  const [deliveryQuote, setDeliveryQuote] = useState(null);
  const [priced, setPriced] = useState(null);
  const [priceError, setPriceError] = useState(null);

  const effectiveChannel = dineIn ? "dine-in" : fulfilment === "dinein" ? "dine-in" : fulfilment;
  // only a takeaway can be for later; the chosen time travels with every quote and with the order
  const scheduledFor = effectiveChannel === "takeaway" && when === "later" && pickupAt ? pickupAt : undefined;
  const prepaidGateways = useMemo(() => gateways.filter((g) => g !== "cod"), [gateways]);
  const deliveryAvailable = deliveryEnabled && prepaidGateways.length > 0 && !capacity?.deliveryBlocked;
  // Why Delivery can't be picked (shown under the buttons) — null when it can.
  const deliveryOffReason = deliveryAvailable
    ? null
    : deliveryEnabled && prepaidGateways.length > 0
      ? "Delivery is paused right now."
      : "Delivery isn't available from this outlet.";
  const takeawayOffReason = takeawayEnabled ? null : "Takeaway isn't available from this outlet.";

  useEffect(() => {
    if (fulfilment === "delivery" && !deliveryAvailable) setFulfilment("takeaway");
  }, [fulfilment, deliveryAvailable]);

  // An outlet that only delivers: start on Delivery, since Takeaway can't be chosen.
  useEffect(() => {
    if (!dineIn && fulfilment === "takeaway" && !takeawayEnabled && deliveryAvailable) setFulfilment("delivery");
  }, [fulfilment, takeawayEnabled, deliveryAvailable, dineIn]);

  // They picked Delivery on the menu page: start here on Delivery too, once we know it can be offered.
  useEffect(() => {
    if (choseHere.current || dineIn || !deliveryAvailable) return;
    try {
      if (window.localStorage.getItem(ORDER_TYPE_STORAGE_KEY) === "delivery") setFulfilment("delivery");
    } catch {
      /* private window */
    }
  }, [deliveryAvailable, dineIn]);

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
        scheduledFor,
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
  }, [lines, outletId, appliedCoupon, redeemCoins, effectiveChannel, deliveryAddress, scheduledFor]);

  useEffect(() => {
    if (customer) void reprice();
  }, [reprice, customer]);

  const applyCoupon = async (code) => {
    try {
      const r = await api("/api/coupons/apply", { outletId, code, cart: { lines }, channel: effectiveChannel, scheduledFor });
      if (!r.ok) return r.reason ?? "That coupon can't be used.";
      setAppliedCoupon({ code: r.code, discount: r.discount });
      return null;
    } catch (e) {
      return e.message;
    }
  };

  /* --------------------------------------------------------------- gating */

  // One number driving the bar across every screen this page can show — not
  // just the ones CustomerGate itself renders. Null hides it entirely: there
  // is no "step" to show before the cart is even known, or once the order is
  // placed and the journey is simply over. While the gate is up, this follows
  // `gateStep` (what CustomerGate itself reports) rather than `customer` —
  // `customer` doesn't change until the whole gate succeeds, so a fresh
  // signup moving from "your details" into "about you" would otherwise leave
  // the bar frozen on step 2 for the entire rest of the gate.
  const journeyIndex =
    customerLoading || !hydrated || (lines.length === 0 && !placed) || placed
      ? null
      : !customer || !customer.profileComplete
        ? gateStep === "profile"
          ? 2
          : 1
        : 3;
  const journeyStepLabel =
    journeyIndex !== 3
      ? journeyIndex !== null
        ? JOURNEY_STEPS[journeyIndex]
        : null
      : // "Delivery address" is only true for a delivery order — a dine-in
        // diner is picking a table here, and a takeaway order has neither, so
        // the last step's own displayed name follows what's actually on screen.
        effectiveChannel === "delivery"
        ? "Delivery address"
        : effectiveChannel === "dine-in"
          ? "Table number"
          : "Review & pay";
  const progressLabel =
    journeyIndex !== null ? `Step ${journeyIndex + 1} of ${JOURNEY_STEPS.length} · ${journeyStepLabel}` : null;

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
      <PageShell menuHref={menuHref} title={customer ? "Complete your profile" : "Sign in to order"} progress={journeyIndex} progressLabel={progressLabel}>
        <CustomerGate customer={customer} outletId={outletId} onSuccess={refresh} onStepChange={setGateStep} />
      </PageShell>
    );
  }

  if (placed) {
    return (
      <PageShell menuHref={menuHref} title="Order confirmed">
        <DoneView order={placed} dineIn={dineIn} tab={tab} channel={effectiveChannel} menuHref={menuHref} accountHref={dineIn ? null : `${menuHref}/account`} />
      </PageShell>
    );
  }

  return (
    <PageShell menuHref={menuHref} title="Your order" customer={customer} progress={journeyIndex} progressLabel={progressLabel}>
      {reorderNote?.skipped?.length || reorderNote?.notes?.length ? (
        <p style={reorderBanner} data-testid="reorder-notice">
          {reorderNote.skipped?.length ? (
            <>
              Not added: {reorderNote.skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}.{" "}
            </>
          ) : null}
          {(reorderNote.notes ?? []).join(" ")}
        </p>
      ) : null}
      <ReviewOrder
        outletId={outletId}
        outletName={outletName}
        menu={menu}
        onAddSuggestion={(s) => addLine({ itemId: s.itemId, variantId: s.variantId ?? undefined, modifierOptionIds: [], quantity: 1 })}
        preordersEnabled={preordersEnabled}
        when={when}
        onWhen={setWhen}
        pickupAt={pickupAt}
        onPickupAt={setPickupAt}
        scheduledFor={scheduledFor}
        lines={lines}
        priced={priced}
        priceError={priceError}
        itemsById={itemsById}
        onQty={setQty}
        dineIn={dineIn}
        dineInEnabled={dineInEnabled}
        deliveryAvailable={deliveryAvailable}
        deliveryOffReason={deliveryOffReason}
        couponsEnabled={couponsEnabled}
        takeawayOffReason={takeawayOffReason}
        capacity={capacity}
        fulfilment={fulfilment}
        onFulfilment={chooseFulfilment}
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
          setWhen("now");
          setPickupAt("");
          void refreshTab();
        }}
      />
    </PageShell>
  );
}

/* -------------------------------------------------------------------- shell */

function PageShell({ menuHref, title, customer, progress, progressLabel, children }) {
  return (
    <div style={page}>
      <header className="ot-fx-bar" style={fx("bar", topBar)}>
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
      {progress !== null && progress !== undefined ? (
        <div className="ot-fx-bar" style={fx("bar", pageProgressWrap)}>
          <ProgressSteps steps={JOURNEY_STEPS} value={(progress / JOURNEY_STEPS.length) * 100} label={progressLabel} />
        </div>
      ) : null}
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
      <Link href={menuHref} className="ot-fx-btn" style={fx("btn", primaryLinkBtn)}>
        Browse the menu
      </Link>
    </div>
  );
}

/* --------------------------------------------------------------- the order */

function ReviewOrder({
  outletId,
  outletName,
  menu,
  onAddSuggestion,
  preordersEnabled,
  when,
  onWhen,
  pickupAt,
  onPickupAt,
  scheduledFor,
  lines,
  priced,
  priceError,
  itemsById,
  onQty,
  dineIn,
  dineInEnabled,
  deliveryAvailable,
  deliveryOffReason,
  takeawayOffReason,
  couponsEnabled,
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
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  // Same ref serves the dropdown's trigger button and the plain-input
  // fallback below — whichever actually renders, `focusTablePicker` just
  // needs one element it can scroll to and focus.
  const tablePickerRef = useRef(null);

  const t = priced?.totals;
  const subtotalPaise = priced?.totals.subtotal ?? 0;
  const isDineIn = channel === "dine-in";
  const cart = { lines, couponCode: appliedCoupon?.code, redeemCoins: redeemCoins || undefined };

  const deliveryBlocked = channel === "delivery" && (!deliveryAddress || !deliveryQuote?.serviceable);
  const tableMissing = fulfilment === "dinein" && !dineIn && !tableNumber.trim();
  // "Later" chosen for a takeaway, but no pickup time picked yet
  const pickupMissing = channel === "takeaway" && preordersEnabled && when === "later" && !pickupAt;

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
          scheduledFor,
        });
        order = res.order;
        setPendingOrder(order);
      }
      if (gateway !== "cod") await payOnline(outletId, order.id, gateway);
      onPlaced(order);
    });

  // tableMissing does NOT disable the button — clicking it in that state is
  // now a real action (scroll to and focus the table picker) rather than
  // nothing at all, so it stays clickable.
  const placeDisabled = !priced || deliveryBlocked || pickupMissing;

  /** The bottom button's fallback action when a table hasn't been picked yet. */
  const focusTablePicker = () => {
    tablePickerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTablePickerOpen(true);
    // Give the scroll a moment to land before stealing focus, so the ring
    // appears on something already in view rather than the page still moving.
    window.setTimeout(() => tablePickerRef.current?.focus(), 350);
  };

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
          <input className="ot-fx-input" style={fx("input", input)} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. less spicy" maxLength={200} />
        </label>
      </Section>

      <Suggestions outletId={outletId} lines={lines} menu={menu} onAdd={onAddSuggestion} />

      {capacity?.orderMessage ? <Banner tone="warn">{capacity.orderMessage}</Banner> : null}
      {capacity?.deliveryMessage ? <Banner tone="warn">{capacity.deliveryMessage}</Banner> : null}

      {dineIn ? (
        <Section icon={<Utensils size={16} />} title={`Table ${dineIn.tableNumber}`}>
          <p style={muted}>This joins your running tab — settle everything together when you're done.</p>
        </Section>
      ) : (
        <Section icon={<Utensils size={16} />} title="How would you like it?">
          {/* Always both, so the visitor sees what exists: one this outlet can't do right now is greyed out and says why. */}
          <div role="group" aria-label="Order type" style={{ display: "flex", gap: 8 }}>
            <ChoiceBtn testId="fulfilment-takeaway" active={fulfilment === "takeaway"} disabledReason={takeawayOffReason} onClick={() => onFulfilment("takeaway")} emoji="🥡" label="Takeaway" />
            <ChoiceBtn testId="fulfilment-delivery" active={fulfilment === "delivery"} disabledReason={deliveryOffReason} onClick={() => onFulfilment("delivery")} emoji="🛵" label="Delivery" />
          </div>
          {deliveryOffReason || takeawayOffReason ? (
            <p style={{ ...muted, margin: "8px 0 0" }} data-testid="fulfilment-hint">
              {[takeawayOffReason, deliveryOffReason].filter(Boolean).join(" ")}
            </p>
          ) : null}

          {fulfilment === "takeaway" && preordersEnabled ? (
            <PickupTime outletId={outletId} when={when} onWhen={onWhen} pickupAt={pickupAt} onPickupAt={onPickupAt} />
          ) : null}

          {fulfilment === "dinein" ? (
            <div style={{ marginTop: 14 }}>
              <p style={{ ...muted, margin: "0 0 8px" }}>Your table number — it&apos;s printed on the table.</p>
              {tables.length ? (
                <DropdownSoft
                  label="Select your table"
                  fullWidth
                  value={tableNumber}
                  onChange={onTableNumber}
                  open={tablePickerOpen}
                  onOpenChange={setTablePickerOpen}
                  triggerRef={tablePickerRef}
                  options={tables.map((tb) => ({
                    value: tb.number,
                    label: `Table ${tb.number} - ${tb.seats} ${tb.seats === 1 ? "Person" : "People"}`,
                    disabled: tb.occupied,
                    tag: tb.occupied ? "Unavailable" : undefined,
                  }))}
                />
              ) : (
                <input
                  ref={tablePickerRef}
                  className="ot-fx-input"
                  style={fx("input", input)}
                  value={tableNumber}
                  onChange={(e) => onTableNumber(e.target.value)}
                  placeholder="e.g. 7"
                  inputMode="numeric"
                />
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
      )}

      {/* only for stores whose plan includes Coupons — otherwise there is nothing to enter */}
      {couponsEnabled ? (
        <Section icon={<Tag size={16} />} title="Coupon">
          {appliedCoupon ? (
            <AppliedPill onRemove={onRemoveCoupon}>
              <strong>{appliedCoupon.code}</strong> applied — {formatINR(appliedCoupon.discount)} off
            </AppliedPill>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="ot-fx-input"
                style={{ ...fx("input", input), textTransform: "uppercase" }}
                value={couponInput}
                onChange={(e) => {
                  setCouponInput(e.target.value);
                  setCouponError(null);
                }}
                placeholder="SAVE20"
              />
              <button
                type="button"
                className="ot-fx-btn"
                style={fx("btn", applyBtn)}
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
      ) : null}

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
              <input className="ot-fx-input" style={fx("input", input)} type="number" min={0} max={walletBalance} inputMode="numeric" value={coinInput} onChange={(e) => setCoinInput(e.target.value)} placeholder="0" />
              <button type="button" className="ot-fx-btn" style={fx("btn", applyBtn)} disabled={!coinInput || Number(coinInput) <= 0} onClick={() => onRedeemCoins(Math.floor(Number(coinInput)))}>
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
              <label key={g} className="ot-fx-chip" data-active={gateway === g} style={fx("chip", payOption)}>
                <input
                  type="radio"
                  name="gateway"
                  checked={gateway === g}
                  onChange={() => {
                    setGateway(g);
                    // A pending order was created with whatever gateway was
                    // selected at the time — the server has no way to change
                    // an order's gateway after the fact, so reusing it here
                    // would send this new choice to checkout while quietly
                    // billing the OLD one underneath. Forcing a fresh order
                    // keeps the two in sync.
                    if (pendingOrder) {
                      setPendingOrder(null);
                      setError(null);
                    }
                  }}
                />
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

      <div className="ot-fx-bar" style={fx("bar", bottomBar)}>
        <div>
          <div style={bottomBarLabel}>To pay</div>
          <div style={bottomBarPrice}>{t ? formatINR(t.grandTotal) : "…"}</div>
        </div>
        <button type="button" className="ot-fx-btn" style={fx("btn", placeBtn)} disabled={busy || placeDisabled} onClick={tableMissing ? focusTablePicker : place} data-testid="place-order">
          {busy
            ? "Please wait…"
            : deliveryBlocked
              ? "Add delivery address"
              : tableMissing
                ? "Pick your table"
                : pickupMissing
                  ? "Choose a pickup time"
                  : isDineIn
                    ? "Send to kitchen"
                    : pendingOrder
                      ? "Try payment again"
                      : gateway === "cod"
                        ? scheduledFor
                          ? "Place pre-order"
                          : "Place order"
                        : "Pay & place order"}
          <ChevronRight size={16} />
        </button>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------- done */

function DoneView({ order, dineIn, tab, channel, menuHref, accountHref }) {
  const isDineIn = Boolean(dineIn) || channel === "dine-in";
  const isDelivery = channel === "delivery";
  const gateway = order.payment?.gateway;
  const paidOnline = Boolean(gateway) && gateway !== "cod" && order.payment?.status && order.payment.status !== "pending";

  const lead = isDineIn
    ? `Sent to the kitchen${dineIn ? ` for Table ${dineIn.tableNumber}` : ""}.`
    : isDelivery
      ? "It's on its way to you."
      : order.scheduledFor
        ? "It will be ready for you at your pickup time."
        : "The kitchen has it.";

  // What the customer wants to know, one fact per line — not packed into one sentence.
  const rows = [
    ["Order type", isDineIn ? (dineIn ? `Dine-in · Table ${dineIn.tableNumber}` : "Dine-in") : isDelivery ? "Delivery" : order.scheduledFor ? "Takeaway · pre-order" : "Takeaway"],
    order.scheduledFor ? ["Pickup", formatWhen(order.scheduledFor)] : null,
    !isDineIn && order.etaMinutes && !order.scheduledFor ? [isDelivery ? "Arrives in" : "Ready in", `about ${order.etaMinutes} minutes`] : null,
    ["Total", formatINR(order.totals.grandTotal)],
    !isDineIn && gateway ? ["Payment", paidOnline ? "Paid online" : (GATEWAY_LABELS[gateway] ?? "")] : null,
  ].filter(Boolean);

  return (
    <div style={doneWrap} className="ot-anim-pop">
      <div style={doneCheck} aria-hidden="true">
        <Check size={34} strokeWidth={3} />
      </div>
      <h2 style={doneTitle}>Order #{order.orderNumber} placed</h2>
      <p style={doneLead}>{lead}</p>

      <dl className="ot-fx-card" style={fx("card", doneSummary)}>
        {rows.map(([label, value], i) => (
          <div key={label} style={{ ...doneRow, ...(i > 0 ? doneRowRule : null) }}>
            <dt style={doneLabel}>{label}</dt>
            <dd style={doneValue}>{value}</dd>
          </div>
        ))}
      </dl>

      {isDineIn && tab !== null ? (
        <p style={doneTab}>
          Running tab <strong style={{ fontVariantNumeric: "tabular-nums" }}>{formatINR(tab)}</strong>
        </p>
      ) : null}

      <Link href={menuHref} className="ot-fx-btn" style={fx("btn", doneButton)}>
        Back to menu
      </Link>
      {accountHref ? (
        <Link href={accountHref} style={{ marginTop: 14, fontSize: 14, fontWeight: 700, color: "var(--color-primary)" }} data-testid="done-track">
          Follow your order
        </Link>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- pickup time */

/**
 * Takeaway "When?": as soon as possible, or later at one of the outlet's pickup times (grouped by day). The times come
 * from the API, so a time shown is a time the order will be accepted for (a full one is shown and can't be picked).
 */
function PickupTime({ outletId, when, onWhen, pickupAt, onPickupAt }) {
  const [days, setDays] = useState(null);
  const [day, setDay] = useState("");
  useEffect(() => {
    let live = true;
    api(`/api/orders/pickup-slots?outletId=${encodeURIComponent(outletId)}`)
      .then((r) => {
        if (!live) return;
        setDays(r.days ?? []);
        setDay((d) => d || r.days?.[0]?.dayKey || "");
      })
      .catch(() => live && setDays([]));
    return () => {
      live = false;
    };
  }, [outletId]);
  const shown = days?.find((d) => d.dayKey === day) ?? days?.[0];
  return (
    <div style={{ marginTop: 14 }} data-testid="pickup-time">
      <p style={{ ...muted, margin: "0 0 8px", fontWeight: 600, color: "var(--color-text)" }}>When do you want it?</p>
      <div role="group" aria-label="When" style={{ display: "flex", gap: 8 }}>
        <ChoiceBtn testId="when-now" active={when === "now"} onClick={() => onWhen("now")} emoji="⚡" label="As soon as possible" />
        <ChoiceBtn testId="when-later" active={when === "later"} disabledReason={days && !days.length ? "No pickup times are open right now." : null} onClick={() => onWhen("later")} emoji="🕒" label="Later" />
      </div>
      {when === "later" && shown ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {days.map((d) => (
              <button key={d.dayKey} type="button" className="ot-fx-chip" data-active={d.dayKey === shown.dayKey} style={fx("chip", { ...dayChip, ...(d.dayKey === shown.dayKey ? dayChipOn : {}) })} onClick={() => { setDay(d.dayKey); onPickupAt(""); }}>
                {d.label}
              </button>
            ))}
          </div>
          <div style={slotGrid}>
            {shown.slots.map((s) => (
              <button
                key={s.at}
                type="button"
                disabled={s.full}
                onClick={() => onPickupAt(s.at)}
                className="ot-fx-chip"
                data-testid="pickup-slot"
                data-active={pickupAt === s.at}
                aria-pressed={pickupAt === s.at}
                title={s.full ? "Fully booked" : undefined}
                style={fx("chip", { ...slotBtn, ...(pickupAt === s.at ? dayChipOn : {}), ...(s.full ? { opacity: 0.4, cursor: "not-allowed", textDecoration: "line-through" } : {}) })}
              >
                {s.label}
              </button>
            ))}
          </div>
          {pickupAt ? <p style={{ ...muted, margin: "8px 0 0" }}>Pickup {formatWhen(pickupAt)}. You can pay at the counter or online, as usual.</p> : null}
        </div>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- suggestions */

/**
 * "Goes well with your order": a few dishes the store suggests for what is in the cart, one tap to add (a dish with
 * sizes is added in its first size). Hidden when there's nothing to suggest.
 */
function Suggestions({ outletId, lines, menu, onAdd }) {
  const [data, setData] = useState(null);
  const ids = useMemo(() => [...new Set(lines.map((l) => l.itemId))], [lines]);
  const key = ids.join(",");
  useEffect(() => {
    if (!ids.length) return undefined;
    let live = true;
    const t = setTimeout(() => {
      api("/api/menu/suggestions", { outletId, itemIds: ids })
        .then((r) => live && setData(r))
        .catch(() => live && setData(null));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletId, key]);
  const byId = useMemo(() => new Map(menu.items.map((i) => [i.id, i])), [menu.items]);
  const items = (data?.items ?? []).map((s) => ({ s, item: byId.get(s.itemId) })).filter((x) => x.item && !ids.includes(x.s.itemId));
  if (!items.length) return null;
  return (
    <Section icon={<Sparkles size={16} />} title={data.title || "Goes well with your order"}>
      <div style={suggestRow} data-testid="suggestions">
        {items.map(({ s, item }) => {
          const variant = item.variants.find((v) => v.id === s.variantId);
          const price = variant ? variant.price : item.basePrice;
          return (
            <div key={item.id} style={suggestCard} data-testid="suggestion" data-item={item.name}>
              {item.images?.[0]?.url ? <img src={item.images[0].url} alt="" style={suggestImg} loading="lazy" /> : <div style={{ ...suggestImg, display: "grid", placeItems: "center", fontWeight: 800, color: "var(--color-text-muted)" }}>{item.name.slice(0, 1)}</div>}
              <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3, minHeight: 34 }}>{item.name}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {formatINR(price)}
                  {variant && item.variants.length > 1 ? <span style={{ ...muted, fontSize: 11 }}> · {variant.label}</span> : null}
                </span>
                <button type="button" className="ot-fx-btn" style={fx("btn", suggestAdd)} onClick={() => onAdd(s)} aria-label={`Add ${item.name}`}>
                  + Add
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ pieces */

function Section({ icon, title, children }) {
  return (
    <section className="ot-fx-card" style={fx("card", section)}>
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

function ChoiceBtn({ active, onClick, emoji, label, disabledReason, testId }) {
  const off = Boolean(disabledReason);
  const on = active && !off;
  return (
    <button
      type="button"
      onClick={() => !off && onClick()}
      disabled={off}
      title={off ? disabledReason : undefined}
      className="ot-fx-chip"
      data-testid={testId}
      data-active={on}
      data-unavailable={off ? "true" : undefined}
      aria-pressed={on}
      style={fx("chip", { ...choiceBtn, ...(on ? choiceBtnActive : {}), ...(off ? choiceBtnOff : {}) })}
    >
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

// --fx-page-bg lets a visual effect clear this so its page backdrop shows through.
const page = { minHeight: "100dvh", background: "var(--fx-page-bg, var(--color-surface, var(--color-bg)))" };
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
const pageProgressWrap = {
  maxWidth: 640,
  margin: "0 auto",
  padding: "14px 16px 12px",
  background: "var(--color-bg)",
  borderBottom: "1px solid var(--color-border)",
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
const choiceBtn = { font: "inherit", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "12px 10px", borderRadius: 12, border: "1.5px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer" };
const choiceBtnActive = { border: "1.5px solid var(--color-primary)", background: "color-mix(in srgb, var(--color-primary) 10%, var(--color-bg))", color: "var(--color-primary)" };
const choiceBtnOff = { opacity: 0.45, cursor: "not-allowed", background: "transparent", color: "var(--color-text-muted)", boxShadow: "none" };
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
const doneWrap = { display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "48px 4px 32px" };
const doneCheck = {
  width: 72,
  height: 72,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  background: "var(--tone-success-wash)",
  color: "var(--tone-success)",
  boxShadow: "0 0 0 10px color-mix(in srgb, var(--tone-success) 10%, transparent)",
};
const doneTitle = { margin: "30px 0 0", fontFamily: "var(--font-heading)", fontSize: "clamp(1.45rem, 5.5vw, 1.8rem)", lineHeight: 1.2, textWrap: "balance" };
const doneLead = { margin: "10px 0 0", fontSize: 16, lineHeight: 1.5, color: "var(--color-text-muted)" };
const doneSummary = { width: "100%", maxWidth: 380, margin: "28px 0 0", padding: "4px 18px", background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 14, textAlign: "left" };
const doneRow = { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, padding: "13px 0" };
const doneRowRule = { borderTop: "1px solid var(--color-border)" };
const doneLabel = { fontSize: 13.5, color: "var(--color-text-muted)" };
const doneValue = { margin: 0, fontSize: 15, fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums" };
const doneTab = { margin: "18px 0 0", fontSize: 14.5, color: "var(--color-text-muted)" };
const reorderBanner = { maxWidth: 640, margin: "16px auto 0", boxSizing: "border-box", fontSize: 13, lineHeight: 1.5, padding: "10px 13px", borderRadius: 10, background: "color-mix(in srgb, var(--tone-warning, #B27B1A) 14%, var(--color-surface))", color: "var(--color-text)" };
const dayChip = { font: "inherit", fontSize: 13, fontWeight: 600, padding: "7px 13px", borderRadius: 999, border: "1.5px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", cursor: "pointer" };
const dayChipOn = { borderColor: "var(--color-primary)", background: "color-mix(in srgb, var(--color-primary) 10%, var(--color-bg))", color: "var(--color-primary)" };
const slotGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(86px, 1fr))", gap: 6, maxHeight: 220, overflowY: "auto", paddingRight: 2 };
const slotBtn = { font: "inherit", fontSize: 13, fontWeight: 600, padding: "8px 6px", borderRadius: 10, border: "1.5px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", cursor: "pointer", fontVariantNumeric: "tabular-nums" };
const suggestRow = { display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollSnapType: "x mandatory" };
const suggestCard = { flex: "0 0 150px", scrollSnapAlign: "start", border: "1px solid var(--color-border)", borderRadius: 12, padding: 8, background: "var(--color-bg)" };
const suggestImg = { width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 9, background: "var(--color-surface)", marginBottom: 6 };
const suggestAdd = { font: "inherit", fontSize: 12, fontWeight: 700, padding: "5px 9px", borderRadius: 8, border: "none", background: "var(--color-primary)", color: "var(--color-on-primary)", cursor: "pointer", whiteSpace: "nowrap" };
const doneButton = { display: "inline-block", marginTop: 32, minWidth: 220, textAlign: "center", font: "inherit", fontWeight: 700, fontSize: 15.5, padding: "14px 28px", borderRadius: 12, background: "var(--color-primary)", color: "var(--color-on-primary)", textDecoration: "none" };
