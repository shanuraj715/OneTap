                                           
                                              

const title                = { fontWeight: 600, fontSize: "0.9rem", color: "var(--color-text)" };
const meta                = { fontSize: "0.78rem", color: "var(--color-text-muted)" };
const rowBase                = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 };

/** 01 bordered box, divided rows */
export function ListBordered({ items }                ) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, border: "1px solid var(--color-border)", borderRadius: 10, overflow: "hidden" }}>
      {items.map((it, i) => (
        <li key={it.title} style={{ ...rowBase, padding: "12px 14px", borderTop: i ? "1px solid var(--color-border)" : "none", background: "var(--color-bg)" }}>
          <span style={title}>{it.title}</span>
          <span style={meta}>{it.meta}</span>
        </li>
      ))}
    </ul>
  );
}

/** 02 separate cards */
export function ListCards({ items }                ) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((it) => (
        <li key={it.title} style={{ ...rowBase, padding: "13px 15px", borderRadius: 10, background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
          <span style={title}>{it.title}</span>
          <span style={meta}>{it.meta}</span>
        </li>
      ))}
    </ul>
  );
}

/** 03 hairline rules only */
export function ListFlush({ items }                ) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((it, i) => (
        <li key={it.title} style={{ ...rowBase, padding: "12px 0", borderTop: i ? "1px solid var(--color-border)" : "none" }}>
          <span style={title}>{it.title}</span>
          <span style={meta}>{it.meta}</span>
        </li>
      ))}
    </ul>
  );
}

/** 04 numbered */
export function ListNumbered({ items }                ) {
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, counterReset: "lg" }}>
      {items.map((it, i) => (
        <li key={it.title} style={{ ...rowBase, padding: "11px 0", borderTop: i ? "1px solid var(--color-border)" : "none" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 24, height: 24, borderRadius: 6, background: "var(--color-surface)", color: "var(--color-text-muted)", display: "grid", placeItems: "center", fontSize: "0.72rem", fontWeight: 700 }}>
              {i + 1}
            </span>
            <span style={title}>{it.title}</span>
          </span>
          <span style={meta}>{it.meta}</span>
        </li>
      ))}
    </ol>
  );
}

/** 05 leading accent bar per row */
export function ListAccent({ items }                ) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((it) => (
        <li key={it.title} style={{ ...rowBase, padding: "11px 14px", borderLeft: "3px solid var(--color-primary)", background: "var(--color-surface)", borderRadius: "0 8px 8px 0" }}>
          <span style={title}>{it.title}</span>
          <span style={meta}>{it.meta}</span>
        </li>
      ))}
    </ul>
  );
}

/** 06 two lines per row */
export function ListStacked({ items }                ) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, border: "1px solid var(--color-border)", borderRadius: 10, overflow: "hidden" }}>
      {items.map((it, i) => (
        <li key={it.title} style={{ padding: "12px 14px", borderTop: i ? "1px solid var(--color-border)" : "none" }}>
          <div style={title}>{it.title}</div>
          <div style={meta}>{it.meta}</div>
        </li>
      ))}
    </ul>
  );
}

/** 07 striped rows */
export function ListStriped({ items }                ) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, borderRadius: 10, overflow: "hidden", border: "1px solid var(--color-border)" }}>
      {items.map((it, i) => (
        <li key={it.title} style={{ ...rowBase, padding: "11px 14px", background: i % 2 ? "var(--color-surface)" : "var(--color-bg)" }}>
          <span style={title}>{it.title}</span>
          <span style={meta}>{it.meta}</span>
        </li>
      ))}
    </ul>
  );
}

/** 08 with a trailing chevron */
export function ListChevron({ items }                ) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, border: "1px solid var(--color-border)", borderRadius: 10, overflow: "hidden" }}>
      {items.map((it, i) => (
        <li key={it.title} className="ot-press" style={{ ...rowBase, padding: "12px 14px", borderTop: i ? "1px solid var(--color-border)" : "none", cursor: "pointer" }}>
          <span>
            <span style={{ ...title, display: "block" }}>{it.title}</span>
            <span style={meta}>{it.meta}</span>
          </span>
          <span style={{ color: "var(--color-text-muted)" }} aria-hidden>›</span>
        </li>
      ))}
    </ul>
  );
}
