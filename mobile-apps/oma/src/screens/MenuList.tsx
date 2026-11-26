import { memo, useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import type { FoodType, Menu, MenuItem } from "@/api/schemas";
import { quantityOfItem, type Draft, type DraftLine } from "@/cart/cart";
import { buildRows, buildSections, groupsFor, menuHasPictures, needsChoices, priceLabel, type MenuRow } from "@/features/menu";
import { useDebounced } from "@/lib/useDebounced";
import { API_URL } from "@/lib/config";
import { pictureOf } from "@/lib/images";
import { Badge, Card, DishImage, Dropdown, EmptyState, FoodMark, Icon, SegmentedControl, Stepper, Text, TextField, useTheme } from "@/ui";

type FoodFilter = "all" | FoodType;

/** A dish that needs no choices and is already in the order: it can be stepped up and down right on its row. */
const plainLineOf = (draft: Draft, item: MenuItem): DraftLine | undefined => draft.lines.find((l) => l.itemId === item.id && !l.variantId && l.modifierOptionIds.length === 0 && !l.note);

/**
 * One dish. Memoised, and given only plain values (how many are in the order, the one line it can be stepped on) — so a tap on ONE dish,
 * or the board refreshing in the background, redraws that dish and not the hundreds around it.
 */
const DishRow = memo(function DishRow({ item, choices, inOrder, plain, pictures, apiUrl, onPick, onStep }: { item: MenuItem; choices: boolean; inOrder: number; plain: DraftLine | undefined; pictures: boolean; apiUrl: string; onPick: (item: MenuItem) => void; onStep: (key: string, quantity: number) => void }) {
  const { c } = useTheme();
  const sold = !item.isAvailable;
  const why = item.unavailableLabel ?? "Sold out";
  const label = `${item.name}, ${priceLabel(item)}${sold ? `, ${why}` : item.lowLeft != null ? `, only ${item.lowLeft} left` : ""}${inOrder ? `, ${inOrder} in the order` : ""}`;
  return (
    <Card testID={`dish-${item.name}`} label={label} onPress={plain ? undefined : () => onPick(item)} /* (a sold-out dish can be tapped too: it says why it can't be added) */ style={{ flex: 1, padding: 10, opacity: sold ? 0.65 : 1, minHeight: 84 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {pictures ? <DishImage uri={pictureOf(item, apiUrl)} /> : null}
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
            <View style={{ paddingTop: 3 }}><FoodMark type={item.foodType} /></View>
            <Text variant="subheading" numberOfLines={2} style={{ flex: 1 }}>{item.name}</Text>
            <Text variant="subheading">{priceLabel(item)}</Text>
          </View>
          {item.description ? <Text variant="caption" tone="muted" numberOfLines={2}>{item.description}</Text> : null}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, minHeight: 36 }}>
            <View style={{ flexShrink: 1, gap: 4 }}>
              {sold ? <Badge label={why} tone={why.startsWith("Available") ? "warn" : "danger"} icon={why.startsWith("Available") ? "clock" : undefined} /> : null}
              {!sold && item.lowLeft != null ? <Badge label={`Only ${item.lowLeft} left`} tone="warn" /> : null}
              {inOrder > 0 ? <Badge label={`${inOrder} in the order`} tone="ok" icon="check" /> : null}
            </View>
            {sold ? null : plain ? (
              <Stepper label={item.name} value={plain.quantity} min={0} onChange={(q) => onStep(plain.key, q)} />
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, minHeight: 36, borderRadius: 18, backgroundColor: c.primary }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Icon name="plus" size={16} color={c.onPrimary} />
                <Text variant="label" tone="onPrimary">{choices ? "Choose" : "Add"}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Card>
  );
});

/** A category's heading. It opens and closes: with hundreds of dishes the menu stays short until a category is opened. */
const SectionHeader = memo(function SectionHeader({ row, inOrder, onToggle }: { row: Extract<MenuRow, { kind: "header" }>; inOrder: number; onToggle: (sectionId: string) => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      testID={`section-${row.name}`}
      accessibilityRole="button"
      accessibilityLabel={`${row.name}, ${row.count} ${row.count === 1 ? "dish" : "dishes"}${inOrder ? `, ${inOrder} in the order` : ""}`}
      accessibilityState={{ expanded: row.expanded }}
      onPress={() => onToggle(row.sectionId)}
      android_ripple={{ color: "rgba(0,0,0,0.08)" }}
      style={{ minHeight: 52, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, borderRadius: 12, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}
    >
      <Icon name={row.expanded ? "chevron-down" : "chevron-right"} size={20} color={c.primaryText} />
      <Text variant="subheading" tone="primary" style={{ flex: 1 }} numberOfLines={2}>{row.name}</Text>
      {inOrder > 0 ? <Badge label={`${inOrder} in order`} tone="ok" /> : null}
      <Text variant="label" tone="muted">{row.count}</Text>
    </Pressable>
  );
});

/**
 * The menu: a search box and filters that stay in place at the top, and below them the categories — all closed to start with, so even a
 * menu of hundreds of dishes is a short list; a tap opens one. Searching opens every category that has a match.
 */
export function MenuList({ menu, draft, columns, onPick, onStep, bottomSpace = 0, apiUrl = API_URL, onRefresh }: { menu: Menu; draft: Draft; columns: number; onPick: (item: MenuItem) => void; onStep: (key: string, quantity: number) => void; bottomSpace?: number; apiUrl?: string; onRefresh?: () => void }) {
  const { c } = useTheme();
  const [query, setQuery] = useState("");
  const [food, setFood] = useState<FoodFilter>("all");
  const [category, setCategory] = useState("all");
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());

  const everySection = useMemo(() => buildSections(menu), [menu]);
  const asked = useDebounced(query, 150); // (the list is rebuilt when typing pauses, not on every letter)
  const sections = useMemo(() => buildSections(menu, { query: asked, foodType: food === "all" ? null : food }).filter((s) => category === "all" || s.id === category), [menu, asked, food, category]);
  // which dishes need a choice (sizes / add-ons) is a fact about the menu: worked out once, not for every row on every redraw
  const choicesOf = useMemo(() => new Map(menu.items.map((i) => [i.id, needsChoices(i, groupsFor(menu, i))])), [menu]);
  const pictures = useMemo(() => menuHasPictures(menu), [menu]);
  // everything is open when there is nothing to hide (one category), when searching, and when one category was picked on purpose
  const showAll = everySection.length <= 1 || asked.trim() !== "" || category !== "all";
  const rows = useMemo(() => buildRows(sections, columns, showAll ? "all" : open), [sections, columns, showAll, open]);
  const sticky = useMemo(() => rows.flatMap((r, i) => (r.kind === "header" ? [i] : [])), [rows]);
  const inOrderOf = useMemo(() => new Map(sections.map((s) => [s.id, s.items.reduce((n, i) => n + quantityOfItem(draft, i.id), 0)])), [sections, draft]);

  const toggle = useCallback((id: string) => setOpen((cur) => { const next = new Set(cur); if (next.has(id)) next.delete(id); else next.add(id); return next; }), []);
  const clearAll = () => { setQuery(""); setFood("all"); setCategory("all"); };
  const mark = (type: FoodType | null) => (type ? <FoodMark type={type} size={14} /> : <Icon name="list" size={14} color={c.muted} />);

  const renderRow = useCallback(({ item: row }: { item: MenuRow }) =>
    row.kind === "header" ? (
      <View style={{ backgroundColor: c.bg, paddingVertical: 4 }}>
        <SectionHeader row={row} inOrder={inOrderOf.get(row.sectionId) ?? 0} onToggle={toggle} />
      </View>
    ) : (
      <View style={{ flexDirection: "row", gap: 10 }}>
        {row.items.map((it) => {
          const choices = choicesOf.get(it.id) ?? false;
          return <DishRow key={it.id} item={it} choices={choices} inOrder={quantityOfItem(draft, it.id)} plain={choices ? undefined : plainLineOf(draft, it)} pictures={pictures} apiUrl={apiUrl} onPick={onPick} onStep={onStep} />;
        })}
        {Array.from({ length: columns - row.items.length }, (_, i) => <View key={`pad-${i}`} style={{ flex: 1 }} />)}
      </View>
    ),
  [c.bg, inOrderOf, toggle, choicesOf, draft, pictures, apiUrl, onPick, onStep, columns]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, gap: 8, backgroundColor: c.bg, borderBottomWidth: 1, borderBottomColor: c.border }} testID="menu-filters">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <TextField label="Find a dish" hideLabel compact placeholder="Find a dish" value={query} onChangeText={setQuery} onClear={() => setQuery("")} leftIcon="search" autoCorrect={false} returnKeyType="search" testID="dish-search" />
          </View>
          {everySection.length > 1 ? (
            <Dropdown<string> label="Category" compact value={category} onChange={setCategory} options={[{ value: "all", label: "All categories" }, ...everySection.map((s) => ({ value: s.id, label: s.name, hint: `${s.items.length} dishes` }))]} testID="category-dropdown" />
          ) : null}
        </View>
        <SegmentedControl<FoodFilter>
          label="Food type"
          compact
          value={food}
          onChange={setFood}
          options={[{ value: "all", label: "All", icon: mark(null) }, { value: "veg", label: "Veg", icon: mark("veg") }, { value: "egg", label: "Egg", icon: mark("egg") }, { value: "non-veg", label: "Non-veg", icon: mark("non-veg") }]}
        />
      </View>
      <FlatList<MenuRow>
        key={`menu-${columns}`}
        data={rows}
        keyExtractor={(r) => r.id}
        stickyHeaderIndices={sticky}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: 16, paddingBottom: 16 + bottomSpace, gap: 10 }}
        refreshing={false}
        onRefresh={onRefresh}
        ListEmptyComponent={<EmptyState icon="search" title="No dish matches" message="Try another word, or clear the filters." action={{ title: "Clear filters", onPress: clearAll }} />}
        renderItem={renderRow}
        extraData={draft}
        initialNumToRender={10}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={40}
        windowSize={7}
      />
    </View>
  );
}
