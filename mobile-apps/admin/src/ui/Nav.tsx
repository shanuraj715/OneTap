import { Animated, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppIcon } from "./AppIcon";
import { Frost, Icon, Text, type IconName, usePressScale } from "./primitives";
import { radius, useTheme } from "./theme";

export interface NavItem { id: string; label: string; icon: IconName }

/** The side rail of a tablet: the app icon, one button per area the person's role holds, and their account at the bottom. */
export function Rail({ items, current, onPick, footer }: { items: NavItem[]; current: string; onPick: (id: string) => void; footer?: React.ReactNode }) {
  const { c, dark } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ width: 92, paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10, borderRightWidth: StyleSheet.hairlineWidth * 1.5, borderRightColor: c.border, overflow: "hidden" }} testID="nav-rail">
      <Frost intensity={dark ? 45 : 60} />
      <View style={{ alignItems: "center", marginBottom: 8 }}><AppIcon size={46} label="Rasoi Pulse Admin" /></View>
      <ScrollView contentContainerStyle={{ alignItems: "center", gap: 6, paddingVertical: 8 }} showsVerticalScrollIndicator={false}>
        {items.map((it) => <RailButton key={it.id} item={it} on={it.id === current} onPress={() => onPick(it.id)} />)}
      </ScrollView>
      {footer}
    </View>
  );
}
function RailButton({ item, on, onPress }: { item: NavItem; on: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const press = usePressScale(0.92);
  return (
    <Pressable onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={item.label} testID={`nav-${item.id}`}>
      <Animated.View style={[press.style, { width: 74, alignItems: "center", gap: 3, paddingVertical: 9, borderRadius: radius.md, backgroundColor: on ? c.glassStrong : "transparent", borderWidth: on ? 1 : 0, borderColor: c.border }]}>
        <Icon name={item.icon} size={21} color={on ? c.primaryText : c.muted} />
        <Text variant="caption" style={{ color: on ? c.text : c.muted, fontSize: 10.5 }} numberOfLines={1}>{item.label}</Text>
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
                <View style={{ alignItems: "center", gap: 2, paddingVertical: 8, borderRadius: radius.lg, overflow: "hidden", backgroundColor: on ? c.glassStrong : "transparent", borderWidth: on ? 1 : 0, borderColor: c.border }}>
                  <Icon name={it.icon} size={21} color={on ? c.primaryText : c.muted} />
                  <Text variant="caption" style={{ color: on ? c.text : c.muted, fontSize: 10.5 }} numberOfLines={1}>{it.label}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
