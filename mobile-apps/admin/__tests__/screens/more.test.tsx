import * as RN from "react-native";
import { screen } from "@testing-library/react-native";
import { More } from "@/screens/More";
import { needsMore, showAreasOnAccount } from "@/lib/nav";
import { OWNER, SALES, SUPPORT, fakeServer, renderApp } from "../../test/harness";

// the window the test pretends to have (RN's own Dimensions, which useWindowDimensions reads)
const sized = (width: number, height: number) => jest.spyOn(RN.Dimensions, "get").mockImplementation(((what: string) => ({ width, height, scale: 2, fontScale: 1, ...(what === "screen" ? {} : {}) })) as never);
const open = (me = OWNER) => renderApp(<More />, { server: fakeServer(), signedInAs: me });

describe("when the Account page lists the areas", () => {
  it("only a phone whose tab bar can't hold them all (more than 4 areas) needs the list", () => {
    expect(needsMore(4)).toBe(false);
    expect(needsMore(5)).toBe(true);
    expect(showAreasOnAccount(10, false)).toBe(true);   // phone, many areas: they live under More
    expect(showAreasOnAccount(4, false)).toBe(false);   // phone, all areas already in the bar
    expect(showAreasOnAccount(1, false)).toBe(false);
  });
  it("a tablet never needs it: the side rail already shows every area", () => {
    for (const n of [1, 4, 5, 10]) expect(showAreasOnAccount(n, true)).toBe(false);
  });
});

describe("the Account page", () => {
  afterEach(() => jest.restoreAllMocks());

  it("on a phone with many areas: your account, the list of areas (to reach what the bar can't hold), and this phone", async () => {
    sized(390, 844);
    await open();
    expect(await screen.findByText("Areas")).toBeOnTheScreen();
    expect(screen.getByTestId("more-server")).toBeOnTheScreen();
    expect(screen.getByTestId("more-settings")).toBeOnTheScreen();
    expect(screen.getByText("Platform Owner")).toBeOnTheScreen();
    expect(screen.getByText("This phone")).toBeOnTheScreen();
    expect(screen.getByTestId("signout")).toBeOnTheScreen();
  });

  it("on a tablet: your account and Sign out — NOT the list of areas the side rail already shows", async () => {
    sized(1280, 800);
    await open();
    expect(await screen.findByText("Platform Owner")).toBeOnTheScreen();
    expect(screen.queryByText("Areas")).toBeNull();
    expect(screen.queryByTestId("more-server")).toBeNull();
    expect(screen.queryByTestId("more-dashboard")).toBeNull();
    expect(screen.getByText("This tablet")).toBeOnTheScreen();
    expect(screen.getByTestId("signout")).toBeOnTheScreen();
  });

  it("on a phone whose role holds few areas (all in the tab bar): no repeated list either", async () => {
    sized(390, 844);
    await open(SALES); // one area: Onboarding
    expect(await screen.findByText("Sam Sales")).toBeOnTheScreen();
    expect(screen.queryByText("Areas")).toBeNull();
    expect(screen.getByTestId("signout")).toBeOnTheScreen();
  });

  it("a phone with exactly 5 areas still gets the list (4 tabs, the 5th is under More)", async () => {
    sized(390, 844);
    const FIVE = { ...OWNER, isSuperAdmin: false, name: "Five", platform: { access: true, features: ["dashboard:read", "stores:read", "onboarding:manage", "leads:manage", "plans:read"], role: { id: "r9", name: "Five" } } };
    await open(FIVE);
    expect(await screen.findByText("Areas")).toBeOnTheScreen();
    expect(screen.getByTestId("more-plans")).toBeOnTheScreen();
  });
  it("SUPPORT (2 areas) on a phone: no list", async () => {
    sized(390, 844);
    await open(SUPPORT);
    expect(await screen.findByText("Sue Support")).toBeOnTheScreen();
    expect(screen.queryByText("Areas")).toBeNull();
  });
});
