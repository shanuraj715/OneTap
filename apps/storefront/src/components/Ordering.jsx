"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatINR, menuLayoutSchema } from "@onetap/config-schema";
import { MenuSections, getCarouselVariant, getVariant, Photo } from "@onetap/ui";
import { api } from "@/lib/clientApi";
import { useCartLines } from "@/lib/useCartLines";
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
}) {
  const { lines, count, addLine } = useCartLines(outletId);
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
    setAddedToast(menu.items.find((i) => i.id === line.itemId)?.name ?? "Item");
  };

  useEffect(() => {
    if (!addedToast) return;
    const t = setTimeout(() => setAddedToast(null), 2400);
    return () => clearTimeout(t);
  }, [addedToast]);

  return (
    <>
      {dineIn ? (
        <div style={tableBannerWrap}>
          <div className="ot-anim-fade" style={tableBanner}>
            <span>
              Ordering to <strong>Table {dineIn.tableNumber}</strong>
            </span>
            {tab !== null && tab > 0 ? <span>Running tab {formatINR(tab)}</span> : null}
          </div>
        </div>
      ) : null}

      <MenuSections menu={menu} layout={layout} onSelectItem={setCustomising} />

      {customising ? (
        <Customiser item={customising} menu={menu} popupCarouselVariant={popupCarouselVariant} onCancel={() => setCustomising(null)} onAdd={addToCart} />
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
        <Link href={orderHref} className="ot-press" style={cartBar}>
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
    const rawImages = item?.images ?? [];
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
    ...modal,
    opacity: isOpen ? 1 : 0,
    transform: isOpen ? "scale(1) translateY(0)" : "scale(0.95) translateY(12px)",
    transition: "opacity 220ms cubic-bezier(0.16, 1, 0.3, 1), transform 220ms cubic-bezier(0.16, 1, 0.3, 1)",
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
  borderRadius: 14,
  padding: 22,
  width: "100%",
  maxWidth: 420,
  maxHeight: "88vh",
  overflowY: "auto",
  boxShadow: "0 24px 54px -12px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(0, 0, 0, 0.08), 0 10px 24px -5px rgba(0, 0, 0, 0.25)",
};
const popupImageWrap = { margin: "-22px -22px 16px", borderRadius: "14px 14px 0 0", overflow: "hidden" };
const muted = { color: "var(--color-text-muted)", fontSize: 13.5, margin: "0 0 12px", lineHeight: 1.5 };
const fieldset = { border: "none", padding: 0, margin: "16px 0 0" };
const legend = { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-muted)", padding: 0 };
const choice = { display: "flex", alignItems: "center", gap: 10, padding: "8px 0", fontSize: 14, cursor: "pointer" };
const primaryBtn = {
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
const linkBtn = {
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
