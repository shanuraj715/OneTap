"use client";

import { useMemo, useState } from "react";
                                           
import {
  resolveMenuSections,
                
            
                
                  
} from "@onetap/config-schema";
import { getItemCardVariant, gridPropsFor } from "./registry";

const FOOD_LABELS                           = { veg: "Veg", "non-veg": "Non-veg", egg: "Egg" };
const FOOD_ORDER             = ["veg", "egg", "non-veg"];

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
}   
             
                     
                                                                    
                                          
 ) {
  const [foodFilter, setFoodFilter] = useState                 (null);
  // Which collapsible sections the diner has expanded, by section id.
  const [expanded, setExpanded] = useState({});

  const sections = useMemo(() => resolveMenuSections(menu, layout), [menu, layout]);

  const visibleSections = useMemo(() => {
    if (!foodFilter) return sections;
    return sections
      .map((s) => ({ ...s, items: s.items.filter((i) => i.foodType === foodFilter) }))
      .filter((s) => s.items.length > 0);
  }, [sections, foodFilter]);

  const foodTypesPresent = useMemo(() => {
    const set = new Set          ();
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
        const gridProps = gridPropsFor(variant, section.columns);

        // "View all" — collapsible sections show only the first `initialItems`
        // until the diner opens them, so a long category doesn't push the whole
        // menu down three screens.
        const isOpen = expanded[section.id] === true;
        const collapsed = section.collapsible && !isOpen;
        const shownItems = collapsed ? section.items.slice(0, section.initialItems) : section.items;
        const hiddenCount = section.items.length - section.initialItems;
        const align = section.titleAlign === "center" ? "center" : "left";
        const buttonPlacement = section.viewAllPlacement || "left";
        const isTitleRight = buttonPlacement === "title-right" && !section.hideTitle;

        return (
          <section key={section.id} id={`sec-${section.id}`} style={{ marginBottom: 40, scrollMarginTop: 72 }}>
            {section.hideTitle && !section.subtitle ? null : (
              <div style={{ marginBottom: 14 }}>
                {section.hideTitle ? null : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      paddingBottom: 8,
                      borderBottom: align === "center" && !isTitleRight ? "none" : "1px solid var(--color-border)",
                    }}
                  >
                    <h2
                      style={{
                        ...heading,
                        borderBottom: "none",
                        paddingBottom: 0,
                        textAlign: align,
                        flex: align === "center" ? 1 : undefined,
                        margin: 0,
                      }}
                    >
                      {section.title}
                      {section.showItemCount ? (
                        <span style={countBadge}> ({section.items.length})</span>
                      ) : null}
                    </h2>
                    {isTitleRight && section.collapsible ? (
                      <button
                        type="button"
                        className="ot-press"
                        onClick={() => setExpanded((e) => ({ ...e, [section.id]: !isOpen }))}
                        style={viewAllTitleBtn}
                        aria-expanded={isOpen}
                      >
                        {isOpen
                          ? section.showLessLabel
                          : `${section.viewAllLabel}${hiddenCount > 0 ? ` (${hiddenCount} more)` : ""}`}
                      </button>
                    ) : null}
                  </div>
                )}
                {section.subtitle ? <p style={{ ...subtitle, textAlign: align }}>{section.subtitle}</p> : null}
              </div>
            )}
            <div className={gridProps.className} style={gridProps.style}>
              {shownItems.map((item) =>
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
            {section.collapsible && !isTitleRight ? (
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    buttonPlacement === "center"
                      ? "center"
                      : buttonPlacement === "right" || buttonPlacement === "title-right"
                      ? "flex-end"
                      : "flex-start",
                  marginTop: 16,
                }}
              >
                <button
                  type="button"
                  className="ot-press"
                  onClick={() => setExpanded((e) => ({ ...e, [section.id]: !isOpen }))}
                  style={viewAllBtn}
                  aria-expanded={isOpen}
                >
                  {isOpen
                    ? section.showLessLabel
                    : `${section.viewAllLabel}${hiddenCount > 0 ? ` (${hiddenCount} more)` : ""}`}
                </button>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function FilterChip({ active, onClick, children }                                                                     ) {
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

const wrap                = { maxWidth: 1080, margin: "0 auto", padding: "8px 24px" };
const toolbar                = {
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
const chip                = {
  font: "inherit",
  fontSize: "0.8rem",
  fontWeight: 600,
  padding: "5px 12px",
  borderRadius: 999,
  border: "1px solid var(--color-border)",
  cursor: "pointer",
};
const jumpLink                = {
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "var(--color-text-muted)",
  textDecoration: "none",
  padding: "5px 10px",
  borderRadius: 999,
  border: "1px solid var(--color-border)",
  whiteSpace: "nowrap",
};
const heading                = {
  fontFamily: "var(--font-heading)",
  fontSize: 22,
  fontWeight: 700,
  color: "var(--color-text)",
  margin: 0,
  paddingBottom: 8,
  borderBottom: "1px solid var(--color-border)",
};
const subtitle                = { margin: "6px 0 0", fontSize: 13.5, color: "var(--color-text-muted)" };
const clickable                = { cursor: "pointer", borderRadius: "var(--radius-card)" };
const countBadge                = { fontSize: "0.7em", fontWeight: 500, color: "var(--color-text-muted)" };
const viewAllBtn                = {
  font: "inherit",
  fontSize: "0.85rem",
  fontWeight: 600,
  padding: "9px 20px",
  borderRadius: 999,
  border: "1px solid var(--color-primary)",
  background: "var(--color-bg)",
  color: "var(--color-primary)",
  cursor: "pointer",
};
const viewAllTitleBtn = {
  font: "inherit",
  fontSize: "0.8rem",
  fontWeight: 600,
  padding: "5px 14px",
  borderRadius: 999,
  border: "1px solid var(--color-primary)",
  background: "var(--color-bg)",
  color: "var(--color-primary)",
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
};
