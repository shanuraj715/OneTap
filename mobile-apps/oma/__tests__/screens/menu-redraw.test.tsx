import { fireEvent, screen } from "@testing-library/react-native";
import * as menuFeature from "@/features/menu";
import { TakeOrderScreen } from "@/screens/TakeOrderScreen";
import { fakeServer, fx, renderApp } from "../../test/harness";

const T2 = (fx("tables-seated").tables as Array<{ id: string; number: string }>).find((t) => t.number === "T2")!.id;

/** A tap on ONE dish used to redraw every dish on the screen (the "large list that is slow to update" warning on a real menu). */
describe("a big menu stays quick", () => {
  afterEach(() => jest.restoreAllMocks());

  it("adding one dish redraws that dish — not the others", async () => {
    // a menu of 120 plain dishes in two categories
    const menu = fx("menu");
    const [momos, drinks] = menu.categories as Array<{ id: string }>;
    menu.items = Array.from({ length: 120 }, (_, i) => ({ ...menu.items[2], id: `dish${i}`, name: `Dish ${i}`, categoryId: i % 2 ? momos!.id : drinks!.id, images: [], variants: [], modifierGroupIds: [], isAvailable: true, sortOrder: i }));
    const server = fakeServer({ "GET /api/menu": { json: menu }, "GET /api/menu/unavailable": { json: { version: menu.version, unavailable: [], low: [] } } });
    await renderApp(<TakeOrderScreen tableId={T2} onDone={() => undefined} />, { server });
    for (const name of ["Drinks", "Momos"]) await fireEvent.press(await screen.findByTestId(`section-${name}`));
    await screen.findByTestId("dish-Dish 1"); // (a list only draws what is near the top: Momos is the first category)

    const drawn = jest.spyOn(menuFeature, "priceLabel"); // called every time a dish row draws itself
    await fireEvent.press(screen.getByTestId("dish-Dish 1")); // add it (one tap, no choices)
    expect(await screen.findByTestId("review-order")).toBeOnTheScreen();
    const dishesRedrawn = drawn.mock.calls.length;
    // that one dish (a few calls for its price) — and certainly not the dozens of dishes the list has drawn
    expect(dishesRedrawn).toBeGreaterThan(0);
    expect(dishesRedrawn).toBeLessThan(12);
  });
});
