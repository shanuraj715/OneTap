import { StyleSheet } from "react-native";
import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { Sales, align, thin } from "@/screens/Sales";
import { darkColors, lightColors } from "@/ui/theme";
import { renderApp } from "../../test/harness";
import { freshScope, kpis, overview, queryOf, reportsServer, salesReport } from "../../test/data";

beforeEach(() => freshScope());

describe("thin / align (small chart helpers)", () => {
  it("thin keeps a few labels, always the last one, and blanks the rest", () => {
    const out = thin(Array.from({ length: 30 }, (_, i) => `d${i}`), 6);
    expect(out[0]).toBe("d0");
    expect(out[29]).toBe("d29");
    expect(out.filter(Boolean).length).toBeLessThanOrEqual(8);
    expect(thin(["a", "b", "c"], 6)).toEqual(["a", "b", "c"]);
  });
  it("align pads a shorter comparison with zeros and trims a longer one", () => {
    expect(align([1, 2], 4)).toEqual([1, 2, 0, 0]);
    expect(align([1, 2, 3, 4], 2)).toEqual([1, 2]);
  });
});

describe("Sales", () => {
  it("shows every headline number with its change against the period before", async () => {
    await renderApp(<Sales />, { server: reportsServer() });
    const sales = await screen.findByTestId("kpi-sales");
    expect(within(sales).getByText("₹50,000")).toBeOnTheScreen();
    expect(within(sales).getByText(/\+25%/)).toBeOnTheScreen(); // 50,000 against 40,000
    expect(within(sales).getByText(/₹40,000 the period before/)).toBeOnTheScreen();
    expect(within(screen.getByTestId("kpi-orders")).getByText("120")).toBeOnTheScreen();
    expect(within(screen.getByTestId("kpi-orders")).getByText(/\+20%/)).toBeOnTheScreen();
    expect(within(screen.getByTestId("kpi-aov")).getByText("₹417")).toBeOnTheScreen();
    expect(within(screen.getByTestId("kpi-customers")).getByText("80")).toBeOnTheScreen();
  });

  it("a fall in discounts is good news (green) and a rise in cancellations is bad (red)", async () => {
    await renderApp(<Sales />, { server: reportsServer() });
    const good = [darkColors.ok, lightColors.ok];
    const bad = [darkColors.danger, lightColors.danger];
    const colourOf = (node: ReturnType<typeof screen.getByText>) => (StyleSheet.flatten(node.props.style) as { color?: string }).color;
    const discount = await screen.findByTestId("kpi-discount"); // 100,000 against 120,000 → −16.7%
    const down = within(discount).getByText(/−16\.7%/);
    expect(good).toContain(colourOf(down));
    const sales = screen.getByTestId("kpi-sales"); // up is good for sales
    expect(good).toContain(colourOf(within(sales).getByText(/\+25%/)));
    const cancelled = screen.getByTestId("kpi-cancelled"); // 10 against 5 → +100%: more cancellations is bad
    const up = within(cancelled).getByText(/\+100%/);
    expect(bad).toContain(colourOf(up));
    expect(within(cancelled).getByText(/7\.7% of 130 placed/)).toBeOnTheScreen();
  });

  it("draws sales over time against the period before, the orders, the outlets stacked and the weekdays", async () => {
    await renderApp(<Sales />, { server: reportsServer() });
    for (const id of ["chart-sales", "chart-orders", "chart-outlets", "chart-weekdays"]) expect(await screen.findByTestId(id)).toBeOnTheScreen();
    expect(screen.getByTestId("best-day")).toHaveTextContent(/Best: Saturday \(₹1,400 on average\)/);
  });

  it("asks for the comparison dates: the period before by default, the same dates last year when chosen, nothing when switched off", async () => {
    const server = reportsServer();
    await renderApp(<Sales />, { server });
    await screen.findByTestId("kpi-sales");
    const ranges = () => server.to("GET", "/api/analytics/overview").map(queryOf);
    await waitFor(() => expect(ranges().length).toBeGreaterThanOrEqual(4)); // now, the one before, and the two years for the yearly chart
    await fireEvent.press(screen.getByTestId("compare-year"));
    await waitFor(() => expect(screen.getByTestId("kpi-sales")).toHaveTextContent(/the period before|last year/));
    const lastYear = ranges().find((q) => q.from?.startsWith(String(new Date().getFullYear() - 1)) && q.to?.startsWith(String(new Date().getFullYear() - 1)) && q.granularity !== "month");
    expect(lastYear).toBeTruthy();
    await fireEvent.press(screen.getByTestId("compare-off"));
    await waitFor(() => expect(within(screen.getByTestId("kpi-sales")).queryByText(/\+25%/)).toBeNull());
    expect(screen.queryByTestId("sales-base-total")).toBeNull();
  });

  it("shows the money difference against the comparison next to the chart", async () => {
    await renderApp(<Sales />, { server: reportsServer() });
    expect(await screen.findByTestId("sales-total")).toHaveTextContent("₹50,000");
    await waitFor(() => expect(screen.getByTestId("sales-base-total")).toHaveTextContent("₹40,000 the period before"));
  });

  it("the granularity chips (day / week / month) change what is asked of the server", async () => {
    const server = reportsServer();
    await renderApp(<Sales />, { server });
    await screen.findByTestId("kpi-sales");
    await fireEvent.press(screen.getByTestId("granularity-week"));
    await waitFor(() => expect(server.to("GET", "/api/analytics/sales").map(queryOf).some((q) => q.granularity === "week")).toBe(true));
    expect(server.to("GET", "/api/analytics/overview").map(queryOf).some((q) => q.granularity === "week")).toBe(true);
  });

  it("this year against last year is always shown, whatever the chosen period", async () => {
    await renderApp(<Sales />, { server: reportsServer() });
    expect(await screen.findByTestId("chart-yoy")).toBeOnTheScreen();
    expect(screen.getByTestId("yoy-now")).toHaveTextContent("₹50,000 this year");
    expect(screen.getByTestId("yoy-before")).toHaveTextContent("₹40,000 last year");
  });

  it("with no sales in the period, the numbers are zero and nothing crashes", async () => {
    const empty = overview({ kpis: kpis({ orders: 0, sales: 0, net: 0, aov: 0, items: 0, customers: 0, discount: 0 }), previousKpis: kpis({ orders: 0, sales: 0, net: 0, aov: 0, items: 0, customers: 0, discount: 0 }), series: [], cancellations: { placed: 0, cancelled: 0, lost: 0, rate: 0 }, previousCancellations: { placed: 0, cancelled: 0, lost: 0, rate: 0 } });
    await renderApp(<Sales />, { server: reportsServer({ "GET /api/analytics/overview": { json: empty }, "GET /api/analytics/sales": { json: salesReport({ buckets: [], perOutlet: [] }) } }) });
    const sales = await screen.findByTestId("kpi-sales");
    expect(within(sales).getByText("₹0")).toBeOnTheScreen();
    expect(screen.queryByTestId("best-day")).not.toBeNull(); // weekdays still come from the sales report
  });

  it("when the overview fails it offers to try again", async () => {
    const server = reportsServer({ "GET /api/analytics/overview": { status: 500, json: { error: "boom" } } });
    await renderApp(<Sales />, { server });
    expect(await screen.findByText("Couldn't load this")).toBeOnTheScreen();
  });
});
