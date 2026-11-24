import { Link } from "../../../lib/nav";
import { estimatePrice } from "@rasoipulse/config-schema";
import { Calculator } from "lucide-react";
import { Card, Field, TextInput } from "../../../ui";
import { subtle } from "./parts";

const rs = (n) => `₹${new Intl.NumberFormat("en-IN").format(Math.round(n))}`;

/**
 * The estimated monthly price for what the form asks for, line by line (only for the people at Rasoi Pulse — it is not printed).
 * A standard plan: the plan's own price plus whatever was allowed beyond it. The Custom plan: the dearest plan's price plus
 * the outlets and people beyond that plan's limits, so it always costs more than every standard plan.
 */
export function EstimateCard({ data, plan, plans, pricing, onDiscount, disabled }) {
  const e = estimatePrice({ data, plan, plans, pricing });
  return (
    <Card title="Estimated price" icon={<Calculator size={15} />} subtitle="A month, before and after GST. Only you see this — it isn't on the PDF.">
      <div data-estimate>
        {!e ? (
          <p style={subtle}>Choose the plan first.</p>
        ) : e.unavailable ? (
          <p style={{ ...subtle, color: "var(--tone-warning)" }} data-estimate-unavailable>{e.notes[0]}</p>
        ) : (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }} aria-label="Price lines">
              <tbody>
                {e.lines.map((l, i) => (
                  <tr key={i} data-estimate-line>
                    <td style={{ padding: "4px 0", verticalAlign: "top" }}>{l.label}</td>
                    <td style={{ padding: "4px 0 4px 10px", textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{rs(l.amount)}</td>
                  </tr>
                ))}
                <tr style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "6px 0", fontWeight: 600 }}>A month</td>
                  <td data-estimate-subtotal style={{ padding: "6px 0 6px 10px", textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{rs(e.subtotal)}</td>
                </tr>
                {e.discount > 0 ? (
                  <tr><td style={{ padding: "2px 0" }}>Discount ({e.discountPct}%)</td><td data-estimate-discount style={{ padding: "2px 0 2px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>− {rs(e.discount)}</td></tr>
                ) : null}
                <tr><td style={{ padding: "2px 0" }}>GST ({e.gstPct}%)</td><td data-estimate-gst style={{ padding: "2px 0 2px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{rs(e.gst)}</td></tr>
                <tr style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: "7px 0", fontWeight: 700, fontSize: 14 }}>Pays a month</td>
                  <td data-estimate-total style={{ padding: "7px 0 7px 10px", textAlign: "right", fontWeight: 700, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{rs(e.monthlyWithGst)}</td>
                </tr>
              </tbody>
            </table>
            {e.yearly ? (
              <p data-estimate-yearly style={{ ...subtle, marginTop: 6 }}>
                Paying for the year up front ({e.yearly.discountPct}% off): <strong>{rs(e.yearly.total)}</strong> with GST — about {rs(e.yearly.perMonth)} a month before GST, saving {rs(e.yearly.saves)}.
              </p>
            ) : null}
          </>
        )}
        {e && !e.unavailable ? (
          <Field label="Discount for this client (%)" hint="Negotiated — taken off the monthly price" style={{ marginTop: 12 }}>
            <TextInput type="number" min={0} max={100} value={data.quote.discountPct} onChange={(ev) => onDiscount(Math.max(0, Math.min(100, Number(ev.target.value) || 0)))} style={{ width: 110 }} aria-label="Discount for this client" disabled={disabled} />
          </Field>
        ) : null}
        {e?.fits?.length ? (
          <p data-estimate-fits style={{ ...subtle, marginTop: 8 }}>Standard plans that fit as they are: {e.fits.map((f) => `${f.name} (${rs(f.monthly)})`).join(", ")}.</p>
        ) : e && !e.unavailable ? (
          <p data-estimate-fits style={{ ...subtle, marginTop: 8 }}>No standard plan fits this on its own.</p>
        ) : null}
        {e?.notes?.length && !e.unavailable ? <ul data-estimate-notes style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12, color: "var(--tone-warning)" }}>{e.notes.map((n) => <li key={n}>{n}</li>)}</ul> : null}
        <p style={{ ...subtle, marginTop: 10 }}><Link to="/platform/onboarding/pricing">Edit the price list</Link></p>
      </div>
    </Card>
  );
}
