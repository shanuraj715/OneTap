import { useCallback, useEffect, useState } from "react";

/**
 * Everything a half-taken order holds — the table, the items, who it's for —
 * kept in sessionStorage per outlet, so an accidental refresh or a quick look
 * at another page doesn't make a waiter re-take the order at the table.
 */
const EMPTY = {
  tableId: null,
  lines: [],
  phone: "",
  name: "",
  email: "",
  note: "",
  useCoins: false,
  coins: 0,
  /** proof the customer read back their code — tied to the number it was for */
  approval: null,
  approvalPhone: null,
};

const keyFor = (outletId) => `onetap.takeOrder.${outletId}`;

function load(outletId) {
  if (!outletId) return EMPTY;
  try {
    const raw = sessionStorage.getItem(keyFor(outletId));
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function save(outletId, state) {
  if (!outletId) return;
  try {
    sessionStorage.setItem(keyFor(outletId), JSON.stringify(state));
  } catch {
    /* private mode / storage full — the order still works, it just won't survive a refresh */
  }
}

/** Two lines are the same thing (and merge) when item, size, add-ons and note all match. */
export const lineKey = (l) => [l.itemId, l.variantId ?? "", [...(l.modifierOptionIds ?? [])].sort().join("+"), l.note?.trim() ?? ""].join("|");

export function useTakeOrder(outletId) {
  const [state, setState] = useState(() => load(outletId));

  // a different outlet picked in the switcher has its own order in progress
  useEffect(() => setState(load(outletId)), [outletId]);
  useEffect(() => save(outletId, state), [outletId, state]);

  const set = useCallback((patch) => setState((s) => ({ ...s, ...patch })), []);

  /** Picking a table: the customer belongs to the table, so they're cleared — the cart stays. */
  const setTable = useCallback(
    (tableId) => setState((s) => (s.tableId === tableId ? s : { ...s, tableId, phone: "", name: "", email: "", useCoins: false, coins: 0, approval: null, approvalPhone: null })),
    [],
  );

  const addLine = useCallback((line) => {
    setState((s) => {
      const key = lineKey(line);
      const existing = s.lines.find((l) => l.key === key);
      const lines = existing
        ? s.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(99, l.quantity + line.quantity) } : l))
        : [...s.lines, { ...line, key }];
      return { ...s, lines };
    });
  }, []);

  const setQty = useCallback((key, quantity) => {
    setState((s) => ({
      ...s,
      lines: quantity <= 0 ? s.lines.filter((l) => l.key !== key) : s.lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(99, quantity) } : l)),
    }));
  }, []);

  /** After sending: the items are gone, the table (and who's at it) stays for "add more". */
  const clearItems = useCallback(() => setState((s) => ({ ...s, lines: [], note: "", useCoins: false, coins: 0, approval: null, approvalPhone: null })), []);
  const reset = useCallback(() => setState(EMPTY), []);

  return { state, set, setTable, addLine, setQty, clearItems, reset };
}
