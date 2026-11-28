import { act, screen } from "@testing-library/react-native";
import { useBoard, useItems, useSummary } from "@/data/hooks";
import { LiveBanner } from "@/live/LiveBanner";
import { LiveBridge } from "@/live/LiveBridge";
import { fx, fakeServer, renderApp } from "../../test/harness";

/** The phone's WebSocket, replaced by one the test drives by hand. */
class FakeWebSocket {
  static all: FakeWebSocket[] = [];
  onopen: ((e?: unknown) => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: { message?: string }) => void) | null = null;
  onclose: ((e: { code?: number }) => void) | null = null;
  closed = false;
  constructor(readonly url: string, readonly protocols: unknown, readonly options: { headers: Record<string, string> }) { FakeWebSocket.all.push(this); }
  close() { this.closed = true; }
  open() { this.onopen?.(); }
  say(m: unknown) { this.onmessage?.({ data: JSON.stringify(m) }); }
  drop() { this.onclose?.({ code: 1006 }); }
  refuse(text: string) { this.onerror?.({ message: `Expected HTTP 101 response but was '${text}'` }); this.onclose?.({ code: 1006 }); }
}
const sock = () => FakeWebSocket.all[FakeWebSocket.all.length - 1]!;

/** a screen that shows the lists the live connection keeps fresh */
function Lists() {
  useBoard("all"); useItems(); useSummary();
  return null;
}

const wait = async (ms: number) => { await act(async () => { await jest.advanceTimersByTimeAsync(ms); }); };
const real = globalThis.WebSocket;
beforeEach(() => { jest.useFakeTimers(); FakeWebSocket.all = []; (globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeWebSocket; });
afterEach(() => { jest.useRealTimers(); (globalThis as unknown as { WebSocket: unknown }).WebSocket = real; });

async function mount(server = fakeServer()) {
  const app = await renderApp(<><LiveBridge /><LiveBanner /><Lists /></>, { server });
  await wait(50);
  return { ...app, server };
}
const counts = (server: ReturnType<typeof fakeServer>) => ({
  board: server.to("GET", "/api/kitchen/orders").length,
  items: server.to("GET", "/api/kitchen/items").length,
  summary: server.to("GET", "/api/kitchen/summary").length,
});

describe("the kitchen app's live connection", () => {
  it("opens ONE connection for the outlet the waiter is signed in to, with the sign-in in a header — never in the address", async () => {
    const { runtime } = await mount();
    expect(FakeWebSocket.all).toHaveLength(1);
    const outletId = fx("outlets").outlets[0]._id;
    expect(sock().url).toBe(`wss://api.example.test/realtime?app=kda&outletId=${outletId}`);
    expect(sock().options.headers.authorization).toBe(`Bearer ${runtime.session.getState().token}`);
    expect(sock().url).not.toContain(String(runtime.session.getState().token));
    expect(runtime.live.getState().status).toBe("connecting");
    await act(async () => { sock().open(); });
    expect(runtime.live.getState().status).toBe("live");
  });

  it("does not connect before anybody is signed in, and lets go when they sign out", async () => {
    const out = await renderApp(<><LiveBridge /><Lists /></>, { signedIn: false });
    await wait(50);
    expect(FakeWebSocket.all).toHaveLength(0);
    await act(async () => { await out.runtime.session.getState().signIn("waiter@sandbox.test", "Staff123!", false); });
    await wait(50);
    expect(FakeWebSocket.all).toHaveLength(1);
    await act(async () => { sock().open(); });
    await act(async () => { await out.runtime.session.getState().signOut(); });
    await wait(50);
    expect(FakeWebSocket.all[0]!.closed).toBe(true);
    expect(out.runtime.live.getState().status).toBe("idle");
  });

  it("while it is live nothing asks on a timer — a minute passes with no requests", async () => {
    const { server } = await mount();
    await act(async () => { sock().open(); });
    await wait(200);
    const before = counts(server);
    for (let i = 0; i < 4; i++) { await act(async () => { sock().say({ type: "tick" }); }); await wait(20_000); } // 80 s, kept alive by the server's ticks
    expect(counts(server)).toEqual(before);
  });

  it("asks again for exactly what the server says changed", async () => {
    const { server } = await mount();
    await act(async () => { sock().open(); });
    await wait(200);
    const base = counts(server);
    await act(async () => { sock().say({ type: "changed", what: ["orders"], at: "x" }); });
    await wait(200);
    expect(counts(server)).toEqual({ board: base.board + 1, items: base.items + 1, summary: base.summary + 1 });
    await wait(1_500);
    const mid = counts(server);
    await act(async () => { sock().say({ type: "changed", what: ["menu"], at: "x" }); });
    await wait(200);
    expect(counts(server)).toEqual({ ...mid, items: mid.items + 1 });
    await wait(1_500);
    const end = counts(server);
    await act(async () => { sock().say({ type: "changed", what: ["tables", "deliveries"], at: "x" }); }); // not the kitchen's business
    await wait(200);
    expect(counts(server)).toEqual(end);
  });

  it("shows 'Reconnecting…' with a spinner when the line drops (after a moment, not on a blink), and hides it when it is back", async () => {
    const { runtime } = await mount();
    await act(async () => { sock().open(); });
    expect(screen.queryByTestId("live-reconnecting")).toBeNull();
    await act(async () => { sock().drop(); });
    expect(runtime.live.getState().status).toBe("reconnecting");
    await wait(600);
    expect(screen.queryByTestId("live-reconnecting")).toBeNull(); // a blink is not announced
    await wait(700);
    expect(screen.getByTestId("live-reconnecting")).toBeOnTheScreen();
    expect(screen.getByText("Reconnecting…")).toBeOnTheScreen();
    expect(screen.getByRole("progressbar", { name: "Reconnecting" })).toBeOnTheScreen();
    expect(screen.getByLabelText("Reconnecting. Showing the last information.")).toBeOnTheScreen();
    await wait(2_000); // the next try opens a new line…
    expect(FakeWebSocket.all.length).toBeGreaterThanOrEqual(2);
    await act(async () => { sock().open(); });
    expect(screen.queryByTestId("live-reconnecting")).toBeNull();
    expect(runtime.live.getState().status).toBe("live");
  });

  it("while the line is down the lists keep asking on their timer (the backup); when it is back they load everything once and go quiet again", async () => {
    const { server } = await mount();
    await act(async () => { sock().open(); });
    await wait(200);
    await act(async () => { sock().drop(); });
    const down = counts(server);
    await wait(10_000); // longer than the 8-second timer: the backup asks while the line is being made again
    const during = counts(server);
    expect(during.board).toBeGreaterThan(down.board);
    await act(async () => { sock().open(); });
    await wait(200);
    const c = counts(server);
    expect(c.board).toBe(during.board + 1);
    expect(c.items).toBe(during.items + 1);
    expect(c.summary).toBe(during.summary + 1);
    await wait(10_000); // live again: nobody asks on a timer
    expect(counts(server)).toEqual(c);
  });

  it("when the server refuses live updates the lists go back to asking on their timer, and no banner is shown", async () => {
    const { server, runtime } = await mount();
    await act(async () => { sock().refuse("503 Service Unavailable"); });
    expect(runtime.live.getState().status).toBe("fallback");
    await wait(300);
    const before = counts(server);
    await wait(8_500); // the 8-second timer (the dishes and today's numbers wait longer: 15 s and 30 s)
    expect(counts(server).board).toBeGreaterThan(before.board); // the kitchen board: its own timer (8 s)
    expect(screen.queryByTestId("live-reconnecting")).toBeNull();
  });

  it("an old server that doesn't know the live address behaves the same: the app keeps working on its timer", async () => {
    const { runtime } = await mount();
    await act(async () => { sock().refuse("404 Not Found"); });
    expect(runtime.live.getState().status).toBe("fallback");
  });
});
