import fs from "node:fs";
import path from "node:path";
import { screen, within } from "@testing-library/react-native";
import { areaOfPath, litTab } from "@/lib/nav";
import { Rail, TabBar } from "@/ui";
import { fakeServer, renderApp } from "../test/harness";

describe("areaOfPath: which area an address is in", () => {
  it.each([["/dashboard", "dashboard"], ["/stores/abc123", "stores"], ["/onboarding/new", "onboarding"], ["/more", "more"], ["/server?x=1", "server"], ["/", ""], ["", ""], [null, ""], [undefined, ""]])("%s → %s", (path, area) => expect(areaOfPath(path as string)).toBe(area));
});

describe("litTab: which tab of the phone's bar is lit", () => {
  const tabs = ["dashboard", "stores", "onboarding", "more"], hidden = ["server", "settings"];
  it("an area with its own tab lights that tab (also on its detail screens)", () => {
    expect(litTab(tabs, hidden, "stores")).toBe("stores");
    expect(litTab(tabs, hidden, areaOfPath("/stores/abc"))).toBe("stores");
  });
  it("an area that lives under More lights More", () => expect(litTab(tabs, hidden, "server")).toBe("more"));
  it("More itself is lit on the account page; before any screen has opened, or for an unknown address, nothing is", () => {
    expect(litTab(tabs, hidden, "more")).toBe("more");
    expect(litTab(tabs, hidden, "")).toBe("");
    expect(litTab(tabs, hidden, "elsewhere")).toBe("");
  });
});

const ITEMS = [{ id: "dashboard", label: "Dashboard", icon: "dashboard" as const }, { id: "stores", label: "Stores", icon: "stores" as const }, { id: "more", label: "More", icon: "more" as const }];
const open = (ui: React.ReactElement) => renderApp(ui, { server: fakeServer(), signedInAs: null });

describe.each([["the phone's tab bar", "tab", (current: string) => <TabBar items={ITEMS} current={current} onPick={() => undefined} />], ["the tablet's side rail", "nav", (current: string) => <Rail items={ITEMS} current={current} onPick={() => undefined} />]] as const)("%s marks the open screen's item", (_name, prefix, make) => {
  it("the open one is selected and has the solid pill; the others have neither", async () => {
    await open(make("stores"));
    const on = screen.getByTestId(`${prefix}-stores`);
    expect(on.props.accessibilityState.selected).toBe(true);
    expect(within(on).getByTestId("nav-active-pill")).toBeOnTheScreen();
    for (const id of ["dashboard", "more"]) {
      expect(screen.getByTestId(`${prefix}-${id}`).props.accessibilityState.selected).toBe(false);
      expect(within(screen.getByTestId(`${prefix}-${id}`)).queryByTestId("nav-active-pill")).toBeNull();
    }
    expect(screen.getAllByTestId("nav-active-pill")).toHaveLength(1);
  });

  it("the label of the open one is white and bold; the others are the muted colour", async () => {
    await open(make("dashboard"));
    expect(within(screen.getByTestId(`${prefix}-dashboard`)).getByText("Dashboard")).toHaveStyle({ color: "#FFFFFF", fontWeight: "800" });
    expect(within(screen.getByTestId(`${prefix}-stores`)).getByText("Stores")).not.toHaveStyle({ color: "#FFFFFF" });
  });

  it("with nothing open nothing is lit, and the lit item follows when another screen opens", async () => {
    const view = await open(make(""));
    expect(screen.queryByTestId("nav-active-pill")).toBeNull();
    await view.rerender(make("more"));
    expect(within(screen.getByTestId(`${prefix}-more`)).getByTestId("nav-active-pill")).toBeOnTheScreen();
    await view.rerender(make("dashboard"));
    expect(screen.getAllByTestId("nav-active-pill")).toHaveLength(1);
    expect(within(screen.getByTestId(`${prefix}-dashboard`)).getByTestId("nav-active-pill")).toBeOnTheScreen();
  });
});

describe("the app's frame decides the lit item from the real address", () => {
  it("it reads the path (useSegments answers \"[area]\" for Dashboard, Stores, Server … so nothing matched and no item was ever lit)", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "src", "app", "(app)", "_layout.tsx"), "utf8");
    expect(src).toContain("areaOfPath(usePathname())");
    expect(src).toContain("litTab(");
    expect(src).not.toContain("useSegments");
  });
});

describe("the tablet's side rail keeps the account pinned", () => {
  /** is this element inside a scrolling list? */
  const inScroll = (el: { parent: unknown }): boolean => { let n = el as { parent: unknown; type?: unknown } | null; while (n) { if (n.type === "RCTScrollView") return true; n = n.parent as typeof n; } return false; };
  it("the Account item is outside the scrolling list of areas (so a short tablet can't push it out of sight); the areas are inside it", async () => {
    await open(<Rail items={[...ITEMS.filter((i) => i.id !== "more"), { id: "more", label: "Account", icon: "user" as const }]} current="stores" onPick={() => undefined} />);
    const account = screen.getByTestId("nav-rail-account");
    expect(within(account).getByTestId("nav-more")).toBeOnTheScreen();
    expect(within(account).queryByTestId("nav-stores")).toBeNull();
    expect(inScroll(screen.getByTestId("nav-more"))).toBe(false);
    expect(inScroll(screen.getByTestId("nav-stores"))).toBe(true);
  });
});
