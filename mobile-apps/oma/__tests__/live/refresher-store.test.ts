import { QueryClient } from "@tanstack/react-query";
import { liveEverything, liveKeys } from "@/live/LiveBridge";
import { createRefresher } from "@/live/refresher";
import { createLiveStore, pollEvery } from "@/live/store";

describe("what to ask for again when the server says something changed (OMA)", () => {
  it("orders → the orders, and the tables and who sits there (an order moves a table's bill)", () => {
    expect(liveKeys("orders", "o1")).toEqual([["orders", "o1"], ["tables", "o1"], ["sessions", "o1"]]);
  });
  it("tables → the tables and who sits there", () => {
    expect(liveKeys("tables", "o1")).toEqual([["tables", "o1"], ["sessions", "o1"]]);
  });
  it("menu → what can't be ordered now (a new menu version found there reloads the menu)", () => {
    expect(liveKeys("menu", "o1")).toEqual([["unavailable", "o1"]]);
  });
  it("things OMA doesn't show (deliveries, or something new) → nothing", () => {
    expect(liveKeys("deliveries", "o1")).toEqual([]);
    expect(liveKeys("whatever", "o1")).toEqual([]);
  });
  it("(re)connecting loads everything it shows, for that outlet only", () => {
    expect(liveEverything("o1")).toEqual([["orders", "o1"], ["tables", "o1"], ["sessions", "o1"], ["unavailable", "o1"]]);
  });
});

describe("the refresher", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function setup() {
    const asked: string[] = [];
    const client = { invalidateQueries: jest.fn(async (f: { queryKey?: readonly unknown[] }) => { asked.push(JSON.stringify(f.queryKey)); }) } as unknown as QueryClient;
    let time = 5_000_000;
    const r = createRefresher(client, liveKeys, liveEverything, { now: () => time });
    return { r, asked, advance: (ms: number) => { time += ms; jest.advanceTimersByTime(ms); } };
  }

  it("asks at once for the first change", () => {
    const t = setup();
    t.r.changed(["orders"], "o1");
    expect(t.asked).toEqual(['["orders","o1"]', '["tables","o1"]', '["sessions","o1"]']);
  });

  it("a burst of changes within a second is asked for ONCE more, when that second is over", () => {
    const t = setup();
    t.r.changed(["orders"], "o1");
    t.asked.length = 0;
    for (let i = 0; i < 10; i++) { t.advance(50); t.r.changed(["orders"], "o1"); }
    expect(t.asked).toEqual([]); // nothing piled up
    t.advance(600);
    expect(t.asked).toEqual(['["orders","o1"]', '["tables","o1"]', '["sessions","o1"]']); // one catch-up with the newest data
    t.advance(5_000);
    expect(t.asked).toHaveLength(3);
  });

  it("a change after a quiet second is asked for at once again", () => {
    const t = setup();
    t.r.changed(["orders"], "o1");
    t.advance(1_500);
    t.asked.length = 0;
    t.r.changed(["orders"], "o1");
    expect(t.asked).toHaveLength(3);
  });

  it("kinds are separate: a menu change doesn't wait behind an orders change", () => {
    const t = setup();
    t.r.changed(["orders"], "o1");
    t.asked.length = 0;
    t.r.changed(["menu"], "o1");
    expect(t.asked).toEqual(['["unavailable","o1"]']);
  });

  it("a kind this app doesn't show asks for nothing", () => {
    const t = setup();
    t.r.changed(["deliveries", "nonsense"], "o1");
    expect(t.asked).toEqual([]);
  });

  it("(re)connecting loads everything now and cancels a booked catch-up (it would only repeat)", () => {
    const t = setup();
    t.r.changed(["orders"], "o1");
    t.advance(100);
    t.r.changed(["orders"], "o1"); // booked for later
    t.asked.length = 0;
    t.r.resync("o1");
    expect(t.asked).toHaveLength(4);
    t.advance(5_000);
    expect(t.asked).toHaveLength(4);
  });

  it("stop() forgets everything booked (the person signed out)", () => {
    const t = setup();
    t.r.changed(["orders"], "o1");
    t.advance(100);
    t.r.changed(["orders"], "o1");
    t.asked.length = 0;
    t.r.stop();
    t.advance(5_000);
    expect(t.asked).toEqual([]);
  });
});

describe("whether a list asks on a timer", () => {
  it("never while the live connection is up — the server says when something changed", () => {
    expect(pollEvery("live", 8000)).toBe(false);
  });
  it("on its timer in EVERY other state: polling is the backup that is always there (no line yet, being made, lost and coming back, refused)", () => {
    for (const s of ["idle", "connecting", "reconnecting", "fallback"] as const) expect(pollEvery(s, 8000)).toBe(8000);
    expect(pollEvery("fallback", 15000)).toBe(15000);
  });
  it("the status lives in a small store the screens read", () => {
    const store = createLiveStore();
    expect(store.getState().status).toBe("idle");
    store.getState().set("live");
    expect(store.getState().status).toBe("live");
  });
});
