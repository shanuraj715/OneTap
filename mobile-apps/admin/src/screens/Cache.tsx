import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/runtime";
import type { CacheEntry, ExpireScope } from "@/api/endpoints";
import { useAction } from "@/data/useAction";
import { EXPIRE_WORDS, NEXT_WORDS, groupCache, summarize, type ExpireKind, type StoreGroup } from "@/lib/cache";
import { bytes, count, duration, seconds } from "@/lib/format";
import { Button, ErrorState, Field, Glass, Icon, Input, LoadingCards, Screen, Section, Sheet, Text, useTheme } from "@/ui";

/** What a tap on an Expire button will do: the words, the real list of items it drops, and the request it sends once confirmed. */
interface Ask { kind: ExpireKind; name?: string; entries: CacheEntry[]; run: ExpireScope; done: string }

const items = (n: number) => `${count(n)} ${n === 1 ? "item" : "items"}`;

/**
 * What the API remembers, grouped by where it belongs: the admin panel's own items, and the stores (open Store Cache → pick a store → its outlets).
 * Every Expire says first what it will drop. The lifetime is one input, shown in words.
 */
export function Cache() {
  const api = useApi();
  const q = useQuery({ queryKey: ["cache"], queryFn: () => api.cacheEntries() });
  const d = q.data;
  const [storesOpen, setStoresOpen] = useState(false);
  const [openStore, setOpenStore] = useState<string | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const groups = useMemo(() => (d ? groupCache(d.entries, d.stores) : null), [d]);
  const expire = useAction((a: Ask) => api.expireCache(a.run), { done: (a) => `Expired ${a.done}: ${items(a.entries.length)}.`, invalidate: [["cache"]], onDone: () => setAsk(null) });
  const storeRows = groups ? groups.stores.flatMap((s) => s.rows) : [];

  return (
    <Screen title="Cache" subtitle="What the API remembers, grouped by where it belongs." onRefresh={() => void q.refetch()} refreshing={q.isFetching && !q.isLoading} testID="screen-cache">
      {q.isLoading ? <LoadingCards n={3} /> : q.isError || !d || !groups ? <ErrorState error={q.error ?? new Error("No answer from the server.")} onRetry={() => void q.refetch()} /> : (
        <>
          <Glass strong testID="cache-summary"><View style={{ gap: 10 }}>
            <Text variant="heading">{items(d.totals.entries)} remembered · {bytes(d.totals.bytes)}</Text>
            <Text variant="caption" tone="muted" testID="cache-now">{d.enabled ? `Each item is remembered for ${duration(d.ttlSeconds)}, then the next visit reloads it.` : "The cache is OFF: every request asks the database."}</Text>
            <Button title="Expire everything" icon="refresh" variant="glass" size="sm" onPress={() => setAsk({ kind: "all", entries: d.entries, run: { scope: "all" }, done: "everything" })} testID="expire-all" />
          </View></Glass>

          <Section title="How long it is remembered"><LifetimeBox key={d.ttlSeconds} current={d.ttlSeconds} /></Section>

          <Section title="Admin Panel Cache" hint="What belongs to no store: this console's numbers, the website's pages and prices, and “no store has this address” answers.">
            <Glass testID="cache-admin-group"><View style={{ gap: 12 }}>
              {groups.admin.length ? groups.admin.map((e) => <EntryLine key={e.key} e={e} />) : <Text tone="muted" testID="cache-admin-empty">Nothing is remembered here right now.</Text>}
              <Button title="Expire admin panel cache" icon="refresh" variant="glass" size="sm" onPress={() => setAsk({ kind: "admin", entries: groups.admin, run: { scope: "admin" }, done: "the admin panel's cache" })} testID="expire-admin" />
            </View></Glass>
          </Section>

          <Section title="Store Cache">
            <Glass testID="cache-store-card"><View style={{ gap: 12 }}>
              <Pressable onPress={() => setStoresOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: storesOpen }} accessibilityLabel="Store Cache" testID="cache-store-toggle" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Icon name={storesOpen ? "down" : "chevron"} size={20} />
                <View style={{ flex: 1 }}>
                  <Text variant="subheading">Store Cache</Text>
                  <Text variant="caption" tone="muted">{groups.stores.length ? `${groups.stores.length} ${groups.stores.length === 1 ? "store" : "stores"} · ${items(storeRows.length)} — ${storesOpen ? "pick a store" : "tap to open"}` : "No store has anything remembered right now."}</Text>
                </View>
              </Pressable>
              {storesOpen ? (
                <View style={{ gap: 12 }} testID="cache-store-group">
                  {!groups.stores.length ? <Text tone="muted" testID="cache-stores-empty">Stores appear here once someone opens them.</Text> : null}
                  {groups.stores.map((s) => <StoreBlock key={s.id} s={s} open={openStore === s.id} onToggle={() => setOpenStore(openStore === s.id ? null : s.id)} onAsk={setAsk} />)}
                </View>
              ) : null}
            </View></Glass>
          </Section>
          <Text variant="caption" tone="muted">“Expire this store” and “Expire everything” also reach other API servers sharing the database; “Expire this outlet” and “Expire admin panel cache” act on this server.</Text>
        </>
      )}
      {ask ? <ExpireSheet ask={ask} what={Object.fromEntries((d?.kinds ?? []).map((k) => [k.label, k.what]))} busy={expire.isPending} onConfirm={() => expire.mutate(ask)} onClose={() => setAsk(null)} /> : null}
    </Screen>
  );
}

/** One remembered item: what it is, what it is about, how big, how old, when it reloads. */
function EntryLine({ e }: { e: CacheEntry }) {
  return (
    <View style={{ gap: 2 }} testID="cache-entry">
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <Text variant="subheading" style={{ flex: 1 }} numberOfLines={1}>{e.label}{e.notFound ? " · not found" : ""}</Text>
        <Text variant="caption" tone="muted">{bytes(e.bytes)}</Text>
      </View>
      <Text variant="caption" tone="muted" numberOfLines={1}>{e.subject}</Text>
      <Text variant="caption" tone="muted">remembered {e.ageSeconds < 5 ? "just now" : `${seconds(e.ageSeconds)} ago`} · {e.expiresInSeconds > 0 ? `reloads in ${seconds(e.expiresInSeconds)}` : "reloads at the next visit"}</Text>
    </View>
  );
}

function StoreBlock({ s, open, onToggle, onAsk }: { s: StoreGroup; open: boolean; onToggle: () => void; onAsk: (a: Ask) => void }) {
  const { c } = useTheme();
  return (
    <View testID={`cache-store-${s.name}`} style={{ borderWidth: 1, borderColor: c.border, borderRadius: 16, padding: 12, gap: 10 }}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={s.name} testID={`cache-open-${s.name}`} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name={open ? "down" : "chevron"} size={18} />
        <View style={{ flex: 1 }}>
          <Text variant="subheading">{s.name}</Text>
          <Text variant="caption" tone="muted">{items(s.rows.length)} · {bytes(s.bytes)} · {s.outlets.length} {s.outlets.length === 1 ? "outlet" : "outlets"}</Text>
        </View>
      </Pressable>
      <Button title="Expire this store" icon="refresh" variant="glass" size="sm" onPress={() => onAsk({ kind: "store", name: s.name, entries: s.rows, run: { scope: "store", storeId: s.id }, done: s.name })} testID={`expire-store-${s.name}`} />
      {open ? (
        <View style={{ gap: 12 }} testID={`cache-outlets-${s.name}`}>
          {s.outlets.map((o) => (
            <View key={o.id} testID={`cache-outlet-${o.name}`} style={{ backgroundColor: c.glass, borderRadius: 14, padding: 12, gap: 10 }}>
              <Text variant="subheading">{o.name} <Text variant="caption" tone="muted">outlet · {items(o.rows.length)} · {bytes(o.bytes)}</Text></Text>
              {o.rows.map((e) => <EntryLine key={e.key} e={e} />)}
              <Button title="Expire this outlet" icon="refresh" variant="glass" size="sm" onPress={() => onAsk({ kind: "outlet", name: `${o.name} · ${s.name}`, entries: o.rows, run: { scope: "outlet", storeId: s.id, outletId: o.id }, done: `${o.name} (${s.name})` })} testID={`expire-outlet-${o.name}`} />
            </View>
          ))}
          {s.whole.length ? (
            <View testID={`cache-whole-${s.name}`} style={{ backgroundColor: c.glass, borderRadius: 14, padding: 12, gap: 10 }}>
              <Text variant="subheading">The whole store</Text>
              <Text variant="caption" tone="muted">Not tied to one outlet: the store’s look, plan and web addresses. “Expire this store” drops these too.</Text>
              {s.whole.map((e) => <EntryLine key={e.key} e={e} />)}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** "Expire …?": what will expire (the real list, grouped), what stays, what happens next — and only then the button. */
function ExpireSheet({ ask, what, busy, onConfirm, onClose }: { ask: Ask; what: Record<string, string>; busy: boolean; onConfirm: () => void; onClose: () => void }) {
  const words = EXPIRE_WORDS[ask.kind];
  const parts = summarize(ask.entries);
  const total = ask.entries.length;
  const size = ask.entries.reduce((n, e) => n + e.bytes, 0);
  return (
    <Sheet visible onClose={onClose} title={words.title} testID="expire-sheet"
      footer={<><Button title="Cancel" variant="glass" onPress={onClose} testID="expire-cancel" /><Button title={total === 0 ? "Nothing to expire" : `Expire ${items(total)}`} variant="danger" loading={busy} disabled={total === 0} onPress={onConfirm} testID="expire-confirm" /></>}>
      {ask.name ? <Text tone="muted">{ask.name}</Text> : null}
      <Text variant="subheading">What will expire</Text>
      <Text tone="muted">{words.drops}</Text>
      {total === 0 ? <Text variant="subheading" testID="expire-empty">Nothing is remembered here right now, so there is nothing to expire.</Text> : (
        <View style={{ gap: 6 }}>
          <Text variant="subheading" testID="expire-count">{items(total)} · {bytes(size)}</Text>
          <View style={{ gap: 4 }} testID="expire-list">
            {parts.map((p) => <Text key={p.label}><Text variant="subheading">{p.n}× </Text>{p.label}{what[p.label] ? <Text variant="caption" tone="muted"> — {what[p.label]}</Text> : null}</Text>)}
          </View>
        </View>
      )}
      <Text variant="subheading">What stays</Text>
      <Text tone="muted">{words.stays}</Text>
      <Text variant="subheading">What happens next</Text>
      <Text tone="muted">{NEXT_WORDS}</Text>
    </Sheet>
  );
}

/** The cache lifetime: type the seconds, read it back in words ("900" = "15 minutes"). Re-draws itself when the server's value changes (say, from the web console). */
function LifetimeBox({ current }: { current: number }) {
  const api = useApi();
  const [text, setText] = useState(String(current));
  const valid = /^\d{1,5}$/.test(text) && Number(text) <= 86_400;
  const save = useAction((n: number) => api.setCacheTtl(n), { done: (n) => `Saved: ${duration(n)}.`, invalidate: [["cache"]] });
  return (
    <Glass><View style={{ gap: 10 }}>
      <Field label="Remember for (seconds)" hint="0 turns the memory off · up to 86,400 (a day)" error={valid || text === "" ? undefined : "Enter a whole number of seconds, 0 to 86,400."}>
        <Input value={text} onChangeText={(t) => setText(t.replace(/\D/g, "").slice(0, 5))} keyboardType="numeric" testID="cache-ttl-input" />
      </Field>
      <Text variant="subheading" tone={valid ? "primary" : "muted"} testID="cache-ttl-text">= {valid ? duration(Number(text)) : "—"}</Text>
      <Button title="Save" icon="check" disabled={!valid || Number(text) === current} loading={save.isPending} onPress={() => save.mutate(Number(text))} testID="cache-ttl-save" />
    </View></Glass>
  );
}
