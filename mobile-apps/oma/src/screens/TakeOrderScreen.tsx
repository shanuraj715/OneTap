import { useCallback, useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import type { MenuItem } from "@/api/schemas";
import { buildLine, countOf, emptyDraft, estimateOf } from "@/cart/cart";
import { useActiveSessions, useOrderableMenu, useTables } from "@/data/hooks";
import { groupsFor, needsChoices } from "@/features/menu";
import { useLayout } from "@/lib/layout";
import { formatMoney } from "@/lib/money";
import { useDrafts, useRuntime } from "@/runtime";
import { Banner, Button, EmptyState, ErrorState, Icon, LoadingBlock, Screen, Sheet, Text, toasts, useTheme } from "@/ui";
import { DishSheet } from "./DishSheet";
import { MenuList } from "./MenuList";
import { OrderPanel, type PanelParts } from "./OrderPanel";

const EMPTY = emptyDraft();

/**
 * Taking an order at a table: find dishes, choose sizes and add-ons, review, send to the kitchen.
 * A phone or small tablet shows the menu with an "order bar" at the bottom that opens the review; a wide tablet keeps the order
 * on the right all the time.
 */
export function TakeOrderScreen({ tableId, onDone }: { tableId: string; onDone: () => void }) {
  const { c } = useTheme();
  const layout = useLayout();
  const { drafts } = useRuntime();
  const { menu: orderable, query: menuQ, refresh } = useOrderableMenu();
  const tablesQ = useTables();
  const sessionsQ = useActiveSessions();
  const draft = useDrafts((s) => s.drafts[tableId]) ?? EMPTY;

  const table = tablesQ.data?.find((t) => t.id === tableId);
  const session = sessionsQ.data?.find((s) => s.tableId === tableId);
  const [dishFor, setDishFor] = useState<MenuItem | null>(null);
  const [reviewing, setReviewing] = useState(false);

  // who was at this table when the waiter started: the server checks the order against it (see OrderPanel)
  // (`undefined` = not looked at yet; `null` = it was free. Remembered once, the first time the table is on screen.)
  const [seen, setSeen] = useState<string | null | undefined>(undefined);
  if (table && seen === undefined) setSeen(table.activeSessionId ?? null);
  const changed = !!table && seen !== undefined && (table.activeSessionId ?? null) !== seen;

  // (stable between redraws, so the menu list's memoised rows are not redrawn by the board refreshing in the background)
  const pick = useCallback((item: MenuItem) => {
    if (!orderable) return;
    if (!item.isAvailable) { toasts.warn(`${item.name}: ${(item.unavailableLabel ?? "sold out").replace(/^Sold out$/, "sold out")}`); return; }
    const groups = groupsFor(orderable, item);
    if (needsChoices(item, groups)) setDishFor(item);
    else drafts.getState().add(tableId, buildLine(item, groups, { optionIds: [] }, 1));
  }, [orderable, drafts, tableId]);
  const step = useCallback((key: string, q: number) => drafts.getState().setQty(tableId, key, q), [drafts, tableId]);
  const refreshMenu = useCallback(() => { void refresh(); }, [refresh]);

  if (menuQ.isLoading || tablesQ.isLoading) return <Screen edges={["left", "right", "bottom"]}><LoadingBlock label="Loading the menu…" /></Screen>;
  if (menuQ.isError && !menuQ.data) return <Screen edges={["left", "right", "bottom"]}><ErrorState error={menuQ.error} onRetry={() => void menuQ.refetch()} title="Can't load the menu" /></Screen>;
  if (!table || !orderable) return <Screen edges={["left", "right", "bottom"]}><EmptyState icon="table" title="Table not found" message="It may have been removed. Go back to the tables." action={{ title: "Back", onPress: onDone }} /></Screen>;
  const menu = orderable;
  const count = countOf(draft);

  const who = session ? session.customerName || session.customerPhone || "the party" : null;
  // one slim line (the search box below must stay near the top of a small screen)
  const header = (
    <View style={{ paddingHorizontal: 16, paddingTop: 10, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }} accessible accessibilityRole="header" accessibilityLabel={`Table ${table.number}${table.zone ? `, ${table.zone}` : ""}. ${who ? `Adding to the bill of ${who}` : "A new customer"}`}>
        <Icon name="table" size={18} color={c.primaryText} />
        <Text variant="subheading">Table {table.number}</Text>
        {table.zone ? <><Icon name="pin" size={14} color={c.muted} /><Text tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>{table.zone}</Text></> : null}
        <View style={{ flex: 1 }} />
        <Icon name={who ? "user" : "plus"} size={14} color={c.muted} />
        <Text tone="muted" numberOfLines={1} style={{ flexShrink: 1, maxWidth: "45%" }}>{who ?? "New customer"}</Text>
      </View>
      {changed ? <Banner tone="warn" message={`Table ${table.number} changed while you were here. If someone else is seated now, the order will not be sent.`} testID="table-changed" /> : null}
    </View>
  );

  const panel = (enabled: boolean, layout_: (parts: PanelParts) => ReactNode) => (
    <OrderPanel
      table={table}
      session={session}
      draft={draft}
      // `null` is a real answer ("it was free"), so no `??` here: it would swap in whoever sits there NOW
      seenSessionId={seen === undefined ? (table.activeSessionId ?? null) : seen}
      quoteEnabled={enabled}
      onSent={() => { setReviewing(false); onDone(); }}
      onLeave={() => { setReviewing(false); onDone(); }}
    >
      {layout_}
    </OrderPanel>
  );

  const list = <MenuList menu={menu} draft={draft} columns={layout.menuColumns} onPick={pick} onStep={step} bottomSpace={layout.split ? 0 : 84} onRefresh={refreshMenu} />;

  return (
    <Screen padded={false} edges={["left", "right", "bottom"]}>
      {layout.split ? (
        <View style={{ flex: 1, flexDirection: "row" }}>
          <View style={{ flex: 1 }}>{header}{list}</View>
          <View style={{ width: layout.sidePanelWidth, borderLeftWidth: 1, borderLeftColor: c.border, backgroundColor: c.surface }}>
            {panel(true, ({ body, footer }) => (
              <>
                <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
                  <Text variant="heading">Order</Text>
                  {body}
                </ScrollView>
                {footer ? <View style={{ padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: c.border }}>{footer}</View> : null}
              </>
            ))}
          </View>
        </View>
      ) : (
        <>
          {header}
          <View style={{ flex: 1 }}>{list}</View>
          {count > 0 ? (
            <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
              <Button title={`Review order · ${count} ${count === 1 ? "item" : "items"} · ${formatMoney(estimateOf(draft))}`} size="lg" fullWidth icon="bag" onPress={() => setReviewing(true)} testID="review-order" />
            </View>
          ) : null}
          {panel(reviewing, ({ body, footer }) => (
            <Sheet visible={reviewing} onClose={() => setReviewing(false)} title={`Order · Table ${table.number}`} footer={footer} testID="review-sheet">
              {body}
            </Sheet>
          ))}
        </>
      )}
      <DishSheet item={dishFor} menu={menu} onClose={() => setDishFor(null)} onAdd={(line) => drafts.getState().add(tableId, line)} />
    </Screen>
  );
}
