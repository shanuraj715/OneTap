import { useEffect, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "zustand";
import { useRuntime } from "@/runtime";
import { Spinner, Text, radius, useTheme } from "@/ui";

/**
 * "Reconnecting…" with a spinner, at the top of the screen, while the live connection is coming back. It waits a moment before it
 * appears (a blink in the connection shouldn't flash a banner) and never blocks a touch: the person can keep working with the last
 * information on the screen. It goes away by itself the moment the connection is back.
 */
export function LiveBanner({ graceMs = 1200 }: { graceMs?: number }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const status = useStore(useRuntime().live, (s) => s.status);
  const [shown, setShown] = useState(false);
  // the banner waits its moment; when the connection is back (or the wait is interrupted) it goes away and the next time waits again
  useEffect(() => {
    if (status !== "reconnecting") return;
    const timer = setTimeout(() => setShown(true), graceMs);
    return () => { clearTimeout(timer); setShown(false); };
  }, [status, graceMs]);
  if (status !== "reconnecting" || !shown) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: insets.top + 6, left: 0, right: 0, alignItems: "center", zIndex: 1100 }}>
      <View
        testID="live-reconnecting"
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel="Reconnecting. Showing the last information."
        style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.lg, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, elevation: 4, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } }}
      >
        <Spinner size={18} label="Reconnecting" />
        <View>
          <Text variant="label">Reconnecting…</Text>
          <Text variant="caption" tone="muted">Showing the last information</Text>
        </View>
      </View>
    </View>
  );
}
