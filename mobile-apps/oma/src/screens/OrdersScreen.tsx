import { useMemo, useState } from "react";
import { FlatList, RefreshControl, ScrollView, View } from "react-native";
import type { Order } from "@/api/schemas";
import { canUpdateOrders } from "@/auth/permissions";
import { useOrders, useTables } from "@/data/hooks";
import { actionIcon, actionLabel, CHANNEL_ICON, channelLabel, CHANNELS, filterOrders, forwardStatusesFor, isOpenStatus, statusIcon, statusLabel } from "@/features/orders";
import { useLayout } from "@/lib/layout";
import { useNow } from "@/lib/useNow";
import { useSession } from "@/runtime";
import { Banner, Button, Chip, EmptyState, ErrorState, LoadingBlock, Screen, ScreenTitle, TextField, useTheme } from "@/ui";
import { OrderCard } from "./OrderCard";
import { ItemsSheet } from "./orders/ItemsSheet";
import { useOrderActions } from "./orders/useOrderActions";

/** "open" = still in the kitchen or waiting to be served; "all"; or one status. */
type StatusView = "open" | "all" | "placed" | "accepted" | "preparing" | "ready" | "out_for_delivery" | "completed" | "cancelled";
const STATUS_CHIPS: StatusView[] = ["open", "placed", "accepted", "preparing", "ready", "out_for_delivery", "completed", "cancelled", "all"];

/**
 * Every order of this outlet, newest first — dine-in, takeaway and delivery. Find one (number, customer, phone, table, rider, address), narrow it
 * by status or by type, move it to its next step right from the list, or open it for everything else (see OrderDetail).
 */
export function OrdersScreen({ onOpenOrder }: { onOpenOrder?: (orderId: string) => void }) {
  const { c } = useTheme();
  const layout = useLayout();
  const user = useSession((s) => s.user);
  const mayUpdate = canUpdateOrders(user);
  const ordersQ = useOrders();
  const tablesQ = useTables();
  const now = useNow(30_000);
  const [status, setStatus] = useState<StatusView>("open");
  const [channel, setChannel] = useState<"all" | string>("all");
  const [search, setSearch] = useState("");
  const [pulling, setPulling] = useState(false);
  const actions = useOrderActions();
  const [itemsFor, setItemsFor] = useState<Order | null>(null);

  const tableNumber = useMemo(() => new Map((tablesQ.data ?? []).map((t) => [t.id, t.number])), [tablesQ.data]);
  const all = useMemo(() => [...(ordersQ.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [ordersQ.data]);
  // the counts on the chips follow the type and the search, so a chip never promises orders that the other filters would hide
  const base = useMemo(() => filterOrders(all, (id) => tableNumber.get(id), { status: "all", channel, search }), [all, tableNumber, channel, search]);
  const countOf = (v: StatusView) => (v === "all" ? base.length : v === "open" ? base.filter((o) => isOpenStatus(o.status)).length : base.filter((o) => o.status === v).length);
  const shown = useMemo(() => filterOrders(all, (id) => tableNumber.get(id), { status, channel, search }), [all, tableNumber, status, channel, search]);
  const cols = layout.kind === "phone" ? 1 : 2;
  const filtered = status !== "open" || channel !== "all" || search.trim() !== "";

  async function refresh() {
    setPulling(true);
    try { await Promise.all([ordersQ.refetch(), tablesQ.refetch()]); } finally { setPulling(false); }
  }
  const clear = () => { setStatus("open"); setChannel("all"); setSearch(""); };

  const next = (o: Order) => (mayUpdate ? forwardStatusesFor(o.status, o.channel)[0] : undefined);

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
        <ScreenTitle icon="receipt" title="Orders" />
        <TextField label="Find an order" hideLabel compact leftIcon="search" value={search} onChangeText={setSearch} onClear={() => setSearch("")} placeholder="Order number, name, phone, table…" returnKeyType="search" testID="orders-search" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} testID="orders-status-chips">
          {STATUS_CHIPS.map((v) => (
            <Chip key={v} label={v === "open" ? "In progress" : v === "all" ? "All" : statusLabel(v)} icon={v === "open" ? "pot" : v === "all" ? "list" : statusIcon(v)} count={countOf(v)} selected={status === v} onPress={() => setStatus(v)} testID={v === "open" ? "orders-open" : v === "all" ? "orders-all" : `orders-status-${v}`} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} testID="orders-channel-chips">
          <Chip label="Every type" icon="grid" selected={channel === "all"} onPress={() => setChannel("all")} testID="orders-channel-all" />
          {CHANNELS.map((ch) => <Chip key={ch} label={channelLabel(ch)} icon={CHANNEL_ICON[ch]} selected={channel === ch} onPress={() => setChannel(ch)} testID={`orders-channel-${ch}`} />)}
        </ScrollView>
        {ordersQ.isError && ordersQ.data ? <Banner tone="warn" message="Can't refresh right now. Showing the orders as they were a moment ago." testID="orders-stale" /> : null}
      </View>
      {ordersQ.isLoading ? (
        <LoadingBlock label="Loading orders…" />
      ) : ordersQ.isError && !ordersQ.data ? (
        <ErrorState error={ordersQ.error} onRetry={() => void refresh()} title="Can't load the orders" />
      ) : (
        <FlatList
          key={`orders-${cols}`}
          data={shown}
          numColumns={cols}
          keyExtractor={(o) => o.id}
          columnWrapperStyle={cols > 1 ? { gap: 12 } : undefined}
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[c.primary]} />}
          ListEmptyComponent={filtered ? (
            <EmptyState icon="search" title="No order matches" message="Try another word, or clear what you chose." action={{ title: "Clear the filters", onPress: clear }} />
          ) : (
            <EmptyState icon="receipt" title="No orders in progress" message="New orders show up here by themselves." action={all.length ? { title: `Show all ${all.length}`, onPress: () => setStatus("all") } : undefined} />
          )}
          renderItem={({ item }) => {
            const to = next(item);
            return (
              <View style={{ flex: 1 }}>
                <OrderCard
                  order={item}
                  now={now}
                  items="button"
                  onShowItems={setItemsFor}
                  tableNumber={item.tableId ? tableNumber.get(item.tableId) : undefined}
                  onPress={onOpenOrder ? () => onOpenOrder(item.id) : undefined}
                  footer={to ? <Button title={actionLabel(to, item.channel)} icon={actionIcon(to)} fullWidth onPress={() => actions.advance(item, to)} testID={`advance-${item.orderNumber}`} /> : undefined}
                />
              </View>
            );
          }}
        />
      )}
      {actions.dialogs}
      <ItemsSheet order={itemsFor} onClose={() => setItemsFor(null)} />
    </Screen>
  );
}
