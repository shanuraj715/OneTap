import { useState } from "react";
import { WEEKDAYS } from "@onetap/config-schema";
import { Banknote, Percent, ReceiptText, ShoppingBag, Users as UsersIcon, XCircle } from "lucide-react";
import { useAn, useAnFilters } from "../../lib/useAnalytics";
import { ColumnChart, Figure, RankedBars, SegmentedBar, StatTile } from "../platform/viz/charts";
import { axisCount, axisMoney, count, rupees } from "../platform/viz/format";
import { AnalyticsShell } from "./AnalyticsShell";
import { Heatmap, hour12, Insight, pctChange } from "./parts";

const CHANNEL = { takeaway: "Takeaway", delivery: "Delivery", "dine-in": "Dine-in" };
const GATEWAY = { cod: "Cash at the counter", razorpay: "Online (Razorpay)", mock: "Test gateway" };
const COLORS = ["var(--viz-accent, #2a78d6)", "#e5822b", "#3aa17e", "#a259c4", "#c4506b"];

const labelFor = (key, g) => {
  if (g === "day") return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  if (g === "month") return new Date(`${key}-15T12:00:00Z`).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
  return key.replace(/^\d{4}-/, "");
};

export function Overview() {
  const filters = useAnFilters();
  const [granularity, setGranularity] = useState("");
  const q = useAn("overview", filters, { granularity }, true);
  const d = q.data;
  const k = d?.kpis;
  const p = d?.previousKpis;
  const note = "vs the period before";
  return (
    <AnalyticsShell>
      {!d ? <p style={{ color: "var(--color-text-muted)" }}>{q.isError ? q.error.message : "Loading…"}</p> : (
        <>
          <div className="dash-tiles">
            <StatTile label="Sales" icon={<Banknote size={14} />} value={rupees(k.sales)} delta={pctChange(k.sales, p.sales)} deltaNote={note} spark={d.series.map((s) => s.sales)} note="incl. GST" />
            <StatTile label="Net sales" icon={<Banknote size={14} />} value={rupees(k.net)} delta={pctChange(k.net, p.net)} deltaNote={note} note="without GST — what the store keeps" />
            <StatTile label="Orders" icon={<ReceiptText size={14} />} value={count(k.orders)} delta={pctChange(k.orders, p.orders)} deltaNote={note} spark={d.series.map((s) => s.orders)} />
            <StatTile label="Average order" icon={<ShoppingBag size={14} />} value={rupees(k.aov)} delta={pctChange(k.aov, p.aov)} deltaNote={note} />
            <StatTile label="Items sold" icon={<ShoppingBag size={14} />} value={count(k.items)} delta={pctChange(k.items, p.items)} deltaNote={note} />
            <StatTile label="Customers" icon={<UsersIcon size={14} />} value={count(k.customers)} delta={pctChange(k.customers, p.customers)} deltaNote={note} note={`${count(d.newVsRepeat.newCustomers)} new · ${count(d.newVsRepeat.repeatCustomers)} returning`} />
            <StatTile label="Cancelled" icon={<XCircle size={14} />} value={count(d.cancellations.cancelled)} delta={pctChange(d.cancellations.cancelled, d.previousCancellations.cancelled)} deltaNote={note} note={`${(d.cancellations.rate * 100).toFixed(1)}% of all orders`} />
            <StatTile label="Discounts given" icon={<Percent size={14} />} value={rupees(k.discount + k.coins)} delta={pctChange(k.discount + k.coins, p.discount + p.coins)} deltaNote={note} note="coupons + coins" />
          </div>

          <Figure
            title="Sales over time"
            subtitle={`${d.granularity === "day" ? "Each day" : d.granularity === "week" ? "Each week" : "Each month"}, including GST`}
            actions={<Granularity value={d.granularity} onChange={setGranularity} />}
            busy={q.isFetching}
            table={{ caption: "Sales over time", columns: [{ key: "when", label: "Period" }, { key: "orders", label: "Orders", right: true }, { key: "sales", label: "Sales", right: true }], rows: d.series.map((s) => ({ when: s.key, orders: count(s.orders), sales: rupees(s.sales) })) }}
          >
            <ColumnChart
              name="Sales"
              summary="Sales over the chosen period"
              data={d.series.map((s, i) => ({ key: s.key, label: labelFor(s.key, d.granularity), value: s.sales, partial: i === d.series.length - 1 && d.range.to >= new Date().toISOString().slice(0, 10), tip: [`${count(s.orders)} orders`] }))}
              format={(v) => rupees(v)}
              labelFormat={(v) => rupees(v, { compact: true })}
              tickFormat={axisMoney(Math.max(...d.series.map((s) => s.sales), 1))}
            />
          </Figure>

          <div className="dash-2">
            <Figure title="When people order" subtitle="Orders in each hour of the day" busy={q.isFetching} table={{ caption: "Orders by hour", columns: [{ key: "h", label: "Hour" }, { key: "o", label: "Orders", right: true }, { key: "s", label: "Sales", right: true }], rows: d.hourly.filter((h) => h.orders).map((h) => ({ h: hour12(h.hour), o: count(h.orders), s: rupees(h.sales) })) }}>
              <ColumnChart whole name="Orders" summary="Orders by hour of day" data={d.hourly.filter((h) => h.hour >= 8).map((h) => ({ key: String(h.hour), label: hour12(h.hour).replace(" ", ""), value: h.orders }))} format={count} tickFormat={axisCount(Math.max(...d.hourly.map((h) => h.orders), 1))} />
              {busiest(d.hourly) ? <Insight>Your busiest hour is <strong>{hour12(busiest(d.hourly).hour)}</strong> — {busiest(d.hourly).share}% of orders arrive in that hour. Have the kitchen fully staffed and prepped before it.</Insight> : null}
            </Figure>
            <Figure title="Busiest times" subtitle="Orders by weekday and hour — darker is busier" busy={q.isFetching}>
              <Heatmap cells={d.heatmap} />
              {busiestDay(d.heatmap) ? <Insight>{WEEKDAYS[busiestDay(d.heatmap).day]}s are your busiest day ({busiestDay(d.heatmap).share}% of orders).</Insight> : null}
            </Figure>
          </div>

          <div className="dash-2">
            <Figure title="Order types" subtitle="Where the sales come from" busy={q.isFetching} note={d.channels.map((c) => `${CHANNEL[c.id] ?? c.id}: ${rupees(c.sales)} from ${count(c.orders)} orders`).join("  ·  ")}>
              <SegmentedBar parts={d.channels.map((c, i) => ({ id: c.id, name: CHANNEL[c.id] ?? c.id, value: c.sales, color: COLORS[i % COLORS.length], display: `${Math.round((c.sales / (k.sales || 1)) * 100)}%` }))} />
            </Figure>
            <Figure title="How people pay" subtitle="Payment methods, by sales" busy={q.isFetching}>
              <RankedBars rows={d.payments.map((c) => ({ id: c.id, label: GATEWAY[c.id] ?? c.id, value: c.sales, display: `${rupees(c.sales)} · ${Math.round((c.sales / (k.sales || 1)) * 100)}%` }))} />
            </Figure>
          </div>
        </>
      )}
    </AnalyticsShell>
  );
}

function Granularity({ value, onChange }) {
  return (
    <div className="dash-toggle" role="group" aria-label="Group by">
      {["day", "week", "month"].map((g) => (
        <button key={g} type="button" className="viz-btn" aria-pressed={value === g} onClick={() => onChange(g)} style={{ border: 0, borderRadius: 0, textTransform: "capitalize" }}>{g}</button>
      ))}
    </div>
  );
}

function busiest(hourly) {
  const total = hourly.reduce((s, h) => s + h.orders, 0);
  const top = [...hourly].sort((a, b) => b.orders - a.orders)[0];
  return total && top?.orders ? { hour: top.hour, share: Math.round((top.orders / total) * 100) } : null;
}
function busiestDay(cells) {
  const per = cells.map((row) => row.reduce((a, b) => a + b, 0));
  const total = per.reduce((a, b) => a + b, 0);
  const day = per.indexOf(Math.max(...per));
  return total ? { day, share: Math.round((per[day] / total) * 100) } : null;
}
