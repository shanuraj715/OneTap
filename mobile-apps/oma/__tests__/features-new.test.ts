import type { Menu, MenuItem, Table, Unavailable } from "@/api/schemas";
import { buildRows, buildSections, menuHasPictures, withAvailability } from "@/features/menu";
import { buildTableRows, groupTablesByZone, NO_ZONE_LABEL, summarizeZone } from "@/features/tables";
import { pictureOf, resolveImageUrl } from "@/lib/images";

const dish = (id: string, extra: Partial<MenuItem> = {}): MenuItem => ({ id, categoryId: "c1", name: id, description: "", foodType: "veg", tags: [], images: [], basePrice: 1000, variants: [], modifierGroupIds: [], isAvailable: true, sortOrder: 0, ...extra });
const menu = (items: MenuItem[]): Menu => ({ categories: [{ id: "c1", name: "Momos", parentId: null, isActive: true, sortOrder: 0 }, { id: "c2", name: "Drinks", parentId: null, isActive: true, sortOrder: 1 }], items, modifierGroups: [] });
const table = (number: string, zone: string, status: Table["status"] = "free", seats = 4): Table => ({ id: `id-${number}`, number, zone, seats, status, isActive: true, activeSessionId: null });

describe("withAvailability: the menu is loaded once, what can't be ordered comes from the small answer", () => {
  const base = menu([dish("a"), dish("b", { isAvailable: false }), dish("c")]);
  it("marks the dishes in the answer, with the words to show", () => {
    const answer: Unavailable = { unavailable: [{ id: "c", label: "Available 8 AM – 11 AM" }], low: [{ id: "a", left: 2 }] };
    const out = withAvailability(base, answer).items;
    expect(out.find((i) => i.id === "c")).toMatchObject({ isAvailable: false, unavailableLabel: "Available 8 AM – 11 AM" });
    expect(out.find((i) => i.id === "a")).toMatchObject({ isAvailable: true, lowLeft: 2, unavailableLabel: null });
  });
  it("a dish NOT in the answer can be ordered — even one the first copy of the menu said was off (it came back in stock)", () => {
    const out = withAvailability(base, { unavailable: [], low: [] }).items;
    expect(out.find((i) => i.id === "b")).toMatchObject({ isAvailable: true });
  });
  it("before the first answer the menu is shown as it is", () => expect(withAvailability(base, undefined)).toBe(base));
  it("does not change the menu it was given", () => {
    const before = JSON.stringify(base);
    withAvailability(base, { unavailable: [{ id: "a", label: "Sold out" }], low: [] });
    expect(JSON.stringify(base)).toBe(before);
  });
  it("sold-out dishes still go to the end of their category", () => {
    const m = withAvailability(menu([dish("a"), dish("b"), dish("c")]), { unavailable: [{ id: "a", label: "Sold out" }], low: [] });
    expect(buildSections(m)[0]!.items.map((i) => i.id)).toEqual(["b", "c", "a"]);
  });
});

describe("accordion rows: dishes of a closed category are not rows", () => {
  const sections = buildSections(menu([dish("a"), dish("b"), dish("c", { categoryId: "c2" })]));
  it("everything closed: just the headings, with their counts", () => {
    const rows = buildRows(sections, 1, new Set());
    expect(rows.map((r) => r.kind)).toEqual(["header", "header"]);
    expect(rows[0]).toMatchObject({ name: "Momos", count: 2, expanded: false });
  });
  it("one open: its dishes follow its heading, in rows of the column count", () => {
    const rows = buildRows(sections, 2, new Set(["c1"]));
    expect(rows.map((r) => (r.kind === "header" ? `# ${r.name}${r.expanded ? "+" : ""}` : r.items.map((i) => i.id).join(",")))).toEqual(["# Momos+", "a,b", "# Drinks"]);
  });
  it("'all' opens every category", () => expect(buildRows(sections, 1, "all").filter((r) => r.kind === "dishes")).toHaveLength(3));
});

describe("menuHasPictures", () => {
  it("is true as soon as one dish has a picture (then every row keeps a picture slot)", () => {
    expect(menuHasPictures(menu([dish("a")]))).toBe(false);
    expect(menuHasPictures(menu([dish("a"), dish("b", { images: [{ url: "/uploads/b.webp" }] })]))).toBe(true);
  });
});

describe("tables grouped by their area", () => {
  const all = [table("T10", "Terrace"), table("T2", "Ground floor"), table("T1", "Ground floor"), table("X1", ""), table("T3", "First floor")];
  it("areas A–Z, tables with no area last, tables in number order inside an area (T2 before T10)", () => {
    const g = groupTablesByZone(all);
    expect(g.map((x) => x.label)).toEqual(["First floor", "Ground floor", "Terrace", NO_ZONE_LABEL]);
    expect(g[1]!.tables.map((t) => t.number)).toEqual(["T1", "T2"]);
  });
  it("counts what is going on in an area", () => {
    expect(summarizeZone([table("A", "z", "free"), table("B", "z", "seated"), table("C", "z", "seated"), table("D", "z", "bill-requested"), table("E", "z", "reserved")])).toEqual({ total: 5, free: 1, seated: 2, billAsked: 1, reserved: 1 });
  });
  it("closed areas are just their headings (with the summary); open ones show their tables in rows", () => {
    const g = groupTablesByZone([table("T1", "A"), table("T2", "A"), table("T3", "A"), table("T4", "B")]);
    const closed = buildTableRows(g, 2, new Set());
    expect(closed.map((r) => r.kind)).toEqual(["header", "header"]);
    expect(closed[0]).toMatchObject({ label: "A", count: 3, expanded: false, summary: { total: 3, free: 3 } });
    const one = buildTableRows(g, 2, new Set(["A"]));
    expect(one.map((r) => (r.kind === "header" ? `#${r.label}` : r.tables.map((t) => t.number).join(",")))).toEqual(["#A", "T1,T2", "T3", "#B"]);
  });
  it("row ids are unique", () => {
    const ids = buildTableRows(groupTablesByZone(all), 2).map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("picture addresses", () => {
  const api = "https://api.rasoipulse.in";
  it("a path on the API gets the API's address in front", () => expect(resolveImageUrl("/uploads/a.webp", api)).toBe("https://api.rasoipulse.in/uploads/a.webp"));
  it("a full address stays as it is", () => expect(resolveImageUrl("https://cdn.example.com/a.webp", api)).toBe("https://cdn.example.com/a.webp"));
  it("an address made on a developer's machine points at the API the app talks to", () => {
    expect(resolveImageUrl("http://localhost:3097/uploads/a.webp", "http://10.0.2.2:3097")).toBe("http://10.0.2.2:3097/uploads/a.webp");
    expect(resolveImageUrl("http://127.0.0.1:3072/uploads/a.webp", api)).toBe("https://api.rasoipulse.in/uploads/a.webp");
  });
  it("protocol-less addresses use https", () => expect(resolveImageUrl("//cdn.example.com/a.webp", api)).toBe("https://cdn.example.com/a.webp"));
  it("nothing usable gives null (the dish just has no picture)", () => {
    for (const bad of [null, undefined, "", "   ", "not a url", "javascript:alert(1)", "data:image/png;base64,AAAA", "file:///etc/passwd"]) expect(resolveImageUrl(bad as string, api)).toBeNull();
  });
  it("the square (1:1) picture is preferred, else the first", () => {
    expect(pictureOf({ images: [{ url: "/w.webp", ratio: "16:9" }, { url: "/s.webp", ratio: "1:1" }] }, api)).toBe(`${api}/s.webp`);
    expect(pictureOf({ images: [{ url: "/w.webp", ratio: "16:9" }] }, api)).toBe(`${api}/w.webp`);
    expect(pictureOf({ images: [] }, api)).toBeNull();
  });
});
