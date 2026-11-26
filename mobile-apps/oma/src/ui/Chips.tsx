import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { radius, useTheme } from "./theme";
import type { Tone } from "@/features/orders";

/** A tap-to-filter pill ("Terrace", "Seated 4"). Selected = filled. */
export function Chip({ label, selected = false, count, onPress, icon, testID }: { label: string; selected?: boolean; count?: number; onPress?: () => void; icon?: IconName; testID?: string }) {
  const { c } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={count === undefined ? label : `${label}, ${count}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: selected ? c.primary : c.surface, borderWidth: 1, borderColor: selected ? c.primary : c.border }}
    >
      {icon ? <Icon name={icon} size={16} color={selected ? c.onPrimary : c.muted} /> : null}
      <Text variant="label" style={{ color: selected ? c.onPrimary : c.text }}>{label}</Text>
      {count !== undefined ? <Text variant="label" style={{ color: selected ? c.onPrimary : c.muted }}>{count}</Text> : null}
    </Pressable>
  );
}

/** Two to four choices side by side, exactly one picked (Veg / Non-veg / All). */
export function SegmentedControl<T extends string>({ options, value, onChange, label, compact = false }: { options: { value: T; label: string; /** drawn before the label */ icon?: ReactNode }[]; value: T; onChange: (v: T) => void; label: string; compact?: boolean }) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: "row", backgroundColor: c.surfaceAlt, borderRadius: radius.md, padding: 3 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={o.label} onPress={() => onChange(o.value)} style={{ flex: 1, minHeight: compact ? 34 : 38, flexDirection: "row", gap: 5, alignItems: "center", justifyContent: "center", borderRadius: radius.md - 3, backgroundColor: on ? c.surface : "transparent" }}>
            {o.icon}
            <Text variant="label" style={{ color: on ? c.text : c.muted, fontSize: compact ? 12.5 : 13 }} numberOfLines={1}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A small coloured label: a status ("Ready to serve"), a tag ("Bestseller"). Colour is never the only signal — the words say it too. */
export function Badge({ label, tone = "neutral", icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const { c } = useTheme();
  const look = { neutral: [c.surfaceAlt, c.muted], info: [c.infoWash, c.info], ok: [c.successWash, c.success], warn: [c.warningWash, c.warning], danger: [c.dangerWash, c.danger] }[tone];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: look[0] }}>
      {icon ? <Icon name={icon} size={12} color={look[1]} strokeWidth={2.5} /> : null}
      <Text variant="caption" style={{ color: look[1], fontWeight: "600" }}>{label}</Text>
    </View>
  );
}
