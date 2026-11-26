import type { ReactNode } from "react";
import { act } from "@testing-library/react-native";
import AppLayout from "@/app/(app)/_layout";
import TabsLayout from "@/app/(app)/(tabs)/_layout";
import { memoryPrefs, renderApp } from "../test/harness";

// the real navigation needs the phone; what matters here is WHICH tabs the layout declares and what the shell does for the rider
const declared: Array<{ name: string; options: { title: string } }> = [];
jest.mock("expo-router", () => {
  const Tabs = ({ children }: { children?: ReactNode }) => <>{children}</>;
  Tabs.Screen = (props: { name: string; options: { title: string } }) => { declared.push(props); return null; };
  const Stack = ({ children }: { children?: ReactNode }) => <>{children}</>;
  Stack.Screen = () => null;
  return { Tabs, Stack };
});
beforeEach(() => { declared.length = 0; });

describe("the tabs", () => {
  it("Deliveries · Done · Account, in that order (a rider has nothing else)", async () => {
    await renderApp(<TabsLayout />);
    expect(declared.map((d) => d.options.title)).toEqual(["Deliveries", "Done", "Account"]);
  });
});

describe("the shell after sign-in", () => {
  it("brings back what this rider keeps (the alert)", async () => {
    const probe = await renderApp(<AppLayout />);
    const id = probe.runtime.session.getState().rider!.id;
    const prefs = memoryPrefs({ [`rda.settings.v1:${id}`]: JSON.stringify({ alerts: false }) });
    const { runtime } = await renderApp(<AppLayout />, { prefs });
    await act(async () => { await Promise.resolve(); });
    expect(runtime.settings.store.getState()).toMatchObject({ alerts: false, loaded: true });
  });
});
