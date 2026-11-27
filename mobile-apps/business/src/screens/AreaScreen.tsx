import type { ComponentType } from "react";
import { areasFor } from "@/lib/access";
import { useOptions } from "@/data/queries";
import { useMe } from "@/runtime";
import { Bookings } from "./Bookings";
import { Coupons } from "./Coupons";
import { Customers } from "./Customers";
import { Dishes } from "./Dishes";
import { Home } from "./Home";
import { Money } from "./Money";
import { More } from "./More";
import { NoAccess } from "./NoAccess";
import { Outlets } from "./Outlets";
import { Ratings } from "./Ratings";
import { Reports } from "./Reports";
import { Sales } from "./Sales";
import { Staff } from "./Staff";
import { Stock } from "./Stock";

/** Which screen each area opens. (More screens are added here as they are built.) */
export const SCREENS: Record<string, ComponentType> = { home: Home, sales: Sales, money: Money, dishes: Dishes, customers: Customers, outlets: Outlets, bookings: Bookings, coupons: Coupons, stock: Stock, ratings: Ratings, reports: Reports, staff: Staff, more: More };

/** The one place that decides whether this person may open this area (the server decides what they may DO in it). */
export function AreaScreen({ id }: { id: string }) {
  const me = useMe();
  const options = useOptions();
  const Screen = SCREENS[id];
  const allowed = id === "more" || areasFor(me, options.data?.features ?? null).some((a) => a.id === id);
  if (!Screen || !allowed) return <NoAccess />;
  return <Screen />;
}
