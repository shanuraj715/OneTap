import { useMemo, useState } from "react";
import { comboDetails, describeWindows, formatINR, WEEKDAY_SHORT } from "@onetap/config-schema";
import { Plus, X } from "lucide-react";
import { Field, TextInput } from "../../ui";

/*
 * The extra parts of a dish (and a category) in the menu editor: counted stock, the hours it can be ordered, what a
 * combo is made of, and what goes well with it. Each is a small controlled editor — the form owns the value.
 */

const section = { borderTop: "1px solid var(--color-border)", margin: "6px 0 14px", paddingTop: 14 };
const heading = { fontSize: 13, fontWeight: 600, marginBottom: 3 };
const hint = { fontSize: 12, color: "var(--color-text-muted)", marginBottom: 10, lineHeight: 1.5 };
const selectStyle = { font: "inherit", fontSize: 13.5, padding: "8px 10px", borderRadius: 9, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)" };
const smallBtn = { display: "inline-flex", alignItems: "center", gap: 5, font: "inherit", fontSize: 12.5, fontWeight: 600, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)", cursor: "pointer" };
const xBtn = { display: "inline-grid", placeItems: "center", width: 28, height: 28, borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-muted)", cursor: "pointer" };

/* ------------------------------------------------------------------ stock */

export function StockEditor({ value, onChange }) {
  const on = Boolean(value?.tracked);
  const set = (patch) => onChange({ tracked: true, left: 0, daily: null, lowAt: 5, ...value, ...patch });
  return (
    <div style={section} data-testid="item-stock">
      <div style={heading}>Stock</div>
      <div style={hint}>Count how many are left: every order takes some, a cancelled one gives them back, and at 0 the dish shows “Sold out”. Leave it off for dishes you never run out of.</div>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, marginBottom: on ? 10 : 0 }}>
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked ? { tracked: true, left: value?.left ?? 0, daily: value?.daily ?? null, lowAt: value?.lowAt ?? 5 } : null)} data-testid="item-stock-on" />
        Count stock for this dish
      </label>
      {on ? (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Field label="In stock now" style={{ maxWidth: 150 }}>
            <TextInput type="number" min={0} value={value.left} onChange={(e) => set({ left: Math.max(0, Math.round(Number(e.target.value) || 0)) })} aria-label="In stock now" data-testid="item-stock-left" />
          </Field>
          <Field label="Refill every morning to" hint="Empty = don't refill" info="For dishes made in a fixed batch each day (50 plates of biryani). The count goes back to this number at the start of each day, India time." style={{ maxWidth: 190 }}>
            <TextInput type="number" min={0} value={value.daily ?? ""} placeholder="—" onChange={(e) => set({ daily: e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value) || 0)) })} aria-label="Refill every morning to" />
          </Field>
          <Field label="Say “only N left” from" style={{ maxWidth: 170 }}>
            <TextInput type="number" min={0} max={1000} value={value.lowAt ?? 5} onChange={(e) => set({ lowAt: Math.max(0, Math.round(Number(e.target.value) || 0)) })} aria-label="Low stock from" />
          </Field>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ hours */

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

/**
 * When something can be ordered. `null` = no hours of its own (`inheritLabel` says what applies then). Up to six time
 * windows, each with its days ("Breakfast 08:00–11:00 every day", "Thali 12:00–15:30 Mon–Fri").
 */
export function HoursEditor({ value, onChange, inheritLabel, testId = "hours-editor" }) {
  const windows = value?.windows ?? [];
  const own = windows.length > 0;
  const setWindow = (i, patch) => onChange({ windows: windows.map((w, n) => (n === i ? { ...w, ...patch } : w)) });
  return (
    <div data-testid={testId}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 13.5 }}>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <input type="radio" checked={!own} onChange={() => onChange(null)} /> {inheritLabel}
        </label>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <input type="radio" checked={own} onChange={() => !own && onChange({ windows: [{ days: EVERY_DAY, from: "08:00", to: "11:00" }] })} data-testid={`${testId}-own`} /> Only at certain times
        </label>
      </div>
      {own ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {windows.map((w, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "8px 10px", border: "1px solid var(--color-border)", borderRadius: 10 }}>
              <span style={{ display: "inline-flex", gap: 3 }} role="group" aria-label="Days">
                {WEEKDAY_SHORT.map((d, dow) => {
                  const onDay = w.days.includes(dow);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={onDay}
                      onClick={() => {
                        const days = onDay ? w.days.filter((x) => x !== dow) : [...w.days, dow].sort((a, b) => a - b);
                        if (days.length) setWindow(i, { days });
                      }}
                      style={{ ...smallBtn, padding: "4px 7px", fontSize: 11.5, background: onDay ? "var(--color-primary)" : "var(--color-surface)", color: onDay ? "var(--color-on-primary)" : "var(--color-text-muted)", borderColor: onDay ? "var(--color-primary)" : "var(--color-border)" }}
                    >
                      {d.slice(0, 2)}
                    </button>
                  );
                })}
              </span>
              <TextInput type="time" value={w.from} onChange={(e) => setWindow(i, { from: e.target.value })} style={{ width: 120 }} aria-label="From" />
              <span style={{ color: "var(--color-text-muted)" }}>to</span>
              <TextInput type="time" value={w.to} onChange={(e) => setWindow(i, { to: e.target.value })} style={{ width: 120 }} aria-label="To" />
              {windows.length > 1 ? (
                <button type="button" style={xBtn} onClick={() => onChange({ windows: windows.filter((_, n) => n !== i) })} aria-label="Remove these hours">
                  <X size={13} />
                </button>
              ) : null}
            </div>
          ))}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            {windows.length < 6 ? (
              <button type="button" style={smallBtn} onClick={() => onChange({ windows: [...windows, { days: EVERY_DAY, from: "18:00", to: "22:00" }] })}>
                <Plus size={13} /> Another time
              </button>
            ) : null}
            <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>Customers see: “Available {describeWindows(windows)}” (India time). A time that ends before it starts runs past midnight.</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ItemHours({ value, onChange }) {
  return (
    <div style={section}>
      <div style={heading}>Hours</div>
      <div style={hint}>When this dish can be ordered — e.g. breakfast dishes only in the morning. Outside its hours it shows its hours instead of a price (or is hidden — Settings → Ratings &amp; suggestions). Staff at the counter can still sell it.</div>
      <HoursEditor value={value} onChange={onChange} inheritLabel="Same as its category" testId="item-hours" />
    </div>
  );
}

/* ------------------------------------------------------------------ combo */

/** A combo: the dishes it is made of (plain dishes only — no combo inside a combo), sold at this dish's own price. */
export function ComboEditor({ menu, itemId, value, onChange, price }) {
  const parts = value?.items ?? [];
  const on = parts.length > 0;
  const itemsById = useMemo(() => new Map(menu.items.map((i) => [i.id, i])), [menu.items]);
  const choices = menu.items.filter((i) => i.id !== itemId && !i.combo).sort((a, b) => a.name.localeCompare(b.name));
  const setPart = (n, patch) => onChange({ items: parts.map((p, i) => (i === n ? { ...p, ...patch } : p)) });
  const details = on ? comboDetails({ combo: { items: parts.filter((p) => p.itemId) }, variants: [], basePrice: price ?? 0 }, itemsById) : null;
  return (
    <div style={section} data-testid="item-combo">
      <div style={heading}>Combo</div>
      <div style={hint}>Sell several dishes together at this dish&apos;s price (“Momos + Chai — ₹149”). The card shows what is inside and what it saves; the kitchen ticket lists each dish, sent to the printer that makes it; a counted dish&apos;s stock goes down.</div>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
        <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked ? { items: [{ itemId: "", variantId: null, quantity: 1 }] } : null)} data-testid="item-combo-on" />
        This dish is a combo
      </label>
      {on ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          {parts.map((p, n) => {
            const it = itemsById.get(p.itemId);
            return (
              <div key={n} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select value={p.itemId} onChange={(e) => setPart(n, { itemId: e.target.value, variantId: null })} style={{ ...selectStyle, flex: "1 1 200px" }} aria-label={`Dish ${n + 1} in the combo`} data-testid="combo-part">
                  <option value="">Choose a dish…</option>
                  {choices.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {it?.variants?.length ? (
                  <select value={p.variantId ?? it.variants[0].id} onChange={(e) => setPart(n, { variantId: e.target.value })} style={selectStyle} aria-label="Size">
                    {it.variants.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select>
                ) : null}
                <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>×</span>
                <TextInput type="number" min={1} max={20} value={p.quantity} onChange={(e) => setPart(n, { quantity: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })} style={{ width: 64 }} aria-label="How many" />
                <button type="button" style={xBtn} onClick={() => onChange(parts.length > 1 ? { items: parts.filter((_, i) => i !== n) } : null)} aria-label="Take this dish out">
                  <X size={13} />
                </button>
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {parts.length < 12 ? (
              <button type="button" style={smallBtn} onClick={() => onChange({ items: [...parts, { itemId: "", variantId: null, quantity: 1 }] })}>
                <Plus size={13} /> Add a dish
              </button>
            ) : null}
            {details && details.separately > 0 ? (
              <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }} data-testid="combo-savings">
                Separately {formatINR(details.separately)} · combo {formatINR(price ?? 0)}
                {details.saves > 0 ? <strong style={{ color: "var(--tone-success)" }}> · saves {formatINR(details.saves)}</strong> : <strong style={{ color: "var(--tone-warning)" }}> · not cheaper than buying them separately</strong>}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------- goes well with */

export function PairsEditor({ menu, itemId, value, onChange }) {
  const [q, setQ] = useState("");
  const chosen = new Set(value);
  const byId = new Map(menu.items.map((i) => [i.id, i]));
  const found = q.trim() ? menu.items.filter((i) => i.id !== itemId && !chosen.has(i.id) && i.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : [];
  return (
    <div style={section} data-testid="item-pairs">
      <div style={heading}>Goes well with</div>
      <div style={hint}>Suggested on the order page to someone with this dish in their cart — a drink with momos, a dessert after a thali. Up to 8, in this order.</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {value.map((id) => (
          <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, padding: "4px 8px", borderRadius: 999, background: "var(--tone-info-wash)", color: "var(--tone-info)", fontWeight: 600 }}>
            {byId.get(id)?.name ?? "A removed dish"}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== id))} style={{ border: "none", background: "none", color: "inherit", cursor: "pointer", padding: 0, display: "inline-flex" }} aria-label={`Don't suggest ${byId.get(id)?.name ?? "it"}`}>
              <X size={12} />
            </button>
          </span>
        ))}
        {!value.length ? <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>None chosen.</span> : null}
      </div>
      {value.length < 8 ? (
        <div style={{ position: "relative", maxWidth: 360 }}>
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a dish to suggest…" aria-label="Search a dish to suggest" />
          {found.length ? (
            <div style={{ position: "absolute", zIndex: 5, top: "100%", left: 0, right: 0, marginTop: 4, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 10, boxShadow: "0 8px 22px rgba(0,0,0,0.12)", overflow: "hidden" }}>
              {found.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => {
                    onChange([...value, i.id]);
                    setQ("");
                  }}
                  style={{ display: "block", width: "100%", textAlign: "left", font: "inherit", fontSize: 13, padding: "8px 12px", border: "none", background: "none", color: "var(--color-text)", cursor: "pointer" }}
                >
                  {i.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
