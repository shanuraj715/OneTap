import { useEffect, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "./AppIcon";
import { useReducedMotion } from "./motion";
import { Frost, Icon, Text, type IconName, usePressScale } from "./primitives";
import { radius, useTheme } from "./theme";

/**
 * What marks the open screen's menu item: a solid pill in the app's colour (the same look as a selected chip), with the icon and the label in white.
 * It grows in when the item becomes the active one (a new screen opened); with reduced motion it simply appears.
 */
function ActivePill({ size }: { size: number }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced) { t.setValue(1); return; }
    Animated.spring(t, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 7 }).start();
  }, [t, reduced]);
  return (
    <Animated.View testID="nav-active-pill" pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderRadius: size, backgroundColor: c.primary, shadowColor: c.primary, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, opacity: t, transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }] }]} />
  );
}

export interface NavItem { id: string; label: string; icon: IconName }

/** The side rail of a tablet: the app icon, one button per area the person's role holds, and their account at the bottom. */
export function Rail({ items, current, onPick, footer }: { items: NavItem[]; current: string; onPick: (id: string) => void; footer?: React.ReactNode }) {
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ width: 92, paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10, borderRightWidth: StyleSheet.hairlineWidth * 1.5, borderRightColor: c.border, overflow: "hidden" }} testID="nav-rail">
      <Frost intensity={dark ? 45 : 60} />
      <View style={{ alignItems: "center", marginBottom: 8 }}><AppIcon size={46} label="Rasoi Pulse Admin" /></View>
      {/* the areas scroll if the tablet is short; the account (id "more") is pinned at the bottom so it is never pushed out of sight */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ alignItems: "center", gap: 6, paddingVertical: 8 }} showsVerticalScrollIndicator={false}>
        {items.filter((it) => it.id !== "more").map((it) => <RailButton key={it.id} item={it} on={it.id === current} onPress={() => onPick(it.id)} />)}
      </ScrollView>
      {items.filter((it) => it.id === "more").map((it) => <View key={it.id} testID="nav-rail-account" style={{ alignItems: "center", paddingTop: 6 }}><RailButton item={it} on={it.id === current} onPress={() => onPick(it.id)} /></View>)}
      {footer}
    </View>
  );
}
function RailButton({ item, on, onPress }: { item: NavItem; on: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const press = usePressScale(0.92);
  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={item.label} testID={`nav-${item.id}`}>
      <Animated.View style={[press.style, { width: 74, alignItems: "center", gap: 3, paddingVertical: 9, borderRadius: radius.md }]}>
        {on ? <ActivePill size={radius.md} /> : null}
        <Icon name={item.icon} size={21} color={on ? c.onPrimary : c.muted} strokeWidth={on ? 2.4 : 2} />
        <Text variant="caption" style={{ color: on ? c.onPrimary : c.muted, fontSize: 10.5, fontWeight: on ? "800" : "500" }} numberOfLines={1}>{item.label}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** The floating glass bar of a phone: up to four areas and "More". The chosen one is lit. */
export function TabBar({ items, current, onPick }: { items: NavItem[]; current: string; onPick: (id: string) => void }) {
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 14, right: 14, bottom: insets.bottom + 10 }} testID="tab-bar">
      <View style={{ borderRadius: radius.xl, overflow: "hidden", borderWidth: 1, borderColor: c.border, backgroundColor: c.glass }}>
        <Frost intensity={dark ? 55 : 70} />
        <View style={{ flexDirection: "row", padding: 6 }}>
          {items.map((it) => {
            const on = it.id === current;
            return (
              <Pressable key={it.id} onPress={() => onPick(it.id)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={it.label} testID={`tab-${it.id}`} style={{ flex: 1 }}>
                <View style={{ alignItems: "center", gap: 2, paddingVertical: 8, borderRadius: radius.lg }}>
                  {on ? <ActivePill size={radius.lg} /> : null}
                  <Icon name={it.icon} size={21} color={on ? c.onPrimary : c.muted} strokeWidth={on ? 2.4 : 2} />
                  <Text variant="caption" style={{ color: on ? c.onPrimary : c.muted, fontSize: 10.5, fontWeight: on ? "800" : "500" }} numberOfLines={1}>{it.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
