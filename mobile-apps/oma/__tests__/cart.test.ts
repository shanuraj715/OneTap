import * as S from "@/api/schemas";
import { addLine, buildLine, cleanPhone, countOf, createDraftStore, emptyDraft, estimateOf, lineKey, MAX_QUANTITY, phoneProblem, selectionProblems, setQuantity, toCartInput, unitPriceOf } from "@/cart/cart";
import { groupsFor } from "@/features/menu";
import fs from "node:fs";
import path from "node:path";

const menu = S.menuSchema.parse(JSON.parse(fs.readFileSync(path.join(__dirname, "..", "test", "fixtures", "menu.json"), "utf8")));
const dish = (name: string) => menu.items.find((i) => i.name === name)!;
const veg = dish("Veg Steamed Momos");        // two sizes (Half ₹60, Full ₹90) + optional "Extra dip" (0–2, +₹10 / +₹15)
const kurkure = dish("Chicken Kurkure Momos"); // ₹140 + optional dip + REQUIRED "Spice level" (exactly one)
const paneer = dish("Paneer Tandoori Momos");  // ₹130, no choices
const coffee = dish("Cold Coffee");            // sold out
const vegGroups = groupsFor(menu, veg);
const kurGroups = groupsFor(menu, kurkure);
const dip = vegGroups[0]!;
const spice = kurGroups.find((g) => g.name === "Spice level")!;
const full = veg.variants[1]!;
const half = veg.variants[0]!;

describe("what must be chosen before a dish can be added", () => {
  it("a dish with sizes needs a size", () => {
    expect(selectionProblems(veg, vegGroups, { optionIds: [] })).toEqual(["Choose a size"]);
    expect(selectionProblems(veg, vegGroups, { variantId: full.id, optionIds: [] })).toEqual([]);
  });
  it("a size that is not on the menu is refused", () => {
    expect(selectionProblems(veg, vegGroups, { variantId: "gone", optionIds: [] })).toEqual(["That size is not on the menu any more"]);
  });
  it("a REQUIRED group needs exactly the choice it asks for", () => {
    expect(selectionProblems(kurkure, kurGroups, { optionIds: [] })).toEqual(["Choose one for Spice level"]);
    expect(selectionProblems(kurkure, kurGroups, { optionIds: [spice.options[1]!.id] })).toEqual([]);
    expect(selectionProblems(kurkure, kurGroups, { optionIds: spice.options.map((o) => o.id) })[0]).toBe("Choose at most 1 for Spice level");
  });
  it("an optional group allows none, and stops at its maximum", () => {
    expect(selectionProblems(veg, vegGroups, { variantId: half.id, optionIds: [] })).toEqual([]);
    expect(selectionProblems(veg, vegGroups, { variantId: half.id, optionIds: dip.options.map((o) => o.id) })).toEqual([]); // 2 of max 2
  });
  it("an add-on the dish does not offer is never sent", () => {
    expect(selectionProblems(veg, vegGroups, { variantId: half.id, optionIds: ["not-an-option"] }).join()).toMatch(/not offered/);
  });
  it("a sold-out dish cannot be added", () => {
    expect(selectionProblems(coffee, [], { optionIds: [] })).toEqual(["Cold Coffee is sold out"]);
  });
  it("a plain dish is ready at once", () => expect(selectionProblems(paneer, [], { optionIds: [] })).toEqual([]));
});

describe("estimated prices (the server's quote is the real one)", () => {
  it("a plain dish is its price", () => expect(unitPriceOf(paneer, [], { optionIds: [] })).toBe(13000));
  it("a size is that size's price; add-ons are added on top", () => {
    expect(unitPriceOf(veg, vegGroups, { variantId: half.id, optionIds: [] })).toBe(6000);
    expect(unitPriceOf(veg, vegGroups, { variantId: full.id, optionIds: [dip.options[0]!.id] })).toBe(10000);
    expect(unitPriceOf(veg, vegGroups, { variantId: full.id, optionIds: dip.options.map((o) => o.id) })).toBe(11500);
  });
});

describe("lines and merging", () => {
  const sel = { variantId: full.id, optionIds: [dip.options[0]!.id] };
  it("builds a line with the names the waiter reads back", () => {
    const l = buildLine(veg, vegGroups, sel, 2, "  less salt ");
    expect(l).toMatchObject({ itemId: veg.id, name: "Veg Steamed Momos", variantLabel: "Full (8 pcs)", modifierLabels: ["Mayo dip"], unitPrice: 10000, quantity: 2, note: "less salt" });
  });
  it("the same choice added twice becomes one line with a bigger quantity", () => {
    let d = addLine(emptyDraft(), buildLine(veg, vegGroups, sel, 1));
    d = addLine(d, buildLine(veg, vegGroups, sel, 2));
    expect(d.lines).toHaveLength(1);
    expect(d.lines[0]!.quantity).toBe(3);
  });
  it("a different size, add-on or note is a different line", () => {
    let d = addLine(emptyDraft(), buildLine(veg, vegGroups, sel, 1));
    d = addLine(d, buildLine(veg, vegGroups, { variantId: half.id, optionIds: [] }, 1));
    d = addLine(d, buildLine(veg, vegGroups, sel, 1, "no onion"));
    expect(d.lines).toHaveLength(3);
  });
  it("the order of the add-ons does not matter, nor capital letters in the note", () => {
    const both = dip.options.map((o) => o.id);
    expect(lineKey(veg.id, full.id, both, "Less Salt")).toBe(lineKey(veg.id, full.id, [...both].reverse(), " less salt "));
  });
  it("quantity is capped at 99 (no fat-finger order of 1000)", () => {
    expect(buildLine(paneer, [], { optionIds: [] }, 500).quantity).toBe(MAX_QUANTITY);
    let d = addLine(emptyDraft(), buildLine(paneer, [], { optionIds: [] }, 98));
    d = addLine(d, buildLine(paneer, [], { optionIds: [] }, 5));
    expect(d.lines[0]!.quantity).toBe(MAX_QUANTITY);
    expect(setQuantity(d, d.lines[0]!.key, 1000).lines[0]!.quantity).toBe(MAX_QUANTITY);
  });
  it("setting the quantity to 0 removes the line", () => {
    const d = addLine(emptyDraft(), buildLine(paneer, [], { optionIds: [] }, 2));
    expect(setQuantity(d, d.lines[0]!.key, 0).lines).toEqual([]);
    expect(setQuantity(d, d.lines[0]!.key, -4).lines).toEqual([]);
    expect(setQuantity(d, d.lines[0]!.key, 5).lines[0]!.quantity).toBe(5);
  });
  it("counts dishes and sums the estimate", () => {
    let d = addLine(emptyDraft(), buildLine(paneer, [], { optionIds: [] }, 2));
    d = addLine(d, buildLine(veg, vegGroups, sel, 1));
    expect(countOf(d)).toBe(3);
    expect(estimateOf(d)).toBe(2 * 13000 + 10000);
  });
});

describe("what is sent to the server", () => {
  it("only what the server needs (it prices everything itself), in the shape its schema wants", () => {
    let d = addLine(emptyDraft(), buildLine(veg, vegGroups, { variantId: full.id, optionIds: [dip.options[0]!.id] }, 2, "less salt"));
    d = addLine(d, buildLine(paneer, [], { optionIds: [] }, 1));
    expect(toCartInput(d)).toEqual({
      lines: [
        { itemId: veg.id, variantId: full.id, modifierOptionIds: [dip.options[0]!.id], quantity: 2, note: "less salt" },
        { itemId: paneer.id, modifierOptionIds: [], quantity: 1 },
      ],
    });
  });
  it("no prices, names or estimates leave the phone", () => {
    const sent = JSON.stringify(toCartInput(addLine(emptyDraft(), buildLine(paneer, [], { optionIds: [] }, 1))));
    expect(sent).not.toMatch(/price|unitPrice|name|13000/i);
  });
  it("the recorded cart the server accepted has exactly this shape", () => {
    const cart = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "test", "fixtures", "cart-example.json"), "utf8"));
    const keys = new Set(cart.lines.flatMap((l: object) => Object.keys(l)));
    const ours = toCartInput(addLine(emptyDraft(), buildLine(veg, vegGroups, { variantId: full.id, optionIds: [dip.options[0]!.id] }, 2, "less salt"))).lines.flatMap((l) => Object.keys(l));
    for (const k of ours) expect(keys.has(k)).toBe(true);
  });
});

describe("the customer's mobile number (required when a table is opened)", () => {
  it.each([["9876543210", null], ["+91 98765 43210", null], ["98765-43210", null], ["", "Enter the customer's mobile number."], ["   ", "Enter the customer's mobile number."], ["123", "That mobile number doesn't look right."], ["1".repeat(21), "That mobile number doesn't look right."]])("%p → %p", (raw, problem) => expect(phoneProblem(raw)).toBe(problem));
  it("is sent as digits (with a leading + kept)", () => { expect(cleanPhone(" 98765 43210 ")).toBe("9876543210"); expect(cleanPhone("+91 98765-43210")).toBe("+919876543210"); });
});

describe("drafts are kept per table", () => {
  it("a waiter can go between tables without losing either order", () => {
    const store = createDraftStore();
    const { add, draftFor, setCustomer, clear, setQty } = store.getState();
    add("T1", buildLine(paneer, [], { optionIds: [] }, 1));
    add("T2", buildLine(veg, vegGroups, { variantId: half.id, optionIds: [] }, 2));
    setCustomer("T1", { name: "Mehta", phone: "9876543210" });
    expect(countOf(store.getState().draftFor("T1"))).toBe(1);
    expect(countOf(store.getState().draftFor("T2"))).toBe(2);
    expect(draftFor("T1")).toBeTruthy();
    setQty("T2", store.getState().draftFor("T2").lines[0]!.key, 0);
    expect(store.getState().draftFor("T2").lines).toEqual([]);
    expect(store.getState().draftFor("T1").name).toBe("Mehta");
    clear("T1");
    expect(store.getState().draftFor("T1")).toEqual(emptyDraft());
    store.getState().add("T3", buildLine(paneer, [], { optionIds: [] }, 1));
    store.getState().clearAll();
    expect(store.getState().drafts).toEqual({});
  });
  it("an untouched table has an empty draft (not undefined)", () => expect(createDraftStore().getState().draftFor("nowhere")).toEqual(emptyDraft()));
});
