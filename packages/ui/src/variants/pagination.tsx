import type { CSSProperties } from "react";
import type { PaginationProps } from "./types";

const cell: CSSProperties = {
  minWidth: 34,
  height: 34,
  display: "grid",
  placeItems: "center",
  fontSize: "0.85rem",
  fontWeight: 500,
  cursor: "pointer",
  padding: "0 8px",
};
const row: CSSProperties = { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" };
const pages = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

/** 01 numbered, active filled */
export function PaginationNumbered({ page, pages: n }: PaginationProps) {
  return (
    <nav style={row} aria-label="Pagination">
      <span style={{ ...cell, border: "1px solid var(--color-border)", borderRadius: 8 }}>‹</span>
      {pages(n).map((p) => (
        <span key={p} className="ot-press" style={{ ...cell, borderRadius: 8, border: "1px solid var(--color-border)", ...(p === page ? { background: "var(--color-primary)", color: "var(--color-on-primary)", borderColor: "var(--color-primary)" } : {}) }}>
          {p}
        </span>
      ))}
      <span style={{ ...cell, border: "1px solid var(--color-border)", borderRadius: 8 }}>›</span>
    </nav>
  );
}

/** 02 round pills */
export function PaginationPills({ page, pages: n }: PaginationProps) {
  return (
    <nav style={row} aria-label="Pagination">
      {pages(n).map((p) => (
        <span key={p} className="ot-press" style={{ ...cell, borderRadius: 999, background: p === page ? "var(--color-primary)" : "var(--color-surface)", color: p === page ? "var(--color-on-primary)" : "var(--color-text)" }}>
          {p}
        </span>
      ))}
    </nav>
  );
}

/** 03 joined segmented control */
export function PaginationJoined({ page, pages: n }: PaginationProps) {
  return (
    <nav style={{ display: "inline-flex", border: "1px solid var(--color-border)", borderRadius: 8, overflow: "hidden" }} aria-label="Pagination">
      {pages(n).map((p, i) => (
        <span key={p} className="ot-press" style={{ ...cell, borderLeft: i ? "1px solid var(--color-border)" : "none", background: p === page ? "var(--color-primary)" : "transparent", color: p === page ? "var(--color-on-primary)" : "var(--color-text)" }}>
          {p}
        </span>
      ))}
    </nav>
  );
}

/** 04 previous / next with a counter */
export function PaginationPrevNext({ page, pages: n }: PaginationProps) {
  const btn: CSSProperties = { ...cell, padding: "0 16px", border: "1px solid var(--color-border)", borderRadius: 8 };
  return (
    <nav style={{ ...row, justifyContent: "space-between", width: "100%", maxWidth: 340 }} aria-label="Pagination">
      <span style={btn}>← Previous</span>
      <span style={{ fontSize: "0.82rem", color: "var(--color-text-muted)" }}>
        Page {page} of {n}
      </span>
      <span style={btn}>Next →</span>
    </nav>
  );
}

/** 05 underline, active shows a rule */
export function PaginationUnderline({ page, pages: n }: PaginationProps) {
  return (
    <nav style={row} aria-label="Pagination">
      {pages(n).map((p) => (
        <span key={p} className="ot-press" style={{ ...cell, borderRadius: 0, borderBottom: `2px solid ${p === page ? "var(--color-primary)" : "transparent"}`, color: p === page ? "var(--color-text)" : "var(--color-text-muted)" }}>
          {p}
        </span>
      ))}
    </nav>
  );
}

/** 06 dots — good for carousels and short lists */
export function PaginationDots({ page, pages: n }: PaginationProps) {
  return (
    <nav style={{ ...row, gap: 8 }} aria-label="Pagination">
      {pages(n).map((p) => (
        <span key={p} style={{ width: p === page ? 22 : 8, height: 8, borderRadius: 999, background: p === page ? "var(--color-primary)" : "var(--color-border)" }} />
      ))}
    </nav>
  );
}

/** 07 "load more" */
export function PaginationLoadMore({ page, pages: n }: PaginationProps) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", marginBottom: 8 }}>
        Showing page {page} of {n}
      </div>
      <span style={{ ...cell, display: "inline-grid", padding: "0 22px", height: 40, borderRadius: 999, border: "1px solid var(--color-primary)", color: "var(--color-primary)", fontWeight: 600 }}>
        Load more
      </span>
    </div>
  );
}
