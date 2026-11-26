import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { ApiError } from "@/api/client";
import type { Session, Table } from "@/api/schemas";
import { canManageTables, canTakeOrders } from "@/auth/permissions";
import { useActiveSessions, useAreaPrefs, useCloseSession, useConfirmPayment, useMoveSession, useOrders, useTables, useVoidSession } from "@/data/hooks";
import { groupTablesByZone, moveTargets, STATUS_ICON, STATUS_LABEL, STATUS_TONE, summarizeTable } from "@/features/tables";
import { formatMoney } from "@/lib/money";
import { clock } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { useSession } from "@/runtime";
import { Badge, Banner, Button, Card, ConfirmDialog, EmptyState, ErrorState, Icon, IconTile, LoadingBlock, SectionTitle, Sheet, Text, TextField, toasts, useTheme } from "@/ui";
import { OrderCard } from "./OrderCard";
import { TableTile } from "./TableTile";

const messageOf = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong. Please try again.");

/**
 * One table, in full: the party sitting there, what they have ordered, and everything a waiter does for them — add items, move them,
 * confirm that they paid, free the table, or cancel it. Buttons the signed-in person is not allowed to use are not shown (the server
 * checks again whatever the app does).
 */
export function TableDetail({ tableId, onTakeOrder }: { tableId: string; onTakeOrder: (tableId: string) => void }) {
  const { c } = useTheme();
  const user = useSession((s) => s.user);
  const manage = canManageTables(user);
  const mayOrder = canTakeOrders(user);
  const tablesQ = useTables();
  const sessionsQ = useActiveSessions();
  const ordersQ = useOrders();
  const now = useNow(30_000);

  const table = tablesQ.data?.find((t) => t.id === tableId);
  const session = sessionsQ.data?.find((s) => s.tableId === tableId);
  const orders = useMemo(
    () => (session ? (ordersQ.data ?? []).filter((o) => o.sessionId === session.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []),
    [ordersQ.data, session],
  );

  const [moving, setMoving] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [paying, setPaying] = useState(false);
  const [pulling, setPulling] = useState(false);
  const confirmPayment = useConfirmPayment();
  const close = useCloseSession();

  async function refresh() {
    setPulling(true);
    try { await Promise.all([tablesQ.refetch(), sessionsQ.refetch(), ordersQ.refetch()]); } finally { setPulling(false); }
  }

  if (tablesQ.isLoading) return <LoadingBlock label="Loading table…" />;
  if (tablesQ.isError && !tablesQ.data) return <ErrorState error={tablesQ.error} onRetry={() => void refresh()} title="Can't load this table" />;
  if (!table) return <EmptyState icon="table" title="Table not found" message="It may have been removed. Go back to the tables." />;

  const s = summarizeTable(table, session, now);
  const tone = STATUS_TONE[table.status];

  async function pay(sess: Session) {
    try {
      await confirmPayment.mutateAsync(sess.id);
      toasts.ok(`Payment confirmed for table ${table!.number}`);
    } catch (e) { toasts.error(messageOf(e)); }
    setPaying(false);
  }
  async function free(sess: Session) {
    try {
      await close.mutateAsync(sess.id);
      toasts.ok(`Table ${table!.number} is free again`);
    } catch (e) { toasts.error(messageOf(e)); }
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14 }} refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[c.primary]} />}>
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <IconTile icon="table" tone={tone === "neutral" ? "neutral" : tone} />
          <Text variant="title" accessibilityRole="header">Table {table.number}</Text>
          <Badge label={STATUS_LABEL[table.status]} tone={tone} icon={STATUS_ICON[table.status]} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name="chair" size={16} color={c.muted} /><Text tone="muted">{table.seats} {table.seats === 1 ? "seat" : "seats"}</Text></View>
          {table.zone ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Icon name="pin" size={16} color={c.muted} /><Text tone="muted">{table.zone}</Text></View> : null}
        </View>
      </View>

      {(sessionsQ.isError || ordersQ.isError) ? <Banner tone="warn" message="Can't refresh right now. This may be a moment out of date." /> : null}

      {session ? (
        <Card testID="session-card" style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <IconTile icon="user" tone="info" size={36} />
            <View style={{ flex: 1 }}>
              <Text variant="subheading" numberOfLines={1}>{s.who}</Text>
              {session.customerPhone && session.customerName ? <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><Icon name="phone" size={13} color={c.muted} /><Text variant="caption" tone="muted">{session.customerPhone}</Text></View> : null}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}><Icon name="clock" size={14} color={c.muted} /><Text tone="muted">Seated {s.since}</Text></View>
          </View>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <IconTile icon="receipt" tone="neutral" size={32} />
              <View><Text variant="caption" tone="muted">Bill so far</Text><Text variant="heading" testID="tab-total">{formatMoney(session.tab)}</Text></View>
            </View>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <IconTile icon={session.allPaid ? "check-circle" : "wallet"} tone={session.allPaid ? "ok" : "warn"} size={32} />
              <View><Text variant="caption" tone="muted">Still to pay</Text><Text variant="heading" tone={session.allPaid ? "success" : "warning"} testID="unpaid-total">{session.allPaid ? "Paid" : formatMoney(session.unpaidTotal)}</Text></View>
            </View>
          </View>
        </Card>
      ) : table.status === "free" ? (
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 10 }}><Icon name="chair" size={20} color={c.muted} /><Text tone="muted" style={{ flex: 1 }}>Nobody is sitting here. Take an order to seat a customer.</Text></Card>
      ) : null}

      <View style={{ gap: 10 }}>
        {mayOrder && table.isActive ? <Button title={session ? "Add more items" : "Take order"} icon="plus" size="lg" fullWidth onPress={() => onTakeOrder(table.id)} testID="take-order" /> : null}
        {session && manage ? (
          <>
            {!session.allPaid && session.orderCount > 0 ? <Button title="Confirm payment" icon="wallet" variant="secondary" fullWidth onPress={() => setPaying(true)} testID="confirm-payment" /> : null}
            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              <Button title="Move table" icon="move" variant="outline" onPress={() => setMoving(true)} testID="move-table" style={{ flexGrow: 1 }} />
              <Button title="Free the table" icon="check-circle" variant="outline" disabled={!session.allPaid} loading={close.isPending} onPress={() => void free(session)} testID="close-table" style={{ flexGrow: 1 }} />
            </View>
            {!session.allPaid ? <Text variant="caption" tone="muted">To free the table, confirm the payment first.</Text> : null}
            <Button title="Cancel this table…" icon="trash" variant="ghost" onPress={() => setVoiding(true)} testID="void-table" />
          </>
        ) : null}
      </View>

      {session ? (
        <View style={{ gap: 10 }}>
          <SectionTitle icon="receipt" title={`Orders (${orders.length})`} />
          {ordersQ.isLoading ? <LoadingBlock label="Loading orders…" /> : orders.length === 0 ? <Text tone="muted">No orders on this table yet.</Text> : orders.map((o) => <OrderCard key={o.id} order={o} />)}
        </View>
      ) : null}

      {session ? <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }}><Icon name="history" size={13} color={c.muted} /><Text variant="caption" tone="muted">Table opened at {clock(session.openedAt)}</Text></View> : null}

      {session ? (
        <>
          <ConfirmDialog
            visible={paying}
            title="Payment received?"
            icon="wallet"
            message={`Confirm that ${s.who} paid ${formatMoney(session.unpaidTotal)} for table ${table.number} (cash, card or UPI).`}
            confirmLabel="Yes, paid"
            loading={confirmPayment.isPending}
            onConfirm={() => void pay(session)}
            onCancel={() => setPaying(false)}
          />
          <MoveSheet visible={moving} onClose={() => setMoving(false)} table={table} session={session} tables={tablesQ.data ?? []} />
          <VoidSheet visible={voiding} onClose={() => setVoiding(false)} table={table} session={session} />
        </>
      ) : null}
    </ScrollView>
  );
}

/** Pick a free table and move the whole party (and their orders) there. Tables are grouped by area, each shown as its number and its seats. */
function MoveSheet({ visible, onClose, table, session, tables }: { visible: boolean; onClose: () => void; table: Table; session: Session; tables: Table[] }) {
  const { c } = useTheme();
  const move = useMoveSession();
  const [to, setTo] = useState<string | null>(null);
  const targets = moveTargets(tables, table.id);
  const groups = groupTablesByZone(targets);
  const target = targets.find((t) => t.id === to);
  // Areas follow what this person keeps open on the board (plus the area the party is in now, and the area of the chosen table);
  // opening or closing one here is only for this pop-up — it does not change what the board remembers.
  const saved = useAreaPrefs();
  const [taps, setTaps] = useState<Readonly<Record<string, boolean>>>({});
  const here = table.zone || "Other tables";
  const isOpen = (label: string) => Boolean(target && (target.zone || "Other tables") === label) || (taps[label] ?? (label === here || saved.open.includes(label)));
  function close() { setTo(null); setTaps({}); onClose(); }
  async function go() {
    if (!target) return;
    try {
      await move.mutateAsync({ sessionId: session.id, toTableId: target.id });
      toasts.ok(`Moved to table ${target.number}`);
      close();
    } catch (e) { toasts.error(messageOf(e)); }
  }
  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={`Move table ${table.number}`}
      footer={<Button title={target ? `Move to Table ${target.number}` : "Pick a table"} icon="move" fullWidth size="lg" disabled={!target} loading={move.isPending} onPress={() => void go()} testID="move-confirm" />}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <IconTile icon="user" tone="info" size={36} />
        <View style={{ flex: 1 }}>
          <Text variant="subheading" numberOfLines={1}>{session.customerName || session.customerPhone || "The party"}</Text>
          <Text variant="caption" tone="muted">Now at Table {table.number}{table.zone ? ` · ${table.zone}` : ""} · the orders move with them</Text>
        </View>
      </View>
      {targets.length === 0 ? (
        <Banner tone="warn" message="There is no free table to move to right now." />
      ) : (
        <View role="radiogroup" accessibilityLabel="Free tables" style={{ gap: 16 }}>
          {groups.map((g) => (
            <View key={g.zone || "none"} style={{ gap: 8 }} testID={`move-zone-${g.label}`}>
              <Pressable
                testID={`move-zone-toggle-${g.label}`}
                accessibilityRole="button"
                accessibilityLabel={`${g.label}, ${g.tables.length} free`}
                accessibilityState={{ expanded: !!isOpen(g.label) }}
                onPress={() => setTaps((cur) => ({ ...cur, [g.label]: !isOpen(g.label) }))}
                style={{ minHeight: 40, flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <Icon name={isOpen(g.label) ? "chevron-down" : "chevron-right"} size={18} color={c.primaryText} />
                <Icon name="pin" size={16} color={c.primaryText} />
                <Text variant="label" style={{ flex: 1 }}>{g.label}</Text>
                <Text variant="caption" tone="muted">{g.tables.length} free</Text>
              </Pressable>
              {isOpen(g.label) ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {g.tables.map((t) => <TableTile key={t.id} table={t} selected={t.id === to} onPress={() => setTo(t.id)} />)}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </Sheet>
  );
}

/** The party left without paying, or the table was seated by mistake: free it and cancel what is still open. */
function VoidSheet({ visible, onClose, table, session }: { visible: boolean; onClose: () => void; table: Table; session: Session }) {
  const cancel = useVoidSession();
  const [reason, setReason] = useState("");
  function close() { setReason(""); onClose(); }
  async function go() {
    try {
      await cancel.mutateAsync({ sessionId: session.id, reason: reason.trim() || undefined });
      toasts.ok(`Table ${table.number} was cancelled`);
      close();
    } catch (e) { toasts.error(messageOf(e)); }
  }
  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={`Cancel table ${table.number}`}
      footer={<Button title="Cancel table and its orders" icon="trash" variant="danger" fullWidth size="lg" loading={cancel.isPending} onPress={() => void go()} testID="void-confirm" />}
    >
      <Banner tone="warn" message={session.openOrders > 0 ? `${session.openOrders} open ${session.openOrders === 1 ? "order" : "orders"} will be cancelled and the kitchen told. The table becomes free. This cannot be undone.` : "The table becomes free. This cannot be undone."} />
      <TextField label="Reason (optional)" leftIcon="note" value={reason} onChangeText={setReason} maxLength={200} placeholder="Customer left, seated by mistake…" testID="void-reason" />
    </Sheet>
  );
}
