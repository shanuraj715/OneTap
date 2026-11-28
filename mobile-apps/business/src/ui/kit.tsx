import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useScope, rangeOfScope } from "@/data/scope";
import { PRESETS, prettyDay, rangeLabel, today, type PresetId } from "@/lib/dates";
import { changePct } from "@/lib/format";
import type { Insight, OutletRef } from "@/api/endpoints";
import { Button, Glass, Icon, Pill, Text, type IconName } from "./primitives";
import { DateField, Sheet } from "./Sheet";
import { ErrorState, LoadingCards } from "./Screen";
import { Sparkline } from "./charts-more";
import { useTheme } from "./theme";

/* ------------------------------------------------------------------------------------------------ change chip */
/** ▲ +12.5% / ▼ −4% — the change against another period. `invert`: down is good (cancellations, expenses). null = nothing to compare with. */
export function Delta({ pct, invert = false, suffix, testID }: { pct: number | null | undefined; invert?: boolean; suffix?: string; testID?: string }) {
  if (pct === null || pct === undefined) return <Pill tone="neutral">{suffix ? `– ${suffix}` : "–"}</Pill>;
  const good = invert ? pct <= 0 : pct >= 0;
  return <View testID={testID}><Pill tone={pct === 0 ? "neutral" : good ? "ok" : "danger"} icon={pct < 0 ? "trendDown" : "trend"}>{`${changePct(pct)}${suffix ? ` ${suffix}` : ""}`}</Pill></View>;
}

/* ------------------------------------------------------------------------------------------------ number tile */
/** One headline number with its change, a line of words under it and (optionally) the shape of it over time. */
export function KpiTile({ icon, label, value, delta, invert, sub, spark, onPress, testID, accent }: {
  icon?: IconName; label: string; value: ReactNode; delta?: number | null; invert?: boolean; sub?: string; spark?: number[]; onPress?: () => void; testID?: string; accent?: string;
}) {
  const { c } = useTheme();
  const body = (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {icon ? <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: c.glassStrong, alignItems: "center", justifyContent: "center" }}><Icon name={icon} size={15} color={accent ?? c.primaryText} /></View> : null}
        <Text variant="caption" tone="muted" numberOfLines={1} style={{ flex: 1 }}>{label}</Text>
      </View>
      <View>{typeof value === "string" ? <Text variant="title" numberOfLines={1} adjustsFontSizeToFit>{value}</Text> : value}</View>
      {delta !== undefined || (spark && spark.length > 1) ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
          <View style={{ flexShrink: 1 }}>{delta !== undefined ? <Delta pct={delta} invert={invert} /> : null}</View>
          {spark && spark.length > 1 ? <Sparkline values={spark} width={56} color={accent} /> : null}
        </View>
      ) : null}
      {sub ? <Text variant="caption" tone="muted">{sub}</Text> : null}
    </View>
  );
  return <Glass onPress={onPress} testID={testID} accessibilityLabel={`${label}`} padding={14}>{body}</Glass>;
}

/* ------------------------------------------------------------------------------------------------ chips */
/** A row of pills to pick one of several (it scrolls sideways when there are many). */
export function Chips<T extends string>({ value, options, onChange, testID }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; testID?: string }) {
  const { c } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} testID={testID} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="button" accessibilityState={{ selected: on }} testID={testID ? `${testID}-${o.value}` : undefined}
            style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: on ? c.primary : c.fieldBorder, backgroundColor: on ? c.primary : c.field }}>
            <Text variant="label" style={{ color: on ? c.onPrimary : c.text }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------------------------------------ the period and outlet filter */
/**
 * What every report on the screen is looking at: the PERIOD and the OUTLETS. Two pills under the title; touching one opens the choices.
 * The choice is shared by every screen and kept on the phone.
 */
export function ScopeBar({ outlets, showOutlets = true, showPeriod = true }: { outlets: OutletRef[]; showOutlets?: boolean; /** false for screens that are about NOW (stock) and have no period */ showPeriod?: boolean }) {
  const scope = useScope();
  const [open, setOpen] = useState<null | "period" | "outlets">(null);
  const range = rangeOfScope(scope);
  const label = scope.period === "custom" ? rangeLabel(range) : PRESETS.find((p) => p.id === scope.period)?.label ?? "Last 30 days";
  const outletText = !scope.outlets.length ? (outlets.length > 1 ? "All outlets" : outlets[0]?.title ?? "All outlets") : scope.outlets.length === 1 ? outlets.find((o) => o.id === scope.outlets[0])?.title ?? "1 outlet" : `${scope.outlets.length} outlets`;
  return (
    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }} testID="scope-bar">
      {showPeriod ? <Button size="sm" variant="glass" icon="calendar" title={label} onPress={() => setOpen("period")} testID="scope-period" accessibilityLabel={`Period: ${rangeLabel(range)}`} /> : null}
      {showOutlets && outlets.length > 1 ? <Button size="sm" variant="glass" icon="outlet" title={outletText} onPress={() => setOpen("outlets")} testID="scope-outlets" /> : null}
      {showPeriod ? <Text variant="caption" tone="muted" style={{ alignSelf: "center" }} testID="scope-range">{rangeLabel(range)}</Text> : null}
      <PeriodSheet visible={open === "period"} onClose={() => setOpen(null)} />
      <OutletSheet visible={open === "outlets"} onClose={() => setOpen(null)} outlets={outlets} />
    </View>
  );
}

function PeriodSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const scope = useScope();
  const [from, setFrom] = useState(scope.custom.from);
  const [to, setTo] = useState(scope.custom.to);
  const bad = !from || !to || from > to;
  return (
    <Sheet visible={visible} onClose={onClose} title="Choose the period" testID="period-sheet"
      footer={<><Button title="Cancel" variant="glass" onPress={onClose} /><Button title="Use these dates" disabled={bad} onPress={() => { scope.setCustom({ from, to }); onClose(); }} testID="period-custom-apply" /></>}>
      <View style={{ gap: 4 }}>
        {PRESETS.map((p) => {
          const on = scope.period === p.id;
          return (
            <Pressable key={p.id} onPress={() => { scope.setPeriod(p.id as PresetId); onClose(); }} accessibilityRole="button" accessibilityState={{ selected: on }} testID={`period-${p.id}`}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, backgroundColor: on ? c.glassStrong : "transparent" }}>
              <Text variant="label">{p.label}</Text>
              {on ? <Icon name="check" size={18} color={c.primaryText} /> : null}
            </Pressable>
          );
        })}
      </View>
      <Text variant="label">Or pick the dates</Text>
      <DateField label="From" value={from} onChange={setFrom} max={today()} clearable={false} testID="period-from" />
      <DateField label="To" value={to} onChange={setTo} max={today()} min={from || undefined} clearable={false} testID="period-to" />
      {bad && from && to ? <Text variant="caption" tone="warn">The first day must come before the last day.</Text> : <Text variant="caption" tone="muted">{from && to && !bad ? `${prettyDay(from)} to ${prettyDay(to)}` : ""}</Text>}
    </Sheet>
  );
}

function OutletSheet({ visible, onClose, outlets }: { visible: boolean; onClose: () => void; outlets: OutletRef[] }) {
  const { c } = useTheme();
  const scope = useScope();
  const [picked, setPicked] = useState<string[]>(scope.outlets);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const all = picked.length === 0 || picked.length === outlets.length;
  return (
    <Sheet visible={visible} onClose={onClose} title="Which outlets?" testID="outlet-sheet"
      footer={<><Button title="Cancel" variant="glass" onPress={onClose} /><Button title="Show these" onPress={() => { scope.setOutlets(picked.length === outlets.length ? [] : picked); onClose(); }} testID="outlets-apply" /></>}>
      <Pressable onPress={() => setPicked([])} accessibilityRole="button" accessibilityState={{ selected: all }} testID="outlets-all" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, backgroundColor: all ? c.glassStrong : "transparent" }}>
        <Text variant="label">All outlets</Text>{all ? <Icon name="check" size={18} color={c.primaryText} /> : null}
      </Pressable>
      {outlets.map((o) => {
        const on = picked.includes(o.id);
        return (
          <Pressable key={o.id} onPress={() => toggle(o.id)} accessibilityRole="button" accessibilityState={{ selected: on }} testID={`outlet-${o.id}`} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, backgroundColor: on ? c.glassStrong : "transparent" }}>
            <Text variant="label">{o.title}</Text>{on ? <Icon name="check" size={18} color={c.primaryText} /> : null}
          </Pressable>
        );
      })}
    </Sheet>
  );
}

/* ------------------------------------------------------------------------------------------------ insight */
const INSIGHT_ICON: Record<Insight["tone"], IconName> = { good: "trend", warn: "alert", info: "lightbulb" };
/** One plain-English thing worth knowing, with a mark for good news, a warning or a note. */
export function InsightCard({ insight, testID }: { insight: Insight; testID?: string }) {
  const { c } = useTheme();
  const tone = insight.tone === "good" ? c.ok : insight.tone === "warn" ? c.warn : c.info;
  const wash = insight.tone === "good" ? c.okWash : insight.tone === "warn" ? c.warnWash : c.infoWash;
  return (
    <Glass padding={14} testID={testID}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: wash, alignItems: "center", justifyContent: "center" }}><Icon name={INSIGHT_ICON[insight.tone]} size={18} color={tone} /></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label">{insight.title}</Text>
          <Text variant="caption" tone="muted" style={{ lineHeight: 18 }}>{insight.text}</Text>
        </View>
      </View>
    </Glass>
  );
}

/* ------------------------------------------------------------------------------------------------ loading / error wrapper */
/** The three states of a report in one place: still loading (grey cards), failed (a sentence and a way to try again), or the data. */
export function Async<T>({ q, children, lines = 3 }: { q: { isLoading: boolean; isError: boolean; error: unknown; data: T | undefined; refetch: () => unknown }; children: (data: T) => ReactNode; lines?: number }) {
  if (q.isError) return <ErrorState error={q.error} onRetry={() => void q.refetch()} />;
  // no answer yet and no failure: still loading — or not started (a report that waits for the outlet to be known): never an error box
  if (q.isLoading || q.data === undefined) return <LoadingCards n={lines} />;
  return <>{children(q.data)}</>;
}

/* ------------------------------------------------------------------------------------------------ one outlet */
/** For a screen that is about ONE outlet: a row of its names to pick from (nothing at all when the store has a single outlet). */
export function OutletPick({ outlets, value, onChange, testID = "outlet-pick" }: { outlets: OutletRef[]; value: string; onChange: (id: string) => void; testID?: string }) {
  if (outlets.length < 2) return null;
  return <Chips testID={testID} value={value} onChange={onChange} options={outlets.map((o) => ({ value: o.id, label: o.title }))} />;
}
