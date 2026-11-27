import { useState } from "react";
import { Switch, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/runtime";
import { useAction } from "@/data/useAction";
import { Button, ErrorState, Field, Glass, Input, LoadingCards, Screen, Section, Text, useTheme } from "@/ui";

/** Platform-wide settings: how long a store keeps working after it passes its limits, and the live-updates switch. */
export function Settings() {
  const api = useApi();
  const q = useQuery({ queryKey: ["settings"], queryFn: () => api.settings() });
  const s = q.data?.settings;
  return (
    <Screen title="Settings" subtitle="Rules for the whole platform." onRefresh={() => void q.refetch()} refreshing={q.isFetching && !q.isLoading} testID="screen-settings">
      {q.isLoading ? <LoadingCards n={2} /> : q.isError || !s ? <ErrorState error={q.error ?? new Error("No answer from the server.")} onRetry={() => void q.refetch()} /> : <SettingsForm key={`${s.graceDays}-${s.realtimeWebsocket}`} initial={s} />}
    </Screen>
  );
}

function SettingsForm({ initial }: { initial: { graceDays: number; realtimeWebsocket: boolean; subdomainBase: string } }) {
  const api = useApi();
  const { c } = useTheme();
  const [days, setDays] = useState(String(initial.graceDays));
  const [live, setLive] = useState(initial.realtimeWebsocket);
  const n = Number(days);
  const valid = /^\d{1,3}$/.test(days) && n >= 0 && n <= 365;
  const dirty = n !== initial.graceDays || live !== initial.realtimeWebsocket;
  const save = useAction(() => api.saveSettings({ graceDays: n, realtimeWebsocket: live }), { done: "Saved.", invalidate: [["settings"]] });
  return (
    <>
      <Section title="Grace period">
        <Glass><View style={{ gap: 10 }}>
          <Field label="Days a store keeps working after it passes a plan limit" hint="After this, the extra outlets or people are locked. 0 locks them at once." error={valid ? undefined : "Enter a whole number from 0 to 365."}>
            <Input value={days} onChangeText={(t) => setDays(t.replace(/\D/g, "").slice(0, 3))} keyboardType="numeric" testID="setting-grace" />
          </Field>
        </View></Glass>
      </Section>
      <Section title="Live updates">
        <Glass><View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text variant="subheading">Live connection for dashboards and apps</Text>
            <Text variant="caption" tone="muted">On: changes reach the screens by themselves. Off: they ask every few seconds instead.</Text>
          </View>
          <Switch value={live} onValueChange={setLive} trackColor={{ true: c.primary, false: c.glassStrong }} accessibilityLabel="Live connection" testID="setting-live" />
        </View></Glass>
      </Section>
      <Section title="Addresses">
        <Glass><Text variant="body">Free store addresses end in <Text variant="subheading">{initial.subdomainBase || "—"}</Text>. This is set on the server.</Text></Glass>
      </Section>
      <Button title="Save" icon="check" disabled={!valid || !dirty} loading={save.isPending} onPress={() => save.mutate(undefined)} testID="settings-save" />
    </>
  );
}
