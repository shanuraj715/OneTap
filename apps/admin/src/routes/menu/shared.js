import { useCallback, useState } from "react";

/** A set of ticked rows (categories or items) with the few things a list with checkboxes needs. */
export function useSelection() {
  const [ids, setIds] = useState(() => new Set());
  const toggle = useCallback((id) => setIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }), []);
  const setMany = useCallback((list, on) => setIds((prev) => {
    const next = new Set(prev);
    for (const id of list) {
      if (on) next.add(id);
      else next.delete(id);
    }
    return next;
  }), []);
  const clear = useCallback(() => setIds(new Set()), []);
  const keepOnly = useCallback((valid) => setIds((prev) => {
    const next = new Set([...prev].filter((id) => valid.has(id)));
    return next.size === prev.size ? prev : next;
  }), []);
  return { ids, size: ids.size, has: (id) => ids.has(id), toggle, setMany, clear, keepOnly };
}

/** "Select all" tick for a list: ticked when every row is, "partly" when some are. */
export function selectAllState(all, selection) {
  const n = all.filter((id) => selection.has(id)).length;
  return { checked: all.length > 0 && n === all.length, partly: n > 0 && n < all.length };
}

export const iconBtn = {
  font: "inherit",
  fontSize: 14,
  lineHeight: 1,
  width: 26,
  height: 26,
  display: "inline-grid",
  placeItems: "center",
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  background: "var(--color-bg)",
  color: "var(--color-text-muted)",
  cursor: "pointer",
  flexShrink: 0,
};
export const checkStyle = { accentColor: "var(--color-primary)", width: 15, height: 15, flexShrink: 0, cursor: "pointer" };
export const selectStyle = {
  font: "inherit",
  fontSize: 14,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  width: "100%",
  boxSizing: "border-box",
};
export const bulkBar = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  padding: "8px 12px",
  marginBottom: 10,
  borderRadius: 8,
  border: "1px solid var(--color-primary)",
  background: "color-mix(in srgb, var(--color-primary) 8%, var(--color-bg))",
  fontSize: 13,
};
export const dangerBtn = {
  font: "inherit",
  fontSize: 13,
  fontWeight: 650,
  padding: "6px 12px",
  borderRadius: 8,
  border: "1px solid var(--tone-danger)",
  background: "var(--tone-danger)",
  color: "#fff",
  cursor: "pointer",
};
export const linkBtn = { font: "inherit", fontSize: 13, background: "none", border: 0, padding: 0, color: "var(--color-primary)", cursor: "pointer", textDecoration: "underline" };
