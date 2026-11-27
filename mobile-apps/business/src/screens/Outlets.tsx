import { useState } from "react";
import { View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import type { CompareReport } from "@/api/endpoints";
import { rangeOfScope, useScope } from "@/data/scope";
import { useOptions, useReport } from "@/data/queries";
import { bucketLabel, rangeLabel } from "@/lib/dates";
import { count, rupees, rupeesShort, share } from "@/lib/format";
import { Async, Chips, Empty, Glass, Grid, KpiTile, LineChart, Pill, RankedBars, Screen, ScopeBar, Section, Text, useTheme } from "@/ui";
import { thin } from "./Sales";

type Metric = "sales" | "orders" | "aov" | "cancelled";
const METRICS: { value: Metric; label: string }[] = [{ value: "sales", label: "Sales" }, { value: "orders", label: "Orders" }, { value: "aov", label: "Average order" }, { value: "cancelled", label: "Cancelled" }];
const valueOf = (o: CompareReport["outlets"][number], m: Metric) => (m === "sales" ? o.kpis.sales : m === "orders" ? o.kpis.orders : m === "aov" ? o.kpis.aov : o.cancelled.rate);
const show = (m: Metric) => (m === "orders" ? count : m === "cancelled" ? (n: number) => share(n) : rupeesShort);

/** Outlets: every outlet side by side — sales, orders, the average order, cancellations, the best dishes — with one chart of the days. */
export function Outlets() {
  const { c } = useTheme();
  const options = useOptions();
  const qc = useQueryClient();
  const range = rangeOfScope(useScope());
  const q = useReport("compare", (api, s) => api.compare(s));
  const [metric, setMetric] = useState<Metric>("sales");
  return (
    <Screen title="Outlets" subtitle={rangeLabel(range)} onRefresh={() => void qc.invalidateQueries({ queryKey: ["report"] })} testID="screen-outlets">
      <ScopeBar outlets={options.data?.outlets ?? []} />
      <Async q={q} lines={2}>
        {(d) => {
          if (d.outlets.length === 0) return <Empty icon="outlet" title="No outlets to compare" />;
          const ranked = [...d.outlets].sort((a, b) => (metric === "cancelled" ? valueOf(a, metric) - valueOf(b, metric) : valueOf(b, metric) - valueOf(a, metric)));
          const best = ranked[0]!;
          return (
            <>
              <Chips testID="outlets-metric" value={metric} onChange={setMetric} options={METRICS} />
              <Section title={METRICS.find((m) => m.value === metric)!.label} hint={metric === "cancelled" ? "Share of orders cancelled — the lowest is best" : `Best: ${best.name}`}>
                <Glass><RankedBars rows={ranked.map((o) => ({ id: o.id, label: o.name, value: valueOf(o, metric), note: o.id === best.id ? "best" : undefined }))} format={show(metric)} /></Glass>
              </Section>
              {d.outlets.length > 1 && d.dayLabels.length > 1 ? (
                <Section title="Sales each day" hint="One line for each outlet">
                  <Glass>
                    <LineChart testID="chart-outlets-days" labels={thin(d.dayLabels.map((l) => bucketLabel(l, "day")))} format={rupeesShort} series={d.outlets.map((o, i) => ({ values: o.daily, color: c.chart[i % c.chart.length]!, label: o.name }))} />
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, paddingTop: 8 }}>
                      {d.outlets.map((o, i) => <View key={o.id} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.chart[i % c.chart.length] }} /><Text variant="caption" tone="muted">{o.name}</Text></View>)}
                    </View>
                  </Glass>
                </Section>
              ) : null}
              <View style={{ gap: 14 }}>
                {d.outlets.map((o) => (
                  <Section key={o.id} title={o.name} icon="outlet" action={o.id === ranked[0]!.id && d.outlets.length > 1 ? <Pill tone="ok" icon="trend">Top in {METRICS.find((m) => m.value === metric)!.label.toLowerCase()}</Pill> : undefined}>
                    <Grid min={140}>
                      <KpiTile testID={`outlet-sales-${o.id}`} icon="rupee" label="Sales" value={rupees(o.kpis.sales)} />
                      <KpiTile testID={`outlet-orders-${o.id}`} icon="orders" label="Orders" value={count(o.kpis.orders)} />
                      <KpiTile testID={`outlet-aov-${o.id}`} icon="receipt" label="Average order" value={rupees(o.kpis.aov)} />
                      <KpiTile testID={`outlet-cancel-${o.id}`} icon="circleX" label="Cancelled" value={count(o.cancelled.cancelled)} sub={`${share(o.cancelled.rate)} of orders`} invert />
                    </Grid>
                    {o.topItems.length ? <Glass testID={`outlet-best-${o.id}`}><Text variant="label">Best sellers</Text><View style={{ marginTop: 6 }}><RankedBars rows={o.topItems.slice(0, 3).map((t) => ({ label: t.name, value: t.qty }))} format={count} /></View></Glass> : null}
                  </Section>
                ))}
              </View>
            </>
          );
        }}
      </Async>
    </Screen>
  );
}
