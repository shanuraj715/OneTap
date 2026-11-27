import { fireEvent, screen, within } from "@testing-library/react-native";
import { Plans, limitsLine } from "@/screens/Plans";
import { fakeServer, renderApp } from "../../test/harness";

const plan = (o: Record<string, unknown>) => ({ id: "p1", name: "Starter", description: "For one counter.", custom: false, limits: { maxUsers: 3, maxOutlets: 1, maxTables: 5 }, entitlements: { allFeatures: false, features: ["takeaway", "coupons"] }, archived: false, storeCount: 2, marketing: { monthly: 99900, price: "₹999 / month" }, ...o });
const PLANS = { plans: [plan({}), plan({ id: "p2", name: "Pro", limits: { maxUsers: null, maxOutlets: 5, maxTables: 50 }, entitlements: { allFeatures: true, features: [] }, storeCount: 1, marketing: undefined }), plan({ id: "p3", name: "Custom", custom: true, limits: { maxUsers: null, maxOutlets: null, maxTables: null }, entitlements: { allFeatures: false, features: [] }, storeCount: 0, marketing: undefined }), plan({ id: "p4", name: "Old plan", archived: true })] };
const open = () => renderApp(<Plans />, { server: fakeServer({ "GET /api/platform/plans": { json: PLANS } }) });

describe("the plans screen", () => {
  it("lists the live plans with their limits, price and how many stores use them; archived ones are on their own tab", async () => {
    await open();
    const s = within(await screen.findByTestId("plan-Starter"));
    expect(s.getByText("1 outlet · 3 people · 5 tables")).toBeOnTheScreen();
    expect(s.getByText("₹999 / month")).toBeOnTheScreen();
    expect(s.getByText("2 stores")).toBeOnTheScreen();
    expect(within(screen.getByTestId("plan-Pro")).getByText("5 outlets · any people · 50 tables")).toBeOnTheScreen();
    expect(within(screen.getByTestId("plan-Custom")).getByText(/set by hand/)).toBeOnTheScreen();
    expect(screen.queryByTestId("plan-Old plan")).toBeNull();
    await fireEvent.press(screen.getByTestId("plans-filter-archived"));
    expect(screen.getByTestId("plan-Old plan")).toBeOnTheScreen();
  });
  it("opening a plan lists what it includes, by name", async () => {
    await open();
    await fireEvent.press(await screen.findByTestId("plan-Starter"));
    const f = within(await screen.findByTestId("plan-features"));
    expect(f.getByText("Takeaway")).toBeOnTheScreen();
    expect(f.getByText("Coupons")).toBeOnTheScreen();
    expect(screen.getByTestId("plan-limits")).toHaveTextContent("1 outlet · 3 people · 5 tables");
  });
  it("a plan with every feature says so; a Custom plan says features are set by hand", async () => {
    await open();
    await fireEvent.press(await screen.findByTestId("plan-Pro"));
    expect(await screen.findByText("Every feature.")).toBeOnTheScreen();
  });
  it("limitsLine says 'any' for no limit and singular for one", () => {
    expect(limitsLine(plan({ limits: { maxUsers: null, maxOutlets: 1, maxTables: null } }) as never)).toBe("1 outlet · any people · any tables");
  });
});
