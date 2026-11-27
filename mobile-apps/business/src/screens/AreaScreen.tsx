import type { ComponentType } from "react";
import { areasFor } from "@/lib/access";
import { useOptions } from "@/data/queries";
import { useMe } from "@/runtime";
import { Home } from "./Home";
import { Money } from "./Money";
import { More } from "./More";
import { NoAccess } from "./NoAccess";
import { Sales } from "./Sales";

/** Which screen each area opens. (More screens are added here as they are built.) */
export const SCREENS: Record<string, ComponentType> = { home: Home, sales: Sales, money: Money, more: More };

/** The one place that decides whether this person may open this area (the server decides what they may DO in it). */
export function AreaScreen({ id }: { id: string }) {
  const me = useMe();
  const options = useOptions();
  const Screen = SCREENS[id];
  const allowed = id === "more" || areasFor(me, options.data?.features ?? null).some((a) => a.id === id);
  if (!Screen || !allowed) return <NoAccess />;
  return <Screen />;
}
