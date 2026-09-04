"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { useDismiss } from "../useDismiss";
import type { DropdownProps } from "./types";

const trigger: CSSProperties = {
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
const panel: CSSProperties = {
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
const option: CSSProperties = {
  padding: "8px 10px",
  fontSize: "0.86rem",
  borderRadius: 6,
  cursor: "pointer",
  color: "var(--color-text)",
};

function Shell({
  label,
  options,
  triggerStyle,
  panelStyle,
  optionStyle,
  caret = "⌄",
}: DropdownProps & { triggerStyle?: CSSProperties; panelStyle?: CSSProperties; optionStyle?: CSSProperties; caret?: string }) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState(options[0]);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button type="button" className="ot-press" style={{ ...trigger, ...triggerStyle }} aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{chosen ?? label}</span>
        <span aria-hidden className="ot-chevron" data-open={open} style={{ color: "var(--color-text-muted)" }}>{caret}</span>
      </button>
      {open ? (
        <div className="ot-anim-drop" style={{ ...panel, ...panelStyle }} role="menu">
          {options.map((o) => (
            <div
              key={o}
              role="menuitem"
              tabIndex={0}
              onClick={() => {
                setChosen(o);
                setOpen(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && (setChosen(o), setOpen(false))}
              className="ot-press"
              style={{ ...option, ...optionStyle, ...(o === chosen ? { background: "var(--color-surface)", fontWeight: 600 } : {}) }}
            >
              {o}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** 01 standard menu */
export const DropdownMenu = (p: DropdownProps) => <Shell {...p} />;

/** 02 pill trigger */
export const DropdownPill = (p: DropdownProps) => <Shell {...p} triggerStyle={{ borderRadius: 999, padding: "9px 18px" }} panelStyle={{ borderRadius: 14 }} />;

/** 03 filled trigger in the brand colour */
export const DropdownSolid = (p: DropdownProps) => (
  <Shell {...p} triggerStyle={{ background: "var(--color-primary)", color: "var(--color-on-primary)", borderColor: "var(--color-primary)" }} />
);

/** 04 underline trigger, no box */
export const DropdownUnderline = (p: DropdownProps) => (
  <Shell {...p} triggerStyle={{ border: "none", borderBottom: "1px solid var(--color-border)", borderRadius: 0, padding: "8px 2px", background: "transparent" }} panelStyle={{ borderRadius: 8 }} />
);

/** 05 square, flat panel */
export const DropdownFlat = (p: DropdownProps) => (
  <Shell {...p} triggerStyle={{ borderRadius: 0 }} panelStyle={{ borderRadius: 0, boxShadow: "none", padding: 0 }} optionStyle={{ borderRadius: 0 }} />
);

/** 06 soft tinted */
export const DropdownSoft = (p: DropdownProps) => (
  <Shell
    {...p}
    triggerStyle={{ background: "color-mix(in srgb, var(--color-primary) 12%, transparent)", color: "var(--color-primary)", borderColor: "transparent" }}
    panelStyle={{ borderRadius: 12 }}
  />
);

/** 07 chevron on the right of a wide trigger — form select style */
export const DropdownSelect = (p: DropdownProps) => (
  <Shell {...p} caret="▾" triggerStyle={{ minWidth: 220, justifyContent: "space-between", background: "var(--color-surface)" }} />
);
