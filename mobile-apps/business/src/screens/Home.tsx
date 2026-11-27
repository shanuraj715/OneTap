import { useState } from "react";
import { View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi, useMe } from "@/runtime";
import { can } from "@/lib/access";
import { presetRange, today, type PresetId } from "@/lib/dates";
import { count, money, pctChange, rupees, rupeesShort } from "@/lib/format";
import { useOptions, useRangeReport, useReport } from "@/data/queries";
import { useScope } from "@/data/scope";
import { toasts } from "@/ui/toast-store";
import { Async, Button, CountUp, Donut, Empty, Field, Gauge, Glass, Grid, Heatmap, InsightCard, Input, KpiTile, Pill, Screen, ScopeBar, Section, Sheet, Skeleton, Text, hourName, useTheme } from "@/ui";

const CARDS = [
  { id: "today", label: "Today", g: "day", icon: "clock", vs: "vs yesterday" },
  { id: "thisWeek", label: "This week", g: "day", icon: "calendar", vs: "vs the days before" },
  { id: "thisMonth", label: "This month", g: "day", icon: "calendarCheck", vs: "vs the days before" },
  { id: "thisYear", label: "This year", g: "month", icon: "trend", vs: "vs the days before" },
] as const;

/** A period that is still running is read up to TODAY, so it is compared with the same number of days before it (not with a whole week or month). */
const upToToday = (preset: PresetId) => { const r = presetRange(preset); const t = today(); return { from: r.from, to: r.to > t ? t : r.to }; };

/** Sales, orders and the average order for one period, with the change against the period just before it. */
function PeriodCard({ id: preset, label, g, icon, vs }: (typeof CARDS)[number]) {
  const r = upToToday(preset);
  const q = useRangeReport(`home-${preset}`, r.from, r.to, (api, scope) => api.overview(scope), { granularity: g });
  const d = q.data;
  if (!d) return <Glass testID={`period-${preset}`}><Skeleton height={64} /></Glass>;
  return (
    <KpiTile testID={`card-${preset}`} icon={icon} label={label} value={<CountUp value={d.kpis.sales} format={rupees} />} delta={pctChange(d.kpis.sales, d.previousKpis.sales)}
      sub={`${count(d.kpis.orders)} ${d.kpis.orders === 1 ? "order" : "orders"} · avg ${rupees(d.kpis.aov)} · ${vs}`} spark={d.series.map((x) => x.sales)} />
  );
}

/** The monthly sales target: how far this month has got, the pace it is on, and what is needed each remaining day. */
function GoalCard() {
  const api = useApi();
  const me = useMe();
  const qc = useQueryClient();
  const outlets = useScope((s) => s.outlets).join(",");
  const home = useScope((s) => s.home);
  const q = useQuery({ queryKey: ["goals", outlets, home], queryFn: () => api.goals(outlets), enabled: Boolean(home) });
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const save = useMutation({
    mutationFn: (v: number | null) => api.setGoal(v),
    onSuccess: () => { toasts.ok("Target saved."); void qc.invalidateQueries({ queryKey: ["goals"] }); setOpen(false); },
    onError: (e) => toasts.error(e instanceof Error ? e.message : "Couldn't save the target."),
  });
  const mayEdit = can(me, "analytics:finance");
  const g = q.data;
  if (!g) return null;
  const target = g.goal.monthlySales;
  const n = Number(text.replace(/,/g, ""));
  return (
    <>
      <Glass testID="goal-card">
        {target ? (
          <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
            <Gauge testID="goal-gauge" value={(g.pct ?? 0) / 100} top={`${Math.round(g.pct ?? 0)}%`} bottom="of target" />
            <View style={{ flex: 1, gap: 6 }}>
              <Text variant="label">Monthly target {money(target)}</Text>
              <Text variant="caption" tone="muted">{money(g.soFar)} so far · {g.month.left} {g.month.left === 1 ? "day" : "days"} left</Text>
              <Pill tone={g.onTrack ? "ok" : "warn"} icon={g.onTrack ? "trend" : "target"}>{g.onTrack ? `On track for ${money(g.projected)}` : `On pace for ${money(g.projected)}`}</Pill>
              {g.neededPerDay !== null ? <Text variant="caption" tone="muted">{g.neededPerDay > 0 ? `Needs ${money(g.neededPerDay)} a day to get there` : "Target reached"}</Text> : null}
              {mayEdit ? <Button size="sm" variant="glass" icon="edit" title="Change target" onPress={() => { setText(String(target)); setOpen(true); }} testID="goal-edit" /> : null}
            </View>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Text variant="label">Set a monthly sales target</Text></View>
            <Text variant="caption" tone="muted">Pick a number for this month and Home shows how far you have got and whether you are on pace.</Text>
            {mayEdit ? <Button size="sm" icon="target" title="Set a target" onPress={() => { setText(""); setOpen(true); }} testID="goal-set" /> : null}
          </View>
        )}
      </Glass>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Monthly sales target" testID="goal-sheet"
        footer={<>{target ? <Button title="Remove" variant="glass" onPress={() => save.mutate(null)} /> : <Button title="Cancel" variant="glass" onPress={() => setOpen(false)} />}<Button title="Save" loading={save.isPending} disabled={!(n > 0)} onPress={() => save.mutate(n)} testID="goal-save" /></>}>
        <Field label="Sales you want this month (₹)" hint="Counted the way your sales are: what customers paid, GST included."><Input value={text} onChangeText={setText} keyboardType="numeric" testID="goal-input" /></Field>
      </Sheet>
    </>
  );
}

/** Everything for the chosen period: the highlights in words, where the sales come from, and the busy times. */
function ForThePeriod() {
  const { c } = useTheme();
  const ov = useReport("home-overview", (api, scope) => api.overview(scope));
  const ins = useReport("insights", (api, scope) => api.insights(scope));
  return (
    <>
      <Section title="Highlights" hint="What is worth knowing, in plain words" icon="lightbulb">
        <Async q={ins} lines={2}>{(d) => (d.insights.length ? <View style={{ gap: 10 }}>{d.insights.map((i) => <InsightCard key={i.id} insight={i} testID={`insight-${i.id}`} />)}</View> : <Empty icon="lightbulb" title="Nothing to point out yet" message="Highlights appear once there are orders in the period." />)}</Async>
      </Section>
      <Async q={ov} lines={2}>
        {(d) => (
          <>
            <Grid min={300}>
              <Section title="Order types"><Glass><Donut testID="chart-channels" items={d.channels.map((x) => ({ label: x.id.replace("-", " "), value: x.sales }))} format={rupeesShort} centerBottom="sales" /></Glass></Section>
              <Section title="How customers pay"><Glass><Donut testID="chart-payments" items={d.payments.map((x) => ({ label: x.id === "cod" ? "cash" : x.id === "razorpay" ? "online" : String(x.id), value: x.sales }))} format={rupeesShort} centerBottom="sales" /></Glass></Section>
            </Grid>
            <Section title="Busy times" hint="Darker = more orders. Tap a square to read it." icon="clock">
              <Glass>
                <Heatmap data={d.heatmap} testID="chart-heatmap" color={c.chart[0]} />
                {d.hourly.some((h) => h.orders > 0) ? <Text variant="caption" tone="muted" style={{ marginTop: 6 }}>Busiest hour: {hourName(d.hourly.reduce((b, h) => (h.orders > b.orders ? h : b), d.hourly[0]!).hour)}</Text> : null}
              </Glass>
            </Section>
          </>
        )}
      </Async>
    </>
  );
}

/** Home: today, this week, this month and this year side by side with how each compares, the monthly target, and the highlights. */
export function Home() {
  const me = useMe();
  const options = useOptions();
  const qc = useQueryClient();
  const first = me?.name?.split(" ")[0] ?? "";
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(new Date())) % 24;
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <Screen title="Home" subtitle={`${hello}${first ? `, ${first}` : ""}`} onRefresh={() => void qc.invalidateQueries({ queryKey: ["report"] }).then(() => qc.invalidateQueries({ queryKey: ["goals"] }))} testID="screen-home">
      <Section title="Your sales" hint="Each against the days just before it" icon="rupee">
        <Grid min={170}>{CARDS.map((card) => <PeriodCard key={card.id} {...card} />)}</Grid>
      </Section>
      <GoalCard />
      <ScopeBar outlets={options.data?.outlets ?? []} />
      <ForThePeriod />
    </Screen>
  );
}

