import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { Cache } from "@/screens/Cache";
import { fakeServer, renderApp } from "../../test/harness";

const E = (o: Record<string, unknown>) => ({ key: "k", kind: "menu", label: "Menu", subject: "x", store: null, outlet: null, bytes: 1000, ageSeconds: 120, expiresInSeconds: 780, notFound: false, ...o });
const A = { id: "a", name: "Acme Momos" }, B = { id: "b", name: "Beta Bites" };
const MAIN = { id: "o1", name: "Main" }, SECOND = { id: "o2", name: "Second" }, BMAIN = { id: "o3", name: "Beta Main" };
const ENTRIES = [
  E({ key: "dash:platform", kind: "dash", label: "Dashboard numbers", subject: "Platform dashboard", bytes: 4100 }),
  E({ key: "store:a", kind: "store", label: "Store look & outlets", subject: "Acme Momos", store: A, bytes: 3000 }),
  E({ key: "plan:a", kind: "plan", label: "Plan & limits", subject: "Acme Momos", store: A, bytes: 300 }),
  E({ key: "menu:a:o1", kind: "menu", label: "Menu", subject: "Main", store: A, outlet: MAIN, bytes: 9000 }),
  E({ key: "cfg:o1", kind: "cfg", label: "Outlet settings", subject: "Main", store: A, outlet: MAIN, bytes: 2000 }),
  E({ key: "outletaccess:o1", kind: "outletaccess", label: "Outlet access check", subject: "Main", store: A, outlet: MAIN, bytes: 100 }),
  E({ key: "menu:a:o2", kind: "menu", label: "Menu", subject: "Second", store: A, outlet: SECOND, bytes: 5000 }),
  E({ key: "store:b", kind: "store", label: "Store look & outlets", subject: "Beta Bites", store: B, bytes: 2500 }),
  E({ key: "menu:b:o3", kind: "menu", label: "Menu", subject: "Beta Main", store: B, outlet: BMAIN, bytes: 4000 }),
];
const KINDS = [{ kind: "menu", label: "Menu", what: "An outlet's menu: categories, items and option groups", entries: 3, bytes: 1 }, { kind: "cfg", label: "Outlet settings", what: "An outlet's settings as they apply under its plan", entries: 1, bytes: 1 }];
const overview = (o: Record<string, unknown> = {}) => ({ ttlSeconds: 900, enabled: true, lastExpiredAt: null, stats: { hits: 90, misses: 10, hitRate: 0.9 }, totals: { entries: ENTRIES.length, bytes: 30000 }, kinds: KINDS, stores: [{ ...A, entries: 6, bytes: 19400 }, { ...B, entries: 2, bytes: 6500 }], entries: ENTRIES, ...o });
const open = (o: Record<string, unknown> = {}) => renderApp(<Cache />, { server: fakeServer({ "GET /api/platform/cache/entries": { json: overview(o) }, "POST /api/platform/cache/expire": { json: { result: { removed: 1 } } }, "PUT /api/platform/cache/settings": { json: {} } }) });
const press = async (id: string) => fireEvent.press(await screen.findByTestId(id));
const posts = (server: { to: (m: string, p: string) => { body: unknown }[] }) => server.to("POST", "/api/platform/cache/expire").map((c) => c.body);

describe("the cache screen is grouped: Admin Panel Cache, and Store Cache → stores → outlets", () => {
  it("shows the totals, the Admin Panel Cache with its items, and Store Cache folded away", async () => {
    await open();
    expect(await screen.findByTestId("cache-summary")).toHaveTextContent(/9 items remembered/);
    expect(screen.getByTestId("cache-now")).toHaveTextContent(/Each item is remembered for 15 minutes/);
    expect(within(screen.getByTestId("cache-admin-group")).getByText("Dashboard numbers")).toBeOnTheScreen();
    expect(screen.getByTestId("cache-store-toggle").props.accessibilityState.expanded).toBe(false);
    expect(screen.queryByTestId("cache-store-group")).toBeNull();
    expect(screen.getByText(/2 stores · 8 items/)).toBeOnTheScreen();
  });

  it("opening Store Cache lists the stores, none of them open; a store opens to its outlets, apart from 'the whole store'", async () => {
    await open();
    await press("cache-store-toggle");
    expect(await screen.findByTestId("cache-store-Acme Momos")).toBeOnTheScreen();
    expect(screen.getByTestId("cache-store-Beta Bites")).toBeOnTheScreen();
    expect(screen.queryByTestId("cache-outlets-Acme Momos")).toBeNull();
    await press("cache-open-Acme Momos");
    const outlets = await screen.findByTestId("cache-outlets-Acme Momos");
    expect(within(outlets).getByTestId("cache-outlet-Main")).toBeOnTheScreen();
    expect(within(outlets).getByTestId("cache-outlet-Second")).toBeOnTheScreen();
    expect(within(screen.getByTestId("cache-outlet-Main")).getByText("Outlet settings")).toBeOnTheScreen();
    expect(within(screen.getByTestId("cache-whole-Acme Momos")).getByText("Plan & limits")).toBeOnTheScreen();
    expect(screen.queryByTestId("cache-outlets-Beta Bites")).toBeNull(); // only the picked store opens
    await press("cache-open-Acme Momos");
    expect(screen.queryByTestId("cache-outlets-Acme Momos")).toBeNull(); // and it folds again
  });
});

describe("every Expire says what it will drop before it does anything", () => {
  it("an outlet: names it, counts exactly its items, lists them in words, says what stays — and Cancel expires nothing", async () => {
    const { server } = await open();
    await press("cache-store-toggle"); await press("cache-open-Acme Momos");
    await press("expire-outlet-Main");
    const sheet = await screen.findByTestId("expire-sheet");
    expect(within(sheet).getByText("Expire this outlet's cache")).toBeOnTheScreen();
    expect(within(sheet).getByText("Main · Acme Momos")).toBeOnTheScreen();
    expect(screen.getByTestId("expire-count")).toHaveTextContent(/^3 items/);
    const list = screen.getByTestId("expire-list");
    for (const w of ["Menu", "Outlet settings", "Outlet access check"]) expect(within(list).getByText(new RegExp(w))).toBeOnTheScreen();
    expect(within(list).getByText(/An outlet's menu/)).toBeOnTheScreen(); // what each kind IS, from the server's own words
    for (const w of ["What will expire", "What stays", "What happens next"]) expect(within(sheet).getByText(w)).toBeOnTheScreen();
    expect(within(sheet).getByText(/store's look, plan and web addresses/)).toBeOnTheScreen();
    await press("expire-cancel");
    await waitFor(() => expect(screen.queryByTestId("expire-sheet")).toBeNull());
    expect(posts(server)).toEqual([]);
  });

  it("confirming an outlet sends that outlet in that store, and nothing else", async () => {
    const { server } = await open();
    await press("cache-store-toggle"); await press("cache-open-Acme Momos"); await press("expire-outlet-Second");
    expect(await screen.findByTestId("expire-count")).toHaveTextContent(/^1 item /);
    await press("expire-confirm");
    await waitFor(() => expect(posts(server)).toHaveLength(1));
    expect(posts(server)[0]).toEqual({ scope: "outlet", storeId: "a", outletId: "o2" });
    await waitFor(() => expect(screen.queryByTestId("expire-sheet")).toBeNull());
  });

  it("a store counts ALL its items (outlets' and its own) and sends that store", async () => {
    const { server } = await open();
    await press("cache-store-toggle");
    await press("expire-store-Acme Momos");
    expect(await screen.findByText("Expire this store's cache")).toBeOnTheScreen();
    expect(screen.getByTestId("expire-count")).toHaveTextContent(/^6 items/);
    expect(screen.getByText(/Every other store, and the admin panel's own items/)).toBeOnTheScreen();
    await press("expire-confirm");
    await waitFor(() => expect(posts(server)).toEqual([{ scope: "store", storeId: "a" }]));
  });

  it("the admin panel counts only what belongs to no store, says no store is touched, and sends 'admin'", async () => {
    const { server } = await open();
    await press("expire-admin");
    expect(await screen.findByText("Expire the admin panel's cache")).toBeOnTheScreen();
    expect(screen.getByTestId("expire-count")).toHaveTextContent(/^1 item /);
    expect(screen.getByText(/No store, outlet or menu is touched/)).toBeOnTheScreen();
    await press("expire-confirm");
    await waitFor(() => expect(posts(server)).toEqual([{ scope: "admin" }]));
  });

  it("everything counts every listed item, says people stay signed in, and sends 'all'", async () => {
    const { server } = await open();
    await press("expire-all");
    expect(within(await screen.findByTestId("expire-sheet")).getByText("Expire everything")).toBeOnTheScreen();
    expect(screen.getByTestId("expire-count")).toHaveTextContent(/^9 items/);
    expect(screen.getByText(/People stay signed in/)).toBeOnTheScreen();
    await press("expire-confirm");
    await waitFor(() => expect(posts(server)).toEqual([{ scope: "all" }]));
  });

  it("when nothing is remembered there, it says so and there is nothing to confirm", async () => {
    await open({ entries: ENTRIES.filter((e) => e.store), totals: { entries: 8, bytes: 1 } });
    expect(await screen.findByTestId("cache-admin-empty")).toBeOnTheScreen();
    await press("expire-admin");
    expect(await screen.findByTestId("expire-empty")).toBeOnTheScreen();
    expect(screen.getByTestId("expire-confirm")).toBeDisabled();
  });
});

describe("the lifetime is one input, in seconds and in words", () => {
  it("whatever the web console set shows here: 15 minutes (900 s) is in the box and in words", async () => {
    await open();
    expect((await screen.findByTestId("cache-ttl-input")).props.value).toBe("900");
    expect(screen.getByTestId("cache-ttl-text")).toHaveTextContent("= 15 minutes");
    expect(screen.queryByTestId("cache-ttl-300")).toBeNull(); // the preset buttons are gone
  });

  it("typing shows the words as you type, and Save sends exactly those seconds", async () => {
    const { server } = await open();
    const box = await screen.findByTestId("cache-ttl-input");
    expect(screen.getByTestId("cache-ttl-save")).toBeDisabled();
    for (const [typed, words] of [["30", "30 seconds"], ["90", "1 minute 30 seconds"], ["5400", "1 hour 30 minutes"], ["7200", "2 hours"], ["0", "off"]] as const) {
      await fireEvent.changeText(box, typed);
      expect(screen.getByTestId("cache-ttl-text")).toHaveTextContent(`= ${words}`);
    }
    await fireEvent.changeText(box, "1800");
    await fireEvent.press(screen.getByTestId("cache-ttl-save"));
    await waitFor(() => expect(server.to("PUT", "/api/platform/cache/settings")).toHaveLength(1));
    expect(server.to("PUT", "/api/platform/cache/settings")[0]!.body).toEqual({ ttlSeconds: 1800 });
  });

  it("only digits; a number above a day, or an empty box, can't be saved", async () => {
    await open();
    const box = await screen.findByTestId("cache-ttl-input");
    await fireEvent.changeText(box, "1a2b");
    expect(box.props.value).toBe("12");
    await fireEvent.changeText(box, "86401");
    expect(screen.getByTestId("cache-ttl-save")).toBeDisabled();
    expect(screen.getByText("Enter a whole number of seconds, 0 to 86,400.")).toBeOnTheScreen();
    await fireEvent.changeText(box, "86400");
    expect(screen.getByTestId("cache-ttl-text")).toHaveTextContent("= 24 hours");
    await fireEvent.changeText(box, "");
    expect(screen.getByTestId("cache-ttl-save")).toBeDisabled();
  });

  it("when the server's value changes (set on the web), the box shows the new one", async () => {
    const { server } = await open();
    expect((await screen.findByTestId("cache-ttl-input")).props.value).toBe("900");
    server.set("GET /api/platform/cache/entries", { json: overview({ ttlSeconds: 300 }) });
    await press("expire-all"); await press("expire-confirm"); // any action refetches the cache
    await waitFor(() => expect(screen.getByTestId("cache-ttl-input").props.value).toBe("300"));
    expect(screen.getByTestId("cache-ttl-text")).toHaveTextContent("= 5 minutes");
  });

  it("a cache that is off says so", async () => {
    await open({ ttlSeconds: 0, enabled: false });
    expect(await screen.findByText(/The cache is OFF/)).toBeOnTheScreen();
  });
});
