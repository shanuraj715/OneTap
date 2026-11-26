import { useMemo } from "react";
import { FlatList, View } from "react-native";
import { useBoard } from "@/data/hooks";
import { prepList } from "@/features/board";
import { Card, EmptyState, ErrorState, Screen, ScreenTitle, Skeleton, Text, Badge } from "@/ui";

/** What to cook right now, added up over every order that is not ready yet: make a batch instead of ticket by ticket. */
export function PrepScreen() {
  const board = useBoard("all");
  const rows = useMemo(() => prepList(board.data?.orders ?? []), [board.data]);
  const total = rows.reduce((n, r) => n + r.quantity, 0);
  return (
    <Screen>
      <ScreenTitle icon="list" title="Prep list" right={total ? <Badge label={`${total} to make`} tone="info" icon="flame" /> : null} />
      <Text tone="muted">Everything on the board that isn&apos;t ready yet, added up. Same dish, same size and add-ons is one line.</Text>
      {board.isLoading ? (
        <View style={{ gap: 10 }}><Skeleton height={64} radius={14} /><Skeleton height={64} radius={14} /></View>
      ) : board.error && !board.data ? (
        <ErrorState error={board.error} onRetry={() => void board.refetch()} title="Can't load the board" />
      ) : (
        <FlatList
          testID="prep-list"
          data={rows}
          keyExtractor={(r) => r.key}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
          ListEmptyComponent={<EmptyState icon="check-circle" title="Nothing to prepare" message="Every order is ready, or none has come in." />}
          renderItem={({ item }) => (
            <Card testID={`prep-${item.name}`} style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <Text variant="title" style={{ minWidth: 56 }}>{item.quantity}×</Text>
              <View style={{ flex: 1 }}>
                <Text variant="subheading">{item.name}</Text>
                {item.detail ? <Text variant="caption" tone="muted">{item.detail}</Text> : null}
              </View>
              <Text variant="caption" tone="muted">{item.orders} {item.orders === 1 ? "order" : "orders"}</Text>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}
