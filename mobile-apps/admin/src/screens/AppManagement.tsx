import { useState } from "react";
import { Share, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { AppSetting } from "@/api/endpoints";
import { useApi } from "@/runtime";
import { useAction } from "@/data/useAction";
import { AppSwitch, Button, ConfirmSheet, ErrorState, Glass, LoadingCards, Pill, Screen, Section, Text, useTheme } from "@/ui";

/**
 * App Management in the phone: every Rasoi Pulse app with a Public / Private switch. A public app is in the website's list of apps; a private
 * one is not listed, but its page still opens for anyone who has the link — so each app has a "Share link" button.
 * (Uploading a new version and the refresh interval stay on the web console.)
 */
export function AppManagement() {
  const api = useApi();
  const q = useQuery({ queryKey: ["app-settings"], queryFn: () => api.appSettings() });
  const [asking, setAsking] = useState<AppSetting | null>(null);
  const flip = useAction((v: { app: string; to: boolean }) => api.setAppVisibility(v.app, v.to), { done: (v) => (v.to ? "Now public: it is in the website's list." : "Now private: it is not in the website's list."), invalidate: [["app-settings"]], onDone: () => setAsking(null) });
  const apps = q.data?.settings ?? [];
  return (
    <Screen title="App Management" subtitle="Which apps the website lists." onRefresh={() => void q.refetch()} refreshing={q.isFetching && !q.isLoading} testID="screen-app-management">
      {q.isLoading ? <LoadingCards n={3} /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : (
        <Section title={`${apps.length} apps`} hint="Public = shown on the website. Private = not listed, but the page opens for anyone with the link.">
          <View style={{ gap: 12 }}>
            {apps.map((a) => <AppCard key={a.app} a={a} busy={flip.isPending} onChange={(to) => (to ? setAsking(a) : flip.mutate({ app: a.app, to }))} />)}
          </View>
          <Text variant="caption" tone="muted" style={{ marginTop: 6 }}>Uploading a new version stays on the web console (Console → App Management).</Text>
        </Section>
      )}
      <ConfirmSheet visible={Boolean(asking)} danger={false} title={`Make ${asking?.name ?? "this app"} public?`} message="It will appear on the website's list of apps, so anyone can find and download it." confirm="Make public" busy={flip.isPending}
        onConfirm={() => asking && flip.mutate({ app: asking.app, to: true })} onClose={() => setAsking(null)} />
    </Screen>
  );
}

function AppCard({ a, busy, onChange }: { a: AppSetting; busy: boolean; onChange: (to: boolean) => void }) {
  const { c } = useTheme();
  const share = () => void Share.share({ message: `${a.name}: ${a.pageUrl}` }).catch(() => undefined);
  return (
    <Glass testID={`app-${a.app}`}>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: c.glassStrong, alignItems: "center", justifyContent: "center" }}><Text variant="label" tone="primary">{a.code}</Text></View>
          <View style={{ flex: 1 }}>
            <Text variant="subheading" numberOfLines={1}>{a.name}</Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>{a.pageUrl}</Text>
          </View>
          <Pill tone={a.public ? "ok" : "neutral"} icon={a.public ? "globe" : "lock"}>{a.public ? "Public" : "Private"}</Pill>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text variant="label">{"In the website's list"}</Text>
            <Text variant="caption" tone="muted">{a.public ? "Anyone can find it on the website." : "Hidden from the list; the link still works."}</Text>
          </View>
          <AppSwitch value={a.public} disabled={busy} onValueChange={onChange} accessibilityLabel={`${a.name} is ${a.public ? "public" : "private"}`} testID={`app-switch-${a.app}`} />
        </View>
        <Button size="sm" variant="glass" icon="link" title="Share link" onPress={share} testID={`app-share-${a.app}`} />
      </View>
    </Glass>
  );
}
