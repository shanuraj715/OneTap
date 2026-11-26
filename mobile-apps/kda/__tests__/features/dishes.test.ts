import fs from "node:fs";
import path from "node:path";
import * as S from "@/api/schemas";
import { countText, countsOf, dishRows, filterItems, foodTypeOf, parseLeft, stateAfter } from "@/features/dishes";

const { items, categories } = S.kitchenItemsSchema.parse(JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "test", "fixtures", "kitchen-items.json"), "utf8")));
const dish = (name: string) => items.find((i) => i.name === name)!;
const names = (list: S.KitchenItem[]) => list.map((i) => i.name);

describe("counting the dishes", () => {
  it("how many are sold out, unavailable, running low (the recorded menu has one of each)", () => {
    expect(countsOf(items)).toEqual({ all: 7, soldOut: 1, unavailable: 1, low: 1 });
  });
});

describe("narrowing a long list", () => {
  it("All shows everything; each filter shows only its own", () => {
    expect(filterItems(items, "all", "")).toHaveLength(7);
    expect(names(filterItems(items, "sold-out", ""))).toEqual(["Peri Peri Momos"]);
    expect(names(filterItems(items, "unavailable", ""))).toEqual(["Cold Coffee"]);
    expect(names(filterItems(items, "low", ""))).toEqual(["Corn Cheese Momos"]);
  });
  it("typed words match the name or the category, ignoring capitals and spaces around", () => {
    expect(names(filterItems(items, "all", "  CHAI "))).toEqual(["Masala Chai"]);
    expect(filterItems(items, "all", "drinks").map((i) => i.name).sort()).toEqual(["Cold Coffee", "Masala Chai"]);
  });
  it("a filter and a word work together", () => {
    expect(names(filterItems(items, "sold-out", "peri"))).toEqual(["Peri Peri Momos"]);
    expect(filterItems(items, "sold-out", "chai")).toEqual([]);
  });
});

describe("the list's rows", () => {
  it("a heading per category in the MENU's order, then its dishes", () => {
    const rows = dishRows(items, categories);
    const headings = rows.filter((r) => r.kind === "heading").map((r) => (r.kind === "heading" ? r.title : ""));
    expect(headings).toEqual(categories.filter((c) => items.some((i) => i.categoryId === c.id)).map((c) => c.name));
    expect(rows[0]!.kind).toBe("heading");
    expect(rows.filter((r) => r.kind === "dish")).toHaveLength(items.length);
  });
  it("a dish with no category goes under 'Other', last", () => {
    const rows = dishRows([{ ...dish("Masala Chai"), categoryId: null, categoryName: "" }, dish("Veg Steamed Momos")], categories);
    const headings = rows.filter((r) => r.kind === "heading").map((r) => (r.kind === "heading" ? r.title : ""));
    expect(headings[headings.length - 1]).toBe("Other");
  });
  it("nothing in, nothing out", () => expect(dishRows([], categories)).toEqual([]));
});

describe("counted dishes", () => {
  it("say how many are left", () => {
    expect(countText(dish("Corn Cheese Momos"))).toBe("2 left of 20 a day");
    expect(countText(dish("Peri Peri Momos"))).toBe("None left");
    expect(countText({ stock: { left: 5, daily: null, lowAt: 3 } })).toBe("5 left");
    expect(countText(dish("Masala Chai"))).toBe("");
  });
  it("putting a finished counted dish back leaves it sold out until it has a number", () => {
    expect(stateAfter(dish("Peri Peri Momos"), "available")).toBe("sold-out");
    expect(stateAfter(dish("Peri Peri Momos"), "available", 6)).toBe("available");
    expect(stateAfter(dish("Peri Peri Momos"), "available", 0)).toBe("sold-out");
  });
  it("an ordinary dish just becomes what was asked", () => {
    expect(stateAfter(dish("Masala Chai"), "available")).toBe("available");
    expect(stateAfter(dish("Masala Chai"), "sold-out")).toBe("sold-out");
    expect(stateAfter(dish("Masala Chai"), "unavailable")).toBe("unavailable");
  });
  it("switching a counted dish OFF is never undone by the count", () => expect(stateAfter(dish("Corn Cheese Momos"), "sold-out")).toBe("sold-out"));
});

describe("the number typed for 'left today'", () => {
  it("whole numbers from 0", () => { expect(parseLeft("0")).toBe(0); expect(parseLeft(" 12 ")).toBe(12); });
  it("nothing else: not empty, not negative, not a fraction, not words", () => {
    for (const bad of ["", "  ", "-1", "2.5", "ten", "1e3", "999999"]) expect(parseLeft(bad)).toBeNull();
  });
});

describe("the food-type mark", () => {
  it("only the three the menu knows; anything else shows no mark (a wrong 'veg' would be a claim nobody made)", () => {
    expect(foodTypeOf("veg")).toBe("veg");
    expect(foodTypeOf("egg")).toBe("egg");
    expect(foodTypeOf("non-veg")).toBe("non-veg");
    expect(foodTypeOf("vegan")).toBeNull();
    expect(foodTypeOf("")).toBeNull();
  });
});
