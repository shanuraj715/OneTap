import type { ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { useLayout } from "@/lib/layout";
import { Icon, type IconName, useTheme } from "@/ui";

function TabIcon({ name, color, size }: { name: IconName; color: ColorValue; size: number }) {
  return <Icon name={name} size={size} color={typeof color === "string" ? color : undefined} />;
}

/** Tables · Orders · Account. On a wide tablet the bar moves to the left edge, so the board and the order get the full height. */
export default function TabsLayout() {
  const { c } = useTheme();
  const layout = useLayout();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: layout.kind === "wide" ? "left" : "bottom",
        // on the side the bar is a slim navigation rail (the library's "material" style), not a wide panel
        tabBarVariant: layout.kind === "wide" ? "material" : "uikit",
        // labels under the icons keep the rail narrow (beside the icons the library forces about a third of the screen)
        tabBarLabelPosition: layout.kind === "wide" ? "below-icon" : undefined,
        tabBarActiveTintColor: c.primaryText,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderColor: c.border },
        tabBarLabelStyle: { fontWeight: "600" },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Tables", tabBarIcon: ({ color, size }) => <TabIcon name="table" color={color} size={size} />, tabBarButtonTestID: "tab-tables" }} />
      <Tabs.Screen name="orders" options={{ title: "Orders", tabBarIcon: ({ color, size }) => <TabIcon name="receipt" color={color} size={size} />, tabBarButtonTestID: "tab-orders" }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: ({ color, size }) => <TabIcon name="user" color={color} size={size} />, tabBarButtonTestID: "tab-account" }} />
    </Tabs>
  );
}
