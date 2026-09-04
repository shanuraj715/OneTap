"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
                                           
import {
  formatINR,
  GATEWAY_LABELS,
  menuLayoutSchema,
                      
                
               
            
                
                  
                   
} from "@onetap/config-schema";
import { MenuSections, getCarouselVariant, Photo } from "@onetap/ui";
import { AddressPicker,                                          } from "./AddressPicker";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3072";

async function api   (path        , body          )             {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json                      ).error ?? `Something went wrong (${res.status})`);
  return json     ;
}

;                                      

/** Where the order goes. `dinein` here means a walk-in who picked a table. */
;                                                    

/** What the storefront is allowed to know about a table: enough to pick one. */
;                      
                 
               
                
                    
 

;               
                    
                                                                              
   
 

;                               
                  
                      
                
 

;                      
             
                      
                 
                                
                             
 

/* ============================================================== component */

export function Ordering({
  outletId,
  menu,
  cardVariant,
  menuLayout,
  popupCarouselVariant = "carousel.slider",
  gateways,
  dineIn,
  dineInEnabled = false,
  deliveryEnabled = false,
}   
                   
             
                                                                                        
                       
                                           
                              
                          
                      
                         
                          
                            
 ) {
  const [sessionId, setSessionId] = useState               (null);
  const [tab, setTab] = useState               (null);
  const storageKey = `onetap.cart.${outletId}`;
  const [lines, setLines] = useState            ([]);
  const [customising, setCustomising] = useState                 (null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState      ("cart");
  const [priced, setPriced] = useState                    (null);
  const [error, setError] = useState               (null);
  const [placed, setPlaced] = useState                    (null);

  // ----- fulfilment, coupon and delivery live at this level so pricing sees them
  const [fulfilment, setFulfilment] = useState            ("takeaway");
  const [tableNumber, setTableNumber] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState                                           (null);
  const [redeemCoins, setRedeemCoins] = useState(0);
  const [deliveryAddress, setDeliveryAddress] = useState                        (null);
  const [deliveryQuote, setDeliveryQuote] = useState                      (null);

  const layout             = useMemo(
    () => menuLayout ?? menuLayoutSchema.parse({ mode: "auto", defaultCardVariant: cardVariant ?? "card.row-compact" }),
    [menuLayout, cardVariant],
  );

  const effectiveChannel                                      = dineIn
    ? "dine-in"
    : fulfilment === "dinein"
      ? "dine-in"
      : fulfilment;

  // Delivery must be paid online — a rider isn't collecting cash. So delivery is
  // only offered when the outlet has at least one non-COD payment method live.
  const prepaidGateways = useMemo(() => gateways.filter((g) => g !== "cod"), [gateways]);

  /* ------------------------------------------------------- load management */
  // Busy-kitchen / limited-rider capacity — polled independently of the cart,
  // so the banner (and the Delivery choice greying out) reacts even if the
  // customer is just browsing the menu.
  const [capacity, setCapacity] = useState                       (null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api                (`/api/orders/capacity?outletId=${encodeURIComponent(outletId)}`)
        .then((c) => alive && setCapacity(c))
        .catch(() => undefined);
    load();
    const id = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [outletId]);

  const deliveryAvailable = deliveryEnabled && prepaidGateways.length > 0 && !capacity?.deliveryBlocked;

  // If the customer had delivery selected and it's no longer possible, fall back.
  useEffect(() => {
    if (fulfilment === "delivery" && !deliveryAvailable) setFulfilment("takeaway");
  }, [fulfilment, deliveryAvailable]);

  /* -------------------------------------------------------- cart persistence */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setLines(JSON.parse(raw)              );
    } catch {
      /* private mode, cleared storage — start empty */
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(lines));
    } catch {
      /* not fatal */
    }
  }, [lines, storageKey]);

  /* ---------------------------------------------------------------- reprice */
  const reprice = useCallback(async () => {
    if (lines.length === 0) {
      setPriced(null);
      return;
    }
    try {
      const body                          = {
        outletId,
        cart: { lines, couponCode: appliedCoupon?.code, redeemCoins: redeemCoins || undefined },
        channel: effectiveChannel,
      };
      if (effectiveChannel === "delivery" && deliveryAddress) {
        body.deliveryPoint = { lat: deliveryAddress.lat, lng: deliveryAddress.lng };
      }
      const q = await api             ("/api/orders/quote", body);
      setPriced(q);
      if (appliedCoupon && q.couponError) {
        setAppliedCoupon(null);
        setError(q.couponError);
      } else {
        setError(null);
      }
    } catch (e) {
      setError((e         ).message);
    }
  }, [lines, outletId, appliedCoupon, redeemCoins, effectiveChannel, deliveryAddress]);

  useEffect(() => {
    void reprice();
  }, [reprice]);

  /* --------------------------------------------------------- dine-in session */
  const refreshTab = useCallback(async () => {
    if (!dineIn || !sessionId) return;
    try {
      const r = await api                 (`/api/tables/sessions/${sessionId}/tab?outletId=${outletId}`);
      setTab(r.tab);
    } catch {
      /* session closed by staff — the next order will say so */
    }
  }, [dineIn, sessionId, outletId]);

  useEffect(() => {
    if (!dineIn) return;
    void (async () => {
      try {
        const r = await api                                    (
          `/api/tables/scan/${dineIn.tableId}?k=${encodeURIComponent(dineIn.token)}`,
        );
        if (r.session) setSessionId(r.session.id);
      } catch {
        /* handled when they try to order */
      }
    })();
  }, [dineIn]);

  useEffect(() => {
    void refreshTab();
  }, [refreshTab, placed]);

  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const itemsById = useMemo(() => new Map(menu.items.map((i) => [i.id, i])), [menu.items]);

  const addLine = (line          ) => {
    setLines((prev) => [...prev, line]);
    setCustomising(null);
    setOpen(true);
    setStep("cart");
  };
  const setQty = (index        , qty        ) =>
    setLines((prev) => (qty <= 0 ? prev.filter((_, i) => i !== index) : prev.map((l, i) => (i === index ? { ...l, quantity: qty } : l))));

  /* ------------------------------------------------------------------ coupon */
  const applyCoupon = async (code        )                         => {
    try {
      const r = await api                                                                    ("/api/coupons/apply", {
        outletId,
        code,
        cart: { lines },
        channel: effectiveChannel,
      });
      if (!r.ok) return r.reason ?? "That coupon can't be used.";
      setAppliedCoupon({ code: r.code , discount: r.discount  });
      return null;
    } catch (e) {
      return (e         ).message;
    }
  };

  return (
    <>
      {dineIn ? (
        <div className="ot-anim-fade" style={tableBanner}>
          <span>
            Ordering to <strong>Table {dineIn.tableNumber}</strong>
          </span>
          {tab !== null && tab > 0 ? <span>Running tab {formatINR(tab)}</span> : null}
        </div>
      ) : null}

      <MenuSections menu={menu} layout={layout} onSelectItem={setCustomising} />

      {customising ? (
        <Customiser item={customising} menu={menu} popupCarouselVariant={popupCarouselVariant} onCancel={() => setCustomising(null)} onAdd={addLine} />
      ) : null}

      {count > 0 && !open ? (
        <button type="button" style={cartBar} onClick={() => setOpen(true)}>
          <span>
            {count} item{count > 1 ? "s" : ""}
          </span>
          <span>{priced ? formatINR(priced.totals.grandTotal) : "…"} · View cart</span>
        </button>
      ) : null}

      {open ? (
        <Panel onClose={() => setOpen(false)}>
          {step === "cart" ? (
            <CartStep
              outletId={outletId}
              lines={lines}
              priced={priced}
              error={error}
              itemsById={itemsById}
              onQty={setQty}
              onNext={() => setStep("verify")}
              dineIn={dineIn}
              dineInEnabled={dineInEnabled}
              deliveryEnabled={deliveryAvailable}
              capacity={capacity}
              fulfilment={fulfilment}
              onFulfilment={setFulfilment}
              tableNumber={tableNumber}
              onTableNumber={setTableNumber}
              appliedCoupon={appliedCoupon}
              onApplyCoupon={applyCoupon}
              onRemoveCoupon={() => setAppliedCoupon(null)}
              redeemCoins={redeemCoins}
              onRedeemCoins={setRedeemCoins}
              coinsError={priced?.coinsError ?? null}
              deliveryAddress={deliveryAddress}
              deliveryQuote={deliveryQuote}
              onDelivery={(addr, q) => {
                setDeliveryAddress(addr);
                setDeliveryQuote(q);
              }}
            />
          ) : null}
          {step === "verify" ? (
            <VerifyStep
              outletId={outletId}
              lines={lines}
              gateways={effectiveChannel === "delivery" ? prepaidGateways : gateways}
              dineIn={dineIn}
              channel={effectiveChannel}
              tableNumber={tableNumber}
              couponCode={appliedCoupon?.code}
              redeemCoins={redeemCoins}
              deliveryAddress={deliveryAddress}
              sessionId={sessionId}
              onSession={setSessionId}
              onBack={() => setStep("cart")}
              onPlaced={(order) => {
                setPlaced(order);
                setLines([]);
                setAppliedCoupon(null);
                setRedeemCoins(0);
                setDeliveryAddress(null);
                setDeliveryQuote(null);
                setStep("done");
              }}
            />
          ) : null}
          {step === "done" && placed ? (
            <DoneStep
              dineIn={dineIn}
              tab={tab}
              order={placed}
              channel={effectiveChannel}
              onClose={() => {
                setOpen(false);
                setStep("cart");
              }}
            />
          ) : null}
        </Panel>
      ) : null}
    </>
  );
}

/* --------------------------------------------------------- item image section */

/**
 * Renders item images at the top of the popup modal.
 * - 0 images → single placeholder Photo (matching menu card appearance)
 * - 1 image  → single full-width Photo
 * - 2+ images → carousel using the admin-configured variant
 */
function ItemImageSection({ item, carouselVariantId }                                                ) {
  try {
    const rawImages = item?.images ?? [];
    const imageUrls = rawImages
      .map((img) => (typeof img === "string" ? img : img?.url))
      .filter((url) => typeof url === "string" && url.trim().length > 0);

    // If no uploaded image URLs exist:
    // Render the default Photo component (warm gradient fallback matching the card)
    if (imageUrls.length === 0) {
      return (
        <div style={popupImageWrap}>
          <Photo
            name={item?.name ?? "Item"}
            alt={item?.name ?? "Item"}
            style={{ width: "100%", aspectRatio: "16 / 9" }}
            radius={0}
          />
        </div>
      );
    }

    // Exactly one image URL: show a single photo
    if (imageUrls.length === 1) {
      return (
        <div style={popupImageWrap}>
          <Photo
            name={item?.name ?? "Item"}
            src={imageUrls[0]}
            alt={item?.name ?? "Item"}
            style={{ width: "100%", aspectRatio: "16 / 9" }}
            radius={0}
          />
        </div>
      );
    }

    // Multiple images: use the configured carousel variant
    let Carousel = null;
    try {
      const variant = typeof getCarouselVariant === "function" ? getCarouselVariant(carouselVariantId) : null;
      Carousel = variant?.Component;
    } catch {
      Carousel = null;
    }

    if (!Carousel) {
      return (
        <div style={popupImageWrap}>
          <Photo
            name={item?.name ?? "Item"}
            src={imageUrls[0]}
            alt={item?.name ?? "Item"}
            style={{ width: "100%", aspectRatio: "16 / 9" }}
            radius={0}
          />
        </div>
      );
    }

    const carouselItems = imageUrls.map((url, idx) => ({
      title: idx === 0 ? (item?.name ?? "Item") : `${item?.name ?? "Item"} (${idx + 1})`,
      subtitle: undefined,
      imageUrl: url,
    }));

    return (
      <div style={popupImageWrap}>
        <Carousel items={carouselItems} />
      </div>
    );
  } catch (err) {
    console.error("Failed to render item image section:", err);
    return null;
  }
}

/* --------------------------------------------------------------- customiser */

function Customiser({
  item,
  menu,
  popupCarouselVariant,
  onCancel,
  onAdd,
}   
                 
             
                              
                       
                                  
 ) {
  const [variantId, setVariantId] = useState(item.variants[0]?.id);
  const [options, setOptions] = useState          ([]);
  const [quantity, setQuantity] = useState(1);
  const [active, setActive] = useState(false);
  const [closing, setClosing] = useState(false);

  // Disable page scroll while modal is opened, restore on unmount
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, []);

  // Smooth entrance transition on mount
  useEffect(() => {
    const frameId = requestAnimationFrame(() => setActive(true));
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Smooth exit transition before calling parent callback
  const handleClose = useCallback(
    (action             ) => {
      if (closing) return;
      setClosing(true);
      setTimeout(() => {
        action();
      }, 220);
    },
    [closing],
  );

  const handleCancel = useCallback(() => handleClose(onCancel), [handleClose, onCancel]);

  const handleAdd = useCallback(
    (payload                                                                     ) =>
      handleClose(() => onAdd(payload)),
    [handleClose, onAdd],
  );

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e              ) => {
      if (e.key === "Escape") {
        handleCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCancel]);

  const groups = menu.modifierGroups.filter((g) => item.modifierGroupIds.includes(g.id));
  const unit =
    (item.variants.find((v) => v.id === variantId)?.price ?? item.basePrice) +
    groups
      .flatMap((g) => g.options)
      .filter((o) => options.includes(o.id))
      .reduce((s, o) => s + o.priceDelta, 0);

  const isOpen = active && !closing;

  const currentOverlay = {
    ...overlay,
    opacity: isOpen ? 1 : 0,
    transition: "opacity 220ms cubic-bezier(0.16, 1, 0.3, 1)",
  };

  const currentModal = {
    ...modal,
    opacity: isOpen ? 1 : 0,
    transform: isOpen ? "scale(1) translateY(0)" : "scale(0.95) translateY(12px)",
    transition:
      "opacity 220ms cubic-bezier(0.16, 1, 0.3, 1), transform 220ms cubic-bezier(0.16, 1, 0.3, 1)",
    willChange: "opacity, transform",
  };

  return (
    <div style={currentOverlay} onClick={handleCancel} role="presentation">
      <div style={currentModal} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={item.name}>
        <ItemImageSection item={item} carouselVariantId={popupCarouselVariant} />
        <h3 style={{ margin: "0 0 4px", fontFamily: "var(--font-heading)", fontSize: 20 }}>{item.name}</h3>
        {item.description ? <p style={muted}>{item.description}</p> : null}

        {item.variants.length > 0 ? (
          <fieldset style={fieldset}>
            <legend style={legend}>Choose a size</legend>
            {item.variants.map((v) => (
              <label key={v.id} style={choice}>
                <input type="radio" name="variant" checked={variantId === v.id} onChange={() => setVariantId(v.id)} />
                <span style={{ flex: 1 }}>{v.label}</span>
                <span>{formatINR(v.price)}</span>
              </label>
            ))}
          </fieldset>
        ) : null}

        {groups.map((g) => (
          <fieldset key={g.id} style={fieldset}>
            <legend style={legend}>{g.name}</legend>
            {g.options.map((o) => (
              <label key={o.id} style={choice}>
                <input
                  type="checkbox"
                  checked={options.includes(o.id)}
                  onChange={(e) => setOptions((prev) => (e.target.checked ? [...prev, o.id] : prev.filter((x) => x !== o.id)))}
                />
                <span style={{ flex: 1 }}>{o.label}</span>
                <span>+{formatINR(o.priceDelta)}</span>
              </label>
            ))}
          </fieldset>
        ))}

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18 }}>
          <Stepper value={quantity} onChange={setQuantity} />
          <button
            type="button"
            style={{ ...primaryBtn, flex: 1, marginTop: 0 }}
            onClick={() => handleAdd({ itemId: item.id, variantId, modifierOptionIds: options, quantity })}
          >
            Add · {formatINR(unit * quantity)}
          </button>
        </div>
        <button type="button" style={linkBtn} onClick={handleCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- cart step */

function CartStep({
  outletId,
  lines,
  priced,
  error,
  itemsById,
  onQty,
  onNext,
  dineIn,
  dineInEnabled,
  deliveryEnabled,
  capacity,
  fulfilment,
  onFulfilment,
  tableNumber,
  onTableNumber,
  appliedCoupon,
  onApplyCoupon,
  onRemoveCoupon,
  redeemCoins,
  onRedeemCoins,
  coinsError,
  deliveryAddress,
  deliveryQuote,
  onDelivery,
}   
                   
                    
                             
                       
                                   
                                              
                     
                         
                         
                           
                                                                        
                                  
                         
                                        
                      
                                     
                                                           
                                                          
                             
                      
                                     
                            
                                          
                                      
                                                                              
 ) {
  const [couponInput, setCouponInput] = useState("");
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState               (null);
  const [coinInput, setCoinInput] = useState(redeemCoins > 0 ? String(redeemCoins) : "");
  const [tables, setTables] = useState               ([]);

  const showFulfilment = !dineIn && (dineInEnabled || deliveryEnabled);

  useEffect(() => {
    if (fulfilment !== "dinein" || dineIn || tables.length) return;
    void fetch(`${API}/api/tables/public?outletId=${encodeURIComponent(outletId)}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { tables: [] }))
      .then((r                            ) => setTables(r.tables ?? []))
      .catch(() => undefined);
  }, [fulfilment, dineIn, tables.length, outletId]);

  if (lines.length === 0) return <p style={muted}>Your cart is empty.</p>;

  const t = priced?.totals;
  const subtotalPaise = priced?.totals.subtotal ?? 0;

  const deliveryBlocked = fulfilment === "delivery" && (!deliveryAddress || !deliveryQuote?.serviceable);
  const tableMissing = fulfilment === "dinein" && !dineIn && !tableNumber.trim();
  const continueDisabled = !priced || deliveryBlocked || tableMissing;

  return (
    <>
      <h3 style={panelTitle}>Your order</h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lines.map((line, i) => {
          const item = itemsById.get(line.itemId);
          const pl = priced?.lines[i];
          return (
            <div key={`${line.itemId}-${i}`} style={cartRow}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{item?.name ?? "Item"}</div>
                <div style={{ ...muted, fontSize: 12, margin: 0 }}>
                  {[pl?.variantLabel, ...(pl?.modifiers.map((m) => m.label) ?? [])].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <Stepper value={line.quantity} onChange={(q) => onQty(i, q)} small />
              <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", minWidth: 64, textAlign: "right" }}>
                {pl ? formatINR(pl.lineTotal) : "…"}
              </span>
            </div>
          );
        })}
      </div>

      {capacity?.orderMessage ? <p style={capacityNote}>{capacity.orderMessage}</p> : null}
      {capacity?.deliveryMessage ? <p style={capacityNote}>{capacity.deliveryMessage}</p> : null}

      {showFulfilment ? (
        <>
          <label style={label}>How would you like it?</label>
          <div style={{ display: "flex", gap: 8 }}>
            <ChoiceBtn active={fulfilment === "takeaway"} onClick={() => onFulfilment("takeaway")} emoji="🥡" label="Takeaway" />
            {dineInEnabled ? (
              <ChoiceBtn active={fulfilment === "dinein"} onClick={() => onFulfilment("dinein")} emoji="🍽️" label="At a table" />
            ) : null}
            {deliveryEnabled ? (
              <ChoiceBtn active={fulfilment === "delivery"} onClick={() => onFulfilment("delivery")} emoji="🛵" label="Delivery" />
            ) : null}
          </div>
        </>
      ) : null}

      {fulfilment === "dinein" && !dineIn ? (
        <>
          <label style={label}>Your table number</label>
          <p style={{ ...muted, marginTop: -4 }}>It&apos;s printed on the table.</p>
          {tables.length ? (
            <div style={tableGrid}>
              {tables.map((tb) => {
                const selected = tableNumber === tb.number;
                return (
                  <button
                    key={tb.number}
                    type="button"
                    disabled={tb.occupied}
                    onClick={() => onTableNumber(tb.number)}
                    title={tb.occupied ? "Someone is already seated here" : `Table ${tb.number}`}
                    style={{
                      ...tableChip,
                      ...(selected ? tableChipActive : {}),
                      opacity: tb.occupied ? 0.4 : 1,
                      cursor: tb.occupied ? "not-allowed" : "pointer",
                    }}
                  >
                    {tb.number}
                  </button>
                );
              })}
            </div>
          ) : (
            <input
              style={input}
              value={tableNumber}
              onChange={(e) => onTableNumber(e.target.value)}
              placeholder="e.g. 7"
              inputMode="numeric"
            />
          )}
        </>
      ) : null}

      {fulfilment === "delivery" ? (
        <>
          <label style={label}>Deliver to</label>
          <p style={{ ...muted, marginTop: -4, fontSize: 12 }}>Delivery orders are paid online.</p>
          <AddressPicker outletId={outletId} subtotal={subtotalPaise} onChange={onDelivery} />
        </>
      ) : null}

      <label style={label}>Coupon code</label>
      {appliedCoupon ? (
        <div style={couponApplied}>
          <span>
            <strong>{appliedCoupon.code}</strong> applied — {formatINR(appliedCoupon.discount)} off
          </span>
          <button type="button" onClick={onRemoveCoupon} style={couponRemove} aria-label="Remove coupon">
            ×
          </button>
        </div>
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
            style={couponApply}
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
      {couponError ? <p style={{ ...errorText, marginTop: 6 }}>{couponError}</p> : null}

      <label style={label}>Redeem coins</label>
      {redeemCoins > 0 ? (
        <div style={couponApplied}>
          <span>
            <strong>{redeemCoins}</strong> coin{redeemCoins === 1 ? "" : "s"} applied
            {t && t.coinsDiscount > 0 ? ` — ${formatINR(t.coinsDiscount)} off` : ""}
          </span>
          <button
            type="button"
            onClick={() => {
              onRedeemCoins(0);
              setCoinInput("");
            }}
            style={couponRemove}
            aria-label="Remove coins"
          >
            ×
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <input
            style={input}
            type="number"
            min={0}
            inputMode="numeric"
            value={coinInput}
            onChange={(e) => setCoinInput(e.target.value)}
            placeholder="0"
          />
          <button
            type="button"
            style={couponApply}
            disabled={!coinInput || Number(coinInput) <= 0}
            onClick={() => onRedeemCoins(Math.floor(Number(coinInput)))}
          >
            Apply
          </button>
        </div>
      )}
      {coinsError ? <p style={{ ...errorText, marginTop: 6 }}>{coinsError}</p> : null}

      {error ? <p style={errorText}>{error}</p> : null}

      {t ? (
        <dl style={totals}>
          <Row label="Item total" value={formatINR(t.subtotal)} />
          {t.discount > 0 ? (
            <Row label={`Discount${appliedCoupon ? ` (${appliedCoupon.code})` : ""}`} value={`− ${formatINR(t.discount)}`} tone="good" />
          ) : null}
          {t.coinsDiscount > 0 ? <Row label="Coins redeemed" value={`− ${formatINR(t.coinsDiscount)}`} tone="good" /> : null}
          {t.cgst > 0 ? <Row label="CGST" value={formatINR(t.cgst)} /> : null}
          {t.sgst > 0 ? <Row label="SGST" value={formatINR(t.sgst)} /> : null}
          {t.deliveryFee > 0 ? <Row label="Delivery fee" value={formatINR(t.deliveryFee)} /> : null}
          {fulfilment === "delivery" && deliveryQuote?.serviceable && t.deliveryFee === 0 ? (
            <Row label="Delivery" value="Free" tone="good" />
          ) : null}
          {t.roundOff !== 0 ? <Row label="Round off" value={formatINR(t.roundOff)} /> : null}
          <Row label="To pay" value={formatINR(t.grandTotal)} strong />
          {deliveryQuote?.serviceable && fulfilment === "delivery" ? (
            <p style={{ ...muted, fontSize: 11.5, margin: "6px 0 0" }}>
              Estimated delivery in about {deliveryQuote.etaMinutes} minutes.
            </p>
          ) : priced?.pricesIncludeTax ? (
            <p style={{ ...muted, fontSize: 11.5, margin: "6px 0 0" }}>Prices include GST.</p>
          ) : null}
        </dl>
      ) : null}

      <button type="button" style={primaryBtn} disabled={continueDisabled} onClick={onNext}>
        {deliveryBlocked ? "Choose a delivery address" : tableMissing ? "Pick your table" : "Continue"}
      </button>
    </>
  );
}

/* -------------------------------------------------------------- verify step */

function VerifyStep({
  outletId,
  lines,
  gateways,
  dineIn,
  channel,
  tableNumber,
  couponCode,
  redeemCoins,
  deliveryAddress,
  sessionId,
  onSession,
  onBack,
  onPlaced,
}   
                   
                    
                      
                         
                                               
                      
                      
                       
                                          
                           
                                  
                     
                                         
 ) {
  const [destination, setDestination] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState               (null);
  const [gateway, setGateway] = useState         (gateways[0] ?? "cod");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState               (null);
  // Once the OTP is checked / the order is placed, a retry (usually after a
  // payment hiccup) resumes from there instead of re-verifying a consumed code
  // or placing the order twice.
  const [verified, setVerified] = useState(false);
  const [pendingOrder, setPendingOrder] = useState                    (null);

  const isDineIn = channel === "dine-in";
  const cart = { lines, couponCode, redeemCoins: redeemCoins || undefined };

  const run = async (fn                     ) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e         ).message);
    } finally {
      setBusy(false);
    }
  };

  const request = () =>
    run(async () => {
      const r = await api                      ("/api/customer/otp/request", { outletId, destination });
      setSent(true);
      setDevCode(r.devCode ?? null);
    });

  const placeDineIn = async (session        ) => {
    const { order } = await api                        ("/api/orders", {
      outletId,
      cart,
      channel: "dine-in",
      sessionId: session,
      name,
    });
    onPlaced(order);
  };

  const sendToTable = () =>
    run(async () => {
      if (!sessionId) throw new Error("Scan the table code again");
      await placeDineIn(sessionId);
    });

  const verifyAndPlace = () =>
    run(async () => {
      if (!verified) {
        await api("/api/customer/otp/verify", { outletId, destination, code, name });
        setVerified(true);
      }

      if (dineIn) {
        const r = await api                             (`/api/tables/scan/${dineIn.tableId}/session`, {
          token: dineIn.token,
        });
        onSession(r.session.id);
        await placeDineIn(r.session.id);
        return;
      }

      if (isDineIn) {
        if (!tableNumber.trim()) throw new Error("Enter your table number");
        const r = await api                             ("/api/tables/claim", {
          outletId,
          tableNumber: tableNumber.trim(),
        });
        onSession(r.session.id);
        await placeDineIn(r.session.id);
        return;
      }

      // Place the order once; a payment retry reuses it rather than duplicating.
      let order = pendingOrder;
      if (!order) {
        const res = await api                        ("/api/orders", {
          outletId,
          cart,
          channel,
          name,
          gateway,
          deliveryAddress: channel === "delivery" ? deliveryAddress : undefined,
        });
        order = res.order;
        setPendingOrder(order);
      }

      if (gateway !== "cod") await payOnline(outletId, order.id, gateway);
      onPlaced(order);
    });

  if (dineIn && sessionId) {
    return (
      <>
        <h3 style={panelTitle}>Send to Table {dineIn.tableNumber}</h3>
        <p style={muted}>This joins your running tab. Settle everything together at the end.</p>
        {error ? <p style={errorText}>{error}</p> : null}
        <button type="button" className="ot-press" style={primaryBtn} disabled={busy} onClick={sendToTable}>
          {busy ? "Sending…" : "Send to kitchen"}
        </button>
        <button type="button" style={linkBtn} onClick={onBack}>
          Back to cart
        </button>
      </>
    );
  }

  const showPay = channel === "takeaway" || channel === "delivery";

  return (
    <>
      <h3 style={panelTitle}>{dineIn ? `Verify to order at Table ${dineIn.tableNumber}` : "Almost there"}</h3>
      <p style={muted}>We need a verified mobile or email before placing an order.</p>

      <label style={label}>Mobile or email</label>
      <input
        style={input}
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
        placeholder="9810000000"
        disabled={sent}
        autoFocus
      />

      <label style={label}>Your name</label>
      <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />

      {showPay && gateways.length > 1 ? (
        <>
          <label style={label}>How would you like to pay?</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {gateways.map((g) => (
              <label key={g} style={payOption}>
                <input type="radio" name="gateway" checked={gateway === g} onChange={() => setGateway(g)} />
                <span>{GATEWAY_LABELS[g]}</span>
              </label>
            ))}
          </div>
        </>
      ) : null}

      {sent ? (
        <>
          <label style={label}>6-digit code</label>
          <input style={input} value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} />
          {devCode ? (
            <p style={{ ...muted, fontSize: 12 }}>
              No SMS provider configured yet — dev code: <strong>{devCode}</strong>
            </p>
          ) : null}
        </>
      ) : null}

      {pendingOrder && error ? (
        <p style={{ ...muted, fontSize: 12, margin: "12px 0 0" }}>
          Order #{pendingOrder.orderNumber} is saved but not paid yet. Tap below to try the payment again.
        </p>
      ) : null}
      {error ? <p style={errorText}>{error}</p> : null}

      <button
        type="button"
        style={primaryBtn}
        disabled={busy || (sent ? code.length < 4 : destination.length < 5)}
        onClick={sent ? verifyAndPlace : request}
      >
        {busy
          ? "Please wait…"
          : !sent
            ? "Send code"
            : isDineIn
              ? "Verify & send to kitchen"
              : pendingOrder
                ? "Try payment again"
                : gateway === "cod"
                  ? "Verify & place order"
                  : "Verify & pay"}
      </button>
      <button type="button" style={linkBtn} onClick={onBack}>
        Back to cart
      </button>
    </>
  );
}

/* --------------------------------------------------------------- done step */

function DoneStep({
  order,
  onClose,
  dineIn,
  tab,
  channel,
}   
                     
                      
                         
                     
                                               
 ) {
  return (
    <div className="ot-anim-pop" style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{ fontSize: 40, lineHeight: 1 }}>✓</div>
      <h3 style={{ ...panelTitle, marginTop: 12 }}>Order #{order.orderNumber} placed</h3>
      <p style={muted}>
        {dineIn || channel === "dine-in"
          ? `Sent to the kitchen${dineIn ? ` for Table ${dineIn.tableNumber}` : ""}.`
          : channel === "delivery"
            ? `${formatINR(order.totals.grandTotal)} — on its way.${order.etaMinutes ? ` About ${order.etaMinutes} minutes.` : ""}`
            : `${formatINR(order.totals.grandTotal)} — the kitchen has it.${order.etaMinutes ? ` Ready in about ${order.etaMinutes} minutes.` : ""}`}
      </p>
      {(dineIn || channel === "dine-in") && tab !== null ? (
        <p style={{ ...muted, fontWeight: 600, color: "var(--color-text)" }}>Running tab: {formatINR(tab)}</p>
      ) : null}
      <button type="button" style={primaryBtn} onClick={onClose}>
        Done
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- payments */

async function payOnline(outletId        , orderId        , gateway         )                {
  const intent = await api                                                              ("/api/payments/intent", {
    outletId,
    orderId,
  });
  const cp = intent.clientParams;

  if (gateway === "mock") {
    await api("/api/payments/verify", {
      outletId,
      paymentId: intent.paymentId,
      payload: { payment_id: String(cp.payment_id), signature: String(cp.signature) },
    });
    return;
  }

  if (gateway === "razorpay") {
    await loadScript("https://checkout.razorpay.com/v1/checkout.js");
    if (!window.Razorpay) throw new Error("Could not load the payment window");

    await new Promise      ((resolve, reject) => {
      const rzp = new window.Razorpay ({
        ...cp,
        name: "Order payment",
        handler: (res                        ) => {
          api("/api/payments/verify", { outletId, paymentId: intent.paymentId, payload: res })
            .then(() => resolve())
            .catch(reject);
        },
        modal: { ondismiss: () => reject(new Error("Payment was cancelled")) },
      });
      rzp.open();
    });
    return;
  }

  throw new Error(`${gateway} checkout isn't wired up yet`);
}

function loadScript(src        )                {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const el = document.createElement("script");
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("Could not load the payment script"));
    document.body.appendChild(el);
  });
}

/* ------------------------------------------------------------------- pieces */

function Panel({ children, onClose }                                                    ) {
  const [active, setActive] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, []);

  useEffect(() => {
    const frameId = requestAnimationFrame(() => setActive(true));
    return () => cancelAnimationFrame(frameId);
  }, []);

  const handleClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => {
      onClose();
    }, 220);
  }, [closing, onClose]);

  const isOpen = active && !closing;

  return (
    <div
      style={{
        ...overlay,
        opacity: isOpen ? 1 : 0,
        transition: "opacity 220ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      onClick={handleClose}
      role="presentation"
    >
      <aside
        style={{
          ...panel,
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? "scale(1) translateY(0)" : "scale(0.95) translateY(12px)",
          transition:
            "opacity 220ms cubic-bezier(0.16, 1, 0.3, 1), transform 220ms cubic-bezier(0.16, 1, 0.3, 1)",
          willChange: "opacity, transform",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Your order"
      >
        <button type="button" style={closeBtn} onClick={handleClose} aria-label="Close">
          ×
        </button>
        {children}
      </aside>
    </div>
  );
}

function ChoiceBtn({ active, onClick, emoji, label: l }                                                                        ) {
  return (
    <button type="button" onClick={onClick} style={{ ...choiceBtn, ...(active ? choiceBtnActive : {}) }}>
      <span style={{ fontSize: 18 }}>{emoji}</span>
      {l}
    </button>
  );
}

function Stepper({ value, onChange, small }                                                                   ) {
  const size = small ? 26 : 34;
  const btn                = {
    width: size,
    height: size,
    border: "1px solid var(--color-border)",
    background: "var(--color-bg)",
    color: "var(--color-text)",
    borderRadius: 7,
    cursor: "pointer",
    font: "inherit",
    fontSize: small ? 14 : 16,
    lineHeight: 1,
  };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <button type="button" style={btn} onClick={() => onChange(value - 1)} aria-label="One fewer">
        −
      </button>
      <span style={{ minWidth: 18, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{value}</span>
      <button type="button" style={btn} onClick={() => onChange(value + 1)} aria-label="One more">
        +
      </button>
    </span>
  );
}

function Row({ label: l, value, strong, tone }                                                                   ) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontWeight: strong ? 700 : 400,
        fontSize: strong ? 15 : 13.5,
        color: tone === "good" ? "var(--tone-success)" : undefined,
      }}
    >
      <dt>{l}</dt>
      <dd style={{ margin: 0, fontVariantNumeric: "tabular-nums" }}>{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------- styles */

const overlay                = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "grid",
  placeItems: "center",
  padding: 16,
  zIndex: 50,
  backdropFilter: "blur(4px)",
  WebkitBackdropFilter: "blur(4px)",
};
const modal                = {
  background: "var(--color-bg)",
  color: "var(--color-text)",
  border: "1px solid var(--color-border)",
  borderRadius: 14,
  padding: 22,
  width: "100%",
  maxWidth: 420,
  maxHeight: "88vh",
  overflowY: "auto",
  boxShadow:
    "0 24px 54px -12px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(0, 0, 0, 0.08), 0 10px 24px -5px rgba(0, 0, 0, 0.25)",
};
const popupImageWrap                = {
  margin: "-22px -22px 16px",
  borderRadius: "14px 14px 0 0",
  overflow: "hidden",
};
const panel                = { ...modal, maxWidth: 460, position: "relative" };
const panelTitle                = { margin: "0 0 8px", fontFamily: "var(--font-heading)", fontSize: 19 };
const muted                = { color: "var(--color-text-muted)", fontSize: 13.5, margin: "0 0 12px", lineHeight: 1.5 };
const fieldset                = { border: "none", padding: 0, margin: "16px 0 0" };
const legend                = { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)", padding: 0 };
const choice                = { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", fontSize: 14, cursor: "pointer" };
const cartRow                = { display: "flex", alignItems: "center", gap: 10, paddingBottom: 10, borderBottom: "1px solid var(--color-border)" };
const totals                = { margin: "18px 0", display: "flex", flexDirection: "column", gap: 6, paddingTop: 14, borderTop: "1px solid var(--color-border)" };
const primaryBtn                = {
  width: "100%",
  marginTop: 16,
  font: "inherit",
  fontWeight: 600,
  fontSize: 15,
  padding: "12px 18px",
  borderRadius: "var(--radius-card)",
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  border: "none",
  cursor: "pointer",
};
const linkBtn                = {
  width: "100%",
  marginTop: 8,
  font: "inherit",
  fontSize: 13.5,
  padding: 8,
  background: "none",
  border: "none",
  color: "var(--color-text-muted)",
  cursor: "pointer",
};
const closeBtn                = {
  position: "absolute",
  top: 10,
  right: 12,
  width: 30,
  height: 30,
  border: "none",
  background: "none",
  color: "var(--color-text-muted)",
  fontSize: 22,
  cursor: "pointer",
  lineHeight: 1,
};
const cartBar                = {
  position: "fixed",
  left: "50%",
  bottom: 20,
  transform: "translateX(-50%)",
  zIndex: 40,
  display: "flex",
  alignItems: "center",
  gap: 20,
  font: "inherit",
  fontWeight: 600,
  fontSize: 14,
  padding: "13px 22px",
  borderRadius: 999,
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  border: "none",
  cursor: "pointer",
  boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
};
const label                = { display: "block", fontSize: 12.5, fontWeight: 600, marginTop: 14, marginBottom: 5 };
const input                = {
  width: "100%",
  font: "inherit",
  fontSize: 15,
  padding: "10px 12px",
  borderRadius: 9,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
};
const tableBanner                = {
  maxWidth: 1080,
  margin: "0 auto 16px",
  padding: "10px 24px",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  fontSize: 13.5,
  color: "var(--color-on-primary)",
  background: "var(--color-primary)",
  borderRadius: "var(--radius-card)",
};
const payOption                = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  border: "1px solid var(--color-border)",
  borderRadius: 9,
  fontSize: 14,
  cursor: "pointer",
};
const errorText                = { color: "#B23B3B", fontSize: 13, margin: "12px 0 0" };
const capacityNote                = {
  fontSize: 12.5,
  lineHeight: 1.5,
  margin: "0 0 12px",
  padding: "9px 12px",
  borderRadius: 10,
  background: "color-mix(in srgb, var(--tone-warning, #B27B1A) 14%, var(--color-surface))",
  color: "var(--color-text)",
};
const choiceBtn                = {
  font: "inherit",
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 4,
  padding: "12px 10px",
  borderRadius: "var(--radius-card)",
  // Long-hand border props so the active state can override just the colour
  // without React fighting a `border` shorthand on the other render.
  borderWidth: 1.5,
  borderStyle: "solid",
  borderColor: "var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
};
const choiceBtnActive                = {
  borderColor: "var(--color-primary)",
  background: "color-mix(in srgb, var(--color-primary) 10%, var(--color-bg))",
  color: "var(--color-primary)",
};
const tableGrid                = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))",
  gap: 7,
  marginBottom: 12,
};
const tableChip                = {
  font: "inherit",
  fontSize: "0.9rem",
  fontWeight: 700,
  padding: "11px 4px",
  borderRadius: 10,
  borderWidth: 1.5,
  borderStyle: "solid",
  borderColor: "var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
};
const tableChipActive                = {
  borderColor: "var(--color-primary)",
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
};
const couponApply                = {
  font: "inherit",
  fontSize: 13,
  fontWeight: 600,
  padding: "0 16px",
  borderRadius: 9,
  border: "1px solid var(--color-primary)",
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  cursor: "pointer",
  flexShrink: 0,
};
const couponApplied                = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "9px 12px",
  borderRadius: 9,
  background: "var(--tone-success-wash)",
  color: "var(--tone-success)",
  fontSize: 13,
};
const couponRemove                = {
  border: "none",
  background: "none",
  color: "inherit",
  fontSize: 18,
  lineHeight: 1,
  cursor: "pointer",
  padding: 0,
};
