"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Remembers, for this visit only, which page a visitor was on before the
 * current one, and the campaign tags (utm_*) they first arrived with — so an
 * enquiry can say "came from /pricing, via the Diwali campaign". In-site
 * links don't reload the page, which is why `document.referrer` can't be used.
 * Nothing leaves the browser until they send the contact form.
 */
export function Trail() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      const last = sessionStorage.getItem("tp.path");
      if (last && last !== pathname) sessionStorage.setItem("tp.prev", last);
      sessionStorage.setItem("tp.path", pathname);
      const q = new URLSearchParams(window.location.search);
      if (q.get("utm_source") && !sessionStorage.getItem("tp.utm")) {
        sessionStorage.setItem("tp.utm", JSON.stringify({ source: q.get("utm_source") ?? "", medium: q.get("utm_medium") ?? "", campaign: q.get("utm_campaign") ?? "" }));
      }
    } catch {
      /* storage blocked — the enquiry just won't say where they came from */
    }
  }, [pathname]);
  return null;
}
