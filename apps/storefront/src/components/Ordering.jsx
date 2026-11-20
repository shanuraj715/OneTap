"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatINR, itemFromPrice, itemGallery, menuForNow, menuLayoutSchema } from "@onetap/config-schema";
import { FoodMark, MenuSections, fx, getCarouselVariant, getVariant, Photo } from "@onetap/ui";
import { X } from "lucide-react";
import { api } from "@/lib/clientApi";
import { useCartLines } from "@/lib/useCartLines";
import { useCartSync } from "@/lib/useCartSync";
import { useCustomer } from "@/lib/useCustomer";
import { useDineInSession } from "@/lib/useDineInSession";
import { Stepper } from "./Stepper";

/**
 * The menu-browsing surface: item grid, the "add to this item" customiser
 * modal, and the floating cart bar.
 *
 * Everything that used to live behind the cart bar — the itemised order,
 * fulfilment choice, coupon, coins, payment — is a separate page now (see
 * `OrderPage`), reached via `orderHref`. Browsing and adding to cart stays
 * guest-friendly; only checking out asks anyone to sign in, which is what
 * makes the sign-in step land at the moment it's actually needed rather than
 * as a wall in front of the menu.
 */
export function Ordering({
  outletId,
  menu,
  cardVariant,
  menuLayout,
  popupCarouselVariant = "carousel.slider",
  toastVariant = "toast.solid",
  dineIn,
  orderHref,
  hideOutsideHours = false,
  serverNow,
}) {
  const { lines, count, addLine, hydrated } = useCartLines(outletId);
  // a signed-in customer's cart is sent to the store (for its forgotten-cart reminders, when it has them on)
  const { customer } = useCustomer();
  useCartSync(outletId, lines, { enabled: Boolean(customer), hydrated });
  // What can be ordered changes with the clock (breakfast ends at 11) — the menu is looked at again every minute.
  // It starts from the server's "now" so the first paint matches the server's.
  const [now, setNow] = useState(() => serverNow ?? Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const shown = useMemo(() => menuForNow(menu, now, { hideOutsideHours }), [menu, now, hideOutsideHours]);
  const [customising, setCustomising] = useState(null);
  const [addedToast, setAddedToast] = useState(null);
  const [priced, setPriced] = useState(null);
  const { tab } = useDineInSession(dineIn, outletId, null);

  const layout = useMemo(
    () => menuLayout ?? menuLayoutSchema.parse({ mode: "auto", defaultCardVariant: cardVariant ?? "card.row-compact" }),
    [menuLayout, cardVariant],
  );

  // A running total in the cart bar, purely for display — the authoritative
  // price (with whatever fulfilment/coupon/coins the diner picks) is quoted
  // again on the order page itself.
  const reprice = useCallback(() => {
    if (lines.length === 0) {
      setPriced(null);
      return;
    }
    api("/api/orders/quote", { outletId, cart: { lines }, channel: dineIn ? "dine-in" : "takeaway" })
      .then(setPriced)
      .catch(() => setPriced(null));
  }, [lines, outletId, dineIn]);

  useEffect(() => void reprice(), [reprice]);

  const addToCart = (line) => {
    addLine(line);
    setCustomising(null);
    setAddedToast(shown.items.find((i) => i.id === line.itemId)?.name ?? "Item");
  };

  useEffect(() => {
    if (!addedToast) return;
    const t = setTimeout(() => setAddedToast(null), 2400);
    return () => clearTimeout(t);
  }, [addedToast]);

  return (
    <>
      {dineIn ? (
        <div className="ot-page-px" style={tableBannerWrap}>
          <div className="ot-anim-fade" style={tableBanner}>
            <span>
              Ordering to <strong>Table {dineIn.tableNumber}</strong>
            </span>
            {tab !== null && tab > 0 ? <span>Running tab {formatINR(tab)}</span> : null}
          </div>
        </div>
      ) : null}

      <MenuSections menu={shown} layout={layout} onSelectItem={setCustomising} />

      {customising ? (
        <Customiser item={customising} menu={shown} popupCarouselVariant={popupCarouselVariant} onCancel={() => setCustomising(null)} onAdd={addToCart} />
      ) : null}

      {addedToast ? (
        <div style={toastWrap} role="status" aria-live="polite">
          {(() => {
            const Toast = getVariant("toastVariant", toastVariant).Component;
            return <Toast title="Added to cart" message={addedToast} tone="success" />;
          })()}
        </div>
      ) : null}

      {count > 0 ? (
        <Link href={orderHref} className="ot-press ot-fx-btn" style={fx("btn", cartBar)}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
            <span style={{ fontWeight: 700 }}>
              {count} {count === 1 ? "item" : "items"}
            </span>
            <span style={{ opacity: 0.6 }}>·</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{priced ? formatINR(priced.totals.grandTotal) : "…"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, whiteSpace: "nowrap" }}>
            <span>View cart</span>
            <span aria-hidden style={{ fontSize: 16 }}>→</span>
          </div>
        </Link>
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
function ItemImageSection({ item, carouselVariantId }) {
  try {
    // the pop-up's picture is wide: the dish's wide (16:9) picture if it has one, else its square gallery as always
    const rawImages = itemGallery(item, "16:9");
    const imageUrls = rawImages
      .map((img) => (typeof img === "string" ? img : img?.url))
      .filter((url) => typeof url === "string" && url.trim().length > 0);

    if (imageUrls.length === 0) {
      return (
        <div style={popupImageWrap}>
          <Photo name={item?.name ?? "Item"} alt={item?.name ?? "Item"} style={{ width: "100%", aspectRatio: "16 / 9" }} radius={0} />
        </div>
      );
    }

    if (imageUrls.length === 1) {
      return (
        <div style={popupImageWrap}>
          <Photo name={item?.name ?? "Item"} src={imageUrls[0]} alt={item?.name ?? "Item"} style={{ width: "100%", aspectRatio: "16 / 9" }} radius={0} />
        </div>
      );
    }

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
          <Photo name={item?.name ?? "Item"} src={imageUrls[0]} alt={item?.name ?? "Item"} style={{ width: "100%", aspectRatio: "16 / 9" }} radius={0} />
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

function Customiser({ item, menu, popupCarouselVariant, onCancel, onAdd }) {
  const [variantId, setVariantId] = useState(item.variants[0]?.id);
  const [options, setOptions] = useState([]);
  const [quantity, setQuantity] = useState(1);
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

  const handleClose = useCallback(
    (action) => {
      if (closing) return;
      setClosing(true);
      setTimeout(() => {
        action();
      }, 220);
    },
    [closing],
  );

  const handleCancel = useCallback(() => handleClose(onCancel), [handleClose, onCancel]);

  const handleAdd = useCallback((payload) => handleClose(() => onAdd(payload)), [handleClose, onAdd]);

  useEffect(() => {
    const handleKeyDown = (e) => {
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
    ...fx("modal", modal),
    opacity: isOpen ? 1 : 0,
    transform: isOpen ? "scale(1) translateY(0)" : "scale(0.95) translateY(12px)",
    transition: "opacity 220ms cubic-bezier(0.16, 1, 0.3, 1), transform 220ms cubic-bezier(0.16, 1, 0.3, 1)",
    willChange: "opacity, transform",
  };

  return (
    <div style={currentOverlay} onClick={handleCancel} role="presentation">
      <div className="ot-fx-modal" style={currentModal} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={item.name} data-testid="item-modal">
        {/* what scrolls: the picture (set in from the edges, rounded), the name and price, the description, the choices */}
        <div style={modalBody}>
          <div style={{ position: "relative" }}>
            <ItemImageSection item={item} carouselVariantId={popupCarouselVariant} />
            <button type="button" onClick={handleCancel} aria-label="Close" data-testid="item-modal-close" style={closeBtn}>
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div style={titleRow}>
            <h3 style={title}>
              <span style={{ marginTop: 6, display: "inline-flex" }}>
                <FoodMark type={item.foodType} size={16} />
              </span>
              <span>{item.name}</span>
            </h3>
            <span style={fromPrice}>
              {item.variants.length > 1 ? "from " : ""}
              {formatINR(itemFromPrice(item))}
            </span>
          </div>
          {item.description ? <p style={description}>{item.description}</p> : null}

          {item.comboInfo ? (
            <div style={comboBox} data-testid="item-modal-combo">
              <div style={{ ...legend, marginBottom: 6 }}>In this combo</div>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
                {item.comboInfo.parts.map((p) => (
                  <li key={p.itemId} style={{ fontSize: 14 }}>
                    {p.quantity} × {p.name}
                    {p.variantLabel ? <span style={{ color: "var(--color-text-muted)" }}> ({p.variantLabel})</span> : null}
                  </li>
                ))}
              </ul>
              {item.comboInfo.saves > 0 ? (
                <p style={{ margin: "8px 0 0", fontSize: 13, fontWeight: 700, color: "var(--tone-success)" }}>
                  You save {formatINR(item.comboInfo.saves)} (₹{(item.comboInfo.separately / 100).toFixed(0)} separately)
                </p>
              ) : null}
            </div>
          ) : null}

          {item.lowStock !== null && item.lowStock !== undefined ? (
            <p style={lowStockNote} data-testid="item-modal-low-stock">Hurry — only {item.lowStock} left today.</p>
          ) : null}

          {item.variants.length > 0 ? (
            <div role="group" aria-labelledby="item-modal-size" style={section}>
              <div style={sectionHead}>
                <span id="item-modal-size" style={legend}>Choose a size</span>
                <span style={pillRequired}>Required</span>
              </div>
              <div style={tileList}>
                {item.variants.map((v) => {
                  const on = variantId === v.id;
                  return (
                    <label key={v.id} style={{ ...tile, ...(on ? tileOn : null) }}>
                      <input type="radio" name="variant" style={tileInput} checked={on} onChange={() => setVariantId(v.id)} />
                      <span style={{ flex: 1, fontWeight: on ? 700 : 500 }}>{v.label}</span>
                      <span style={{ ...tilePrice, ...(on ? { color: "var(--color-primary)" } : null) }}>{formatINR(v.price)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}

          {groups.map((g) => (
            <div key={g.id} role="group" aria-labelledby={`item-modal-group-${g.id}`} style={section}>
              <div style={sectionHead}>
                <span id={`item-modal-group-${g.id}`} style={legend}>{g.name}</span>
                <span style={pillOptional}>Optional</span>
              </div>
              <div style={tileList}>
                {g.options.map((o) => {
                  const on = options.includes(o.id);
                  return (
                    <label key={o.id} style={{ ...tile, ...(on ? tileOn : null) }}>
                      <input
                        type="checkbox"
                        style={tileInput}
                        checked={on}
                        onChange={(e) => setOptions((prev) => (e.target.checked ? [...prev, o.id] : prev.filter((x) => x !== o.id)))}
                      />
                      <span style={{ flex: 1, fontWeight: on ? 700 : 500 }}>{o.label}</span>
                      <span style={{ ...tilePrice, ...(on ? { color: "var(--color-primary)" } : null) }}>{o.priceDelta ? `+${formatINR(o.priceDelta)}` : "Free"}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* stays at the bottom of the pop-up while the choices scroll */}
        <div style={modalFoot}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* never more than are left of a counted dish */}
            <Stepper value={quantity} onChange={(q) => setQuantity(Math.max(1, Math.min(q, item.stock?.tracked ? Math.max(1, item.stock.left) : 99)))} />
            <button
              type="button"
              className="ot-fx-btn"
              style={{ ...fx("btn", primaryBtn), flex: 1, marginTop: 0 }}
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
    </div>
  );
}

/* ------------------------------------------------------------------- styles */

const overlay = {
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
const modal = {
  background: "var(--color-bg)",
  color: "var(--color-text)",
  border: "1px solid var(--color-border)",
  borderRadius: 22,
  padding: 0,
  width: "100%",
  maxWidth: 440,
  maxHeight: "min(90vh, 820px)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  boxShadow: "0 28px 60px -14px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 0, 0, 0.06), 0 12px 28px -6px rgba(0, 0, 0, 0.28)",
};
// the part that scrolls; the picture sits inside its padding, so it never touches the pop-up's edge
const modalBody = { flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: "16px 18px 6px", overscrollBehavior: "contain" };
const modalFoot = { flex: "0 0 auto", padding: "12px 18px 12px", borderTop: "1px solid var(--color-border)", background: "var(--color-bg)" };
const popupImageWrap = { margin: "0 0 16px", borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 22px -10px rgba(0, 0, 0, 0.45)", background: "var(--color-surface)" };
const closeBtn = {
  position: "absolute",
  top: 10,
  right: 10,
  zIndex: 6,
  width: 34,
  height: 34,
  display: "grid",
  placeItems: "center",
  borderRadius: 999,
  border: "none",
  background: "rgba(255, 255, 255, 0.94)",
  color: "#1a1a1a",
  boxShadow: "0 2px 10px rgba(0, 0, 0, 0.28)",
  cursor: "pointer",
};
const titleRow = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14 };
const title = { margin: 0, display: "flex", gap: 9, alignItems: "flex-start", fontFamily: "var(--font-heading)", fontSize: 22, fontWeight: 800, lineHeight: 1.25, letterSpacing: "-0.01em" };
const fromPrice = { flexShrink: 0, paddingTop: 3, fontSize: 17, fontWeight: 800, color: "var(--color-primary)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const description = { color: "var(--color-text-muted)", fontSize: 14.5, lineHeight: 1.55, margin: "8px 0 0" };
const section = { margin: "20px 0 0" };
const sectionHead = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 };
const legend = { fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--color-text-muted)" };
const pillRequired = { fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "color-mix(in srgb, var(--color-primary) 12%, var(--color-bg))", color: "var(--color-primary)" };
const pillOptional = { fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: "var(--color-surface)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" };
const tileList = { display: "flex", flexDirection: "column", gap: 8 };
const comboBox = { margin: "14px 0 0", padding: "12px 14px", borderRadius: 14, background: "color-mix(in srgb, var(--color-primary) 6%, var(--color-bg))", border: "1px solid var(--color-border)" };
const lowStockNote = { margin: "12px 0 0", fontSize: 13, fontWeight: 700, color: "#C2410C" };
const tile = { display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", fontSize: 14.5, cursor: "pointer", borderRadius: 14, borderWidth: "1.5px", borderStyle: "solid", borderColor: "var(--color-border)", background: "var(--color-bg)", transition: "border-color 140ms, background 140ms" };
const tileOn = { borderColor: "var(--color-primary)", background: "color-mix(in srgb, var(--color-primary) 7%, var(--color-bg))" };
const tileInput = { width: 18, height: 18, margin: 0, flexShrink: 0, accentColor: "var(--color-primary)", cursor: "pointer" };
const tilePrice = { fontVariantNumeric: "tabular-nums", fontWeight: 700, whiteSpace: "nowrap", color: "var(--color-text)" };
const primaryBtn = {
  width: "100%",
  marginTop: 16,
  font: "inherit",
  fontWeight: 700,
  fontSize: 16,
  padding: "14px 18px",
  borderRadius: "var(--radius-card)",
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  border: "none",
  cursor: "pointer",
  boxShadow: "0 8px 20px -8px color-mix(in srgb, var(--color-primary) 70%, transparent)",
};
const linkBtn = {
  width: "100%",
  marginTop: 4,
  font: "inherit",
  fontSize: 13.5,
  padding: 8,
  background: "none",
  border: "none",
  color: "var(--color-text-muted)",
  cursor: "pointer",
};
const cartBar = {
  position: "fixed",
  left: "50%",
  bottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
  transform: "translateX(-50%)",
  zIndex: 40,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  width: "calc(100% - 32px)",
  maxWidth: 420,
  boxSizing: "border-box",
  font: "inherit",
  fontWeight: 600,
  fontSize: 14.5,
  padding: "13px 20px",
  borderRadius: 999,
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  border: "none",
  cursor: "pointer",
  textDecoration: "none",
  boxShadow: "0 8px 30px rgba(0, 0, 0, 0.28), 0 2px 8px rgba(0, 0, 0, 0.12)",
  whiteSpace: "nowrap",
};
const toastWrap = {
  position: "fixed",
  bottom: "calc(20px + env(safe-area-inset-bottom, 0px) + 68px)",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 80,
  paddingInline: 16,
  width: "100%",
  maxWidth: 420,
  boxSizing: "border-box",
  display: "flex",
  justifyContent: "center",
};
const tableBannerWrap = { maxWidth: 1080, margin: "0 auto 16px", padding: "0 16px", boxSizing: "border-box", width: "100%" };
const tableBanner = {
  width: "100%",
  padding: "10px 18px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  fontSize: 13.5,
  color: "var(--color-on-primary)",
  background: "var(--color-primary)",
  borderRadius: "var(--radius-card)",
  boxSizing: "border-box",
};
