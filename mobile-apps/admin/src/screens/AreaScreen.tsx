import type { ComponentType } from "react";
import { APP_AREAS, areasFor } from "@/lib/access";
import { useMe } from "@/runtime";
import { AppManagement } from "./AppManagement";
import { Dashboard } from "./Dashboard";
import { Cache } from "./Cache";
import { Leads } from "./Leads";
import { More } from "./More";
import { Onboarding } from "./Onboarding";
import { Plans } from "./Plans";
import { Security } from "./Security";
import { Server } from "./Server";
import { Settings } from "./Settings";
import { Stores } from "./Stores";
import { Team } from "./Team";
import { NoAccess } from "./NoAccess";

/** Which screen each area of the console opens (the ones the app has). */
export const SCREENS: Record<string, ComponentType> = { dashboard: Dashboard, "app-management": AppManagement, stores: Stores, leads: Leads, onboarding: Onboarding, plans: Plans, server: Server, security: Security, cache: Cache, settings: Settings, team: Team, more: More };

/** The one place that decides whether this person may open this area (the server decides what they may DO in it). */
export function AreaScreen({ id }: { id: string }) {
  const me = useMe();
  const Screen = SCREENS[id];
  const allowed = id === "more" || (APP_AREAS.has(id) && areasFor(me).some((a) => a.id === id));
  if (!Screen || !allowed) return <NoAccess />;
  return <Screen />;
}
