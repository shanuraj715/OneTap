import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/runtime";
import type { HealthPart } from "@/api/endpoints";
import { bytes, count, perSecond, uptime } from "@/lib/format";
import { ErrorState, Glass, Grid, LoadingCards, Meter, Pill, Screen, Section, Stat, Text, useTheme, type Tone } from "@/ui";

const LEVEL_TONE: Record<string, Tone> = { good: "ok", warning: "warn", critical: "danger" };
const TEXT_TONE: Record<string, "ok" | "warn" | "danger"> = { good: "ok", warning: "warn", critical: "danger" };
const LEVEL_WORD: Record<string, string> = { good: "Healthy", warning: "Needs a look", critical: "Trouble" };

/** The ten little boxes: as many light up (in the colour of the level) as the score says. */
export function HealthBoxes({ boxes, level, size = 14, testID }: { boxes: number; level: string | null; size?: number; testID?: string }) {
  const { c } = useTheme();
  const on = level === "good" ? c.ok : level === "warning" ? c.warn : c.danger;
  return (
    <View testID={testID} accessible accessibilityLabel={`${boxes} of 10`} style={{ flexDirection: "row", gap: 4 }}>
      {Array.from({ length: 10 }, (_, i) => <View key={i} style={{ width: size, height: size * 1.5, borderRadius: 4, backgroundColor: i < boxes ? on : c.glassStrong, opacity: i < boxes ? 1 : 0.7 }} />)}
    </View>
  );
}

/** How the machine is doing right now: a 0–10 health score, what is wrong in plain words, and the numbers behind it. Updates itself every few seconds. */
export function Server() {
  const api = useApi();
  const q = useQuery({ queryKey: ["server"], queryFn: () => api.server(), refetchInterval: 5000 });
  const s = q.data;
  const h = s?.health;
  const warnTone = (pct: number) => pct >= 90;

  return (
    <Screen title="Server" subtitle={s ? `${s.machine.hostname} · up ${uptime(s.machine.uptimeSec)}` : "How the machine is doing"} onRefresh={() => void q.refetch()} refreshing={q.isFetching && !q.isLoading} testID="screen-server">
      {q.isLoading ? <LoadingCards n={3} height={110} /> : q.isError || !s || !h ? <ErrorState error={q.error ?? new Error("No answer from the server.")} onRetry={() => void q.refetch()} /> : (
        <>
          <Glass blur strong testID="server-health">
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text variant="overline" tone="muted">Health</Text>
                  <Text variant="title" testID="server-health-label">{h.ready && h.level ? LEVEL_WORD[h.level] : "Measuring…"}</Text>
                </View>
                {h.ready && h.score !== null ? <Pill tone={LEVEL_TONE[h.level ?? "good"] ?? "neutral"}>{`${h.score} / 10`}</Pill> : null}
              </View>
              {h.ready ? <HealthBoxes boxes={h.boxes} level={h.level} size={16} testID="server-boxes" /> : null}
              {h.reasons.length ? (
                <View style={{ gap: 6 }} testID="server-reasons">
                  {h.reasons.map((r) => <Text key={r.id} variant="body"><Text variant="subheading" tone={TEXT_TONE[r.level] ?? "normal"}>{r.label}: </Text>{r.text}</Text>)}
                </View>
              ) : h.ready ? <Text tone="muted">Nothing needs attention.</Text> : null}
            </View>
          </Glass>

          <Section title="Parts">
            <Grid min={250}>{h.parts.map((p: HealthPart) => (
              <Glass key={p.id} testID={`part-${p.id}`}>
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text variant="subheading">{p.label}</Text>
                    <Text variant="label" tone={TEXT_TONE[p.level] ?? "normal"}>{p.value}</Text>
                  </View>
                  <HealthBoxes boxes={p.boxes} level={p.level} size={11} />
                  <Text variant="caption" tone="muted">{p.reason ?? p.detail}</Text>
                </View>
              </Glass>
            ))}</Grid>
          </Section>

          <Section title="Resources">
            <Grid min={290}>
              {s.cpu ? (
                <Glass testID="server-cpu"><View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text variant="subheading">Processor</Text><Text variant="label">{Math.round(s.cpu.used)}%</Text></View>
                  <Meter value={s.cpu.used / 100} warn />
                  <Text variant="caption" tone="muted">{s.machine.cpuModel} · {s.cpu.cores} cores · load {s.cpu.load.map((n) => n.toFixed(1)).join(" / ")}</Text>
                </View></Glass>
              ) : null}
              {s.memory ? (
                <Glass testID="server-memory"><View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text variant="subheading">Memory</Text><Text variant="label">{Math.round(s.memory.usedPct)}%</Text></View>
                  <Meter value={s.memory.usedPct / 100} warn />
                  <Text variant="caption" tone="muted">{bytes(s.memory.usedB)} of {bytes(s.memory.totalB)} used{s.memory.swapTotalB ? ` · swap ${Math.round(s.memory.swapUsedPct)}%` : ""}</Text>
                </View></Glass>
              ) : null}
              {s.disk.mounts.map((m) => (
                <Glass key={m.mount} testID={`server-disk-${m.mount}`}><View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text variant="subheading" numberOfLines={1} style={{ flex: 1 }}>Disk {m.mount}</Text><Text variant="label" tone={warnTone(m.usedPct) ? "danger" : "normal"}>{Math.round(m.usedPct)}%</Text></View>
                  <Meter value={m.usedPct / 100} warn />
                  <Text variant="caption" tone="muted">{bytes(m.usedB)} used · {bytes(m.availB)} free of {bytes(m.sizeB)}</Text>
                </View></Glass>
              ))}
              {s.network ? (
                <Glass testID="server-network"><View style={{ gap: 6 }}>
                  <Text variant="subheading">Network</Text>
                  <Text variant="body">↓ {perSecond(s.network.rxBps)}   ↑ {perSecond(s.network.txBps)}</Text>
                  <Text variant="caption" tone="muted">{bytes(s.network.rxTotalB)} in · {bytes(s.network.txTotalB)} out since the machine started{s.network.errors ? ` · ${count(s.network.errors)} errors` : ""}</Text>
                </View></Glass>
              ) : null}
            </Grid>
          </Section>

          <Section title="The API">
            <Grid min={150}>
              <Stat label="Database" value={s.api.db.ok ? `${s.api.db.ms ?? "?"} ms` : "Down"} tone={s.api.db.ok ? "ok" : "danger"} icon="cache" />
              <Stat label="Up for" value={uptime(s.api.uptimeSec)} icon="history" />
              <Stat label="Memory used" value={bytes(s.api.rssB)} icon="memory" />
              <Stat label="Requests / min" value={String(Math.round(s.api.requests.last5min.perMinute))} sub={`${s.api.requests.last5min.errorPct}% errors (5 min)`} tone={s.api.requests.last5min.errorPct >= 5 ? "warn" : "neutral"} icon="network" />
            </Grid>
          </Section>
        </>
      )}
    </Screen>
  );
}
