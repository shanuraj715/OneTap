import type { ReactNode } from "react";
import { act } from "@testing-library/react-native";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import AppLayout from "@/app/(app)/_layout";
import TabsLayout from "@/app/(app)/(tabs)/_layout";
import { asManager, fakeServer, memoryPrefs, renderApp } from "../test/harness";

// the real navigation needs the phone; what matters here is WHICH tabs the layout declares for whom, and what the shell does for the person
const declared: Array<{ name: string; options: { title: string; href?: null } }> = [];
jest.mock("expo-router", () => {
  const Tabs = ({ children }: { children?: ReactNode }) => <>{children}</>;
  Tabs.Screen = (props: { name: string; options: { title: string; href?: null } }) => { declared.push(props); return null; };
  const Stack = ({ children }: { children?: ReactNode }) => <>{children}</>;
  Stack.Screen = () => null;
  return { Tabs, Stack };
});
jest.mock("expo-keep-awake", () => ({ activateKeepAwakeAsync: jest.fn(async () => undefined), deactivateKeepAwake: jest.fn(async () => undefined) }));

beforeEach(() => { declared.length = 0; jest.clearAllMocks(); });
const hidden = () => declared.filter((d) => d.options.href === null).map((d) => d.name);

describe("the tabs", () => {
  it("Board · Prep · Dishes · Today · Account, in that order", async () => {
    await renderApp(<TabsLayout />);
    expect(declared.map((d) => d.options.title)).toEqual(["Board", "Prep", "Dishes", "Today", "Account"]);
  });
  it("a cook does not get the Today tab (the day's numbers are the manager's)", async () => {
    await renderApp(<TabsLayout />);
    expect(hidden()).toEqual(["today"]);
  });
  it("the kitchen manager gets all five", async () => {
    await renderApp(<TabsLayout />, { server: fakeServer(asManager()) });
    expect(hidden()).toEqual([]);
  });
});

describe("the shell after sign-in", () => {
  it("brings back what this person keeps, and keeps the screen on while they cook", async () => {
    const { runtime } = await renderApp(<AppLayout />);
    // (nothing was saved yet: the defaults come back, and the screen is kept awake)
    await act(async () => { await Promise.resolve(); });
    expect(runtime.settings.store.getState().loaded).toBe(true);
    expect(activateKeepAwakeAsync).toHaveBeenCalledWith("kda-board");
  });

  it("a person who switched 'keep the screen on' off gets a screen that sleeps as usual", async () => {
    // first look at the phone's memory: the person left the switch off last time
    const probe = await renderApp(<AppLayout />);
    const { user, outletId } = probe.runtime.session.getState();
    const prefs = memoryPrefs({ [`kda.settings.v1:${user!.id}:${outletId}`]: JSON.stringify({ alerts: true, keepAwake: false, screen: "bar" }) });
    jest.clearAllMocks();
    const { runtime } = await renderApp(<AppLayout />, { prefs });
    await act(async () => { await Promise.resolve(); });
    expect(runtime.settings.store.getState()).toMatchObject({ keepAwake: false, screen: "bar", loaded: true });
    expect(deactivateKeepAwake).toHaveBeenCalledWith("kda-board"); // switched on for the first moment (the default), then off as soon as their choice arrived
  });

  it("switching it off later lets the screen sleep again", async () => {
    const { runtime } = await renderApp(<AppLayout />);
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await runtime.settings.set({ keepAwake: false }); });
    expect(deactivateKeepAwake).toHaveBeenCalledWith("kda-board");
  });
});
