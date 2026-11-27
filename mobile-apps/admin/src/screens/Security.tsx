import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/runtime";
import type { Block } from "@/api/endpoints";
import { useAction } from "@/data/useAction";
import { dateTime, seconds } from "@/lib/format";
import { Button, ConfirmSheet, Empty, ErrorState, Glass, Grid, LoadingCards, Pill, Row, Screen, Section, Text } from "@/ui";

export const SCOPES: Record<string, string> = { staff: "Dashboards", "staff-account": "One account (any address)", customer: "Customer codes" };
const left = (until: string | null) => (until ? Math.max(0, Math.round((new Date(until).getTime() - Date.now()) / 1000)) : 0);

/** Sign-in protection: the networks blocked after wrong passwords or codes, and how the guard works. */
export function Security() {
  const api = useApi();
  const q = useQuery({ queryKey: ["security"], queryFn: () => api.securityBlocks(), refetchInterval: 15000 });
  const [ask, setAsk] = useState(false);
  const blocks = q.data?.blocks ?? [];
  const blockedNow = blocks.filter((b) => b.blocked).length;
  const g = q.data?.settings;

  const unblock = useAction((b: Block) => api.unblock(b.id), { done: (b) => `${b.ip} can try again.`, invalidate: [["security"]] });
  const clearAll = useAction(() => api.unblockAll(), { done: "Everyone is unblocked.", invalidate: [["security"]], onDone: () => setAsk(false) });

  return (
    <Screen title="Security" subtitle="Sign-in protection: who is blocked, and why." onRefresh={() => void q.refetch()} refreshing={q.isFetching && !q.isLoading} testID="screen-security"
      right={blocks.length ? <Button size="sm" variant="glass" icon="unlock" title="Unblock all" onPress={() => setAsk(true)} testID="unblock-all" /> : undefined}>
      {q.isLoading ? <LoadingCards n={3} /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : (
        <>
          <Section title="Blocked and watched" hint={blockedNow ? `${blockedNow} blocked right now.` : "Nobody is blocked right now."}>
            {!blocks.length ? <Empty icon="security" title="Nothing to show" message="Addresses appear here after failed sign-ins." /> : (
              <Grid min={330}>{blocks.map((b, i) => (
                <Row key={b.id} index={i} icon={b.blocked ? "block" : "shield"} title={b.ip} testID={`block-${b.ip}`}
                  subtitle={`${SCOPES[b.scope] ?? b.scope} · ${b.failures} wrong · blocked ${b.strikes}× · last ${dateTime(b.lastAttemptAt)}`}
                  right={<Pill tone={b.blocked ? "danger" : "neutral"}>{b.blocked ? `Blocked · ${seconds(left(b.blockedUntil))} left` : "Watching"}</Pill>}>
                  <Button size="sm" variant="glass" icon="unlock" title="Unblock" loading={unblock.isPending && unblock.variables?.id === b.id} onPress={() => unblock.mutate(b)} testID={`unblock-${b.ip}`} />
                </Row>
              ))}</Grid>
            )}
          </Section>
          {g ? (
            <Section title="How it works" hint={q.data?.enabled ? "Switched on." : "Switched OFF on this server."}>
              <Glass><Text variant="body" style={{ lineHeight: 22 }} testID="guard-rules">
                After {g.maxFailures} wrong passwords or codes within {seconds(g.windowSeconds)}, that network is blocked for {seconds(g.steps[0] ?? 0)}. Each further block lasts longer ({g.steps.map(seconds).join(" → ")}). The climb is forgotten after {seconds(g.forgetSeconds)} without another block. No network can send more than {g.floodPerMinute} sign-in requests a minute. Blocked networks see a notice instead of the sign-in form.
              </Text></Glass>
            </Section>
          ) : null}
        </>
      )}
      <ConfirmSheet visible={ask} title="Unblock everyone?" message="Every blocked and watched network can try to sign in again straight away." confirm="Unblock all" danger={false} busy={clearAll.isPending} onConfirm={() => clearAll.mutate(undefined)} onClose={() => setAsk(false)} />
    </Screen>
  );
}
