"use client";

import { useEffect, useMemo, useRef, useState } from "react";
                                           
import {
  pruneEmptySections,
  resolveMenuSections,
                
            
                
                  
} from "@onetap/config-schema";
import { fx } from "./fx";
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
  // phones and tablets: the categories open in a sheet instead of a wall of chips
  const [sheetOpen, setSheetOpen] = useState(false);
  const toolbarRef = useRef(null);

  /** Go to a category: a short pause (the sheet closes, the tap registers), then an eased glide that stops just below the sticky bar. */
  const sections = useMemo(() => resolveMenuSections(menu, layout), [menu, layout]);

  const visibleSections = useMemo(() => {
    if (!foodFilter) return sections;
    // a parent's heading stays only while something inside it is still shown
    return pruneEmptySections(sections.map((s) => ({ ...s, items: s.items.filter((i) => i.foodType === foodFilter) })));
  }, [sections, foodFilter]);

  // Categories inside categories: the top-level ones are the main chips; the one in view gets a second row of chips
  // for what is inside it.
  const nested = visibleSections.some((s) => (s.depth ?? 0) > 0);
  const rootSections = nested ? visibleSections.filter((s) => (s.depth ?? 0) === 0) : visibleSections;
  const [activeRoot, setActiveRoot] = useState(null);
  const subSections = nested ? visibleSections.filter((s) => s.rootId === activeRoot && (s.depth ?? 0) > 0) : [];

  const goTo = (id) => {
    setSheetOpen(false);
    const target = visibleSections.find((s) => s.id === id);
    if (target) setActiveRoot(target.rootId);
    window.setTimeout(() => glideTo(document.getElementById(`sec-${id}`), toolbarRef.current), 500);
  };

  // which top-level category is in view: the last section whose top has passed just under the sticky bar
  useEffect(() => {
    if (!nested) return undefined;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const line = (toolbarRef.current?.getBoundingClientRect().bottom ?? 0) + 24;
        let current = visibleSections[0]?.rootId ?? null;
        for (const s of visibleSections) {
          const el = document.getElementById(`sec-${s.id}`);
          if (!el) continue;
          if (el.getBoundingClientRect().top <= line) current = s.rootId;
          else break;
        }
        setActiveRoot(current);
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [nested, visibleSections]);

  const foodTypesPresent = useMemo(() => {
    const set = new Set          ();
    for (const s of sections) for (const i of s.items) set.add(i.foodType);
    return FOOD_ORDER.filter((t) => set.has(t));
  }, [sections]);

  if (sections.length === 0) {
    return <p style={{ textAlign: "center", color: "var(--color-text-muted)" }}>Menu coming soon.</p>;
  }

  return (
    <div className="ot-menu-sections" style={wrap}>
      {(layout.showCategoryNav && visibleSections.length > 1) || (layout.showFoodTypeFilter && foodTypesPresent.length > 1) ? (
        <div ref={toolbarRef} className="ot-fx-bar" data-fx-toolbar="" style={toolbarStyle()}>
          {layout.showFoodTypeFilter && foodTypesPresent.length > 1 ? (
            <div style={{ display: "flex", gap: "var(--fx-toolbar-gap, 6px)" }}>
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
            /* No overflow here: the chips wrap anyway, and a scrolling box crops
               whatever it holds at its edges — including the chips' shadows. */
            <>
              {/* desktop: every category as a chip */}
              <nav className="ot-cat-chips" aria-label="Menu categories" style={{ display: "flex", gap: "var(--fx-toolbar-gap, 6px)", flexWrap: "wrap" }}>
                {rootSections.map((s) => (
                  <a
                    key={s.id}
                    href={`#sec-${s.id}`}
                    className="ot-fx-chip"
                    aria-current={nested && s.rootId === activeRoot ? "true" : undefined}
                    style={{ ...fx("chip", jumpLink), ...(nested && s.rootId === activeRoot ? jumpLinkActive : null) }}
                    onClick={(e) => {
                      e.preventDefault();
                      goTo(s.id);
                    }}
                  >
                    {s.imageUrl ? <img src={s.imageUrl} alt="" style={chipPhoto} /> : null}
                    {s.title}
                  </a>
                ))}
              </nav>
              {/* phones and tablets: one button, the list opens in a sheet */}
              <button type="button" className="ot-cat-button ot-press ot-fx-chip" aria-haspopup="dialog" aria-expanded={sheetOpen} onClick={() => setSheetOpen(true)} style={fx("chip", categoriesBtn)}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                  <path d="M4 6h16M7 12h10M10 18h4" />
                </svg>
                Categories
              </button>
              {/* what is inside the top-level category in view */}
              {subSections.length > 0 ? (
                <nav aria-label="Inside this category" style={{ flexBasis: "100%", display: "flex", gap: "var(--fx-toolbar-gap, 6px)", flexWrap: "wrap", paddingTop: 2 }}>
                  {subSections.map((s) => (
                    <a
                      key={s.id}
                      href={`#sec-${s.id}`}
                      className="ot-fx-chip"
                      style={{ ...fx("chip", jumpLink), fontSize: "0.75rem", padding: "3px 10px", marginLeft: (s.depth - 1) * 6 }}
                      onClick={(e) => {
                        e.preventDefault();
                        goTo(s.id);
                      }}
                    >
                      {s.imageUrl ? <img src={s.imageUrl} alt="" style={chipPhoto} /> : null}
                      {s.title}
                    </a>
                  ))}
                </nav>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {sheetOpen ? <CategorySheet sections={visibleSections} onPick={goTo} onClose={() => setSheetOpen(false)} /> : null}

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
        // a category inside another sits a level down: smaller heading, the names above it, set in from the left
        const depth = section.depth ?? 0;
        const Heading = depth === 0 ? "h2" : depth === 1 ? "h3" : "h4";
        const headingEl = (
          <Heading
            style={{
              ...heading,
              ...(depth > 0 ? nestedHeading(depth) : null),
              borderBottom: "none",
              paddingBottom: 0,
              textAlign: align,
              flex: align === "center" && !section.imageUrl ? 1 : undefined,
              margin: 0,
            }}
          >
            {section.title}
            {section.showItemCount ? <span style={countBadge}> ({section.items.length})</span> : null}
          </Heading>
        );

        return (
          <section
            key={section.id}
            id={`sec-${section.id}`}
            data-depth={depth}
            style={{ marginBottom: section.headingOnly ? 14 : depth > 0 ? 30 : 40, marginLeft: depth > 1 ? (depth - 1) * 14 : 0, scrollMarginTop: 72 }}
          >
            {section.hideTitle && !section.subtitle ? null : (
              <div style={{ marginBottom: section.headingOnly ? 0 : 14 }}>
                {depth > 0 && section.trail?.length && !section.hideTitle ? <div style={crumb}>{section.trail.join(" › ")}</div> : null}
                {section.hideTitle ? null : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      paddingBottom: depth > 0 ? 2 : 8,
                      borderBottom: (align === "center" && !isTitleRight) || depth > 0 ? "none" : "1px solid var(--color-border)",
                    }}
                  >
                    {section.imageUrl ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: align === "center" ? 1 : undefined, justifyContent: align === "center" ? "center" : undefined }}>
                        <img src={section.imageUrl} alt="" style={{ ...catPhoto, width: depth === 0 ? 52 : 40, height: depth === 0 ? 52 : 40 }} />
                        {headingEl}
                      </div>
                    ) : (
                      headingEl
                    )}
                    {isTitleRight && section.collapsible ? (
                      <button
                        type="button"
                        className="ot-press ot-fx-chip"
                        onClick={() => setExpanded((e) => ({ ...e, [section.id]: !isOpen }))}
                        style={fx("chip", viewAllTitleBtn)}
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
            {section.headingOnly ? null : (
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
            )}
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
                  className="ot-press ot-fx-chip"
                  onClick={() => setExpanded((e) => ({ ...e, [section.id]: !isOpen }))}
                  style={fx("chip", viewAllBtn)}
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

/** Eased scroll to a section, ending just below the sticky category bar. Reduced motion: straight there. */
function glideTo(el, bar) {
  if (!el) return;
  const offset = (bar?.getBoundingClientRect().height ?? 0) + 12;
  const target = Math.max(0, el.getBoundingClientRect().top + window.scrollY - offset);
  const start = window.scrollY;
  const distance = target - start;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || Math.abs(distance) < 2) {
    window.scrollTo(0, target);
    return;
  }
  // longer trips take a little longer, within limits
  const duration = Math.min(900, Math.max(380, Math.abs(distance) * 0.45));
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const t0 = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - t0) / duration);
    window.scrollTo(0, start + distance * ease(t));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** The category list as a sheet from the bottom of the screen (phones and tablets). */
function CategorySheet({ sections, onPick, onClose }) {
  const first = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    first.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);
  return (
    <div className="ot-cat-sheet" role="presentation" onClick={onClose} style={sheetBackdrop}>
      <div role="dialog" aria-modal="true" aria-label="Menu categories" className="ot-anim-sheet ot-fx-modal" onClick={(e) => e.stopPropagation()} style={fx("modal", sheetPanel)}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 4px 10px" }}>
          <strong style={{ fontSize: 16 }}>Categories</strong>
          <button type="button" aria-label="Close" onClick={onClose} style={sheetClose}>
            ✕
          </button>
        </div>
        <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {sections.map((s, i) => (
            <button key={s.id} ref={i === 0 ? first : undefined} type="button" onClick={() => onPick(s.id)} style={{ ...sheetItem, paddingLeft: 12 + (s.depth ?? 0) * 18, fontWeight: (s.depth ?? 0) === 0 ? 700 : 600 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                {s.imageUrl ? <img src={s.imageUrl} alt="" style={{ ...catPhoto, width: 30, height: 30, borderRadius: 8 }} /> : null}
                {s.title}
              </span>
              {s.headingOnly ? null : <span style={{ fontSize: 13, color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums" }}>{s.items.length}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }                                                                     ) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ot-press ot-fx-chip"
      data-active={active}
      style={fx("chip", {
        ...chip,
        background: active ? "var(--color-primary)" : "var(--color-bg)",
        color: active ? "var(--color-on-primary)" : "var(--color-text)",
        border: `1px solid ${active ? "var(--color-primary)" : "var(--color-border)"}`,
      })}
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
/**
 * The category / food-type strip. It's an "fx bar" like the header, but an
 * effect can restyle just this strip through --fx-toolbar-* — the soft-shadow
 * effects (neumorphism, clay) draw it as a light outlined strip instead of a
 * raised slab. Every fallback is the plain look, so with no effect (or one
 * that doesn't set these) nothing changes.
 */
function toolbarStyle() {
  const bar = fx("bar", toolbar);
  return {
    ...bar,
    background: `var(--fx-toolbar-bg, ${bar.background})`,
    boxShadow: `var(--fx-toolbar-shadow, ${bar.boxShadow})`,
    borderTop: "var(--fx-toolbar-edge, none)",
    borderLeft: "var(--fx-toolbar-edge, none)",
    borderRight: "var(--fx-toolbar-edge, none)",
    borderBottom: `var(--fx-toolbar-edge, ${bar.borderBottom})`,
    borderRadius: "var(--fx-toolbar-radius, 0px)",
    padding: "10px var(--fx-toolbar-pad-x, 0px)",
  };
}

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
const categoriesBtn = {
  font: "inherit",
  fontSize: "0.85rem",
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "7px 14px",
  borderRadius: 999,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
};
const sheetBackdrop = { position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.42)", display: "flex", alignItems: "flex-end", justifyContent: "center" };
const sheetPanel = {
  width: "100%",
  maxWidth: 560,
  maxHeight: "72vh",
  display: "flex",
  flexDirection: "column",
  padding: "14px 14px calc(14px + env(safe-area-inset-bottom))",
  borderRadius: "18px 18px 0 0",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  boxShadow: "0 -8px 30px rgba(0,0,0,0.18)",
};
const sheetClose = { width: 34, height: 34, borderRadius: 999, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", cursor: "pointer", fontSize: 14 };
const sheetItem = {
  font: "inherit",
  fontSize: 15,
  fontWeight: 600,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  minHeight: 48,
  padding: "10px 12px",
  border: 0,
  borderRadius: 10,
  background: "transparent",
  color: "var(--color-text)",
  textAlign: "left",
  cursor: "pointer",
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
/** a category inside another: smaller, set in from the left with a thin bar */
const nestedHeading = (depth) => ({
  fontSize: depth === 1 ? 18 : 16,
  fontWeight: 650,
  paddingLeft: 10,
  borderLeft: `3px solid ${depth === 1 ? "var(--color-primary)" : "var(--color-border)"}`,
});
const crumb = { fontSize: 12, fontWeight: 600, letterSpacing: "0.02em", color: "var(--color-text-muted)", margin: "0 0 4px 13px" };
const catPhoto = { borderRadius: 12, objectFit: "cover", flexShrink: 0, border: "1px solid var(--color-border)", background: "var(--color-surface)" };
const chipPhoto = { width: 18, height: 18, borderRadius: 999, objectFit: "cover", verticalAlign: -4, marginRight: 6 };
const jumpLinkActive = { color: "var(--color-text)", borderColor: "var(--color-primary)", boxShadow: "inset 0 0 0 1px var(--color-primary)" };
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
