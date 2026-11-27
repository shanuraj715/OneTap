import { Linking } from "react-native";
import { fireEvent, screen, within } from "@testing-library/react-native";
import { Customers } from "@/screens/Customers";
import { Outlets } from "@/screens/Outlets";
import { renderApp } from "../../test/harness";
import { compareReport, customersReport, freshScope, reportsServer } from "../../test/data";

beforeEach(() => freshScope());

describe("Customers", () => {
  it("counts the customers, the new ones and the ones coming back, with their shares", async () => {
    await renderApp(<Customers />, { server: reportsServer() });
    expect(within(await screen.findByTestId("cust-total")).getByText("80")).toBeOnTheScreen();
    expect(screen.getByTestId("cust-new")).toHaveTextContent(/30/); expect(screen.getByTestId("cust-new")).toHaveTextContent(/38% of customers/);
    expect(screen.getByTestId("cust-repeat")).toHaveTextContent(/50/); expect(screen.getByTestId("cust-repeat")).toHaveTextContent(/63% of customers/);
    expect(screen.getByTestId("chart-cust-split")).toBeOnTheScreen();
    expect(screen.getByTestId("chart-cust-orders")).toBeOnTheScreen();
  });
  it("shows the regulars who have gone quiet, by how long", async () => {
    await renderApp(<Customers />, { server: reportsServer() });
    expect(within(await screen.findByTestId("lapsed-30")).getByText("12")).toBeOnTheScreen();
    expect(within(screen.getByTestId("lapsed-60")).getByText("6")).toBeOnTheScreen();
    expect(within(screen.getByTestId("lapsed-90")).getByText("3")).toBeOnTheScreen();
    expect(screen.getByText(/of 200 regulars/)).toBeOnTheScreen();
  });
  it("lists the best customers with what they spent, and a nameless one is still shown", async () => {
    await renderApp(<Customers />, { server: reportsServer() });
    const ravi = await screen.findByTestId("cust-c1");
    expect(ravi).toHaveTextContent(/Ravi Kumar/); expect(ravi).toHaveTextContent(/9811111111/); expect(ravi).toHaveTextContent(/12 orders/); expect(ravi).toHaveTextContent(/₹18,000/); expect(ravi).toHaveTextContent(/27 Nov 2026/);
    expect(screen.getByTestId("cust-c3")).toHaveTextContent(/Customer/); expect(screen.getByTestId("cust-c3")).toHaveTextContent(/1 order\b/);
  });
  it("finds a customer by name or number", async () => {
    await renderApp(<Customers />, { server: reportsServer() });
    await screen.findByTestId("cust-c1");
    await fireEvent.changeText(screen.getByTestId("cust-search"), "9822");
    expect(screen.queryByTestId("cust-c1")).toBeNull();
    expect(screen.getByTestId("cust-c2")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("cust-search"), "zzz");
    expect(await screen.findByText("No customer by that name or number")).toBeOnTheScreen();
  });
  it("Call opens the phone's dialler with that number", async () => {
    const open = jest.spyOn(Linking, "openURL").mockResolvedValue();
    await renderApp(<Customers />, { server: reportsServer() });
    await fireEvent.press(await screen.findByTestId("cust-call-c2"));
    expect(open).toHaveBeenCalledWith("tel:9822222222");
    open.mockRestore();
  });
  it("with no customers it says so", async () => {
    await renderApp(<Customers />, { server: reportsServer({ "GET /api/analytics/customers": { json: customersReport({ newVsRepeat: { customers: 0, newCustomers: 0, repeatCustomers: 0 }, top: [] }) } }) });
    expect(await screen.findByText("No customers in this period")).toBeOnTheScreen();
  });
});

describe("Outlets", () => {
  it("puts every outlet's numbers on its own card", async () => {
    await renderApp(<Outlets />, { server: reportsServer() });
    expect(within(await screen.findByTestId("outlet-sales-o1")).getByText("₹30,000")).toBeOnTheScreen();
    expect(within(screen.getByTestId("outlet-orders-o1")).getByText("70")).toBeOnTheScreen();
    expect(within(screen.getByTestId("outlet-aov-o2")).getByText("₹400")).toBeOnTheScreen();
    expect(screen.getByTestId("outlet-cancel-o2")).toHaveTextContent(/10% of orders/);
  });
  it("ranks them by the chosen measure and marks the best; for cancellations the lowest is best", async () => {
    await renderApp(<Outlets />, { server: reportsServer() });
    await screen.findByTestId("outlet-sales-o1");
    expect(screen.getByText("Best: Acme Noida")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("outlets-metric-cancelled"));
    expect(await screen.findByText(/the lowest is best/)).toBeOnTheScreen();
    expect(screen.getByText(/Top in cancelled/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("outlets-metric-aov"));
    expect(await screen.findByText("Best: Acme Noida")).toBeOnTheScreen();
  });
  it("draws the days of every outlet as lines, only when there are several outlets and several days", async () => {
    await renderApp(<Outlets />, { server: reportsServer() });
    expect(await screen.findByTestId("chart-outlets-days")).toBeOnTheScreen();
  });
  it("one outlet gets no comparison chart", async () => {
    const one = compareReport(); one.outlets = [one.outlets[0]!];
    await renderApp(<Outlets />, { server: reportsServer({ "GET /api/analytics/compare": { json: one } }) });
    await screen.findByTestId("outlet-sales-o1");
    expect(screen.queryByTestId("chart-outlets-days")).toBeNull();
  });
  it("shows each outlet's best sellers", async () => {
    await renderApp(<Outlets />, { server: reportsServer() });
    await screen.findByTestId("outlet-sales-o1");
    expect(screen.getAllByText("Best sellers")).toHaveLength(2);
    const noida = screen.getByTestId("outlet-best-o1");
    expect(noida).toHaveTextContent(/Veg Momos/); expect(noida).toHaveTextContent(/Chicken Momos/); expect(noida).toHaveTextContent(/Tea/);
    expect(noida).not.toHaveTextContent(/Cold Coffee/); // only the best three
    expect(screen.getByTestId("outlet-best-o2")).toHaveTextContent(/Chicken Momos/);
  });
  it("with no outlets it says so", async () => {
    await renderApp(<Outlets />, { server: reportsServer({ "GET /api/analytics/compare": { json: compareReport({ outlets: [] }) } }) });
    expect(await screen.findByText("No outlets to compare")).toBeOnTheScreen();
  });
});
