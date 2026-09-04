"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  resolveMenuSections,
  type FoodType,
  type Menu,
  type MenuItem,
  type MenuLayout,
} from "@onetap/config-schema";
import { getItemCardVariant } from "./registry";

const FOOD_LABELS: Record<FoodType, string> = { veg: "Veg", "non-veg": "Non-veg", egg: "Egg" };
const FOOD_ORDER: FoodType[] = ["veg", "egg", "non-veg"];

/**
 * The storefront menu, arranged by the outlet's `menuLayout`.
 *
 * Each section renders with its own card variant, so a photo-heavy "picks"
 * strip can sit above a plain printed-list of the full menu. The heavy lifting
 * — which sections, which items, what order — is in `resolveMenuSections`, which
 * the admin preview also calls, so what the owner arranges is what a diner sees.
 */
export function MenuSections({
  menu,
  layout,
  onSelectItem,
}: {
  menu: Menu;
  layout: MenuLayout;
  /** makes every available card clickable (opens the customiser) */
  onSelectItem?: (item: MenuItem) => void;
}) {
  const [foodFilter, setFoodFilter] = useState<FoodType | null>(null);

  const sections = useMemo(() => resolveMenuSections(menu, layout), [menu, layout]);

  const visibleSections = useMemo(() => {
    if (!foodFilter) return sections;
    return sections
      .map((s) => ({ ...s, items: s.items.filter((i) => i.foodType === foodFilter) }))
      .filter((s) => s.items.length > 0);
  }, [sections, foodFilter]);

  const foodTypesPresent = useMemo(() => {
    const set = new Set<FoodType>();
    for (const s of sections) for (const i of s.items) set.add(i.foodType);
    return FOOD_ORDER.filter((t) => set.has(t));
  }, [sections]);

  if (sections.length === 0) {
    return <p style={{ textAlign: "center", color: "var(--color-text-muted)" }}>Menu coming soon.</p>;
  }

  return (
    <div style={wrap}>
      {(layout.showCategoryNav && visibleSections.length > 1) || (layout.showFoodTypeFilter && foodTypesPresent.length > 1) ? (
        <div style={toolbar}>
          {layout.showFoodTypeFilter && foodTypesPresent.length > 1 ? (
            <div style={{ display: "flex", gap: 6 }}>
              <FilterChip active={foodFilter === null} onClick={() => setFoodFilter(null)}>
                All
              </FilterChip>
              {foodTypesPresent.map((t) => (
                <FilterChip key={t} active={foodFilter === t} onClick={() => setFoodFilter(t)}>
                  {FOOD_LABELS[t]}
                </FilterChip>
              ))}
            </div>
          ) : (
            <span />
          )}

          {layout.showCategoryNav && visibleSections.length > 1 ? (
            <nav style={{ display: "flex", gap: 6, flexWrap: "wrap", overflowX: "auto" }}>
              {visibleSections.map((s) => (
                <a key={s.id} href={`#sec-${s.id}`} style={jumpLink}>
                  {s.title}
                </a>
              ))}
            </nav>
          ) : null}
        </div>
      ) : null}

      {visibleSections.map((section) => {
        const variant = getItemCardVariant(section.cardVariant);
        const Card = variant.Component;
        const grid: CSSProperties =
          variant.layout === "list"
            ? { display: "flex", flexDirection: "column", gap: variant.id === "card.menu-line" ? 0 : 12 }
            : {
                display: "grid",
                gridTemplateColumns: `repeat(auto-fill, minmax(${variant.minWidth}px, 1fr))`,
                gap: 12,
              };

        return (
          <section key={section.id} id={`sec-${section.id}`} style={{ marginBottom: 40, scrollMarginTop: 72 }}>
            <div style={{ marginBottom: 14 }}>
              <h2 style={heading}>{section.title}</h2>
              {section.subtitle ? <p style={subtitle}>{section.subtitle}</p> : null}
            </div>
            <div style={grid}>
              {section.items.map((item) =>
                onSelectItem && item.isAvailable ? (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Add ${item.name}`}
                    onClick={() => onSelectItem(item)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectItem(item);
                      }
                    }}
                    style={clickable}
                  >
                    <Card item={item} />
                  </div>
                ) : (
                  <Card key={item.id} item={item} />
                ),
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ot-press"
      style={{
        ...chip,
        background: active ? "var(--color-primary)" : "var(--color-bg)",
        color: active ? "var(--color-on-primary)" : "var(--color-text)",
        borderColor: active ? "var(--color-primary)" : "var(--color-border)",
      }}
    >
      {children}
    </button>
  );
}

const wrap: CSSProperties = { maxWidth: 1080, margin: "0 auto", padding: "8px 24px" };
const toolbar: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  position: "sticky",
  top: 0,
  zIndex: 4,
  padding: "10px 0",
  marginBottom: 12,
  background: "var(--color-bg)",
  borderBottom: "1px solid var(--color-border)",
};
const chip: CSSProperties = {
  font: "inherit",
  fontSize: "0.8rem",
  fontWeight: 600,
  padding: "5px 12px",
  borderRadius: 999,
  border: "1px solid var(--color-border)",
  cursor: "pointer",
};
const jumpLink: CSSProperties = {
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "var(--color-text-muted)",
  textDecoration: "none",
  padding: "5px 10px",
  borderRadius: 999,
  border: "1px solid var(--color-border)",
  whiteSpace: "nowrap",
};
const heading: CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontSize: 22,
  fontWeight: 700,
  color: "var(--color-text)",
  margin: 0,
  paddingBottom: 8,
  borderBottom: "1px solid var(--color-border)",
};
const subtitle: CSSProperties = { margin: "6px 0 0", fontSize: 13.5, color: "var(--color-text-muted)" };
const clickable: CSSProperties = { cursor: "pointer", borderRadius: "var(--radius-card)" };
