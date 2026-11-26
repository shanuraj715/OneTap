import { useState } from "react";
import { Pressable, View } from "react-native";
import type { Menu, MenuItem, ModifierGroup } from "@/api/schemas";
import { buildLine, selectionProblems, unitPriceOf, type DraftLine } from "@/cart/cart";
import { groupsFor } from "@/features/menu";
import { formatDelta, formatMoney } from "@/lib/money";
import { Button, FoodMark, Icon, SectionTitle, Sheet, Stepper, Text, TextField, useTheme } from "@/ui";

/** One choice in a list (a size, an add-on): a round tick for "pick one", a square one for "pick several". */
function ChoiceRow({ label, price, selected, single, onPress }: { label: string; price?: string; selected: boolean; single: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole={single ? "radio" : "checkbox"}
      accessibilityLabel={price ? `${label}, ${price}` : label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 }}
    >
      <View style={{ width: 24, height: 24, borderRadius: single ? 12 : 6, borderWidth: 2, borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primary : "transparent", alignItems: "center", justifyContent: "center" }}>
        {selected ? <Icon name="check" size={14} color={c.onPrimary} strokeWidth={3} /> : null}
      </View>
      <Text style={{ flex: 1 }}>{label}</Text>
      {price ? <Text tone="muted">{price}</Text> : null}
    </Pressable>
  );
}

const rule = (g: ModifierGroup): string => {
  const min = g.required ? Math.max(1, g.minSelect) : g.minSelect;
  if (g.maxSelect === 1) return min >= 1 ? "Choose 1 · required" : "Choose up to 1";
  if (min >= 1) return g.maxSelect > 0 ? `Choose ${min}–${g.maxSelect} · required` : `Choose at least ${min} · required`;
  return g.maxSelect > 0 ? `Choose up to ${g.maxSelect}` : "Choose any";
};

/** A dish that has sizes or add-ons: pick them, how many, an optional note for the kitchen, then add it to the order. */
export function DishSheet({ item, menu, onClose, onAdd }: { item: MenuItem | null; menu: Menu; onClose: () => void; onAdd: (line: DraftLine) => void }) {
  // keyed by the dish: every dish opens from a clean choice (a single size is chosen for the waiter)
  return item ? <DishChoices key={item.id} item={item} menu={menu} onClose={onClose} onAdd={onAdd} /> : null;
}

function DishChoices({ item, menu, onClose, onAdd }: { item: MenuItem; menu: Menu; onClose: () => void; onAdd: (line: DraftLine) => void }) {
  const groups = groupsFor(menu, item);
  const [variantId, setVariantId] = useState<string | undefined>(item.variants.length === 1 ? item.variants[0]!.id : undefined);
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");

  const sel = { variantId, optionIds };
  const problems = selectionProblems(item, groups, sel);
  const unit = unitPriceOf(item, groups, sel);

  function toggle(group: ModifierGroup, optionId: string) {
    setOptionIds((current) => {
      const has = current.includes(optionId);
      if (group.maxSelect === 1) return [...current.filter((id) => !group.options.some((o) => o.id === id)), ...(has ? [] : [optionId])];
      if (has) return current.filter((id) => id !== optionId);
      const inGroup = current.filter((id) => group.options.some((o) => o.id === id)).length;
      return group.maxSelect > 0 && inGroup >= group.maxSelect ? current : [...current, optionId];
    });
  }

  return (
    <Sheet
      visible
      onClose={onClose}
      title={item.name}
      testID="dish-sheet"
      footer={
        <>
          {problems[0] ? <Text variant="caption" tone="warning" testID="dish-problem">{problems[0]}</Text> : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Stepper label={item.name} value={quantity} min={1} max={20} onChange={setQuantity} />
            <Button title={problems.length > 0 ? "Add" : `Add · ${formatMoney(unit * quantity)}`} size="lg" disabled={problems.length > 0} onPress={() => { onAdd(buildLine(item, groups, sel, quantity, note)); onClose(); }} style={{ flex: 1 }} testID="dish-add" />
          </View>
        </>
      }
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <FoodMark type={item.foodType} />
        <Text tone="muted" style={{ flex: 1 }}>{item.description || (item.variants.length ? "Choose a size" : "Choose your options")}</Text>
      </View>
      {item.variants.length > 0 ? (
        <View accessibilityRole="radiogroup" accessibilityLabel="Size" style={{ gap: 2 }}>
          <SectionTitle icon="utensils" title="Size" />
          {item.variants.map((v) => <ChoiceRow key={v.id} label={v.label} price={formatMoney(v.price)} selected={variantId === v.id} single onPress={() => setVariantId(v.id)} />)}
        </View>
      ) : null}
      {groups.map((g) => (
        <View key={g.id} style={{ gap: 2 }}>
          <SectionTitle icon="sparkle" title={g.name} right={<Text variant="caption" tone="muted">{rule(g)}</Text>} />
          {g.options.map((o) => <ChoiceRow key={o.id} label={o.label} price={formatDelta(o.priceDelta) || undefined} selected={optionIds.includes(o.id)} single={g.maxSelect === 1} onPress={() => toggle(g, o.id)} />)}
        </View>
      ))}
      <TextField label="Note for the kitchen (optional)" leftIcon="note" value={note} onChangeText={setNote} maxLength={140} placeholder="Less spicy, no onion…" testID="dish-note" />
    </Sheet>
  );
}
