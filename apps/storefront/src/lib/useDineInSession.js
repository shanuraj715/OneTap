"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./clientApi";

/**
 * Resolves (or rejoins) the table session for a QR dine-in visit, and keeps
 * the running tab current.
 *
 * Both the menu page (which shows "Ordering to Table 7 · Running tab ₹340" at
 * the top regardless of what's in the cart) and the order page (which needs
 * the session id to place onto, and to refresh the tab once it does) resolve
 * this independently rather than one passing it to the other in memory —
 * navigating between them is a real page change, and re-resolving from the
 * table's own token is exactly what the table page's server component already
 * does on every load. A GET here is cheap; carrying session state across a
 * navigation for it would not be simpler, just more fragile.
 */
export function useDineInSession(dineIn, outletId, placedOrderId) {
  const [sessionId, setSessionId] = useState(null);
  const [tab, setTab] = useState(null);

  useEffect(() => {
    if (!dineIn) return;
    let alive = true;
    void (async () => {
      try {
        const r = await api(`/api/tables/scan/${dineIn.tableId}?k=${encodeURIComponent(dineIn.token)}`);
        if (alive && r.session) setSessionId(r.session.id);
      } catch {
        /* handled when they try to order — placing without a session asks to rescan */
      }
    })();
    return () => {
      alive = false;
    };
  }, [dineIn]);

  const refreshTab = useCallback(async () => {
    if (!dineIn || !sessionId) return;
    try {
      const r = await api(`/api/tables/sessions/${sessionId}/tab?outletId=${outletId}`);
      setTab(r.tab);
    } catch {
      /* session closed by staff — the next order attempt will say so */
    }
  }, [dineIn, sessionId, outletId]);

  useEffect(() => {
    void refreshTab();
    // Re-check after an order is placed here, same as the old single-component flow did.
  }, [refreshTab, placedOrderId]);

  return { sessionId, setSessionId, tab, refreshTab };
}
