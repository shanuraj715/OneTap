import { fireEvent, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { Dashboard } from "@/screens/Dashboard";
import { fakeServer, SUPPORT, renderApp } from "../../test/harness";

const dash = {
  generatedAt: "2026-11-27T11:33:00Z", today: { label: "27 Nov 2026" },
  totals: { stores: 3, outlets: 5, people: 9, customers: 14, ordersToday: 12, revenueToday: 345600 },
  sales: {
    month: { label: "Nov 2026", orders: 247, revenue: 4454700, avgOrder: 18035, revenueChangePct: -6.1, ordersChangePct: -6.4, lastMonth: { orders: 308, revenue: 5530600 } },
    year: { label: "2026", orders: 688, revenue: 12396000, revenueChangePct: null },
    monthly: Array.from({ length: 12 }, (_, i) => ({ key: `2026-${i + 1}`, label: ["Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov"][i], orders: 10 * i, revenue: 100000 * i, changePct: null })),
    daily: { current: [215200, 180000, 260000, 190000], previous: [156500, 170000, 150000, 160000] },
    topStores: [{ id: "s1", name: "Marketing Mart", orders: 247, revenue: 4454700, changePct: -6.1 }, { id: "s2", name: "Acme Momos", orders: 120, revenue: 2100000, changePct: 12 }],
    channels: [{ channel: "dine-in", orders: 74, revenue: 1235400 }, { channel: "takeaway", orders: 50, revenue: 900000 }],
  },
  stores: { total: 3, byPlan: [{ name: "Pro", count: 2 }, { name: "Starter", count: 1 }], status: { ok: 3, grace: 0, overLimit: 0 }, disabled: 0, activeLast30Days: 1, setup: { withMenu: 3, withTables: 2, withPayments: 0 } },
  leads: { new: 2 },
};

describe("the dashboard", () => {
  it("shows the month's sales as the headline, its change, and the day-by-day chart", async () => {
    await renderApp(<Dashboard />, { server: fakeServer({ "GET /api/platform/dashboard": { json: dash } }) });
    expect(await screen.findByTestId("screen-dashboard")).toBeOnTheScreen();
    expect(await screen.findByText(/Nov 2026 · sales through your stores/)).toBeOnTheScreen();
    expect(await screen.findByLabelText("₹44,547")).toBeOnTheScreen();
    expect(screen.getByText(/−6.1% vs the same days last month/)).toBeOnTheScreen();
    expect(screen.getByText(/247 orders · average ₹180/)).toBeOnTheScreen();
    expect(screen.getByTestId("chart-daily")).toBeOnTheScreen();
    expect(screen.getByTestId("chart-monthly")).toBeOnTheScreen();
  });

  it("has a tile for each total, each readable as a sentence", async () => {
    await renderApp(<Dashboard />, { server: fakeServer({ "GET /api/platform/dashboard": { json: dash } }) });
    for (const label of ["Stores", "Outlets", "People", "Customers", "Orders today", "Sales today"]) expect(await screen.findByLabelText(label)).toBeOnTheScreen();
    expect(screen.getByText("1 ordered in 30 days")).toBeOnTheScreen();
  });

  it("lists the top stores; touching one opens it", async () => {
    await renderApp(<Dashboard />, { server: fakeServer({ "GET /api/platform/dashboard": { json: dash } }) });
    await fireEvent.press(await screen.findByText(/1\. Marketing Mart/));
    expect(router.push).toHaveBeenCalledWith("/stores/s1");
  });

  it("shows how far the stores have set up, and the plans", async () => {
    await renderApp(<Dashboard />, { server: fakeServer({ "GET /api/platform/dashboard": { json: dash } }) });
    expect(await screen.findByText("3 in good standing")).toBeOnTheScreen();
    expect(screen.getByText("2 new enquiries")).toBeOnTheScreen();
    expect(screen.getByText("2 of 3")).toBeOnTheScreen(); // tables added
    expect(screen.getByText("0 of 3")).toBeOnTheScreen(); // online payments
  });

  it("a role that may not open stores gets the top stores as plain rows (nothing to tap through to)", async () => {
    (router.push as jest.Mock).mockClear();
    await renderApp(<Dashboard />, { server: fakeServer({ "GET /api/platform/dashboard": { json: dash } }), signedInAs: { ...SUPPORT, platform: { ...SUPPORT.platform, features: ["dashboard:read"] } } });
    await fireEvent.press(await screen.findByText(/1\. Marketing Mart/));
    expect(router.push).not.toHaveBeenCalled();
  });

  it("when the server says no, the person is told their role doesn't include it", async () => {
    await renderApp(<Dashboard />, { server: fakeServer({ "GET /api/platform/dashboard": { status: 403, json: { error: "Your role can't do this." } } }) });
    expect(await screen.findByText("Not allowed")).toBeOnTheScreen();
    expect(screen.queryByText("Try again")).toBeNull();
  });

  it("when the server can't be reached there is a 'Try again'", async () => {
    const server = fakeServer({ "GET /api/platform/dashboard": { throws: new Error("offline") } });
    await renderApp(<Dashboard />, { server });
    expect(await screen.findByText("Couldn't load this")).toBeOnTheScreen();
    server.set("GET /api/platform/dashboard", { json: dash });
    await fireEvent.press(screen.getByText("Try again"));
    expect(await screen.findByLabelText("₹44,547")).toBeOnTheScreen();
  });
});
