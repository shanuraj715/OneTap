import { useState } from "react";
import { Linking, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { areasFor } from "@/lib/access";
import { showAreasOnAccount } from "@/lib/nav";
import { API_HOST, APP_BUILD, APP_NAME, APP_VERSION } from "@/lib/config";
import { bytes } from "@/lib/format";
import { lockAvailable } from "@/lib/biometrics";
import { useAppLock } from "@/data/appLock";
import { toasts } from "@/ui/toast-store";
import { useOptions } from "@/data/queries";
import { useApi, useMe, useRuntime } from "@/runtime";
import { AppSwitch, Button, Glass, Pill, Row, Screen, Section, Text, initialsOf, useResponsive, useTheme } from "@/ui";

/** The person's own account — and, on a phone whose tab bar can't hold every area, the list of areas. (A tablet's side rail already shows them all.) */
export function More() {
  const me = useMe();
  const { session } = useRuntime();
  const { c } = useTheme();
  const { tablet } = useResponsive();
  const options = useOptions();
  const areas = areasFor(me, options.data?.features ?? null);
  return (
    <Screen title="Account" testID="screen-more">
      <Glass blur strong>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: c.primary }}><Text variant="heading" style={{ color: c.onPrimary }}>{initialsOf(me?.name ?? "")}</Text></View>
          <View style={{ flex: 1 }}>
            <Text variant="heading" numberOfLines={1}>{me?.name}</Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>{me?.email}</Text>
            <Text variant="caption" tone="primary" testID="account-role">{(me?.role ?? "").replace("_", " ").replace(/^./, (ch) => ch.toUpperCase()) || "Team member"}</Text>
          </View>
        </View>
      </Glass>
      {showAreasOnAccount(areas.length, tablet) ? (
        <Section title="Everything in the app">
          <View style={{ gap: 10 }}>{areas.map((a, i) => <Row key={a.id} index={i} icon={a.icon} title={a.label} subtitle={a.hint} onPress={() => router.navigate(`/${a.id}` as never)} testID={`more-${a.id}`} />)}</View>
        </Section>
      ) : null}
      <Section title="Security">
        <AppLockRow />
      </Section>
      <Section title={tablet ? "This tablet" : "This phone"}>
        <Glass>
          <View style={{ gap: 12 }}>
            <Text variant="caption" tone="muted">{APP_NAME} · {APP_VERSION} · {API_HOST}</Text>
            <UpdateCheck />
            <Button title="Sign out" icon="logout" variant="glass" onPress={() => void session.getState().signOut()} testID="signout" />
          </View>
        </Glass>
      </Section>
    </Screen>
  );
}

/** The switch for the app lock: asks for the fingerprint to turn it on or off, and says so when this phone has no screen lock. */
function AppLockRow() {
  const enabled = useAppLock((s) => s.enabled);
  const setEnabled = useAppLock((s) => s.setEnabled);
  const [busy, setBusy] = useState(false);
  const available = useQuery({ queryKey: ["lock-available"], queryFn: lockAvailable, staleTime: Infinity });
  const change = async (on: boolean) => {
    setBusy(true);
    const done = await setEnabled(on);
    setBusy(false);
    if (!done) toasts.error(on && available.data === false ? "Set up a fingerprint, face or screen lock in the phone's settings first." : "The app lock was not changed.");
  };
  return (
    <Glass>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label">App lock</Text>
          <Text variant="caption" tone="muted">Ask for your fingerprint, face or screen lock when the app opens. Your sales stay private if the phone is lost.</Text>
        </View>
        <AppSwitch value={enabled} disabled={busy} onValueChange={(on) => void change(on)} accessibilityLabel="App lock" testID="app-lock-switch" />
      </View>
      {available.data === false && !enabled ? <Text variant="caption" tone="warn" style={{ marginTop: 8 }} testID="app-lock-unavailable">This phone has no fingerprint, face or screen lock set up yet.</Text> : null}
    </Glass>
  );
}

/** "Check for updates": asks the server whether a newer build is out and where to get it. */
function UpdateCheck() {
  const api = useApi();
  const [state, setState] = useState<"idle" | "checking" | "latest" | "error" | { version: string; notes?: string; size?: number; url?: string; force: boolean }>("idle");
  const check = async () => {
    setState("checking");
    try {
      const r = await api.updateCheck(APP_BUILD);
      setState(r.updateAvailable && r.latest ? { version: r.latest.version, notes: r.latest.notes, size: r.latest.fileSize, url: r.pageUrl, force: r.force } : "latest");
    } catch { setState("error"); }
  };
  return (
    <View style={{ gap: 8 }}>
      <Button title={state === "checking" ? "Checking…" : "Check for updates"} icon="refresh" variant="glass" loading={state === "checking"} onPress={() => void check()} testID="update-check" />
      {state === "latest" ? <Text variant="caption" tone="muted" testID="update-latest">You have the latest version.</Text> : null}
      {state === "error" ? <Text variant="caption" tone="warn" testID="update-error">Couldn&apos;t check just now. Try again in a moment.</Text> : null}
      {typeof state === "object" ? (
        <View style={{ gap: 6 }} testID="update-available">
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><Text variant="label">Version {state.version} is ready</Text>{state.force ? <Pill tone="warn">Needed</Pill> : null}</View>
          {state.notes ? <Text variant="caption" tone="muted">{state.notes}</Text> : null}
          {state.url ? <Button title={`Get it${state.size ? ` (${bytes(state.size)})` : ""}`} icon="download" onPress={() => void Linking.openURL(state.url!)} testID="update-get" /> : null}
        </View>
      ) : null}
    </View>
  );
}
