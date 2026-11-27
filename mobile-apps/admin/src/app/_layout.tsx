import { useEffect } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useStore } from "zustand";
import { wireQueryClient } from "@/data/setup";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { RuntimeProvider, sharedRuntime } from "@/runtime";
import { AppIcon, Background, ErrorState, Spinner, Text, ToastHost, useTheme } from "@/ui";

const runtime = sharedRuntime();

/** If a screen crashes, show a calm message and a way back instead of a red error box. */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 16 }}>
      <Background target={false} />
      <ErrorState error={error} onRetry={retry} />
    </View>
  );
}

function Splash() {
  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: 10 }} testID="splash">
      <Background target={false} />
      <AppIcon size={96} label={`${APP_NAME} icon`} />
      <Text variant="title">{APP_NAME}</Text>
      <Text tone="muted">{APP_TAGLINE}</Text>
      <View style={{ marginTop: 12 }}><Spinner label="Starting" /></View>
    </View>
  );
}

export default function RootLayout() {
  const status = useStore(runtime.session, (s) => s.status);
  const { dark } = useTheme();
  // the app has just opened: connect to the phone's state (background / online) and look for a kept sign-in
  useEffect(() => {
    const unwire = wireQueryClient();
    void runtime.session.getState().start();
    return unwire;
  }, []);
  return (
    <SafeAreaProvider>
      <RuntimeProvider runtime={runtime}>
        <StatusBar style={dark ? "light" : "dark"} />
        <View style={{ flex: 1 }}>
          <Background />
          <Stack screenOptions={{ headerShown: false, animation: "fade", contentStyle: { backgroundColor: "transparent" } }}>
            {/* nothing past the sign-in is reachable until a team member has signed in */}
            <Stack.Protected guard={status === "signed-in"}><Stack.Screen name="(app)" /></Stack.Protected>
            <Stack.Protected guard={status !== "signed-in"}><Stack.Screen name="sign-in" /></Stack.Protected>
          </Stack>
        </View>
        <ToastHost />
        {status === "starting" ? <Splash /> : null}
      </RuntimeProvider>
    </SafeAreaProvider>
  );
}
