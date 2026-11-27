import { useState } from "react";
import { Pressable, View } from "react-native";
import type { Order } from "@/api/schemas";
import { usePrinters, usePrintOrder } from "@/data/hooks";
import { Banner, Button, Icon, Sheet, Spinner, Text, toasts, useTheme } from "@/ui";
import { messageOf } from "./useStatusChange";

const DOC: Record<string, string> = { kot: "Kitchen ticket", receipt: "Receipt", bill: "Bill", refund: "Refund slip" };

/** Print this order on one of the outlet's printers (the ticket is queued; the printer's own agent or cloud service prints it). */
export function PrintSheet({ order, onClose }: { order: Order | null; onClose: () => void }) {
  const { c } = useTheme();
  const printersQ = usePrinters(!!order);
  const print = usePrintOrder();
  const [chosen, setChosen] = useState<string | null>(null);
  const printers = printersQ.data ?? [];
  const close = () => { setChosen(null); onClose(); };
  async function go() {
    if (!order || !chosen) return;
    try {
      const res = await print.mutateAsync({ orderId: order.id, printerId: chosen });
      toasts.ok(`Order #${order.orderNumber} sent to ${res.job.printerName ?? "the printer"}`);
      close();
    } catch (e) { toasts.error(messageOf(e)); }
  }
  return (
    <Sheet visible={!!order} onClose={close} title={order ? `Print order #${order.orderNumber}` : "Print"} testID="print-sheet"
      footer={<Button title="Print" icon="printer" fullWidth size="lg" disabled={!chosen} loading={print.isPending} onPress={() => void go()} testID="print-confirm" />}>
      {printersQ.isLoading ? <View style={{ alignItems: "center", padding: 12 }}><Spinner /></View> : null}
      {printersQ.isError ? <Banner tone="warn" message="Can't load the printers right now." /> : null}
      {printersQ.data && printers.length === 0 ? <Banner tone="info" message="No printer is set up for this outlet. Add one in the store dashboard (Printing)." /> : null}
      <View role="radiogroup" accessibilityLabel="Printers" style={{ gap: 8 }}>
        {printers.map((p) => {
          const on = chosen === p.id;
          return (
            <Pressable key={p.id} onPress={() => setChosen(p.id)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${p.name}, ${p.station}, ${DOC[p.docType] ?? p.docType}`} testID={`printer-${p.name}`}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: on ? 2 : 1, borderColor: on ? c.primary : c.border, backgroundColor: on ? c.surfaceAlt : c.surface }}>
              <Icon name="printer" size={18} color={on ? c.primaryText : c.muted} />
              <View style={{ flex: 1 }}>
                <Text variant="label">{p.name}</Text>
                <Text variant="caption" tone="muted">{p.station} · {DOC[p.docType] ?? p.docType}</Text>
                {p.configError ? <Text variant="caption" tone="warning">{p.configError}</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}
