import { useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/runtime";
import { useAction } from "@/data/useAction";
import { bytes, count, dateTime } from "@/lib/format";
import { Button, ConfirmSheet, Empty, ErrorState, Glass, Grid, LoadingCards, Row, Screen, Section, Segmented, Stat, Text } from "@/ui";

const LIFETIMES = [{ value: "0", label: "Off" }, { value: "300", label: "5 min" }, { value: "3600", label: "1 h" }, { value: "86400", label: "24 h" }];

/** What the API remembers between requests (so stores open fast) — and a way to make it forget, for everyone or for one store. */
export function Cache() {
  const api = useApi();
  const q = useQuery({ queryKey: ["cache"], queryFn: () => api.cache() });
  const [ask, setAsk] = useState<null | { id?: string; name?: string }>(null);
  const c = q.data?.cache;

  const expire = useAction((t: { id?: string; name?: string }) => api.expireCache(t.id), { done: (t) => (t.id ? `${t.name} will load fresh data.` : "Everything will load fresh data."), invalidate: [["cache"]], onDone: () => setAsk(null) });
  const ttl = useAction((v: string) => api.setCacheTtl(Number(v)), { done: "Saved.", invalidate: [["cache"]] });
  const ttlValue = c ? (LIFETIMES.some((l) => l.value === String(c.ttlSeconds)) ? String(c.ttlSeconds) : "") : "";

  return (
    <Screen title="Cache" subtitle="What the API remembers, and how long." onRefresh={() => void q.refetch()} refreshing={q.isFetching && !q.isLoading} testID="screen-cache"
      right={c ? <Button size="sm" icon="refresh" title="Expire all" onPress={() => setAsk({})} testID="expire-all" /> : undefined}>
      {q.isLoading ? <LoadingCards n={3} /> : q.isError || !c ? <ErrorState error={q.error ?? new Error("No answer from the server.")} onRetry={() => void q.refetch()} /> : (
        <>
          <Grid min={150}>
            <Stat label="Remembered" value={count(c.stats.entries)} sub={bytes(c.stats.bytes)} icon="cache" />
            <Stat label="Hit rate" value={c.stats.hitRate === null ? "–" : `${Math.round(c.stats.hitRate * 100)}%`} sub={`${count(c.stats.hits)} hits · ${count(c.stats.misses)} misses`} tone="ok" icon="trend" />
            <Stat label="Last expired" value={c.lastExpiredAt ? dateTime(c.lastExpiredAt) : "Never"} icon="history" />
          </Grid>
          <Section title="How long it is remembered" hint={c.enabled ? "Changes at once, for everyone." : "The cache is OFF: every request asks the database."}>
            <Segmented testID="cache-ttl" value={ttlValue as string} onChange={(v) => { if (v) ttl.mutate(v); }} options={LIFETIMES} />
            {!ttlValue ? <Text variant="caption" tone="muted" style={{ marginTop: 8 }}>Now: {c.ttlSeconds} seconds (set elsewhere).</Text> : null}
          </Section>
          <Section title="By store">
            {!c.stores.length ? <Empty icon="cache" title="Nothing remembered yet" message="Stores appear here once someone opens them." /> : (
              <Grid min={330}>{c.stores.map((s, i) => (
                <Row key={s.id} index={i} icon="stores" title={s.name} testID={`cache-store-${s.name}`} subtitle={`${count(s.entries)} remembered · ${bytes(s.bytes)}${s.lastExpiredAt ? ` · expired ${dateTime(s.lastExpiredAt)}` : ""}`}>
                  <View style={{ flexDirection: "row" }}><Button size="sm" variant="glass" icon="refresh" title="Expire this store" onPress={() => setAsk({ id: s.id, name: s.name })} testID={`expire-${s.name}`} /></View>
                </Row>
              ))}</Grid>
            )}
          </Section>
          <Glass><Text variant="caption" tone="muted">Expiring does not delete anything of the stores. The next visit simply loads fresh data (a little slower once).</Text></Glass>
        </>
      )}
      <ConfirmSheet visible={Boolean(ask)} title={ask?.id ? `Expire ${ask.name}?` : "Expire everything?"} message={ask?.id ? "This store's menu, look and plan are loaded fresh on the next visit." : "Every store's remembered data is dropped. The next visits are a little slower while it fills again."} confirm="Expire" danger={false} busy={expire.isPending} onConfirm={() => ask && expire.mutate(ask)} onClose={() => setAsk(null)} />
    </Screen>
  );
}
