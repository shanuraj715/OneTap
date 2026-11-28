import { useMemo, useState } from "react";
import { View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Booking } from "@/api/endpoints";
import { useApi } from "@/runtime";
import { rangeOfScope, useScope } from "@/data/scope";
import { useOptions, useOutletPick, useReport } from "@/data/queries";
import { bucketLabel, clock12, dayKey, prettyDay, rangeLabel } from "@/lib/dates";
import { count, rupees, share } from "@/lib/format";
import { Async, BarChart, Donut, Empty, ErrorState, Glass, Grid, KpiTile, LineChart, LoadingCards, OutletPick, Pill, RankedBars, Row, Screen, ScopeBar, Section, Segmented, Text, hourName, useTheme } from "@/ui";
import { thin } from "./Sales";

const STATUS: Record<string, string> = { requested: "Waiting to be confirmed", confirmed: "Confirmed", seated: "Seated", completed: "Completed", declined: "Declined", cancelled: "Cancelled", no_show: "No-show" };
const TONE: Record<string, "ok" | "warn" | "danger" | "neutral" | "info"> = { requested: "warn", confirmed: "ok", seated: "info", completed: "neutral", declined: "danger", cancelled: "danger", no_show: "danger" };
type Tab = "report" | "upcoming";

/** Bookings: how many tables were booked, how many guests came, no-shows, advance money — and who is coming next at each outlet. */
export function Bookings() {
  const options = useOptions();
  const qc = useQueryClient();
  const range = rangeOfScope(useScope());
  const [tab, setTab] = useState<Tab>("report");
  return (
    <Screen title="Bookings" subtitle={tab === "report" ? rangeLabel(range) : "Who is coming next"} onRefresh={() => void qc.invalidateQueries({ queryKey: ["report"] }).then(() => qc.invalidateQueries({ queryKey: ["upcoming"] }))} testID="screen-bookings">
      <Segmented testID="bookings-tab" value={tab} onChange={setTab} options={[{ value: "report", label: "Report" }, { value: "upcoming", label: "Coming up" }]} />
      {tab === "report" ? <ReportTab outlets={options.data?.outlets ?? []} /> : <Upcoming outlets={options.data?.outlets ?? []} />}
    </Screen>
  );
}

function ReportTab({ outlets }: { outlets: { id: string; name: string; title: string }[] }) {
  const { c } = useTheme();
  const q = useReport("reservations", (api, s) => api.reservations(s));
  return (
    <>
      <ScopeBar outlets={outlets} />
      <Async q={q} lines={2}>
        {(d) => !d.enabled ? <Empty icon="calendarCheck" title="Table bookings aren't in your plan" message="Ask Rasoi Pulse to switch them on." /> : d.totals.bookings === 0 ? <Empty icon="calendarCheck" title="No bookings in this period" message="Pick a longer period or another outlet." /> : (
          <>
            <Grid min={150}>
              <KpiTile testID="bk-total" icon="calendarCheck" label="Bookings" value={count(d.totals.bookings)} delta={d.totals.change} sub={`${count(d.totals.previousBookings)} the period before`} />
              <KpiTile testID="bk-guests" icon="users" label="Guests" value={count(d.totals.guests)} sub={`${Math.round(d.totals.avgParty * 10) / 10} a table`} />
              <KpiTile testID="bk-kept" icon="circleCheck" label="Came" value={count(d.totals.kept)} />
              <KpiTile testID="bk-noshow" icon="circleX" label="No-shows" value={count(d.totals.noShows)} sub={`${share(d.totals.noShowRate)} of bookings`} invert />
              <KpiTile testID="bk-cancelled" icon="block" label="Cancelled" value={count(d.totals.cancelled)} sub={`${share(d.totals.cancelRate)} of bookings`} invert />
              <KpiTile testID="bk-week" icon="calendar" label="Coming in the next 7 days" value={count(d.totals.upcomingWeek)} />
            </Grid>
            <Section title="Money" hint="Advance paid when booking" icon="wallet">
              <Grid min={150}>
                <KpiTile testID="bk-advance" icon="rupee" label="Advance collected" value={rupees(d.totals.advanceCollected)} />
                <KpiTile testID="bk-refund" icon="refresh" label="Refunds due" value={rupees(d.totals.refundDue)} />
                <KpiTile testID="bk-value" icon="receipt" label="Value of bookings" value={rupees(d.totals.bookedValue)} />
              </Grid>
            </Section>
            <Section title="Bookings each day">
              <Glass><LineChart testID="chart-bk-days" labels={thin(d.series.map((p) => bucketLabel(p.day, "day")))} series={[{ values: d.series.map((p) => p.bookings), color: c.chart[0]!, label: "Bookings" }]} format={count} /></Glass>
            </Section>
            <Grid min={300}>
              <Section title="Best days" hint={d.busiestWeekday ? `Busiest: ${d.busiestWeekday}` : undefined}><Glass><BarChart testID="chart-bk-weekdays" color={c.chart[2]} data={d.weekdays.map((w) => ({ label: w.name.slice(0, 3), value: w.bookings }))} /></Glass></Section>
              <Section title="Booked times" hint={d.busiestHour !== null ? `Busiest: ${hourName(d.busiestHour)}` : undefined}><Glass><BarChart testID="chart-bk-hours" color={c.chart[3]} data={d.hours.map((h) => ({ label: hourName(h.hour).replace(" ", ""), value: h.bookings }))} /></Glass></Section>
            </Grid>
            <Grid min={300}>
              <Section title="How they ended"><Glass><Donut testID="chart-bk-status" items={d.byStatus.map((s) => ({ label: STATUS[s.id] ?? s.id, value: s.count }))} centerTop={count(d.totals.bookings)} centerBottom="bookings" /></Glass></Section>
              <Section title="Party size"><Glass><RankedBars rows={d.partySizes.map((p) => ({ label: p.label, value: p.bookings }))} format={count} /></Glass></Section>
            </Grid>
            {d.events.length ? <Section title="What for"><Glass><RankedBars rows={d.events.map((e) => ({ label: e.event, value: e.bookings }))} format={count} /></Glass></Section> : null}
            {d.perOutlet.length > 1 ? <Section title="By outlet"><Glass><RankedBars rows={d.perOutlet.map((o) => ({ id: o.id, label: o.name, value: o.bookings }))} format={count} /></Glass></Section> : null}
            <Text variant="caption" tone="muted">{count(d.totals.fromCustomers)} booked by customers, {count(d.totals.fromStaff)} written down by your team.</Text>
          </>
        )}
      </Async>
    </>
  );
}

function Upcoming({ outlets }: { outlets: { id: string; name: string; title: string }[] }) {
  const api = useApi();
  const [outletId, setOutletId] = useOutletPick(outlets);
  const q = useQuery({ queryKey: ["upcoming", outletId], queryFn: () => api.bookings(outletId, "upcoming"), enabled: Boolean(outletId) });
  const bookings = q.data?.reservations;
  const byDay = useMemo(() => {
    const groups = new Map<string, Booking[]>();
    for (const b of bookings ?? []) { const k = dayKey(b.at); groups.set(k, [...(groups.get(k) ?? []), b]); }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [bookings]);
  return (
    <>
      <OutletPick outlets={outlets} value={outletId} onChange={setOutletId} />
      {q.isLoading ? <LoadingCards n={3} /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : (
        <>
          {q.data && q.data.counts.waitingAhead > 0 ? <Pill tone="warn" icon="clock">{`${q.data.counts.waitingAhead} waiting to be confirmed`}</Pill> : null}
          {byDay.length === 0 ? <Empty icon="calendarCheck" title="No bookings coming up" message="New ones show here as soon as they are made." /> : byDay.map(([day, list]) => (
            <Section key={day} title={prettyDay(day)} hint={`${list.length} ${list.length === 1 ? "booking" : "bookings"} · ${count(list.reduce((n, b) => n + b.partySize, 0))} guests`}>
              <View style={{ gap: 10 }}>
                {list.map((b, i) => (
                  <Row key={b.id} index={i} testID={`booking-${b.id}`} icon="calendarClock" title={`${clock12(b.at)} · ${b.customer?.name || "Guest"} · ${b.partySize}`}
                    subtitle={[b.event, b.tableNumber ? `table ${b.tableNumber}` : "", b.customer?.phone ?? "", b.pricing.prepayPaise ? `advance ${rupees(b.pricing.prepayPaise)}` : ""].filter(Boolean).join(" · ")}
                    right={<Pill tone={TONE[b.status] ?? "neutral"}>{b.statusLabel ?? STATUS[b.status] ?? b.status}</Pill>} />
                ))}
              </View>
            </Section>
          ))}
          {q.data?.more ? <Text variant="caption" tone="muted" testID="bookings-more">Only the first bookings are shown. The web dashboard lists the rest.</Text> : null}
        </>
      )}
    </>
  );
}
