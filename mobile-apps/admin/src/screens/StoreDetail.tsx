import { useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useApi, useMe } from "@/runtime";
import { useAction } from "@/data/useAction";
import { canDo } from "@/lib/access";
import { dateTime, day } from "@/lib/format";
import { Button, ConfirmSheet, Empty, ErrorState, Field, Glass, Grid, Input, LoadingCards, Meter, Pill, Row, Screen, Section, Select, Sheet, Text } from "@/ui";
import { standing } from "./Stores";
import { PaymentsSection } from "./StorePayments";

type Dialog = null | "rename" | "plan" | "off" | "on" | "delete";

/** One client: standing, limits, outlets and people — and (for roles that may) rename, change plan, switch off or on, block, delete. */
export function StoreDetail({ id }: { id: string }) {
  const api = useApi();
  const me = useMe();
  const mayManage = canDo(me, "stores:manage");
  const mayDelete = canDo(me, "stores:delete");
  const q = useQuery({ queryKey: ["store", id], queryFn: () => api.store(id) });
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => api.plans(), enabled: mayManage });
  const s = q.data?.store;
  const [dialog, setDialog] = useState<Dialog>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [planId, setPlanId] = useState("");
  const [typed, setTyped] = useState("");
  const keys = [["store", id], ["stores"], ["dashboard"]];
  const close = () => { setDialog(null); setTyped(""); };

  const rename = useAction((n: string) => api.renameStore(id, n), { done: "Renamed.", invalidate: keys, onDone: close });
  const setPlan = useAction((p: string) => api.setStorePlan(id, p || null), { done: "Plan changed.", invalidate: keys, onDone: close });
  const off = useAction((m: string) => api.disableStore(id, m), { done: "The store is switched off.", invalidate: keys, onDone: close });
  const on = useAction(() => api.enableStore(id), { done: "The store is switched on.", invalidate: keys, onDone: close });
  const blockOutlet = useAction(({ outletId, blocked }: { outletId: string; blocked: boolean }) => api.blockOutlet(id, outletId, blocked), { done: (v) => (v.blocked ? "Outlet blocked." : "Outlet unblocked."), invalidate: keys });
  const blockPerson = useAction(({ userId, blocked }: { userId: string; blocked: boolean }) => api.blockPerson(id, userId, blocked), { done: (v) => (v.blocked ? "Person blocked." : "Person unblocked."), invalidate: keys });
  const remove = useAction((n: string) => api.deleteStore(id, n), { done: "The store is deleted.", invalidate: [["stores"], ["dashboard"]], onDone: () => { close(); router.replace("/stores"); } });

  const st = s ? standing(s) : null;
  return (
    <Screen title={s?.name ?? "Store"} subtitle={s ? `${s.slug} · ${s.ownerEmail}` : undefined} back={() => router.back()} onRefresh={() => void q.refetch()} refreshing={q.isFetching && !q.isLoading} testID="screen-store">
      {q.isLoading ? <LoadingCards n={3} /> : q.isError || !s ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : (
        <>
          <Glass blur strong radiusSize={26}>
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <Pill tone={st!.tone}>{st!.label}</Pill>
                <Pill tone="primary">{s.plan?.name ?? "No plan"}</Pill>
                <Pill>since {day(s.createdAt)}</Pill>
              </View>
              {s.disabled ? <View testID="store-disabled"><Text tone="warn" variant="label">Switched off since {day(s.disabled.at)}</Text><Text tone="muted" variant="caption">{s.disabled.message ? `The team sees: “${s.disabled.message}”` : "The team sees a standard notice."}</Text></View> : null}
              {!mayManage ? <Text variant="caption" tone="muted" testID="store-readonly">You can look at this store, not change it — your role doesn&apos;t include changing stores.</Text> : (
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  <Button size="sm" variant="glass" icon="edit" title="Rename" onPress={() => { setName(s.name); setDialog("rename"); }} testID="act-rename" />
                  <Button size="sm" variant="glass" icon="plans" title="Change plan" onPress={() => { setPlanId(s.plan?.id ?? ""); setDialog("plan"); }} testID="act-plan" />
                  {s.disabled ? <Button size="sm" icon="power" title="Switch on" onPress={() => setDialog("on")} testID="act-on" /> : <Button size="sm" variant="glass" icon="power" title="Switch off" onPress={() => { setMessage(""); setDialog("off"); }} testID="act-off" />}
                  {mayDelete ? <Button size="sm" variant="danger" icon="trash" title="Delete" onPress={() => setDialog("delete")} testID="act-delete" /> : null}
                </View>
              )}
            </View>
          </Glass>

          <Section title="Limits in use">
            <Glass>
              <View style={{ gap: 12 }}>
                {([["Outlets", s.usage.outlets, s.max.outlets], ["People", s.usage.users, s.max.users], ["Tables", s.usage.tables, s.max.tables]] as const).map(([label, used, max]) => (
                  <View key={label} style={{ gap: 5 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text variant="label">{label}</Text><Text variant="label" tone="muted">{used}{max ? ` of ${max}` : " · no limit"}</Text></View>
                    <Meter value={max ? used / max : 0} warn />
                  </View>
                ))}
              </View>
            </Glass>
          </Section>

          <Section title="Subscription payments" hint="What this store has paid Rasoi Pulse">
            <PaymentsSection id={id} mayManage={mayManage} />
          </Section>

          <Section title={`Outlets (${s.outlets.length})`}>
            {s.outlets.length ? <Grid min={320}>{s.outlets.map((o, i) => (
              <Row key={o.id} index={i} icon="outlet" title={o.name} subtitle={o.slug} testID={`outlet-${o.slug}`}
                right={o.blocked ? <Pill tone="danger">Blocked</Pill> : mayManage ? undefined : <Pill tone="ok">Open</Pill>}>
                {mayManage ? <Button size="sm" variant="glass" icon={o.blocked ? "unlock" : "block"} title={o.blocked ? "Unblock" : "Block"} loading={blockOutlet.isPending} onPress={() => blockOutlet.mutate({ outletId: o.id, blocked: !o.blocked })} testID={`block-outlet-${o.slug}`} /> : null}
              </Row>
            ))}</Grid> : <Empty icon="outlet" title="No outlets" />}
          </Section>

          <Section title={`People (${s.people.length})`}>
            {s.people.length ? <Grid min={320}>{s.people.map((p, i) => (
              <Row key={p.id} index={i} icon="user" title={p.name} subtitle={`${p.email} · ${p.role.replace("_", " ")} · last in ${dateTime(p.lastLoginAt)}`} testID={`person-${p.email}`}
                right={p.blockedAt ? <Pill tone="danger">Blocked</Pill> : !p.isActive ? <Pill>Switched off</Pill> : undefined}>
                {mayManage ? <Button size="sm" variant="glass" icon={p.blockedAt ? "unlock" : "block"} title={p.blockedAt ? "Unblock" : "Block"} loading={blockPerson.isPending} onPress={() => blockPerson.mutate({ userId: p.id, blocked: !p.blockedAt })} testID={`block-person-${p.email}`} /> : null}
              </Row>
            ))}</Grid> : <Empty icon="user" title="Nobody yet" />}
          </Section>

          <Section title="Addresses and what the plan includes">
            <Glass>
              <View style={{ gap: 10 }}>
                <Text variant="label">{s.domains.primary ?? s.subdomain.host ?? "No address yet"}</Text>
                {s.domains.hostnames.length > 1 ? <Text variant="caption" tone="muted">{s.domains.hostnames.join(" · ")}</Text> : null}
                <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>{s.entitlements.features.map((f) => <Pill key={f}>{f}</Pill>)}</View>
              </View>
            </Glass>
          </Section>

          <Sheet visible={dialog === "rename"} onClose={close} title="Rename the store" footer={<><Button title="Cancel" variant="glass" onPress={close} /><Button title="Save" loading={rename.isPending} disabled={!name.trim() || name.trim() === s.name} onPress={() => rename.mutate(name.trim())} testID="rename-save" /></>}>
            <Field label="Store name" hint="This is the name on its storefront, receipts and customer messages."><Input value={name} onChangeText={setName} autoCapitalize="words" testID="rename-input" /></Field>
          </Sheet>
          <Sheet visible={dialog === "plan"} onClose={close} title="Change the plan" footer={<><Button title="Cancel" variant="glass" onPress={close} /><Button title="Save" loading={setPlan.isPending} disabled={planId === (s.plan?.id ?? "")} onPress={() => setPlan.mutate(planId)} testID="plan-save" /></>}>
            <Select label="Plan" value={planId} onChange={setPlanId} options={[{ value: "", label: "No plan (unlimited)" }, ...((plans.data?.plans ?? []).filter((p) => !p.archived).map((p) => ({ value: p.id, label: p.name, hint: p.custom ? "Set by hand for this client" : `${p.limits.maxOutlets ?? "unlimited"} outlets · ${p.limits.maxUsers ?? "unlimited"} people` })))]} testID="plan-select" />
          </Sheet>
          <Sheet visible={dialog === "off"} onClose={close} title="Switch this store off" footer={<><Button title="Cancel" variant="glass" onPress={close} /><Button title="Switch off" variant="danger" loading={off.isPending} onPress={() => off.mutate(message.trim())} testID="off-confirm" /></>}>
            <Text tone="muted" style={{ lineHeight: 21 }}>Customers can&apos;t order and the team can&apos;t use the dashboard. Nothing is deleted. Use it for a late payment.</Text>
            <Field label="What the team sees (optional)"><Input value={message} onChangeText={setMessage} multiline maxLength={500} autoCapitalize="sentences" testID="off-message" /></Field>
          </Sheet>
          <ConfirmSheet visible={dialog === "on"} title="Switch this store on" message="Customers can order again and the team can sign in, exactly as before." confirm="Switch on" danger={false} busy={on.isPending} onConfirm={() => on.mutate(undefined as never)} onClose={close} />
          <ConfirmSheet visible={dialog === "delete"} title="Delete this store for good" message={`This removes ${s.name}, its outlets, menu, orders and people. It can't be undone. Type the store's name to confirm.`} confirm="Delete forever" busy={remove.isPending} onConfirm={() => typed === s.name && remove.mutate(typed)} onClose={close}>
            <Input value={typed} onChangeText={setTyped} placeholder={s.name} autoCapitalize="none" testID="delete-name" />
            {typed && typed !== s.name ? <Text variant="caption" tone="muted">The name has to match exactly.</Text> : null}
          </ConfirmSheet>
        </>
      )}
    </Screen>
  );
}
