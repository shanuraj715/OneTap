import { useMemo, useState } from "react";
import { Linking, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { rangeOfScope, useScope } from "@/data/scope";
import { useOptions, useReport } from "@/data/queries";
import { prettyDay, rangeLabel } from "@/lib/dates";
import { count, rupees, share } from "@/lib/format";
import { Async, BarChart, Button, Donut, Empty, Glass, Grid, KpiTile, Row, Screen, ScopeBar, SearchField, Section, Text, useTheme } from "@/ui";

/** Customers: how many, new or coming back, how many orders each places, who spends most, and the regulars who have gone quiet. */
export function Customers() {
  const { c } = useTheme();
  const options = useOptions();
  const qc = useQueryClient();
  const range = rangeOfScope(useScope());
  const q = useReport("customers", (api, s) => api.customers(s));
  const [search, setSearch] = useState("");
  const top = useMemo(() => (q.data?.top ?? []).filter((t) => !search.trim() || `${t.name} ${t.phone}`.toLowerCase().includes(search.trim().toLowerCase())), [q.data, search]);
  return (
    <Screen title="Customers" subtitle={rangeLabel(range)} onRefresh={() => void qc.invalidateQueries({ queryKey: ["report"] })} testID="screen-customers">
      <ScopeBar outlets={options.data?.outlets ?? []} />
      <Async q={q} lines={2}>
        {(d) => d.newVsRepeat.customers === 0 ? <Empty icon="user" title="No customers in this period" message="Pick a longer period or another outlet." /> : (
          <>
            <Grid min={150}>
              <KpiTile testID="cust-total" icon="users" label="Customers" value={count(d.newVsRepeat.customers)} />
              <KpiTile testID="cust-new" icon="sparkles" label="New" value={count(d.newVsRepeat.newCustomers)} sub={`${share(d.newVsRepeat.newCustomers / d.newVsRepeat.customers)} of customers`} />
              <KpiTile testID="cust-repeat" icon="refresh" label="Coming back" value={count(d.newVsRepeat.repeatCustomers)} sub={`${share(d.newVsRepeat.repeatCustomers / d.newVsRepeat.customers)} of customers`} />
            </Grid>
            <Grid min={300}>
              <Section title="New and returning"><Glass><Donut testID="chart-cust-split" items={[{ label: "New", value: d.newVsRepeat.newCustomers }, { label: "Coming back", value: d.newVsRepeat.repeatCustomers }]} centerTop={count(d.newVsRepeat.customers)} centerBottom="customers" /></Glass></Section>
              <Section title="Orders each customer placed"><Glass><BarChart testID="chart-cust-orders" color={c.chart[1]} data={d.ordersPerCustomer.map((b) => ({ label: b.bucket, value: b.customers }))} /></Glass></Section>
            </Grid>
            <Section title="Regulars who went quiet" hint={`Customers who ordered before but not for a while (of ${count(d.lapsed.ofAll)} regulars)`} icon="clock">
              <Grid min={150}>
                <KpiTile testID="lapsed-30" label="30 days or more" value={count(d.lapsed.days30)} icon="clock" />
                <KpiTile testID="lapsed-60" label="60 days or more" value={count(d.lapsed.days60)} icon="clock" />
                <KpiTile testID="lapsed-90" label="90 days or more" value={count(d.lapsed.days90)} icon="clock" />
              </Grid>
            </Section>
            <Section title="Your best customers" hint="By what they spent in this period">
              <SearchField value={search} onChange={setSearch} placeholder="Find a customer" testID="cust-search" />
              {top.length ? (
                <View style={{ gap: 10, marginTop: 10 }}>
                  {top.map((t, i) => (
                    <Row key={t.id} index={i} testID={`cust-${t.id}`} icon="person" title={t.name || "Customer"} subtitle={`${t.phone} · ${count(t.orders)} ${t.orders === 1 ? "order" : "orders"} · last ${prettyDay(t.last.slice(0, 10))}`}
                      right={<View style={{ alignItems: "flex-end", gap: 6 }}><Text variant="subheading">{rupees(t.spend)}</Text>{t.phone ? <Button size="sm" variant="glass" icon="phone" title="Call" onPress={() => void Linking.openURL(`tel:${t.phone}`)} testID={`cust-call-${t.id}`} /> : null}</View>} />
                  ))}
                </View>
              ) : <Empty icon="search" title="No customer by that name or number" />}
            </Section>
          </>
        )}
      </Async>
    </Screen>
  );
}
