import { DELIVERY_ASSIGNED, DELIVERY_CHANNEL, createPush, deliveryOf, type NotificationsModule } from "@/notifications/push";

const TOKEN = "device-token-0123456789-abcdefghij";
/** a pretend phone: what the permission says, what Google hands out, and what the app asked for */
function phone(opts: { granted?: boolean; canAskAgain?: boolean; grantsWhenAsked?: boolean; token?: string | Error; channelFails?: boolean } = {}) {
  const state = { granted: opts.granted ?? true, canAskAgain: opts.canAskAgain ?? true };
  const tokenListeners: Array<(t: { type: string; data: string }) => void> = [];
  const removed = jest.fn();
  const n = {
    AndroidImportance: { MAX: 5, HIGH: 4 },
    setNotificationChannelAsync: jest.fn(async () => { if (opts.channelFails) throw new Error("no channel"); return null; }),
    getPermissionsAsync: jest.fn(async () => ({ granted: state.granted, canAskAgain: state.canAskAgain })),
    requestPermissionsAsync: jest.fn(async () => { if (opts.grantsWhenAsked !== false) state.granted = true; else state.canAskAgain = false; return { granted: state.granted, canAskAgain: state.canAskAgain }; }),
    getDevicePushTokenAsync: jest.fn(async () => { if (opts.token instanceof Error) throw opts.token; return { type: "android", data: opts.token ?? TOKEN }; }),
    addPushTokenListener: jest.fn((fn: (t: { type: string; data: string }) => void) => { tokenListeners.push(fn); return { remove: removed }; }),
  };
  return { n: n as unknown as NotificationsModule, calls: n, newToken: (t: string) => tokenListeners.forEach((f) => f({ type: "android", data: t })), removed };
}
const make = (p: ReturnType<typeof phone>, over: { register?: jest.Mock; unregister?: jest.Mock } = {}) => {
  const register = over.register ?? jest.fn(async () => undefined);
  const unregister = over.unregister ?? jest.fn(async () => undefined);
  return { push: createPush({ notifications: p.n, register, unregister }), register, unregister };
};

describe("turning notifications on", () => {
  it("makes the loud channel, asks to be allowed, takes the phone's token, tells the server — and says it is on", async () => {
    const p = phone({ granted: false });
    const { push, register } = make(p);
    expect(push.store.getState()).toEqual({ status: "unknown", token: null });
    await expect(push.enable()).resolves.toBe("on");
    expect(p.calls.setNotificationChannelAsync).toHaveBeenCalledWith(DELIVERY_CHANNEL, expect.objectContaining({ name: "New deliveries", importance: 5, sound: "default", enableVibrate: true }));
    expect(p.calls.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith(TOKEN);
    expect(push.store.getState()).toEqual({ status: "on", token: TOKEN });
  });

  it("when the phone already allows them it does not ask again", async () => {
    const p = phone({ granted: true });
    await make(p).push.enable();
    expect(p.calls.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("the channel name is the one the server puts in every message", () => expect(DELIVERY_CHANNEL).toBe("deliveries"));

  it("the rider says no: 'denied', no token is asked for, the server is not told", async () => {
    const p = phone({ granted: false, grantsWhenAsked: false });
    const { push, register } = make(p);
    await expect(push.enable()).resolves.toBe("denied");
    expect(p.calls.getDevicePushTokenAsync).not.toHaveBeenCalled();
    expect(register).not.toHaveBeenCalled();
    expect(push.store.getState().status).toBe("denied");
  });

  it("switched off in the phone's settings (it won't ask again): 'denied' without a pop-up", async () => {
    const p = phone({ granted: false, canAskAgain: false });
    const { push } = make(p);
    await expect(push.enable()).resolves.toBe("denied");
    expect(p.calls.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("a build or phone that can't get a token (no Firebase): 'unavailable' — and nothing crashes", async () => {
    const p = phone({ token: new Error("Default FirebaseApp is not initialized") });
    const { push, register } = make(p);
    await expect(push.enable()).resolves.toBe("unavailable");
    expect(register).not.toHaveBeenCalled();
    expect(push.store.getState()).toEqual({ status: "unavailable", token: null });
  });

  it("an empty token counts as unavailable too", async () => {
    const p = phone({ token: "" });
    await expect(make(p).push.enable()).resolves.toBe("unavailable");
  });

  it("the server can't be reached: 'failed' (the token is kept to try again), and the next enable() tries again", async () => {
    const register = jest.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const { push } = make(phone(), { register });
    await expect(push.enable()).resolves.toBe("failed");
    expect(push.store.getState()).toEqual({ status: "failed", token: TOKEN });
    await expect(push.enable()).resolves.toBe("on");
    expect(register).toHaveBeenCalledTimes(2);
  });

  it("a channel that can't be made does not stop the rest", async () => {
    await expect(make(phone({ channelFails: true })).push.enable()).resolves.toBe("on");
  });

  it("asking twice at once does the work once; asking again later re-registers without a second listener", async () => {
    const p = phone();
    const { push, register } = make(p);
    await Promise.all([push.enable(), push.enable(), push.enable()]);
    expect(register).toHaveBeenCalledTimes(1);
    await push.enable();
    expect(register).toHaveBeenCalledTimes(2);
    expect(p.calls.addPushTokenListener).toHaveBeenCalledTimes(1);
  });

  it("when Google gives the phone a NEW token, the server is told", async () => {
    const p = phone();
    const { push, register } = make(p);
    await push.enable();
    p.newToken("a-brand-new-device-token-0123456789");
    await Promise.resolve();
    expect(register).toHaveBeenLastCalledWith("a-brand-new-device-token-0123456789");
    expect(push.store.getState().token).toBe("a-brand-new-device-token-0123456789");
  });
});

describe("signing out", () => {
  it("tells the server to stop using this phone, stops listening, and goes back to 'unknown'", async () => {
    const p = phone();
    const { push, unregister } = make(p);
    await push.enable();
    await push.disable();
    expect(unregister).toHaveBeenCalledWith(TOKEN);
    expect(p.removed).toHaveBeenCalled();
    expect(push.store.getState()).toEqual({ status: "unknown", token: null });
  });
  it("with nothing registered there is nothing to tell", async () => {
    const { push, unregister } = make(phone({ granted: false, grantsWhenAsked: false }));
    await push.enable();
    await push.disable();
    expect(unregister).not.toHaveBeenCalled();
  });
  it("a server that can't be reached does not stop signing out", async () => {
    const { push } = make(phone(), { unregister: jest.fn().mockRejectedValue(new Error("offline")) });
    await push.enable();
    await expect(push.disable()).resolves.toBeUndefined();
  });
  it("signing in again afterwards registers again, once", async () => {
    const p = phone();
    const { push, register } = make(p);
    await push.enable(); await push.disable(); await push.enable();
    expect(register).toHaveBeenCalledTimes(2);
    expect(p.calls.addPushTokenListener).toHaveBeenCalledTimes(2);
  });
});

describe("what a tapped notification is about", () => {
  it("a new delivery names its order", () => {
    expect(DELIVERY_ASSIGNED).toBe("delivery.assigned");
    expect(deliveryOf({ type: "delivery.assigned", orderId: "abc123", orderNumber: "0006" })).toEqual({ orderId: "abc123" });
  });
  it("anything else is not ours: no type, another type, no order, nothing", () => {
    expect(deliveryOf({ type: "something.else", orderId: "abc" })).toBeNull();
    expect(deliveryOf({ type: "delivery.assigned" })).toBeNull();
    expect(deliveryOf({ type: "delivery.assigned", orderId: "" })).toBeNull();
    expect(deliveryOf({ orderId: "abc" })).toBeNull();
    expect(deliveryOf(null)).toBeNull();
    expect(deliveryOf(undefined)).toBeNull();
  });
});
