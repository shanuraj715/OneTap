"use client";

import { useState } from "react";
                                           
                                                          

/**
 * FAQ sections. Unlike a bare accordion these are page-level blocks — they carry
 * a heading and their own layout, and several show every answer at once.
 */
const heading                = {
  fontFamily: "var(--font-heading)",
  fontWeight: "var(--font-weight-heading)"                     ,
  letterSpacing: "var(--letter-spacing-heading)",
  fontSize: "1.35rem",
  margin: "0 0 16px",
  color: "var(--color-text)",
};
const qStyle                = { fontWeight: 600, fontSize: "0.94rem", color: "var(--color-text)" };
const aStyle                = { fontSize: "0.87rem", color: "var(--color-text-muted)", lineHeight: 1.6 };

/** 01 stacked, all answers visible */
export function FaqStacked({ items }          ) {
  return (
    <section>
      <h2 style={heading}>Frequently asked</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {items.map((it) => (
          <div key={it.q}>
            <div style={qStyle}>{it.q}</div>
            <p style={{ ...aStyle, margin: "5px 0 0" }}>{it.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** 02 two columns */
export function FaqTwoColumn({ items }          ) {
  return (
    <section>
      <h2 style={heading}>Frequently asked</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
        {items.map((it) => (
          <div key={it.q}>
            <div style={qStyle}>{it.q}</div>
            <p style={{ ...aStyle, margin: "5px 0 0" }}>{it.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** 03 heading on the left, questions on the right */
export function FaqSplit({ items }          ) {
  return (
    <section style={{ display: "grid", gridTemplateColumns: "minmax(160px, 1fr) 2fr", gap: 28 }}>
      <div>
        <h2 style={{ ...heading, marginBottom: 6 }}>Frequently asked</h2>
        <p style={aStyle}>Anything else — just call the shop.</p>
      </div>
      <div>
        {items.map((it, i) => (
          <div key={it.q} style={{ padding: "13px 0", borderTop: i ? "1px solid var(--color-border)" : "none" }}>
            <div style={qStyle}>{it.q}</div>
            <p style={{ ...aStyle, margin: "5px 0 0" }}>{it.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** 04 each Q&A in a card */
export function FaqCards({ items }          ) {
  return (
    <section>
      <h2 style={heading}>Frequently asked</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
        {items.map((it) => (
          <div key={it.q} style={{ padding: 16, border: "1px solid var(--color-border)", borderRadius: 10, background: "var(--color-surface)" }}>
            <div style={qStyle}>{it.q}</div>
            <p style={{ ...aStyle, margin: "6px 0 0" }}>{it.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** 05 collapsible, one open at a time */
export function FaqCollapsible({ items }          ) {
  const [open, setOpen] = useState(0);
  return (
    <section>
      <h2 style={heading}>Frequently asked</h2>
      <div style={{ border: "1px solid var(--color-border)", borderRadius: 10, overflow: "hidden" }}>
        {items.map((it, i) => (
          <div key={it.q} style={{ borderTop: i ? "1px solid var(--color-border)" : "none" }}>
            <button
              type="button"
              className="ot-press"
              onClick={() => setOpen(open === i ? -1 : i)}
              aria-expanded={open === i}
              style={{ ...qStyle, font: "inherit", fontWeight: 600, width: "100%", textAlign: "left", padding: "14px 16px", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 12, color: "var(--color-text)" }}
            >
              {it.q}
              <span aria-hidden style={{ color: "var(--color-primary)" }}>{open === i ? "−" : "+"}</span>
            </button>
            <div className="ot-collapse" data-open={open === i}>
              <div>
                <p style={{ ...aStyle, margin: 0, padding: "0 16px 14px" }}>{it.a}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** 06 numbered list */
export function FaqNumbered({ items }          ) {
  return (
    <section>
      <h2 style={heading}>Frequently asked</h2>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 16 }}>
        {items.map((it, i) => (
          <li key={it.q} style={{ display: "flex", gap: 14 }}>
            <span style={{ width: 26, height: 26, flexShrink: 0, borderRadius: "50%", background: "var(--color-primary)", color: "var(--color-on-primary)", display: "grid", placeItems: "center", fontSize: "0.74rem", fontWeight: 700 }}>
              {i + 1}
            </span>
            <span>
              <span style={{ ...qStyle, display: "block" }}>{it.q}</span>
              <p style={{ ...aStyle, margin: "4px 0 0" }}>{it.a}</p>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** 07 centred, narrow measure */
export function FaqCentered({ items }          ) {
  return (
    <section style={{ maxWidth: 620, margin: "0 auto", textAlign: "center" }}>
      <h2 style={{ ...heading, fontSize: "1.6rem" }}>Frequently asked</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {items.map((it) => (
          <div key={it.q}>
            <div style={qStyle}>{it.q}</div>
            <p style={{ ...aStyle, margin: "5px auto 0", maxWidth: "52ch" }}>{it.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
