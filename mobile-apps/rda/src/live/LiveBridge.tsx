import { useEffect } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import type { QueryKey } from "@tanstack/react-query";
import { keys } from "@/data/keys";
import { APP_ID, LIVE_URL } from "@/lib/config";
import { useRuntime, useSession } from "@/runtime";
import { createLiveConnection } from "./connection";
import { createRefresher } from "./refresher";

/** What to load again when the server says a kind of data changed. RDA listens for one thing: its deliveries (the server only tells a rider about changes that may touch the list). */
export function liveKeys(what: string): QueryKey[] {
  return what === "deliveries" ? [keys.deliveries] : [];
}
export const liveEverything = (): QueryKey[] => [keys.deliveries];

/** A rider's connection belongs to the rider, not to an outlet: the token says who they are and where they work. This is the name the refresher files its timings under. */
const SCOPE = "rider";

/**
 * Keeps ONE live connection open while a rider is signed in, and turns what the server says into a fresh list of deliveries.
 * It draws nothing. While it is connected the list never asks on a timer (see `useRefreshPlan`); if the server refuses live updates
 * the list asks on a timer again, exactly as before.
 */
export function LiveBridge() {
  const runtime = useRuntime();
  const signedIn = useSession((s) => s.status === "signed-in");

  useEffect(() => {
    if (!signedIn) return;
    const refresher = createRefresher(runtime.queryClient, (what) => liveKeys(what), () => liveEverything());
    const connection = createLiveConnection({
      url: () => `${LIVE_URL}?app=${APP_ID}`,
      headers: (): Record<string, string> => {
        const token = runtime.session.getState().token;
        return token ? { authorization: `Bearer ${token}` } : {};
      },
      onChange: (what) => refresher.changed(what, SCOPE),
      onResync: () => refresher.resync(SCOPE),
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
  }, [signedIn, runtime]);

  return null;
}
