import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from "react-native";
import { useTheme } from "./theme";

export type TextVariant = "title" | "heading" | "subheading" | "body" | "label" | "caption";
export type TextTone = "default" | "muted" | "primary" | "danger" | "success" | "warning" | "onPrimary";

const VARIANTS: Record<TextVariant, TextStyle> = {
  title: { fontSize: 26, lineHeight: 32, fontWeight: "700" },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: "700" },
  subheading: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 21, fontWeight: "400" },
  label: { fontSize: 13, lineHeight: 18, fontWeight: "600" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400" },
};

export interface TextProps extends RNTextProps { variant?: TextVariant; tone?: TextTone }

/** Text in the app's type scale and colours. (Long names never push things off the screen: pass numberOfLines.) */
export function Text({ variant = "body", tone = "default", style, ...rest }: TextProps) {
  const { c } = useTheme();
  const color = { default: c.text, muted: c.muted, primary: c.primaryText, danger: c.danger, success: c.success, warning: c.warning, onPrimary: c.onPrimary }[tone];
  return <RNText {...rest} style={[VARIANTS[variant], { color }, style]} />;
}
