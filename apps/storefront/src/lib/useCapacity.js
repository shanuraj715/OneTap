"use client";

import { useEffect, useState } from "react";
import { api } from "./clientApi";

/**
 * Busy-kitchen / limited-rider capacity, polled independently of the cart —
 * both the menu page (so browsing itself shows the banner) and the order page
 * (so "Delivery" can be greyed out and the message repeated there) need this,
 * so it's a hook rather than something threaded through props between them.
 */
export function useCapacity(outletId) {
  const [capacity, setCapacity] = useState(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api(`/api/orders/capacity?outletId=${encodeURIComponent(outletId)}`)
        .then((c) => alive && setCapacity(c))
        .catch(() => undefined);
    load();
    const id = setInterval(load, 20_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [outletId]);

  return capacity;
}
