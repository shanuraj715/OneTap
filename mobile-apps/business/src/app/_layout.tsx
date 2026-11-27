import { useEffect, useMemo } from "react";
import { AppState, View } from "react-native";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useStore } from "zustand";
import { createAwayTracker, useAppLock } from "@/data/appLock";
import { wireQueryClient } from "@/data/setup";
import { APP_NAME, APP_TAGLINE } from "@/lib/config";
import { RuntimeProvider, sharedRuntime } from "@/runtime";
import * as SystemUI from "expo-system-ui";
import { AppIcon, Background, ErrorState, LockScreen, Spinner, Text, ToastHost, navigationTheme, useTheme } from "@/ui";

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
  const lockOn = useAppLock((s) => s.enabled && s.locked);
  const { dark, c } = useTheme();
  const navTheme = useMemo(() => navigationTheme(dark ? DarkTheme : DefaultTheme, c, dark), [dark, c]);
  // the very bottom layer of the app (what shows when iOS bounces past the end of a list, while Android resizes, behind the keyboard) takes the theme's colour,
  // instead of the white of the default light config
  useEffect(() => { SystemUI.setBackgroundColorAsync(c.bgBottom).catch(() => undefined); }, [c.bgBottom]);
  // the app has just opened: connect to the phone's state (background / online) and look for a kept sign-in
  useEffect(() => {
    const unwire = wireQueryClient();
    void runtime.session.getState().start();
    return unwire;
  }, []);
  // the app lock: read the switch from the phone, and ask again when the app comes back after being away for a while
  useEffect(() => {
    void useAppLock.getState().hydrate();
    const away = createAwayTracker();
    const sub = AppState.addEventListener("change", (next) => { if (away(next)) useAppLock.getState().lock(); });
    return () => sub.remove();
  }, []);
  return (
    <SafeAreaProvider>
      <RuntimeProvider runtime={runtime}>
        <StatusBar style={dark ? "light" : "dark"} />
        <View style={{ flex: 1 }}>
          <Background />
          <ThemeProvider value={navTheme}>
            <Stack screenOptions={{ headerShown: false, animation: "fade", contentStyle: { backgroundColor: "transparent" } }}>
              {/* nothing past the sign-in is reachable until a team member has signed in */}
              <Stack.Protected guard={status === "signed-in"}><Stack.Screen name="(app)" /></Stack.Protected>
              <Stack.Protected guard={status !== "signed-in"}><Stack.Screen name="sign-in" /></Stack.Protected>
            </Stack>
          </ThemeProvider>
        </View>
        <ToastHost />
        {status === "signed-in" && lockOn ? <LockScreen /> : null}
        {status === "starting" ? <Splash /> : null}
      </RuntimeProvider>
    </SafeAreaProvider>
  );
}
