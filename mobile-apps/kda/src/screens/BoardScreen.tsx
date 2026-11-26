import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Vibration, View } from "react-native";
import { useStore } from "zustand";
import type { KitchenOrder, Screen as StationScreen, Stage } from "@/api/schemas";
import { useBoard, useSetStage } from "@/data/hooks";
import { arrivals, channelText, itemCount, lanes, STAGE_ICON, STAGE_LABEL, STAGES, type TicketAction } from "@/features/board";
import { useLayout } from "@/lib/layout";
import { useNow } from "@/lib/useNow";
import { useRuntime } from "@/runtime";
import { ConfirmDialog, EmptyState, ErrorState, IconButton, Screen, ScreenTitle, SegmentedControl, Skeleton, Text, toasts, useTheme } from "@/ui";
import { TicketCard } from "./TicketCard";

const STATIONS: { value: StationScreen; label: string }[] = [{ value: "all", label: "All" }, { value: "kitchen", label: "Kitchen" }, { value: "bar", label: "Bar" }];
const VIBRATION = [0, 350, 150, 350];
const DEFAULT_LIMITS = { warnAfterMinutes: 10, lateAfterMinutes: 20 };
const NONE: ReadonlySet<string> = new Set();

/**
 * The kitchen board: New · Preparing · Ready. On a phone one lane at a time (switch with the tabs); on a tablet all three side by side, so a
 * whole kitchen sees everything at once. It refreshes every few seconds, tells the cook when a new order arrives, and a tap on Start / Mark
 * ready / Recall changes the order for everyone (the dashboard, the waiter's bell, the customer's messages follow).
 */
export function BoardScreen() {
  const { c } = useTheme();
  const { settings } = useRuntime();
  const prefs = useStore(settings.store);
  const screen = prefs.screen;
  const board = useBoard(screen);
  const setStage = useSetStage(screen);
  const layout = useLayout();
  const now = useNow(15_000);
  const [lane, setLane] = useState<Stage>("new");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [recall, setRecall] = useState<{ order: KitchenOrder; action: TicketAction } | null>(null);
  // the orders that came in since the cook last looked, for the station that was on screen when they came (another station starts clean)
  const [freshOf, setFreshOf] = useState<{ screen: StationScreen; ids: ReadonlySet<string> }>({ screen, ids: NONE });
  const fresh = freshOf.screen === screen ? freshOf.ids : NONE;
  // which orders were on this station's board the last time we looked (a station that was never looked at has no list: its first look finds nothing "new")
  const seen = useRef<{ screen: StationScreen; ids: Set<string> } | null>(null);
  const alerts = useRef(prefs.alerts);
  alerts.current = prefs.alerts;

  // while the board of another station is still on its way, the last one is NOT shown under this station's name
  const data = board.data && board.data.screen === screen ? board.data : undefined;
  const orders = data?.orders;

  // new orders: vibrate and say which, once per order (and never for the orders that were already there when the app opened)
  useEffect(() => {
    if (!orders) return;
    const known = seen.current?.screen === screen ? seen.current.ids : null;
    const arrived = arrivals(known, orders);
    seen.current = { screen, ids: new Set([...(known ?? []), ...orders.map((o) => o.id)]) };
    if (!arrived.length) return;
    setFreshOf((prev) => ({ screen, ids: new Set([...(prev.screen === screen ? prev.ids : NONE), ...arrived.map((o) => o.id)]) }));
    if (alerts.current) {
      Vibration.vibrate(VIBRATION);
      const first = arrived[0]!;
      toasts.info(arrived.length === 1 ? `New order #${first.orderNumber} · ${channelText(first)} · ${itemCount(first)} items` : `${arrived.length} new orders`);
    }
  }, [orders, screen]);

  const by = useMemo(() => lanes(orders ?? []), [orders]);
  const limits = data?.settings ?? DEFAULT_LIMITS;

  const act = useCallback((order: KitchenOrder, action: TicketAction) => {
    if (action.confirm) { setRecall({ order, action }); return; }
    run(order, action);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);
  function run(order: KitchenOrder, action: TicketAction) {
    setBusyId(order.id);
    setFreshOf((prev) => { const next = new Set(prev.screen === screen ? prev.ids : NONE); next.delete(order.id); return { screen, ids: next }; });
    setStage.mutate({ orderId: order.id, to: action.to }, {
      onError: (e) => toasts.error(e instanceof Error ? e.message : "Couldn't change the order. Try again."),
      onSettled: () => setBusyId(null),
    });
  }

  const renderTicket = useCallback(({ item }: { item: KitchenOrder }) => (
    <TicketCard order={item} now={now} limits={limits} busy={busyId === item.id} fresh={fresh.has(item.id)} onAction={act} />
  ), [now, limits, busyId, fresh, act]);

  const laneList = (stage: Stage, testID: string) => (
    <FlatList
      testID={testID}
      data={by[stage]}
      keyExtractor={(o) => o.id}
      renderItem={renderTicket}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      contentContainerStyle={{ padding: 4, paddingBottom: 24, flexGrow: 1 }}
      ListEmptyComponent={<EmptyState icon={STAGE_ICON[stage]} title={stage === "new" ? "No new orders" : stage === "preparing" ? "Nothing being made" : "Nothing waiting for pick-up"} message={stage === "new" ? "A new order shows here the moment it is accepted." : undefined} />}
    />
  );

  const header = (
    <View style={{ gap: 12, paddingBottom: 10 }}>
      <ScreenTitle
        icon="pot"
        title="Kitchen"
        right={<IconButton icon="bell" label={prefs.alerts ? "New-order alert is on. Turn it off" : "New-order alert is off. Turn it on"} tone={prefs.alerts ? "default" : "default"} onPress={() => void settings.set({ alerts: !prefs.alerts })} testID="alert-toggle" />}
      />
      <SegmentedControl<StationScreen> options={STATIONS} value={screen} onChange={(v) => void settings.set({ screen: v })} label="Station" />
    </View>
  );

  if (!data && !board.error) {
    return <Screen>{header}<View style={{ gap: 12 }}><Skeleton height={150} radius={16} /><Skeleton height={150} radius={16} /></View></Screen>;
  }
  if (!data) {
    return <Screen>{header}<ErrorState error={board.error} onRetry={() => void board.refetch()} title="Can't load the board" /></Screen>;
  }

  return (
    <Screen padded={false} style={{ paddingHorizontal: 12, paddingTop: 12 }}>
      {header}
      {board.isError ? <Text variant="caption" tone="danger" style={{ paddingBottom: 6 }}>Can&apos;t refresh. Showing the last board.</Text> : null}
      {layout.kind === "phone" ? (
        <View style={{ flex: 1, gap: 10 }}>
          <SegmentedControl<Stage> options={STAGES.map((s) => ({ value: s, label: `${STAGE_LABEL[s]} ${by[s].length}` }))} value={lane} onChange={setLane} label="Lane" />
          {laneList(lane, `lane-${lane}`)}
        </View>
      ) : (
        <View style={{ flex: 1, flexDirection: "row", gap: 12 }}>
          {STAGES.map((s) => (
            <View key={s} style={{ flex: 1, gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, borderBottomWidth: 2, borderBottomColor: c.border, paddingBottom: 6 }}>
                <Text variant="subheading">{STAGE_LABEL[s]}</Text>
                <Text variant="subheading" tone="muted" testID={`count-${s}`}>{by[s].length}</Text>
              </View>
              {laneList(s, `lane-${s}`)}
            </View>
          ))}
        </View>
      )}
      <ConfirmDialog
        visible={!!recall}
        title="Recall this order?"
        icon="history"
        message={recall ? `Order #${recall.order.orderNumber} goes back to Preparing, and the waiter's "ready" is taken back.` : ""}
        confirmLabel="Yes, recall"
        onConfirm={() => { if (recall) run(recall.order, recall.action); setRecall(null); }}
        onCancel={() => setRecall(null)}
      />
    </Screen>
  );
}
