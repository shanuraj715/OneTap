import type { ReactNode } from "react";
import { View } from "react-native";
import type { Order } from "@/api/schemas";
import { CHANNEL_ICON, channelLabel, paymentLabel, statusIcon, statusLabelFor, statusSince, statusTone } from "@/features/orders";
import { formatMoney } from "@/lib/money";
import { clock, elapsed } from "@/lib/time";
import { Badge, Button, Card, Divider, FoodMark, Icon, Text, useTheme } from "@/ui";

/**
 * One order: its number, where it is in the kitchen, whether it is paid, what is in it, and the total. A takeaway or delivery order also
 * says who it is for (and the rider). `footer` is for buttons under it (the next step); `onPress` opens it.
 *
 * `items`: "list" writes every item out in the card (a table's page, where the orders ARE the content); "button" keeps the card short — one
 * "Items (3)" button that asks for the list (`onShowItems`) — which is what the Orders list uses: with many orders on screen a card that
 * grows with every dish hides the next orders.
 */
export function OrderCard({ order, tableNumber, onPress, footer, now, items = "list", onShowItems }: { order: Order; tableNumber?: string; onPress?: () => void; footer?: ReactNode; now?: number; items?: "list" | "button"; onShowItems?: (order: Order) => void }) {
  const { c } = useTheme();
  const paid = order.payment.status === "paid";
  const open = !["completed", "cancelled"].includes(order.status);
  const who = order.customer?.name || order.customer?.phone || "";
  const count = order.lines.reduce((n, l) => n + l.quantity, 0);
  const hasNote = Boolean(order.note?.trim()) || order.lines.some((l) => l.note?.trim());
  const label = statusLabelFor(order.status, order.channel);
  return (
    <Card testID={`order-${order.orderNumber}`} onPress={onPress} label={`Order ${order.orderNumber}, ${channelLabel(order.channel)}, ${label}, ${paymentLabel(order.payment.status)}, ${formatMoney(order.totals.grandTotal)}`} style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Icon name={CHANNEL_ICON[order.channel] ?? "receipt"} size={18} color={c.primaryText} />
        <Text variant="subheading">#{order.orderNumber}</Text>
        {tableNumber ? <><Icon name="table" size={14} color={c.muted} /><Text tone="muted">Table {tableNumber}</Text></> : order.channel !== "dine-in" ? <Text tone="muted">{channelLabel(order.channel)}</Text> : null}
        <View style={{ flex: 1 }} />
        <Icon name="clock" size={13} color={c.muted} />
        <Text variant="caption" tone="muted">{clock(order.createdAt)}</Text>
        {onPress ? <Icon name="chevron-right" size={16} color={c.muted} /> : null}
      </View>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Badge label={label} tone={statusTone(order.status)} icon={statusIcon(order.status)} />
        <Badge label={paymentLabel(order.payment.status)} tone={paid ? "ok" : order.payment.status === "failed" ? "danger" : "warn"} icon={paid ? "check-circle" : "wallet"} />
        {open ? <Text variant="caption" tone="muted" testID={`since-${order.orderNumber}`}>{elapsed(statusSince(order), now)}</Text> : null}
      </View>
      {order.channel !== "dine-in" && (who || order.rider || order.scheduledFor) ? (
        <View style={{ gap: 4 }}>
          {who ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name="user" size={14} color={c.muted} /><Text numberOfLines={1} style={{ flexShrink: 1 }}>{who}</Text></View> : null}
          {order.rider ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name="bike" size={14} color={c.muted} /><Text tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>Rider {order.rider.name}</Text></View> : null}
          {order.scheduledFor ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name="calendar" size={14} color={c.warning} /><Text tone="warning">Pre-order for {clock(order.scheduledFor)}</Text></View> : null}
        </View>
      ) : null}
      <Divider />
      {items === "button" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Button title={`Items (${count})`} icon="utensils" variant="outline" size="sm" onPress={() => onShowItems?.(order)} testID={`items-${order.orderNumber}`} />
          {hasNote ? <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 }} accessible accessibilityLabel="This order has a note"><Icon name="note" size={14} color={c.warning} /><Text variant="caption" tone="warning">Has a note</Text></View> : null}
        </View>
      ) : (
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
        {order.note ? <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Icon name="note" size={12} color={c.warning} /><Text variant="caption" tone="warning" style={{ flexShrink: 1 }}>{order.note}</Text></View> : null}
      </View>
      )}
      <Divider />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1 }}>
          {order.staffName || order.placedBy === "customer" ? <Icon name="user" size={13} color={c.muted} /> : null}
          <Text variant="caption" tone="muted" numberOfLines={1}>{order.staffName ? `Taken by ${order.staffName}` : order.placedBy === "customer" ? "Placed by the customer" : ""}</Text>
        </View>
        <Text variant="subheading">{formatMoney(order.totals.grandTotal)}</Text>
      </View>
      {footer}
    </Card>
  );
}
