import type { ReactNode } from "react";
import { View } from "react-native";
import { Icon, type IconName } from "./Icon";
import { Text } from "./Text";
import { radius, useTheme } from "./theme";

export type TileTone = "primary" | "ok" | "warn" | "info" | "danger" | "neutral";

/** An icon on a softly tinted rounded square — the way a heading, a row or a table state gets its picture. */
export function IconTile({ icon, tone = "primary", size = 40 }: { icon: IconName; tone?: TileTone; size?: number }) {
  const { c } = useTheme();
  const look = { primary: [c.surfaceAlt, c.primaryText], ok: [c.successWash, c.success], warn: [c.warningWash, c.warning], info: [c.infoWash, c.info], danger: [c.dangerWash, c.danger], neutral: [c.surfaceAlt, c.muted] }[tone];
  return (
    <View style={{ width: size, height: size, borderRadius: size > 32 ? radius.md : radius.sm, backgroundColor: look[0], alignItems: "center", justifyContent: "center" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Icon name={icon} size={Math.round(size * 0.55)} color={look[1]} />
    </View>
  );
}

/** A page heading: its icon, the title, and something small on the right (which outlet, how many). */
export function ScreenTitle({ icon, title, right }: { icon: IconName; title: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <IconTile icon={icon} />
      <Text variant="title" accessibilityRole="header" style={{ flexShrink: 1 }}>{title}</Text>
      {right ? <View style={{ flex: 1, alignItems: "flex-end" }}>{right}</View> : null}
    </View>
  );
}

/** A heading inside a page ("Orders (2)", "Size"): a small icon, the words, and something small on the right. */
export function SectionTitle({ icon, title, right }: { icon: IconName; title: string; right?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }} accessible accessibilityRole="header" accessibilityLabel={title}>
      <Icon name={icon} size={18} color={c.primaryText} />
      <Text variant="subheading" style={{ flex: 1 }}>{title}</Text>
      {right}
    </View>
  );
}
