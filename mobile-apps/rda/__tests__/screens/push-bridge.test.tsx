import { AppState, Linking, type AppStateStatus } from "react-native";
import * as Notifications from "expo-notifications";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { AccountScreen } from "@/screens/AccountScreen";
import { PushBridge } from "@/notifications/PushBridge";
import { fakeServer, renderApp } from "../../test/harness";

const mockNavigate = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ navigate: mockNavigate }) }));
const N = Notifications as unknown as { [K in keyof typeof Notifications]: jest.Mock };
const TOKEN = "device-token-0123456789-abcdefghij";
const deliveryTap = (data: Record<string, unknown>) => ({ notification: { request: { content: { data } } } });

beforeEach(() => {
  mockNavigate.mockClear();
  N.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true, status: "granted" } as never);
  N.requestPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true, status: "granted" } as never);
  N.getDevicePushTokenAsync.mockResolvedValue({ type: "android", data: TOKEN } as never);
  N.getLastNotificationResponse.mockReturnValue(null as never);
});

describe("the push bridge: notifications while a rider is signed in", () => {
  it("turns notifications on when signed in: the server is told this phone's token", async () => {
    const { server, runtime } = await renderApp(<PushBridge />);
    await waitFor(() => expect(server.to("PUT", "/api/rider/push-token")).toHaveLength(1));
    expect(server.to("PUT", "/api/rider/push-token")[0]!.body).toEqual({ token: TOKEN });
    expect(server.to("PUT", "/api/rider/push-token")[0]!.headers.authorization).toMatch(/^Bearer /);   // as THIS rider
    await waitFor(() => expect(runtime.push.store.getState().status).toBe("on"));
  });

  it("does nothing while nobody is signed in", async () => {
    const { server } = await renderApp(<PushBridge />, { signedIn: false });
    await act(async () => { await Promise.resolve(); });
    expect(server.to("PUT", "/api/rider/push-token")).toHaveLength(0);
    expect(N.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("when the app comes back to the front and it is not 'on' yet, it tries again; when it IS on, it leaves it alone", async () => {
    // (the phone's app-state listener is already a stand-in in the tests: read what the bridge gave it)
    const add = AppState.addEventListener as unknown as jest.Mock;
    expect(jest.isMockFunction(add)).toBe(true);
    add.mockClear();
    N.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false, status: "denied" } as never);   // the rider had blocked them…
    const { server, runtime } = await renderApp(<PushBridge />);
    await waitFor(() => expect(runtime.push.store.getState().status).toBe("denied"));
    expect(server.to("PUT", "/api/rider/push-token")).toHaveLength(0);
    const onChange = add.mock.calls.at(-1)![1] as (s: AppStateStatus) => void;
    N.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true, status: "granted" } as never);   // …then allowed them in the phone's settings
    await act(async () => { onChange("active"); });
    await waitFor(() => expect(runtime.push.store.getState().status).toBe("on"));
    expect(server.to("PUT", "/api/rider/push-token")).toHaveLength(1);
    await act(async () => { onChange("active"); });
    await act(async () => { await Promise.resolve(); });
    expect(server.to("PUT", "/api/rider/push-token")).toHaveLength(1);                                          // already on: not asked again
  });

  it("a tap on a 'new delivery' notification opens the deliveries and loads them fresh", async () => {
    const { runtime } = await renderApp(<PushBridge />);
    const invalidate = jest.spyOn(runtime.queryClient, "invalidateQueries");
    const onTap = N.addNotificationResponseReceivedListener.mock.calls.at(-1)![0] as (r: unknown) => void;
    await act(async () => onTap(deliveryTap({ type: "delivery.assigned", orderId: "abc123", orderNumber: "0006" })));
    expect(mockNavigate).toHaveBeenCalledWith("/");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["deliveries"] });
  });

  it("a tap on any other notification does nothing", async () => {
    await renderApp(<PushBridge />);
    const onTap = N.addNotificationResponseReceivedListener.mock.calls.at(-1)![0] as (r: unknown) => void;
    await act(async () => onTap(deliveryTap({ type: "promo" })));
    await act(async () => onTap(deliveryTap({})));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("the app was closed and a tap on the notification opened it: the same", async () => {
    N.getLastNotificationResponse.mockReturnValue(deliveryTap({ type: "delivery.assigned", orderId: "abc123" }) as never);
    await renderApp(<PushBridge />);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/"));
  });

  it("a notification that arrives while the app is open is still shown, with its sound", async () => {
    const handler = N.setNotificationHandler.mock.calls[0]![0] as { handleNotification: () => Promise<Record<string, boolean>> };
    await expect(handler.handleNotification()).resolves.toMatchObject({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true });
  });
});

describe("the Account page: notifications", () => {
  const open = (more: Record<string, unknown> = {}) => renderApp(<><PushBridge /><AccountScreen /></>, { server: fakeServer(more as never) });

  it("on: says a delivery reaches the rider even with the app closed", async () => {
    await open();
    await waitFor(() => expect(screen.getByTestId("notifications-status")).toHaveTextContent(/On\. A new delivery reaches you even when the app is closed/));
    expect(screen.queryByTestId("notifications-settings")).toBeNull();
    expect(screen.queryByTestId("notifications-turn-on")).toBeNull();
  });

  it("blocked by the rider: says so and offers the phone's settings", async () => {
    N.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false, status: "denied" } as never);
    const open_ = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined as never);
    await open();
    expect(await screen.findByText(/Blocked\. Allow notifications for this app in your phone's settings/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("notifications-settings"));
    expect(open_).toHaveBeenCalled();
    open_.mockRestore();
  });

  it("a build without Firebase: says it isn't available (and that WhatsApp and the open app still tell them)", async () => {
    N.getDevicePushTokenAsync.mockRejectedValue(new Error("Default FirebaseApp is not initialized") as never);
    await open();
    expect(await screen.findByText(/Not available on this phone or build/)).toBeOnTheScreen();
  });

  it("the server couldn't be told: says so, and 'Turn on' tries again", async () => {
    const server = fakeServer({ "PUT /api/rider/push-token": { status: 500, json: { error: "The server had a problem." } } });
    await renderApp(<><PushBridge /><AccountScreen /></>, { server });
    expect(await screen.findByText(/Allowed, but the server could not be told/)).toBeOnTheScreen();
    server.set("PUT /api/rider/push-token", { status: 204 });
    await fireEvent.press(screen.getByTestId("notifications-turn-on"));
    await waitFor(() => expect(screen.getByTestId("notifications-status")).toHaveTextContent(/^On\./));
  });

  it("signing out first tells the server to stop using this phone — then signs out", async () => {
    const { server } = await open();
    await waitFor(() => expect(screen.getByTestId("notifications-status")).toHaveTextContent(/^On\./));
    await fireEvent.press(screen.getByTestId("sign-out"));
    await fireEvent.press(await screen.findByRole("button", { name: "Yes, sign out" }));
    await waitFor(() => expect(server.to("POST", "/api/rider/logout")).toHaveLength(1));
    const order = server.calls.map((c) => `${c.method} ${c.path}`).filter((c) => /push-token|logout/.test(c));
    expect(order).toEqual(["PUT /api/rider/push-token", "DELETE /api/rider/push-token", "POST /api/rider/logout"]);   // the phone is taken off BEFORE the sign-in ends
    expect(server.to("DELETE", "/api/rider/push-token")[0]!.body).toEqual({ token: TOKEN });
    expect(server.to("DELETE", "/api/rider/push-token")[0]!.headers.authorization).toMatch(/^Bearer /);
  });
});
