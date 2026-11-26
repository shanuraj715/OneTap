import { useMemo, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useOrders, useTables } from "@/data/hooks";
import { isOpenStatus } from "@/features/orders";
import { useLayout } from "@/lib/layout";
import { Banner, Chip, EmptyState, ErrorState, LoadingBlock, Screen, ScreenTitle, useTheme } from "@/ui";
import { OrderCard } from "./OrderCard";

type View_ = "open" | "all";

/** Every order of this outlet, newest first. By default only the ones still in the kitchen or waiting to be served. */
export function OrdersScreen({ onOpenTable }: { onOpenTable?: (tableId: string) => void }) {
  const { c } = useTheme();
  const layout = useLayout();
  const ordersQ = useOrders();
  const tablesQ = useTables();
  const [view, setView] = useState<View_>("open");
  const [pulling, setPulling] = useState(false);

  const tableNumber = useMemo(() => new Map((tablesQ.data ?? []).map((t) => [t.id, t.number])), [tablesQ.data]);
  const all = useMemo(() => [...(ordersQ.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [ordersQ.data]);
  const open = useMemo(() => all.filter((o) => isOpenStatus(o.status)), [all]);
  const shown = view === "open" ? open : all;
  const cols = layout.kind === "phone" ? 1 : 2;

  async function refresh() {
    setPulling(true);
    try { await Promise.all([ordersQ.refetch(), tablesQ.refetch()]); } finally { setPulling(false); }
  }

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
        <ScreenTitle icon="receipt" title="Orders" />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Chip label="In progress" icon="pot" count={open.length} selected={view === "open"} onPress={() => setView("open")} testID="orders-open" />
          <Chip label="All" icon="list" count={all.length} selected={view === "all"} onPress={() => setView("all")} testID="orders-all" />
        </View>
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
          refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void refresh()} colors={[c.primary]} />}
          ListEmptyComponent={view === "open" ? <EmptyState icon="receipt" title="No orders in progress" message="New orders show up here by themselves." action={all.length ? { title: `Show all ${all.length}`, onPress: () => setView("all") } : undefined} /> : <EmptyState icon="receipt" title="No orders yet" />}
          renderItem={({ item }) => (
            <View style={{ flex: 1 }}>
              <OrderCard order={item} tableNumber={item.tableId ? tableNumber.get(item.tableId) : undefined} onPress={item.tableId && onOpenTable ? () => onOpenTable(item.tableId!) : undefined} />
            </View>
          )}
        />
      )}
    </Screen>
  );
}
