import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { Dimensions } from "react-native";
import { DishesScreen } from "@/screens/DishesScreen";
import { toasts } from "@/ui";
import { asManager, fakeServer, fx, renderApp, type Handler } from "../../test/harness";

const messages = () => toasts.store.getState().toasts.map((t) => t.message);
const id = (name: string) => fx("kitchen-items").items.find((i: { name: string }) => i.name === name).id as string;
const posts = (s: ReturnType<typeof fakeServer>) => s.to("POST", /\/availability$/);
/** the recorded answer to a switch, for the dish that was switched */
const switched = (name: string, state: string, over: Record<string, unknown> = {}) => ({ json: { item: { ...fx("kitchen-items").items.find((i: { name: string }) => i.name === name), state, switchedOff: state !== "available", stillSoldOut: false, ...over } } });

/**
 * A kitchen whose dishes REMEMBER what was switched (like the real one): the POST changes the dish, the next GET shows it. Without this a
 * refresh after a tap would bring back the recording's old state, and a test could not tell a real change from a lost one.
 */
function rememberingServer(routes: Record<string, Handler> = {}) {
  const state = new Map<string, string>();
  return fakeServer({
    "GET /api/kitchen/items": () => { const l = fx("kitchen-items"); l.items = l.items.map((i: { id: string; state: string }) => ({ ...i, state: state.get(i.id) ?? i.state, switchedOff: (state.get(i.id) ?? i.state) !== "available" })); return { json: l }; },
    "POST /api/kitchen/items/:id/availability": (call, params) => {
      state.set(params.id!, call.body.state);
      const item = fx("kitchen-items").items.find((i: { id: string }) => i.id === params.id);
      return { json: { item: { ...item, state: call.body.state, switchedOff: call.body.state !== "available", stillSoldOut: false } } };
    },
    ...routes,
  });
}

beforeEach(() => { toasts.clear(); Dimensions.set({ window: { width: 420, height: 900, scale: 2, fontScale: 1 }, screen: { width: 420, height: 900, scale: 2, fontScale: 1 } }); });

describe("the dishes list", () => {
  it("every dish under its category, with its state; counted dishes say how many are left", async () => {
    await renderApp(<DishesScreen />);
    expect(await screen.findByTestId("dish-Masala Chai")).toBeOnTheScreen();
    expect(screen.getByText(/^Momos · 5$/)).toBeOnTheScreen();
    expect(screen.getByText(/^Drinks · 2$/)).toBeOnTheScreen();
    expect(within(screen.getByTestId("dish-Cold Coffee")).getByText("Unavailable")).toBeOnTheScreen();
    expect(within(screen.getByTestId("dish-Peri Peri Momos")).getByText("Sold out")).toBeOnTheScreen();
    expect(within(screen.getByTestId("dish-Peri Peri Momos")).getByText("None left")).toBeOnTheScreen();
    expect(within(screen.getByTestId("dish-Corn Cheese Momos")).getByText("2 left of 20 a day")).toBeOnTheScreen();
    expect(within(screen.getByTestId("dish-Masala Chai")).getByText("Available")).toBeOnTheScreen();
    expect(screen.getByText("2 off")).toBeOnTheScreen(); // how many are not on sale now, in the heading
  });

  it("the filters show their own dishes, with how many each has", async () => {
    await renderApp(<DishesScreen />);
    await screen.findByTestId("dish-Masala Chai");
    expect(screen.getByRole("button", { name: "Sold out, 1" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Unavailable, 1" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Running low, 1" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("filter-sold-out"));
    expect(screen.getByTestId("dish-Peri Peri Momos")).toBeOnTheScreen();
    expect(screen.queryByTestId("dish-Masala Chai")).toBeNull();
    await fireEvent.press(screen.getByTestId("filter-low"));
    expect(screen.getByTestId("dish-Corn Cheese Momos")).toBeOnTheScreen();
    expect(screen.queryByTestId("dish-Peri Peri Momos")).toBeNull();
    await fireEvent.press(screen.getByTestId("filter-all"));
    expect(screen.getByTestId("dish-Masala Chai")).toBeOnTheScreen();
  });

  it("the search box narrows by name or category, and says when nothing matches", async () => {
    await renderApp(<DishesScreen />);
    await screen.findByTestId("dish-Masala Chai");
    await fireEvent.changeText(screen.getByTestId("dish-search"), "chai");
    await waitFor(() => expect(screen.queryByTestId("dish-Cold Coffee")).toBeNull());
    expect(screen.getByTestId("dish-Masala Chai")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("dish-search"), "zzzz");
    expect(await screen.findByText("No dish matches")).toBeOnTheScreen();
  });

  it("a menu with no dishes says where to add them", async () => {
    await renderApp(<DishesScreen />, { server: fakeServer({ "GET /api/kitchen/items": { json: { items: [], categories: [] } } }) });
    expect(await screen.findByText("No dishes yet")).toBeOnTheScreen();
  });

  it("can't load: says so, with Try again", async () => {
    const s = fakeServer({ "GET /api/kitchen/items": { status: 500, json: { error: "The server had a problem." } } });
    await renderApp(<DishesScreen />, { server: s });
    expect(await screen.findByText("Can't load the dishes")).toBeOnTheScreen();
    s.set("GET /api/kitchen/items", { json: fx("kitchen-items") });
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByTestId("dish-Masala Chai")).toBeOnTheScreen();
  });
});

describe("marking a dish sold out, and putting it back (one tap on the row)", () => {
  it("'Sold out' on an available dish: the list changes at once, the server is told, and the cook is told it worked", async () => {
    const s = rememberingServer();
    await renderApp(<DishesScreen />, { server: s });
    await fireEvent.press(await screen.findByTestId("quick-Masala Chai"));
    expect(posts(s)[0]).toMatchObject({ path: `/api/kitchen/items/${id("Masala Chai")}/availability`, body: { state: "sold-out" } });
    expect(await within(screen.getByTestId("dish-Masala Chai")).findByText("Sold out")).toBeOnTheScreen();
    await waitFor(() => expect(messages()).toContain("Masala Chai: sold out"));
    // after the server was asked again, it is still sold out (the change was kept, not just drawn), and the button now puts it back
    await waitFor(() => expect(s.to("GET", "/api/kitchen/items").length).toBeGreaterThan(1));
    expect(within(screen.getByTestId("dish-Masala Chai")).getByText("Sold out")).toBeOnTheScreen();
    expect(within(screen.getByTestId("dish-Masala Chai")).getByRole("button", { name: "Put back" })).toBeOnTheScreen();
  });

  it("'Put back' on an unavailable dish makes it available", async () => {
    const s = rememberingServer();
    await renderApp(<DishesScreen />, { server: s });
    await fireEvent.press(await screen.findByTestId("quick-Cold Coffee"));
    expect(posts(s)[0]!.body).toEqual({ state: "available" });
    await waitFor(() => expect(messages()).toContain("Cold Coffee: available"));
  });

  it("if the server refuses, the list goes back to what it was, and the cook is told why", async () => {
    const s = fakeServer({ "POST /api/kitchen/items/:id/availability": { status: 403, json: { error: "You don't have permission to do that." } } });
    await renderApp(<DishesScreen />, { server: s });
    await fireEvent.press(await screen.findByTestId("quick-Masala Chai"));
    await waitFor(() => expect(messages()).toContain("You don't have permission to do that."));
    expect(within(screen.getByTestId("dish-Masala Chai")).getByText("Available")).toBeOnTheScreen();
  });

  it("a counted dish with none left stays sold out when put back, and the cook is told it needs a number", async () => {
    const s = fakeServer({ "POST /api/kitchen/items/:id/availability": switched("Peri Peri Momos", "sold-out", { stillSoldOut: true }) });
    await renderApp(<DishesScreen />, { server: s });
    await fireEvent.press(await screen.findByTestId("quick-Peri Peri Momos"));
    await waitFor(() => expect(messages().join(" ")).toMatch(/has none left, so it stays sold out/));
    expect(within(screen.getByTestId("dish-Peri Peri Momos")).getByText("Sold out")).toBeOnTheScreen();
  });
});

describe("a dish's own sheet: Available / Sold out / Unavailable", () => {
  it("opens on a tap, shows the three choices with what each means, and marks the current one", async () => {
    await renderApp(<DishesScreen />);
    await fireEvent.press(await screen.findByTestId("dish-Masala Chai"));
    const sheet = within(await screen.findByTestId("dish-sheet"));
    expect(sheet.getByText("Masala Chai")).toBeOnTheScreen();
    for (const t of ["Available", "Sold out", "Unavailable"]) expect(sheet.getAllByText(t).length).toBeGreaterThan(0);
    expect(sheet.getByText(/Customers and waiters can order it/)).toBeOnTheScreen();
    expect(sheet.getByText(/Finished for now/)).toBeOnTheScreen();
    expect(sheet.getByText(/Can't be made/)).toBeOnTheScreen();
  });

  it("choosing Unavailable sends it and closes the sheet", async () => {
    const s = fakeServer({ "POST /api/kitchen/items/:id/availability": switched("Masala Chai", "unavailable") });
    await renderApp(<DishesScreen />, { server: s });
    await fireEvent.press(await screen.findByTestId("dish-Masala Chai"));
    await fireEvent.press(await screen.findByTestId("state-unavailable"));
    await waitFor(() => expect(posts(s)[0]?.body).toEqual({ state: "unavailable" }));
    await waitFor(() => expect(screen.queryByTestId("dish-sheet")).toBeNull());
  });

  it("the cook gets no 'left today' box (stock numbers are the manager's)", async () => {
    await renderApp(<DishesScreen />);
    await fireEvent.press(await screen.findByTestId("dish-Corn Cheese Momos"));
    await screen.findByTestId("dish-sheet");
    expect(screen.queryByTestId("dish-left")).toBeNull();
  });
});

describe("the kitchen manager and stock numbers", () => {
  it("a counted dish has a 'left today' box, filled with what is left; saving sends the number and puts it on sale", async () => {
    const s = fakeServer({ ...asManager(), "POST /api/kitchen/items/:id/availability": switched("Corn Cheese Momos", "available") });
    await renderApp(<DishesScreen />, { server: s });
    await fireEvent.press(await screen.findByTestId("dish-Corn Cheese Momos"));
    const box = await screen.findByTestId("dish-left");
    expect(box.props.value).toBe("2");
    await fireEvent.changeText(box, "9");
    await fireEvent.press(screen.getByTestId("dish-left-save"));
    await waitFor(() => expect(posts(s)[0]?.body).toEqual({ state: "available", left: 9 }));
  });

  it("0 means sold out", async () => {
    const s = fakeServer({ ...asManager(), "POST /api/kitchen/items/:id/availability": switched("Corn Cheese Momos", "sold-out") });
    await renderApp(<DishesScreen />, { server: s });
    await fireEvent.press(await screen.findByTestId("dish-Corn Cheese Momos"));
    await fireEvent.changeText(await screen.findByTestId("dish-left"), "0");
    await fireEvent.press(screen.getByTestId("dish-left-save"));
    await waitFor(() => expect(posts(s)[0]?.body).toEqual({ state: "sold-out", left: 0 }));
  });

  it("a number that isn't a number is not sent", async () => {
    const s = fakeServer(asManager());
    await renderApp(<DishesScreen />, { server: s });
    await fireEvent.press(await screen.findByTestId("dish-Corn Cheese Momos"));
    await fireEvent.changeText(await screen.findByTestId("dish-left"), "lots");
    await fireEvent.press(screen.getByTestId("dish-left-save"));
    expect(messages().join(" ")).toMatch(/whole number/);
    expect(posts(s)).toHaveLength(0);
  });

  it("an ordinary dish (not counted) has no such box, even for the manager", async () => {
    await renderApp(<DishesScreen />, { manager: true });
    await fireEvent.press(await screen.findByTestId("dish-Masala Chai"));
    await screen.findByTestId("dish-sheet");
    expect(screen.queryByTestId("dish-left")).toBeNull();
  });
});

describe("a role that may only look", () => {
  const lookOnly = () => {
    const cook = fx("auth-app-login");
    const user = { ...cook.user, permissions: cook.user.permissions.filter((p: string) => p !== "menu:availability") };
    return fakeServer({ "POST /api/auth/app-login": { json: { ...cook, user } }, "GET /api/auth/me": { json: { user } } });
  };
  it("sees the list but no switches, and is told why", async () => {
    await renderApp(<DishesScreen />, { server: lookOnly() });
    expect(await screen.findByTestId("dish-Masala Chai")).toBeOnTheScreen();
    expect(screen.queryByTestId("quick-Masala Chai")).toBeNull();
    expect(screen.getByText("Your role can look at the dishes but not change them.")).toBeOnTheScreen();
  });
  it("the sheet shows the state but its choices do nothing", async () => {
    const s = lookOnly();
    await renderApp(<DishesScreen />, { server: s });
    await fireEvent.press(await screen.findByTestId("dish-Masala Chai"));
    await fireEvent.press(await screen.findByTestId("state-sold-out"));
    expect(posts(s)).toHaveLength(0);
  });
});
