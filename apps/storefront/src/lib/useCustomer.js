"use client";

import { useCallback, useEffect, useState } from "react";
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

  const refresh = useCallback(() => {
    setStatus((s) => (s === "loading" ? s : "loading"));
    return api("/api/customer/me")
      .then((r) => {
        setCustomer(r.customer);
        setStatus("ready");
        return r.customer;
      })
      .catch(() => {
        setCustomer(null);
        setStatus("ready");
        return null;
      });
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
