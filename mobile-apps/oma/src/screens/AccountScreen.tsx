import { useState } from "react";
import { View } from "react-native";
import { useStore } from "zustand";
import { canManageTables } from "@/auth/permissions";
import { API_HOST, APP_BUILD, APP_NAME, APP_TAGLINE, APP_VERSION } from "@/lib/config";
import { useDrafts, useRuntime, useSession } from "@/runtime";
import { Button, Card, ConfirmDialog, Divider, Dropdown, Icon, IconTile, Screen, ScreenTitle, Text, toasts, useTheme, type IconName } from "@/ui";

const ROLE: Record<string, string> = { super_admin: "Platform admin", kitchen: "Kitchen", editor: "Editor", accountant: "Accountant", manager: "Manager", staff: "Cashier / Staff", owner: "Owner" };

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

/** Who is signed in, which outlet the app is working for, the app's version, and Sign out. */
export function AccountScreen() {
  const { c } = useTheme();
  const { session } = useRuntime();
  const user = useSession((s) => s.user);
  const outlets = useSession((s) => s.outlets);
  const outletId = useSession((s) => s.outletId);
  const unsent = useDrafts((s) => Object.values(s.drafts).filter((d) => d.lines.length > 0).length);
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [changing, setChanging] = useState(false);
  const { updates } = useRuntime();
  const updateStatus = useStore(updates, (s) => s.status);
  const updateLatest = useStore(updates, (s) => s.latest);
  const updateChecking = useStore(updates, (s) => s.checking);

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
        <Fact icon="shield" label="Role" value={ROLE[user.role ?? ""] ?? user.role ?? "—"} />
        <Fact icon="table" label="Can manage tables" value={canManageTables(user) ? "Yes" : "No — orders only"} />
      </Card>

      {user.isSuperAdmin ? (
        <Card style={{ gap: 12 }}>
          <Fact icon="store" label="Working at" value={outlet ? `${outlet.name}${outlet.brandName ? ` · ${outlet.brandName}` : ""}` : "—"} />
          <Button title="Change store or outlet" icon="swap" variant="outline" fullWidth onPress={() => (unsent > 0 ? setChanging(true) : session.getState().changeOutlet())} testID="change-outlet" />
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

      <Card style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <IconTile icon="store" size={36} />
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
        <Fact
          icon="download"
          label="Updates"
          value={updateStatus === "available" ? `${updateLatest?.version ?? "A new version"} is out` : updateStatus === "required" ? "Update required" : updateStatus === "current" ? "Up to date" : "Not checked yet"}
        />
        <Button title="Check for updates" icon="refresh" variant="outline" fullWidth loading={updateChecking} onPress={() => void checkForUpdates()} testID="check-updates" />
      </Card>

      <Button title="Sign out" icon="logout" variant="outline" fullWidth onPress={() => setConfirming(true)} testID="sign-out" />

      <ConfirmDialog
        visible={changing}
        title="Change store or outlet?"
        icon="swap"
        message={`You have ${unsent} ${unsent === 1 ? "order" : "orders"} that ${unsent === 1 ? "was" : "were"} not sent yet. ${unsent === 1 ? "It" : "They"} will be lost.`}
        confirmLabel="Yes, change"
        destructive
        onConfirm={() => { setChanging(false); session.getState().changeOutlet(); }}
        onCancel={() => setChanging(false)}
      />

      <ConfirmDialog
        visible={confirming}
        title="Sign out?"
        icon="logout"
        message={unsent > 0 ? `You have ${unsent} ${unsent === 1 ? "order" : "orders"} that ${unsent === 1 ? "was" : "were"} not sent yet. ${unsent === 1 ? "It" : "They"} will be lost.` : "You will need your email and password to sign in again."}
        confirmLabel="Yes, sign out"
        destructive={unsent > 0}
        loading={leaving}
        onConfirm={() => void signOut()}
        onCancel={() => setConfirming(false)}
      />
    </Screen>
  );
}
