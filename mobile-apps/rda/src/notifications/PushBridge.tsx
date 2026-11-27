import { useEffect } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { keys } from "@/data/keys";
import { useRuntime, useSession } from "@/runtime";
import { deliveryOf } from "./push";

// A notification that arrives while the app is open is still shown (with its sound): a new delivery should never go unnoticed.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

/**
 * While a rider is signed in: turns notifications on (the permission, the phone's token → the server), tries again when the app comes to the
 * front (the rider may have allowed them in the phone's settings meanwhile, or the internet was down), and opens the deliveries when a
 * notification is tapped. It draws nothing.
 */
export function PushBridge() {
  const runtime = useRuntime();
  const router = useRouter();
  const signedIn = useSession((s) => s.status === "signed-in");

  useEffect(() => {
    if (!signedIn) return;
    void runtime.push.enable();
    const app = AppState.addEventListener("change", (next) => {
      if (next === "active" && runtime.push.store.getState().status !== "on") void runtime.push.enable();
    });
    // a tap on a notification: look at the deliveries (fresh) — the new one is at the top of the first tab
    const open = (data: Record<string, unknown> | undefined) => {
      if (!deliveryOf(data)) return;
      void runtime.queryClient.invalidateQueries({ queryKey: keys.deliveries });
      router.navigate("/");
    };
    const tap = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data));
    // the app was closed and the tap opened it
    const first = Notifications.getLastNotificationResponse();
    if (first) open(first.notification.request.content.data);
    return () => { app.remove(); tap.remove(); };
  }, [signedIn, runtime, router]);

  return null;
}
