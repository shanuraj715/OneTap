import { useState } from "react";
import { View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { InventoryRow } from "@/api/endpoints";
import { useApi, useMe } from "@/runtime";
import { can } from "@/lib/access";
import { useOptions, useOutletsParam } from "@/data/queries";
import { useAction } from "@/data/useAction";
import { count } from "@/lib/format";
import { AppSwitch, Button, Empty, ErrorState, Field, Glass, Grid, Input, KpiTile, LoadingCards, Pill, Row, Screen, ScopeBar, Section, Sheet, Text } from "@/ui";

const left = (r: InventoryRow) => (r.daysLeft === null ? "" : r.daysLeft < 1 ? " · less than a day at this pace" : ` · about ${Math.floor(r.daysLeft)} ${Math.floor(r.daysLeft) === 1 ? "day" : "days"} at this pace`);

/** Stock: the dishes that are counted, which are out or running low, which are switched off — and what to prepare tomorrow. Counts can be changed here. */
export function Stock() {
  const api = useApi();
  const me = useMe();
  const qc = useQueryClient();
  const options = useOptions();
  const outlets = useOutletsParam();
  const inv = useQuery({ queryKey: ["stock", "inventory", outlets], queryFn: () => api.inventory(outlets) });
  const plan = useQuery({ queryKey: ["stock", "plan", outlets], queryFn: () => api.stock(outlets) });
  const [editing, setEditing] = useState<InventoryRow | null>(null);
  const [all, setAll] = useState(false);
  const mayEdit = can(me, "menu:update");
  const refresh = () => qc.invalidateQueries({ queryKey: ["stock"] });
  const power = useAction((v: { id: string; outletId: string; on: boolean }) => api.updateDish(v.id, v.outletId, { isAvailable: v.on }), { done: (v) => (v.on ? "Dish switched on." : "Dish switched off."), onDone: () => void refresh() });

  return (
    <Screen title="Stock" subtitle="What is left, right now" onRefresh={() => void refresh()} testID="screen-stock">
      <ScopeBar outlets={options.data?.outlets ?? []} showPeriod={false} />
      {inv.isLoading ? <LoadingCards n={3} /> : inv.isError ? <ErrorState error={inv.error} onRetry={() => void inv.refetch()} /> : inv.data ? (() => {
        const d = inv.data;
        const attention = d.items.filter((r) => r.state !== "ok").sort((a, b) => (a.state === b.state ? a.left - b.left : a.state === "out" ? -1 : 1));
        const fine = d.items.filter((r) => r.state === "ok");
        return (
          <>
            <Grid min={150}>
              <KpiTile testID="stock-counted" icon="package" label="Dishes counted" value={count(d.totals.counted)} sub={`${count(d.totals.notCounted)} not counted`} />
              <KpiTile testID="stock-out" icon="circleX" label="Out of stock" value={count(d.totals.out)} invert />
              <KpiTile testID="stock-low" icon="alert" label="Running low" value={count(d.totals.low)} invert />
              <KpiTile testID="stock-off" icon="power" label="Switched off" value={count(d.totals.switchedOff)} />
            </Grid>
            <Section title="Needs attention" hint={mayEdit ? "Press a dish to change its count" : undefined} icon="alert">
              {attention.length ? <View style={{ gap: 10 }}>{attention.map((r, i) => <Item key={r.id} r={r} index={i} onPress={mayEdit ? () => setEditing(r) : undefined} />)}</View> : <Empty icon="circleCheck" title="Nothing is out or running low" />}
            </Section>
            {d.switchedOff.length ? (
              <Section title="Switched off" hint="Customers can't order these now" icon="power">
                <View style={{ gap: 10 }}>
                  {d.switchedOff.map((s, i) => (
                    <Row key={s.id} index={i} testID={`off-${s.id}`} icon="power" title={s.name} subtitle={`${s.outlet}${s.reason ? ` · ${s.reason}` : ""}`}
                      right={mayEdit ? <AppSwitch value={false} onValueChange={(on) => { const outletId = d.items.find((x) => x.id === s.id)?.outletId ?? outlets.split(",")[0] ?? ""; power.mutate({ id: s.id, outletId, on }); }} accessibilityLabel={`Switch ${s.name} on`} testID={`off-switch-${s.id}`} /> : undefined} />
                  ))}
                </View>
              </Section>
            ) : null}
            {fine.length ? (
              <Section title="In stock" hint={`${fine.length} ${fine.length === 1 ? "dish" : "dishes"}`}>
                {all ? <View style={{ gap: 10 }}>{fine.map((r, i) => <Item key={r.id} r={r} index={i} onPress={mayEdit ? () => setEditing(r) : undefined} />)}</View> : <Button variant="glass" title={`Show ${fine.length} dishes in stock`} onPress={() => setAll(true)} testID="stock-show-all" />}
              </Section>
            ) : null}
          </>
        );
      })() : null}

      <Section title="Prepare tomorrow" hint={plan.data ? `${plan.data.tomorrow.weekday}: from the last ${plan.data.weeks} weeks, plus ${plan.data.safetyPct}% extra` : undefined} icon="chef">
        {plan.isLoading ? <LoadingCards n={1} /> : plan.isError ? <ErrorState error={plan.error} onRetry={() => void plan.refetch()} /> : (plan.data?.tomorrow.items ?? []).length === 0 ? <Empty icon="chef" title="Nothing to suggest yet" message="Suggestions appear after a few weeks of orders." /> : (
          <Glass testID="prep-list">
            {plan.data!.tomorrow.items.map((it) => (
              <View key={it.name} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, gap: 12 }}>
                <View style={{ flex: 1 }}><Text variant="label">{it.name}</Text><Text variant="caption" tone="muted">usually {Math.round(it.avg * 10) / 10}, up to {it.max}</Text></View>
                <Pill tone="primary">{`make ${it.suggested}`}</Pill>
              </View>
            ))}
          </Glass>
        )}
      </Section>
      {editing ? <CountSheet r={editing} onClose={() => setEditing(null)} onSaved={() => void refresh()} /> : null}
    </Screen>
  );
}

function Item({ r, index, onPress }: { r: InventoryRow; index: number; onPress?: () => void }) {
  return (
    <Row index={index} testID={`stock-${r.id}`} icon="package" title={r.name} subtitle={`${r.outlet} · ${r.category}\n${r.state === "out" ? "Out of stock" : `${count(r.left)} left`}${left(r)}${r.available ? "" : " · switched off"}`} onPress={onPress}
      right={<Pill tone={r.state === "out" ? "danger" : r.state === "low" ? "warn" : "ok"}>{r.state === "out" ? "Out" : r.state === "low" ? "Low" : "OK"}</Pill>} />
  );
}

function CountSheet({ r, onClose, onSaved }: { r: InventoryRow; onClose: () => void; onSaved: () => void }) {
  const api = useApi();
  const [leftText, setLeft] = useState(String(r.left));
  const [dailyText, setDaily] = useState(r.daily === null ? "" : String(r.daily));
  const [lowText, setLow] = useState(String(r.lowAt));
  const n = (t: string) => Number(t.replace(/,/g, ""));
  const whole = (t: string) => t.trim() !== "" && Number.isInteger(n(t)) && n(t) >= 0;
  const valid = whole(leftText) && (dailyText.trim() === "" || whole(dailyText)) && whole(lowText);
  const save = useAction(() => api.updateDish(r.id, r.outletId, { stock: { tracked: true, left: n(leftText), daily: dailyText.trim() === "" ? null : n(dailyText), lowAt: n(lowText) } }), { done: "Stock saved.", onDone: () => { onSaved(); onClose(); } });
  return (
    <Sheet visible onClose={onClose} title={r.name} testID="stock-sheet" footer={<><Button title="Cancel" variant="glass" onPress={onClose} /><Button title="Save" loading={save.isPending} disabled={!valid} onPress={() => save.mutate(undefined)} testID="stock-save" /></>}>
      <Text variant="caption" tone="muted">{r.outlet}</Text>
      <Field label="How many are left now" error={leftText !== "" && !whole(leftText) ? "Type a whole number, 0 or more." : undefined}><Input value={leftText} onChangeText={setLeft} keyboardType="numeric" testID="stock-left" /></Field>
      <Field label="Fresh stock each day (optional)" hint="If you fill this, the count goes back to it every morning." error={dailyText !== "" && !whole(dailyText) ? "Type a whole number, 0 or more." : undefined}><Input value={dailyText} onChangeText={setDaily} keyboardType="numeric" testID="stock-daily" /></Field>
      <Field label="Say “low” when this few are left" error={lowText !== "" && !whole(lowText) ? "Type a whole number, 0 or more." : undefined}><Input value={lowText} onChangeText={setLow} keyboardType="numeric" testID="stock-lowat" /></Field>
    </Sheet>
  );
}
