import { Linking } from "react-native";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { LOCK_AFTER_MS, createAwayTracker, useAppLock } from "@/data/appLock";
import { LockScreen } from "@/ui/LockScreen";
import { More } from "@/screens/More";
import { renderApp } from "../test/harness";
import { freshScope, reportsServer } from "../test/data";

const auth = jest.requireMock("expo-local-authentication") as { hasHardwareAsync: jest.Mock; isEnrolledAsync: jest.Mock; authenticateAsync: jest.Mock };
const storage = jest.requireMock("@react-native-async-storage/async-storage") as { getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<void>; removeItem(k: string): Promise<void> };

beforeEach(async () => {
  useAppLock.getState().reset();
  await storage.removeItem("business.lock");
  auth.hasHardwareAsync.mockResolvedValue(true); auth.isEnrolledAsync.mockResolvedValue(true); auth.authenticateAsync.mockReset().mockResolvedValue({ success: true });
});

describe("the app lock (store)", () => {
  it("is off until the person turns it on", () => { expect(useAppLock.getState()).toMatchObject({ enabled: false, locked: false }); });

  it("turning it on asks for the fingerprint first, keeps the choice on the phone, and doesn't lock the person out at once", async () => {
    expect(await useAppLock.getState().setEnabled(true)).toBe(true);
    expect(auth.authenticateAsync).toHaveBeenCalledWith(expect.objectContaining({ promptMessage: "Turn on the app lock" }));
    expect(useAppLock.getState()).toMatchObject({ enabled: true, locked: false });
    expect(await storage.getItem("business.lock")).toBe("1");
  });
  it("is not turned on when the person doesn't confirm", async () => {
    auth.authenticateAsync.mockResolvedValue({ success: false });
    expect(await useAppLock.getState().setEnabled(true)).toBe(false);
    expect(useAppLock.getState().enabled).toBe(false);
    expect(await storage.getItem("business.lock")).toBeNull();
  });
  it("can't be turned on when the phone has no screen lock, and doesn't even ask", async () => {
    auth.isEnrolledAsync.mockResolvedValue(false);
    expect(await useAppLock.getState().setEnabled(true)).toBe(false);
    expect(auth.authenticateAsync).not.toHaveBeenCalled();
  });
  it("turning it off asks too, so nobody holding the phone can switch it off", async () => {
    await useAppLock.getState().setEnabled(true);
    auth.authenticateAsync.mockResolvedValue({ success: false });
    expect(await useAppLock.getState().setEnabled(false)).toBe(false);
    expect(useAppLock.getState().enabled).toBe(true);
    auth.authenticateAsync.mockResolvedValue({ success: true });
    expect(await useAppLock.getState().setEnabled(false)).toBe(true);
    expect(useAppLock.getState().enabled).toBe(false);
    expect(await storage.getItem("business.lock")).toBeNull();
  });
  it("locks only when it is on", async () => {
    useAppLock.getState().lock();
    expect(useAppLock.getState().locked).toBe(false);
    await useAppLock.getState().setEnabled(true);
    useAppLock.getState().lock();
    expect(useAppLock.getState().locked).toBe(true);
  });
  it("stays locked when the fingerprint fails, and opens when it works", async () => {
    await useAppLock.getState().setEnabled(true); useAppLock.getState().lock();
    auth.authenticateAsync.mockResolvedValue({ success: false });
    expect(await useAppLock.getState().unlock()).toBe(false);
    expect(useAppLock.getState().locked).toBe(true);
    auth.authenticateAsync.mockResolvedValue({ success: true });
    expect(await useAppLock.getState().unlock()).toBe(true);
    expect(useAppLock.getState().locked).toBe(false);
  });
  it("a phone that crashes or throws while asking counts as 'not confirmed'", async () => {
    auth.authenticateAsync.mockRejectedValue(new Error("sensor gone"));
    expect(await useAppLock.getState().setEnabled(true)).toBe(false);
  });
  it("when the app opens with the lock on, it starts locked", async () => {
    await storage.setItem("business.lock", "1");
    await useAppLock.getState().hydrate();
    expect(useAppLock.getState()).toMatchObject({ enabled: true, locked: true });
  });
  it("when the lock is off, opening the app doesn't lock it", async () => {
    await useAppLock.getState().hydrate();
    expect(useAppLock.getState()).toMatchObject({ enabled: false, locked: false });
  });
});

describe("locking again after being away", () => {
  it("only when the app was away longer than the limit", () => {
    let t = 1_000_000;
    const away = createAwayTracker(() => t);
    expect(away("active")).toBe(false); // opening for the first time
    away("background"); t += LOCK_AFTER_MS - 1;
    expect(away("active")).toBe(false); // a quick look at a message
    away("background"); t += LOCK_AFTER_MS + 1;
    expect(away("active")).toBe(true);
    expect(away("active")).toBe(false); // asked once, not again
  });
  it("the in-between 'inactive' state (a pulled-down shade, a permission box) changes nothing", () => {
    let t = 5_000;
    const away = createAwayTracker(() => t);
    away("background"); t += LOCK_AFTER_MS + 1;
    expect(away("inactive")).toBe(false);
    expect(away("active")).toBe(true);
  });
});

describe("the lock screen", () => {
  it("asks as soon as it appears, and again on 'Unlock'; a good answer opens the app", async () => {
    await useAppLock.getState().setEnabled(true); useAppLock.getState().lock();
    auth.authenticateAsync.mockClear().mockResolvedValue({ success: false });
    await renderApp(<LockScreen />, { signedInAs: null });
    await waitFor(() => expect(auth.authenticateAsync).toHaveBeenCalledTimes(1));
    expect(useAppLock.getState().locked).toBe(true);
    auth.authenticateAsync.mockResolvedValue({ success: true });
    await act(async () => { await fireEvent.press(screen.getByTestId("lock-unlock")); });
    await waitFor(() => expect(useAppLock.getState().locked).toBe(false));
    expect(auth.authenticateAsync).toHaveBeenCalledTimes(2);
  });
});

describe("the Account page", () => {
  beforeEach(() => freshScope());

  it("shows who is signed in and the role", async () => {
    await renderApp(<More />, { server: reportsServer() });
    expect(await screen.findByText("Olivia Owner")).toBeOnTheScreen();
    expect(screen.getByText("owner@acme.test")).toBeOnTheScreen();
    expect(screen.getByTestId("account-role")).toHaveTextContent("Owner");
  });

  it("the lock switch asks for the fingerprint and then stays on", async () => {
    await renderApp(<More />, { server: reportsServer() });
    await act(async () => { await fireEvent(await screen.findByTestId("app-lock-switch"), "valueChange", true); });
    await waitFor(() => expect(useAppLock.getState().enabled).toBe(true));
    expect(auth.authenticateAsync).toHaveBeenCalled();
  });
  it("if the fingerprint isn't given, the lock stays off and the person is told", async () => {
    auth.authenticateAsync.mockResolvedValue({ success: false });
    await renderApp(<More />, { server: reportsServer() });
    await act(async () => { await fireEvent(await screen.findByTestId("app-lock-switch"), "valueChange", true); });
    expect(await screen.findByText("The app lock was not changed.")).toBeOnTheScreen();
    expect(useAppLock.getState().enabled).toBe(false);
  });
  it("a phone with no screen lock is told what to do", async () => {
    auth.isEnrolledAsync.mockResolvedValue(false);
    await renderApp(<More />, { server: reportsServer() });
    expect(await screen.findByTestId("app-lock-unavailable")).toBeOnTheScreen();
    await act(async () => { await fireEvent(screen.getByTestId("app-lock-switch"), "valueChange", true); });
    expect(await screen.findByText(/Set up a fingerprint, face or screen lock/)).toBeOnTheScreen();
  });

  describe("check for updates", () => {
    it("says so when the app is the latest", async () => {
      await renderApp(<More />, { server: reportsServer({ "GET /api/app-updates/check": { json: { updateAvailable: false, force: false, latest: null } } }) });
      await fireEvent.press(await screen.findByTestId("update-check"));
      expect(await screen.findByTestId("update-latest")).toBeOnTheScreen();
    });
    it("shows a newer version with its notes, and a button that opens its page", async () => {
      const open = jest.spyOn(Linking, "openURL").mockResolvedValue();
      const server = reportsServer({ "GET /api/app-updates/check": { json: { updateAvailable: true, force: false, latest: { version: "v-26.12.01-001", notes: "Faster reports", fileSize: 52_428_800 }, pageUrl: "https://rasoipulse.in/apps/business" } } });
      await renderApp(<More />, { server });
      await fireEvent.press(await screen.findByTestId("update-check"));
      expect(await screen.findByText("Version v-26.12.01-001 is ready")).toBeOnTheScreen();
      expect(screen.getByText("Faster reports")).toBeOnTheScreen();
      expect(screen.queryByText("Needed")).toBeNull();
      await fireEvent.press(screen.getByText("Get it (50.0 MB)"));
      expect(open).toHaveBeenCalledWith("https://rasoipulse.in/apps/business");
      expect(server.to("GET", "/api/app-updates/check")[0]!.query).toContain("app=business");
      open.mockRestore();
    });
    it("marks an update that is required", async () => {
      await renderApp(<More />, { server: reportsServer({ "GET /api/app-updates/check": { json: { updateAvailable: true, force: true, latest: { version: "v-27.01.01-001" } } } }) });
      await fireEvent.press(await screen.findByTestId("update-check"));
      expect(await screen.findByText("Needed")).toBeOnTheScreen();
    });
    it("when the server can't be reached it says so, and can be tried again", async () => {
      const server = reportsServer({ "GET /api/app-updates/check": { status: 500, json: { error: "x" } } });
      await renderApp(<More />, { server });
      await fireEvent.press(await screen.findByTestId("update-check"));
      expect(await screen.findByTestId("update-error")).toBeOnTheScreen();
      server.set("GET /api/app-updates/check", { json: { updateAvailable: false, force: false, latest: null } });
      await fireEvent.press(screen.getByTestId("update-check"));
      expect(await screen.findByTestId("update-latest")).toBeOnTheScreen();
    });
  });
});
