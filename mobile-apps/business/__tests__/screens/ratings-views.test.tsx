import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { Ratings } from "@/screens/Ratings";
import { renderApp } from "../../test/harness";
import { customerRating, dishReviews, freshScope, queryOf, ratingsByCustomer, ratingsByDish, ratingsByOutlet, reportsServer } from "../../test/data";

beforeEach(() => freshScope());
const tab = async (id: string, server = reportsServer()) => { const v = await renderApp(<Ratings />, { server }); await fireEvent.press(await screen.findByTestId(`ratings-tab-${id}`)); return { ...v, server }; };

describe("Ratings — the four tabs", () => {
  it("has Reviews, By customer, By outlet and By dish, starting on the reviews", async () => {
    await renderApp(<Ratings />, { server: reportsServer() });
    for (const id of ["reviews", "customers", "outlets", "dishes"]) expect(await screen.findByTestId(`ratings-tab-${id}`)).toBeOnTheScreen();
    expect(await screen.findByTestId("ratings-summary")).toBeOnTheScreen();
  });
});

describe("By outlet", () => {
  it("shows all outlets together and then each outlet with its average in stars, count and share of 4–5 stars", async () => {
    await tab("outlets");
    const total = await screen.findByTestId("ro-total");
    expect(within(total).getByTestId("ro-total-average")).toHaveTextContent("4.3");
    expect(total).toHaveTextContent(/20 ratings · 7 with a comment · 13 dish ratings/);
    expect(within(total).getByLabelText("4.3 out of 5 stars")).toBeOnTheScreen();
    const noida = screen.getByTestId("ro-o1");
    expect(noida).toHaveTextContent(/Acme Noida/); expect(noida).toHaveTextContent(/12 ratings · 83% gave 4–5 stars · 9 dish ratings/); expect(noida).toHaveTextContent(/4\.4/);
    expect(screen.getByTestId("ro-o2")).toHaveTextContent(/75% gave 4–5 stars/);
  });
  it("an outlet with no ratings says so, with a dash instead of an average", async () => {
    await tab("outlets");
    const none = await screen.findByTestId("ro-o3");
    expect(none).toHaveTextContent(/No ratings yet/); expect(none).toHaveTextContent(/–/);
  });
  it("asks for the chosen period and outlets", async () => {
    const server = reportsServer();
    await tab("outlets", server);
    await screen.findByTestId("ro-total");
    expect(queryOf(server.to("GET", "/api/feedback/by-outlet")[0]!).days).toBe("30");
    await fireEvent.press(screen.getByTestId("ratings-days-90"));
    await waitFor(() => expect(server.to("GET", "/api/feedback/by-outlet").some((c) => queryOf(c).days === "90")).toBe(true));
  });
  it("a plan without ratings is told so in the server's words", async () => {
    await tab("outlets", reportsServer({ "GET /api/feedback/by-outlet": { status: 403, json: { error: "Ratings & feedback isn't included in your plan." } } }));
    expect(await screen.findByText("Not in your plan")).toBeOnTheScreen();
  });
});

describe("By customer", () => {
  it("lists each customer with their average, how many ratings, their lowest and what they said last", async () => {
    await tab("customers");
    const asha = await screen.findByTestId("rc-c1");
    expect(asha).toHaveTextContent(/Asha Rao/); expect(asha).toHaveTextContent(/9811700001/); expect(asha).toHaveTextContent(/4 ratings · lowest 4★ · last 27 Nov 2026/); expect(asha).toHaveTextContent(/“Best momos in town”/); expect(asha).toHaveTextContent(/4\.5/);
    const ravi = screen.getByTestId("rc-c2");
    expect(ravi).toHaveTextContent(/1 rating · lowest 2★/); expect(ravi).not.toHaveTextContent(/“/);
    expect(screen.getByText("2 customers")).toBeOnTheScreen();
  });
  it("search and sort are sent to the server", async () => {
    const server = reportsServer();
    await tab("customers", server);
    await screen.findByTestId("rc-c1");
    await fireEvent.changeText(screen.getByTestId("rc-search"), "ravi");
    await waitFor(() => expect(server.to("GET", "/api/feedback/by-customer").some((c) => queryOf(c).search === "ravi")).toBe(true));
    await fireEvent.press(screen.getByTestId("rc-sort-lowest"));
    await waitFor(() => expect(server.to("GET", "/api/feedback/by-customer").some((c) => queryOf(c).sort === "lowest")).toBe(true));
  });
  it("nobody matching says so", async () => {
    await tab("customers", reportsServer({ "GET /api/feedback/by-customer": { json: ratingsByCustomer({ customers: [], total: 0 }) } }));
    expect(await screen.findByText("No ratings in this time")).toBeOnTheScreen();
  });
  it("'Show more' brings the next page and adds it under the first", async () => {
    const server = reportsServer();
    server.set("GET /api/feedback/by-customer", (call) => ({ json: queryOf(call).page === "2" ? ratingsByCustomer({ page: 2, pages: 2, total: 3, customers: [customerRating({ id: "c3", name: "Meera Iyer" })] }) : ratingsByCustomer({ page: 1, pages: 2, total: 3 }) }));
    await tab("customers", server);
    await fireEvent.press(await screen.findByTestId("rc-more"));
    expect(await screen.findByTestId("rc-c3")).toBeOnTheScreen();
    expect(screen.getByTestId("rc-c1")).toBeOnTheScreen();
    expect(screen.queryByTestId("rc-more")).toBeNull();
  });
});

describe("By dish", () => {
  it("shows each dish once with its average, count, notes and each outlet's own average", async () => {
    await tab("dishes");
    const momos = await screen.findByTestId("rd-veg momos");
    expect(momos).toHaveTextContent(/Veg Momos/); expect(momos).toHaveTextContent(/4\.3/); expect(momos).toHaveTextContent(/9 ratings · 4 with a note/);
    expect(momos).toHaveTextContent(/Acme Noida 4\.5 \(6\) · Acme Delhi 3\.7 \(3\)/);
    expect(screen.getByTestId("rd-masala chai")).toHaveTextContent(/3 ratings/);
    expect(screen.getByTestId("rd-masala chai")).not.toHaveTextContent(/Acme Noida/); // one outlet: nothing to compare
  });
  it("search and sort are sent to the server", async () => {
    const server = reportsServer();
    await tab("dishes", server);
    await screen.findByTestId("rd-veg momos");
    await fireEvent.changeText(screen.getByTestId("rd-search"), "chai");
    await waitFor(() => expect(server.to("GET", "/api/feedback/by-item").some((c) => queryOf(c).search === "chai")).toBe(true));
    await fireEvent.press(screen.getByTestId("rd-sort-worst"));
    await waitFor(() => expect(server.to("GET", "/api/feedback/by-item").some((c) => queryOf(c).sort === "worst")).toBe(true));
  });
  it("touching a dish opens what was said about it, each with the dish's stars and note and the whole order's", async () => {
    const server = reportsServer();
    await tab("dishes", server);
    await fireEvent.press(await screen.findByTestId("rd-veg momos"));
    const sheet = await screen.findByTestId("dish-sheet");
    const first = await within(sheet).findByTestId("dish-review-0");
    expect(first).toHaveTextContent(/Priya/); expect(first).toHaveTextContent(/“Crispy outside”/); expect(first).toHaveTextContent(/Order A-102 · Acme Noida · 27 Nov 2026/); expect(first).toHaveTextContent(/The whole order: 5★ — “Best day!”/);
    expect(within(sheet).getByTestId("dish-review-1")).toHaveTextContent(/Ravi Kumar/);
    expect(server.to("GET", "/api/feedback/by-item/veg%20momos")).toHaveLength(1);
  });
  it("a dish with no reviews says so", async () => {
    await tab("dishes", reportsServer({ "GET /api/feedback/by-item/:key": { json: dishReviews({ reviews: [] }) } }));
    await fireEvent.press(await screen.findByTestId("rd-veg momos"));
    expect(await screen.findByText("No reviews yet.")).toBeOnTheScreen();
  });
  it("no dishes rated yet says so", async () => {
    await tab("dishes", reportsServer({ "GET /api/feedback/by-item": { json: ratingsByDish({ items: [] }) } }));
    expect(await screen.findByText("No dishes rated in this time")).toBeOnTheScreen();
  });
});

test("the made-up by-outlet answer is the shape the tests think it is", () => { expect(ratingsByOutlet().outlets).toHaveLength(3); });
