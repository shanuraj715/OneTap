import { createStore } from "zustand/vanilla";
import type * as ExpoNotifications from "expo-notifications";

/** The notification channel the server names in every delivery message (see apps/api/src/modules/riders/rider-push.ts → DELIVERY_CHANNEL). */
export const DELIVERY_CHANNEL = "deliveries";
/** What the server's message says it is about (its `data.type`). */
export const DELIVERY_ASSIGNED = "delivery.assigned";

/**
 * Where notifications stand on this phone:
 *  - "unknown"     not asked yet (or signed out);
 *  - "on"          allowed, and the server knows this phone — a new delivery arrives even with the app closed;
 *  - "denied"      the rider said no, or switched notifications off in the phone's settings;
 *  - "unavailable" this build can't get a device token (it was made without the Firebase file — see the README), or the phone has no Google services;
 *  - "failed"      allowed and a token exists, but the server couldn't be told (no internet) — tried again next time the app is in front.
 */
export type PushStatus = "unknown" | "on" | "denied" | "unavailable" | "failed";
export interface PushState { status: PushStatus; token: string | null }

/** The few parts of expo-notifications this uses (so a test can hand in a stand-in). */
export type NotificationsModule = Pick<typeof ExpoNotifications, "setNotificationChannelAsync" | "getPermissionsAsync" | "requestPermissionsAsync" | "getDevicePushTokenAsync" | "addPushTokenListener" | "AndroidImportance">;

export interface PushDeps {
  notifications: NotificationsModule;
  /** tell the server "send this rider's notifications to this device token" */
  register(token: string): Promise<unknown>;
  /** tell it to stop (signing out) */
  unregister(token: string): Promise<unknown>;
}

/**
 * Notifications for new deliveries when the app is closed or minimised. The phone's Firebase token is sent to the server; when the manager
 * hands the rider a delivery the server asks Google to wake this phone, and Android draws the notification itself — the app need not be running.
 *
 *  - `enable()` after sign-in (and again whenever the app comes to the front): the loud channel, the permission, the token, the server. Safe to call often.
 *  - `disable()` when signing out: the server stops using this phone for this rider.
 */
export function createPush(deps: PushDeps) {
  const store = createStore<PushState>()(() => ({ status: "unknown", token: null }));
  let listener: { remove(): void } | null = null;
  let running: Promise<PushStatus> | null = null;

  async function registerWithServer(token: string): Promise<boolean> {
    try { await deps.register(token); return true; } catch { return false; }
  }

  async function run(): Promise<PushStatus> {
    const n = deps.notifications;
    // the channel first: a notification that arrives before the rider ever opened the app again still needs somewhere loud to go
    try {
      await n.setNotificationChannelAsync(DELIVERY_CHANNEL, { name: "New deliveries", importance: n.AndroidImportance.MAX, vibrationPattern: [0, 300, 200, 300], sound: "default", enableVibrate: true, showBadge: false });
    } catch { /* the channel is a nicety: keep going */ }

    let perm = await n.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) perm = await n.requestPermissionsAsync();
    if (!perm.granted) { store.setState({ status: "denied" }); return "denied"; }

    let token: string;
    try {
      const got = await n.getDevicePushTokenAsync();
      token = String(got.data ?? "");
      if (!token) throw new Error("no token");
    } catch {
      store.setState({ status: "unavailable" });
      return "unavailable";
    }
    // Google hands the phone a NEW token now and then: tell the server each time
    listener ??= n.addPushTokenListener((t) => { const next = String(t.data ?? ""); if (next) { store.setState({ token: next }); void registerWithServer(next); } });
    const told = await registerWithServer(token);
    store.setState({ status: told ? "on" : "failed", token });
    return told ? "on" : "failed";
  }

  return {
    store,
    enable(): Promise<PushStatus> {
      running ??= run().finally(() => { running = null; });
      return running;
    },
    async disable(): Promise<void> {
      listener?.remove();
      listener = null;
      const { token } = store.getState();
      store.setState({ status: "unknown", token: null });
      if (token) await deps.unregister(token).catch(() => undefined);
    },
  };
}
export type Push = ReturnType<typeof createPush>;

/** The delivery a tapped notification is about (its `data`), or null when it is about something else. */
export function deliveryOf(data: Record<string, unknown> | null | undefined): { orderId: string } | null {
  if (!data || data.type !== DELIVERY_ASSIGNED) return null;
  return typeof data.orderId === "string" && data.orderId ? { orderId: data.orderId } : null;
}
