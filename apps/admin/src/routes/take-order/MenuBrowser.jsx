import { useMemo, useRef, useState } from "react";
import { activeCategoryIds, flattenCategories, formatINR, itemFromPrice } from "@onetap/config-schema";
import { Minus, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { lineKey } from "./useTakeOrder";
import { chip, chipActive, FOOD_COLOR, input, muted } from "./styles";

/** An item that needs a choice before it can go in the order. */
export const isCustomisable = (item) => item.variants.length > 0 || item.modifierGroupIds.length > 0;

/**
 * Step 2: the menu, built for finding a dish fast while the customer talks —
 * search across everything, or jump to a category. A plain dish adds with one
 * tap and gets a stepper; one with sizes/add-ons opens the customise sheet.
 */
export function MenuBrowser({ menu, lines, onCustomise, onAddPlain, onSetPlainQty }) {
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState(null);
  const sectionRefs = useRef(new Map());

  // every category that is switched on (and has no switched-off category above it), in tree order, with the names above it
  const categories = useMemo(() => {
    const list = menu?.categories ?? [];
    const on = activeCategoryIds(list);
    return flattenCategories(list)
      .filter((e) => on.has(e.category.id))
      .map((e) => ({ ...e.category, label: [...e.trail, e.category.name].join(" › ") }));
  }, [menu]);

  const sections = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const items = (menu?.items ?? []).filter((i) => !needle || i.name.toLowerCase().includes(needle) || i.description?.toLowerCase().includes(needle));
    return categories
      .map((c) => ({
        cat: c,
        // sold-out dishes stay visible (staff get asked for them) but sink to the bottom
        items: items.filter((i) => i.categoryId === c.id).sort((a, b) => Number(b.isAvailable) - Number(a.isAvailable) || a.sortOrder - b.sortOrder),
      }))
      .filter((s) => s.items.length > 0);
  }, [menu, categories, q]);

  const inOrder = useMemo(() => {
    const m = new Map();
    for (const l of lines) m.set(l.itemId, (m.get(l.itemId) ?? 0) + l.quantity);
    return m;
  }, [lines]);

  const jump = (catId) => {
    setActiveCat(catId);
    sectionRefs.current.get(catId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div>
      <div style={toolbar}>
        <label style={{ position: "relative", display: "block" }}>
          <Search size={17} style={searchIcon} aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search the menu…"
            aria-label="Search the menu"
            style={{ ...input, paddingLeft: 40, paddingRight: q ? 40 : 14, background: "var(--color-surface)" }}
          />
          {q ? (
            <button type="button" onClick={() => setQ("")} style={clearBtn} aria-label="Clear search">
              <X size={16} />
            </button>
          ) : null}
        </label>
        {!q && categories.length > 1 ? (
          <div style={chipRow} role="tablist" aria-label="Categories">
            {sections.map(({ cat }) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={activeCat === cat.id}
                onClick={() => jump(cat.id)}
                style={{ ...chip, ...(activeCat === cat.id ? chipActive : {}) }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div style={{ padding: "4px 16px 120px" }}>
        {sections.length === 0 ? (
          <p style={{ ...muted, padding: "24px 4px" }}>{q ? `Nothing on the menu matches “${q}”.` : "The menu is empty."}</p>
        ) : null}
        {sections.map(({ cat, items }) => (
          <section key={cat.id} ref={(el) => el && sectionRefs.current.set(cat.id, el)} style={{ scrollMarginTop: 128, marginTop: 14 }}>
            <h3 style={catHead}>
              {cat.label} <span style={{ ...muted, fontWeight: 500 }}>· {items.length}</span>
            </h3>
            <div style={grid}>
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  count={inOrder.get(item.id) ?? 0}
                  plainQty={lines.find((l) => l.key === lineKey({ itemId: item.id }))?.quantity ?? 0}
                  onCustomise={() => onCustomise(item)}
                  onAddPlain={() => onAddPlain(item)}
                  onSetPlainQty={(n) => onSetPlainQty(item, n)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ItemCard({ item, count, plainQty, onCustomise, onAddPlain, onSetPlainQty }) {
  const custom = isCustomisable(item);
  const soldOut = !item.isAvailable;
  const img = item.images?.[0]?.url;
  const price = itemFromPrice(item);

  return (
    <div style={{ ...card, ...(soldOut ? { opacity: 0.5 } : {}) }}>
      <button
        type="button"
        onClick={soldOut ? undefined : custom ? onCustomise : onAddPlain}
        disabled={soldOut}
        style={cardMain}
        aria-label={soldOut ? `${item.name}, sold out` : custom ? `Customise ${item.name}` : `Add ${item.name}`}
      >
        {img ? <img src={img} alt="" loading="lazy" style={thumb} /> : <span style={{ ...thumb, ...thumbEmpty }}>{item.name.slice(0, 1)}</span>}
        <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
          <span style={nameRow}>
            <FoodMark type={item.foodType} />
            <span style={itemName}>{item.name}</span>
          </span>
          <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
            {item.variants.length > 1 ? "from " : ""}
            {formatINR(price)}
          </span>
          <span style={{ ...muted, fontSize: 12, display: "block", marginTop: 2 }}>
            {soldOut ? "Sold out" : custom ? (count > 0 ? `${count} in order · tap to add another` : variantsHint(item)) : count > 0 ? "In order" : " "}
          </span>
        </span>
      </button>

      {soldOut ? null : custom ? (
        <button type="button" onClick={onCustomise} style={addBtn} aria-label={`Customise ${item.name}`}>
          <SlidersHorizontal size={15} />
          {count > 0 ? <span style={badge}>{count}</span> : null}
        </button>
      ) : plainQty > 0 ? (
        <span style={stepper}>
          <button type="button" onClick={() => onSetPlainQty(plainQty - 1)} style={stepBtn} aria-label={`One less ${item.name}`}>
            <Minus size={15} />
          </button>
          <span style={{ minWidth: 22, textAlign: "center", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{plainQty}</span>
          <button type="button" onClick={() => onSetPlainQty(plainQty + 1)} style={stepBtn} aria-label={`One more ${item.name}`}>
            <Plus size={15} />
          </button>
        </span>
      ) : (
        <button type="button" onClick={onAddPlain} style={addBtn} aria-label={`Add ${item.name}`}>
          <Plus size={18} />
        </button>
      )}
    </div>
  );
}

const variantsHint = (item) =>
  item.variants.length > 0 ? item.variants.map((v) => v.label).join(" / ") : "Add-ons available";

/** The Indian veg / non-veg / egg mark — a square with a dot. */
export function FoodMark({ type }) {
  const c = FOOD_COLOR[type] ?? FOOD_COLOR.veg;
  return (
    <span aria-label={type} title={type} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 14, height: 14, border: `1.5px solid ${c}`, borderRadius: 3, flexShrink: 0 }}>
      <span style={{ width: 6, height: 6, borderRadius: 99, background: c }} />
    </span>
  );
}

const toolbar = {
  position: "sticky",
  top: 0,
  zIndex: 2,
  display: "flex",
  flexDirection: "column",
  gap: 10,
  padding: "12px 16px 10px",
  background: "var(--color-bg)",
  borderBottom: "1px solid var(--color-border)",
};
const searchIcon = { position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)", pointerEvents: "none" };
const clearBtn = { position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, border: "none", background: "transparent", color: "var(--color-text-muted)", cursor: "pointer", borderRadius: 10 };
const chipRow = { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none", margin: "0 -16px", padding: "0 16px 2px" };
const catHead = { margin: "6px 0 10px", fontSize: 15, fontWeight: 800, fontFamily: "var(--font-heading)" };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 };
const card = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: 10,
  borderRadius: 16,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
};
const cardMain = { display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, padding: 0, border: "none", background: "transparent", color: "inherit", font: "inherit", cursor: "pointer" };
const thumb = { width: 60, height: 60, borderRadius: 12, objectFit: "cover", flexShrink: 0, background: "var(--color-surface)" };
const thumbEmpty = { display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "var(--color-text-muted)" };
const nameRow = { display: "flex", alignItems: "center", gap: 7, minWidth: 0 };
const itemName = { fontWeight: 650, fontSize: 14.5, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" };
const addBtn = {
  position: "relative",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 46,
  height: 46,
  borderRadius: 14,
  border: "1.5px solid var(--color-primary)",
  background: "color-mix(in srgb, var(--color-primary) 8%, var(--color-bg))",
  color: "var(--color-primary)",
  cursor: "pointer",
  flexShrink: 0,
};
const badge = { position: "absolute", top: -7, right: -7, minWidth: 20, height: 20, padding: "0 5px", borderRadius: 99, background: "var(--color-primary)", color: "var(--color-on-primary)", fontSize: 11.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" };
const stepper = { display: "inline-flex", alignItems: "center", gap: 4, padding: 3, borderRadius: 14, background: "var(--color-primary)", color: "var(--color-on-primary)", flexShrink: 0 };
const stepBtn = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 11, border: "none", background: "transparent", color: "inherit", cursor: "pointer" };
