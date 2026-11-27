import { useMemo, useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useApi } from "@/runtime";
import type { StoreRow } from "@/api/endpoints";
import { day } from "@/lib/format";
import { Empty, ErrorState, Grid, LoadingCards, Meter, Pill, Row, Screen, SearchField, Segmented, Select, Text, type Tone } from "@/ui";

export const standing = (s: StoreRow): { label: string; tone: Tone } =>
  s.disabled ? { label: "Switched off", tone: "neutral" } : s.status === "overLimit" || s.status === "over_limit" ? { label: "Over its limits", tone: "danger" } : s.status === "grace" ? { label: "Grace period", tone: "warn" } : s.blocked.outlets + s.blocked.people > 0 ? { label: "Some blocked", tone: "warn" } : { label: "Active", tone: "ok" };

const needsAttention = (s: StoreRow) => !s.disabled && standing(s).tone !== "ok";
const fraction = (used: number, max: number | null) => (max ? used / max : 0);

/** Every client store: search it, filter by what needs a look or by plan, open one. */
export function Stores() {
  const api = useApi();
  const q = useQuery({ queryKey: ["stores"], queryFn: () => api.stores() });
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<"all" | "attention" | "off">("all");
  const [plan, setPlan] = useState("");
  const stores = useMemo(() => q.data?.stores ?? [], [q.data]);
  const plans = useMemo(() => [...new Set(stores.map((s) => s.plan?.name ?? "No plan"))].sort(), [stores]);
  const shown = useMemo(() => stores.filter((s) => {
    const t = text.trim().toLowerCase();
    if (t && !`${s.name} ${s.slug} ${s.ownerEmail}`.toLowerCase().includes(t)) return false;
    if (filter === "attention" && !needsAttention(s)) return false;
    if (filter === "off" && !s.disabled) return false;
    if (plan && (s.plan?.name ?? "No plan") !== plan) return false;
    return true;
  }), [stores, text, filter, plan]);

  return (
    <Screen title="Stores" subtitle={q.data ? `${stores.length} client${stores.length === 1 ? "" : "s"}` : "Your clients"} onRefresh={() => void q.refetch()} refreshing={q.isFetching && !q.isLoading} testID="screen-stores">
      <SearchField value={text} onChange={setText} placeholder="Search a store, address or owner" testID="stores-search" />
      <Segmented testID="stores-filter" value={filter} onChange={setFilter} options={[{ value: "all", label: "All", count: stores.length }, { value: "attention", label: "Needs a look", count: stores.filter(needsAttention).length }, { value: "off", label: "Switched off", count: stores.filter((s) => s.disabled).length }]} />
      {plans.length > 1 ? <Select value={plan} onChange={setPlan} options={[{ value: "", label: "Every plan" }, ...plans.map((p) => ({ value: p, label: p }))]} placeholder="Every plan" testID="stores-plan" /> : null}
      {q.isLoading ? <LoadingCards n={4} /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : !shown.length ? <Empty icon="stores" title={stores.length ? "No store matches" : "No stores yet"} message={stores.length ? "Try another word, or clear the filters." : "Stores appear here once a client is onboarded."} /> : (
        <Grid min={330}>
          {shown.map((s, i) => {
            const st = standing(s);
            return (
              <Row key={s.id} index={i} icon="stores" title={s.name} subtitle={`${s.ownerEmail} · since ${day(s.createdAt)}`} onPress={() => router.push(`/stores/${s.id}`)} testID={`store-${s.slug}`} right={<View style={{ alignItems: "flex-end", gap: 5 }}><Pill tone={st.tone}>{st.label}</Pill><Text variant="caption" tone="muted">{s.plan?.name ?? "No plan"}</Text></View>}>
                <View style={{ gap: 8 }}>
                  {([["Outlets", s.usage.outlets, s.max.outlets], ["People", s.usage.users, s.max.users], ["Tables", s.usage.tables, s.max.tables]] as const).map(([label, used, max]) => (
                    <View key={label} style={{ gap: 4 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text variant="caption" tone="muted">{label}</Text><Text variant="caption" tone="muted">{used}{max ? ` of ${max}` : " · no limit"}</Text></View>
                      <Meter value={fraction(used, max)} warn height={6} />
                    </View>
                  ))}
                </View>
              </Row>
            );
          })}
        </Grid>
      )}
    </Screen>
  );
}
