import { View } from "react-native";
import { Slot, router, usePathname } from "expo-router";
import { areasFor } from "@/lib/access";
import { useOptions, useOutlets } from "@/data/queries";
import { areaOfPath, litTab, needsMore } from "@/lib/nav";
import { useMe } from "@/runtime";
import { Rail, TabBar, useResponsive, type IconName } from "@/ui";

/**
 * The frame of the signed-in app: a side rail on a tablet, a floating glass bar on a phone — each shows ONLY the areas the person's role holds
 * and the store's plan includes (no Coupons for a store without coupons). The outlets and the plan's features are fetched here, once.
 */
export default function AppLayout() {
  const me = useMe();
  const { tablet } = useResponsive();
  useOutlets();
  const options = useOptions();
  const current = areaOfPath(usePathname());
  const areas = areasFor(me, options.data?.features ?? null);
  const items = areas.map((a) => ({ id: a.id, label: a.label, icon: a.icon as IconName }));
  const go = (id: string) => router.navigate(id === "more" ? "/more" : `/${id}`);
  const phoneItems = needsMore(items.length) ? [...items.slice(0, 3), { id: "more", label: "More", icon: "more" as IconName }] : [...items, { id: "more", label: "Account", icon: "user" as IconName }];
  const lit = litTab(phoneItems.map((i) => i.id), items.slice(3).map((i) => i.id), current);
  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      {tablet ? <Rail items={[...items, { id: "more", label: "Account", icon: "user" }]} current={current} onPick={go} /> : null}
      <View style={{ flex: 1 }}><Slot /></View>
      {!tablet ? <TabBar items={phoneItems} current={lit} onPick={go} /> : null}
    </View>
  );
}
