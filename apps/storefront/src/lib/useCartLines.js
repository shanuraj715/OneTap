"use client";

import { useEffect, useState } from "react";

/**
 * Cart contents, persisted to localStorage under one key per outlet.
 *
 * This is the one piece of ordering state that has to survive navigating from
 * the menu page to the separate "Your order" page — everything else the old
 * single-component flow held in memory (fulfilment, coupon, redeemed coins)
 * is chosen ON the order page and doesn't need to travel with the click that
 * gets you there. The cart itself does, so it's the one thing pulled out here
 * rather than left as page-local state.
 */
export function useCartLines(outletId) {
  const storageKey = `onetap.cart.${outletId}`;
  const [lines, setLines] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      /* private mode, cleared storage — start empty */
    } finally {
      setHydrated(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return; // don't clobber storage with the empty initial state before it's loaded
    try {
      localStorage.setItem(storageKey, JSON.stringify(lines));
    } catch {
      /* not fatal */
    }
  }, [lines, storageKey, hydrated]);

  const addLine = (line) => setLines((prev) => [...prev, line]);

  const setQty = (index, qty) =>
    setLines((prev) => (qty <= 0 ? prev.filter((_, i) => i !== index) : prev.map((l, i) => (i === index ? { ...l, quantity: qty } : l))));

  const clear = () => setLines([]);

  const count = lines.reduce((n, l) => n + l.quantity, 0);

  return { lines, hydrated, addLine, setQty, clear, count };
}
