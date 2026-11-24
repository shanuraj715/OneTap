import { useState } from "react";
import { DEFAULT_STOCK_SAFETY_PCT, WEEKDAYS } from "@rasoipulse/config-schema";
import { useAn, useAnFilters } from "../../lib/useAnalytics";
import { Field, Select, TextInput } from "../../ui";
import { Delta, Figure, RankedBars } from "../platform/viz/charts";
import { count, rupees } from "../platform/viz/format";
import { AnalyticsShell } from "./AnalyticsShell";
import { Insight } from "./parts";

export function Items() {
  const filters = useAnFilters();
  const q = useAn("items", filters);
  const [weeks, setWeeks] = useState(6);
  const [safety, setSafety] = useState(DEFAULT_STOCK_SAFETY_PCT);
  const stock = useAn("stock", { ...filters, range: filters.range }, { weeks, safety: Math.max(0, Math.min(100, Number(safety) || 0)), from: undefined, to: undefined });
  const d = q.data;
  const s = stock.data;
  const top = d?.items.slice(0, 12) ?? [];
  const slow = d?.items.filter((i) => i.perDay < 1).slice(-6).reverse() ?? [];
  return (
    <AnalyticsShell subtitle="What sells, what doesn't, and how much to prepare.">
      {!d ? <p style={{ color: "var(--color-text-muted)" }}>{q.isError ? q.error.message : "Loading…"}</p> : (
        <>
          <Figure title="Best sellers" subtitle="By quantity sold in this period — with the change against the period before" busy={q.isFetching}>
            {top.length ? <RankedBars deltaNote="vs the period before" rows={top.map((i) => ({ id: i.key, label: i.name, value: i.qty, display: `${count(i.qty)} sold · ${rupees(i.revenue)}`, delta: i.change ?? undefined }))} /> : <p style={muted}>No sales in this period.</p>}
            {top[0] ? <Insight><strong>{top[0].name}</strong> is the top seller: {count(top[0].qty)} sold, {Math.round(top[0].qtyShare * 100)}% of everything. The top 3 make up {Math.round(top.slice(0, 3).reduce((a, i) => a + i.qtyShare, 0) * 100)}% — keep them always in stock.</Insight> : null}
          </Figure>

          <Figure
            title="Every item"
            subtitle={`${d.items.length} item${d.items.length === 1 ? "" : "s"} sold`}
            busy={q.isFetching}
            note={d.unsold.length ? `Not sold at all in this period (${d.unsold.length}): ${d.unsold.slice(0, 12).join(", ")}${d.unsold.length > 12 ? "…" : ""}. Consider a promotion, a rewrite of the description, or removing them from the menu.` : "Every item on the menu sold at least once."}
          >
            <div className="viz-tablewrap">
              <table className="viz-table viz" aria-label="All items sold">
                <thead><tr><th>#</th><th>Item</th><th className="r">Quantity</th><th className="r">Revenue</th><th className="r">Per day</th><th className="r">Share</th><th className="r">Change</th></tr></thead>
                <tbody>
                  {d.items.map((i) => (
                    <tr key={i.key}>
                      <td>{i.rank}</td><td>{i.name}</td><td className="r">{count(i.qty)}</td><td className="r">{rupees(i.revenue)}</td>
                      <td className="r">{i.perDay}</td><td className="r">{(i.qtyShare * 100).toFixed(1)}%</td><td className="r"><Delta pct={i.change} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {slow.length ? <Insight>Slowest movers: {slow.map((i) => `${i.name} (${i.perDay}/day)`).join(", ")}. Prepare these in small batches or to order, so they don't go to waste.</Insight> : null}
          </Figure>

          <h2 className="dash-h">Stock &amp; prep suggestions</h2>
          <Figure
            title="What to prepare"
            subtitle="The average sold on each weekday over the last few weeks, plus a safety margin — so you prepare enough without throwing food away"
            busy={stock.isFetching}
            actions={
              <span style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                <Field label="Look back"><Select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>{[4, 6, 8, 12].map((w) => <option key={w} value={w}>{w} weeks</option>)}</Select></Field>
                <Field label="Safety margin (%)"><TextInput type="number" min={0} max={100} value={safety} onChange={(e) => setSafety(e.target.value)} style={{ width: 90 }} /></Field>
              </span>
            }
          >
            {!s ? <p style={muted}>{stock.isError ? stock.error.message : "Working it out…"}</p> : !s.items.length ? <p style={muted}>Not enough sales in the last {s.weeks} weeks to suggest anything yet.</p> : (
              <>
                <h3 style={{ margin: "0 0 8px", fontSize: 14 }} data-tomorrow>Tomorrow ({s.tomorrow.weekday}): prepare about</h3>
                {s.tomorrow.items.length ? (
                  <div className="viz-tablewrap">
                    <table className="viz-table viz" aria-label={`Prep list for ${s.tomorrow.weekday}`}>
                      <thead><tr><th>Item</th><th className="r">Prepare</th><th className="r">Usually sells</th><th className="r">Best day ever</th></tr></thead>
                      <tbody>{s.tomorrow.items.map((i) => <tr key={i.name}><td>{i.name}</td><td className="r"><strong>{i.suggested}</strong></td><td className="r">{i.avg}</td><td className="r">{i.max}</td></tr>)}</tbody>
                    </table>
                  </div>
                ) : <p style={muted}>Nothing usually sells on {s.tomorrow.weekday}s.</p>}

                <h3 style={{ margin: "18px 0 8px", fontSize: 14 }}>The whole week</h3>
                <div className="viz-tablewrap">
                  <table className="viz-table viz" aria-label="Prep numbers for every weekday">
                    <thead><tr><th>Item</th>{[1, 2, 3, 4, 5, 6, 0].map((w) => <th key={w} className="r">{WEEKDAYS[w].slice(0, 3)}</th>)}</tr></thead>
                    <tbody>
                      {s.items.slice(0, 25).map((i) => {
                        const max = Math.max(...i.weekday.map((w) => w.suggested));
                        return (
                          <tr key={i.key}>
                            <td>{i.name}</td>
                            {[1, 2, 3, 4, 5, 6, 0].map((w) => <td key={w} className="r" style={i.weekday[w].suggested === max && max > 0 ? { fontWeight: 700 } : { color: i.weekday[w].suggested ? undefined : "var(--viz-ink-muted, #888)" }}>{i.weekday[w].suggested || "–"}</td>)}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {adviceFor(s)}
                <p style={{ ...muted, margin: "8px 0 0" }}>Based on {s.weeks} whole weeks up to yesterday ({s.range.from} to {s.range.to}) and a {s.safetyPct}% safety margin. These are portions, not ingredients; the bold number is each item's busiest weekday.</p>
              </>
            )}
          </Figure>
        </>
      )}
    </AnalyticsShell>
  );
}

function adviceFor(s) {
  const swing = s.items.slice(0, 8).map((i) => ({ name: i.name, hi: Math.max(...i.weekday.map((w) => w.suggested)), lo: Math.min(...i.weekday.filter((w) => w.suggested > 0).map((w) => w.suggested)) })).filter((i) => i.lo > 0 && i.hi >= i.lo * 1.6);
  if (!swing.length) return null;
  const t = swing[0];
  return <Insight>Don't prepare the same amount every day: <strong>{t.name}</strong> needs about {t.hi} on its busiest day but only {t.lo} on its quietest. Preparing the average every day means waste on slow days and sold-out items on busy ones.</Insight>;
}
const muted = { margin: 0, fontSize: 13, color: "var(--color-text-muted)" };
