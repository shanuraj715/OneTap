import { useEffect } from "react";
import { AppState, BackHandler, Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "zustand";
import type { WhatsNew } from "@/api/schemas";
import { APP_VERSION } from "@/lib/config";
import { formatBytes } from "@/lib/size";
import { useRuntime } from "@/runtime";
import { Banner, Button, Card, Icon, IconTile, Text, toasts, radius, useTheme } from "@/ui";
import { openUpdatePage } from "./open";
import { shouldOfferUpdate } from "./store";

/** The versions newer than this one and what changed in each (newest first), as short lists. */
function WhatsNewList({ items }: { items: WhatsNew[] }) {
  const { c } = useTheme();
  if (!items.length) return null;
  return (
    <View style={{ gap: 10 }} testID="whats-new">
      {items.map((n) => {
        const lines = n.notes.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        return (
          <View key={n.versionCode} style={{ gap: 3 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name="tag" size={14} color={c.primaryText} />
              <Text variant="label">{n.version}</Text>
              {n.force ? <Text variant="caption" tone="danger">Required</Text> : null}
            </View>
            {lines.length ? lines.map((l, i) => (
              <Text key={i} variant="caption" tone="muted" style={{ paddingLeft: 20 }}>• {l}</Text>
            )) : <Text variant="caption" tone="muted" style={{ paddingLeft: 20 }}>No notes for this version.</Text>}
          </View>
        );
      })}
    </View>
  );
}

/**
 * "A new version of the app is out." Sits above everything, even the sign-in screen:
 *  - an optional update is a small pop-up with Update and Later;
 *  - a required update is a whole screen with no way past it until the new version is installed (the Back button does nothing).
 * "Update" / "Download update" opens the download page in the phone's browser.
 */
export function UpdateGate() {
  const { updates } = useRuntime();
  const state = useStore(updates);
  // ask when the app opens, and again when it comes back to the front after a long time away
  useEffect(() => {
    void updates.getState().check();
    const sub = AppState.addEventListener("change", (next) => { if (next === "active" && updates.getState().isStale()) void updates.getState().check(); });
    return () => sub.remove();
  }, [updates]);

  if (state.status === "required") return <RequiredScreen />;
  if (shouldOfferUpdate(state)) return <OptionalDialog />;
  return null;
}

function useOpenPage() {
  const { updates } = useRuntime();
  return async () => {
    const url = updates.getState().pageUrl;
    const opened = await openUpdatePage(url);
    if (!opened) toasts.error(url ? `Couldn't open the browser. Open ${url} yourself to download the app.` : "Couldn't open the download page.");
    return opened;
  };
}

function OptionalDialog() {
  const { c } = useTheme();
  const { updates } = useRuntime();
  const latest = useStore(updates, (s) => s.latest);
  const whatsNew = useStore(updates, (s) => s.whatsNew);
  const openPage = useOpenPage();
  if (!latest) return null;
  const size = formatBytes(latest.size);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => updates.getState().later()} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: c.overlay }}>
        <Pressable accessibilityLabel="Dismiss" accessibilityRole="button" onPress={() => updates.getState().later()} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
        <View testID="update-optional" accessibilityViewIsModal accessibilityRole="alert" style={{ width: "100%", maxWidth: 440, maxHeight: "86%", backgroundColor: c.surface, borderRadius: radius.lg + 4, padding: 20, gap: 12 }}>
          <IconTile icon="download" size={44} />
          <Text variant="heading" accessibilityRole="header">New version available</Text>
          <Text tone="muted">{latest.version}{size ? ` · ${size}` : ""} is ready. You have {APP_VERSION}.</Text>
          {whatsNew.length ? <ScrollView style={{ flexGrow: 0, maxHeight: 220 }}><WhatsNewList items={whatsNew} /></ScrollView> : null}
          <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
            <Button title="Later" variant="outline" icon="close" onPress={() => updates.getState().later()} />
            <Button title="Update" icon="download" onPress={() => void openPage().then((ok) => { if (ok) updates.getState().later(); })} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function RequiredScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { updates } = useRuntime();
  const latest = useStore(updates, (s) => s.latest);
  const whatsNew = useStore(updates, (s) => s.whatsNew);
  const checking = useStore(updates, (s) => s.checking);
  const openPage = useOpenPage();
  const size = latest ? formatBytes(latest.size) : "";

  async function again() {
    const before = updates.getState().status;
    const status = await updates.getState().check(true);
    const { error } = updates.getState();
    if (error) toasts.warn(`Can't check right now: ${error}`);
    else if (status === "required" && before === "required") toasts.info("This phone still has the old version. Download and install the new one first.");
  }

  // Back does nothing here: the only way on is to install the new version
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);

  return (
    // a full-screen layer drawn over the app (not a pop-up window: a window of its own does not follow the app's status-bar colours, which
    // left the clock unreadable); the root layout hides everything underneath from screen readers while this is up
    <View testID="update-required" accessibilityViewIsModal style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingHorizontal: 20 }}>
        <View style={{ width: "100%", maxWidth: 480, gap: 14 }}>
          <IconTile icon="download" tone="warn" size={64} />
          <Text variant="title" accessibilityRole="header">Update needed</Text>
          <Text tone="muted">
            This version of the app ({APP_VERSION}) can&apos;t be used any more.{latest ? ` Install ${latest.version}${size ? ` (${size})` : ""} to carry on.` : " Install the newest version to carry on."}
          </Text>
          {whatsNew.length ? <Card><Text variant="label" style={{ marginBottom: 8 }}>What&apos;s new</Text><WhatsNewList items={whatsNew} /></Card> : null}
          <Banner tone="info" message="The download page opens in your browser. Download the file, open it and tap Install, then open this app again." />
          <Button title="Download update" icon="download" size="lg" fullWidth onPress={() => void openPage()} testID="update-download" />
          <Button title="Check again" icon="refresh" variant="outline" fullWidth loading={checking} onPress={() => void again()} testID="update-check-again" />
        </View>
      </ScrollView>
    </View>
  );
}
