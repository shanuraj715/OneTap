import { useEffect } from "react";
import { Stack } from "expo-router";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useStore } from "zustand";
import { useRuntime, useSession } from "@/runtime";

const KEEP_AWAKE_TAG = "kda-board";

/**
 * Everything after sign-in. Two jobs that belong to "a person is working at an outlet": bring back what they keep the way they like it (the
 * alert, the station), and keep the screen on while they cook (if they want it) so the board never goes dark.
 */
export default function AppLayout() {
  const { settings } = useRuntime();
  const userId = useSession((s) => s.user?.id);
  const outletId = useSession((s) => s.outletId);
  const keepAwake = useStore(settings.store, (s) => s.keepAwake);

  useEffect(() => {
    if (userId && outletId) void settings.load(userId, outletId);
  }, [settings, userId, outletId]);

  useEffect(() => {
    if (!keepAwake) return;
    // (a phone that refuses is not worth an error: the screen just sleeps as usual)
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => { void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined); };
  }, [keepAwake]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
