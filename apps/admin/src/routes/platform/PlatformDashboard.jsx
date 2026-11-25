import { useState } from "react";
import { Link } from "../../lib/nav";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Building2, Inbox, LayoutDashboard, RefreshCw, ReceiptText, Store, UserRound, Users } from "lucide-react";
import * as api from "../../lib/api";
import { useDashboard } from "../../lib/usePlatform";
import { Button, Card, Empty, PageHeader } from "../../ui";
import { LoginActivity } from "./LoginActivity";
import { CacheStrip } from "./CachePanels";
import { ServerStrip } from "./ServerParts";
import { ChangeBars, ColumnChart, Figure, Hero, LineChart, Legend, Meter, RankedBars, SegmentedBar, StatTile } from "./viz/charts";
import { ago, axisCount, axisMoney, count, rupees, rupeesFlat, signedPct } from "./viz/format";
import { DisabledPill, muted, row, StatusPill } from "./shared";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Mar", but "Jan ’26" at the start of a year, so the year is never in doubt. */
const monthTick = (label, year, month) => (month === 1 ? `${label} ’${String(year).slice(2)}` : label);
const CHANNELS = {
  "dine-in": { name: "Dine-in", color: "var(--viz-accent)" },
  takeaway: { name: "Takeaway", color: "var(--viz-slot-2)" },
  delivery: { name: "Delivery", color: "var(--viz-slot-3)" },
};

/** A running total that stops where the data stops. */
const running = (values) => {
  let total = 0;
  return values.map((v) => (v === null ? null : (total += v)));
};

/**
 * The platform owner's home: how much is selling through every store, how this
 * month and year compare with the last, which stores lead, how set up the stores
 * are, what the subscriptions add up to, and who has been signing in.
 */
export function PlatformDashboard() {
  const q = useDashboard();
  const qc = useQueryClient();
  const refresh = useMutation({
    mutationFn: () => api.getDashboard(true),
    onSuccess: (fresh) => qc.setQueryData(["platform", "dashboard"], fresh),
  });
  const d = q.data;
  const busy = (q.isFetching && Boolean(d)) || refresh.isPending;

  const header = (
    <PageHeader
      title="Dashboard"
      icon={<LayoutDashboard size={23} />}
      subtitle="Every store on Rasoi Pulse at a glance."
      action={
        <div style={{ display: "flex", alignItems: "center" }}>
          {d ? (
            <span className="dash-updated" title="The numbers are kept for a few minutes (Settings → Cache). Refresh to recompute them now.">
              Updated {ago(d.generatedAt)}
            </span>
          ) : null}
          <Button variant="outline" disabled={refresh.isPending} onClick={() => refresh.mutate()} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <RefreshCw size={13} /> {refresh.isPending ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      }
    />
  );

  if (!d) {
    return (
      <>
        {header}
        <p style={muted}>{q.isError ? q.error.message : "Loading…"}</p>
      </>
    );
  }

  const { sales, stores, subscriptions, totals } = d;
  const hasSales = sales.monthly.some((r) => r.orders > 0);

  return (
    <>
      {header}
      <div className="dash viz">
        {/* ----------------------------------------------------------- headline numbers */}
        <div className="dash-top">
          <Hero
            label="Sales this month"
            value={rupees(sales.month.revenue)}
            delta={sales.month.revenueChangePct}
            deltaNote="vs the same days of last month"
            note={`${sales.month.label} so far · ${count(sales.month.orders)} ${sales.month.orders === 1 ? "order" : "orders"}`}
            spark={sales.monthly.map((r) => r.revenue)}
          />
          <div className="dash-kpis">
            <StatTile
              label="Orders this month"
              value={count(sales.month.orders)}
              delta={sales.month.ordersChangePct}
              deltaNote="vs the same days of last month"
              spark={sales.monthly.map((r) => r.orders)}
            />
            <StatTile label="Average order" value={rupees(sales.month.avgOrder)} note="this month" />
            <StatTile
              label={`Sales in ${sales.year.label} so far`}
              value={rupees(sales.year.revenue, { compact: true })}
              delta={sales.year.revenueChangePct}
              deltaNote="vs the same period last year"
              title={rupees(sales.year.revenue)}
            />
            <StatTile
              label="Subscriptions, estimated"
              value={`${rupeesFlat(subscriptions.monthlyRecurring)}/mo`}
              note={`${subscriptions.payingStores} paying ${subscriptions.payingStores === 1 ? "store" : "stores"} · from plan prices`}
              title="Estimated from each plan's listed price × the stores on it — not money received"
            />
          </div>
        </div>

        <ServerStrip />
        <CacheStrip />

        <div className="dash-counts">
          <StatTile
            to="/platform/stores"
            icon={<Store size={14} />}
            label="Stores"
            value={count(totals.stores)}
            note={stores.disabled ? `${count(stores.disabled)} disabled` : undefined}
          />
          <StatTile icon={<Building2 size={14} />} label="Outlets" value={count(totals.outlets)} />
          <StatTile icon={<Users size={14} />} label="Staff accounts" value={count(totals.people)} />
          <StatTile icon={<UserRound size={14} />} label="Customers" value={count(totals.customers)} />
          <StatTile icon={<ReceiptText size={14} />} label="Orders today" value={count(totals.ordersToday)} note={rupees(totals.revenueToday)} />
          <StatTile to="/platform/leads" icon={<Inbox size={14} />} label="New enquiries" value={count(d.leads.new)} note={d.leads.new ? "waiting for a reply" : "all answered"} />
        </div>

        {/* ----------------------------------------------------------------- the sales */}
        <h2 className="dash-h">Sales through your stores</h2>
        {!hasSales ? (
          <Card>
            <Empty icon={<ReceiptText size={28} />} title="No orders yet">
              These charts fill in as your stores take orders. Cancelled orders are never counted.
            </Empty>
          </Card>
        ) : (
          <>
            <SalesByMonth monthly={sales.monthly} busy={busy} />

            <div className="dash-2">
              <GrowthChart monthly={sales.monthly} busy={busy} />
              <YearOverYear sales={sales} year={d.today.year} month={d.today.month} busy={busy} />
            </div>

            <div className="dash-2">
              <MonthToDate sales={sales} today={d.today} busy={busy} />
              <SalesByYear yearly={sales.yearly} busy={busy} />
            </div>

            <div className="dash-2">
              <Figure
                title="Top stores this month"
                subtitle="Sales this month so far, compared with the same days of last month."
                busy={busy}
                table={{
                  caption: "Top stores this month",
                  columns: [
                    { key: "name", label: "Store" },
                    { key: "sales", label: "Sales", right: true },
                    { key: "orders", label: "Orders", right: true },
                    { key: "last", label: "Last month, same days", right: true },
                    { key: "change", label: "Change", right: true },
                  ],
                  rows: sales.topStores.map((s) => ({ name: s.name, sales: rupees(s.revenue), orders: count(s.orders), last: rupees(s.prevRevenue), change: signedPct(s.changePct) })),
                }}
              >
                {sales.topStores.length === 0 ? (
                  <Empty title="No sales this month yet" />
                ) : (
                  <RankedBars
                    deltaNote="vs the same days of last month"
                    rows={sales.topStores.map((s) => ({ id: s.id, label: s.name, value: s.revenue, display: rupees(s.revenue), delta: s.changePct, href: `/platform/stores/${s.id}`, note: `${count(s.orders)} orders` }))}
                  />
                )}
              </Figure>
              <ChannelSplit channels={sales.channels} label={sales.month.label} busy={busy} />
            </div>
          </>
        )}

        {/* ----------------------------------------------------------------- the stores */}
        <h2 className="dash-h">Stores</h2>
        <div className="dash-3">
          <Figure
            title="Stores by plan"
            busy={busy}
            table={{ caption: "Stores by plan", columns: [{ key: "plan", label: "Plan" }, { key: "n", label: "Stores", right: true }], rows: stores.byPlan.map((p) => ({ plan: p.name, n: count(p.count) })) }}
          >
            {stores.byPlan.length === 0 ? (
              <Empty title="No stores yet" />
            ) : (
              <RankedBars rows={stores.byPlan.map((p) => ({ id: p.name, label: p.name, value: p.count, display: `${p.count} ${p.count === 1 ? "store" : "stores"}` }))} />
            )}
          </Figure>

          <Figure
            title="New stores each month"
            subtitle={`${count(stores.total)} in total`}
            busy={busy}
            table={{
              caption: "New stores each month",
              columns: [{ key: "m", label: "Month" }, { key: "added", label: "New", right: true }, { key: "total", label: "Total", right: true }],
              rows: stores.created.map((r) => ({ m: r.label, added: count(r.added), total: count(r.total) })),
            }}
          >
            <ColumnChart
              height={200}
              name="New stores"
              summary="New stores each month, over the last 12 months"
              data={stores.created.map((r, i) => ({ key: r.key, label: monthTick(r.label, Number(r.key.slice(0, 4)), Number(r.key.slice(5))), value: r.added, partial: i === stores.created.length - 1, tip: [`${r.total} in total`] }))}
              format={count}
              tickFormat={axisCount(Math.max(...stores.created.map((r) => r.added)))}
            />
          </Figure>

          <Figure
            title="How set up are the stores?"
            subtitle={`Out of ${stores.total} ${stores.total === 1 ? "store" : "stores"}.`}
            busy={busy}
            table={{
              caption: "How many stores have each thing set up",
              columns: [{ key: "what", label: "Set up" }, { key: "n", label: "Stores", right: true }, { key: "of", label: "Out of", right: true }],
              rows: [
                { what: "Have a menu", n: count(stores.setup.withMenu), of: count(stores.total) },
                { what: "Have tables set up", n: count(stores.setup.withTables), of: count(stores.total) },
                { what: "Can take online payments", n: count(stores.setup.withPayments), of: count(stores.total) },
                { what: "Took an order in the last 30 days", n: count(stores.activeLast30Days), of: count(stores.total) },
              ],
            }}
          >
            <div style={{ display: "grid", gap: 14, paddingTop: 4 }}>
              <Meter label="Have a menu" value={stores.setup.withMenu} total={stores.total} />
              <Meter label="Have tables set up" value={stores.setup.withTables} total={stores.total} />
              <Meter label="Can take online payments" value={stores.setup.withPayments} total={stores.total} />
              <Meter label="Took an order in the last 30 days" value={stores.activeLast30Days} total={stores.total} />
            </div>
          </Figure>
        </div>

        <div className="dash-2">
          <Card title="Subscriptions, estimated" subtitle="Each plan's listed monthly price × the stores on it. There is no billing in Rasoi Pulse yet, so this is not money received and has no history.">
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <div style={muted}>Per month</div>
                <div style={{ fontSize: 24, fontWeight: 650 }}>{rupeesFlat(subscriptions.monthlyRecurring)}</div>
              </div>
              <div>
                <div style={muted}>Per year</div>
                <div style={{ fontSize: 24, fontWeight: 650 }}>{rupeesFlat(subscriptions.yearlyRecurring)}</div>
              </div>
            </div>
            {subscriptions.byPlan.length === 0 ? (
              <p style={muted}>No store is on a plan yet.</p>
            ) : (
              <table className="viz-table viz">
                <thead>
                  <tr>
                    <th>Plan</th>
                    <th className="r">Stores</th>
                    <th className="r">Price / month</th>
                    <th className="r">Adds up to</th>
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.byPlan.map((p) => (
                    <tr key={p.name}>
                      <td>{p.name}</td>
                      <td className="r">{count(p.stores)}</td>
                      <td className="r">{p.monthly ? rupeesFlat(p.monthly) : "set by hand"}</td>
                      <td className="r">{p.mrr ? rupeesFlat(p.mrr) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {subscriptions.unpricedStores > 0 ? (
              <p style={{ ...muted, marginTop: 10 }}>
                {subscriptions.unpricedStores} {subscriptions.unpricedStores === 1 ? "store is" : "stores are"} on a plan with no listed price (such as Custom) and {subscriptions.unpricedStores === 1 ? "isn't" : "aren't"} counted.
              </p>
            ) : null}
          </Card>

          <Card title="Needs attention" icon={<AlertTriangle size={16} />} subtitle="Stores over a plan limit — in their grace period, or past it — and stores you have disabled.">
            <p style={{ ...muted, marginTop: 0 }}>
              {stores.status.ok} within plan · {stores.status.grace} in grace · {stores.status.overLimit} over limit · {stores.disabled} disabled
            </p>
            {stores.attention.length === 0 ? (
              <p style={muted}>Every store is within its plan and switched on.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {stores.attention.map((s) => (
                  <Link key={s.id} to={`/platform/stores/${s.id}`} style={{ ...row, textDecoration: "none", color: "inherit" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>{s.name}</div>
                      <div style={muted}>{s.plan ?? "No plan"}</div>
                    </div>
                    <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <DisabledPill store={{ disabled: s.disabled ? {} : null }} />
                      {s.status !== "ok" ? <StatusPill store={{ status: s.status, grace: { until: s.graceUntil } }} /> : null}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ------------------------------------------------------------------ sign-ins */}
        <h2 className="dash-h">Security</h2>
        <LoginActivity />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------- the charts */

function SalesByMonth({ monthly, busy }) {
  const [metric, setMetric] = useState("sales");
  const money = metric === "sales";
  const data = monthly.map((r, i) => ({
    key: r.key,
    label: monthTick(r.label, r.year, r.month),
    value: money ? r.revenue : r.orders,
    partial: i === monthly.length - 1,
    tip: [money ? `${count(r.orders)} orders` : `${rupees(r.revenue)} in sales`],
  }));
  const max = Math.max(...data.map((x) => x.value));
  return (
    <Figure
      title="Sales by month"
      subtitle="Orders placed with your stores over the last 12 months. Cancelled orders are left out."
      busy={busy}
      note="The lighter column is the month still in progress."
      actions={
        <div className="dash-toggle" role="group" aria-label="Show">
          <button type="button" aria-pressed={money} onClick={() => setMetric("sales")}>
            Sales
          </button>
          <button type="button" aria-pressed={!money} onClick={() => setMetric("orders")}>
            Orders
          </button>
        </div>
      }
      table={{
        caption: "Sales and orders by month",
        columns: [
          { key: "m", label: "Month" },
          { key: "sales", label: "Sales", right: true },
          { key: "orders", label: "Orders", right: true },
          { key: "change", label: "vs month before", right: true },
        ],
        rows: monthly.map((r) => ({ m: `${r.label} ${r.year}`, sales: rupees(r.revenue), orders: count(r.orders), change: signedPct(r.changePct) })),
      }}
    >
      <ColumnChart
        data={data}
        name={money ? "Sales" : "Orders"}
        summary={`${money ? "Sales" : "Orders"} by month, last 12 months`}
        format={money ? (v) => rupees(v) : count}
        labelFormat={money ? (v) => rupees(v, { compact: true }) : count}
        tickFormat={money ? axisMoney(max) : axisCount(max)}
      />
    </Figure>
  );
}

function GrowthChart({ monthly, busy }) {
  return (
    <Figure
      title="Up or down on the month before"
      subtitle="How each month's sales compare with the month before it."
      busy={busy}
      note="The lighter column is the month in progress — compared with the same days of last month."
      legend={
        <Legend
          items={[
            { name: "Up on the month before", color: "var(--viz-pole-up)" },
            { name: "Down", color: "var(--viz-pole-down)" },
          ]}
        />
      }
      table={{
        caption: "Change in sales on the month before",
        columns: [{ key: "m", label: "Month" }, { key: "sales", label: "Sales", right: true }, { key: "change", label: "Change", right: true }],
        rows: monthly.map((r) => ({ m: `${r.label} ${r.year}`, sales: rupees(r.revenue), change: signedPct(r.changePct) })),
      }}
    >
      <ChangeBars
        summary="Change in sales on the month before, for the last 12 months"
        data={monthly.map((r, i) => ({ key: r.key, label: monthTick(r.label, r.year, r.month), value: r.changePct, partial: r.partial, tip: `${rupees(r.revenue)} · ${count(r.orders)} orders` }))}
      />
    </Figure>
  );
}

function YearOverYear({ sales, year, month, busy }) {
  const { thisYear, lastYear } = sales.yearOverYear;
  const max = Math.max(...thisYear.filter((v) => v !== null), ...lastYear);
  const series = [
    { id: "last", name: `Last year (${year - 1})`, endLabel: String(year - 1), color: "var(--viz-context)", values: lastYear },
    { id: "this", name: `This year (${year})`, endLabel: String(year), color: "var(--viz-accent)", values: thisYear },
  ];
  return (
    <Figure
      title="This year against last year"
      subtitle="Sales in each month of the year."
      busy={busy}
      note={`${MONTHS[month - 1]} is still in progress, so its point is still climbing.`}
      legend={<Legend items={[{ name: `${year}`, color: "var(--viz-accent)", line: true }, { name: `${year - 1}`, color: "var(--viz-context)", line: true }]} />}
      table={{
        caption: "Sales by month, this year and last",
        columns: [{ key: "m", label: "Month" }, { key: "a", label: String(year), right: true }, { key: "b", label: String(year - 1), right: true }, { key: "c", label: "Change", right: true }],
        rows: MONTHS.map((m, i) => ({
          m,
          a: thisYear[i] === null ? "—" : rupees(thisYear[i]),
          b: rupees(lastYear[i]),
          c: thisYear[i] === null || !lastYear[i] ? "–" : signedPct(Math.round(((thisYear[i] - lastYear[i]) / lastYear[i]) * 1000) / 10),
        })),
      }}
    >
      <LineChart labels={MONTHS} series={series} format={(v) => rupees(v)} tickFormat={axisMoney(max)} summary={`Sales by month, ${year} against ${year - 1}`} />
    </Figure>
  );
}

function MonthToDate({ sales, today, busy }) {
  const length = Math.max(sales.daily.current.length, sales.daily.previous.length);
  const pad = (values) => [...values, ...Array(length - values.length).fill(null)];
  const current = running(pad(sales.daily.current));
  const previous = running(pad(sales.daily.previous));
  const prevName = MONTHS[(today.month + 10) % 12];
  const thisName = MONTHS[today.month - 1];
  const max = Math.max(...current.filter((v) => v !== null), ...previous.filter((v) => v !== null), 0);
  const labels = Array.from({ length }, (_, i) => String(i + 1));
  return (
    <Figure
      title="This month against last month"
      subtitle="Running total of sales, day by day — are you ahead of last month?"
      busy={busy}
      legend={<Legend items={[{ name: thisName, color: "var(--viz-accent)", line: true }, { name: prevName, color: "var(--viz-context)", line: true }]} />}
      table={{
        caption: "Running total of sales by day of the month",
        columns: [{ key: "d", label: "Day" }, { key: "a", label: thisName, right: true }, { key: "b", label: prevName, right: true }],
        rows: labels.map((l, i) => ({ d: l, a: current[i] === null ? "—" : rupees(current[i]), b: previous[i] === null ? "—" : rupees(previous[i]) })),
      }}
    >
      <LineChart
        labels={labels}
        tickEvery={5}
        titleOf={(i) => `Day ${i + 1}`}
        series={[
          { id: "prev", name: prevName, color: "var(--viz-context)", values: previous },
          { id: "cur", name: thisName, color: "var(--viz-accent)", values: current, area: true },
        ]}
        format={(v) => rupees(v)}
        tickFormat={axisMoney(max)}
        summary={`Running total of sales by day, ${thisName} against ${prevName}`}
      />
    </Figure>
  );
}

function SalesByYear({ yearly, busy }) {
  const max = Math.max(...yearly.map((r) => r.revenue));
  return (
    <Figure
      title="Sales by year"
      subtitle="The last five years."
      busy={busy}
      note="The lighter column is the year in progress."
      table={{
        caption: "Sales by year",
        columns: [{ key: "y", label: "Year" }, { key: "sales", label: "Sales", right: true }, { key: "orders", label: "Orders", right: true }, { key: "change", label: "vs year before", right: true }],
        rows: yearly.map((r) => ({ y: r.year, sales: rupees(r.revenue), orders: count(r.orders), change: signedPct(r.changePct) })),
      }}
    >
      <ColumnChart
        name="Sales"
        summary="Sales by year, for the last five years"
        data={yearly.map((r, i) => ({ key: String(r.year), label: String(r.year), value: r.revenue, partial: i === yearly.length - 1, tip: [`${count(r.orders)} orders`, r.changePct === null ? "" : `${signedPct(r.changePct)} on the year before`].filter(Boolean) }))}
        format={(v) => rupees(v)}
        labelFormat={(v) => rupees(v, { compact: true })}
        tickFormat={axisMoney(max)}
      />
    </Figure>
  );
}

function ChannelSplit({ channels, label, busy }) {
  const total = channels.reduce((n, c) => n + c.orders, 0);
  return (
    <Figure
      title="How customers order"
      subtitle={`Orders by channel, ${label} so far.`}
      busy={busy}
      table={{
        caption: `Orders by channel, ${label}`,
        columns: [{ key: "c", label: "Channel" }, { key: "o", label: "Orders", right: true }, { key: "s", label: "Sales", right: true }, { key: "p", label: "Last month's orders", right: true }],
        rows: channels.map((c) => ({ c: CHANNELS[c.channel].name, o: count(c.orders), s: rupees(c.revenue), p: count(c.prevOrders) })),
      }}
    >
      {total === 0 ? (
        <Empty title="No orders this month yet" />
      ) : (
        <SegmentedBar parts={channels.map((c) => ({ id: c.channel, name: CHANNELS[c.channel].name, value: c.orders, color: CHANNELS[c.channel].color, display: `${count(c.orders)} orders` }))} />
      )}
    </Figure>
  );
}
