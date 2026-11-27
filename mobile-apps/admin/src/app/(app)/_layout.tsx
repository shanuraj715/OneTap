import { View } from "react-native";
import { Slot, router, usePathname } from "expo-router";
import { areasFor, APP_AREAS } from "@/lib/access";
import { areaOfPath, litTab, needsMore } from "@/lib/nav";
import { useMe } from "@/runtime";
import { Rail, TabBar, useResponsive, type IconName } from "@/ui";

/** The frame of the signed-in app: a side rail on a tablet, a floating glass bar on a phone — each shows ONLY the areas the person's role holds. */
export default function AppLayout() {
  const me = useMe();
  const { tablet } = useResponsive();
  const current = areaOfPath(usePathname());
  const areas = areasFor(me).filter((a) => APP_AREAS.has(a.id));
  const items = areas.map((a) => ({ id: a.id, label: a.label.replace("App Management", "Apps").replace("Team & roles", "Team"), icon: a.id as IconName }));
  const go = (id: string) => router.navigate(id === "more" ? "/more" : `/${id}`);
  const phoneItems = needsMore(items.length) ? [...items.slice(0, 3), { id: "more", label: "More", icon: "more" as IconName }] : [...items, { id: "more", label: "Account", icon: "user" as IconName }];
  // detail screens (a store …) keep the area they belong to lit; an area that lives under "More" lights "More"
  const lit = litTab(phoneItems.map((i) => i.id), items.slice(3).map((i) => i.id), current);
  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      {tablet ? <Rail items={[...items, { id: "more", label: "Account", icon: "user" }]} current={current} onPick={go} /> : null}
      <View style={{ flex: 1 }}><Slot /></View>
      {!tablet ? <TabBar items={phoneItems} current={lit} onPick={go} /> : null}
    </View>
  );
}
