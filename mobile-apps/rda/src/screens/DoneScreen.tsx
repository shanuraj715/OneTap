import { FlatList, View } from "react-native";
import { useDeliveries } from "@/data/hooks";
import { bagText, distanceText } from "@/features/deliveries";
import { clock } from "@/lib/time";
import { Badge, Card, EmptyState, ErrorState, Icon, Screen, ScreenTitle, Skeleton, Text, useTheme } from "@/ui";

/** What this rider has delivered today (India time), newest first: a small proof of the day's work. */
export function DoneScreen() {
  const { c } = useTheme();
  const q = useDeliveries();
  const done = q.data?.deliveredToday ?? [];
  return (
    <Screen>
      <ScreenTitle icon="check-circle" title="Delivered today" right={done.length ? <Badge label={`${done.length} done`} tone="ok" icon="check" /> : null} />
      {q.isLoading ? (
        <View style={{ gap: 10 }}><Skeleton height={80} radius={14} /><Skeleton height={80} radius={14} /></View>
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} title="Can't load your deliveries" />
      ) : (
        <FlatList
          testID="done-list"
          data={done}
          keyExtractor={(d) => d.id}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
          ListEmptyComponent={<EmptyState icon="bike" title="Nothing delivered yet today" message="Each order you mark delivered is listed here." />}
          renderItem={({ item }) => (
            <Card testID={`done-${item.orderNumber}`} style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text variant="subheading">#{item.orderNumber}</Text>
                <View style={{ flex: 1 }} />
                {item.deliveredAt ? <Text variant="caption" tone="muted">{clock(item.deliveredAt)}</Text> : null}
              </View>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Icon name="pin" size={15} color={c.muted} />
                <Text style={{ flex: 1 }} tone="muted">{item.address.text}{distanceText(item.address.distanceKm) ? ` · ${distanceText(item.address.distanceKm)}` : ""}</Text>
              </View>
              <Text variant="caption" tone="muted">{bagText(item)}</Text>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}
