import { AppState, type AppStateStatus } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager } from "@tanstack/react-query";

/**
 * Tell the query library what the phone is doing, so it behaves like a good citizen:
 *  - the app goes to the background → the table board stops refreshing (no battery or data spent in a pocket);
 *  - the app comes back → everything refreshes at once, so the waiter never works from a stale board;
 *  - no internet → calls wait instead of failing one after another; they resume when the connection returns.
 * Called once, when the app starts. Returns a function that undoes it.
 */
export function wireQueryClient(): () => void {
  const onAppState = (status: AppStateStatus) => focusManager.setFocused(status === "active");
  const appSub = AppState.addEventListener("change", onAppState);
  onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)));
  return () => appSub.remove();
}
