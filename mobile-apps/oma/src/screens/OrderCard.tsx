import { View } from "react-native";
import type { Order } from "@/api/schemas";
import { paymentLabel, statusIcon, statusLabel, statusTone } from "@/features/orders";
import { formatMoney } from "@/lib/money";
import { clock } from "@/lib/time";
import { Badge, Card, Divider, FoodMark, Icon, Text, useTheme } from "@/ui";

/** One order: its number, where it is in the kitchen, whether it is paid, what is in it, and the total. */
export function OrderCard({ order, tableNumber, onPress }: { order: Order; tableNumber?: string; onPress?: () => void }) {
  const { c } = useTheme();
  const paid = order.payment.status === "paid";
  return (
    <Card testID={`order-${order.orderNumber}`} onPress={onPress} label={`Order ${order.orderNumber}, ${statusLabel(order.status)}, ${paymentLabel(order.payment.status)}, ${formatMoney(order.totals.grandTotal)}`} style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Icon name="receipt" size={18} color={c.primaryText} />
        <Text variant="subheading">#{order.orderNumber}</Text>
        {tableNumber ? <><Icon name="table" size={14} color={c.muted} /><Text tone="muted">Table {tableNumber}</Text></> : null}
        <View style={{ flex: 1 }} />
        <Icon name="clock" size={13} color={c.muted} />
        <Text variant="caption" tone="muted">{clock(order.createdAt)}</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Badge label={statusLabel(order.status)} tone={statusTone(order.status)} icon={statusIcon(order.status)} />
        <Badge label={paymentLabel(order.payment.status)} tone={paid ? "ok" : order.payment.status === "failed" ? "danger" : "warn"} icon={paid ? "check-circle" : "wallet"} />
      </View>
      <Divider />
      <View style={{ gap: 6 }}>
        {order.lines.map((l, i) => (
          <View key={`${l.itemId}-${i}`} style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ paddingTop: 3 }}><FoodMark type={l.foodType} size={13} /></View>
            <Text variant="label" style={{ minWidth: 26 }}>{l.quantity}×</Text>
            <View style={{ flex: 1 }}>
              <Text>{l.name}{l.variantLabel ? ` · ${l.variantLabel}` : ""}</Text>
              {l.modifiers.length ? <Text variant="caption" tone="muted">{l.modifiers.map((m) => m.label).join(", ")}</Text> : null}
              {l.note ? <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Icon name="note" size={12} color={c.muted} /><Text variant="caption" tone="muted" style={{ flexShrink: 1 }}>{l.note}</Text></View> : null}
            </View>
            <Text tone="muted">{formatMoney(l.lineTotal)}</Text>
          </View>
        ))}
      </View>
      <Divider />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 }}>
          {order.staffName || order.placedBy === "customer" ? <Icon name="user" size={13} color={c.muted} /> : null}
          <Text variant="caption" tone="muted" numberOfLines={1}>{order.staffName ? `Taken by ${order.staffName}` : order.placedBy === "customer" ? "Placed by the customer" : ""}</Text>
        </View>
        <Text variant="subheading">{formatMoney(order.totals.grandTotal)}</Text>
      </View>
    </Card>
  );
}
