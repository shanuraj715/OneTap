import { groupCache, summarize } from "@/lib/cache";
import type { CacheEntry } from "@/api/endpoints";

const e = (o: Partial<CacheEntry>): CacheEntry => ({ key: "k", kind: "menu", label: "Menu", subject: "", store: null, outlet: null, bytes: 10, ageSeconds: 0, expiresInSeconds: 0, notFound: false, ...o });
const A = { id: "a", name: "Acme" };

describe("summarize", () => {
  it("counts items by what they are, biggest group first, then by name", () => {
    expect(summarize([e({ label: "Menu" }), e({ label: "Plan & limits" }), e({ label: "Menu" }), e({ label: "Offers" })])).toEqual([{ label: "Menu", n: 2 }, { label: "Offers", n: 1 }, { label: "Plan & limits", n: 1 }]);
  });
  it("falls back to the kind when there is no label, and says nothing for an empty list", () => {
    expect(summarize([{ kind: "cfg" }])).toEqual([{ label: "cfg", n: 1 }]);
    expect(summarize([])).toEqual([]);
  });
});

describe("groupCache", () => {
  const rows = [
    e({ key: "dash", kind: "dash", label: "Dashboard" }),
    e({ key: "store:a", kind: "store", store: A, bytes: 5 }),
    e({ key: "menu:a:2", store: A, outlet: { id: "2", name: "Zed" }, bytes: 7 }),
    e({ key: "cfg:1", kind: "cfg", store: A, outlet: { id: "1", name: "Alpha" }, bytes: 3 }),
    e({ key: "menu:a:1", store: A, outlet: { id: "1", name: "Alpha" }, bytes: 4 }),
    e({ key: "menu:b:9", store: { id: "b", name: "Beta" }, outlet: { id: "9", name: "Only" } }),
  ];
  const g = groupCache(rows, [A, { id: "b", name: "Beta" }, { id: "c", name: "Empty" }]);
  it("the admin panel is what belongs to no store", () => expect(g.admin.map((x) => x.key)).toEqual(["dash"]));
  it("each store gets only its own items, in the server's store order", () => {
    expect(g.stores.map((s) => [s.name, s.rows.length])).toEqual([["Acme", 4], ["Beta", 1], ["Empty", 0]]);
  });
  it("a store's outlets are grouped and sorted by name, with their own bytes", () => {
    const acme = g.stores[0]!;
    expect(acme.outlets.map((o) => [o.name, o.rows.map((r) => r.key), o.bytes])).toEqual([["Alpha", ["cfg:1", "menu:a:1"], 7], ["Zed", ["menu:a:2"], 7]]);
  });
  it("what is not an outlet's stays apart as 'the whole store'; the store's size counts everything", () => {
    const acme = g.stores[0]!;
    expect(acme.whole.map((r) => r.key)).toEqual(["store:a"]);
    expect(acme.bytes).toBe(5 + 7 + 3 + 4);
  });
  it("a store with nothing remembered is an empty group (not an error)", () => expect(g.stores[2]).toMatchObject({ rows: [], outlets: [], whole: [], bytes: 0 }));
});
