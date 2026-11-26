import { useState } from "react";
import { View } from "react-native";
import { useStore } from "zustand";
import { isKitchenManager, canSwitchDishes, roleTitle } from "@/auth/permissions";
import { API_HOST, APP_BUILD, APP_NAME, APP_TAGLINE, APP_VERSION } from "@/lib/config";
import { useRuntime, useSession } from "@/runtime";
import { Button, Card, ConfirmDialog, Divider, Dropdown, Icon, IconTile, Screen, ScreenTitle, SwitchRow, Text, toasts, useTheme, type IconName } from "@/ui";

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

/** Who is signed in and what they may do, where they are working, how the screen behaves, the app's version, and Sign out. */
export function AccountScreen() {
  const { c } = useTheme();
  const { session, settings, updates } = useRuntime();
  const user = useSession((s) => s.user);
  const outlets = useSession((s) => s.outlets);
  const outletId = useSession((s) => s.outletId);
  const prefs = useStore(settings.store);
  const updateStatus = useStore(updates, (s) => s.status);
  const updateLatest = useStore(updates, (s) => s.latest);
  const updateChecking = useStore(updates, (s) => s.checking);
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);

  if (!user) return null;
  const outlet = outlets.find((o) => o.id === outletId);

  async function checkForUpdates() {
    const status = await updates.getState().check(true);
    const { error } = updates.getState();
    if (error) toasts.warn(`Couldn't check for updates: ${error}`);
    else if (status === "current") toasts.ok("You have the latest version.");
    // (an available / required update opens its own pop-up or screen)
  }
  async function signOut() {
    setLeaving(true);
    try { await session.getState().signOut(); } finally { setLeaving(false); setConfirming(false); }
  }

  return (
    <Screen scroll narrow>
      <ScreenTitle icon="user" title="Account" />

      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <IconTile icon="user" tone="info" size={48} />
          <View style={{ flex: 1 }}>
            <Text variant="subheading" testID="account-name">{user.name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><Icon name="mail" size={13} color={c.muted} /><Text tone="muted" selectable>{user.email}</Text></View>
          </View>
        </View>
        <Divider />
        <Fact icon="shield" label="Role" value={roleTitle(user)} />
        <Fact icon="check-circle" label="Mark dishes sold out" value={canSwitchDishes(user) ? "Yes" : "No"} />
        <Fact icon="hash" label="Set stock numbers and see today's numbers" value={isKitchenManager(user) ? "Yes — kitchen manager" : "No — kitchen manager only"} />
      </Card>

      {user.isSuperAdmin ? (
        <Card style={{ gap: 12 }}>
          <Fact icon="store" label="Working at" value={outlet ? `${outlet.name}${outlet.brandName ? ` · ${outlet.brandName}` : ""}` : "—"} />
          <Button title="Change store or outlet" icon="swap" variant="outline" fullWidth onPress={() => session.getState().changeOutlet()} testID="change-outlet" />
        </Card>
      ) : outlets.length > 1 ? (
        <Dropdown<string>
          label="Working at"
          value={outletId}
          options={outlets.map((o) => ({ value: o.id, label: o.name, hint: o.brandName || undefined }))}
          onChange={(id) => { void session.getState().selectOutlet(id).then(() => toasts.ok(`Now working at ${outlets.find((o) => o.id === id)?.name ?? "this outlet"}`)); }}
          testID="outlet-dropdown"
        />
      ) : (
        <Card><Fact icon="store" label="Working at" value={outlet ? `${outlet.name}${outlet.brandName ? ` · ${outlet.brandName}` : ""}` : "—"} /></Card>
      )}

      <Card style={{ gap: 14 }}>
        <SwitchRow icon="bell" label="New-order alert" hint="Vibrate and say so when a new order comes in." value={prefs.alerts} onChange={(v) => void settings.set({ alerts: v })} testID="switch-alerts" />
        <Divider />
        <SwitchRow icon="eye" label="Keep the screen on" hint="So the board never goes dark while you cook. It uses more battery: keep the phone on charge." value={prefs.keepAwake} onChange={(v) => void settings.set({ keepAwake: v })} testID="switch-keep-awake" />
      </Card>

      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <IconTile icon="pot" size={36} />
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
