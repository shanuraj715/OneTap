import { useState } from "react";
import { Linking, View } from "react-native";
import { useStore } from "zustand";
import { API_HOST, APP_BUILD, APP_NAME, APP_TAGLINE, APP_VERSION } from "@/lib/config";
import { useRuntime, useSession } from "@/runtime";
import type { PushStatus } from "@/notifications/push";
import { Button, Card, ConfirmDialog, Divider, Icon, IconTile, Screen, ScreenTitle, SwitchRow, Text, toasts, useTheme, type IconName } from "@/ui";

function Fact({ label, value, icon }: { label: string; value: string; icon: IconName }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Icon name={icon} size={18} color={c.muted} />
      <Text tone="muted" style={{ flex: 1 }}>{label}</Text>
      <Text style={{ flexShrink: 1, textAlign: "right" }} selectable>{value}</Text>
    </View>
  );
}

const PUSH_TEXT: Record<PushStatus, { line: string; tone: "default" | "success" | "warning" | "muted" }> = {
  unknown: { line: "Checking…", tone: "muted" },
  on: { line: "On. A new delivery reaches you even when the app is closed or minimised.", tone: "success" },
  denied: { line: "Blocked. Allow notifications for this app in your phone's settings, or you will only hear about a delivery with the app open.", tone: "warning" },
  unavailable: { line: "Not available on this phone or build. You will hear about a new delivery with the app open (and on WhatsApp, if your store sends it).", tone: "warning" },
  failed: { line: "Allowed, but the server could not be told (no internet?). It is tried again when you open the app.", tone: "warning" },
};

/** Notifications for new deliveries while the app is closed: where they stand, and a way to turn them on or fix them. */
function NotificationsCard() {
  const { push } = useRuntime();
  const status = useStore(push.store, (s) => s.status);
  const [busy, setBusy] = useState(false);
  const { line, tone } = PUSH_TEXT[status];
  async function turnOn() { setBusy(true); try { await push.enable(); } finally { setBusy(false); } }
  return (
    <Card style={{ gap: 10 }} testID="notifications-card">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <IconTile icon="bell" tone={status === "on" ? "ok" : status === "unknown" ? "neutral" : "warn"} size={36} />
        <View style={{ flex: 1 }}>
          <Text variant="subheading">Notifications</Text>
          <Text variant="caption" tone="muted">When a delivery is handed to you</Text>
        </View>
      </View>
      <Text tone={tone} testID="notifications-status">{line}</Text>
      {status === "denied" ? <Button title="Open phone settings" icon="external" variant="outline" fullWidth onPress={() => void Linking.openSettings()} testID="notifications-settings" /> : null}
      {status === "failed" || status === "unknown" ? <Button title="Turn on" icon="bell" variant="outline" fullWidth loading={busy} onPress={() => void turnOn()} testID="notifications-turn-on" /> : null}
    </Card>
  );
}

/** Who is signed in, where they work, notifications, the new-delivery alert, the app's version, and Sign out. */
export function AccountScreen() {
  const { c } = useTheme();
  const { session, settings, updates, push } = useRuntime();
  const rider = useSession((s) => s.rider);
  const prefs = useStore(settings.store);
  const updateStatus = useStore(updates, (s) => s.status);
  const updateLatest = useStore(updates, (s) => s.latest);
  const updateChecking = useStore(updates, (s) => s.checking);
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);

  if (!rider) return null;

  async function checkForUpdates() {
    const status = await updates.getState().check(true);
    const { error } = updates.getState();
    if (error) toasts.warn(`Couldn't check for updates: ${error}`);
    else if (status === "current") toasts.ok("You have the latest version.");
    // (an available / required update opens its own pop-up or screen)
  }
  async function signOut() {
    setLeaving(true);
    try {
      await push.disable(); // while the sign-in still works: this phone stops getting this rider's notifications
      await session.getState().signOut();
    } finally { setLeaving(false); setConfirming(false); }
  }

  return (
    <Screen scroll narrow>
      <ScreenTitle icon="user" title="Account" />

      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <IconTile icon="bike" tone="info" size={48} />
          <View style={{ flex: 1 }}>
            <Text variant="subheading" testID="account-name">{rider.name}</Text>
            {rider.phone ? <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><Icon name="phone" size={13} color={c.muted} /><Text tone="muted" selectable>{rider.phone}</Text></View> : null}
          </View>
        </View>
        <Divider />
        <Fact icon="store" label="Store" value={rider.storeName || "—"} />
        <Fact icon="pin" label="Outlet" value={rider.outletName || "—"} />
      </Card>

      <NotificationsCard />

      <Card style={{ gap: 14 }}>
        <SwitchRow icon="bell" label="New-delivery alert" hint="Vibrate and say so when the manager hands you an order." value={prefs.alerts} onChange={(v) => void settings.set({ alerts: v })} testID="switch-alerts" />
      </Card>

      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <IconTile icon="bike" size={36} />
          <View style={{ flex: 1 }}>
            <Text variant="subheading">{APP_NAME}</Text>
            <Text variant="caption" tone="muted">{APP_TAGLINE}</Text>
          </View>
        </View>
        <Divider />
        <Fact icon="tag" label="Version" value={APP_VERSION} />
        <Fact icon="hash" label="Build" value={String(APP_BUILD)} />
        <Fact icon="server" label="Server" value={API_HOST} />
        <Divider />
        <Fact icon="download" label="Updates" value={updateStatus === "available" ? `${updateLatest?.version ?? "A new version"} is out` : updateStatus === "required" ? "Update required" : updateStatus === "current" ? "Up to date" : "Not checked yet"} />
        <Button title="Check for updates" icon="refresh" variant="outline" fullWidth loading={updateChecking} onPress={() => void checkForUpdates()} testID="check-updates" />
      </Card>

      <Button title="Sign out" icon="logout" variant="outline" fullWidth onPress={() => setConfirming(true)} testID="sign-out" />

      <ConfirmDialog
        visible={confirming}
        title="Sign out?"
        icon="logout"
        message="You will need your email and password to sign in again."
        confirmLabel="Yes, sign out"
        loading={leaving}
        onConfirm={() => void signOut()}
        onCancel={() => setConfirming(false)}
      />
    </Screen>
  );
}
