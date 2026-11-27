import { screen } from "@testing-library/react-native";
import { AREAS, areasFor, can, canUseApp, type Me } from "@/lib/access";
import { areaOfPath, litTab, needsMore, PHONE_TABS, showAreasOnAccount } from "@/lib/nav";
import { AreaScreen } from "@/screens/AreaScreen";
import { ACCOUNTANT, MANAGER, OWNER, renderApp } from "../test/harness";
import { freshScope, options, reportsServer } from "../test/data";

const ids = (me: Me, features: string[] | null = ["coupons", "reservations", "feedback"]) => areasFor(me, features).map((a) => a.id);
const KITCHEN: Me = { ...OWNER, id: "u5", role: "kitchen", permissions: ["order:read"] };

describe("which areas each role sees", () => {
  it("the owner sees everything the plan includes", () => {
    expect(ids(OWNER)).toEqual(["home", "sales", "money", "dishes", "customers", "outlets", "bookings", "coupons", "stock", "staff", "reports", "ratings"]);
  });
  it("a manager sees the shop's numbers but not the money, staff or reports", () => {
    expect(ids(MANAGER)).toEqual(["home", "sales", "dishes", "customers", "outlets", "bookings", "coupons", "stock", "ratings"]);
  });
  it("an accountant sees the money and reports but not staff", () => {
    expect(ids(ACCOUNTANT)).toEqual(["home", "sales", "money", "dishes", "customers", "outlets", "bookings", "coupons", "stock", "reports", "ratings"]);
  });
  it("a role that may not read analytics (the kitchen) can't use the app at all", () => {
    expect(canUseApp(KITCHEN)).toBe(false);
    expect(ids(KITCHEN)).toEqual([]);
    expect(canUseApp(null)).toBe(false);
    expect(canUseApp(OWNER)).toBe(true);
  });
  it("the plan hides what it doesn't include: no bookings, coupons or ratings without them", () => {
    expect(ids(OWNER, [])).toEqual(["home", "sales", "money", "dishes", "customers", "outlets", "stock", "staff", "reports"]);
    expect(ids(OWNER, ["coupons"])).toContain("coupons");
    expect(ids(OWNER, ["coupons"])).not.toContain("bookings");
  });
  it("before the plan is known only the role decides", () => {
    expect(ids(OWNER, null)).toHaveLength(AREAS.length);
  });
  it("the platform's super admin passes every permission", () => {
    expect(can({ ...OWNER, isSuperAdmin: true, permissions: [] }, "analytics:finance")).toBe(true);
    expect(can({ ...OWNER, permissions: [] }, "analytics:finance")).toBe(false);
  });
  it("every area has a name, an icon and a hint, and ids are unique", () => {
    expect(new Set(AREAS.map((a) => a.id)).size).toBe(AREAS.length);
    for (const a of AREAS) { expect(a.label).toBeTruthy(); expect(a.icon).toBeTruthy(); expect(a.hint.length).toBeGreaterThan(10); }
  });
});

describe("AreaScreen", () => {
  beforeEach(() => freshScope());
  it("opens a screen the person may see", async () => {
    await renderApp(<AreaScreen id="sales" />, { server: reportsServer() });
    expect(await screen.findByTestId("screen-sales")).toBeOnTheScreen();
  });
  it("shows 'Your role doesn't include this' for a screen the role lacks (the owner's Money for a manager)", async () => {
    await renderApp(<AreaScreen id="money" />, { server: reportsServer(), signedInAs: MANAGER });
    expect(await screen.findByTestId("no-access")).toBeOnTheScreen();
    expect(screen.getByText("Your role doesn't include this")).toBeOnTheScreen();
  });
  it("shows it for an area the plan doesn't include, once the plan is known", async () => {
    await renderApp(<AreaScreen id="coupons" />, { server: reportsServer({ "GET /api/analytics/options": { json: options({ features: ["takeaway"] }) } }) });
    expect(await screen.findByTestId("no-access")).toBeOnTheScreen();
  });
  it("shows it for an address that is no area at all", async () => {
    await renderApp(<AreaScreen id="nonsense" />, { server: reportsServer() });
    expect(await screen.findByTestId("no-access")).toBeOnTheScreen();
  });
  it("the Account page is for everyone", async () => {
    await renderApp(<AreaScreen id="more" />, { server: reportsServer(), signedInAs: MANAGER });
    expect(await screen.findByTestId("screen-more")).toBeOnTheScreen();
  });
  it("every area in the list has a screen behind it", async () => {
    for (const a of AREAS) {
      const { unmount } = await renderApp(<AreaScreen id={a.id} />, { server: reportsServer() });
      expect(await screen.findByTestId(`screen-${a.id}`)).toBeOnTheScreen();
      unmount();
    }
  });
});

describe("the menu helpers", () => {
  it("areaOfPath reads the first part of an address", () => {
    expect(areaOfPath("/sales")).toBe("sales"); expect(areaOfPath("/money?tab=gst")).toBe("money"); expect(areaOfPath("/")).toBe(""); expect(areaOfPath(null)).toBe("");
  });
  it("the phone's tab bar holds 4; more areas move under More", () => {
    expect(PHONE_TABS).toBe(4);
    expect(needsMore(4)).toBe(false); expect(needsMore(5)).toBe(true);
    expect(showAreasOnAccount(12, false)).toBe(true);
    expect(showAreasOnAccount(12, true)).toBe(false); // a tablet's rail already lists them
    expect(showAreasOnAccount(3, false)).toBe(false);
  });
  it("litTab lights the area's own tab, or More for one that lives under it", () => {
    expect(litTab(["home", "sales", "money", "more"], ["dishes", "stock"], "sales")).toBe("sales");
    expect(litTab(["home", "sales", "money", "more"], ["dishes", "stock"], "stock")).toBe("more");
    expect(litTab(["home", "sales", "money", "more"], ["dishes"], "")).toBe("");
    expect(litTab(["home", "more"], [], "more")).toBe("more");
  });
});
