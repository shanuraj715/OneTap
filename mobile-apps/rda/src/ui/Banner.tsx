import { Switch, View } from "react-native";
import { Icon, type IconName } from "./Icon";
import { IconTile } from "./IconTile";
import { Text } from "./Text";
import { radius, useTheme } from "./theme";
import type { Tone } from "@/features/tone";

/** A strip of words that explains what is going on ("Can't refresh — showing the last board"). The icon and the words carry the meaning, not only the colour. */
export function Banner({ tone = "info", title, message, testID }: { tone?: Exclude<Tone, "neutral">; title?: string; message: string; testID?: string }) {
  const { c } = useTheme();
  const look: Record<typeof tone, { bg: string; fg: string; icon: IconName }> = {
    info: { bg: c.infoWash, fg: c.info, icon: "info" },
    ok: { bg: c.successWash, fg: c.success, icon: "check" },
    warn: { bg: c.warningWash, fg: c.warning, icon: "alert" },
    danger: { bg: c.dangerWash, fg: c.danger, icon: "alert" },
  };
  const l = look[tone];
  return (
    <View testID={testID} accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ flexDirection: "row", gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: l.bg, alignItems: "flex-start" }}>
      <View style={{ paddingTop: 1 }}><Icon name={l.icon} size={18} color={l.fg} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Text variant="label" style={{ color: l.fg }}>{title}</Text> : null}
        <Text variant="body" style={{ color: c.text }}>{message}</Text>
      </View>
    </View>
  );
}

/** A setting you flip on or off, with a line of explanation under it. */
export function SwitchRow({ label, hint, value, onChange, icon, testID }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; icon?: IconName; testID?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      {icon ? <IconTile icon={icon} tone="neutral" size={36} /> : null}
      <View style={{ flex: 1 }}>
        <Text variant="subheading">{label}</Text>
        {hint ? <Text variant="caption" tone="muted">{hint}</Text> : null}
      </View>
      <Switch testID={testID} accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ false: c.border, true: c.primary }} thumbColor="#FFFFFF" />
    </View>
  );
}
