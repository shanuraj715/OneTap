import { memo } from "react";
import { View } from "react-native";
import type { KitchenOrder } from "@/api/schemas";
import { actionFor, channelIcon, channelText, itemCount, minutesWaiting, stationsText, urgencyOf, URGENCY_TONE, waitText, type Limits, type TicketAction } from "@/features/board";
import { clock } from "@/lib/time";
import { Badge, Button, Icon, Text, radius, useTheme } from "@/ui";

export interface TicketProps {
  order: KitchenOrder;
  now: number;
  limits: Limits;
  /** a Start / Ready / Recall for THIS order is on its way to the server */
  busy: boolean;
  /** it came in since the cook last looked */
  fresh: boolean;
  onAction: (order: KitchenOrder, action: TicketAction) => void;
}

/**
 * One order on the board: its number and how long it has waited (amber, then red, by the store's own limits), where it is going, every dish with its
 * size, add-ons and note, the customer's note to the kitchen, and the ONE button for what to do next. Everything a cook needs is on the card:
 * nothing to open.
 */
export const TicketCard = memo(function TicketCard({ order, now, limits, busy, fresh, onAction }: TicketProps) {
  const { c } = useTheme();
  const minutes = minutesWaiting(order, now);
  const urgency = order.stage === "ready" ? "ok" : urgencyOf(minutes, limits);
  const strip = urgency === "late" ? c.danger : urgency === "warn" ? c.warning : fresh ? c.primary : c.border;
  const action = actionFor(order.stage);
  const stations = stationsText(order);
  return (
    <View testID={`ticket-${order.orderNumber}`} accessible accessibilityLabel={`Order ${order.orderNumber}, ${channelText(order)}, ${itemCount(order)} items, ${order.stage}`} style={{ flexDirection: "row", backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border, overflow: "hidden" }}>
      <View style={{ width: 8, backgroundColor: strip }} />
      <View style={{ flex: 1, padding: 14, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text variant="heading">#{order.orderNumber}</Text>
          {fresh ? <Badge label="NEW" tone="info" icon="bell" /> : null}
          <View style={{ flex: 1 }} />
          {order.stage !== "ready" ? <Badge label={waitText(minutes)} tone={URGENCY_TONE[urgency]} icon="clock" /> : <Badge label="Ready" tone="ok" icon="check-circle" />}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Icon name={channelIcon(order)} size={16} color={c.primaryText} />
          <Text variant="label">{channelText(order)}</Text>
          {order.customerName ? <Text tone="muted">· {order.customerName}</Text> : null}
          {order.scheduledFor ? <Badge label={`Pre-order for ${clock(order.scheduledFor)}`} tone="info" icon="calendar" /> : null}
        </View>

        <View style={{ gap: 8 }}>
          {order.lines.map((l, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 10 }}>
              <Text variant="subheading" style={{ minWidth: 34 }}>{l.quantity}×</Text>
              <View style={{ flex: 1 }}>
                <Text variant="subheading">{l.name}{l.variantLabel ? ` · ${l.variantLabel}` : ""}</Text>
                {l.modifiers.length ? <Text variant="caption" tone="muted">{l.modifiers.join(", ")}</Text> : null}
                {l.note ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
                    <Icon name="note" size={14} color={c.warning} />
                    <Text variant="caption" style={{ color: c.warning, flexShrink: 1 }}>{l.note}</Text>
                  </View>
                ) : null}
              </View>
              {order.stations.length > 1 ? <Text variant="caption" tone="muted">{l.station === "bar" ? "Bar" : "Kitchen"}</Text> : null}
            </View>
          ))}
        </View>

        {order.note ? (
          <View accessibilityRole="alert" style={{ flexDirection: "row", gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: c.warningWash }}>
            <Icon name="note" size={16} color={c.warning} />
            <Text style={{ flex: 1, color: c.text }}>{order.note}</Text>
          </View>
        ) : null}

        {stations ? <Text variant="caption" tone="muted">{stations}</Text> : null}

        <Button
          title={action.label}
          icon={action.icon}
          size="lg"
          fullWidth
          variant={order.stage === "ready" ? "outline" : "primary"}
          loading={busy}
          onPress={() => onAction(order, action)}
          testID={`ticket-action-${order.orderNumber}`}
        />
      </View>
    </View>
  );
});
