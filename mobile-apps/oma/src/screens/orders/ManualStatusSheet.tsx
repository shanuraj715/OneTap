import { useState } from "react";
import { Pressable, View } from "react-native";
import type { Order } from "@/api/schemas";
import { manualStatusesFor, statusIcon, statusLabelFor } from "@/features/orders";
import { Banner, Button, Icon, Sheet, Text, TextField, useTheme } from "@/ui";

/**
 * Set any status by hand — the correction for a mis-tap (an order marked Ready too early, a cancel that was a mistake). It is a separate
 * pop-up from the big buttons on purpose, and the history marks it as "set by hand", with the reason typed here.
 */
export function ManualStatusSheet({ order, busy, onClose, onApply }: { order: Order | null; busy: boolean; onClose: () => void; onApply: (order: Order, to: string, reason: string) => Promise<boolean> }) {
  const { c } = useTheme();
  const [to, setTo] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const close = () => { setTo(null); setReason(""); onClose(); };
  async function go() {
    if (!order || !to) return;
    if (await onApply(order, to, reason)) close();
  }
  return (
    <Sheet visible={!!order} onClose={close} title={order ? `Set order #${order.orderNumber} by hand` : "Set status"} testID="manual-sheet"
      footer={<Button title={order && to ? `Set to ${statusLabelFor(to, order.channel)}` : "Pick a status"} icon="check" fullWidth size="lg" disabled={!to} loading={busy} onPress={() => void go()} testID="manual-confirm" />}>
      <Banner tone="info" message="This sets the status directly and skips the usual step-by-step order. Use it to put right a mis-tap." />
      <View role="radiogroup" accessibilityLabel="Status" style={{ gap: 8 }}>
        {order ? manualStatusesFor(order.channel).map((s) => {
          const current = s === order.status;
          const on = to === s;
          return (
            <Pressable key={s} disabled={current} onPress={() => setTo(s)} accessibilityRole="radio" accessibilityState={{ checked: on, disabled: current }} accessibilityLabel={`${statusLabelFor(s, order.channel)}${current ? ", current" : ""}`} testID={`manual-${s}`}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: on ? 2 : 1, borderColor: on ? c.primary : c.border, backgroundColor: on ? c.surfaceAlt : c.surface, opacity: current ? 0.55 : 1 }}>
              <Icon name={statusIcon(s)} size={18} color={s === "cancelled" ? c.danger : on ? c.primaryText : c.muted} />
              <Text variant="label" style={{ flex: 1 }} tone={s === "cancelled" ? "danger" : "default"}>{statusLabelFor(s, order.channel)}</Text>
              {current ? <Text variant="caption" tone="muted">Now</Text> : null}
            </Pressable>
          );
        }) : null}
      </View>
      <TextField label="Reason (optional)" leftIcon="note" value={reason} onChangeText={setReason} maxLength={200} placeholder="Tapped by mistake, customer changed their mind…" testID="manual-reason" />
    </Sheet>
  );
}
