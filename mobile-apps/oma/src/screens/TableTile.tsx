import { Pressable, View } from "react-native";
import type { Table } from "@/api/schemas";
import { Icon, Text, radius, useTheme } from "@/ui";

/**
 * A table to pick (where to move a party): the TABLE NUMBER big, and under it how many people it seats — written out, with a chair
 * icon, so "T2 · 4" can never be read as something else. A ✓ marks the chosen one.
 */
export function TableTile({ table, selected, onPress }: { table: Table; selected: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const seats = `${table.seats} ${table.seats === 1 ? "seat" : "seats"}`;
  return (
    <Pressable
      testID={`move-to-${table.number}`}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`Table ${table.number}, ${seats}${table.zone ? `, ${table.zone}` : ""}`}
      onPress={onPress}
      android_ripple={{ color: "rgba(0,0,0,0.08)" }}
      style={{ width: 104, minHeight: 82, paddingVertical: 10, paddingHorizontal: 8, alignItems: "center", justifyContent: "center", gap: 4, borderRadius: radius.md, backgroundColor: selected ? c.surfaceAlt : c.surface, borderWidth: selected ? 2 : 1, borderColor: selected ? c.primary : c.border }}
    >
      {selected ? <View style={{ position: "absolute", top: 6, right: 6 }}><Icon name="check-circle" size={16} color={c.primaryText} /></View> : null}
      <Text variant="caption" tone="muted">Table</Text>
      <Text variant="heading" numberOfLines={1}>{table.number}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Icon name="chair" size={14} color={c.muted} />
        <Text variant="caption" tone="muted">{seats}</Text>
      </View>
    </Pressable>
  );
}
