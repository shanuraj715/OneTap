"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./clientApi";

/**
 * Who's ordering, from the session cookie the OTP flow set.
 *
 * `status` is separate from `customer` being null, because "still checking"
 * and "definitely a guest" call for different UI: a login gate flashing on
 * screen for a moment before flipping to the order content reads as broken,
 * not as fast.
 */
export function useCustomer() {
  const [customer, setCustomer] = useState(null);
  const [status, setStatus] = useState("loading");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  /**
   * Ask the server who this is. Only a clear answer changes anything: "nobody" (200 with no customer, or a 401/403/404) means signed out; a
   * failure to ASK — no connection, the server restarting, a deploy, a rate-limit reply — is NOT "signed out": it is tried again (a little
   * longer each time, up to every 8 seconds) while the page keeps its loading state, so a hiccup never throws a signed-in customer back to the
   * login form (and costs them another code).
   */
  const refresh = useCallback(async () => {
    setStatus((s) => (s === "loading" ? s : "loading"));
    for (let attempt = 0; ; attempt++) {
      try {
        const r = await api("/api/customer/me");
        if (!alive.current) return null;
        setCustomer(r.customer);
        setStatus("ready");
        return r.customer;
      } catch (e) {
        if (!alive.current) return null;
        if (e?.status && e.status < 500 && e.status !== 429) {
          setCustomer(null);
          setStatus("ready");
          return null;
        }
        await new Promise((resolve) => setTimeout(resolve, Math.min(800 * 2 ** attempt, 8000)));
        if (!alive.current) return null;
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await api("/api/customer/logout", {}).catch(() => undefined);
    setCustomer(null);
  }, []);

  return { customer, loading: status === "loading", refresh, logout };
}
