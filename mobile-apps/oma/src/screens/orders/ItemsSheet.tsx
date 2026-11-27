import { View } from "react-native";
import type { Order } from "@/api/schemas";
import { channelLabel, statusLabelFor } from "@/features/orders";
import { formatMoney } from "@/lib/money";
import { Badge, Divider, FoodMark, Icon, Sheet, Text, useTheme } from "@/ui";

/** What was ordered, in a pop-up: every item with its size, add-ons and notes, the note for the whole order, and the total. */
export function ItemsSheet({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const { c } = useTheme();
  const count = order ? order.lines.reduce((n, l) => n + l.quantity, 0) : 0;
  return (
    <Sheet visible={!!order} onClose={onClose} title={order ? `Order #${order.orderNumber} — ${count} ${count === 1 ? "item" : "items"}` : "Items"} testID="items-sheet">
      {order ? (
        <>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Badge label={channelLabel(order.channel)} tone="neutral" />
            <Badge label={statusLabelFor(order.status, order.channel)} tone="info" />
          </View>
          <View style={{ gap: 10 }}>
            {order.lines.map((l, i) => (
              <View key={`${l.itemId}-${i}`} style={{ flexDirection: "row", gap: 8 }} testID={`item-line-${i}`}>
                <View style={{ paddingTop: 3 }}><FoodMark type={l.foodType} size={13} /></View>
                <Text variant="label" style={{ minWidth: 26 }}>{l.quantity}×</Text>
                <View style={{ flex: 1 }}>
                  <Text>{l.name}{l.variantLabel ? ` · ${l.variantLabel}` : ""}</Text>
                  {l.modifiers.length ? <Text variant="caption" tone="muted">{l.modifiers.map((m) => m.label).join(", ")}</Text> : null}
                  {l.note ? <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Icon name="note" size={12} color={c.warning} /><Text variant="caption" tone="warning" style={{ flexShrink: 1 }}>{l.note}</Text></View> : null}
                </View>
                <Text tone="muted">{formatMoney(l.lineTotal)}</Text>
              </View>
            ))}
          </View>
          {order.note ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6, padding: 10, borderRadius: 10, backgroundColor: c.warningWash }}><Icon name="note" size={14} color={c.warning} /><Text tone="warning" style={{ flex: 1 }}>{order.note}</Text></View> : null}
          <Divider />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text variant="subheading">Total</Text><Text variant="subheading">{formatMoney(order.totals.grandTotal)}</Text></View>
        </>
      ) : null}
    </Sheet>
  );
}
