import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { ApiError } from "@/api/client";
import type { Order } from "@/api/schemas";
import { useSetOrderStatus, useSetOrderStatusManual } from "@/data/hooks";
import { actionIcon, actionLabel, statusLabelFor } from "@/features/orders";
import { Banner, Button, ConfirmDialog, Icon, Sheet, Text, toasts, useTheme } from "@/ui";

export const messageOf = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong. Please try again.");

interface FreeTable { id: string; number: string; zone: string; seats: number }
const freeTablesOf = (e: unknown): FreeTable[] | null => {
  if (!(e instanceof ApiError) || e.code !== "table_taken") return null;
  const list = e.details?.freeTables;
  return Array.isArray(list) ? (list as FreeTable[]) : null;
};

/**
 * Every change of an order's status goes through here, so a mis-tap costs as little as possible:
 *  - `ask(order, to)`: the next step, or cancel — a "Mark order #0004 as …?" question first, then the change;
 *  - `applyManual(order, to, reason)`: any status, set by hand (the pop-up it comes from was the question) — and when the order's table has
 *    another party by now, the server says so and the person picks a free table to seat this order's party at.
 * Returns the pop-ups to draw (`dialogs`) and whether a change is under way.
 */
export function useStatusChange(onChanged?: (order: Order) => void) {
  const step = useSetOrderStatus();
  const manual = useSetOrderStatusManual();
  const [asking, setAsking] = useState<{ order: Order; to: string } | null>(null);
  const [seating, setSeating] = useState<{ order: Order; to: string; reason?: string; message: string; tables: FreeTable[] } | null>(null);

  const done = (order: Order, to: string, seatedAt?: string) => {
    toasts.ok(`Order #${order.orderNumber} is now ${statusLabelFor(to, order.channel)}${seatedAt ? ` — party moved to table ${seatedAt}` : ""}`);
    setAsking(null); setSeating(null);
    onChanged?.(order);
  };

  async function confirmStep() {
    if (!asking) return;
    const { order, to } = asking;
    try { const res = await step.mutateAsync({ id: order.id, status: to }); done(res.order, to); } catch (e) { toasts.error(messageOf(e)); setAsking(null); }
  }
  async function applyManual(order: Order, to: string, reason?: string, tableId?: string): Promise<boolean> {
    try {
      const res = await manual.mutateAsync({ id: order.id, status: to, reason: reason?.trim() || undefined, tableId });
      done(res.order, to, res.table?.moved ? res.table.number : undefined);
      return true;
    } catch (e) {
      const tables = freeTablesOf(e);
      if (tables) { setSeating({ order, to, reason, message: messageOf(e), tables }); return false; }
      toasts.error(messageOf(e));
      return false;
    }
  }

  const cancelling = asking?.to === "cancelled";
  const dialogs: ReactNode = (
    <>
      <ConfirmDialog
        visible={!!asking}
        title={asking ? (cancelling ? `Cancel order #${asking.order.orderNumber}?` : `Mark order #${asking.order.orderNumber} as ${statusLabelFor(asking.to, asking.order.channel)}?`) : ""}
        message={cancelling ? "The order leaves the active queue and the kitchen is told. This can't be undone from here (you can set a status by hand if it was a mistake)." : "Any printer or alert set up for this step fires straight away."}
        confirmLabel={asking ? actionLabel(asking.to, asking.order.channel) : "Confirm"}
        destructive={cancelling}
        icon={asking ? actionIcon(asking.to) : undefined}
        loading={step.isPending}
        onConfirm={() => void confirmStep()}
        onCancel={() => setAsking(null)}
      />
      <SeatSheet seating={seating} busy={manual.isPending} onClose={() => setSeating(null)} onPick={(tableId) => seating && void applyManual(seating.order, seating.to, seating.reason, tableId)} />
    </>
  );
  return { ask: (order: Order, to: string) => setAsking({ order, to }), applyManual, dialogs, busy: step.isPending || manual.isPending };
}

/** The order's table has another party now: pick a free table for the party of this order. */
function SeatSheet({ seating, busy, onClose, onPick }: { seating: { order: Order; message: string; tables: FreeTable[] } | null; busy: boolean; onClose: () => void; onPick: (tableId: string) => void }) {
  const { c } = useTheme();
  const [chosen, setChosen] = useState<string | null>(null);
  return (
    <Sheet visible={!!seating} onClose={() => { setChosen(null); onClose(); }} title="Pick a table for this party" testID="seat-sheet"
      footer={<Button title="Put the order back and seat them here" icon="check" fullWidth size="lg" disabled={!chosen} loading={busy} onPress={() => chosen && onPick(chosen)} testID="seat-confirm" />}>
      <Banner tone="warn" message={seating?.message ?? ""} />
      {seating && seating.tables.length === 0 ? <Banner tone="warn" message="There is no free table right now. Free one first, then try again." /> : null}
      <View role="radiogroup" accessibilityLabel="Free tables" style={{ gap: 8 }}>
        {(seating?.tables ?? []).map((t) => {
          const on = chosen === t.id;
          return (
            <Pressable key={t.id} onPress={() => setChosen(t.id)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`Table ${t.number}, ${t.seats} seats${t.zone ? `, ${t.zone}` : ""}`} testID={`seat-${t.number}`}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: on ? 2 : 1, borderColor: on ? c.primary : c.border, backgroundColor: on ? c.surfaceAlt : c.surface }}>
              <Icon name="table" size={18} color={on ? c.primaryText : c.muted} />
              <Text variant="label" style={{ flex: 1 }}>Table {t.number}{t.zone ? ` · ${t.zone}` : ""}</Text>
              <Text tone="muted">{t.seats} {t.seats === 1 ? "seat" : "seats"}</Text>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}
