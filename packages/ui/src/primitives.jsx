                                           
import { itemPriceLabel,                              } from "@onetap/config-schema";

/**
 * FSSAI veg / non-veg / egg mark. These colours are fixed by regulation and must
 * NOT follow the outlet theme — the only deliberate literals in this package.
 */
export function FoodMark({ type, size = 14 }                                   ) {
  const color = type === "veg" ? "#0E8A3E" : type === "egg" ? "#C79A20" : "#B23B3B";
  const round = type !== "veg";
  const label = type === "veg" ? "Vegetarian" : type === "egg" ? "Contains egg" : "Non-vegetarian";
  return (
    <span
      role="img"
      aria-label={label}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        border: `2px solid ${color}`,
        borderRadius: round ? "50%" : Math.round(size / 5),
        display: "grid",
        placeItems: "center",
        background: "#fff",
      }}
    >
      <span
        style={{
          width: size * 0.45,
          height: size * 0.45,
          background: color,
          borderRadius: round ? "50%" : 1,
        }}
      />
    </span>
  );
}

/**
 * Stand-in for the item photo until asset storage lands. Deterministic warm
 * gradient per item name so cards look distinct in layout previews.
 */
export function Photo({
  name,
  style,
  radius = "var(--radius-card)",
}   
               
                        
                           
 ) {
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

export function Tags({ tags }                    ) {
  if (tags.length === 0) return null;
  return (
    <>
      {tags.includes("bestseller") ? <span style={tagStyle}>Bestseller</span> : null}
      {tags.includes("spicy") ? <span style={{ ...tagStyle, background: "#B23B3B" }}>Spicy</span> : null}
    </>
  );
}

export function Price({ item }                    ) {
  return (
    <span style={priceStyle}>{item.isAvailable ? itemPriceLabel(item) : "Sold out"}</span>
  );
}

export function VariantLine({ item }                    ) {
  if (item.variants.length < 2) return null;
  return <div style={variantLineStyle}>{item.variants.map((v) => v.label).join(" · ")}</div>;
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

export const descStyle                = {
  fontSize: 13,
  color: "var(--color-text-muted)",
  marginTop: 4,
  lineHeight: 1.45,
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
