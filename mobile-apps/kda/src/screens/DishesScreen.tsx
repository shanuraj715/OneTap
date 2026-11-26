import { useCallback, useMemo, useState } from "react";
import { FlatList, View } from "react-native";
import type { ItemState, KitchenItem } from "@/api/schemas";
import { canSwitchDishes, isKitchenManager } from "@/auth/permissions";
import { useItems, useSetItemState } from "@/data/hooks";
import { countText, countsOf, dishRows, filterItems, foodTypeOf, ITEM_STATES, parseLeft, STATE_HELP, STATE_ICON, STATE_LABEL, STATE_TONE, type DishFilter } from "@/features/dishes";
import { useDebounced } from "@/lib/useDebounced";
import { useLayout } from "@/lib/layout";
import { useSession } from "@/runtime";
import { Badge, Button, Card, Chip, EmptyState, ErrorState, FoodMark, Icon, Screen, ScreenTitle, Sheet, Skeleton, Text, TextField, toasts, useTheme } from "@/ui";

/**
 * Every dish of this outlet, grouped by category: find one, and mark it Available / Sold out / Unavailable. It changes for everyone at once
 * (the storefront, the waiters' order screen, the dashboard): a dish that is off can't be ordered anywhere. The kitchen manager can also put a
 * number on a dish that is counted ("12 left today").
 */
export function DishesScreen() {
  const { c } = useTheme();
  const user = useSession((s) => s.user);
  const canSwitch = canSwitchDishes(user);
  const manager = isKitchenManager(user);
  const layout = useLayout();
  const items = useItems();
  const mutate = useSetItemState();
  const [filter, setFilter] = useState<DishFilter>("all");
  const [text, setText] = useState("");
  const query = useDebounced(text, 200);
  const [open, setOpen] = useState<KitchenItem | null>(null);
  const [left, setLeft] = useState("");

  const all = items.data?.items;
  const counts = useMemo(() => countsOf(all ?? []), [all]);
  const rows = useMemo(() => dishRows(filterItems(all ?? [], filter, query), items.data?.categories ?? []), [all, filter, query, items.data?.categories]);
  // the sheet shows the dish as it is NOW (the list refreshes behind it), not as it was when it was opened
  const current = open ? (all?.find((i) => i.id === open.id) ?? open) : null;

  const change = useCallback((item: KitchenItem, state: ItemState, count?: number) => {
    mutate.mutate({ item, state, left: count }, {
      onSuccess: (r) => {
        if (state === "available" && r.item.stillSoldOut) toasts.warn(`${item.name} is counted and has none left, so it stays sold out. Put a number on it first.`);
        else toasts.ok(`${item.name}: ${STATE_LABEL[state].toLowerCase()}`);
      },
      onError: (e) => toasts.error(e instanceof Error ? e.message : "Couldn't change the dish. Try again."),
    });
  }, [mutate]);

  function openSheet(item: KitchenItem) {
    setOpen(item);
    setLeft(item.stock ? String(item.stock.left) : "");
  }
  function saveLeft() {
    if (!current?.stock) return;
    const n = parseLeft(left);
    if (n === null) { toasts.warn("Type how many are left, as a whole number (0 or more)."); return; }
    change(current, n === 0 ? "sold-out" : "available", n);
    setOpen(null);
  }

  const filters: { value: DishFilter; label: string; count: number }[] = [
    { value: "all", label: "All", count: counts.all },
    { value: "sold-out", label: "Sold out", count: counts.soldOut },
    { value: "unavailable", label: "Unavailable", count: counts.unavailable },
    ...(counts.low ? [{ value: "low" as const, label: "Running low", count: counts.low }] : []),
  ];

  const header = (
    <View style={{ gap: 12, paddingBottom: 8 }}>
      <ScreenTitle icon="utensils" title="Dishes" right={counts.soldOut + counts.unavailable ? <Badge label={`${counts.soldOut + counts.unavailable} off`} tone="warn" icon="eye-off" /> : null} />
      <TextField label="Find a dish" hideLabel placeholder="Find a dish or a category" leftIcon="search" value={text} onChangeText={setText} onClear={() => setText("")} autoCorrect={false} autoCapitalize="none" returnKeyType="search" compact testID="dish-search" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {filters.map((f) => <Chip key={f.value} label={f.label} count={f.count} selected={filter === f.value} onPress={() => setFilter(f.value)} testID={`filter-${f.value}`} />)}
      </View>
      {!canSwitch ? <Text variant="caption" tone="muted">Your role can look at the dishes but not change them.</Text> : null}
    </View>
  );

  if (items.isLoading) return <Screen>{header}<View style={{ gap: 10 }}><Skeleton height={64} radius={14} /><Skeleton height={64} radius={14} /><Skeleton height={64} radius={14} /></View></Screen>;
  if (items.error && !items.data) return <Screen>{header}<ErrorState error={items.error} onRetry={() => void items.refetch()} title="Can't load the dishes" /></Screen>;

  return (
    <Screen padded={false} style={{ paddingHorizontal: 16, paddingTop: 16 }}>
      <FlatList
        testID="dish-list"
        data={rows}
        keyExtractor={(r) => r.key}
        numColumns={1}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 28, flexGrow: 1, maxWidth: layout.kind === "wide" ? 900 : undefined, width: "100%", alignSelf: "center" }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={<EmptyState icon="search" title={all?.length ? "No dish matches" : "No dishes yet"} message={all?.length ? "Try a different word, or show All." : "Add dishes in the dashboard's Menu."} />}
        renderItem={({ item: row }) =>
          row.kind === "heading" ? (
            <Text variant="label" tone="muted" style={{ paddingTop: 10, textTransform: "uppercase" }} accessibilityRole="header">{row.title} · {row.count}</Text>
          ) : (
            <DishRow item={row.item} canSwitch={canSwitch} busy={mutate.isPending && mutate.variables?.item.id === row.item.id} onOpen={openSheet} onQuick={change} />
          )
        }
      />

      <Sheet visible={!!current} onClose={() => setOpen(null)} title={current?.name ?? ""} testID="dish-sheet">
        {current ? (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Badge label={STATE_LABEL[current.state]} tone={STATE_TONE[current.state]} icon={STATE_ICON[current.state]} />
              {current.categoryName ? <Text tone="muted">{current.categoryName}</Text> : null}
              {countText(current) ? <Text tone="muted">· {countText(current)}</Text> : null}
            </View>
            {ITEM_STATES.map((s) => {
              const on = current.state === s;
              return (
                <Card key={s} onPress={canSwitch && !on ? () => { change(current, s); setOpen(null); } : undefined} selected={on} label={`${STATE_LABEL[s]}. ${STATE_HELP[s]}`} testID={`state-${s}`} style={{ flexDirection: "row", gap: 12, alignItems: "center", opacity: canSwitch || on ? 1 : 0.5 }}>
                  <Icon name={STATE_ICON[s]} size={24} color={on ? c.primaryText : c.muted} />
                  <View style={{ flex: 1 }}>
                    <Text variant="subheading">{STATE_LABEL[s]}</Text>
                    <Text variant="caption" tone="muted">{STATE_HELP[s]}</Text>
                  </View>
                  {on ? <Icon name="check-circle" size={20} color={c.primaryText} /> : null}
                </Card>
              );
            })}
            {manager && current.stock ? (
              <View style={{ gap: 8 }}>
                <TextField label="Left today" value={left} onChangeText={setLeft} keyboardType="number-pad" helper={current.stock.daily ? `Starts each day at ${current.stock.daily}. 0 makes it sold out.` : "0 makes it sold out."} testID="dish-left" />
                <Button title="Save the number" icon="check" fullWidth onPress={saveLeft} testID="dish-left-save" />
              </View>
            ) : null}
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

function DishRow({ item, canSwitch, busy, onOpen, onQuick }: { item: KitchenItem; canSwitch: boolean; busy: boolean; onOpen: (i: KitchenItem) => void; onQuick: (i: KitchenItem, s: ItemState) => void }) {
  const food = foodTypeOf(item.foodType);
  const off = item.state !== "available";
  return (
    <Card testID={`dish-${item.name}`} onPress={() => onOpen(item)} label={`${item.name}, ${STATE_LABEL[item.state]}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 12 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {food ? <FoodMark type={food} /> : null}
          <Text variant="subheading" style={{ flexShrink: 1, opacity: off ? 0.7 : 1 }}>{item.name}</Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Badge label={STATE_LABEL[item.state]} tone={STATE_TONE[item.state]} icon={STATE_ICON[item.state]} />
          {countText(item) ? <Badge label={countText(item)} tone={item.low || item.state === "sold-out" ? "warn" : "neutral"} icon="hash" /> : null}
        </View>
      </View>
      {canSwitch ? (
        <Button
          title={off ? "Put back" : "Sold out"}
          icon={off ? "check-circle" : "x-circle"}
          size="sm"
          variant={off ? "primary" : "outline"}
          loading={busy}
          onPress={() => onQuick(item, off ? "available" : "sold-out")}
          testID={`quick-${item.name}`}
        />
      ) : null}
    </Card>
  );
}
