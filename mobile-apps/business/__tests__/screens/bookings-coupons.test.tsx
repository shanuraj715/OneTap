import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { Bookings } from "@/screens/Bookings";
import { Coupons } from "@/screens/Coupons";
import { MANAGER, renderApp } from "../../test/harness";
import { couponsReport, freshScope, queryOf, reportsServer, reservationsReport, storeCoupon } from "../../test/data";

beforeEach(() => freshScope());
const outletHeader = (c: { headers: Record<string, string> }) => c.headers["x-rasoipulse-outlet"];

describe("Bookings — report", () => {
  it("counts the bookings against the period before, and the guests, no-shows and cancellations with their shares", async () => {
    await renderApp(<Bookings />, { server: reportsServer() });
    const total = await screen.findByTestId("bk-total");
    expect(within(total).getByText("40")).toBeOnTheScreen(); expect(within(total).getByText(/\+25%/)).toBeOnTheScreen(); expect(total).toHaveTextContent(/32 the period before/);
    expect(screen.getByTestId("bk-guests")).toHaveTextContent(/150/); expect(screen.getByTestId("bk-guests")).toHaveTextContent(/3\.8 a table/);
    expect(screen.getByTestId("bk-noshow")).toHaveTextContent(/10% of bookings/);
    expect(screen.getByTestId("bk-cancelled")).toHaveTextContent(/8% of bookings/);
    expect(screen.getByTestId("bk-week")).toHaveTextContent(/9/);
  });
  it("shows the advance money in rupees", async () => {
    await renderApp(<Bookings />, { server: reportsServer() });
    expect(within(await screen.findByTestId("bk-advance")).getByText("₹20,000")).toBeOnTheScreen();
    expect(within(screen.getByTestId("bk-refund")).getByText("₹1,500")).toBeOnTheScreen();
    expect(within(screen.getByTestId("bk-value")).getByText("₹60,000")).toBeOnTheScreen();
  });
  it("draws the days, the weekdays, the hours and how the bookings ended", async () => {
    await renderApp(<Bookings />, { server: reportsServer() });
    for (const id of ["chart-bk-days", "chart-bk-weekdays", "chart-bk-hours", "chart-bk-status"]) expect(await screen.findByTestId(id)).toBeOnTheScreen();
    expect(screen.getByText("Busiest: Saturday")).toBeOnTheScreen();
    expect(screen.getByText("Busiest: 8 pm")).toBeOnTheScreen();
  });
  it("a plan without bookings is told so", async () => {
    await renderApp(<Bookings />, { server: reportsServer({ "GET /api/analytics/reservations": { json: { enabled: false } } }) });
    expect(await screen.findByText("Table bookings aren't in your plan")).toBeOnTheScreen();
  });
  it("no bookings in the period says so", async () => {
    await renderApp(<Bookings />, { server: reportsServer({ "GET /api/analytics/reservations": { json: reservationsReport({ totals: { ...reservationsReport().totals, bookings: 0 } }) } }) });
    expect(await screen.findByText("No bookings in this period")).toBeOnTheScreen();
  });
});

describe("Bookings — coming up", () => {
  const open = async (server = reportsServer()) => { const v = await renderApp(<Bookings />, { server }); await fireEvent.press(await screen.findByTestId("bookings-tab-upcoming")); return v; };
  it("groups the next bookings by day with time, name, party, table, advance and state", async () => {
    await open();
    const b1 = await screen.findByTestId("booking-b1");
    expect(b1).toHaveTextContent(/7:30 pm · Rohit Sharma · 4/); expect(b1).toHaveTextContent(/table T5/); expect(b1).toHaveTextContent(/advance ₹2,000/); expect(b1).toHaveTextContent(/Confirmed/);
    expect(screen.getByText("29 Nov 2026")).toBeOnTheScreen();
    expect(screen.getByText("30 Nov 2026")).toBeOnTheScreen();
    expect(screen.getByText(/2 bookings · 6 guests/)).toBeOnTheScreen();
    expect(screen.getByTestId("booking-b2")).toHaveTextContent(/9:30 pm · Meera · 2/);
  });
  it("says how many are waiting to be confirmed", async () => {
    await open();
    expect(await screen.findByText("1 waiting to be confirmed")).toBeOnTheScreen();
  });
  it("asks for the upcoming bookings of the outlet shown, and another outlet when picked", async () => {
    const server = reportsServer();
    await open(server);
    await screen.findByTestId("booking-b1");
    const first = server.to("GET", "/api/reservations")[0]!;
    expect(queryOf(first).scope).toBe("upcoming");
    expect(outletHeader(first)).toBe("o1");
    await fireEvent.press(screen.getByTestId("outlet-pick-o2"));
    await waitFor(() => expect(server.to("GET", "/api/reservations").some((c) => outletHeader(c) === "o2")).toBe(true));
  });
  it("says so when nothing is coming up", async () => {
    await open(reportsServer({ "GET /api/reservations": { json: { reservations: [], waiting: 0 } } }));
    expect(await screen.findByText("No bookings coming up")).toBeOnTheScreen();
  });
  it("a role without booking access is told so", async () => {
    await open(reportsServer({ "GET /api/reservations": { status: 403, json: { error: "Forbidden" } } }));
    expect(await screen.findByText("Not allowed")).toBeOnTheScreen();
  });
});

describe("Coupons — usage", () => {
  it("totals the uses, what was given away and what was sold, each against the period before", async () => {
    await renderApp(<Coupons />, { server: reportsServer() });
    const uses = await screen.findByTestId("cp-uses");
    expect(within(uses).getByText("55")).toBeOnTheScreen(); expect(within(uses).getByText(/\+37\.5%/)).toBeOnTheScreen(); expect(uses).toHaveTextContent(/46% of orders/);
    expect(within(screen.getByTestId("cp-discount")).getByText("₹2,200")).toBeOnTheScreen();
    expect(within(screen.getByTestId("cp-sales")).getByText("₹22,000")).toBeOnTheScreen();
  });
  it("shows each code with its uses, customers, cost and change, and codes that are off", async () => {
    await renderApp(<Coupons />, { server: reportsServer() });
    const w = await screen.findByTestId("coupon-WELCOME10");
    expect(w).toHaveTextContent(/40 uses · 35 customers · ₹1,600 given · ₹16,000 sales/); expect(w).toHaveTextContent(/\+33\.3%/);
    const f = screen.getByTestId("coupon-FLAT50");
    expect(f).toHaveTextContent(/Off/); expect(f).toHaveTextContent(/−10%/);
  });
  it("compares the average order with and without a coupon", async () => {
    await renderApp(<Coupons />, { server: reportsServer() });
    expect(await screen.findByTestId("cp-compare")).toHaveTextContent(/With a coupon/);
    expect(screen.getByTestId("cp-compare")).toHaveTextContent(/₹400/); expect(screen.getByTestId("cp-compare")).toHaveTextContent(/₹300/);
  });
  it("lists coupons nobody used", async () => {
    await renderApp(<Coupons />, { server: reportsServer() });
    expect(await screen.findByTestId("unused-OLD20")).toHaveTextContent(/Winter offer/);
  });
  it("a plan without coupons is told so", async () => {
    await renderApp(<Coupons />, { server: reportsServer({ "GET /api/analytics/coupons": { json: { enabled: false } } }) });
    expect(await screen.findByText("Coupons aren't in your plan")).toBeOnTheScreen();
  });
  it("nothing used and nothing unused says so", async () => {
    await renderApp(<Coupons />, { server: reportsServer({ "GET /api/analytics/coupons": { json: couponsReport({ totals: { ...couponsReport().totals, uses: 0 }, unused: [], coupons: [] }) } }) });
    expect(await screen.findByText("No coupons used in this period")).toBeOnTheScreen();
  });
});

describe("Coupons — your coupons", () => {
  const open = async (server = reportsServer({ "PATCH /api/coupons/:id": { json: { coupon: storeCoupon() } } }), as?: Parameters<typeof renderApp>[1]) => { const v = await renderApp(<Coupons />, { server, ...as }); await fireEvent.press(await screen.findByTestId("coupons-tab-manage")); return v; };
  it("describes each coupon's offer in words and its use", async () => {
    await open();
    const a = await screen.findByTestId("store-coupon-k1");
    expect(a).toHaveTextContent(/10% off up to ₹100 on ₹300\+/); expect(a).toHaveTextContent(/used 40 of 100 times/); expect(a).toHaveTextContent(/until 31 Dec 2026/);
    expect(screen.getByTestId("store-coupon-k2")).toHaveTextContent(/₹50 off/);
  });
  it("switching one off tells the server, for that outlet", async () => {
    const server = reportsServer({ "PATCH /api/coupons/:id": { json: { coupon: storeCoupon({ active: false }) } } });
    await open(server);
    await act(async () => { await fireEvent(await screen.findByTestId("store-coupon-switch-k1"), "valueChange", false); });
    await waitFor(() => expect(server.to("PATCH", "/api/coupons/k1")).toHaveLength(1));
    const call = server.to("PATCH", "/api/coupons/k1")[0]!;
    expect(call.body).toEqual({ active: false }); expect(outletHeader(call)).toBe("o1");
    expect(await screen.findByText("Coupon switched off.")).toBeOnTheScreen();
  });
  it("the server's refusal is shown", async () => {
    await open(reportsServer({ "PATCH /api/coupons/:id": { status: 403, json: { error: "Coupons aren't in your plan" } } }));
    await act(async () => { await fireEvent(await screen.findByTestId("store-coupon-switch-k2"), "valueChange", true); });
    expect(await screen.findByText("Your role can't do this.")).toBeOnTheScreen();
  });
  it("someone who may look but not change sees the switches off and told why", async () => {
    await open(undefined, { signedInAs: { ...MANAGER, permissions: ["analytics:read", "coupon:read"] } });
    expect((await screen.findByTestId("store-coupon-switch-k1")).props.disabled).toBe(true);
    expect(screen.getByText(/Only the owner and managers can switch coupons/)).toBeOnTheScreen();
  });
  it("another outlet's coupons are asked for when it is picked", async () => {
    const server = reportsServer();
    await open(server);
    await screen.findByTestId("store-coupon-k1");
    await fireEvent.press(screen.getByTestId("outlet-pick-o2"));
    await waitFor(() => expect(server.to("GET", "/api/coupons").some((c) => outletHeader(c) === "o2")).toBe(true));
  });
  it("no coupons yet says so", async () => {
    await open(reportsServer({ "GET /api/coupons": { json: { coupons: [] } } }));
    expect(await screen.findByText("No coupons here yet")).toBeOnTheScreen();
  });
});
