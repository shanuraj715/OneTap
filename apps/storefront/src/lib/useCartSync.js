"use client";

import { useEffect, useRef } from "react";
import { apiPut } from "./clientApi";

/**
 * For a SIGNED-IN customer, send the cart to the store a moment after it changes — that is what lets the store remind
 * them about a forgotten cart. The store only keeps it while it has cart reminders switched on; when it says they are
 * off, this stops sending for the rest of the visit.
 */
export function useCartSync(outletId, lines, { enabled, hydrated }) {
  const last = useRef(null);
  const off = useRef(false);
  useEffect(() => {
    if (!enabled || !hydrated || off.current) return undefined;
    const payload = lines.map((l) => ({ itemId: l.itemId, variantId: l.variantId, modifierOptionIds: l.modifierOptionIds ?? [], quantity: l.quantity }));
    const key = JSON.stringify(payload);
    if (key === last.current) return undefined;
    const t = setTimeout(() => {
      last.current = key;
      apiPut("/api/customer/cart", { outletId, lines: payload })
        .then((r) => {
          if (r?.off) off.current = true;
        })
        .catch(() => undefined);
    }, 1500);
    return () => clearTimeout(t);
  }, [outletId, lines, enabled, hydrated]);
}
