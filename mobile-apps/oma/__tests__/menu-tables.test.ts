import * as S from "@/api/schemas";
import { buildSections, categoryPath, groupsFor, needsChoices, priceLabel } from "@/features/menu";
import { countByStatus, filterTables, moveTargets, naturalCompare, sessionForTable, sessionState, sortTables, zonesOf } from "@/features/tables";
import { isOpenStatus, paymentLabel, statusLabel, statusTone } from "@/features/orders";
import fs from "node:fs";
import path from "node:path";

const fx = (n: string) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "test", "fixtures", `${n}.json`), "utf8"));
const menu = S.menuSchema.parse(fx("menu"));
const tables = S.tablesSchema.parse(fx("tables-seated")).tables;
const sessions = S.sessionsSchema.parse(fx("sessions-active")).sessions;

describe("the menu", () => {
  it("shows each category with its dishes; sold-out dishes go last", () => {
    const sections = buildSections(menu);
    expect(sections.map((s) => s.name)).toEqual(["Momos", "Drinks"]);
    expect(sections[1]!.items.map((i) => i.name)).toEqual(["Masala Chai", "Cold Coffee"]);
    expect(sections[1]!.items.at(-1)!.isAvailable).toBe(false);
  });
  it("searches names, descriptions and tags", () => {
    expect(buildSections(menu, { query: "kurkure" })[0]!.items.map((i) => i.name)).toEqual(["Chicken Kurkure Momos"]);
    expect(buildSections(menu, { query: "cabbage" })[0]!.items[0]!.name).toBe("Veg Steamed Momos"); // from its description
    expect(buildSections(menu, { query: "bestseller" })[0]!.items[0]!.name).toBe("Veg Steamed Momos"); // from a tag
    expect(buildSections(menu, { query: "zzz" })).toEqual([]);
  });
  it("filters veg / non-veg and drops categories left empty", () => {
    const nonVeg = buildSections(menu, { foodType: "non-veg" });
    expect(nonVeg).toHaveLength(1);
    expect(nonVeg[0]!.items.map((i) => i.name)).toEqual(["Chicken Kurkure Momos"]);
  });
  it("a switched-off category (or one inside it) disappears", () => {
    const off = { ...menu, categories: menu.categories.map((c) => (c.name === "Drinks" ? { ...c, isActive: false } : c)) };
    expect(buildSections(off).map((s) => s.name)).toEqual(["Momos"]);
    const child = { ...menu.categories[0]!, id: "child", name: "Fried", parentId: menu.categories[0]!.id };
    const nested = { ...menu, categories: [...menu.categories.map((c) => (c.id === menu.categories[0]!.id ? { ...c, isActive: false } : c)), child], items: [...menu.items, { ...menu.items[0]!, id: "i-x", categoryId: "child", name: "Fried Momos" }] };
    expect(buildSections(nested).flatMap((s) => s.items.map((i) => i.name))).not.toContain("Fried Momos");
  });
  it("names a nested category by its path, and survives a loop in the data", () => {
    const cats = [{ id: "a", name: "South Indian", parentId: null, isActive: true, sortOrder: 0 }, { id: "b", name: "Dosa", parentId: "a", isActive: true, sortOrder: 0 }];
    expect(categoryPath(cats, "b")).toBe("South Indian › Dosa");
    const loop = [{ ...cats[0]!, parentId: "b" }, cats[1]!];
    expect(categoryPath(loop, "b").length).toBeGreaterThan(0); // returns, does not hang
  });
  it("tells whether a dish needs choices, and what its price reads", () => {
    const veg = menu.items.find((i) => i.name === "Veg Steamed Momos")!;
    const paneer = menu.items.find((i) => i.name === "Paneer Tandoori Momos")!;
    expect(needsChoices(veg, groupsFor(menu, veg))).toBe(true);
    expect(needsChoices(paneer, groupsFor(menu, paneer))).toBe(false);
    expect(priceLabel(veg)).toBe("from ₹60");
    expect(priceLabel(paneer)).toBe("₹130");
    expect(priceLabel({ ...veg, variants: [{ id: "x", label: "A", price: 5000 }, { id: "y", label: "B", price: 5000 }] })).toBe("₹50");
  });
});

describe("the tables", () => {
  const many: S.Table[] = ["T10", "T2", "T1", "A1"].map((n, i) => ({ id: `t${i}`, number: n, zone: n === "A1" ? "Terrace" : "", seats: 2, status: i === 1 ? "seated" : "free", isActive: true, activeSessionId: null }));
  it("sorts like a person would: T2 before T10, zones in order", () => {
    expect(naturalCompare("T2", "T10")).toBeLessThan(0);
    expect(sortTables(many).map((t) => t.number)).toEqual(["T1", "T2", "T10", "A1"]);
  });
  it("lists the zones that are in use, once each", () => expect(zonesOf(tables)).toEqual(["Ground floor", "Terrace"]));
  it("filters by zone, status and number, and hides switched-off tables", () => {
    expect(filterTables(tables, { zone: "Terrace" }).map((t) => t.number)).toEqual(["T3"]);
    expect(filterTables(tables, { status: "seated" }).map((t) => t.number)).toEqual(["T1"]);
    expect(filterTables(tables, { query: "t2" }).map((t) => t.number)).toEqual(["T2"]);
    expect(filterTables([{ ...tables[0]!, isActive: false }, tables[1]!]).map((t) => t.number)).toEqual(["T2"]);
  });
  it("counts tables by status", () => expect(countByStatus(tables)).toEqual({ all: 3, free: 2, seated: 1, "bill-requested": 0, reserved: 0 }));
  it("finds the party at a table", () => {
    expect(sessionForTable(sessions, tables.find((t) => t.number === "T1")!.id)?.customerName).toBe("Mehta family");
    expect(sessionForTable(sessions, "nothing")).toBeUndefined();
  });
  it("a party can be moved only to a free table, never to its own", () => {
    const t1 = tables.find((t) => t.number === "T1")!;
    expect(moveTargets(tables, t1.id).map((t) => t.number)).toEqual(["T2", "T3"]);
    expect(moveTargets(tables, tables.find((t) => t.number === "T2")!.id).map((t) => t.number)).toEqual(["T3"]);
  });
  it("what a seated table is waiting for", () => {
    expect(sessionState(sessions[0])).toBe("due");
    expect(sessionState({ ...sessions[0]!, allPaid: true })).toBe("paid");
    expect(sessionState({ ...sessions[0]!, orderCount: 0 })).toBe("empty");
    expect(sessionState(undefined)).toBe("empty");
  });
});

describe("order statuses", () => {
  it("reads and looks right", () => {
    expect(statusLabel("ready")).toBe("Ready to serve");
    expect(statusLabel("completed")).toBe("Served");
    expect(statusLabel("something-new")).toBe("something-new");
    expect(statusTone("ready")).toBe("ok");
    expect(statusTone("cancelled")).toBe("danger");
    expect(statusTone("something-new")).toBe("neutral");
    expect(paymentLabel("paid")).toBe("Paid");
    expect(paymentLabel("pending")).toBe("Not paid yet");
  });
  it("knows which orders are still being worked on", () => {
    for (const s of ["placed", "accepted", "preparing", "ready", "out_for_delivery"]) expect(isOpenStatus(s)).toBe(true);
    for (const s of ["completed", "cancelled"]) expect(isOpenStatus(s)).toBe(false);
  });
});
