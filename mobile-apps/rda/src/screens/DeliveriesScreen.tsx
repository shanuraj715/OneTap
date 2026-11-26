import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, RefreshControl, Vibration, View } from "react-native";
import { useStore } from "zustand";
import type { Delivery } from "@/api/schemas";
import { useDeliver, useDeliveries, usePickUp } from "@/data/hooks";
import { arrivals, isCodeShape, sortDeliveries, STATUS_TEXT } from "@/features/deliveries";
import { arrivedMessage, openDirections, openLink, telUrl, whatsappUrl } from "@/features/maps";
import { useNow } from "@/lib/useNow";
import { useRuntime } from "@/runtime";
import { Badge, Banner, Button, EmptyState, ErrorState, IconButton, Screen, ScreenTitle, Sheet, Skeleton, Text, TextField, toasts, useTheme } from "@/ui";
import { DeliveryCard } from "./DeliveryCard";

const VIBRATION = [0, 350, 150, 350];

/**
 * The rider's list: the deliveries the manager has handed to them, on the way first. It refreshes every few seconds, tells the rider when a new
 * one arrives, and each card has what is needed on the road. "Delivered" asks for the customer's 4-digit code when the order has one.
 */
export function DeliveriesScreen() {
  const { settings } = useRuntime();
  const alerts = useStore(settings.store, (s) => s.alerts);
  const q = useDeliveries();
  const pickUp = usePickUp();
  const deliver = useDeliver();
  const { c } = useTheme();
  const now = useNow(30_000);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const [codeFor, setCodeFor] = useState<Delivery | null>(null);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;

  const list = q.data?.deliveries;
  useEffect(() => {
    if (!list) return;
    const arrived = arrivals(seen.current, list);
    seen.current = new Set([...(seen.current ?? []), ...list.map((d) => d.id)]);
    if (!arrived.length) return;
    setFresh((prev) => new Set([...prev, ...arrived.map((d) => d.id)]));
    if (alertsRef.current) {
      Vibration.vibrate(VIBRATION);
      toasts.info(arrived.length === 1 ? `New delivery #${arrived[0]!.orderNumber}` : `${arrived.length} new deliveries`);
    }
  }, [list]);

  const sorted = useMemo(() => sortDeliveries(list ?? []), [list]);
  const clearFresh = (id: string) => setFresh((prev) => { const next = new Set(prev); next.delete(id); return next; });

  const navigate = useCallback(async (d: Delivery) => { if (!(await openDirections(d.address, `Order ${d.orderNumber}`))) toasts.warn("Couldn't open a maps app. Install Google Maps, or read the address on the card."); }, []);
  const call = useCallback(async (d: Delivery) => { if (!(await openLink(telUrl(d.customer.phone)))) toasts.warn("Couldn't start the call."); }, []);
  const whatsapp = useCallback(async (d: Delivery) => {
    const url = whatsappUrl(d.customer.phone, arrivedMessage(d.customer.name, d.orderNumber));
    if (!url) toasts.warn("This customer has no WhatsApp number.");
    else if (!(await openLink(url))) toasts.warn("Couldn't open WhatsApp.");
  }, []);

  const action = useCallback((d: Delivery) => {
    clearFresh(d.id);
    if (d.status === "ready") {
      setBusyId(d.id);
      pickUp.mutate(d.id, {
        onSuccess: () => toasts.ok(`#${d.orderNumber} is on its way to the customer`),
        onError: (e) => toasts.error(e instanceof Error ? e.message : "Couldn't update the delivery. Try again."),
        onSettled: () => setBusyId(null),
      });
    } else if (d.needsCode) {
      setCode("");
      setCodeError(null);
      setCodeFor(d);
    } else {
      finish(d);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function finish(d: Delivery, typed?: string) {
    setBusyId(d.id);
    deliver.mutate({ id: d.id, code: typed }, {
      onSuccess: () => { setCodeFor(null); toasts.ok(`#${d.orderNumber} delivered`); },
      onError: (e) => {
        const message = e instanceof Error ? e.message : "Couldn't update the delivery. Try again.";
        if (typed !== undefined) setCodeError(message); else toasts.error(message);
      },
      onSettled: () => setBusyId(null),
    });
  }
  const confirmCode = () => {
    if (!codeFor) return;
    if (!isCodeShape(code)) { setCodeError("The code is 4 digits."); return; }
    finish(codeFor, code.trim());
  };

  const header = (
    <View style={{ gap: 10, paddingBottom: 10 }}>
      <ScreenTitle
        icon="bike"
        title="Deliveries"
        right={
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {sorted.length ? <Badge label={`${sorted.length} to do`} tone="info" icon="bag" /> : null}
            <IconButton icon="bell" label={alerts ? "New-delivery alert is on. Turn it off" : "New-delivery alert is off. Turn it on"} onPress={() => void settings.set({ alerts: !alerts })} testID="alert-toggle" />
          </View>
        }
      />
      {q.isError && q.data ? <Banner tone="warn" message="Can't refresh. Showing the last list." testID="stale-banner" /> : null}
    </View>
  );

  if (q.isLoading) return <Screen>{header}<View style={{ gap: 12 }}><Skeleton height={220} radius={16} /><Skeleton height={220} radius={16} /></View></Screen>;
  if (q.error && !q.data) return <Screen>{header}<ErrorState error={q.error} onRetry={() => void q.refetch()} title="Can't load your deliveries" /></Screen>;

  return (
    <Screen padded={false} style={{ paddingHorizontal: 12, paddingTop: 12 }}>
      <FlatList
        testID="delivery-list"
        data={sorted}
        keyExtractor={(d) => d.id}
        ListHeaderComponent={header}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={{ paddingBottom: 28, flexGrow: 1, maxWidth: 720, width: "100%", alignSelf: "center" }}
        refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isLoading} onRefresh={() => void q.refetch()} colors={[c.primary]} />}
        ListEmptyComponent={<EmptyState icon="bike" title="No deliveries right now" message="When the manager hands you an order it shows here, and the phone buzzes." />}
        renderItem={({ item }) => <DeliveryCard delivery={item} now={now} busy={busyId === item.id} fresh={fresh.has(item.id)} onNavigate={navigate} onCall={call} onWhatsApp={whatsapp} onAction={action} />}
      />

      <Sheet visible={!!codeFor} onClose={() => setCodeFor(null)} title={codeFor ? `Deliver #${codeFor.orderNumber}` : ""} testID="code-sheet">
        <View style={{ gap: 12 }}>
          <Text tone="muted">Ask the customer for the 4-digit delivery code on their order page, and type it here. It proves the food reached them.</Text>
          <TextField label="Delivery code" value={code} onChangeText={(t) => { setCode(t.replace(/\D/g, "").slice(0, 4)); setCodeError(null); }} keyboardType="number-pad" error={codeError} autoFocus testID="code-input" />
          <Button title="Confirm delivered" icon="check-circle" size="lg" fullWidth loading={busyId === codeFor?.id} onPress={confirmCode} testID="code-confirm" />
          <Text variant="caption" tone="muted">If the customer can&apos;t give the code, call the store: they can mark the order delivered. ({codeFor ? STATUS_TEXT[codeFor.status] : ""})</Text>
        </View>
      </Sheet>
    </Screen>
  );
}
