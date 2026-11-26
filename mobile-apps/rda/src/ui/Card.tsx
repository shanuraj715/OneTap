import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";
import { radius, useTheme } from "./theme";

/** A raised panel. Give it `onPress` and it becomes a button. */
export function Card({ children, onPress, style, label, testID, selected }: { children: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; label?: string; testID?: string; selected?: boolean }) {
  const { c } = useTheme();
  const base: ViewStyle = { backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: selected ? 2 : 1, borderColor: selected ? c.primary : c.border, padding: 14 };
  if (!onPress) return <View testID={testID} style={[base, style]}>{children}</View>;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!selected }} onPress={onPress} android_ripple={{ color: "rgba(0,0,0,0.08)" }} style={[base, style]}>
      {children}
    </Pressable>
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: 1, backgroundColor: c.border }} />;
}
