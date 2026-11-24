                                           
import { formatINR, itemPriceLabel,                              } from "@rasoipulse/config-schema";

/**
 * FSSAI veg / non-veg / egg mark. These colours are fixed by regulation and must
 * NOT follow the outlet theme — the only deliberate literals in this package.
 */
export function FoodMark({ type, size = 14 }                                   ) {
  const color = type === "veg" ? "#0E8A3E" : type === "egg" ? "#C79A20" : "#B23B3B";
  const round = type !== "veg";
  const label = type === "veg" ? "Vegetarian" : type === "egg" ? "Contains egg" : "Non-vegetarian";
  // One SVG on a 24-unit grid: the frame and the dot share the same centre (12,12), so the dot can never sit off-centre
  // whatever the size or the browser's rounding.
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ display: "block", flexShrink: 0 }}
    >
      {round ? (
        <circle cx="12" cy="12" r="10.5" fill="#fff" stroke={color} strokeWidth="3" />
      ) : (
        <rect x="1.5" y="1.5" width="21" height="21" rx="4" fill="#fff" stroke={color} strokeWidth="3" />
      )}
      {round ? <circle cx="12" cy="12" r="5.2" fill={color} /> : <rect x="7" y="7" width="10" height="10" rx="1.5" fill={color} />}
    </svg>
  );
}

/**
 * The item photo. When the item has an uploaded image (`src`) it renders that,
 * cover-cropped to the slot the card gives it. With no image it falls back to a
 * deterministic warm gradient keyed off the name, so a menu with photos on some
 * items and not others still looks intentional.
 */
export function Photo({
  name,
  src,
  alt,
  style,
  radius = "var(--radius-card)",
}





 ) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt ?? name}
        loading="lazy"
        decoding="async"
        style={{
          objectFit: "cover",
          display: "block",
          borderRadius: radius,
          flexShrink: 0,
          background: "var(--color-surface)",
          ...style,
        }}
      />
    );
  }

  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const hue = hash % 50; // warm food tones: reds → ambers
  return (
    <div
      aria-hidden
      style={{
        background: `linear-gradient(140deg, hsl(${hue + 8} 62% 62%), hsl(${hue + 34} 70% 48%))`,
        borderRadius: radius,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

export function Tags({ tags, item }) {
  const list = Array.isArray(tags) ? tags : [];
  // a combo (and what it saves) and "only N left" — set on the storefront by menuForNow
  const combo = item?.comboInfo;
  const low = item?.lowStock;
  const hasLow = low !== null && low !== undefined;
  if (!list.length && !combo && !hasLow) return null;
  return (
    <>
      {list.includes("bestseller") ? <span style={tagStyle}>Bestseller</span> : null}
      {list.includes("spicy") ? <span style={{ ...tagStyle, background: "#B23B3B" }}>Spicy</span> : null}
      {combo ? (
        <span style={{ ...tagStyle, background: "#5B3FD9" }} data-testid="tag-combo">
          Combo{combo.saves > 0 ? ` · save ${formatINR(combo.saves)}` : ""}
        </span>
      ) : null}
      {hasLow ? (
        <span style={{ ...tagStyle, background: "#C2410C" }} data-testid="tag-low-stock">
          Only {low} left
        </span>
      ) : null}
    </>
  );
}

export function Price({ item, style, ...rest }) {
  if (!item) return null;
  return (
    <span style={{ ...priceStyle, ...style }} {...rest}>
      {/* "Sold out", or when a dish with hours can be had ("Available 8 AM – 11 AM") */}
      {item.isAvailable ? itemPriceLabel(item) : item.unavailableLabel || "Sold out"}
    </span>
  );
}

export function VariantLine({ item }) {
  if (!item?.variants || !Array.isArray(item.variants) || item.variants.length < 2) return null;
  return (
    <div style={variantLineStyle}>
      {item.variants.map((v) => v.label || v.name).join(" · ")}
    </div>
  );
}

export const cardBase                = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-card)",
  background: "var(--color-surface)",
  overflow: "hidden",
};

export const nameStyle                = {
  fontWeight: 600,
  color: "var(--color-text)",
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  lineHeight: 1.3,
};

/** ONE line of text, then an ellipsis (…) — the rest is cut off, not wrapped onto a second line. */
export const clampOneLine = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  overflowWrap: "anywhere",
};

/** A dish's description on every item card: one line, then an ellipsis. */
export const descStyle                = {
  fontSize: 13,
  color: "var(--color-text-muted)",
  marginTop: 4,
  lineHeight: 1.45,
  ...clampOneLine,
};

export const priceStyle                = {
  fontWeight: 600,
  color: "var(--color-text)",
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

export const variantLineStyle                = {
  fontSize: 12,
  color: "var(--color-text-muted)",
  marginTop: 6,
};

const tagStyle                = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-on-primary)",
  background: "var(--color-primary)",
  padding: "2px 6px",
  borderRadius: 4,
  lineHeight: 1.4,
};

export const addBtn                = {
  font: "inherit",
  fontSize: 13,
  fontWeight: 600,
  padding: "6px 14px",
  borderRadius: "var(--radius-card)",
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  border: "none",
  cursor: "pointer",
};
