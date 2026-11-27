import { useState } from "react";
import { Link } from "../../lib/nav";
import { Wallet } from "lucide-react";
import { useBusiness } from "../../lib/usePlatform";
import { Card, Empty, Pill } from "../../ui";
import { Figure, Hero, Legend, LineChart, StatTile } from "./viz/charts";
import { count } from "./viz/format";
import { muted, row } from "./shared";
import { dayText, money } from "./StorePayments";

const SHORT = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });
/** axis labels in rupees: ₹900 · ₹2.5K — one style per axis */
const axis = (v) => (v === 0 ? "₹0" : v >= 10_000 ? `₹${SHORT.format(v)}` : money(v));

const RANGES = {
  day: { label: "Day", now: "Last 30 days", before: "The 30 days before", title: "Sales by day", tick: 5, name: (i) => `Day ${i + 1}` },
  week: { label: "Week", now: "Last 12 weeks", before: "The 12 weeks before", title: "Sales by week", tick: 2, name: (i) => `Week ${i + 1}` },
  month: { label: "Month", now: "Last 12 months", before: "The 12 months before", title: "Sales by month", tick: 1, name: (i) => `Month ${i + 1}` },
};

/**
 * Rasoi Pulse's OWN business, at the top of the dashboard: what the stores pay for the product — total sales, new sales (shops that bought
 * for the first time), re-subscribed (shops that paid again), who has run out — and ONE chart that switches between day, week and month,
 * each against the period before it. Nothing here is a store's own orders or sales; those are further down the page.
 */
export function BusinessSection() {
  const q = useBusiness();
  const b = q.data;
  const [unit, setUnit] = useState("month");

  if (!b) return <p style={muted}>{q.isError ? q.error.message : "Loading Rasoi Pulse's sales…"}</p>;
  const s = b.series[unit];
  const r = RANGES[unit];
  const none = b.totals.payments === 0;
  const labels = s.labels;
  const busy = q.isFetching;

  return (
    <section className="dash-biz" data-testid="business" aria-label="Rasoi Pulse business">
      <div style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>Rasoi Pulse business</h2>
        <p style={{ ...muted, margin: "2px 0 0" }}>What the shops pay you for the product — not what the shops sell to their customers.</p>
      </div>

      <div className="dash-top">
        <Hero
          label="Total sales of Rasoi Pulse"
          value={<span data-testid="biz-total">{money(b.totals.sales)}</span>}
          delta={b.month.changePct}
          deltaNote="this month vs the same days of last month"
          note={`${count(b.totals.payments)} ${b.totals.payments === 1 ? "payment" : "payments"} from ${count(b.totals.shops)} ${b.totals.shops === 1 ? "shop" : "shops"} · ${b.month.label}: ${money(b.month.sales)}`}
        />
        <div className="dash-kpis">
          <StatTile
            label="New sales"
            value={<span data-testid="biz-new">{count(b.newSales.shops)}</span>}
            note={`${money(b.newSales.amount)} · shops that bought for the first time${b.month.newShops ? ` · ${b.month.newShops} this month` : ""}`}
          />
          <StatTile
            label="Re-subscribed"
            value={<span data-testid="biz-renewals">{count(b.renewals.payments)}</span>}
            note={`${money(b.renewals.amount)} · ${count(b.renewals.shops)} ${b.renewals.shops === 1 ? "shop" : "shops"} paid again${b.month.renewals ? ` · ${b.month.renewals} this month` : ""}`}
          />
          <StatTile
            label="Paid up now"
            value={<span data-testid="biz-active">{count(b.standing.active)}</span>}
            note={b.standing.expiringSoon ? `${b.standing.expiringSoon} run out within 14 days` : "none run out in the next 14 days"}
          />
          <StatTile label="Ran out, not renewed" value={<span data-testid="biz-expired">{count(b.standing.expired)}</span>} note={b.standing.expired ? "worth a call" : "nobody has lapsed"} />
        </div>
      </div>

      <Figure
        title={r.title}
        subtitle={`${r.now} against ${r.before.toLowerCase()}. In the ${r.now.toLowerCase()}: ${count(s.newCount)} new, ${count(s.renewalCount)} re-subscribed.`}
        busy={busy}
        actions={
          <span role="group" aria-label="Chart period" style={{ display: "inline-flex", gap: 4 }}>
            {Object.entries(RANGES).map(([id, x]) => (
              <button key={id} type="button" className="viz-btn" aria-pressed={unit === id} data-testid={`biz-range-${id}`} onClick={() => setUnit(id)}>
                {x.label}
              </button>
            ))}
          </span>
        }
        legend={
          <Legend
            items={[
              { name: `${r.now}: ${money(s.total)}`, color: "var(--viz-accent)", line: true },
              { name: `${r.before}: ${money(s.previousTotal)}`, color: "var(--viz-context)", line: true },
            ]}
          />
        }
        table={{
          caption: `${r.title}: this period, the one before, and the split into new and re-subscribed`,
          columns: [
            { key: "p", label: unit === "day" ? "Day" : unit === "week" ? "Week starting" : "Month" },
            { key: "a", label: r.now, right: true },
            { key: "b", label: r.before, right: true },
            { key: "n", label: "New", right: true },
            { key: "r", label: "Re-subscribed", right: true },
          ],
          rows: labels.map((l, i) => ({ p: l, a: money(s.current[i]), b: money(s.previous[i]), n: money(s.newAmount[i]), r: money(s.renewalAmount[i]) })),
        }}
      >
        <div data-testid="biz-chart" data-unit={unit} data-total={s.total} data-previous-total={s.previousTotal}>
          <LineChart
            labels={labels}
            tickEvery={r.tick}
            titleOf={(i) => `${labels[i]} — ${r.name(i)}`}
            series={[
              { id: "prev", name: r.before, color: "var(--viz-context)", values: s.previous },
              { id: "cur", name: r.now, color: "var(--viz-accent)", values: s.current, area: true },
            ]}
            format={money}
            tickFormat={axis}
            summary={`${r.title}, ${r.now.toLowerCase()} against ${r.before.toLowerCase()}`}
          />
        </div>
      </Figure>

      {none ? (
        <Empty icon={<Wallet size={28} />} title="No payments written down yet">
          Shops pay outside the app, so the numbers above start at zero. Open a store → <strong>Payments</strong> → <strong>Write it down</strong> each time a shop pays. The first payment counts as a new sale, later ones as re-subscriptions.
        </Empty>
      ) : null}

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", marginTop: 14 }}>
        <Card title="Latest payments" subtitle="Newest first.">
          {b.recent.length === 0 ? (
            <p style={muted}>Nothing yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-testid="biz-recent">
              {b.recent.map((p) => (
                <div key={p.id} style={{ ...row, flexWrap: "wrap", gap: "4px 12px", alignItems: "center" }}>
                  <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                      {p.storeDeleted ? p.storeName : <Link to={`/platform/stores/${p.storeId}`}>{p.storeName}</Link>}
                      {p.storeDeleted ? <span style={{ ...muted, fontWeight: 400 }}> (deleted store)</span> : null}
                    </div>
                    <div style={muted}>
                      {dayText(p.paidOn)} · {p.planName || "No plan"} · {p.months} {p.months === 1 ? "month" : "months"}
                    </div>
                  </div>
                  <span style={{ fontWeight: 600 }}>{money(p.amount)}</span>
                  <Pill tone={p.kind === "new" ? "ok" : "info"}>{p.kind === "new" ? "New sale" : "Re-subscribed"}</Pill>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Who to follow up" subtitle="Shops with no payment written down, and shops that ran out.">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-testid="biz-followup">
            {b.standing.expiredStores.map((st) => (
              <div key={st.id} style={{ ...row, justifyContent: "space-between", gap: 10 }}>
                <Link to={`/platform/stores/${st.id}`} style={{ fontWeight: 600 }}>{st.name}</Link>
                <Pill tone="error">Ran out {dayText(st.paidUntil)}</Pill>
              </div>
            ))}
            {b.standing.neverPaidStores.map((st) => (
              <div key={st.id} style={{ ...row, justifyContent: "space-between", gap: 10 }}>
                <Link to={`/platform/stores/${st.id}`} style={{ fontWeight: 600 }}>{st.name}</Link>
                <Pill tone="warn">No payment written down</Pill>
              </div>
            ))}
            {!b.standing.expiredStores.length && !b.standing.neverPaidStores.length ? <p style={muted}>Everybody is paid up.</p> : null}
            {b.standing.neverPaid > b.standing.neverPaidStores.length ? <p style={muted}>…and {b.standing.neverPaid - b.standing.neverPaidStores.length} more with no payment written down.</p> : null}
          </div>
        </Card>

        <Card title="By plan" subtitle="Shops paid up now, and all the money taken, for each plan.">
          {b.byPlan.length === 0 ? (
            <p style={muted}>No plans yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }} data-testid="biz-plans">
              {b.byPlan.map((p) => (
                <div key={p.name} style={{ ...row, justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div style={muted}>
                      {count(p.activeShops)} {p.activeShops === 1 ? "shop" : "shops"} paid up
                    </div>
                  </div>
                  <span style={{ fontWeight: 600 }}>{money(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
