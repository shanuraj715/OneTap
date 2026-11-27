import { useMemo, useState } from "react";
import { View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import type { ItemRow } from "@/api/endpoints";
import { rangeOfScope, useScope } from "@/data/scope";
import { useOptions, useReport } from "@/data/queries";
import { rangeLabel } from "@/lib/dates";
import { count, rupees, rupeesShort, share } from "@/lib/format";
import { Async, Button, Chips, Delta, Empty, Glass, RankedBars, Row, Screen, ScopeBar, SearchField, Section, Segmented, Text } from "@/ui";

type Tab = "best" | "outlets" | "moving" | "idle";
const TABS: { value: Tab; label: string }[] = [{ value: "best", label: "Best sellers" }, { value: "outlets", label: "By outlet" }, { value: "moving", label: "Rising & falling" }, { value: "idle", label: "Not selling" }];
type Sort = "qty" | "revenue";
const SHOWN = 25;

/** Dishes: what sells most — for the whole store and for each outlet — what is rising or falling against the period before, and what did not sell at all. */
export function Dishes() {
  const options = useOptions();
  const qc = useQueryClient();
  const range = rangeOfScope(useScope());
  const [tab, setTab] = useState<Tab>("best");
  return (
    <Screen title="Dishes" subtitle={rangeLabel(range)} onRefresh={() => void qc.invalidateQueries({ queryKey: ["report"] })} testID="screen-dishes">
      <ScopeBar outlets={options.data?.outlets ?? []} />
      <Segmented testID="dishes-tab" value={tab} onChange={setTab} options={TABS} />
      {tab === "best" ? <Best /> : tab === "outlets" ? <ByOutlet /> : tab === "moving" ? <Moving /> : <Idle />}
    </Screen>
  );
}

function Best() {
  const q = useReport("items", (api, s) => api.items(s));
  const [sort, setSort] = useState<Sort>("qty");
  const [search, setSearch] = useState("");
  const [all, setAll] = useState(false);
  const rows = useMemo(() => {
    const list = [...(q.data?.items ?? [])].sort((a, b) => (sort === "qty" ? b.qty - a.qty : b.revenue - a.revenue));
    return search.trim() ? list.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase())) : list;
  }, [q.data, sort, search]);
  return (
    <Async q={q} lines={2}>
      {(d) => d.items.length === 0 ? <Empty icon="utensils" title="Nothing sold in this period" message="Pick a longer period or another outlet." /> : (
        <>
          <Chips testID="dishes-sort" value={sort} onChange={setSort} options={[{ value: "qty", label: "Most ordered" }, { value: "revenue", label: "Most money" }]} />
          <Section title={sort === "qty" ? "Most ordered" : "Most money"} hint={`${count(d.totals.qty)} items · ${rupees(d.totals.revenue)}`}>
            <Glass><RankedBars rows={rows.slice(0, 8).map((r) => ({ id: r.key, label: r.name, value: sort === "qty" ? r.qty : r.revenue, note: share(sort === "qty" ? r.qtyShare : r.revenueShare) }))} format={sort === "qty" ? count : rupeesShort} /></Glass>
          </Section>
          <SearchField value={search} onChange={setSearch} placeholder="Find a dish" testID="dishes-search" />
          <View style={{ gap: 10 }}>
            {(all || search ? rows : rows.slice(0, SHOWN)).map((r, i) => <Dish key={r.key} r={r} index={i} />)}
            {!all && !search && rows.length > SHOWN ? <Button variant="glass" title={`Show all ${rows.length} dishes`} onPress={() => setAll(true)} testID="dishes-all" /> : null}
            {search && rows.length === 0 ? <Empty icon="search" title="No dish by that name" /> : null}
          </View>
        </>
      )}
    </Async>
  );
}

function Dish({ r, index }: { r: ItemRow; index: number }) {
  return (
    <Row index={index} testID={`dish-${r.key}`} icon="utensils" title={`${r.rank}. ${r.name}`} subtitle={`${count(r.qty)} sold · ${rupees(r.revenue)} · ${count(r.orders)} orders · ${Math.round(r.perDay * 10) / 10} a day`}
      right={r.change === null ? <Text variant="caption" tone="muted">{r.qty > 0 && r.previousQty === 0 ? "new" : ""}</Text> : <Delta pct={r.change} />} />
  );
}

function ByOutlet() {
  const q = useReport("dish-compare", (api, s) => api.compare(s));
  return (
    <Async q={q} lines={2}>
      {(d) => d.outlets.length === 0 ? <Empty icon="outlet" title="No outlets to show" /> : (
        <View style={{ gap: 14 }}>
          {d.outlets.map((o) => (
            <Section key={o.id} title={o.name} hint={`${rupees(o.kpis.sales)} · ${count(o.kpis.orders)} orders`} icon="outlet">
              <Glass testID={`outlet-dishes-${o.id}`}>
                {o.topItems.length ? <RankedBars rows={o.topItems.map((t) => ({ label: t.name, value: t.qty }))} format={count} /> : <Text tone="muted">Nothing sold here in this period.</Text>}
              </Glass>
            </Section>
          ))}
        </View>
      )}
    </Async>
  );
}

function Moving() {
  const q = useReport("items", (api, s) => api.items(s));
  return (
    <Async q={q} lines={2}>
      {(d) => {
        const compared = d.items.filter((r) => r.change !== null);
        const rising = compared.filter((r) => (r.change ?? 0) > 0).sort((a, b) => (b.change ?? 0) - (a.change ?? 0)).slice(0, 10);
        const falling = compared.filter((r) => (r.change ?? 0) < 0).sort((a, b) => (a.change ?? 0) - (b.change ?? 0)).slice(0, 10);
        const fresh = d.items.filter((r) => r.previousQty === 0 && r.qty > 0).slice(0, 10);
        const list = (rows: ItemRow[], empty: string) => rows.length ? <View style={{ gap: 10 }}>{rows.map((r, i) => <Dish key={r.key} r={r} index={i} />)}</View> : <Empty icon="info" title={empty} />;
        return (
          <>
            <Text variant="caption" tone="muted">Compared with the period just before ({rangeLabel(d.previous)}).</Text>
            <Section title="Rising" icon="trend">{list(rising, "No dish is selling more than before")}</Section>
            <Section title="Falling" icon="trendDown">{list(falling, "No dish is selling less than before")}</Section>
            <Section title="New in this period" hint="Not sold at all in the period before" icon="sparkles">{list(fresh, "No new sellers")}</Section>
          </>
        );
      }}
    </Async>
  );
}

function Idle() {
  const q = useReport("items", (api, s) => api.items(s));
  return (
    <Async q={q} lines={2}>
      {(d) => d.unsold.length === 0 ? <Empty icon="circleCheck" title="Every dish sold at least once" message="Nothing on the menu went unsold in this period." /> : (
        <Section title={`${d.unsold.length} ${d.unsold.length === 1 ? "dish" : "dishes"} did not sell`} hint="On your menu, but nobody ordered them in this period. Think about changing, promoting or removing them.">
          <View style={{ gap: 10 }}>{d.unsold.map((name, i) => <Row key={name} index={i} testID={`idle-${i}`} icon="alert" title={name} />)}</View>
        </Section>
      )}
    </Async>
  );
}
