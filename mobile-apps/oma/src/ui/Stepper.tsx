import { View } from "react-native";
import { IconButton } from "./Button";
import { Text } from "./Text";
import { radius, useTheme } from "./theme";

/** − 2 + : the number of portions. `min` 0 lets the minus button remove the line; `min` 1 stops at one. */
export function Stepper({ value, onChange, min = 0, max = 99, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; label: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", borderRadius: radius.pill, backgroundColor: c.surfaceAlt }}>
      <IconButton icon="minus" label={`Fewer ${label}`} size={40} disabled={value <= min} onPress={() => onChange(Math.max(min, value - 1))} />
      <Text variant="subheading" style={{ minWidth: 28, textAlign: "center" }} testID="stepper-value" accessibilityLabel={`${label}: ${value}`}>{value}</Text>
      <IconButton icon="plus" label={`More ${label}`} size={40} disabled={value >= max} onPress={() => onChange(Math.min(max, value + 1))} />
    </View>
  );
}
