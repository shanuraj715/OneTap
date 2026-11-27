import { fireEvent, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { Dashboard } from "@/screens/Dashboard";
import { BusinessSection } from "@/screens/Business";
import { fakeServer, SALES, SUPPORT, renderApp } from "../../test/harness";

/** Rasoi Pulse's OWN sales (GET /api/platform/business) — money in rupees. Three charts that hold different numbers, so a switch can be seen. */
const mk = (unit: "day" | "week" | "month", labels: string[], current: number[], previous: number[], over: Record<string, unknown> = {}) => ({
  unit, labels, dates: labels.map((_, i) => `2026-11-0${i + 1}`), previousLabels: labels.map((l) => `${l}-`),
  current, previous, newAmount: current.map((v) => v / 2), renewalAmount: current.map((v) => v / 2),
  total: current.reduce((a, b) => a + b, 0), previousTotal: previous.reduce((a, b) => a + b, 0), changePct: 12.5, newCount: 2, renewalCount: 1, ...over,
});
const biz = {
  generatedAt: "2026-11-28T10:00:00Z", today: { label: "28 Nov 2026" },
  totals: { sales: 6997.5, payments: 6, shops: 3, averagePerShop: 2332.5 },
  newSales: { shops: 3, amount: 3698 },
  renewals: { payments: 3, shops: 2, amount: 3299.5 },
  month: { label: "Nov 2026", sales: 5997.5, newShops: 2, newAmount: 3498, renewals: 1, renewalAmount: 2499.5, samePeriodLastMonth: 4000, changePct: 49.9 },
  standing: { active: 2, expired: 1, expiringSoon: 1, neverPaid: 3, neverPaidStores: [{ id: "s4", name: "Delta Diner" }], expiredStores: [{ id: "s3", name: "Gamma Grill", paidUntil: "2026-10-14" }] },
  series: {
    day: mk("day", ["1 Nov", "2 Nov", "3 Nov"], [100, 200, 5697.5], [500, 0, 0], { changePct: null }),
    week: mk("week", ["3 Nov", "10 Nov"], [300, 6197.5], [300, 0], { changePct: 2000 }),
    month: mk("month", ["Oct", "Nov"], [1000, 5997.5], [200, 0], { changePct: 400 }),
  },
  byPlan: [{ name: "Pro", activeShops: 2, amount: 6497.5 }, { name: "Basic", activeShops: 0, amount: 500 }],
  recent: [
    { id: "p3", storeId: "s1", storeName: "Acme Momos", planId: "pl1", planName: "Pro", amount: 2499.5, months: 1, paidOn: "2026-11-28", kind: "renewal", coversFrom: "2026-12-27", coversTo: "2027-01-26", note: "", recordedBy: "Owner", createdAt: "2026-11-28T09:00:00Z", storeDeleted: false },
    { id: "p2", storeId: "s2", storeName: "Beta Bites", planId: "pl1", planName: "Pro", amount: 999, months: 12, paidOn: "2026-11-20", kind: "new", coversFrom: "2026-11-20", coversTo: "2027-11-19", note: "", recordedBy: "Owner", createdAt: "2026-11-20T09:00:00Z", storeDeleted: false },
    { id: "p1", storeId: "gone", storeName: "Echo Eats", planId: null, planName: "Basic", amount: 500, months: 1, paidOn: "2026-10-01", kind: "new", coversFrom: "2026-10-01", coversTo: "2026-10-31", note: "", recordedBy: "Owner", createdAt: "2026-10-01T09:00:00Z", storeDeleted: true },
  ],
};
const empty = { ...biz, totals: { sales: 0, payments: 0, shops: 0, averagePerShop: 0 }, newSales: { shops: 0, amount: 0 }, renewals: { payments: 0, shops: 0, amount: 0 }, month: { ...biz.month, sales: 0, newShops: 0, newAmount: 0, renewals: 0, renewalAmount: 0, samePeriodLastMonth: 0, changePct: null }, standing: { active: 0, expired: 0, expiringSoon: 0, neverPaid: 2, neverPaidStores: [{ id: "s1", name: "Acme Momos" }], expiredStores: [] }, byPlan: [], recent: [] };
const server = (b: unknown = biz) => fakeServer({ "GET /api/platform/business": { json: b } });

describe("Rasoi Pulse's own business (the top of the dashboard)", () => {
  it("leads with the TOTAL SALES of the product, how this month compares, and how many payments from how many shops", async () => {
    await renderApp(<BusinessSection />, { server: server() });
    expect(await screen.findByText("Rasoi Pulse business")).toBeOnTheScreen();
    expect(screen.getByText(/not what they sell to their customers/)).toBeOnTheScreen();
    expect(await screen.findByLabelText("₹6,997.5")).toBeOnTheScreen();
    expect(screen.getByText(/\+49.9% this month vs the same days last month/)).toBeOnTheScreen();
    expect(screen.getByText(/6 payments from 3 shops · Nov 2026: ₹5,997.5/)).toBeOnTheScreen();
  });

  it("shows NEW SALES (shops that bought for the first time) and RE-SUBSCRIBED, each with its money", async () => {
    await renderApp(<BusinessSection />, { server: server() });
    expect(await screen.findByLabelText("New sales")).toBeOnTheScreen();
    expect(screen.getByText(/₹3,698 · shops that bought for the first time · 2 this month/)).toBeOnTheScreen();
    expect(screen.getByLabelText("Re-subscribed")).toBeOnTheScreen();
    expect(screen.getByText(/₹3,299.5 · 2 shops paid again · 1 this month/)).toBeOnTheScreen();
    expect(screen.getByText("1 run out within 14 days")).toBeOnTheScreen();
    expect(screen.getByText("not renewed — worth a call")).toBeOnTheScreen();
  });

  it("has ONE chart that switches between Day, Week and Month, each with this period against the one before", async () => {
    await renderApp(<BusinessSection />, { server: server() });
    expect(await screen.findByTestId("chart-business")).toBeOnTheScreen();
    expect(screen.getByText("Sales by month")).toBeOnTheScreen();
    expect(screen.getByTestId("business-legend-now")).toHaveTextContent("Last 12 months: ₹6,997.5");
    expect(screen.getByTestId("business-legend-before")).toHaveTextContent("The 12 months before: ₹200");
    await fireEvent.press(screen.getByText("Week"));
    expect(await screen.findByText("Sales by week")).toBeOnTheScreen();
    expect(screen.getByTestId("business-legend-now")).toHaveTextContent("Last 12 weeks: ₹6,497.5");
    expect(screen.getByTestId("business-legend-before")).toHaveTextContent("The 12 weeks before: ₹300");
    await fireEvent.press(screen.getByText("Day"));
    expect(await screen.findByText("Sales by day")).toBeOnTheScreen();
    expect(screen.getByTestId("business-legend-now")).toHaveTextContent("Last 30 days: ₹5,997.5");
    expect(screen.getByTestId("business-legend-before")).toHaveTextContent("The 30 days before: ₹500");
    expect(screen.getByText("2 new · 1 re-subscribed")).toBeOnTheScreen();
  });

  it("says plainly when there is nothing to compare with yet, instead of a bare dash", async () => {
    const first = { ...biz, month: { ...biz.month, changePct: null }, series: { ...biz.series, month: { ...biz.series.month, changePct: null } } };
    await renderApp(<BusinessSection />, { server: server(first) });
    expect(await screen.findByText("Nothing to compare with last month yet")).toBeOnTheScreen();
    expect(screen.getByText("Nothing earlier to compare")).toBeOnTheScreen();
  });

  it("lists the latest payments with 'New sale' / 'Re-subscribed'; a shop that still exists opens, a deleted one does not", async () => {
    (router.push as jest.Mock).mockClear();
    await renderApp(<BusinessSection />, { server: server() });
    expect(await screen.findByText("Acme Momos · ₹2,499.5")).toBeOnTheScreen();
    expect(screen.getByText("Beta Bites · ₹999")).toBeOnTheScreen();
    expect(screen.getAllByText("New sale").length).toBe(2);
    expect(screen.getAllByText("Re-subscribed").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/deleted store/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("recent-p3"));
    expect(router.push).toHaveBeenCalledWith("/stores/s1");
    (router.push as jest.Mock).mockClear();
    await fireEvent.press(screen.getByTestId("recent-p1"));
    expect(router.push).not.toHaveBeenCalled();
  });

  it("says who to follow up: shops that ran out, and shops with no payment written down — touching one opens it", async () => {
    (router.push as jest.Mock).mockClear();
    await renderApp(<BusinessSection />, { server: server() });
    expect(await screen.findByText("Gamma Grill")).toBeOnTheScreen();
    expect(screen.getByText(/Ran out 14 Oct 2026/)).toBeOnTheScreen();
    expect(screen.getByText("Delta Diner")).toBeOnTheScreen();
    expect(screen.getByText("…and 2 more with no payment written down.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("followup-s3"));
    expect(router.push).toHaveBeenCalledWith("/stores/s3");
  });

  it("shows the money taken and the shops paid up for each plan", async () => {
    await renderApp(<BusinessSection />, { server: server() });
    expect(await screen.findByTestId("plan-Pro")).toBeOnTheScreen();
    expect(screen.getByText("2 shops paid up")).toBeOnTheScreen();
    expect(screen.getByText("₹6,497.5")).toBeOnTheScreen();
    expect(screen.getByText("0 shops paid up")).toBeOnTheScreen();
  });

  it("before any payment is written down it says so, and how to start", async () => {
    await renderApp(<BusinessSection />, { server: server(empty) });
    expect(await screen.findByText("No payments written down yet")).toBeOnTheScreen();
    expect(screen.getByText(/Shops pay outside the app/)).toBeOnTheScreen();
    expect(await screen.findByLabelText("₹0")).toBeOnTheScreen();
    expect(screen.getByText("Acme Momos")).toBeOnTheScreen();
    expect(screen.getByText("Nothing yet.")).toBeOnTheScreen();
  });

  it("holds nothing about any store's orders", async () => {
    await renderApp(<BusinessSection />, { server: server() });
    await screen.findByTestId("business");
    for (const word of [/orders/i, /sales through your stores/i, /Top stores/i, /Customers/]) expect(screen.queryByText(word)).toBeNull();
  });

  it("a role without access to stores sees the rows as plain rows (nothing to open)", async () => {
    (router.push as jest.Mock).mockClear();
    await renderApp(<BusinessSection />, { server: server(), signedInAs: { ...SALES, platform: { access: true, features: ["dashboard:read"], role: null } } });
    await fireEvent.press(await screen.findByTestId("recent-p3"));
    await fireEvent.press(screen.getByTestId("followup-s3"));
    expect(router.push).not.toHaveBeenCalled();
  });

  it("when the server turns the role away, the section shows nothing at all", async () => {
    await renderApp(<BusinessSection />, { server: fakeServer({ "GET /api/platform/business": { status: 403, json: { error: "Your role can't do this." } } }) });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId("business")).toBeNull();
    expect(screen.queryByTestId("business-error")).toBeNull();
    expect(screen.queryByText(/Try again/)).toBeNull();
  });

  it("any other trouble is one quiet line, not a second 'Try again' beside the dashboard's own", async () => {
    await renderApp(<BusinessSection />, { server: fakeServer({ "GET /api/platform/business": { status: 500, json: { error: "boom" } } }) });
    expect(await screen.findByTestId("business-error")).toBeOnTheScreen();
    expect(screen.getByText(/could not be loaded. Pull down to try again/)).toBeOnTheScreen();
    expect(screen.queryByText("Try again")).toBeNull();
  });
});

describe("on the dashboard", () => {
  const dash = {
    generatedAt: "2026-11-28T11:33:00Z", today: { label: "28 Nov 2026" },
    totals: { stores: 3, outlets: 5, people: 9, customers: 14, ordersToday: 12, revenueToday: 345600 },
    sales: { month: { label: "Nov 2026", orders: 247, revenue: 4454700, avgOrder: 18035, revenueChangePct: -6.1, ordersChangePct: -6.4, lastMonth: { orders: 308, revenue: 5530600 } }, year: { label: "2026", orders: 688, revenue: 12396000, revenueChangePct: null }, monthly: [], daily: { current: [1], previous: [1] }, topStores: [], channels: [] },
    stores: { total: 3, byPlan: [], status: { ok: 3, grace: 0, overLimit: 0 }, disabled: 0, activeLast30Days: 1, setup: { withMenu: 3, withTables: 2, withPayments: 0 } },
  };
  it("the product's business comes FIRST; the stores' own sales are further down under their own heading", async () => {
    await renderApp(<Dashboard />, { server: fakeServer({ "GET /api/platform/business": { json: biz }, "GET /api/platform/dashboard": { json: dash } }) });
    const business = await screen.findByText("Rasoi Pulse business");
    const stores = await screen.findByText("Across every store");
    expect(screen.getByText(/What the shops sell to their own customers/)).toBeOnTheScreen();
    expect(screen.getByLabelText("₹6,997.5")).toBeOnTheScreen();
    expect(screen.getByText(/Nov 2026 · sales through your stores/)).toBeOnTheScreen();
    // order on the page: the business heading is above the stores' heading
    const all = screen.toJSON() as unknown;
    const text = JSON.stringify(all);
    expect(text.indexOf("Rasoi Pulse business")).toBeLessThan(text.indexOf("Across every store"));
    expect(business).toBeOnTheScreen();
    expect(stores).toBeOnTheScreen();
  });

  it("the business numbers show even while the stores' own numbers fail to load", async () => {
    await renderApp(<Dashboard />, { server: fakeServer({ "GET /api/platform/business": { json: biz }, "GET /api/platform/dashboard": { status: 500, json: { error: "boom" } } }) });
    expect(await screen.findByLabelText("₹6,997.5")).toBeOnTheScreen();
  });

  it("a role that may not see the dashboard is simply told so — the business section adds nothing", async () => {
    await renderApp(<Dashboard />, { server: fakeServer({ "GET /api/platform/business": { status: 403, json: { error: "Your role can't do this." } }, "GET /api/platform/dashboard": { status: 403, json: { error: "Your role can't do this." } } }), signedInAs: SUPPORT });
    expect(await screen.findByText("Not allowed")).toBeOnTheScreen();
    expect(screen.queryByText("Rasoi Pulse business")).toBeNull();
  });
});
