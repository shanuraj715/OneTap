import type { ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { useLayout } from "@/lib/layout";
import { Icon, type IconName, useTheme } from "@/ui";

function TabIcon({ name, color, size }: { name: IconName; color: ColorValue; size: number }) {
  return <Icon name={name} size={size} color={typeof color === "string" ? color : undefined} />;
}

/** Deliveries · Done · Account. On a wide tablet the bar moves to the left edge. */
export default function TabsLayout() {
  const { c } = useTheme();
  const layout = useLayout();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarPosition: layout.kind === "wide" ? "left" : "bottom",
        tabBarVariant: layout.kind === "wide" ? "material" : "uikit",
        tabBarLabelPosition: layout.kind === "wide" ? "below-icon" : undefined,
        tabBarActiveTintColor: c.primaryText,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderColor: c.border },
        tabBarLabelStyle: { fontWeight: "600" },
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Deliveries", tabBarIcon: ({ color, size }) => <TabIcon name="bike" color={color} size={size} />, tabBarButtonTestID: "tab-deliveries" }} />
      <Tabs.Screen name="done" options={{ title: "Done", tabBarIcon: ({ color, size }) => <TabIcon name="check-circle" color={color} size={size} />, tabBarButtonTestID: "tab-done" }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: ({ color, size }) => <TabIcon name="user" color={color} size={size} />, tabBarButtonTestID: "tab-account" }} />
    </Tabs>
  );
}
