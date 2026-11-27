import { View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useApi, useMe } from "@/runtime";
import { canDo } from "@/lib/access";
import { changePct, count, rupees, rupeesShort } from "@/lib/format";
import { BusinessSection } from "./Business";
import { BarChart, CountUp, Donut, Glass, Grid, LineChart, LoadingCards, Meter, Pill, RankedBars, Screen, Section, Stat, Text, ErrorState, Reveal, useTheme } from "@/ui";

/** The platform's numbers: sales, stores, setup progress — figures that count up, charts that draw themselves and answer to a touch. */
export function Dashboard() {
  const api = useApi();
  const qc = useQueryClient();
  const me = useMe();
  const { c } = useTheme();
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => api.dashboard(false), staleTime: 60_000 });
  const d = q.data;
  const days = d?.sales.daily.current.map((_, i) => `${i + 1}`) ?? [];
  const mayOpenStores = canDo(me, "stores:read");

  return (
    <Screen title="Dashboard" subtitle={d ? `${d.today.label} · every store together` : "Loading the numbers…"} onRefresh={() => { void qc.invalidateQueries({ queryKey: ["business"] }); void api.dashboard(true).then(() => q.refetch()); }} refreshing={q.isFetching && !q.isLoading} testID="screen-dashboard">
      <BusinessSection />
      {q.isLoading ? <LoadingCards n={4} /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : d ? (
        <>
          <Section title="Across every store" hint="What the shops sell to their own customers, through Rasoi Pulse">
          <Reveal>
            <Glass blur strong radiusSize={28} padding={20}>
              <Text variant="overline" tone="muted">{d.sales.month.label} · sales through your stores</Text>
              <View style={{ marginTop: 6 }}><CountUp value={d.sales.month.revenue} format={rupees} variant="hero" /></View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                <Pill tone={(d.sales.month.revenueChangePct ?? 0) >= 0 ? "ok" : "danger"} icon="trend">{changePct(d.sales.month.revenueChangePct)} vs the same days last month</Pill>
                <Text variant="caption" tone="muted">{count(d.sales.month.orders)} orders · average {rupees(d.sales.month.avgOrder)}</Text>
              </View>
              <View style={{ marginTop: 14 }}>
                <LineChart testID="chart-daily" labels={days} series={[{ values: d.sales.daily.current, color: c.chart[0], label: "This month" }, { values: d.sales.daily.previous, color: c.chart[1], label: "Last month", dashed: true }]} format={rupeesShort} />
                <View style={{ flexDirection: "row", gap: 14, marginTop: 6 }}>
                  <Legend color={c.chart[0]!} text="This month" /><Legend color={c.chart[1]!} text="Last month" dashed />
                </View>
              </View>
            </Glass>
          </Reveal>
          </Section>

          <Grid min={150}>
            <Stat index={1} icon="stores" label="Stores" value={<CountUp value={d.totals.stores} format={count} />} sub={<Text variant="caption" tone="muted">{d.stores.activeLast30Days} ordered in 30 days</Text>} onPress={mayOpenStores ? () => router.push("/stores") : undefined} />
            <Stat index={2} icon="outlet" label="Outlets" value={<CountUp value={d.totals.outlets} format={count} />} />
            <Stat index={3} icon="team" label="People" value={<CountUp value={d.totals.people} format={count} />} sub={<Text variant="caption" tone="muted">on store teams</Text>} />
            <Stat index={4} icon="user" label="Customers" value={<CountUp value={d.totals.customers} format={count} />} />
            <Stat index={5} icon="orders" label="Orders today" value={<CountUp value={d.totals.ordersToday} format={count} />} tone="primary" />
            <Stat index={6} icon="rupee" label="Sales today" value={<CountUp value={d.totals.revenueToday} format={rupees} />} tone="primary" />
          </Grid>

          <Section title="Sales, month by month">
            <Glass><BarChart testID="chart-monthly" data={d.sales.monthly.map((m) => ({ label: m.label.slice(0, 3), value: m.revenue }))} format={rupeesShort} /></Glass>
          </Section>

          <Grid min={340}>
            <Section title="Top stores this month">
              <Glass>{d.sales.topStores.length ? <RankedBars rows={d.sales.topStores.map((s) => ({ id: s.id, label: s.name, value: s.revenue, note: `${count(s.orders)} orders · ${changePct(s.changePct)}` }))} format={rupeesShort} onPress={mayOpenStores ? (id) => router.push(`/stores/${id}`) : undefined} /> : <Text tone="muted">No sales yet this month.</Text>}</Glass>
            </Section>
            <Section title="Where orders come from">
              <Glass>{d.sales.channels.length ? <Donut testID="chart-channels" items={d.sales.channels.map((ch) => ({ label: ch.channel.replace("-", " "), value: ch.revenue }))} format={rupeesShort} centerBottom="sales" /> : <Text tone="muted">No orders yet.</Text>}</Glass>
            </Section>
          </Grid>

          <Section title="Stores" hint="Plan, standing and how far each has set up">
            <Glass>
              <View style={{ gap: 14 }}>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  <Pill tone="ok">{d.stores.status.ok} in good standing</Pill>
                  {d.stores.status.grace ? <Pill tone="warn">{d.stores.status.grace} in grace period</Pill> : null}
                  {d.stores.status.overLimit ? <Pill tone="danger">{d.stores.status.overLimit} over their limits</Pill> : null}
                  {d.stores.disabled ? <Pill tone="neutral">{d.stores.disabled} switched off</Pill> : null}
                  {d.leads?.new ? <Pill tone="info">{d.leads.new} new enquiries</Pill> : null}
                </View>
                {d.stores.byPlan.length ? <Donut items={d.stores.byPlan.map((p) => ({ label: p.name, value: p.count }))} centerBottom="stores" size={120} /> : null}
                {([["Menu added", d.stores.setup.withMenu], ["Tables added", d.stores.setup.withTables], ["Online payments on", d.stores.setup.withPayments]] as const).map(([label, n]) => (
                  <View key={label} style={{ gap: 5 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text variant="label">{label}</Text><Text variant="label" tone="muted">{n} of {d.stores.total}</Text></View>
                    <Meter value={d.stores.total ? n / d.stores.total : 0} />
                  </View>
                ))}
              </View>
            </Glass>
          </Section>
        </>
      ) : null}
    </Screen>
  );
}

function Legend({ color, text, dashed }: { color: string; text: string; dashed?: boolean }) {
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><View style={{ width: 16, height: 0, borderTopWidth: 3, borderColor: color, borderStyle: dashed ? "dashed" : "solid" }} /><Text variant="caption" tone="muted">{text}</Text></View>;
}
