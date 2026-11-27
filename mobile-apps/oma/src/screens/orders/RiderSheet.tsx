import { useState } from "react";
import { Pressable, View } from "react-native";
import type { Order } from "@/api/schemas";
import { useAssignRider, useRiders } from "@/data/hooks";
import { Banner, Button, Icon, Sheet, Spinner, Text, TextField, toasts, useTheme } from "@/ui";
import { messageOf } from "./useStatusChange";

/**
 * Who is taking a delivery order. Opened by "Send out" (`sendOut`: the order also goes out for delivery, and the customer is told who is
 * bringing it) or by "Change rider". Pick one from the outlet's list, type a name and number for just this once, or — when sending out —
 * no rider at all.
 */
export function RiderSheet({ order, sendOut, onClose }: { order: Order | null; sendOut: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const visible = !!order;
  const ridersQ = useRiders(visible);
  const assign = useAssignRider();
  const [choice, setChoice] = useState<string>("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  // start from what the order has now (a listed rider, a typed one, or nobody) — each time the sheet is opened for an order
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const seedKey = order ? `${order.id}:${sendOut}` : null;
  if (seedKey !== seededFor) {
    setSeededFor(seedKey);
    if (order) {
      setChoice(order.rider?.riderId ?? (order.rider ? "other" : sendOut ? "none" : ""));
      setName(order.rider && !order.rider.riderId ? order.rider.name : "");
      setPhone(order.rider && !order.rider.riderId ? order.rider.phone ?? "" : "");
    }
  }

  const typed = choice === "other";
  const ready = typed ? name.trim().length > 0 : sendOut ? choice !== "" : choice !== "" && choice !== "none";
  const riders = ridersQ.data ?? [];

  async function save() {
    if (!order) return;
    const body = typed ? { name: name.trim(), phone: phone.trim(), sendOut } : choice === "none" ? { riderId: null, sendOut } : { riderId: choice, sendOut };
    try {
      const res = await assign.mutateAsync({ id: order.id, body });
      const who = res.order.rider?.name;
      toasts.ok(sendOut ? `Order #${order.orderNumber} is out for delivery${who ? ` with ${who}` : ""}` : `Rider for order #${order.orderNumber}: ${who ?? "none"}`);
      onClose();
    } catch (e) { toasts.error(messageOf(e)); }
  }

  const option = (id: string, title: string, sub?: string, icon: "bike" | "user" | "x-circle" = "bike") => {
    const on = choice === id;
    return (
      <Pressable key={id} onPress={() => setChoice(id)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={sub ? `${title}, ${sub}` : title} testID={`rider-${id}`}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: on ? 2 : 1, borderColor: on ? c.primary : c.border, backgroundColor: on ? c.surfaceAlt : c.surface }}>
        <Icon name={icon} size={18} color={on ? c.primaryText : c.muted} />
        <Text variant="label" style={{ flex: 1 }}>{title}</Text>
        {sub ? <Text tone="muted">{sub}</Text> : null}
      </Pressable>
    );
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={order ? (sendOut ? `Order #${order.orderNumber} — send out` : `Rider for order #${order.orderNumber}`) : "Rider"} testID="rider-sheet"
      footer={<Button title={sendOut ? "Send out for delivery" : "Save rider"} icon={sendOut ? "bike" : "check"} fullWidth size="lg" disabled={!ready} loading={assign.isPending} onPress={() => void save()} testID="rider-submit" />}>
      <Text tone="muted">{sendOut ? "Who is taking it? The customer is told it is on the way, with the rider's name and number." : "The customer's order page shows the new rider straight away."}</Text>
      {ridersQ.isLoading ? <View style={{ alignItems: "center", padding: 12 }}><Spinner /></View> : null}
      {ridersQ.isError ? <Banner tone="warn" message="Can't load the rider list. You can still type a name and number below." /> : null}
      <View role="radiogroup" accessibilityLabel="Riders" style={{ gap: 8 }}>
        {riders.map((r) => option(r.id, r.name, r.phone ?? undefined))}
        {option("other", "Someone else", undefined, "user")}
        {sendOut ? option("none", "No rider — just mark it out for delivery", undefined, "x-circle") : null}
      </View>
      {typed ? (
        <View style={{ gap: 10 }}>
          <TextField label="Rider's name" leftIcon="user" value={name} onChangeText={setName} maxLength={60} testID="rider-name" />
          <TextField label="Rider's phone" leftIcon="phone" value={phone} onChangeText={setPhone} maxLength={20} keyboardType="phone-pad" testID="rider-phone" />
        </View>
      ) : null}
    </Sheet>
  );
}
