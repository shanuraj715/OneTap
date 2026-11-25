import { WEEKDAYS } from "@rasoipulse/config-schema";
import { useAn, useAnFilters } from "../../lib/useAnalytics";
import { ColumnChart, DataTable, Figure, LineChart, Legend } from "../platform/viz/charts";
import { axisMoney, count, rupees } from "../platform/viz/format";
import { AnalyticsShell } from "./AnalyticsShell";
import { Insight } from "./parts";

const CHANNEL = { takeaway: "Takeaway", delivery: "Delivery", "dine-in": "Dine-in" };
const COLORS = ["var(--viz-accent, #2a78d6)", "#e5822b", "#3aa17e", "#a259c4", "#c4506b", "#0f8b8d"];
const label = (key, g) => (g === "day" ? new Date(`${key}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }) : g === "month" ? new Date(`${key}-15T12:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" }) : key.replace(/^\d{4}-/, ""));

export function Sales() {
  const filters = useAnFilters();
  const q = useAn("sales", filters);
  const d = q.data;
  const best = d ? [...d.weekdays].sort((a, b) => b.avgSales - a.avgSales)[0] : null;
  const worst = d ? [...d.weekdays].filter((w) => w.occurrences > 0).sort((a, b) => a.avgSales - b.avgSales)[0] : null;
  return (
    <AnalyticsShell>
      {!d ? <p style={{ color: "var(--color-text-muted)" }}>{q.isError ? q.error.message : "Loading…"}</p> : (
        <>
          <Figure
            title="Sales by outlet"
            subtitle={`${d.granularity === "day" ? "Each day" : d.granularity === "week" ? "Each week" : "Each month"} — one line per outlet`}
            busy={q.isFetching}
            legend={d.perOutlet.length > 1 ? <Legend items={d.perOutlet.map((o, i) => ({ name: o.name, color: COLORS[i % COLORS.length], line: true }))} /> : null}
            table={{ caption: "Sales by outlet", columns: [{ key: "when", label: "Period" }, ...d.perOutlet.map((o) => ({ key: o.id, label: o.name, right: true }))], rows: d.buckets.map((b, i) => ({ when: b, ...Object.fromEntries(d.perOutlet.map((o) => [o.id, rupees(o.values[i])])) })) }}
          >
            <LineChart
              labels={d.buckets.map((b) => label(b, d.granularity))}
              series={d.perOutlet.map((o, i) => ({ name: o.name, color: COLORS[i % COLORS.length], values: o.values }))}
              format={(v) => rupees(v)}
              tickFormat={axisMoney(Math.max(...d.perOutlet.flatMap((o) => o.values), 1))}
              tickEvery={Math.max(1, Math.ceil(d.buckets.length / 8))}
              summary="Sales over the chosen period, one line per outlet"
            />
          </Figure>

          <div className="dash-2">
            <Figure title="Which weekday earns most" subtitle="Average sales on each weekday in this period" busy={q.isFetching} table={{ caption: "Weekdays", columns: [{ key: "n", label: "Weekday" }, { key: "a", label: "Average sales", right: true }, { key: "o", label: "Average orders", right: true }, { key: "t", label: "Total sales", right: true }], rows: d.weekdays.map((w) => ({ n: w.name, a: rupees(w.avgSales), o: w.avgOrders.toFixed(1), t: rupees(w.sales) })) }}>
              <ColumnChart name="Average sales" summary="Average sales by weekday" data={[1, 2, 3, 4, 5, 6, 0].map((i) => ({ key: WEEKDAYS[i], label: WEEKDAYS[i].slice(0, 3), value: d.weekdays[i].avgSales, tip: [`${d.weekdays[i].avgOrders.toFixed(1)} orders on average`] }))} format={(v) => rupees(v)} labelFormat={(v) => rupees(v, { compact: true })} tickFormat={axisMoney(Math.max(...d.weekdays.map((w) => w.avgSales), 1))} />
              {best && worst && best.avgSales > 0 ? <Insight>{best.name}s are your best day ({rupees(best.avgSales)} on average) and {worst.name}s your quietest ({rupees(worst.avgSales)}). Plan staff and prep to match, and run offers on {worst.name}s.</Insight> : null}
            </Figure>
            <Figure title="Order types by outlet" subtitle="Sales and orders for each way of ordering" busy={q.isFetching}>
              <DataTable
                columns={[{ key: "o", label: "Outlet" }, { key: "c", label: "Type" }, { key: "n", label: "Orders", right: true }, { key: "s", label: "Sales", right: true }]}
                rows={[...d.channelsByOutlet].sort((a, b) => String(a.outletId).localeCompare(String(b.outletId)) || b.sales - a.sales).map((r) => ({ o: d.perOutlet.find((x) => x.id === r.outletId)?.name ?? r.outletId, c: CHANNEL[r.channel] ?? r.channel, n: count(r.orders), s: rupees(r.sales) }))}
              />
            </Figure>
          </div>
        </>
      )}
    </AnalyticsShell>
  );
}
