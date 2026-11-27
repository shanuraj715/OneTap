import { useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/runtime";
import type { Plan } from "@/api/endpoints";
import { count } from "@/lib/format";
import { FEATURE_CHOICES, ORDER_MODE_CHOICES } from "@/lib/onboarding";
import { Empty, ErrorState, Glass, Grid, LoadingCards, Pill, Row, Screen, Section, Segmented, Sheet, Text } from "@/ui";

const LABELS: Record<string, string> = Object.fromEntries([...ORDER_MODE_CHOICES.map((m) => [m.feature, m.label]), ...FEATURE_CHOICES.map((f) => [f.key, f.label])]);
const limit = (n: number | null, one: string, many: string) => (n === null ? `any ${many}` : `${count(n)} ${n === 1 ? one : many}`);
export const limitsLine = (p: Plan) => [limit(p.limits.maxOutlets, "outlet", "outlets"), limit(p.limits.maxUsers, "person", "people"), limit(p.limits.maxTables, "table", "tables")].join(" · ");

/** The plans and what each includes. Read only here: making and changing plans is done in the web console. */
export function Plans() {
  const api = useApi();
  const q = useQuery({ queryKey: ["plans"], queryFn: () => api.plans() });
  const [show, setShow] = useState<"live" | "archived">("live");
  const [open, setOpen] = useState<Plan | null>(null);
  const [last, setLast] = useState<Plan | null>(null);
  if (open && open !== last) setLast(open);
  const all = q.data?.plans ?? [];
  const plans = all.filter((p) => (show === "archived") === p.archived);
  const shown = open ?? last;
  return (
    <Screen title="Plans" subtitle="What each plan includes. Change plans in the web console." onRefresh={() => void q.refetch()} refreshing={q.isFetching && !q.isLoading} testID="screen-plans">
      <Segmented testID="plans-filter" value={show} onChange={setShow} options={[{ value: "live", label: "Live", count: all.filter((p) => !p.archived).length }, { value: "archived", label: "Archived", count: all.filter((p) => p.archived).length }]} />
      {q.isLoading ? <LoadingCards n={3} /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : !plans.length ? <Empty icon="plans" title="No plans here" message={show === "archived" ? "Nothing is archived." : "Plans are made in the web console."} /> : (
        <Grid min={330}>{plans.map((p, i) => (
          <Row key={p.id} index={i} icon="plans" title={p.name} testID={`plan-${p.name}`} onPress={() => setOpen(p)}
            subtitle={p.custom ? "Limits and features set by hand for each store" : limitsLine(p)}
            right={<View style={{ alignItems: "flex-end", gap: 5 }}>{p.marketing?.price ? <Text variant="label">{p.marketing.price}</Text> : null}<Text variant="caption" tone="muted">{p.storeCount} {p.storeCount === 1 ? "store" : "stores"}</Text></View>} />
        ))}</Grid>
      )}
      <Sheet visible={Boolean(open)} onClose={() => setOpen(null)} title={shown?.name ?? "Plan"} testID="plan-sheet">
        {shown ? (
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {shown.custom ? <Pill tone="primary">Custom</Pill> : null}
              {shown.archived ? <Pill>Archived</Pill> : null}
              <Pill tone="info">{shown.storeCount} {shown.storeCount === 1 ? "store" : "stores"}</Pill>
              {shown.marketing?.price ? <Pill tone="ok">{shown.marketing.price}</Pill> : null}
            </View>
            {shown.description ? <Text variant="body" tone="muted">{shown.description}</Text> : null}
            <Section title="Limits"><Glass><Text variant="body" testID="plan-limits">{shown.custom ? "Set by hand on each store." : limitsLine(shown)}</Text></Glass></Section>
            <Section title="Features">
              <Glass>
                {shown.custom ? <Text variant="body">Nothing is included by itself: each store's features are switched on by hand.</Text>
                  : shown.entitlements.allFeatures ? <Text variant="body" testID="plan-features">Every feature.</Text>
                  : <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }} testID="plan-features">{shown.entitlements.features.length ? shown.entitlements.features.map((f) => <Pill key={f} tone="info">{LABELS[f] ?? f}</Pill>) : <Text variant="body" tone="muted">None.</Text>}</View>}
              </Glass>
            </Section>
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
