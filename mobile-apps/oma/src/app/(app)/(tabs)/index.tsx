import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLayout } from "@/lib/layout";
import { EmptyState, useTheme } from "@/ui";
import { TableDetail } from "@/screens/TableDetail";
import { TablesScreen } from "@/screens/TablesScreen";

/** The floor. On a phone, a table opens on its own page; on a wide tablet the list stays on the left and the table shows on the right. */
export default function TablesRoute() {
  const router = useRouter();
  const layout = useLayout();
  const { c } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const takeOrder = (id: string) => router.push(`/take-order/${id}`);

  if (!layout.split) return <TablesScreen onOpenTable={(id) => router.push(`/table/${id}`)} />;
  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      <View style={{ flex: 1 }}><TablesScreen onOpenTable={setSelected} selectedId={selected} /></View>
      <SafeAreaView edges={["top", "right"]} style={{ width: layout.sidePanelWidth, borderLeftWidth: 1, borderLeftColor: c.border, backgroundColor: c.bg }}>
        {selected ? <TableDetail key={selected} tableId={selected} onTakeOrder={takeOrder} /> : <EmptyState icon="table" title="Pick a table" message="Its orders and actions show here." />}
      </SafeAreaView>
    </View>
  );
}
