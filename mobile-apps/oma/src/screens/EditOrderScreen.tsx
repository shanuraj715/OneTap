import { useCallback, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import type { MenuItem } from "@/api/schemas";
import { buildLine, countOf, draftFromOrder, editChanges, emptyDraft, estimateOf } from "@/cart/cart";
import { useEditOrder, useOrders, useOrderableMenu } from "@/data/hooks";
import { groupsFor, needsChoices } from "@/features/menu";
import { channelLabel } from "@/features/orders";
import { formatMoney } from "@/lib/money";
import { useDrafts, useRuntime } from "@/runtime";
import { Banner, Button, EmptyState, ErrorState, Icon, LoadingBlock, Screen, Sheet, Stepper, Text, TextField, toasts, useTheme } from "@/ui";
import { DishSheet } from "./DishSheet";
import { MenuList } from "./MenuList";
import { messageOf } from "./orders/useStatusChange";

/**
 * Change an order that was already placed — the customer adds a drink, the kitchen is out of something, the name was misspelt. The menu is the
 * same one used to take an order; the lines of the order are the starting point. The server prices the WHOLE order again when it is saved (so
 * an edit can never talk the total down) and refuses it once the order is too far along (the outlet's setting) — its words are shown as they are.
 */
export function EditOrderScreen({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const { c } = useTheme();
  const { drafts } = useRuntime();
  const key = `edit:${orderId}`;
  const ordersQ = useOrders();
  const { menu, query: menuQ, refresh } = useOrderableMenu();
  const edit = useEditOrder();
  const draft = useDrafts((s) => s.drafts[key]);
  const order = ordersQ.data?.find((o) => o.id === orderId);
  const [dishFor, setDishFor] = useState<MenuItem | null>(null);
  const [reviewing, setReviewing] = useState(false);

  // start from the order as it is (and leave nothing behind when this screen closes)
  useEffect(() => {
    if (order && !drafts.getState().drafts[key]) drafts.getState().set(key, draftFromOrder(order));
  }, [order, drafts, key]);
  useEffect(() => () => { drafts.getState().clear(key); }, [drafts, key]);

  const original = useMemo(() => (order ? draftFromOrder(order) : emptyDraft()), [order]);
  const d = draft ?? original;
  const changes = useMemo(() => editChanges(original, d), [original, d]);
  const dirty = Object.keys(changes).length > 0;
  const count = countOf(d);

  const pick = useCallback((item: MenuItem) => {
    if (!menu) return;
    if (!item.isAvailable) { toasts.warn(`${item.name}: ${(item.unavailableLabel ?? "sold out").replace(/^Sold out$/, "sold out")}`); return; }
    const groups = groupsFor(menu, item);
    if (needsChoices(item, groups)) setDishFor(item);
    else drafts.getState().add(key, buildLine(item, groups, { optionIds: [] }, 1));
  }, [menu, drafts, key]);
  const step = useCallback((lineKey: string, q: number) => drafts.getState().setQty(key, lineKey, q), [drafts, key]);
  const refreshMenu = useCallback(() => { void refresh(); }, [refresh]);

  if (ordersQ.isLoading || menuQ.isLoading) return <Screen edges={["left", "right", "bottom"]}><LoadingBlock label="Loading the order and the menu…" /></Screen>;
  if (menuQ.isError && !menuQ.data) return <Screen edges={["left", "right", "bottom"]}><ErrorState error={menuQ.error} onRetry={() => void menuQ.refetch()} title="Can't load the menu" /></Screen>;
  if (!order || !menu) return <Screen edges={["left", "right", "bottom"]}><EmptyState icon="receipt" title="Order not found" message="It may have been deleted. Go back to the orders." action={{ title: "Back", onPress: onDone }} /></Screen>;

  async function save() {
    if (!order) return;
    try {
      await edit.mutateAsync({ id: order.id, body: changes });
      toasts.ok(`Order #${order.orderNumber} was changed`);
      setReviewing(false);
      onDone();
    } catch (e) { toasts.error(messageOf(e)); }
  }

  const phoneBad = d.phone.trim() !== "" && (d.phone.replace(/\D/g, "").length < 8 || d.phone.replace(/\D/g, "").length > 20);

  return (
    <Screen padded={false} edges={["left", "right", "bottom"]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }} accessible accessibilityRole="header" accessibilityLabel={`Editing order ${order.orderNumber}, ${channelLabel(order.channel)}`}>
          <Icon name="pencil" size={18} color={c.primaryText} />
          <Text variant="subheading">Order #{order.orderNumber}</Text>
          <Text tone="muted">· {channelLabel(order.channel)}</Text>
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <MenuList menu={menu} draft={d} columns={1} onPick={pick} onStep={step} bottomSpace={84} onRefresh={refreshMenu} />
      </View>
      <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.border }}>
        <Button title={`Review changes · ${count} ${count === 1 ? "item" : "items"} · ${formatMoney(estimateOf(d))}`} size="lg" fullWidth icon="bag" onPress={() => setReviewing(true)} testID="review-edit" />
      </View>
      <Sheet
        visible={reviewing}
        onClose={() => setReviewing(false)}
        title={`Order #${order.orderNumber}`}
        testID="edit-sheet"
        footer={<Button title={dirty ? "Save changes" : "No changes yet"} icon="check" size="lg" fullWidth disabled={!dirty || count === 0 || phoneBad} loading={edit.isPending} onPress={() => void save()} testID="edit-save" />}
      >
        <Banner tone="info" message="The server works out the price again when you save, so the total can change. An order that is already too far along can't be edited." />
        {d.lines.length === 0 ? <Banner tone="warn" message="An order needs at least one item." testID="edit-empty" /> : null}
        <View style={{ gap: 10 }}>
          {d.lines.map((l) => (
            <View key={l.key} style={{ flexDirection: "row", alignItems: "center", gap: 10 }} testID={`edit-line-${l.name}`}>
              <View style={{ flex: 1 }}>
                <Text variant="label">{l.name}{l.variantLabel ? ` · ${l.variantLabel}` : ""}</Text>
                {l.modifierLabels.length ? <Text variant="caption" tone="muted">{l.modifierLabels.join(", ")}</Text> : null}
                {l.note ? <Text variant="caption" tone="muted">{l.note}</Text> : null}
              </View>
              <Stepper label={l.name} value={l.quantity} min={0} onChange={(q) => step(l.key, q)} />
            </View>
          ))}
        </View>
        <TextField label="Customer's name" leftIcon="user" value={d.name} onChangeText={(t) => drafts.getState().setCustomer(key, { name: t })} maxLength={80} autoCapitalize="words" testID="edit-name" />
        <TextField label="Customer's mobile number" leftIcon="phone" value={d.phone} onChangeText={(t) => drafts.getState().setCustomer(key, { phone: t })} keyboardType="phone-pad" maxLength={20} error={phoneBad ? "That mobile number doesn't look right." : null} testID="edit-phone" />
        <TextField label="Note for the whole order" leftIcon="note" value={d.note} onChangeText={(t) => drafts.getState().setCustomer(key, { note: t })} maxLength={300} multiline testID="edit-note" />
      </Sheet>
      <DishSheet item={dishFor} menu={menu} onClose={() => setDishFor(null)} onAdd={(line) => drafts.getState().add(key, line)} />
    </Screen>
  );
}
