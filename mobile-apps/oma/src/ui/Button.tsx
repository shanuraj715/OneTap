import { Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { Icon, type IconName } from "./Icon";
import { Spinner } from "./Spinner";
import { Text } from "./Text";
import { radius, useTheme } from "./theme";

export type ButtonVariant = "primary" | "secondary" | "outline" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<PressableProps, "style" | "children"> {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** shows a spinner and ignores taps (the title stays so the button does not change width) */
  loading?: boolean;
  icon?: IconName;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const HEIGHT: Record<ButtonSize, number> = { sm: 40, md: 48, lg: 56 };

export function Button({ title, variant = "primary", size = "md", loading = false, icon, fullWidth = false, disabled, style, onPress, ...rest }: ButtonProps) {
  const { c, dark } = useTheme();
  const inactive = !!disabled || loading;
  const look = {
    primary: { bg: c.primary, fg: c.onPrimary, border: c.primary },
    secondary: { bg: c.surfaceAlt, fg: c.text, border: c.surfaceAlt },
    outline: { bg: "transparent", fg: c.primaryText, border: c.border },
    danger: { bg: c.danger, fg: "#FFFFFF", border: c.danger },
    ghost: { bg: "transparent", fg: c.primaryText, border: "transparent" },
  }[variant];
  // a danger button is filled with the status colour; its label must read on it in BOTH themes
  const label = variant === "danger" ? (dark ? c.bg : "#FFFFFF") : look.fg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.12)" }}
      style={[
        { minHeight: HEIGHT[size], paddingHorizontal: size === "sm" ? 14 : 20, borderRadius: radius.md, backgroundColor: look.bg, borderWidth: 1, borderColor: look.border, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: disabled && !loading ? 0.5 : 1, alignSelf: fullWidth ? "stretch" : "flex-start", overflow: "hidden" },
        style,
      ]}
      {...rest}
    >
      {loading ? <Spinner size={18} color={label} label="Please wait" /> : icon ? <Icon name={icon} size={18} color={label} /> : null}
      <Text variant="subheading" style={{ color: label, fontSize: size === "sm" ? 14 : 16 }} numberOfLines={1}>{title}</Text>
    </Pressable>
  );
}

/** A round button with just an icon (needs a label for screen readers). */
export function IconButton({ icon, label, onPress, disabled, size = 44, tone = "default", testID }: { icon: IconName; label: string; onPress?: () => void; disabled?: boolean; size?: number; tone?: "default" | "primary" | "danger"; testID?: string }) {
  const { c } = useTheme();
  const color = tone === "primary" ? c.primaryText : tone === "danger" ? c.danger : c.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      android_ripple={{ color: "rgba(0,0,0,0.12)", radius: size / 2 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1 }}
    >
      <View><Icon name={icon} size={Math.round(size * 0.5)} color={color} /></View>
    </Pressable>
  );
}
