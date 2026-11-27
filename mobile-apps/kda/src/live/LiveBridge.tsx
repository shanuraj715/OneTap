import { useEffect } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import type { QueryKey } from "@tanstack/react-query";
import { keys } from "@/data/keys";
import { APP_ID, LIVE_URL } from "@/lib/config";
import { useRuntime, useSession } from "@/runtime";
import { createLiveConnection } from "./connection";
import { createRefresher } from "./refresher";

/**
 * What to load again when the server says a kind of data changed. KDA listens for orders (the board — every screen of it — and today's
 * numbers; a counted dish runs down as orders come in, so the dishes list too) and for the menu (the dishes list).
 */
export function liveKeys(what: string, outletId: string): QueryKey[] {
  switch (what) {
    case "orders": return [["board", outletId], keys.summary(outletId), keys.items(outletId)];
    case "menu": return [keys.items(outletId)];
    default: return [];
  }
}
export const liveEverything = (outletId: string): QueryKey[] => [["board", outletId], keys.items(outletId), keys.summary(outletId)];

/**
 * Keeps ONE live connection open while a person is signed in to an outlet, and turns what the server says into fresh lists.
 * It draws nothing. While it is connected the lists never ask on a timer (see `useRefreshPlan`); if the server refuses live updates
 * the lists ask on a timer again, exactly as before.
 */
export function LiveBridge() {
  const runtime = useRuntime();
  const signedIn = useSession((s) => s.status === "signed-in");
  const outletId = useSession((s) => s.outletId) ?? "";

  useEffect(() => {
    if (!signedIn || !outletId) return;
    const refresher = createRefresher(runtime.queryClient, liveKeys, liveEverything);
    const connection = createLiveConnection({
      url: () => `${LIVE_URL}?app=${APP_ID}&outletId=${encodeURIComponent(outletId)}`,
      headers: (): Record<string, string> => {
        const token = runtime.session.getState().token;
        return token ? { authorization: `Bearer ${token}` } : {};
      },
      onChange: (what) => refresher.changed(what, outletId),
      onResync: () => refresher.resync(outletId),
      onStatus: (status) => runtime.live.getState().set(status),
    });
    connection.start();
    // back in front, or the internet is back: don't wait out a pause
    const app = AppState.addEventListener("change", (next) => { if (next === "active") connection.wake(); });
    let first = true; // the listener reports the current state straight away: that is not news
    const net = NetInfo.addEventListener((state) => {
      if (first) { first = false; return; }
      if (state.isConnected !== false) connection.wake();
    });
    return () => {
      app.remove();
      net();
      connection.stop();
      refresher.stop();
    };
  }, [signedIn, outletId, runtime]);

  return null;
}
