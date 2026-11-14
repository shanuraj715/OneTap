import { useEffect, useMemo, useRef, useState } from "react";
import { formatINR, modifierRuleText, modifierSelectionErrors } from "@onetap/config-schema";
import { Check, Minus, Plus, X } from "lucide-react";
import { FoodMark } from "./MenuBrowser";
import { input, label, muted, primaryBtn } from "./styles";

/**
 * Customise one dish: size, add-ons (each group's own rules — "Required ·
 * choose 1", "Choose up to 2"), how many, and a note for the kitchen. A bottom
 * sheet on a phone, a centred dialog on a wider screen.
 */
export function ItemSheet({ item, menu, wide, onAdd, onClose }) {
  const groups = useMemo(
    () => item.modifierGroupIds.map((id) => menu.modifierGroups.find((g) => g.id === id)).filter(Boolean),
    [item, menu],
  );
  const [variantId, setVariantId] = useState(item.variants[0]?.id);
  const [selected, setSelected] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [tried, setTried] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const variant = item.variants.find((v) => v.id === variantId);
  const options = groups.flatMap((g) => g.options).filter((o) => selected.includes(o.id));
  const unit = (variant?.price ?? item.basePrice) + options.reduce((s, o) => s + o.priceDelta, 0);
  const errors = modifierSelectionErrors(groups, selected);

  const toggle = (g, optId) => {
    setSelected((prev) => {
      const inGroup = new Set(g.options.map((o) => o.id));
      if (prev.includes(optId)) return prev.filter((x) => x !== optId);
      // a pick-one group behaves like radio buttons
      if (g.maxSelect === 1) return [...prev.filter((x) => !inGroup.has(x)), optId];
      const count = prev.filter((x) => inGroup.has(x)).length;
      return count >= g.maxSelect ? prev : [...prev, optId];
    });
  };

  const add = () => {
    setTried(true);
    if (errors.length) return;
    onAdd({
      itemId: item.id,
      variantId,
      modifierOptionIds: selected,
      quantity,
      note: note.trim() || undefined,
      // for showing the line before the server prices it
      name: item.name,
      foodType: item.foodType,
      variantLabel: variant?.label,
      modifierLabels: options.map((o) => o.label),
      unitPrice: unit,
    });
  };

  return (
    <div style={overlay} onClick={onClose} role="presentation">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`Customise ${item.name}`}
        className={wide ? "ot-anim-pop" : "ot-anim-sheet"}
        onClick={(e) => e.stopPropagation()}
        style={wide ? dialog : sheet}
      >
        {!wide ? <span style={grabber} aria-hidden /> : null}
        <header style={head}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <FoodMark type={item.foodType} />
              <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, fontFamily: "var(--font-heading)" }}>{item.name}</h3>
            </div>
            {item.description ? <p style={{ ...muted, margin: "4px 0 0", fontSize: 13, lineHeight: 1.45 }}>{item.description}</p> : null}
          </div>
          <button type="button" onClick={onClose} style={closeBtn} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div style={body}>
          {item.variants.length > 0 ? (
            <Group title="Size" rule="Required · choose 1">
              {item.variants.map((v) => (
                <Option key={v.id} active={variantId === v.id} round onClick={() => setVariantId(v.id)} label={v.label} price={formatINR(v.price)} />
              ))}
            </Group>
          ) : null}

          {groups.map((g) => {
            const bad = tried && modifierSelectionErrors([g], selected).length > 0;
            return (
              <Group key={g.id} title={g.name} rule={modifierRuleText(g)} bad={bad}>
                {g.options.map((o) => (
                  <Option
                    key={o.id}
                    active={selected.includes(o.id)}
                    round={g.maxSelect === 1}
                    onClick={() => toggle(g, o.id)}
                    label={o.label}
                    price={o.priceDelta ? `+${formatINR(o.priceDelta)}` : "Free"}
                  />
                ))}
              </Group>
            );
          })}

          <div style={{ marginTop: 18 }}>
            <label style={label} htmlFor="item-note">
              Note for the kitchen
            </label>
            <input id="item-note" value={note} onChange={(e) => setNote(e.target.value.slice(0, 200))} placeholder="e.g. less spicy, no onion" style={input} />
          </div>
        </div>

        <footer style={foot}>
          <span style={qtyBox}>
            <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} style={qtyBtn} aria-label="One less">
              <Minus size={16} />
            </button>
            <span style={{ minWidth: 26, textAlign: "center", fontWeight: 800, fontSize: 17, fontVariantNumeric: "tabular-nums" }} aria-live="polite">
              {quantity}
            </span>
            <button type="button" onClick={() => setQuantity((q) => Math.min(99, q + 1))} style={qtyBtn} aria-label="One more">
              <Plus size={16} />
            </button>
          </span>
          <button type="button" onClick={add} style={{ ...primaryBtn, flex: 1 }}>
            Add · {formatINR(unit * quantity)}
          </button>
        </footer>
        {tried && errors.length ? (
          <p role="alert" style={{ margin: "0 18px 14px", color: "var(--tone-danger)", fontSize: 13, fontWeight: 600 }}>
            {errors.join(" · ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Group({ title, rule, bad, children }) {
  return (
    <fieldset style={{ border: "none", padding: 0, margin: "18px 0 0" }}>
      <legend style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: 0, marginBottom: 10 }}>
        <span style={{ fontWeight: 800, fontSize: 15 }}>{title}</span>
        {rule ? (
          <span style={{ fontSize: 11.5, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: bad ? "var(--tone-danger-wash)" : "var(--color-surface)", color: bad ? "var(--tone-danger)" : "var(--color-text-muted)" }}>
            {rule}
          </span>
        ) : null}
      </legend>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 }}>{children}</div>
    </fieldset>
  );
}

function Option({ active, round, onClick, label: text, price }) {
  return (
    <button
      type="button"
      role={round ? "radio" : "checkbox"}
      aria-checked={active}
      onClick={onClick}
      style={{
        ...option,
        borderColor: active ? "var(--color-primary)" : "var(--color-border)",
        background: active ? "color-mix(in srgb, var(--color-primary) 9%, var(--color-bg))" : "var(--color-bg)",
      }}
    >
      <span
        style={{
          ...mark,
          borderRadius: round ? 99 : 6,
          borderColor: active ? "var(--color-primary)" : "var(--color-border)",
          background: active ? "var(--color-primary)" : "transparent",
        }}
      >
        {active ? <Check size={12} color="var(--color-on-primary)" strokeWidth={3} /> : null}
      </span>
      <span style={{ flex: 1, minWidth: 0, textAlign: "left", fontWeight: 600, fontSize: 14 }}>{text}</span>
      <span style={{ ...muted, fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>{price}</span>
    </button>
  );
}

const overlay = { position: "fixed", inset: 0, zIndex: 85, background: "rgba(16, 12, 10, 0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center" };
const sheetBase = { display: "flex", flexDirection: "column", background: "var(--color-bg)", color: "var(--color-text)", outline: "none", boxShadow: "0 -8px 40px rgba(0,0,0,0.18)" };
const sheet = { ...sheetBase, width: "100%", maxHeight: "92vh", borderRadius: "22px 22px 0 0", paddingBottom: "env(safe-area-inset-bottom)" };
const dialog = { ...sheetBase, width: "min(560px, calc(100vw - 32px))", maxHeight: "86vh", borderRadius: 22, alignSelf: "center" };
const grabber = { alignSelf: "center", width: 40, height: 5, borderRadius: 99, background: "var(--color-border)", marginTop: 8 };
const head = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, padding: "14px 18px 4px" };
const closeBtn = { width: 40, height: 40, borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text-muted)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
const body = { padding: "0 18px 18px", overflowY: "auto", flex: 1 };
const foot = { display: "flex", gap: 12, alignItems: "center", padding: "12px 18px 16px", borderTop: "1px solid var(--color-border)" };
const qtyBox = { display: "inline-flex", alignItems: "center", gap: 4, padding: 4, borderRadius: 14, border: "1px solid var(--color-border)" };
const qtyBtn = { width: 42, height: 42, borderRadius: 11, border: "none", background: "var(--color-surface)", color: "var(--color-text)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" };
const option = { display: "flex", alignItems: "center", gap: 10, minHeight: 50, padding: "8px 12px", borderRadius: 14, borderWidth: 1.5, borderStyle: "solid", font: "inherit", color: "var(--color-text)", cursor: "pointer" };
const mark = { width: 20, height: 20, borderWidth: 1.5, borderStyle: "solid", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };
