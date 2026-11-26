import { memo } from "react";
import { View } from "react-native";
import type { Delivery } from "@/api/schemas";
import { actionFor, bagText, distanceText, itemCount, minutesSince, minutesText, paymentText, STATUS_TEXT, STATUS_TONE, stepOf } from "@/features/deliveries";
import { Badge, Button, Icon, Text, radius, useTheme } from "@/ui";

export interface DeliveryCardProps {
  delivery: Delivery;
  now: number;
  /** a Picked up / Delivered for THIS delivery is on its way to the server */
  busy: boolean;
  /** it was handed to the rider since they last looked */
  fresh: boolean;
  onNavigate: (d: Delivery) => void;
  onCall: (d: Delivery) => void;
  onWhatsApp: (d: Delivery) => void;
  onAction: (d: Delivery) => void;
}

/**
 * One delivery: its number and where it is, the address with the landmark, who to call, what is in the bag, and the buttons a rider needs on
 * the road: Navigate (opens the phone's maps app), Call, WhatsApp, and the ONE big step button (Picked up / Delivered).
 */
export const DeliveryCard = memo(function DeliveryCard({ delivery: d, now, busy, fresh, onNavigate, onCall, onWhatsApp, onAction }: DeliveryCardProps) {
  const { c } = useTheme();
  const step = stepOf(d);
  const action = actionFor(d);
  const pay = paymentText(d);
  const km = distanceText(d.address.distanceKm);
  const since = step === "deliver" ? minutesSince(d.pickedUpAt, now) : null;
  return (
    <View testID={`delivery-${d.orderNumber}`} accessible accessibilityLabel={`Order ${d.orderNumber}, ${STATUS_TEXT[d.status]}, ${d.address.text}`} style={{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: fresh ? c.primary : c.border, borderLeftWidth: 8, borderLeftColor: step === "deliver" ? c.info : step === "pickup" ? c.warning : fresh ? c.primary : c.border, padding: 14, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Text variant="heading">#{d.orderNumber}</Text>
        {fresh ? <Badge label="NEW" tone="info" icon="bell" /> : null}
        <View style={{ flex: 1 }} />
        <Badge label={since !== null ? `${STATUS_TEXT[d.status]} · ${minutesText(since)}` : STATUS_TEXT[d.status]} tone={STATUS_TONE[d.status]} icon={step === "deliver" ? "bike" : step === "pickup" ? "bag" : "clock"} />
      </View>

      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ paddingTop: 2 }}><Icon name="pin" size={18} color={c.primaryText} /></View>
          <Text variant="subheading" style={{ flex: 1 }} selectable>{d.address.text || "Address not given"}</Text>
        </View>
        {d.address.landmark ? <Text tone="muted" style={{ marginLeft: 26 }}>Near {d.address.landmark}</Text> : null}
        {km ? <Text variant="caption" tone="muted" style={{ marginLeft: 26 }}>{km} from the restaurant</Text> : null}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Icon name="user" size={16} color={c.muted} />
        <Text style={{ flexShrink: 1 }}>{d.customer.name || "Customer"}</Text>
        {d.customer.phone ? <Text tone="muted" selectable>· {d.customer.phone}</Text> : null}
      </View>

      <View style={{ gap: 2 }}>
        <Text variant="caption" tone="muted">{itemCount(d)} {itemCount(d) === 1 ? "item" : "items"} in the bag</Text>
        <Text>{bagText(d)}</Text>
      </View>

      {d.note ? (
        <View style={{ flexDirection: "row", gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: c.warningWash }}>
          <Icon name="note" size={16} color={c.warning} />
          <Text style={{ flex: 1 }}>{d.note}</Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Badge label={pay.label} tone={pay.tone} icon="wallet" />
        {d.needsCode && step === "deliver" ? <Badge label="Ask for the customer's 4-digit code" tone="info" icon="lock" /> : null}
      </View>

      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Button title="Navigate" icon="navigation" size="sm" variant="secondary" onPress={() => onNavigate(d)} testID={`navigate-${d.orderNumber}`} />
        <Button title="Call" icon="phone" size="sm" variant="secondary" disabled={!d.customer.phone} onPress={() => onCall(d)} testID={`call-${d.orderNumber}`} />
        <Button title="WhatsApp" icon="message" size="sm" variant="secondary" disabled={!d.customer.phone} onPress={() => onWhatsApp(d)} testID={`whatsapp-${d.orderNumber}`} />
      </View>

      {action ? (
        <Button title={action.label} icon={action.icon} size="lg" fullWidth loading={busy} onPress={() => onAction(d)} testID={`action-${d.orderNumber}`} />
      ) : (
        <Text tone="muted" style={{ textAlign: "center" }} testID={`waiting-${d.orderNumber}`}>The kitchen is still making it. You will be able to pick it up when it is ready.</Text>
      )}
    </View>
  );
});
