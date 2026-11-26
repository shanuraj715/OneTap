import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { TakeOrderScreen } from "@/screens/TakeOrderScreen";
import { RuntimeProvider } from "@/runtime";
import { toasts } from "@/ui";
import { fakeServer, fx, renderApp } from "../../test/harness";

const tablesFx = fx("tables-seated").tables as Array<{ id: string; number: string }>;
const T1 = tablesFx.find((t) => t.number === "T1")!.id; // seated (Mehta family)
const T2 = tablesFx.find((t) => t.number === "T2")!.id; // free
const menuFx = fx("menu");
const idOfDish = (name: string) => menuFx.items.find((i: { name: string }) => i.name === name).id as string;
const calls = (server: ReturnType<typeof fakeServer>, path: string) => server.to("GET", path).length;
const open = (tableId = T2, server = fakeServer()) => renderApp(<TakeOrderScreen tableId={tableId} onDone={() => undefined} />, { server });
const isOpen = (el: { props: { accessibilityState?: { expanded?: boolean } } }) => el.props.accessibilityState?.expanded === true;

beforeEach(() => toasts.clear());

describe("the menu is loaded once; each order only asks what can't be ordered now", () => {
  it("the whole menu is fetched ONCE (right after sign-in), the 'unavailable' list every time an order is started", async () => {
    const server = fakeServer();
    const first = await open(T2, server);
    await screen.findByTestId("section-Momos");
    expect(calls(server, "/api/menu")).toBe(1);
    expect(calls(server, "/api/menu/unavailable")).toBe(1);
    await first.unmount();
    // another order is started (the same signed-in app, the same remembered menu)
    await render(<RuntimeProvider runtime={first.runtime}><TakeOrderScreen tableId={T1} onDone={() => undefined} /></RuntimeProvider>);
    await screen.findByTestId("section-Momos");
    await waitFor(() => expect(calls(server, "/api/menu/unavailable")).toBe(2));
    expect(calls(server, "/api/menu")).toBe(1); // the menu was NOT fetched again
    await act(async () => undefined);
  });

  it("marks the dishes the server lists, with its words, and they can't be picked", async () => {
    const server = fakeServer({ "GET /api/menu/unavailable": { json: { version: menuFx.version, unavailable: [{ id: idOfDish("Masala Chai"), label: "Available 8 AM – 11 AM" }], low: [{ id: idOfDish("Paneer Tandoori Momos"), left: 2 }] } } });
    await open(T2, server);
    await fireEvent.press(await screen.findByTestId("section-Drinks"));
    const chai = await screen.findByTestId("dish-Masala Chai");
    expect(within(chai).getByText("Available 8 AM – 11 AM")).toBeOnTheScreen();
    await fireEvent.press(chai);
    expect(screen.queryByTestId("review-order")).toBeNull();
    expect(toasts.store.getState().toasts.map((t) => t.message)).toContain("Masala Chai: Available 8 AM – 11 AM");
    await fireEvent.press(screen.getByTestId("section-Momos"));
    expect(within(await screen.findByTestId("dish-Paneer Tandoori Momos")).getByText("Only 2 left")).toBeOnTheScreen();
  });

  it("a dish that was sold out when the app started, and is not in the NEXT answer, is orderable again (it came back in stock)", async () => {
    const server = fakeServer(); // the recorded answer lists Cold Coffee
    const first = await open(T2, server);
    await fireEvent.press(await screen.findByTestId("section-Drinks"));
    expect(within(await screen.findByTestId("dish-Cold Coffee")).getByText("Sold out")).toBeOnTheScreen();
    await first.unmount();
    server.set("GET /api/menu/unavailable", { json: { version: menuFx.version, unavailable: [], low: [] } });
    await render(<RuntimeProvider runtime={first.runtime}><TakeOrderScreen tableId={T2} onDone={() => undefined} /></RuntimeProvider>);
    await fireEvent.press(await screen.findByTestId("section-Drinks"));
    await waitFor(() => expect(within(screen.getByTestId("dish-Cold Coffee")).queryByText("Sold out")).toBeNull());
    await fireEvent.press(screen.getByTestId("dish-Cold Coffee"));
    expect(toasts.store.getState().toasts).toHaveLength(0); // no "sold out" warning: it was added
    expect(screen.getByTestId("review-order")).toBeOnTheScreen();
    await act(async () => undefined);
  });

  it("when the server says its menu is a different version (a price or dish changed) the menu is loaded again — once, not in a loop", async () => {
    const server = fakeServer({ "GET /api/menu/unavailable": { json: { version: "a-newer-version", unavailable: [], low: [] } } });
    await open(T2, server);
    await screen.findByTestId("section-Momos");
    await waitFor(() => expect(calls(server, "/api/menu")).toBe(2));
    await act(async () => { await new Promise((r) => setTimeout(r, 200)); });
    expect(calls(server, "/api/menu")).toBe(2);
  });

  it("an older server without the 'unavailable' call: the app keeps working and loads the whole menu again (as before)", async () => {
    const server = fakeServer({ "GET /api/menu/unavailable": { status: 404, json: { error: "Not found" } } });
    await open(T2, server);
    expect(await screen.findByTestId("section-Momos")).toBeOnTheScreen();
    await waitFor(() => expect(calls(server, "/api/menu")).toBe(2));
    await fireEvent.press(screen.getByTestId("section-Drinks"));
    expect(await screen.findByTestId("dish-Masala Chai")).toBeOnTheScreen();
  });

  it("the unavailable list is asked again once a minute while the order screen stays open", async () => {
    jest.useFakeTimers();
    try {
      const server = fakeServer();
      await open(T2, server);
      await act(async () => { await jest.advanceTimersByTimeAsync(200); });
      const before = calls(server, "/api/menu/unavailable");
      await act(async () => { await jest.advanceTimersByTimeAsync(61_000); });
      expect(calls(server, "/api/menu/unavailable")).toBeGreaterThan(before);
      expect(calls(server, "/api/menu")).toBe(1);
    } finally { jest.useRealTimers(); }
  });
});

describe("categories start closed and open on a tap", () => {
  it("only the headings show at first, each with its count; no dish is drawn", async () => {
    await open();
    const momos = await screen.findByTestId("section-Momos");
    expect(isOpen(momos)).toBe(false);
    expect(within(momos).getByText("3")).toBeOnTheScreen();
    expect(screen.queryByTestId("dish-Paneer Tandoori Momos")).toBeNull();
    expect(screen.queryByTestId("dish-Masala Chai")).toBeNull();
  });

  it("a tap opens one category (and only that one); a second tap closes it", async () => {
    await open();
    const momos = await screen.findByTestId("section-Momos");
    await fireEvent.press(momos);
    expect(isOpen(screen.getByTestId("section-Momos"))).toBe(true);
    expect(screen.getByTestId("dish-Paneer Tandoori Momos")).toBeOnTheScreen();
    expect(screen.queryByTestId("dish-Masala Chai")).toBeNull();
    await fireEvent.press(screen.getByTestId("section-Momos"));
    expect(screen.queryByTestId("dish-Paneer Tandoori Momos")).toBeNull();
  });

  it("a closed category still says how many of its dishes are in the order", async () => {
    await open();
    await fireEvent.press(await screen.findByTestId("section-Drinks"));
    await fireEvent.press(await screen.findByTestId("dish-Masala Chai"));
    await fireEvent.press(screen.getByTestId("section-Drinks")); // close it
    expect(screen.queryByTestId("dish-Masala Chai")).toBeNull();
    expect(within(screen.getByTestId("section-Drinks")).getByText("1 in order")).toBeOnTheScreen();
  });

  it("searching opens every category that has a match, and clearing the search puts them back as they were", async () => {
    await open();
    await screen.findByTestId("section-Momos");
    await fireEvent.changeText(screen.getByTestId("dish-search"), "chai");
    expect(await screen.findByTestId("dish-Masala Chai")).toBeOnTheScreen();
    expect(screen.queryByTestId("section-Momos")).toBeNull(); // nothing matches there
    await fireEvent.press(screen.getByRole("button", { name: "Clear Find a dish" }));
    await waitFor(() => expect(screen.queryByTestId("dish-Masala Chai")).toBeNull());
    expect(isOpen(screen.getByTestId("section-Drinks"))).toBe(false);
  });

  it("picking a category from the dropdown shows that category, open", async () => {
    await open();
    await screen.findByTestId("section-Momos");
    await fireEvent.press(screen.getByTestId("category-dropdown"));
    await fireEvent.press(screen.getByRole("menuitem", { name: /Drinks/ }));
    expect(await screen.findByTestId("dish-Masala Chai")).toBeOnTheScreen();
    expect(screen.queryByTestId("section-Momos")).toBeNull();
  });

  it("the search box and filters are NOT part of the scrolling list (they stay put while the menu scrolls)", async () => {
    await open();
    await screen.findByTestId("section-Momos");
    const filters = screen.getByTestId("menu-filters");
    // the list's rows live in a sibling; the filters are a plain View above it
    expect(within(filters).getByTestId("dish-search")).toBeOnTheScreen();
    expect(within(filters).getByTestId("category-dropdown")).toBeOnTheScreen();
    expect(within(filters).getByLabelText("Food type")).toBeOnTheScreen();
    expect(within(filters).queryByTestId("section-Momos")).toBeNull();
  });
});

describe("food type icons and dish pictures", () => {
  it("each food-type choice has its own icon before its words (the green / egg / red marks)", async () => {
    await open();
    await screen.findByTestId("section-Momos");
    const group = within(screen.getByLabelText("Food type"));
    expect(group.getByLabelText("Vegetarian")).toBeOnTheScreen();
    expect(group.getByLabelText("Contains egg")).toBeOnTheScreen();
    expect(group.getByLabelText("Non-vegetarian")).toBeOnTheScreen();
    for (const word of ["All", "Veg", "Egg", "Non-veg"]) expect(group.getByRole("radio", { name: word })).toBeOnTheScreen();
  });

  it("a dish with a picture shows it (the API's address put in front of the path); a dish without one shows a placeholder, so rows line up", async () => {
    await open();
    await fireEvent.press(await screen.findByTestId("section-Drinks"));
    const chai = within(await screen.findByTestId("dish-Masala Chai"));
    expect(chai.getByTestId("dish-image").props.source).toEqual({ uri: "https://api.example.test/uploads/masala-chai.webp" });
    expect(within(screen.getByTestId("dish-Cold Coffee")).getByTestId("dish-image-placeholder", { hidden: true })).toBeOnTheScreen();
  });

  it("a picture that can't be loaded gives way to the placeholder (no hole, no error)", async () => {
    await open();
    await fireEvent.press(await screen.findByTestId("section-Drinks"));
    const chai = within(await screen.findByTestId("dish-Masala Chai"));
    await fireEvent(chai.getByTestId("dish-image"), "error");
    expect(chai.queryByTestId("dish-image")).toBeNull();
    expect(chai.getByTestId("dish-image-placeholder", { hidden: true })).toBeOnTheScreen();
  });

  it("a menu with no pictures at all keeps the rows compact (no empty slots)", async () => {
    const m = fx("menu"); m.items.forEach((i: { images: unknown[] }) => { i.images = []; });
    await open(T2, fakeServer({ "GET /api/menu": { json: m } }));
    await fireEvent.press(await screen.findByTestId("section-Drinks"));
    await screen.findByTestId("dish-Masala Chai");
    expect(screen.queryByTestId("dish-image-placeholder", { hidden: true })).toBeNull();
  });
});

describe("customer search under the mobile-number box", () => {
  const review = async (server = fakeServer()) => {
    await open(T2, server);
    await fireEvent.press(await screen.findByTestId("section-Drinks"));
    await fireEvent.press(await screen.findByTestId("dish-Masala Chai"));
    await fireEvent.press(screen.getByTestId("review-order"));
    await screen.findByTestId("order-phone");
    return server;
  };
  const type = (digits: string) => fireEvent.changeText(screen.getByTestId("order-phone"), digits);
  const askedFor = (server: ReturnType<typeof fakeServer>) => server.to("GET", "/api/orders/staff/customers").map((c) => new URLSearchParams(c.query).get("q"));

  it("a few digits show the matching customers; tapping one fills the number and the name", async () => {
    const server = await review();
    await type("98765");
    expect(await screen.findByTestId("customer-hits")).toBeOnTheScreen();
    expect(screen.getByTestId("customer-hit-9876599999")).toBeOnTheScreen();
    expect(screen.getByTestId("customer-hit-9876543210")).toBeOnTheScreen();
    expect(within(screen.getByTestId("customer-hit-9876543210")).getByText("Mehta family")).toBeOnTheScreen();
    expect(askedFor(server)).toEqual(["98765"]);
    await fireEvent.press(screen.getByTestId("customer-hit-9876599999"));
    expect(screen.getByTestId("order-phone").props.value).toBe("9876599999");
    expect(screen.getByTestId("order-name").props.value).toBe("Sita Verma");
    expect(screen.queryByTestId("customer-hits")).toBeNull(); // the list goes away once someone is picked
  });

  it("typing fast asks the server ONCE (for what was typed), and fewer than 3 digits ask nothing", async () => {
    const server = await review();
    for (const d of ["9", "98", "987", "9876", "98765"]) await type(d);
    await screen.findByTestId("customer-hits");
    expect(askedFor(server)).toEqual(["98765"]);
  });

  it("nobody matches: no list, and a plain note that this is a new customer", async () => {
    await review();
    await type("77777");
    expect(await screen.findByText("New customer — no earlier visit with this number.")).toBeOnTheScreen();
    expect(screen.queryByTestId("customer-hits")).toBeNull();
  });

  it("a FULL 10-digit number that matches exactly ONE customer fills the form by itself (no tap)", async () => {
    await review();
    await type("98765");
    await screen.findByTestId("customer-hits"); // the list was there while typing…
    await type("9876543210"); // …and the waiter keeps typing without tapping it
    expect(await screen.findByTestId("customer-found")).toHaveTextContent(/Existing customer: Mehta family/);
    await waitFor(() => expect(screen.getByTestId("order-name").props.value).toBe("Mehta family"));
    expect(screen.queryByTestId("customer-hits")).toBeNull();
  });

  it("…but never over a name the waiter already typed", async () => {
    await review();
    await fireEvent.changeText(screen.getByTestId("order-name"), "Dad");
    await type("9876543210");
    await screen.findByTestId("customer-found");
    expect(screen.getByTestId("order-name").props.value).toBe("Dad");
  });

  it("…and only once per number: if the waiter clears the name afterwards it stays cleared", async () => {
    await review();
    await type("9876543210");
    await waitFor(() => expect(screen.getByTestId("order-name").props.value).toBe("Mehta family"));
    await fireEvent.changeText(screen.getByTestId("order-name"), "");
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    expect(screen.getByTestId("order-name").props.value).toBe("");
  });

  it("a full number with NO match is just a new customer (nothing is filled)", async () => {
    await review();
    await type("9000000000");
    await screen.findByText("New customer — no earlier visit with this number.");
    expect(screen.getByTestId("order-name").props.value).toBe("");
    expect(screen.queryByTestId("customer-found")).toBeNull();
  });

  it("the order is sent with the number that was filled in", async () => {
    const server = await review();
    await fireEvent.press(await screen.findByTestId("order-phone"));
    await type("9876543210");
    await waitFor(() => expect(screen.getByTestId("order-name").props.value).toBe("Mehta family"));
    await fireEvent.press(screen.getByTestId("send-order"));
    await waitFor(() => expect(server.to("POST", "/api/orders/staff")).toHaveLength(1));
    expect(server.to("POST", "/api/orders/staff")[0]!.body).toMatchObject({ tableId: T2, phone: "9876543210", name: "Mehta family" });
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
  });

  it("at a table that already has a party there is no number box and no search", async () => {
    const server = fakeServer();
    await open(T1, server);
    await fireEvent.press(await screen.findByTestId("section-Drinks"));
    await fireEvent.press(await screen.findByTestId("dish-Masala Chai"));
    await fireEvent.press(screen.getByTestId("review-order"));
    await screen.findByTestId("send-order");
    expect(screen.queryByTestId("order-phone")).toBeNull();
    expect(server.to("GET", "/api/orders/staff/customers")).toHaveLength(0);
  });
});

describe("the compact header", () => {
  it("one slim line says which table and whose bill", async () => {
    await open(T1);
    expect(await screen.findByLabelText(/^Table T1, Ground floor\. Adding to the bill of Mehta family/)).toBeOnTheScreen();
  });
  it("the clear-filters button of an empty search is centred, not left-aligned", async () => {
    await open();
    await screen.findByTestId("section-Momos");
    await fireEvent.changeText(screen.getByTestId("dish-search"), "zzzzzz");
    const button = await screen.findByRole("button", { name: "Clear filters" });
    expect(StyleSheet.flatten(button.props.style).alignSelf).toBe("center");
  });
});
