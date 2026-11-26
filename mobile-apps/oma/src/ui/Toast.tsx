import { useEffect, useState } from "react";
import { Animated, Easing, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStore } from "zustand";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { radius, useTheme } from "./theme";
import { toasts, type Toast as ToastData } from "./toast-store";

function ToastItem({ toast }: { toast: ToastData }) {
  const { c } = useTheme();
  const [enter] = useState(() => new Animated.Value(0));
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const timer = setTimeout(() => toasts.dismiss(toast.id), toast.durationMs);
    return () => clearTimeout(timer);
  }, [enter, toast.id, toast.durationMs]);
  const look: Record<ToastData["tone"], { bg: string; fg: string; icon: IconName }> = {
    ok: { bg: c.successWash, fg: c.success, icon: "check" },
    info: { bg: c.infoWash, fg: c.info, icon: "info" },
    warn: { bg: c.warningWash, fg: c.warning, icon: "alert" },
    danger: { bg: c.dangerWash, fg: c.danger, icon: "alert" },
  };
  const l = look[toast.tone];
  return (
    <Animated.View style={{ opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }}>
      <Pressable
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        accessibilityLabel={toast.message}
        accessibilityHint="Tap to dismiss"
        onPress={() => toasts.dismiss(toast.id)}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: l.bg, borderWidth: 1, borderColor: l.fg }}
      >
        <Icon name={l.icon} size={20} color={l.fg} />
        <Text style={{ flex: 1, color: c.text }}>{toast.message}</Text>
      </Pressable>
    </Animated.View>
  );
}

/** Put once near the top of the app: shows the short messages ("Order sent", "Table moved") above everything. */
export function ToastHost() {
  const list = useStore(toasts.store, (s) => s.toasts);
  const insets = useSafeAreaInsets();
  if (!list.length) return null;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: insets.top + 8, paddingHorizontal: 12, alignItems: "center" }}>
      <View pointerEvents="box-none" style={{ width: "100%", maxWidth: 520, gap: 8 }}>
        {list.map((t) => <ToastItem key={t.id} toast={t} />)}
      </View>
    </View>
  );
}
