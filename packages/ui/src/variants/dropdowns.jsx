"use client";

import { useState } from "react";
                                           
import { useDismiss } from "../useDismiss";
                                             

const trigger                = {
  font: "inherit",
  fontSize: "0.87rem",
  fontWeight: 500,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 14px",
  cursor: "pointer",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  borderRadius: 8,
};
const panel                = {
  position: "absolute",
  top: "calc(100% + 6px)",
  left: 0,
  minWidth: 200,
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  boxShadow: "0 10px 28px rgba(0,0,0,0.16)",
  padding: 6,
  zIndex: 20,
};
const option                = {
  padding: "8px 10px",
  fontSize: "0.86rem",
  borderRadius: 6,
  cursor: "pointer",
  color: "var(--color-text)",
};
const optionRow = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 };
const optionDisabled = { opacity: 0.45, cursor: "not-allowed" };
const optionTag = {
  flexShrink: 0,
  fontSize: "0.68rem",
  fontWeight: 700,
  padding: "1px 6px",
  borderRadius: 999,
  background: "var(--tone-danger-wash)",
  color: "var(--tone-danger)",
};

/** A plain string/number option, or a richer `{ value, label, disabled, tag }` one — normalized to the latter either way. */
function normalizeOption(o) {
  return o !== null && typeof o === "object" ? o : { value: o, label: String(o) };
}

/**
 * Uncontrolled by default — exactly its original catalog-only behaviour, an
 * internal `chosen` state seeded from the first option. Passing `value` (even
 * `""`) switches it to controlled, driven entirely by the caller; same for
 * `open`. Both are opt-in additions so every existing call site (the catalog
 * preview included, which passes neither) renders identically to before.
 */
function Shell({
  label,
  options,
  value: valueProp,
  onChange,
  open: openProp,
  onOpenChange,
  fullWidth = false,
  triggerRef,
  triggerStyle,
  panelStyle,
  optionStyle,
  caret = "⌄",
}                                                                                                                           ) {
  const normalized = options.map(normalizeOption);
  const controlled = valueProp !== undefined;
  const [internalChosen, setInternalChosen] = useState(normalized[0]?.value);
  const chosenValue = controlled ? valueProp : internalChosen;
  const chosenOption = normalized.find((o) => o.value === chosenValue);

  const openControlled = openProp !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openControlled ? openProp : internalOpen;
  const setOpen = (v) => (openControlled ? onOpenChange?.(v) : setInternalOpen(v));

  const ref = useDismiss(open, () => setOpen(false));

  const select = (o) => {
    if (o.disabled) return;
    if (controlled) onChange?.(o.value);
    else setInternalChosen(o.value);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: "relative", display: fullWidth ? "block" : "inline-block" }}>
      <button
        ref={triggerRef}
        type="button"
        className="ot-press"
        style={{ ...trigger, ...(fullWidth ? { width: "100%", justifyContent: "space-between" } : {}), ...triggerStyle }}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span>{chosenOption?.label ?? label}</span>
        <span aria-hidden className="ot-chevron" data-open={open} style={{ color: "var(--color-text-muted)" }}>{caret}</span>
      </button>
      {open ? (
        <div className="ot-anim-drop" style={{ ...panel, ...(fullWidth ? { width: "100%", minWidth: 0 } : {}), ...panelStyle }} role="menu">
          {normalized.map((o) => (
            <div
              key={o.value}
              role="menuitem"
              aria-disabled={o.disabled || undefined}
              tabIndex={o.disabled ? -1 : 0}
              onClick={() => select(o)}
              onKeyDown={(e) => e.key === "Enter" && select(o)}
              className={o.disabled ? undefined : "ot-option ot-press"}
              style={{
                ...option,
                ...optionStyle,
                ...(o.value === chosenValue ? { background: "var(--color-surface)", fontWeight: 600 } : {}),
                ...(o.disabled ? optionDisabled : {}),
              }}
            >
              <span style={optionRow}>
                <span>{o.label}</span>
                {o.disabled && o.tag ? <span style={optionTag}>{o.tag}</span> : null}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** 01 standard menu */
export const DropdownMenu = (p               ) => <Shell {...p} />;

/** 02 pill trigger */
export const DropdownPill = (p               ) => <Shell {...p} triggerStyle={{ borderRadius: 999, padding: "9px 18px" }} panelStyle={{ borderRadius: 14 }} />;

/** 03 filled trigger in the brand colour */
export const DropdownSolid = (p               ) => (
  <Shell {...p} triggerStyle={{ background: "var(--color-primary)", color: "var(--color-on-primary)", borderColor: "var(--color-primary)" }} />
);

/** 04 underline trigger, no box */
export const DropdownUnderline = (p               ) => (
  <Shell {...p} triggerStyle={{ border: "none", borderBottom: "1px solid var(--color-border)", borderRadius: 0, padding: "8px 2px", background: "transparent" }} panelStyle={{ borderRadius: 8 }} />
);

/** 05 square, flat panel */
export const DropdownFlat = (p               ) => (
  <Shell {...p} triggerStyle={{ borderRadius: 0 }} panelStyle={{ borderRadius: 0, boxShadow: "none", padding: 0 }} optionStyle={{ borderRadius: 0 }} />
);

/** 06 soft tinted */
export const DropdownSoft = (p               ) => (
  <Shell
    {...p}
    triggerStyle={{ background: "color-mix(in srgb, var(--color-primary) 12%, transparent)", color: "var(--color-primary-text, var(--color-primary))", borderColor: "transparent" }}
    panelStyle={{ borderRadius: 12 }}
  />
);

/** 07 chevron on the right of a wide trigger — form select style */
export const DropdownSelect = (p               ) => (
  <Shell {...p} caret="▾" triggerStyle={{ minWidth: 220, justifyContent: "space-between", background: "var(--color-surface)" }} />
);
