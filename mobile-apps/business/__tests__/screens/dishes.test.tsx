import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { Dishes } from "@/screens/Dishes";
import { renderApp } from "../../test/harness";
import { compareReport, freshScope, itemsReport, reportsServer } from "../../test/data";

beforeEach(() => freshScope());
const open = async (server = reportsServer()) => renderApp(<Dishes />, { server });
const many = (n: number) => Array.from({ length: n }, (_, i) => ({ rank: i + 1, key: `dish ${i}`, name: `Dish ${i}`, qty: 100 - i, revenue: 100_000 * (100 - i), orders: 50, daysSold: 20, perDay: 3.3, qtyShare: 0.01, revenueShare: 0.01, previousQty: 90, change: 5 }));

describe("Dishes — best sellers", () => {
  it("ranks the dishes with what was sold, the money, the orders and how it moved against the period before", async () => {
    await open();
    const veg = await screen.findByTestId("dish-veg momos");
    expect(veg).toHaveTextContent(/1\. Veg Momos/); expect(veg).toHaveTextContent(/400 sold/); expect(veg).toHaveTextContent(/₹40,000/); expect(veg).toHaveTextContent(/220 orders/); expect(veg).toHaveTextContent(/\+33\.3%/);
    expect(screen.getByTestId("dish-chicken momos")).toHaveTextContent(/−16\.7%/);
    expect(screen.getByTestId("dish-tea")).toHaveTextContent(/new/); // sold now, not before
  });
  it("can be put in order of money instead of count", async () => {
    const items = itemsReport({ items: [...itemsReport().items.slice(0, 2), { ...itemsReport().items[2]!, revenue: 9_000_000 }] });
    await open(reportsServer({ "GET /api/analytics/items": { json: items } }));
    await screen.findByTestId("dish-tea");
    await fireEvent.press(screen.getByTestId("dishes-sort-revenue"));
    const order = () => screen.getAllByTestId(/^dish-/).map((n) => n.props.testID);
    await waitFor(() => expect(order()[0]).toBe("dish-tea"));
  });
  it("finds a dish by name, and says when none matches", async () => {
    await open();
    await screen.findByTestId("dish-tea");
    await fireEvent.changeText(screen.getByTestId("dishes-search"), "chick");
    expect(screen.queryByTestId("dish-tea")).toBeNull();
    expect(screen.getByTestId("dish-chicken momos")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("dishes-search"), "pizza");
    expect(await screen.findByText("No dish by that name")).toBeOnTheScreen();
  });
  it("shows the first 25 and the rest on request", async () => {
    await open(reportsServer({ "GET /api/analytics/items": { json: itemsReport({ items: many(40) }) } }));
    await screen.findByTestId("dish-dish 0");
    expect(screen.getAllByTestId(/^dish-/)).toHaveLength(25);
    await fireEvent.press(screen.getByText("Show all 40 dishes"));
    expect(screen.getAllByTestId(/^dish-/)).toHaveLength(40);
  });
  it("with nothing sold it says so", async () => {
    await open(reportsServer({ "GET /api/analytics/items": { json: itemsReport({ items: [], unsold: [] }) } }));
    expect(await screen.findByText("Nothing sold in this period")).toBeOnTheScreen();
  });
});

describe("Dishes — by outlet", () => {
  it("shows the best sellers of each outlet, so the store and each outlet can be told apart", async () => {
    await open();
    await fireEvent.press(await screen.findByTestId("dishes-tab-outlets"));
    const noida = await screen.findByTestId("outlet-dishes-o1");
    expect(noida).toHaveTextContent(/Veg Momos/); expect(noida).toHaveTextContent(/250/);
    expect(screen.getByTestId("outlet-dishes-o2")).toHaveTextContent(/Chicken Momos/);
    expect(screen.getByText("Acme Noida")).toBeOnTheScreen();
    expect(screen.getByText("Acme Delhi")).toBeOnTheScreen();
  });
  it("an outlet that sold nothing says so", async () => {
    const c = compareReport(); (c.outlets[1] as { topItems: unknown[] }).topItems = [];
    await open(reportsServer({ "GET /api/analytics/compare": { json: c } }));
    await fireEvent.press(await screen.findByTestId("dishes-tab-outlets"));
    expect(await screen.findByText("Nothing sold here in this period.")).toBeOnTheScreen();
  });
});

describe("Dishes — rising and falling, and not selling", () => {
  it("lists the risers, the fallers and the new sellers apart", async () => {
    await open();
    await fireEvent.press(await screen.findByTestId("dishes-tab-moving"));
    expect(await screen.findByText("Rising")).toBeOnTheScreen();
    const rows = screen.getAllByTestId(/^dish-/).map((n) => n.props.testID);
    expect(rows).toEqual(["dish-veg momos", "dish-chicken momos", "dish-tea"]); // rising, falling, new
  });
  it("names the dishes that did not sell at all", async () => {
    await open();
    await fireEvent.press(await screen.findByTestId("dishes-tab-idle"));
    expect(await screen.findByText("2 dishes did not sell")).toBeOnTheScreen();
    expect(screen.getByText("Old Special")).toBeOnTheScreen();
    expect(screen.getByText("Winter Soup")).toBeOnTheScreen();
  });
  it("is glad when every dish sold", async () => {
    await open(reportsServer({ "GET /api/analytics/items": { json: itemsReport({ unsold: [] }) } }));
    await fireEvent.press(await screen.findByTestId("dishes-tab-idle"));
    expect(await screen.findByText("Every dish sold at least once")).toBeOnTheScreen();
  });
  it("when nothing is moving it says so under each heading", async () => {
    const flat = itemsReport({ items: itemsReport().items.map((i) => ({ ...i, change: 0, previousQty: i.qty })) });
    await open(reportsServer({ "GET /api/analytics/items": { json: flat } }));
    await fireEvent.press(await screen.findByTestId("dishes-tab-moving"));
    expect(await screen.findByText("No dish is selling more than before")).toBeOnTheScreen();
    expect(screen.getByText("No dish is selling less than before")).toBeOnTheScreen();
    expect(screen.getByText("No new sellers")).toBeOnTheScreen();
    expect(within(screen.getByTestId("screen-dishes")).queryAllByTestId(/^dish-/)).toHaveLength(0);
  });
});
