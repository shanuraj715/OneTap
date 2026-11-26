import { Stack } from "expo-router";
import { useTheme } from "@/ui";

/** Everything after sign-in. The tabs have their own headings; the table and take-order pages get a title bar with a back arrow. */
export default function AppLayout() {
  const { c } = useTheme();
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: c.surface }, headerTintColor: c.text, headerTitleStyle: { fontWeight: "700" }, contentStyle: { backgroundColor: c.bg }, headerShadowVisible: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="table/[id]" options={{ title: "Table" }} />
      <Stack.Screen name="take-order/[tableId]" options={{ title: "Take order" }} />
    </Stack>
  );
}
