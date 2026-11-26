import { useEffect, useMemo, useState } from "react";
import { BackHandler, FlatList, View } from "react-native";
import { groupByStore, outletCount, type StoreGroup } from "@/lib/stores";
import type { Outlet } from "@/api/schemas";
import { useRuntime, useSession } from "@/runtime";
import { Button, Card, EmptyState, Icon, IconTile, Screen, ScreenTitle, Text, TextField, useTheme } from "@/ui";

/** A long list gets a search box. */
const SEARCH_FROM = 8;

/**
 * For the platform admin only: which store, then which outlet. Asked every time they sign in (or open the app with a kept sign-in),
 * even when there is only one store with one outlet: nothing is picked for them. Everyone else goes straight to their own outlet.
 */
export function ChooseStoreScreen() {
  const { c } = useTheme();
  const { session } = useRuntime();
  const user = useSession((s) => s.user);
  const outlets = useSession((s) => s.outlets);
  const stores = useMemo(() => groupByStore(outlets), [outlets]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const store = stores.find((s) => s.id === storeId) ?? null;

  const open = (id: string | null) => { setStoreId(id); setQuery(""); };
  // the phone's Back button goes from the outlets back to the stores
  useEffect(() => {
    if (!store) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { open(null); return true; });
    return () => sub.remove();
  }, [store]);

  const q = query.trim().toLowerCase();
  const rows: (StoreGroup | Outlet)[] = store ? store.outlets : stores;
  const shown = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
  const searchable = rows.length >= SEARCH_FROM;

  const header = (
    <View style={{ gap: 12, paddingBottom: 12 }}>
      <ScreenTitle icon={store ? "pin" : "store"} title={store ? store.name : "Choose a store"} />
      <Text tone="muted">
        {store
          ? `Which outlet of ${store.name} do you want to work in?`
          : `You are signed in as ${user?.name ?? "the platform admin"}. Pick the store you want to work in.`}
      </Text>
      {store ? <Button title="All stores" icon="chevron-left" variant="ghost" size="sm" onPress={() => open(null)} testID="back-to-stores" /> : null}
      {searchable ? (
        <TextField label={store ? "Find an outlet" : "Find a store"} hideLabel leftIcon="search" placeholder={store ? "Find an outlet" : "Find a store"} value={query} onChangeText={setQuery} onClear={() => setQuery("")} autoCapitalize="none" autoCorrect={false} />
      ) : null}
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={shown}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState icon="search" title={q ? "Nothing matches" : "Nothing here"} message={q ? `No ${store ? "outlet" : "store"} has “${query.trim()}” in its name.` : "There are no outlets to work in."} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const isStore = "outlets" in item;
          return (
            <Card
              testID={isStore ? `store-${item.id}` : `outlet-${item.id}`}
              label={isStore ? `${item.name}, ${outletCount(item.outlets.length)}` : `${item.name}`}
              onPress={() => (isStore ? open(item.id) : void session.getState().selectOutlet(item.id))}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <IconTile icon={isStore ? "store" : "pin"} tone={isStore ? "primary" : "info"} />
                <View style={{ flex: 1 }}>
                  <Text variant="subheading" numberOfLines={2}>{item.name}</Text>
                  <Text variant="caption" tone="muted">{isStore ? outletCount(item.outlets.length) : `/${item.slug}`}</Text>
                </View>
                <Icon name="chevron-right" size={20} color={c.muted} />
              </View>
            </Card>
          );
        }}
        style={{ flex: 1 }}
      />
      <Button title="Sign out" icon="logout" variant="ghost" fullWidth onPress={() => void session.getState().signOut()} testID="choose-sign-out" />
    </Screen>
  );
}
