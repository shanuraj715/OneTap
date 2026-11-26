import { buildRows, type MenuSection } from "@/features/menu";
import { addLine, buildLine, emptyDraft, quantityOfItem } from "@/cart/cart";
import type { MenuItem } from "@/api/schemas";

const dish = (id: string): MenuItem => ({ id, categoryId: "c", name: id, description: "", foodType: "veg", tags: [], images: [], basePrice: 1000, variants: [], modifierGroupIds: [], isAvailable: true, sortOrder: 0 });
const sections: MenuSection[] = [
  { id: "a", name: "Momos", items: ["1", "2", "3", "4", "5"].map(dish) },
  { id: "b", name: "Drinks", items: ["6"].map(dish) },
];

describe("buildRows", () => {
  it("one dish per row on a phone, with a heading before each category", () => {
    const rows = buildRows(sections, 1);
    expect(rows.map((r) => (r.kind === "header" ? `# ${r.name} (${r.count})` : r.items.map((i) => i.id).join(",")))).toEqual(["# Momos (5)", "1", "2", "3", "4", "5", "# Drinks (1)", "6"]);
  });
  it("two per row on a tablet; the last row of a category may be short, and never mixes categories", () => {
    const rows = buildRows(sections, 2);
    expect(rows.map((r) => (r.kind === "header" ? "#" : r.items.map((i) => i.id).join(",")))).toEqual(["#", "1,2", "3,4", "5", "#", "6"]);
  });
  it("row ids are unique (a list needs that)", () => {
    const ids = buildRows(sections, 2).map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("a bad column count still shows every dish", () => {
    expect(buildRows(sections, 0).filter((r) => r.kind === "dishes")).toHaveLength(6);
    expect(buildRows([], 3)).toEqual([]);
  });
});

describe("quantityOfItem", () => {
  it("counts every size and add-on combination of the same dish", () => {
    const item = { ...dish("x"), variants: [{ id: "h", label: "Half", price: 100 }, { id: "f", label: "Full", price: 200 }] };
    let d = emptyDraft();
    d = addLine(d, buildLine(item, [], { variantId: "h", optionIds: [] }, 2));
    d = addLine(d, buildLine(item, [], { variantId: "f", optionIds: [] }, 1));
    d = addLine(d, buildLine(dish("other"), [], { optionIds: [] }, 4));
    expect(quantityOfItem(d, "x")).toBe(3);
    expect(quantityOfItem(d, "nothing")).toBe(0);
  });
});
