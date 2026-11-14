"use client";

import { useState } from "react";

/**
 * The Monthly / Yearly switch above the plans. The server renders both prices
 * for every plan (so search engines and no-JavaScript visitors get everything);
 * this only sets which cycle is showing, and CSS does the rest — anything
 * marked .cy-m shows on Monthly, .cy-y on Yearly. With no yearly discount on
 * any plan the switch isn't shown at all.
 */
export function Billing({ discount = 0, children }) {
  const [cycle, setCycle] = useState("monthly");
  return (
    <div className="billing" data-cycle={cycle}>
      {discount > 0 ? (
        <div className="cycle-toggle" role="group" aria-label="Billing period">
          <button type="button" aria-pressed={cycle === "monthly"} onClick={() => setCycle("monthly")}>
            Monthly
          </button>
          <button type="button" aria-pressed={cycle === "yearly"} onClick={() => setCycle("yearly")}>
            Yearly <span className="cycle-save">Save up to {discount}%</span>
          </button>
        </div>
      ) : null}
      {children}
    </div>
  );
}
