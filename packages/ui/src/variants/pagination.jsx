                                           
                                               

const cell                = {
  minWidth: 34,
  height: 34,
  display: "grid",
  placeItems: "center",
  fontSize: "0.85rem",
  fontWeight: 500,
  cursor: "pointer",
  padding: "0 8px",
};
const row                = { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" };
const pages = (n        ) => Array.from({ length: n }, (_, i) => i + 1);

/** 01 numbered, active filled */
export function PaginationNumbered({ page, pages: n }                 ) {
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
export function PaginationPills({ page, pages: n }                 ) {
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

/**
 * The pages to show for `page` of `n`: all of them when there are few, otherwise the first, the last and the ones around the current
 * page, with "…" where pages are left out — 1 … 4 5 6 … 20.
 */
export function pageWindow(page        , n        )                      {
  if (n <= 7) return pages(n);
  const near = new Set([1, n, page - 1, page, page + 1].filter((p) => p >= 1 && p <= n));
  if (page <= 3) [2, 3, 4].forEach((p) => near.add(p));
  if (page >= n - 2) [n - 3, n - 2, n - 1].forEach((p) => near.add(p));
  const sorted = [...near].sort((a, b) => a - b);
  const out                      = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

/**
 * 03 joined segmented control. With `onChange` it is a real control — each number is a button, the current page is marked
 * (`aria-current="page"`) and long lists collapse to 1 … 4 5 6 … 20; without it, it is the picture shown in the component catalogue.
 */
export function PaginationJoined({ page, pages: n, onChange, label = "Pagination" }                                                                       ) {
  const live = typeof onChange === "function";
  const items = live ? pageWindow(page, n) : pages(n);
  return (
    <nav style={{ display: "inline-flex", border: "1px solid var(--color-border)", borderRadius: 8, overflow: "hidden", background: "var(--color-bg)" }} aria-label={label} data-testid={live ? "pagination" : undefined}>
      {items.map((p, i) => {
        const base                 = { ...cell, borderLeft: i ? "1px solid var(--color-border)" : "none", background: p === page ? "var(--color-primary)" : "transparent", color: p === page ? "var(--color-on-primary)" : "var(--color-text)" };
        if (!live) {
          return (
            <span key={p} className="ot-press" style={base}>
              {p}
            </span>
          );
        }
        if (p === "…") {
          return (
            <span key={`gap${i}`} aria-hidden="true" style={{ ...base, cursor: "default", color: "var(--color-text-muted)" }}>
              …
            </span>
          );
        }
        return (
          <button
            key={p}
            type="button"
            className="ot-press"
            aria-label={`Page ${p}`}
            aria-current={p === page ? "page" : undefined}
            data-page={p}
            onClick={() => p !== page && onChange(p)}
            style={{ ...base, font: "inherit", fontSize: "0.85rem", fontWeight: p === page ? 700 : 500, border: "none", borderLeft: i ? "1px solid var(--color-border)" : "none", cursor: p === page ? "default" : "pointer" }}
          >
            {p}
          </button>
        );
      })}
    </nav>
  );
}

/** 04 previous / next with a counter */
export function PaginationPrevNext({ page, pages: n }                 ) {
  const btn                = { ...cell, padding: "0 16px", border: "1px solid var(--color-border)", borderRadius: 8 };
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
export function PaginationUnderline({ page, pages: n }                 ) {
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
export function PaginationDots({ page, pages: n }                 ) {
  return (
    <nav style={{ ...row, gap: 8 }} aria-label="Pagination">
      {pages(n).map((p) => (
        <span key={p} style={{ width: p === page ? 22 : 8, height: 8, borderRadius: 999, background: p === page ? "var(--color-primary)" : "var(--color-border)" }} />
      ))}
    </nav>
  );
}

/** 07 "load more" */
export function PaginationLoadMore({ page, pages: n }                 ) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", marginBottom: 8 }}>
        Showing page {page} of {n}
      </div>
      <span style={{ ...cell, display: "inline-grid", padding: "0 22px", height: 40, borderRadius: 999, border: "1px solid var(--color-primary)", color: "var(--color-primary-text, var(--color-primary))", fontWeight: 600 }}>
        Load more
      </span>
    </div>
  );
}
