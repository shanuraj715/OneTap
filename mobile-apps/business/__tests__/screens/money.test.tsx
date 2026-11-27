import { StyleSheet } from "react-native";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { Money } from "@/screens/Money";
import { usePnlPlan } from "@/data/pnlPlan";
import { useScope } from "@/data/scope";
import { darkColors, lightColors } from "@/ui/theme";
import { ACCOUNTANT, renderApp } from "../../test/harness";
import { cashReport, expense, expensesReport, freshScope, gstReport, options, queryOf, reportsServer } from "../../test/data";

beforeEach(() => { freshScope(); usePnlPlan.getState().reset(); });
const colourOf = (node: ReturnType<typeof screen.getByText>) => (StyleSheet.flatten(node.props.style) as { color?: string }).color;
const open = async (tab: string, server = reportsServer(), as?: Parameters<typeof renderApp>[1]) => {
  const view = await renderApp(<Money />, { server, ...as });
  await fireEvent.press(await screen.findByTestId(`money-tab-${tab}`));
  return view;
};

describe("Money — profit & loss", () => {
  it("works out the profit: net sales − food cost − bills written down", async () => {
    await renderApp(<Money />, { server: reportsServer() });
    expect(await screen.findByTestId("pnl-net")).toHaveTextContent("₹8,000"); // 40,000 − 35% food (14,000) − 18,000 bills
    expect(screen.getByText("20% margin")).toBeOnTheScreen();
    expect([darkColors.ok, lightColors.ok]).toContain(colourOf(screen.getByTestId("pnl-net")));
    expect(within(screen.getByTestId("pnl-sales")).getByText("₹40,000")).toBeOnTheScreen();
    expect(within(screen.getByTestId("pnl-food")).getByText("₹14,000")).toBeOnTheScreen();
    expect(within(screen.getByTestId("pnl-gross")).getByText("₹26,000")).toBeOnTheScreen();
    expect(within(screen.getByTestId("pnl-expenses")).getByText("₹18,000")).toBeOnTheScreen();
    expect(within(screen.getByTestId("pnl-breakeven")).getByText("₹923")).toBeOnTheScreen(); // 18,000 ÷ 65% ÷ 30 days
  });

  it("a profit is green and a loss is red", async () => {
    await renderApp(<Money />, { server: reportsServer({ "GET /api/analytics/pnl": { json: { ...reportsPnl(), recorded: [{ key: "rent", label: "Rent", amount: 50_000 }] } } }) });
    const net = await screen.findByTestId("pnl-net");
    expect(net).toHaveTextContent("−₹24,000");
    expect([darkColors.danger, lightColors.danger]).toContain(colourOf(net));
  });

  it("changing the food cost percentage works the numbers again, and it is remembered", async () => {
    await renderApp(<Money />, { server: reportsServer() });
    await screen.findByTestId("pnl-net");
    await fireEvent.changeText(screen.getByTestId("pnl-food-input"), "50");
    await waitFor(() => expect(screen.getByTestId("pnl-net")).toHaveTextContent("₹2,000")); // 40,000 − 20,000 − 18,000
    expect(usePnlPlan.getState().foodCostPct).toBe(50);
  });

  it("a food cost that isn't 0 to 100 is refused with a message and the last good number stays", async () => {
    await renderApp(<Money />, { server: reportsServer() });
    await screen.findByTestId("pnl-net");
    for (const bad of ["150", "abc", ""]) {
      await fireEvent.changeText(screen.getByTestId("pnl-food-input"), bad);
      expect(await screen.findByText("Type a number from 0 to 100.")).toBeOnTheScreen();
      expect(screen.getByTestId("pnl-net")).toHaveTextContent("₹8,000");
    }
    expect(usePnlPlan.getState().foodCostPct).toBeNull();
  });

  it("with no bills written down it says where to add them", async () => {
    await renderApp(<Money />, { server: reportsServer({ "GET /api/analytics/pnl": { json: { ...reportsPnl(), recorded: [] } } }) });
    expect(await screen.findByText("No bills written down for this period")).toBeOnTheScreen();
    expect(screen.getByTestId("pnl-net")).toHaveTextContent("₹26,000"); // nothing taken off but the food
  });

  describe("monthly estimates", () => {
    beforeEach(() => { useScope.getState().setCustom({ from: "2026-10-01", to: "2026-10-31" }); }); // one whole calendar month: a monthly bill counts exactly once
    it("starts empty, takes a rent, and counts it once for a calendar month", async () => {
      await renderApp(<Money />, { server: reportsServer() });
      await fireEvent.press(await screen.findByTestId("pnl-mode-monthly"));
      expect(await screen.findByText("No monthly estimates yet")).toBeOnTheScreen();
      await fireEvent.press(screen.getByTestId("pnl-line-add"));
      expect(screen.getByTestId("pnl-line-save")).toBeDisabled();
      await fireEvent.changeText(screen.getByTestId("pnl-line-label"), "Rent");
      await fireEvent.changeText(screen.getByTestId("pnl-line-monthly"), "31,000");
      await fireEvent.press(screen.getByTestId("pnl-line-save"));
      await waitFor(() => expect(screen.getByTestId("pnl-net")).toHaveTextContent("−₹5,000")); // 40,000 − 14,000 − 31,000
      expect(within(screen.getByTestId("pnl-expenses")).getByText("₹31,000")).toBeOnTheScreen();
      expect(usePnlPlan.getState().lines).toHaveLength(1);
    });
    it("a line can be taken away again", async () => {
      usePnlPlan.setState({ mode: "monthly", lines: [{ id: "l1", label: "Rent", monthly: 31_000 }] });
      await renderApp(<Money />, { server: reportsServer() });
      await fireEvent.press(await screen.findByTestId("pnl-line-remove-l1"));
      expect(await screen.findByText("No monthly estimates yet")).toBeOnTheScreen();
      expect(usePnlPlan.getState().lines).toEqual([]);
    });
    it("won't add a line without a name or without an amount above 0", async () => {
      usePnlPlan.setState({ mode: "monthly" });
      await renderApp(<Money />, { server: reportsServer() });
      await fireEvent.press(await screen.findByTestId("pnl-line-add"));
      await fireEvent.changeText(screen.getByTestId("pnl-line-label"), "Rent");
      await fireEvent.changeText(screen.getByTestId("pnl-line-monthly"), "0");
      expect(screen.getByTestId("pnl-line-save")).toBeDisabled();
      await fireEvent.changeText(screen.getByTestId("pnl-line-label"), "  ");
      await fireEvent.changeText(screen.getByTestId("pnl-line-monthly"), "500");
      expect(screen.getByTestId("pnl-line-save")).toBeDisabled();
    });
  });

  it("shows sales by outlet when there are several", async () => {
    await renderApp(<Money />, { server: reportsServer() });
    expect(await screen.findByText("Sales by outlet")).toBeOnTheScreen();
  });
});

describe("Money — expenses", () => {
  it("totals what was spent, against the period before (more spending is bad news), with the bills listed", async () => {
    await open("expenses");
    const total = await screen.findByTestId("exp-total");
    expect(within(total).getByText("₹18,000")).toBeOnTheScreen();
    const delta = within(total).getByText(/\+50%/);
    expect([darkColors.danger, lightColors.danger]).toContain(colourOf(delta));
    expect(within(screen.getByTestId("exp-bills")).getByText("2")).toBeOnTheScreen();
    expect(screen.getByTestId("expense-e1")).toHaveTextContent(/November rent/);
    expect(screen.getByTestId("expense-e2")).toHaveTextContent(/Vegetables/);
    expect(await screen.findByTestId("chart-exp-categories")).toBeOnTheScreen();
  });

  it("choosing a kind of bill asks the server for just that kind", async () => {
    const server = reportsServer();
    await open("expenses", server);
    await screen.findByTestId("exp-total");
    await fireEvent.press(screen.getByTestId("exp-cat-rent"));
    await waitFor(() => expect(server.to("GET", "/api/analytics/expenses").map(queryOf).some((q) => q.category === "rent")).toBe(true));
  });

  it("with no bills it says so and points at the Add button", async () => {
    await open("expenses", reportsServer({ "GET /api/analytics/expenses": { json: expensesReport({ entries: [], totals: { amount: 0, entries: 0, previous: 0, change: null, perDay: 0 }, byCategory: [], byOutlet: [], byPaymentMode: [], byVendor: [], series: [] }) } }));
    expect(await screen.findByText("No bills in this period")).toBeOnTheScreen();
    expect(screen.getByText(/Press “Add expense”/)).toBeOnTheScreen();
  });

  describe("adding", () => {
    it("won't save until there is an amount above 0, then writes the bill down and reloads the lists", async () => {
      const server = reportsServer({ "POST /api/analytics/expenses": { json: { expense: expense({ id: "e3" }) } } });
      await open("expenses", server);
      await screen.findByTestId("exp-total");
      const before = server.to("GET", "/api/analytics/expenses").length;
      await fireEvent.press(screen.getByTestId("expense-add"));
      expect(screen.getByTestId("expense-save")).toBeDisabled();
      await fireEvent.changeText(screen.getByTestId("expense-amount"), "0");
      expect(await screen.findByText("Type an amount more than 0.")).toBeOnTheScreen();
      expect(screen.getByTestId("expense-save")).toBeDisabled();
      await fireEvent.changeText(screen.getByTestId("expense-amount"), "1,250.50");
      await fireEvent.changeText(screen.getByTestId("expense-label"), "  Gas cylinder ");
      await fireEvent.changeText(screen.getByTestId("expense-vendor"), "Indane");
      await act(async () => { await fireEvent.press(screen.getByTestId("expense-save")); });
      await waitFor(() => expect(server.to("POST", "/api/analytics/expenses")).toHaveLength(1));
      const body = server.to("POST", "/api/analytics/expenses")[0]!.body;
      expect(body).toMatchObject({ amount: 1250.5, category: "raw_materials", label: "Gas cylinder", vendor: "Indane", outletId: null, paymentMode: "cash" });
      expect(body.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(await screen.findByText("Expense saved.")).toBeOnTheScreen();
      await waitFor(() => expect(server.to("GET", "/api/analytics/expenses").length).toBeGreaterThan(before));
      expect(screen.queryByTestId("expense-sheet")).toBeNull();
    });

    it("when the server says no, the person is told why and the form stays open", async () => {
      const server = reportsServer({ "POST /api/analytics/expenses": { status: 422, json: { error: "That amount looks too big — check the number" } } });
      await open("expenses", server);
      await fireEvent.press(await screen.findByTestId("expense-add"));
      await fireEvent.changeText(screen.getByTestId("expense-amount"), "9999999");
      await act(async () => { await fireEvent.press(screen.getByTestId("expense-save")); });
      expect(await screen.findByText("That amount looks too big — check the number")).toBeOnTheScreen();
      expect(screen.getByTestId("expense-amount")).toBeOnTheScreen();
    });
  });

  describe("changing and removing", () => {
    it("pressing a bill opens it with its values, and saving sends the change", async () => {
      const server = reportsServer({ "PUT /api/analytics/expenses/:id": { json: { expense: expense() } } });
      await open("expenses", server);
      await fireEvent.press(await screen.findByTestId("expense-e1"));
      expect(screen.getByTestId("expense-amount").props.value).toBe("10000");
      expect(screen.getByTestId("expense-label").props.value).toBe("November rent");
      await fireEvent.changeText(screen.getByTestId("expense-amount"), "10500");
      await act(async () => { await fireEvent.press(screen.getByTestId("expense-save")); });
      await waitFor(() => expect(server.to("PUT", "/api/analytics/expenses/e1")).toHaveLength(1));
      expect(server.to("PUT", "/api/analytics/expenses/e1")[0]!.body).toMatchObject({ amount: 10500, category: "rent", label: "November rent", outletId: "o1", vendor: "Mr Shah", paymentMode: "bank", day: "2026-11-27" });
      expect(await screen.findByText("Expense changed.")).toBeOnTheScreen();
    });

    it("removing asks first, and only then deletes", async () => {
      const server = reportsServer({ "DELETE /api/analytics/expenses/:id": { json: { id: "e1" } } });
      await open("expenses", server);
      await fireEvent.press(await screen.findByTestId("expense-e1"));
      await fireEvent.press(screen.getByTestId("expense-remove"));
      expect(await screen.findByText("Remove this expense?")).toBeOnTheScreen();
      expect(server.to("DELETE", "/api/analytics/expenses/e1")).toHaveLength(0);
      await act(async () => { await fireEvent.press(screen.getByTestId("confirm-yes")); });
      await waitFor(() => expect(server.to("DELETE", "/api/analytics/expenses/e1")).toHaveLength(1));
      expect(await screen.findByText("Expense removed.")).toBeOnTheScreen();
    });
  });

  it("someone who may read the money but not write it sees the bills without Add, change or remove", async () => {
    await open("expenses", reportsServer({ "GET /api/analytics/options": { json: options({ canWriteExpenses: false }) } }), { signedInAs: ACCOUNTANT });
    await screen.findByTestId("exp-total");
    expect(screen.queryByTestId("expense-add")).toBeNull();
    await fireEvent.press(screen.getByTestId("expense-e1"));
    expect(screen.queryByTestId("expense-sheet")).toBeNull();
  });
});

describe("Money — GST", () => {
  it("shows the tax collected, split into CGST and SGST, and by day", async () => {
    await open("gst");
    expect(within(await screen.findByTestId("gst-taxable")).getByText("₹5,000")).toBeOnTheScreen();
    expect(within(screen.getByTestId("gst-cgst")).getByText("₹125")).toBeOnTheScreen();
    expect(within(screen.getByTestId("gst-sgst")).getByText("₹125")).toBeOnTheScreen();
    expect(within(screen.getByTestId("gst-tax")).getByText("₹250")).toBeOnTheScreen();
    expect(within(screen.getByTestId("gst-service")).getByText("₹50")).toBeOnTheScreen();
    expect(within(screen.getByTestId("gst-total")).getByText("₹5,300")).toBeOnTheScreen();
    expect(screen.getByTestId("gst-day-2026-11-27")).toHaveTextContent(/15 orders/);
    expect(screen.getByTestId("chart-gst")).toBeOnTheScreen();
  });
  it("with no orders it says so instead of showing zeros", async () => {
    await open("gst", reportsServer({ "GET /api/analytics/gst": { json: gstReport({ days: [], totals: { orders: 0, taxable: 0, cgst: 0, sgst: 0, tax: 0, service: 0, total: 0 } }) } }));
    expect(await screen.findByText("No bills in this period")).toBeOnTheScreen();
  });
});

describe("Money — cash", () => {
  it("shows what was collected, what is still to collect and what was cancelled, with the ways of paying named plainly", async () => {
    await open("cash");
    expect(within(await screen.findByTestId("cash-collected")).getByText("₹50,000")).toBeOnTheScreen();
    expect(within(screen.getByTestId("cash-pending")).getByText("₹1,200")).toBeOnTheScreen();
    expect(screen.getByTestId("cash-pending")).toHaveTextContent(/3 orders/);
    expect(within(screen.getByTestId("cash-cancelled")).getByText("₹400")).toBeOnTheScreen();
    expect(screen.getByTestId("cash-row-cod")).toHaveTextContent(/Cash/);
    expect(screen.getByTestId("cash-row-cod")).toHaveTextContent(/₹30,000/);
    expect(screen.getByTestId("cash-row-razorpay")).toHaveTextContent(/Online/);
  });
  it("with no payments it says so", async () => {
    await open("cash", reportsServer({ "GET /api/analytics/cash": { json: cashReport({ rows: [], collected: 0 }) } }));
    expect(await screen.findByText("No payments in this period")).toBeOnTheScreen();
  });
});

describe("Money — a failing report", () => {
  it("is said plainly, with a way to try again", async () => {
    await open("gst", reportsServer({ "GET /api/analytics/gst": { status: 500, json: { error: "boom" } } }));
    expect(await screen.findByText("Couldn't load this")).toBeOnTheScreen();
  });
});

function reportsPnl() {
  return { range: { from: "2026-10-30", to: "2026-11-28" }, total: { sales: 5_000_000, net: 4_000_000, tax: 250_000, orders: 100 }, perOutlet: [], recorded: [] as { key: string; label: string; amount: number }[] };
}
