import { useAn, useAnFilters, useAnOptions } from "../../lib/useAnalytics";
import { Checkbox } from "../../ui";
import { ChangeBars, Figure, LineChart, Legend, SegmentedBar } from "../platform/viz/charts";
import { axisMoney, count, rupees } from "../platform/viz/format";
import { AnalyticsShell, FilterBar } from "./AnalyticsShell";
import { Insight } from "./parts";

const COLORS = ["var(--viz-accent, #2a78d6)", "#e5822b", "#3aa17e", "#a259c4", "#c4506b", "#0f8b8d"];
const CHANNEL = { takeaway: "Takeaway", delivery: "Delivery", "dine-in": "Dine-in" };

/** Outlets side by side for the same dates. Tick the outlets to compare; the first ticked is the one the others are measured against. */
export function Compare() {
  const filters = useAnFilters();
  const opts = useAnOptions();
  const all = opts.data?.outlets ?? [];
  const picked = filters.outlets.length >= 2 ? filters.outlets : all.map((o) => o.id);
  const q = useAn("compare", { ...filters, outletsParam: picked.join(",") }, {}, all.length > 1);
  const d = q.data;
  const toggle = (id) => {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
    if (next.length >= 2) filters.set({ outlets: next.join(",") });
  };
  const base = d?.outlets[0];
  const rows = [
    ["Sales", (o) => o.kpis.sales, rupees, true],
    ["Net sales", (o) => o.kpis.net, rupees, true],
    ["Orders", (o) => o.kpis.orders, count, true],
    ["Average order", (o) => o.kpis.aov, rupees, true],
    ["Items sold", (o) => o.kpis.items, count, true],
    ["Customers", (o) => o.kpis.customers, count, true],
    ["Discounts given", (o) => o.kpis.discount + o.kpis.coins, rupees, false],
    ["Cancelled orders", (o) => o.cancelled.cancelled, count, false],
    ["Cancellation rate", (o) => o.cancelled.rate * 100, (v) => `${v.toFixed(1)}%`, false],
  ];
  return (
    <AnalyticsShell bar={false} subtitle="Two or more outlets, side by side, for the same dates.">
      <FilterBar filters={filters} outlets={all} hideOutlet />
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }} role="group" aria-label="Outlets to compare">
        <span style={{ fontSize: 13, fontWeight: 600 }}>Compare:</span>
        {all.map((o, i) => <Checkbox key={o.id} label={o.title} checked={picked.includes(o.id)} onChange={() => toggle(o.id)} />)}
      </div>
      {!d ? <p style={{ color: "var(--color-text-muted)" }}>{q.isError ? q.error.message : "Loading…"}</p> : (
        <>
          <Figure title="Side by side" subtitle={`${d.days} days · everything is for exactly the same dates`} busy={q.isFetching}>
            <div className="viz-tablewrap" style={{ maxHeight: "none" }}>
              <table className="viz-table viz" aria-label="Outlets compared">
                <thead><tr><th>Measure</th>{d.outlets.map((o) => <th key={o.id} className="r">{o.name}</th>)}</tr></thead>
                <tbody>
                  {rows.map(([label, get, fmt, higherBetter]) => {
                    const values = d.outlets.map(get);
                    const best = higherBetter ? Math.max(...values) : Math.min(...values);
                    return (
                      <tr key={label}>
                        <td>{label}</td>
                        {d.outlets.map((o, i) => (
                          <td key={o.id} className="r" style={values[i] === best && d.outlets.length > 1 && new Set(values).size > 1 ? { fontWeight: 700 } : undefined}>
                            {fmt(values[i])}
                            {i > 0 && values[0] ? <span style={{ display: "block", fontSize: 11, color: "var(--viz-ink-muted, #777)" }}>{values[i] >= values[0] ? "+" : "−"}{Math.abs(Math.round(((values[i] - values[0]) / values[0]) * 100))}% vs {base.name}</span> : null}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {d.outlets.length >= 2 ? <Insight>{summary(d)}</Insight> : null}
          </Figure>
          <Figure title="Sales day by day" subtitle="One line per outlet" busy={q.isFetching} legend={<Legend items={d.outlets.map((o, i) => ({ name: o.name, color: COLORS[i % COLORS.length], line: true }))} />}>
            <LineChart
              labels={d.dayLabels.map((k) => new Date(`${k}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }))}
              series={d.outlets.map((o, i) => ({ name: o.name, color: COLORS[i % COLORS.length], values: o.daily }))}
              format={(v) => rupees(v)}
              tickFormat={axisMoney(Math.max(...d.outlets.flatMap((o) => o.daily), 1))}
              tickEvery={Math.max(1, Math.ceil(d.dayLabels.length / 8))}
              summary="Daily sales of each compared outlet"
            />
          </Figure>
          <div className="dash-2">
            {d.outlets.map((o, i) => (
              <Figure key={o.id} title={o.name} subtitle="Best sellers and how the orders arrive" busy={q.isFetching} note={o.channels.map((c) => `${CHANNEL[c.channel] ?? c.channel}: ${rupees(c.sales)}`).join("  ·  ")}>
                <ol style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7 }}>{o.topItems.slice(0, 5).map((t) => <li key={t.name}>{t.name} — <strong>{count(t.qty)}</strong></li>)}</ol>
                <SegmentedBar parts={o.channels.map((c, j) => ({ id: c.channel, name: CHANNEL[c.channel] ?? c.channel, value: c.sales, color: COLORS[j % COLORS.length], display: `${Math.round((c.sales / (o.kpis.sales || 1)) * 100)}%` }))} />
              </Figure>
            ))}
          </div>
        </>
      )}
    </AnalyticsShell>
  );
}

function summary(d) {
  const by = [...d.outlets].sort((a, b) => b.kpis.sales - a.kpis.sales);
  const [top, low] = [by[0], by[by.length - 1]];
  if (!top.kpis.sales) return "No sales in these dates yet.";
  const gap = low.kpis.sales ? Math.round(((top.kpis.sales - low.kpis.sales) / low.kpis.sales) * 100) : null;
  const aov = [...d.outlets].sort((a, b) => b.kpis.aov - a.kpis.aov)[0];
  return `${top.name} sells the most${gap !== null ? ` — ${gap}% more than ${low.name}` : ""}. ${aov.name} has the highest average order (${rupees(aov.kpis.aov)}), so its customers spend more per visit.`;
}
void ChangeBars;
