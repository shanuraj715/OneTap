import { useEffect } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useStore } from "zustand";
import { wireQueryClient } from "@/data/setup";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { RuntimeProvider, sharedRuntime } from "@/runtime";
import { UpdateGate } from "@/updates/UpdateGate";
import { AppIcon, ErrorState, QueryProgress, Spinner, Text, ToastHost, useTheme } from "@/ui";
import { LiveBanner } from "@/live/LiveBanner";
import { LiveBridge } from "@/live/LiveBridge";

const runtime = sharedRuntime();

/** If a screen crashes, show a calm message and a way back instead of a red error box. */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: "center", backgroundColor: c.bg, padding: 16 }}>
      <ErrorState error={error} onRetry={retry} title="This screen had a problem" />
    </View>
  );
}

function Splash() {
  const { c } = useTheme();
  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: c.bg }} testID="splash">
      <AppIcon size={88} label={`${APP_NAME} icon`} />
      <Text variant="title">{APP_NAME}</Text>
      <Text tone="muted">{APP_TAGLINE}</Text>
      <View style={{ marginTop: 12 }}><Spinner label="Starting" /></View>
    </View>
  );
}

export default function RootLayout() {
  const status = useStore(runtime.session, (s) => s.status);
  const updateRequired = useStore(runtime.updates, (s) => s.status === "required");
  // the app has just opened: connect to the phone's state (background/online) and look for a kept sign-in
  useEffect(() => {
    const unwire = wireQueryClient();
    void runtime.session.getState().start();
    return unwire;
  }, []);
  return (
    <SafeAreaProvider>
      <RuntimeProvider runtime={runtime}>
        <StatusBar style="auto" />
        {/* while the "update needed" screen is up, screen readers must not wander into the app underneath */}
        <View style={{ flex: 1 }} importantForAccessibility={updateRequired ? "no-hide-descendants" : "auto"} accessibilityElementsHidden={updateRequired}>
        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
          {/* nothing past the sign-in is reachable until a rider has signed in */}
          <Stack.Protected guard={status === "signed-in"}><Stack.Screen name="(app)" /></Stack.Protected>
          <Stack.Protected guard={status !== "signed-in"}><Stack.Screen name="sign-in" /></Stack.Protected>
        </Stack>
        <QueryProgress />
        {/* one live connection while a rider is signed in; "Reconnecting…" while it comes back */}
        <LiveBridge />
        <LiveBanner />
        </View>
        {/* "a new version is out": a pop-up (or, when the update is required, a screen nobody gets past) above everything */}
        <UpdateGate />
        <ToastHost />
        {status === "starting" ? <Splash /> : null}
      </RuntimeProvider>
    </SafeAreaProvider>
  );
}

