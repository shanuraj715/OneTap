import type { ColorValue } from "react-native";
import { Tabs } from "expo-router";
import { isKitchenManager } from "@/auth/permissions";
import { useLayout } from "@/lib/layout";
import { useSession } from "@/runtime";
import { Icon, type IconName, useTheme } from "@/ui";

function TabIcon({ name, color, size }: { name: IconName; color: ColorValue; size: number }) {
  return <Icon name={name} size={size} color={typeof color === "string" ? color : undefined} />;
}

/**
 * Board · Prep · Dishes · Today · Account. "Today" (the day's numbers) is the kitchen manager's: the other roles never see the tab.
 * On a wide tablet the bar moves to the left edge, so the board gets the full height.
 */
export default function TabsLayout() {
  const { c } = useTheme();
  const layout = useLayout();
  const user = useSession((s) => s.user);
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
      <Tabs.Screen name="index" options={{ title: "Board", tabBarIcon: ({ color, size }) => <TabIcon name="pot" color={color} size={size} />, tabBarButtonTestID: "tab-board" }} />
      <Tabs.Screen name="prep" options={{ title: "Prep", tabBarIcon: ({ color, size }) => <TabIcon name="list" color={color} size={size} />, tabBarButtonTestID: "tab-prep" }} />
      <Tabs.Screen name="dishes" options={{ title: "Dishes", tabBarIcon: ({ color, size }) => <TabIcon name="utensils" color={color} size={size} />, tabBarButtonTestID: "tab-dishes" }} />
      <Tabs.Screen name="today" options={{ title: "Today", href: isKitchenManager(user) ? undefined : null, tabBarIcon: ({ color, size }) => <TabIcon name="grid" color={color} size={size} />, tabBarButtonTestID: "tab-today" }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: ({ color, size }) => <TabIcon name="user" color={color} size={size} />, tabBarButtonTestID: "tab-account" }} />
    </Tabs>
  );
}
