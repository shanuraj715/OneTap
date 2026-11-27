import { useState } from "react";
import { View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import type { Granularity, Kpis } from "@/api/endpoints";
import { bucketLabel, lastYearRange, previousRange, presetRange, rangeLabel, shortMonth } from "@/lib/dates";
import { count, pctChange, rupees, rupeesShort } from "@/lib/format";
import { useOptions, useRangeReport, useReport } from "@/data/queries";
import { rangeOfScope, useScope } from "@/data/scope";
import { Async, BarChart, Chips, type IconName, Glass, Grid, KpiTile, LineChart, Pill, Screen, ScopeBar, Section, StackedAreaChart, Text, useTheme } from "@/ui";

type Compare = "previous" | "year" | "off";
const COMPARE: { value: Compare; label: string }[] = [{ value: "previous", label: "Period before" }, { value: "year", label: "Same dates last year" }, { value: "off", label: "No comparison" }];
const GRAN: { value: "auto" | Granularity; label: string }[] = [{ value: "auto", label: "Auto" }, { value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }];

/** Keep a few of a long list of chart labels and blank the rest, so they never crowd each other. */
export const thin = (labels: string[], keep = 6): string[] => {
  const step = Math.max(1, Math.ceil(labels.length / keep));
  return labels.map((l, i) => (i % step === 0 || i === labels.length - 1 ? l : ""));
};
/** A comparison series lined up with the main one, point for point (shorter ones are padded with zero). */
export const align = (values: number[], n: number): number[] => Array.from({ length: n }, (_, i) => values[i] ?? 0);

const KPI_DEFS: { key: keyof Kpis; label: string; icon: IconName; money: boolean; invert?: boolean }[] = [
  { key: "sales", label: "Sales", icon: "rupee", money: true },
  { key: "net", label: "Net sales (without GST)", icon: "wallet", money: true },
  { key: "orders", label: "Orders", icon: "orders", money: false },
  { key: "aov", label: "Average order", icon: "receipt", money: true },
  { key: "items", label: "Items sold", icon: "bag", money: false },
  { key: "customers", label: "Customers", icon: "user", money: false },
  { key: "discount", label: "Discounts given", icon: "percent", money: true, invert: true },
];

/**
 * Sales: the whole picture for the chosen period and outlets — headline numbers each with its change, one chart of sales over time against
 * the period before (or the same dates last year), sales by outlet stacked, the best weekdays, the whole of this year against last year.
 */
export function Sales() {
  const { c } = useTheme();
  const options = useOptions();
  const qc = useQueryClient();
  const scope = useScope();
  const range = rangeOfScope(scope);
  const [gran, setGran] = useState<"auto" | Granularity>("auto");
  const [cmp, setCmp] = useState<Compare>("previous");
  const g = gran === "auto" ? undefined : gran;
  const cmpRange = cmp === "previous" ? previousRange(range) : cmp === "year" ? lastYearRange(range) : null;
  const cur = useReport("sales-now", (api, s) => api.overview(s), { granularity: g });
  const base = useRangeReport("sales-base", cmpRange?.from ?? "", cmpRange?.to ?? "", (api, s) => api.overview(s), { granularity: cur.data?.granularity }, Boolean(cmpRange && cur.data));
  const byOutlet = useReport("sales-outlets", (api, s) => api.sales(s), { granularity: g });
  const cmpName = cmp === "year" ? "last year" : "the period before";

  return (
    <Screen title="Sales" subtitle={rangeLabel(range)} onRefresh={() => void qc.invalidateQueries({ queryKey: ["report"] })} testID="screen-sales">
      <ScopeBar outlets={options.data?.outlets ?? []} />
      <Chips testID="compare" value={cmp} options={COMPARE} onChange={setCmp} />

      <Async q={cur}>
        {(d) => {
          const prev = cmp === "off" ? null : base.data?.kpis ?? (cmp === "previous" ? d.previousKpis : null);
          const labels = d.series.map((p) => bucketLabel(p.key, d.granularity));
          const now = d.series.map((p) => p.sales);
          const was = base.data ? align(base.data.series.map((p) => p.sales), now.length) : null;
          return (
            <>
              <Grid min={160}>
                {KPI_DEFS.map((k) => (
                  <KpiTile key={k.key} testID={`kpi-${k.key}`} icon={k.icon} label={k.label} value={k.money ? rupees(d.kpis[k.key]) : count(d.kpis[k.key])} invert={k.invert}
                    delta={prev ? pctChange(d.kpis[k.key], prev[k.key]) : undefined} sub={prev ? `${k.money ? rupees(prev[k.key]) : count(prev[k.key])} ${cmpName}` : undefined} />
                ))}
                <KpiTile testID="kpi-cancelled" icon="circleX" label="Cancelled orders" value={count(d.cancellations.cancelled)} invert delta={cmp === "off" ? undefined : pctChange(d.cancellations.cancelled, d.previousCancellations.cancelled)} sub={`${Math.round(d.cancellations.rate * 1000) / 10}% of ${count(d.cancellations.placed)} placed`} />
              </Grid>

              <Section title="Sales over time" hint={cmp === "off" ? "By " + d.granularity : `By ${d.granularity} · dashed line = ${cmpName}`}>
                <Glass>
                  <View style={{ gap: 12 }}>
                    <Chips testID="granularity" value={gran} options={GRAN} onChange={setGran} />
                    <LineChart testID="chart-sales" labels={thin(labels)} format={rupeesShort} series={[{ values: now, color: c.chart[0]!, label: "Sales" }, ...(was ? [{ values: was, color: c.chart[1]!, label: cmpName, dashed: true }] : [])]} />
                    <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <Text variant="label" testID="sales-total">{rupees(d.kpis.sales)}</Text>
                      {base.data ? <Text variant="caption" tone="muted" testID="sales-base-total">{rupees(base.data.kpis.sales)} {cmpName}</Text> : null}
                      {base.data ? <Pill tone={d.kpis.sales >= base.data.kpis.sales ? "ok" : "danger"}>{`${d.kpis.sales >= base.data.kpis.sales ? "+" : "−"}${rupees(Math.abs(d.kpis.sales - base.data.kpis.sales))}`}</Pill> : null}
                    </View>
                  </View>
                </Glass>
              </Section>

              <Section title="Orders over time">
                <Glass><BarChart testID="chart-orders" data={d.series.map((p, i) => ({ label: thin(labels)[i] ?? "", value: p.orders }))} color={c.chart[1]} /></Glass>
              </Section>
            </>
          );
        }}
      </Async>

      <Async q={byOutlet} lines={1}>
        {(s) => (
          <>
            <Section title="Sales by outlet" hint="Stacked: how each outlet adds to the total. Touch and drag to read a point.">
              <Glass>
                <StackedAreaChart testID="chart-outlets" labels={thin(s.buckets.map((b) => bucketLabel(b, s.granularity)), 12)} layers={s.perOutlet.map((o) => ({ label: o.name, values: o.values }))} format={rupeesShort} />
              </Glass>
            </Section>
            <Section title="Best days of the week" hint="Average sales on each weekday in this period">
              <Glass>
                <BarChart testID="chart-weekdays" data={s.weekdays.map((w) => ({ label: w.name.slice(0, 3), value: w.avgSales }))} format={rupeesShort} color={c.chart[2]} />
                {s.weekdays.some((w) => w.avgSales > 0) ? <Text variant="caption" tone="muted" style={{ marginTop: 6 }} testID="best-day">Best: {[...s.weekdays].sort((a, b) => b.avgSales - a.avgSales)[0]!.name} ({rupees([...s.weekdays].sort((a, b) => b.avgSales - a.avgSales)[0]!.avgSales)} on average)</Text> : null}
              </Glass>
            </Section>
          </>
        )}
      </Async>

      <YearAgainstYear />
    </Screen>
  );
}

/** The whole of this year against last year, month by month — whatever period is chosen above. */
function YearAgainstYear() {
  const { c } = useTheme();
  const a = presetRange("thisYear");
  const b = presetRange("lastYear");
  const now = useRangeReport("yoy-now", a.from, a.to, (api, s) => api.overview(s), { granularity: "month" });
  const before = useRangeReport("yoy-before", b.from, b.to, (api, s) => api.overview(s), { granularity: "month" });
  return (
    <Section title="This year against last year" hint="Month by month · dashed line = last year" icon="trend">
      <Glass testID="yoy">
        {now.data && before.data ? (
          <View style={{ gap: 10 }}>
            <LineChart testID="chart-yoy" labels={now.data.series.map((p) => shortMonth(`${p.key}-01`))} format={rupeesShort} series={[{ values: now.data.series.map((p) => p.sales), color: c.chart[0]!, label: "This year" }, { values: align(before.data.series.map((p) => p.sales), now.data.series.length), color: c.chart[1]!, label: "Last year", dashed: true }]} />
            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Text variant="label" testID="yoy-now">{rupees(now.data.kpis.sales)} this year</Text>
              <Text variant="caption" tone="muted" testID="yoy-before">{rupees(before.data.kpis.sales)} last year</Text>
            </View>
          </View>
        ) : <Text tone="muted">Loading the year…</Text>}
      </Glass>
    </Section>
  );
}
