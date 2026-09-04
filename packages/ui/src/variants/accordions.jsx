"use client";

import { useState } from "react";
                                                      
                                              

const q                = {
  font: "inherit",
  fontWeight: 600,
  fontSize: "0.94rem",
  textAlign: "left",
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  cursor: "pointer",
  background: "none",
  border: "none",
  color: "var(--color-text)",
  padding: 0,
};
const a                = { fontSize: "0.87rem", color: "var(--color-text-muted)", lineHeight: 1.55, marginTop: 8 };

/** Shared open/closed behaviour; each variant supplies the chrome. */
function useAccordion(initial = 0, multi = false) {
  const [open, setOpen] = useState          (initial >= 0 ? [initial] : []);
  const isOpen = (i        ) => open.includes(i);
  const toggle = (i        ) =>
    setOpen((prev) => (multi ? (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]) : prev.includes(i) ? [] : [i]));
  return { isOpen, toggle };
}

function Item({
  children,
  question,
  open,
  onToggle,
  marker,
  style,
}   
                      
                   
                
                       
                    
                        
 ) {
  return (
    <div style={style}>
      <button type="button" className="ot-press" style={q} aria-expanded={open} onClick={onToggle}>
        <span>{question}</span>
        {marker}
      </button>
      <div className="ot-collapse" data-open={open}>
        <div>
          <div style={a}>{children}</div>
        </div>
      </div>
    </div>
  );
}

const chevron = (open         ) => (
  <span aria-hidden className="ot-chevron" data-open={open} style={{ color: "var(--color-text-muted)", display: "inline-block" }}>
    ⌄
  </span>
);
const plus = (open         ) => (
  <span aria-hidden style={{ color: "var(--color-primary)", fontSize: "1.2rem", lineHeight: 1 }}>{open ? "−" : "+"}</span>
);

/** 01 bordered box, divided */
export function AccordionBordered({ items }                ) {
  const { isOpen, toggle } = useAccordion();
  return (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: 10, overflow: "hidden" }}>
      {items.map((it, i) => (
        <Item key={it.q} question={it.q} open={isOpen(i)} onToggle={() => toggle(i)} marker={chevron(isOpen(i))}
              style={{ padding: "14px 16px", borderTop: i ? "1px solid var(--color-border)" : "none" }}>
          {it.a}
        </Item>
      ))}
    </div>
  );
}

/** 02 each row a separate card */
export function AccordionCards({ items }                ) {
  const { isOpen, toggle } = useAccordion();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((it, i) => (
        <Item key={it.q} question={it.q} open={isOpen(i)} onToggle={() => toggle(i)} marker={chevron(isOpen(i))}
              style={{ padding: "14px 16px", border: "1px solid var(--color-border)", borderRadius: 10, background: "var(--color-surface)" }}>
          {it.a}
        </Item>
      ))}
    </div>
  );
}

/** 03 hairline rules only */
export function AccordionMinimal({ items }                ) {
  const { isOpen, toggle } = useAccordion();
  return (
    <div>
      {items.map((it, i) => (
        <Item key={it.q} question={it.q} open={isOpen(i)} onToggle={() => toggle(i)} marker={chevron(isOpen(i))}
              style={{ padding: "14px 0", borderTop: i ? "1px solid var(--color-border)" : "none" }}>
          {it.a}
        </Item>
      ))}
    </div>
  );
}

/** 04 plus / minus marker */
export function AccordionPlus({ items }                ) {
  const { isOpen, toggle } = useAccordion();
  return (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: 10, overflow: "hidden" }}>
      {items.map((it, i) => (
        <Item key={it.q} question={it.q} open={isOpen(i)} onToggle={() => toggle(i)} marker={plus(isOpen(i))}
              style={{ padding: "14px 16px", borderTop: i ? "1px solid var(--color-border)" : "none" }}>
          {it.a}
        </Item>
      ))}
    </div>
  );
}

/** 05 open row gets a filled header */
export function AccordionFilled({ items }                ) {
  const { isOpen, toggle } = useAccordion();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((it, i) => (
        <div key={it.q} style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--color-border)" }}>
          <button type="button" onClick={() => toggle(i)} aria-expanded={isOpen(i)} className="ot-press"
                  style={{ ...q, padding: "12px 15px", background: isOpen(i) ? "var(--color-primary)" : "var(--color-surface)", color: isOpen(i) ? "var(--color-on-primary)" : "var(--color-text)" }}>
            <span>{it.q}</span>
            <span aria-hidden>{isOpen(i) ? "−" : "+"}</span>
          </button>
          <div className="ot-collapse" data-open={isOpen(i)}>
            <div>
              <div style={{ ...a, margin: 0, padding: "12px 15px" }}>{it.a}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** 06 left accent bar on the open row */
export function AccordionAccent({ items }                ) {
  const { isOpen, toggle } = useAccordion();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {items.map((it, i) => (
        <Item key={it.q} question={it.q} open={isOpen(i)} onToggle={() => toggle(i)} marker={chevron(isOpen(i))}
              style={{ padding: "13px 16px", borderLeft: `3px solid ${isOpen(i) ? "var(--color-primary)" : "var(--color-border)"}`, background: isOpen(i) ? "var(--color-surface)" : "transparent" }}>
          {it.a}
        </Item>
      ))}
    </div>
  );
}

/** 07 numbered rows */
export function AccordionNumbered({ items }                ) {
  const { isOpen, toggle } = useAccordion();
  return (
    <div>
      {items.map((it, i) => (
        <div key={it.q} style={{ padding: "14px 0", borderTop: i ? "1px solid var(--color-border)" : "none" }}>
          <button type="button" className="ot-press" style={q} aria-expanded={isOpen(i)} onClick={() => toggle(i)}>
            <span style={{ display: "flex", gap: 12 }}>
              <span style={{ color: "var(--color-primary)", fontVariantNumeric: "tabular-nums" }}>{String(i + 1).padStart(2, "0")}</span>
              {it.q}
            </span>
            {chevron(isOpen(i))}
          </button>
          <div className="ot-collapse" data-open={isOpen(i)}>
            <div>
              <div style={{ ...a, marginLeft: 32 }}>{it.a}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** 08 several rows can be open at once */
export function AccordionMulti({ items }                ) {
  const { isOpen, toggle } = useAccordion(0, true);
  return (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: 10, overflow: "hidden" }}>
      {items.map((it, i) => (
        <Item key={it.q} question={it.q} open={isOpen(i)} onToggle={() => toggle(i)} marker={plus(isOpen(i))}
              style={{ padding: "14px 16px", borderTop: i ? "1px solid var(--color-border)" : "none", background: isOpen(i) ? "var(--color-surface)" : "transparent" }}>
          {it.a}
        </Item>
      ))}
    </div>
  );
}
