import { View } from "react-native";
import { router } from "expo-router";
import { areasFor } from "@/lib/access";
import { showAreasOnAccount } from "@/lib/nav";
import { API_HOST, APP_NAME, APP_VERSION } from "@/lib/config";
import { useOptions } from "@/data/queries";
import { useMe, useRuntime } from "@/runtime";
import { Button, Glass, Row, Screen, Section, Text, initialsOf, useResponsive, useTheme } from "@/ui";

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
      <Section title={tablet ? "This tablet" : "This phone"}>
        <Glass>
          <View style={{ gap: 12 }}>
            <Text variant="caption" tone="muted">{APP_NAME} · {APP_VERSION} · {API_HOST}</Text>
            <Button title="Sign out" icon="logout" variant="glass" onPress={() => void session.getState().signOut()} testID="signout" />
          </View>
        </Glass>
      </Section>
    </Screen>
  );
}
