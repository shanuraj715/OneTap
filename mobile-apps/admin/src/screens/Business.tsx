import { useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useApi, useMe } from "@/runtime";
import { canDo } from "@/lib/access";
import type { BusinessUnit } from "@/api/endpoints";
import { changePct, count, money, moneyShort } from "@/lib/format";
import { prettyDay } from "@/ui/calendar";
import { CountUp, Empty, Glass, Grid, LineChart, Pill, Reveal, Row, Section, Segmented, Stat, Text, useTheme } from "@/ui";

const RANGES: Record<BusinessUnit, { label: string; now: string; before: string; title: string }> = {
  day: { label: "Day", now: "Last 30 days", before: "The 30 days before", title: "Sales by day" },
  week: { label: "Week", now: "Last 12 weeks", before: "The 12 weeks before", title: "Sales by week" },
  month: { label: "Month", now: "Last 12 months", before: "The 12 months before", title: "Sales by month" },
};

/**
 * Rasoi Pulse's OWN business, at the top of the dashboard: what the shops pay for the product — total sales, new sales (shops that bought for
 * the first time), re-subscribed (shops that paid again), who has run out — and ONE chart that switches between day, week and month, each
 * against the period before it. Nothing here is a store's own orders or sales; those are further down the dashboard.
 */
export function BusinessSection() {
  const api = useApi();
  const me = useMe();
  const { c } = useTheme();
  const q = useQuery({ queryKey: ["business"], queryFn: () => api.business(), staleTime: 60_000 });
  const [unit, setUnit] = useState<BusinessUnit>("month");
  const b = q.data;
  const mayOpenStores = canDo(me, "stores:read");

  if (q.isLoading) return <Glass testID="business-loading"><Text tone="muted">Loading Rasoi Pulse&apos;s sales…</Text></Glass>;
  // a role the server turns away gets nothing from this section (the dashboard around it already says "Not allowed"); any other trouble is one quiet line — pulling the screen down loads it again
  if ((q.error as { status?: number } | null)?.status === 403) return null;
  if (q.isError || !b) return <Glass testID="business-error"><Text tone="muted">Rasoi Pulse&apos;s own sales could not be loaded. Pull down to try again.</Text></Glass>;

  const s = b.series[unit];
  const r = RANGES[unit];
  const none = b.totals.payments === 0;
  return (
    <View style={{ gap: 14 }} testID="business">
      <Section title="Rasoi Pulse business" hint="What the shops pay you for the product — not what they sell to their customers">
        <Reveal>
          <Glass blur strong radiusSize={28} padding={20}>
            <Text variant="overline" tone="muted">Total sales of Rasoi Pulse</Text>
            <View style={{ marginTop: 6 }}><CountUp value={Math.round(b.totals.sales * 100)} format={(paise) => money(paise / 100)} variant="hero" /></View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
              <Pill tone={b.month.changePct === null ? "neutral" : b.month.changePct >= 0 ? "ok" : "danger"} icon="trend">{b.month.changePct === null ? "Nothing to compare with last month yet" : `${changePct(b.month.changePct)} this month vs the same days last month`}</Pill>
              <Text variant="caption" tone="muted">{count(b.totals.payments)} {b.totals.payments === 1 ? "payment" : "payments"} from {count(b.totals.shops)} {b.totals.shops === 1 ? "shop" : "shops"} · {b.month.label}: {money(b.month.sales)}</Text>
            </View>
          </Glass>
        </Reveal>
      </Section>

      <Grid min={150}>
        <Stat index={1} icon="stores" tone="primary" label="New sales" value={<CountUp value={b.newSales.shops} format={count} />} sub={<Text variant="caption" tone="muted">{money(b.newSales.amount)} · shops that bought for the first time{b.month.newShops ? ` · ${b.month.newShops} this month` : ""}</Text>} />
        <Stat index={2} icon="refresh" tone="primary" label="Re-subscribed" value={<CountUp value={b.renewals.payments} format={count} />} sub={<Text variant="caption" tone="muted">{money(b.renewals.amount)} · {count(b.renewals.shops)} {b.renewals.shops === 1 ? "shop" : "shops"} paid again{b.month.renewals ? ` · ${b.month.renewals} this month` : ""}</Text>} />
        <Stat index={3} icon="circleCheck" label="Paid up now" value={<CountUp value={b.standing.active} format={count} />} sub={<Text variant="caption" tone="muted">{b.standing.expiringSoon ? `${b.standing.expiringSoon} run out within 14 days` : "none run out in the next 14 days"}</Text>} />
        <Stat index={4} icon="alert" tone={b.standing.expired ? "warn" : "neutral"} label="Ran out" value={<CountUp value={b.standing.expired} format={count} />} sub={<Text variant="caption" tone="muted">{b.standing.expired ? "not renewed — worth a call" : "nobody has lapsed"}</Text>} />
      </Grid>

      {none ? (
        <Empty icon="wallet" title="No payments written down yet" message="Shops pay outside the app, so these numbers start at zero. Open a store → Subscription payments → Write a payment down, each time a shop pays. The first payment counts as a new sale, later ones as re-subscriptions." />
      ) : null}

      <Section title={r.title} hint={`${r.now} against ${r.before.toLowerCase()}`}>
        <Glass>
          <View style={{ gap: 12 }}>
            <Segmented testID="business-range" value={unit} onChange={setUnit} options={(Object.keys(RANGES) as BusinessUnit[]).map((u) => ({ value: u, label: RANGES[u].label }))} />
            <LineChart testID="chart-business" labels={s.labels} series={[{ values: s.previous, color: c.chart[1]!, label: r.before, dashed: true }, { values: s.current, color: c.chart[0]!, label: r.now }]} format={moneyShort} />
            <View style={{ gap: 4 }}>
              <Text variant="label" testID="business-legend-now">{r.now}: {money(s.total)}</Text>
              <Text variant="label" tone="muted" testID="business-legend-before">{r.before}: {money(s.previousTotal)}</Text>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                <Pill tone={s.changePct === null ? "neutral" : s.changePct >= 0 ? "ok" : "danger"} icon="trend">{s.changePct === null ? "Nothing earlier to compare" : changePct(s.changePct)}</Pill>
                <Text variant="caption" tone="muted">{count(s.newCount)} new · {count(s.renewalCount)} re-subscribed</Text>
              </View>
            </View>
          </View>
        </Glass>
      </Section>

      <Grid min={340}>
        <Section title="Latest payments">
          {b.recent.length ? b.recent.map((p, i) => (
            <Row key={p.id} index={i} icon="rupee" testID={`recent-${p.id}`} title={`${p.storeName} · ${money(p.amount)}`} subtitle={`${prettyDay(p.paidOn)} · ${p.planName || "No plan"} · ${p.months} ${p.months === 1 ? "month" : "months"}${p.storeDeleted ? " · deleted store" : ""}`}
              right={<Pill tone={p.kind === "new" ? "ok" : "info"}>{p.kind === "new" ? "New sale" : "Re-subscribed"}</Pill>}
              onPress={mayOpenStores && !p.storeDeleted ? () => router.push(`/stores/${p.storeId}`) : undefined} />
          )) : <Glass><Text tone="muted">Nothing yet.</Text></Glass>}
        </Section>

        <Section title="Who to follow up" hint="Ran out, or no payment written down">
          {b.standing.expiredStores.map((st, i) => (
            <Row key={`x-${st.id}`} index={i} icon="alert" testID={`followup-${st.id}`} title={st.name} subtitle={`Ran out ${prettyDay(st.paidUntil)}`} right={<Pill tone="danger">Ran out</Pill>} onPress={mayOpenStores ? () => router.push(`/stores/${st.id}`) : undefined} />
          ))}
          {b.standing.neverPaidStores.map((st, i) => (
            <Row key={`n-${st.id}`} index={i} icon="wallet" testID={`followup-${st.id}`} title={st.name} subtitle="No payment written down yet" right={<Pill tone="warn">None written</Pill>} onPress={mayOpenStores ? () => router.push(`/stores/${st.id}`) : undefined} />
          ))}
          {!b.standing.expiredStores.length && !b.standing.neverPaidStores.length ? <Glass><Text tone="muted">Everybody is paid up.</Text></Glass> : null}
          {b.standing.neverPaid > b.standing.neverPaidStores.length ? <Text variant="caption" tone="muted">…and {b.standing.neverPaid - b.standing.neverPaidStores.length} more with no payment written down.</Text> : null}
        </Section>
      </Grid>

      <Section title="By plan" hint="Shops paid up now, and all the money taken, for each plan">
        {b.byPlan.length ? <Grid min={300}>{b.byPlan.map((p, i) => (
          <Row key={p.name} index={i} icon="plans" testID={`plan-${p.name}`} title={p.name} subtitle={`${count(p.activeShops)} ${p.activeShops === 1 ? "shop" : "shops"} paid up`} right={<Text variant="label">{money(p.amount)}</Text>} />
        ))}</Grid> : <Glass><Text tone="muted">No plans yet.</Text></Glass>}
      </Section>
    </View>
  );
}
