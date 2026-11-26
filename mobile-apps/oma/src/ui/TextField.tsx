import { useState, type Ref } from "react";
import { TextInput, View, type TextInputInstance, type TextInputProps } from "react-native";
import { Icon, type IconName } from "./Icon";
import { IconButton } from "./Button";
import { Text } from "./Text";
import { useReveal } from "./Sheet";
import { radius, useTheme } from "./theme";

export interface TextFieldProps extends Omit<TextInputProps, "style"> {
  label: string;
  error?: string | null;
  helper?: string;
  leftIcon?: IconName;
  /** a password: dots, with an eye button to show it */
  secure?: boolean;
  /** the label is still read aloud, just not drawn (a search box that says "Find a dish" in its hint) */
  hideLabel?: boolean;
  /** a slimmer box, for toolbars */
  compact?: boolean;
  /** a ✕ inside the box while it holds text: empties it */
  onClear?: () => void;
  ref?: Ref<TextInputInstance>;
}

export function TextField({ label, error, helper, leftIcon, secure = false, hideLabel = false, compact = false, onClear, multiline, ref, ...rest }: TextFieldProps) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  const [shown, setShown] = useState(false);
  const reveal = useReveal(); // inside a scrolling pop-up: bring this box into view above the keyboard
  const border = error ? c.danger : focused ? c.primaryText : c.border;
  return (
    <View style={{ gap: 6 }}>
      {hideLabel ? null : <Text variant="label" tone={error ? "danger" : "default"}>{label}</Text>}
      <View style={{ flexDirection: "row", alignItems: multiline ? "flex-start" : "center", backgroundColor: c.surface, borderWidth: focused || error ? 2 : 1, borderColor: border, borderRadius: radius.md, paddingHorizontal: 12, minHeight: multiline ? 88 : compact ? 44 : 50, gap: 8 }}>
        {leftIcon ? <View style={{ paddingTop: multiline ? 14 : 0 }}><Icon name={leftIcon} size={18} color={c.muted} /></View> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor={c.muted}
          secureTextEntry={secure && !shown}
          multiline={multiline}
          textAlignVertical={multiline ? "top" : "center"}
          onFocus={(e) => { setFocused(true); reveal?.(); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          style={{ flex: 1, color: c.text, fontSize: 16, paddingVertical: multiline ? 12 : 10 }}
          {...rest}
        />
        {onClear && rest.value ? <IconButton icon="close" label={`Clear ${label}`} size={36} onPress={onClear} /> : null}
        {secure ? <IconButton icon={shown ? "eye-off" : "eye"} label={shown ? "Hide password" : "Show password"} size={36} onPress={() => setShown((s) => !s)} /> : null}
      </View>
      {error ? <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">{error}</Text> : helper ? <Text variant="caption" tone="muted">{helper}</Text> : null}
    </View>
  );
}
