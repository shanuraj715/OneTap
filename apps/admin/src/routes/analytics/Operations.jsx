import { Clock, XCircle } from "lucide-react";
import { useAn, useAnFilters } from "../../lib/useAnalytics";
import { ColumnChart, Figure, StatTile } from "../platform/viz/charts";
import { axisCount, count, rupees } from "../platform/viz/format";
import { AnalyticsShell } from "./AnalyticsShell";
import { hour12, Insight } from "./parts";

export function Operations() {
  const filters = useAnFilters();
  const q = useAn("operations", filters);
  const d = q.data;
  const k = d?.kitchen;
  return (
    <AnalyticsShell subtitle="Cancellations, kitchen speed, and what discounts cost.">
      {!d ? <p style={{ color: "var(--color-text-muted)" }}>{q.isError ? q.error.message : "Loading…"}</p> : (
        <>
          <div className="dash-tiles">
            <StatTile label="Cancelled orders" icon={<XCircle size={14} />} value={count(d.cancellations.cancelled)} note={`${(d.cancellations.rate * 100).toFixed(1)}% of ${count(d.cancellations.placed)} orders`} />
            <StatTile label="Sales lost" icon={<XCircle size={14} />} value={rupees(d.cancellations.lost)} note="value of the cancelled orders" />
            <StatTile label="Accepted in" icon={<Clock size={14} />} value={k?.acceptMinutes != null ? `${k.acceptMinutes} min` : "—"} note="from placed to accepted" />
            <StatTile label="Ready in" icon={<Clock size={14} />} value={k?.totalMinutes != null ? `${k.totalMinutes} min` : "—"} note="from placed to ready" />
            <StatTile label="Slow orders" icon={<Clock size={14} />} value={k ? `${Math.round(k.slowShare * 100)}%` : "—"} note={`took over ${k?.slowAfterMinutes ?? 30} minutes to be ready`} />
          </div>
          <div className="dash-2">
            <Figure title="When orders get cancelled" subtitle="Cancelled orders in each hour" busy={q.isFetching}>
              {d.cancellations.cancelled ? <ColumnChart whole name="Cancelled" summary="Cancelled orders by hour" data={d.cancelledByHour.filter((h) => h.hour >= 8).map((h) => ({ key: String(h.hour), label: hour12(h.hour).replace(" ", ""), value: h.n }))} format={count} tickFormat={axisCount(Math.max(...d.cancelledByHour.map((h) => h.n), 1))} /> : <p style={muted}>Nothing was cancelled in this period.</p>}
              {d.cancellations.rate > 0.08 ? <Insight>More than 1 in 12 orders is being cancelled. Check the hours above — cancellations bunching in busy hours usually mean the kitchen can't keep up; turn on load management in Settings to slow new orders down.</Insight> : null}
            </Figure>
            <Figure title="Kitchen speed" subtitle="Average times for finished orders" busy={q.isFetching}>
              {k ? (
                <div className="viz-tablewrap"><table className="viz-table viz" aria-label="Kitchen speed"><tbody>
                  <tr><td>Placed → accepted</td><td className="r"><strong>{k.acceptMinutes} min</strong></td></tr>
                  <tr><td>Accepted → ready</td><td className="r"><strong>{k.cookMinutes} min</strong></td></tr>
                  <tr><td>Placed → ready (the customer's wait)</td><td className="r"><strong>{k.totalMinutes} min</strong></td></tr>
                  <tr><td>Orders over {k.slowAfterMinutes} minutes</td><td className="r"><strong>{Math.round(k.slowShare * 100)}%</strong></td></tr>
                  <tr><td>Orders measured</td><td className="r">{count(k.orders)}</td></tr>
                </tbody></table></div>
              ) : <p style={muted}>No finished orders in this period.</p>}
              {k && k.acceptMinutes > 3 ? <Insight>Orders wait {k.acceptMinutes} minutes before anyone accepts them. Turn on “Accept incoming orders automatically” in Settings → Order handling, or keep the dashboard sound on.</Insight> : null}
            </Figure>
          </div>
          <div className="dash-2">
            <Figure title="Coupons" subtitle="What each code cost and what it brought in" busy={q.isFetching}>
              {d.coupons.length ? (
                <div className="viz-tablewrap"><table className="viz-table viz" aria-label="Coupons"><thead><tr><th>Code</th><th className="r">Used</th><th className="r">Discount given</th><th className="r">Sales from those orders</th></tr></thead>
                  <tbody>{d.coupons.map((c) => <tr key={c.code}><td>{c.code}</td><td className="r">{count(c.uses)}</td><td className="r">{rupees(c.discount)}</td><td className="r">{rupees(c.sales)}</td></tr>)}</tbody></table></div>
              ) : <p style={muted}>No coupon was used in this period.</p>}
            </Figure>
            <Figure title="Discounts in total" subtitle="Coupons and coin discounts together" busy={q.isFetching}>
              <div className="viz-tablewrap"><table className="viz-table viz" aria-label="Discount totals"><tbody>
                <tr><td>Coupon discounts</td><td className="r"><strong>{rupees(d.discounts.discount)}</strong></td></tr>
                <tr><td>Coin discounts</td><td className="r"><strong>{rupees(d.discounts.coins)}</strong></td></tr>
                <tr><td>Orders with a coupon</td><td className="r">{count(d.discounts.discounted)} of {count(d.discounts.orders)}</td></tr>
                <tr><td>Coupon discounts as a share of sales before discount</td><td className="r">{(d.discounts.discountShare * 100).toFixed(1)}%</td></tr>
              </tbody></table></div>
            </Figure>
          </div>
        </>
      )}
    </AnalyticsShell>
  );
}
const muted = { margin: 0, fontSize: 13, color: "var(--color-text-muted)" };
