import { createLiveConnection, isRefusal, type LiveOptions, type LiveStatus, type SocketLike } from "@/live/connection";

/** A stand-in for the phone's WebSocket that the test drives by hand. */
class FakeSocket implements SocketLike {
  onopen: SocketLike["onopen"] = null;
  onmessage: SocketLike["onmessage"] = null;
  onerror: SocketLike["onerror"] = null;
  onclose: SocketLike["onclose"] = null;
  closed = false;
  constructor(readonly url: string, readonly headers: Record<string, string>) {}
  close() { this.closed = true; }
  open() { this.onopen?.(); }
  say(message: unknown) { this.onmessage?.({ data: typeof message === "string" ? message : JSON.stringify(message) }); }
  /** the line dropped */
  drop(code = 1006) { this.onclose?.({ code }); }
  /** the server answered the upgrade with an error, as the phone reports it */
  refuse(text: string) { this.onerror?.({ message: `Expected HTTP 101 response but was '${text}'` }); this.onclose?.({ code: 1006 }); }
}

function setup(over: Partial<LiveOptions> = {}) {
  const sockets: FakeSocket[] = [];
  const statuses: LiveStatus[] = [];
  const changes: string[][] = [];
  let resyncs = 0;
  let url: string | null = "wss://api.test/realtime?app=rda";
  let time = 1_000_000;
  const c = createLiveConnection({
    url: () => url,
    headers: () => ({ authorization: "Bearer tok" }),
    onChange: (what) => changes.push(what),
    onResync: () => { resyncs += 1; },
    onStatus: (s) => statuses.push(s),
    createSocket: (u, h) => { const s = new FakeSocket(u, h); sockets.push(s); return s; },
    random: () => 1, // no randomness: the pause is exactly 1 s, 2 s, 4 s …
    now: () => time,
    ...over,
  });
  return { c, sockets, statuses, changes, resyncs: () => resyncs, last: () => sockets[sockets.length - 1]!, setUrl: (u: string | null) => { url = u; }, advance: (ms: number) => { time += ms; jest.advanceTimersByTime(ms); } };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe("the live connection", () => {
  it("connects when started, with the sign-in in a header", () => {
    const t = setup();
    t.c.start();
    expect(t.sockets).toHaveLength(1);
    expect(t.last().url).toBe("wss://api.test/realtime?app=rda");
    expect(t.last().headers).toEqual({ authorization: "Bearer tok" });
    expect(t.last().url).not.toContain("tok");
    expect(t.c.status).toBe("connecting");
  });

  it("is live once the server accepts, and asks the app to load everything once", () => {
    const t = setup();
    t.c.start();
    t.last().open();
    expect(t.c.status).toBe("live");
    expect(t.statuses).toEqual(["connecting", "live"]);
    expect(t.resyncs()).toBe(1);
  });

  it("passes on what the server says changed — and nothing else", () => {
    const t = setup();
    t.c.start();
    t.last().open();
    t.last().say({ type: "hello", app: "oma" });
    t.last().say({ type: "tick" });
    t.last().say({ type: "changed", what: ["orders", "tables"], at: "now" });
    t.last().say({ type: "changed", what: ["menu", 7, null] });
    t.last().say("not json at all");
    t.last().say({ type: "changed", what: "orders" });
    t.last().say({ type: "something-else", what: ["orders"] });
    expect(t.changes).toEqual([["orders", "tables"], ["menu"]]);
  });

  it("says nothing and connects to nothing while nobody is signed in", () => {
    const t = setup();
    t.setUrl(null);
    t.c.start();
    expect(t.sockets).toHaveLength(0);
    expect(t.c.status).toBe("idle");
  });
});

describe("when the line drops", () => {
  it("shows 'reconnecting' and tries again after 1 s, then 2 s, 4 s … never more than 30 s", () => {
    const t = setup();
    t.c.start();
    t.last().open();
    t.last().drop();
    expect(t.c.status).toBe("reconnecting");
    expect(t.sockets).toHaveLength(1);
    t.advance(999);
    expect(t.sockets).toHaveLength(1);
    t.advance(2);
    expect(t.sockets).toHaveLength(2); // after 1 s
    t.last().drop();
    t.advance(1_999);
    expect(t.sockets).toHaveLength(2);
    t.advance(2);
    expect(t.sockets).toHaveLength(3); // then 2 s
    t.last().drop();
    t.advance(4_002);
    expect(t.sockets).toHaveLength(4); // 4 s
    for (let i = 0; i < 8; i++) { t.last().drop(); t.advance(30_002); } // the pause stops growing at 30 s
    const before = t.sockets.length;
    t.last().drop();
    t.advance(29_000);
    expect(t.sockets).toHaveLength(before);
    t.advance(1_100);
    expect(t.sockets).toHaveLength(before + 1);
  });

  it("is a little random, so every tablet in a restaurant doesn't knock at the same moment", () => {
    const t = setup({ random: () => 0 }); // the shortest wait: half
    t.c.start();
    t.last().open();
    t.last().drop();
    t.advance(499);
    expect(t.sockets).toHaveLength(1);
    t.advance(2);
    expect(t.sockets).toHaveLength(2);
  });

  it("loads everything again when it is back (a change during the gap is never missed), and the pause starts over", () => {
    const t = setup();
    t.c.start();
    t.last().open();
    t.last().drop();
    t.advance(1_001);
    t.last().open();
    expect(t.c.status).toBe("live");
    expect(t.resyncs()).toBe(2);
    t.last().drop();
    t.advance(1_001);
    expect(t.sockets).toHaveLength(3); // 1 s again, not 2 s
  });

  it("keeps trying while the internet is gone (a connection that never opens is just another try)", () => {
    const t = setup();
    t.c.start();
    t.last().onerror?.({ message: "failed to connect to api.test (port 443) after 10000ms" });
    t.last().drop();
    expect(t.c.status).toBe("reconnecting");
    t.advance(1_001);
    t.last().onerror?.({ message: "Software caused connection abort" });
    t.last().drop();
    t.advance(2_001);
    expect(t.sockets).toHaveLength(3);
    expect(t.c.status).toBe("reconnecting");
    expect(t.statuses).toEqual(["connecting", "reconnecting"]); // one change, not a flicker on every try
  });

  it("a restarting server (502 / 504 from the proxy) is a short break, not a refusal", () => {
    const t = setup();
    t.c.start();
    t.last().open();
    t.last().drop();
    t.advance(1_001);
    t.last().refuse("502 Bad Gateway");
    expect(t.c.status).toBe("reconnecting");
    t.advance(2_001);
    t.last().refuse("504 Gateway Time-out");
    expect(t.c.status).toBe("reconnecting");
  });
});

describe("when the server says no", () => {
  it.each([
    ["the platform switched live updates off", "503 Service Unavailable"],
    ["not signed in", "401 Unauthorized"],
    ["not allowed", "403 Forbidden"],
    ["too many connects", "429 Too Many Requests"],
    ["an old server that doesn't know the app address", "404 Not Found"],
  ])("%s → 'fallback' (the lists ask on a timer again) and it tries again in a minute", (_why, text) => {
    const t = setup();
    t.c.start();
    t.last().refuse(text);
    expect(t.c.status).toBe("fallback");
    t.advance(59_000);
    expect(t.sockets).toHaveLength(1);
    t.advance(1_100);
    expect(t.sockets).toHaveLength(2);
    expect(t.c.status).toBe("fallback"); // still, until the server lets it in
    t.last().open();
    expect(t.c.status).toBe("live");
  });

  it.each([[4401, "signed out"], [4403, "store switched off"], [4410, "live updates switched off"]])("a connection the server closes with %s (%s) → fallback", (code) => {
    const t = setup();
    t.c.start();
    t.last().open();
    t.last().drop(code);
    expect(t.c.status).toBe("fallback");
  });

  it("recognises a refusal by the words the phone reports, and a plain network failure by their absence", () => {
    expect(isRefusal("Expected HTTP 101 response but was '200 OK'")).toBe(true);
    expect(isRefusal("java.net.ProtocolException: Expected HTTP 101 response but was '401 Unauthorized'")).toBe(true);
    expect(isRefusal("Expected HTTP 101 response but was '502 Bad Gateway'")).toBe(false);
    expect(isRefusal("failed to connect to /10.0.0.4 (port 443) after 10000ms")).toBe(false);
    expect(isRefusal(undefined)).toBe(false);
    expect(isRefusal("anything", 1006)).toBe(false);
    expect(isRefusal(undefined, 4410)).toBe(true);
  });
});

describe("a line that went quiet", () => {
  it("is replaced: the server speaks every 20 s, so 55 s of silence means the line is dead", () => {
    const t = setup();
    t.c.start();
    t.last().open();
    t.advance(20_000);
    t.last().say({ type: "tick" });
    t.advance(40_000);
    t.last().say({ type: "tick" });
    expect(t.c.status).toBe("live"); // a tick every 20 s keeps it alive however long that goes on
    const dead = t.last();
    t.advance(60_000); // nothing at all for a minute
    expect(dead.closed).toBe(true);
    expect(t.c.status).toBe("reconnecting");
    t.advance(1_100);
    expect(t.sockets.length).toBeGreaterThan(1);
  });

  it("ignores what an old, replaced connection says afterwards", () => {
    const t = setup();
    t.c.start();
    const old = t.last();
    old.open();
    old.drop();
    t.advance(1_001);
    const fresh = t.last();
    old.say({ type: "changed", what: ["orders"] });
    old.drop(4401);
    expect(t.changes).toEqual([]);
    expect(t.c.status).toBe("reconnecting"); // the old line's last words (even "signed out") changed nothing: the new line is still being made
    expect(t.sockets.at(-1)).toBe(fresh);
  });
});

describe("the app comes back to the front, or the internet returns (wake)", () => {
  it("while waiting to reconnect: tries at once, with no pause", () => {
    const t = setup();
    t.c.start();
    t.last().open();
    t.last().drop();
    t.last(); // still waiting out 1 s
    t.c.wake();
    expect(t.sockets).toHaveLength(2);
  });

  it("after a refusal: tries at once too", () => {
    const t = setup();
    t.c.start();
    t.last().refuse("503 Service Unavailable");
    t.c.wake();
    expect(t.sockets).toHaveLength(2);
  });

  it("on a healthy line that spoke a moment ago: does nothing", () => {
    const t = setup();
    t.c.start();
    t.last().open();
    t.advance(10_000);
    t.last().say({ type: "tick" });
    t.c.wake();
    expect(t.sockets).toHaveLength(1);
    expect(t.c.status).toBe("live");
  });

  it("on a line that went quiet while the phone slept: replaces it at once and loads everything again", () => {
    const t = setup();
    t.c.start();
    t.last().open();
    const asleep = t.last();
    t.advance(30_000);
    t.c.wake();
    expect(asleep.closed).toBe(true);
    expect(t.sockets).toHaveLength(2);
    t.last().open();
    expect(t.resyncs()).toBe(2);
  });

  it("while the first connection attempt is under way: leaves it alone", () => {
    const t = setup();
    t.c.start();
    t.c.wake();
    expect(t.sockets).toHaveLength(1);
  });
});

describe("stopping (signed out, or switching outlet)", () => {
  it("closes the line, forgets every pause and goes idle — an old line can't speak again", () => {
    const t = setup();
    t.c.start();
    const s = t.last();
    s.open();
    t.c.stop();
    expect(s.closed).toBe(true);
    expect(t.c.status).toBe("idle");
    s.say({ type: "changed", what: ["orders"] });
    s.drop();
    t.advance(120_000);
    expect(t.sockets).toHaveLength(1);
    expect(t.changes).toEqual([]);
  });

  it("stops a connection that is waiting to try again", () => {
    const t = setup();
    t.c.start();
    t.last().open();
    t.last().drop();
    t.c.stop();
    t.advance(120_000);
    expect(t.sockets).toHaveLength(1);
  });

  it("can be started again afterwards, from the beginning", () => {
    const t = setup();
    t.c.start();
    t.last().open();
    t.c.stop();
    t.c.start();
    expect(t.sockets).toHaveLength(2);
    expect(t.c.status).toBe("connecting");
  });

  it("starting twice opens one connection", () => {
    const t = setup();
    t.c.start();
    t.c.start();
    expect(t.sockets).toHaveLength(1);
  });
});
