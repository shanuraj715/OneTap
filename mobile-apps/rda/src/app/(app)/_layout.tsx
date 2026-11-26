import { useEffect } from "react";
import { Stack } from "expo-router";
import { useRuntime, useSession } from "@/runtime";

/** Everything after sign-in. One job that belongs to "a rider is signed in": bring back what they keep the way they like it (the alert). */
export default function AppLayout() {
  const { settings } = useRuntime();
  const riderId = useSession((s) => s.rider?.id);
  useEffect(() => {
    if (riderId) void settings.load(riderId);
  }, [settings, riderId]);
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
