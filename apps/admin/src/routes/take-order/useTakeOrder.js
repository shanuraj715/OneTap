import { useCallback, useEffect, useState } from "react";

/**
 * Everything a half-taken order holds — the table, the items, who it's for —
 * kept in sessionStorage per outlet, so an accidental refresh or a quick look
 * at another page doesn't make a waiter re-take the order at the table.
 */
const EMPTY = {
  tableId: null,
  /**
   * The party the screen saw at that table when it was picked — a session id, or null for a free table (undefined = not
   * recorded yet). Sent with the order so the server can refuse it if someone else took the table in the meantime.
   */
  seenSessionId: undefined,
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
  /**
   * Which party the typed customer details belong to: "<tableId>|<sessionId or
   * free>". When the table's party changes — the last guests left and new ones
   * sat down — the details no longer match and are cleared.
   */
  customerKey: null,
};

const NO_CUSTOMER = { phone: "", name: "", email: "", useCoins: false, coins: 0, approval: null, approvalPhone: null, customerKey: null };

/** A half-taken order older than this is someone else's by now — start fresh. */
const STALE_MS = 2 * 60 * 60 * 1000;

const keyFor = (outletId) => `onetap.takeOrder.${outletId}`;

function load(outletId) {
  if (!outletId) return EMPTY;
  try {
    const raw = sessionStorage.getItem(keyFor(outletId));
    if (!raw) return EMPTY;
    const saved = JSON.parse(raw);
    if (!saved.savedAt || Date.now() - saved.savedAt > STALE_MS) return EMPTY;
    return { ...EMPTY, ...saved };
  } catch {
    return EMPTY;
  }
}

function save(outletId, state) {
  if (!outletId) return;
  try {
    sessionStorage.setItem(keyFor(outletId), JSON.stringify({ ...state, savedAt: Date.now() }));
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
    (tableId, seenSessionId) => setState((s) => (s.tableId === tableId ? s : { ...s, tableId, seenSessionId, ...NO_CUSTOMER })),
    [],
  );

  /** The same order moved to another (free) table: the items AND the customer typed so far go along. */
  const moveTable = useCallback(
    (tableId) => setState((s) => ({ ...s, tableId, seenSessionId: null, customerKey: s.customerKey ? `${tableId}|free` : null })),
    [],
  );

  /** Customer details typed (or picked) for the party now at the table. */
  const setCustomer = useCallback((patch, customerKey) => setState((s) => ({ ...s, ...patch, customerKey })), []);
  const clearCustomer = useCallback(() => setState((s) => ({ ...s, ...NO_CUSTOMER })), []);

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

  /**
   * After sending: the items and the typed customer are gone — the table
   * stays for "add more", and from now on the table itself knows who's
   * sitting there (it shows as their bill), so nothing typed is carried over
   * to whoever sits there next.
   */
  const clearItems = useCallback(() => setState((s) => ({ ...s, lines: [], note: "", ...NO_CUSTOMER })), []);
  const reset = useCallback(() => setState(EMPTY), []);

  return { state, set, setTable, moveTable, setCustomer, clearCustomer, addLine, setQty, clearItems, reset };
}
