import { Link } from "react-router-dom";
import { Megaphone, Repeat, UserPlus, Users as UsersIcon } from "lucide-react";
import { useAuth } from "../../lib/useAuth";
import { useStorePlan } from "../../lib/useStorePlan";
import { useAn, useAnFilters } from "../../lib/useAnalytics";
import { Figure, RankedBars, StatTile } from "../platform/viz/charts";
import { count, rupees } from "../platform/viz/format";
import { AnalyticsShell } from "./AnalyticsShell";
import { Insight } from "./parts";

export function Customers() {
  const filters = useAnFilters();
  const q = useAn("customers", filters);
  const { can } = useAuth();
  const { hasFeature } = useStorePlan();
  const d = q.data;
  const nv = d?.newVsRepeat;
  const canMarket = can("marketing:send") && hasFeature("marketing");
  return (
    <AnalyticsShell subtitle="Who orders, how often, and who has drifted away.">
      {!d ? <p style={{ color: "var(--color-text-muted)" }}>{q.isError ? q.error.message : "Loading…"}</p> : (
        <>
          <div className="dash-tiles">
            <StatTile label="Customers" icon={<UsersIcon size={14} />} value={count(nv.customers)} note="who ordered in this period" />
            <StatTile label="New" icon={<UserPlus size={14} />} value={count(nv.newCustomers)} note="first order in this period" />
            <StatTile label="Returning" icon={<Repeat size={14} />} value={count(nv.repeatCustomers)} note="ordered before this period too" />
            <StatTile label="Repeat rate" icon={<Repeat size={14} />} value={nv.customers ? `${Math.round((nv.repeatCustomers / nv.customers) * 100)}%` : "—"} note="the share who came back" />
          </div>
          <div className="dash-2">
            <Figure title="How often they order" subtitle="Customers by number of orders in this period" busy={q.isFetching}>
              <RankedBars rows={d.ordersPerCustomer.map((b) => ({ id: b.bucket, label: `${b.bucket} order${b.bucket === "1" ? "" : "s"}`, value: b.customers, display: `${count(b.customers)} customer${b.customers === 1 ? "" : "s"}` }))} />
            </Figure>
            <Figure title="Who has drifted away" subtitle="Customers who ordered before but haven't lately" busy={q.isFetching}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-lapsed>
                {[[30, d.lapsed.days30], [60, d.lapsed.days60], [90, d.lapsed.days90]].map(([days, n]) => (
                  <div key={days} style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <span style={{ flex: 1, minWidth: 180, fontSize: 14 }}><strong>{count(n)}</strong> customer{n === 1 ? "" : "s"} {n === 1 ? "hasn't" : "haven't"} ordered for over {days} days</span>
                    {canMarket && n > 0 ? <Link to={`/marketing/new?lapsed=${days}`} style={link}><Megaphone size={13} /> Message them</Link> : null}
                  </div>
                ))}
              </div>
              <Insight>Winning back a customer you already have costs far less than finding a new one. A small offer to the “over 30 days” group is the cheapest sales you can make.</Insight>
            </Figure>
          </div>
          <Figure title="Top customers" subtitle="Biggest spenders in this period" busy={q.isFetching}>
            {d.top.length ? (
              <div className="viz-tablewrap">
                <table className="viz-table viz" aria-label="Top customers">
                  <thead><tr><th>#</th><th>Customer</th><th>Phone</th><th className="r">Orders</th><th className="r">Spent</th><th className="r">Last order</th></tr></thead>
                  <tbody>{d.top.map((c, i) => <tr key={c.id}><td>{i + 1}</td><td>{c.name}</td><td>{c.phone}</td><td className="r">{c.orders}</td><td className="r">{rupees(c.spend)}</td><td className="r">{new Date(c.last).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 13 }}>No signed-in customers ordered in this period.</p>}
          </Figure>
        </>
      )}
    </AnalyticsShell>
  );
}
const link = { display: "inline-flex", gap: 6, alignItems: "center", padding: "6px 12px", borderRadius: 8, background: "var(--color-primary)", color: "var(--color-on-primary)", fontWeight: 600, fontSize: 13, textDecoration: "none" };
