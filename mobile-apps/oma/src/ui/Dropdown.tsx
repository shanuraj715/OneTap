import { useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { Icon } from "./Icon";
import { Sheet } from "./Sheet";
import { Text } from "./Text";
import { TextField } from "./TextField";
import { radius, useTheme } from "./theme";

export interface DropdownOption<T extends string> { value: T; label: string; hint?: string; disabled?: boolean }

/** Case-insensitive "contains" filter for the option list. Pure, so it is tested on its own. */
export function filterOptions<T extends string>(options: DropdownOption<T>[], query: string): DropdownOption<T>[] {
  const q = query.trim().toLowerCase();
  return q ? options.filter((o) => o.label.toLowerCase().includes(q) || (o.hint ?? "").toLowerCase().includes(q)) : options;
}

/** Past this many choices a search box appears on top of the list. */
export const SEARCH_FROM = 8;

export interface DropdownProps<T extends string> {
  label: string;
  value: T | null;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string | null;
  /** a small pill for toolbars: no label above it (the label is still read aloud and is the pop-up's title) */
  compact?: boolean;
  testID?: string;
}

/** A field that opens a list to pick from (outlet, table, payment mode). Long lists get a search box. */
export function Dropdown<T extends string>({ label, value, options, onChange, placeholder = "Select", disabled = false, error, compact = false, testID }: DropdownProps<T>) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = options.find((o) => o.value === value);
  const shown = useMemo(() => filterOptions(options, query), [options, query]);
  const close = () => { setOpen(false); setQuery(""); };
  return (
    <View style={{ gap: 6 }}>
      {compact ? null : <Text variant="label" tone={error ? "danger" : "default"}>{label}</Text>}
      <Pressable
        testID={testID}
        accessibilityRole="combobox"
        accessibilityLabel={label}
        accessibilityValue={{ text: current?.label ?? placeholder }}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={{ minHeight: compact ? 44 : 50, maxWidth: compact ? 170 : undefined, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: c.surface, borderWidth: error ? 2 : 1, borderColor: error ? c.danger : c.border, opacity: disabled ? 0.5 : 1 }}
      >
        <Text style={{ flexShrink: 1, color: current ? c.text : c.muted, fontSize: compact ? 14 : 16 }} numberOfLines={1}>{current?.label ?? placeholder}</Text>
        <Icon name="chevron-down" size={18} color={c.muted} />
      </Pressable>
      {error ? <Text variant="caption" tone="danger">{error}</Text> : null}
      <Sheet visible={open} onClose={close} title={label} selfScrolling testID={testID ? `${testID}-sheet` : undefined}>
        {options.length >= SEARCH_FROM ? <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}><TextField label="Search" value={query} onChangeText={setQuery} leftIcon="search" autoCorrect={false} testID="dropdown-search" /></View> : null}
        <FlatList
          data={shown}
          keyExtractor={(o) => o.value}
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: 380 }}
          ListEmptyComponent={<Text tone="muted" style={{ padding: 16, textAlign: "center" }}>Nothing matches “{query}”.</Text>}
          renderItem={({ item }) => {
            const on = item.value === value;
            return (
              <Pressable
                accessibilityRole="menuitem"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: on, disabled: !!item.disabled }}
                disabled={item.disabled}
                onPress={() => { onChange(item.value); close(); }}
                android_ripple={{ color: "rgba(0,0,0,0.08)" }}
                style={{ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, backgroundColor: on ? c.surfaceAlt : "transparent", opacity: item.disabled ? 0.45 : 1 }}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="subheading" numberOfLines={1}>{item.label}</Text>
                  {item.hint ? <Text variant="caption" tone="muted" numberOfLines={1}>{item.hint}</Text> : null}
                </View>
                {on ? <Icon name="check" size={20} color={c.primaryText} /> : null}
              </Pressable>
            );
          }}
        />
      </Sheet>
    </View>
  );
}
