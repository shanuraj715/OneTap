import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { Cache } from "@/screens/Cache";
import { fakeServer, renderApp } from "../../test/harness";

const OVERVIEW = { cache: { ttlSeconds: 3600, enabled: true, lastExpiredAt: null, stats: { entries: 42, bytes: 2048, hits: 90, misses: 10, hitRate: 0.9, since: "2026-11-27T00:00:00Z" }, stores: [{ id: "s1", name: "Acme Momos", entries: 30, bytes: 1500, lastExpiredAt: null }, { id: "s2", name: "Beta Bites", entries: 12, bytes: 548, lastExpiredAt: "2026-11-27T08:00:00Z" }] } };
const open = (o = OVERVIEW) => renderApp(<Cache />, { server: fakeServer({ "GET /api/platform/cache": { json: o }, "POST /api/platform/cache/expire": { json: {} }, "PUT /api/platform/cache/settings": { json: {} } }) });

describe("the cache screen", () => {
  it("shows how much is remembered, the hit rate and each store", async () => {
    await open();
    expect(await screen.findByText("42")).toBeOnTheScreen();
    expect(screen.getByText("90%")).toBeOnTheScreen();
    expect(within(screen.getByTestId("cache-store-Acme Momos")).getByText(/30 remembered/)).toBeOnTheScreen();
    expect(screen.getByTestId("cache-ttl-3600").props.accessibilityState.selected).toBe(true);
  });

  it("Expire all asks first, then sends scope all", async () => {
    const { server } = await open();
    await fireEvent.press(await screen.findByTestId("expire-all"));
    expect(server.to("POST", "/api/platform/cache/expire")).toHaveLength(0);
    await fireEvent.press(await screen.findByTestId("confirm-yes"));
    await waitFor(() => expect(server.to("POST", "/api/platform/cache/expire")).toHaveLength(1));
    expect(server.to("POST", "/api/platform/cache/expire")[0]!.body).toEqual({ scope: "all" });
  });

  it("Expire this store sends that store's id and nothing else", async () => {
    const { server } = await open();
    await fireEvent.press(await screen.findByTestId("expire-Beta Bites"));
    await fireEvent.press(await screen.findByTestId("confirm-yes"));
    await waitFor(() => expect(server.to("POST", "/api/platform/cache/expire")).toHaveLength(1));
    expect(server.to("POST", "/api/platform/cache/expire")[0]!.body).toEqual({ scope: "store", storeId: "s2" });
  });

  it("choosing a lifetime saves it in seconds; Off is 0", async () => {
    const { server } = await open();
    await fireEvent.press(await screen.findByTestId("cache-ttl-300"));
    await waitFor(() => expect(server.to("PUT", "/api/platform/cache/settings")).toHaveLength(1));
    expect(server.to("PUT", "/api/platform/cache/settings")[0]!.body).toEqual({ ttlSeconds: 300 });
    await fireEvent.press(screen.getByTestId("cache-ttl-0"));
    await waitFor(() => expect(server.to("PUT", "/api/platform/cache/settings")).toHaveLength(2));
    expect(server.to("PUT", "/api/platform/cache/settings")[1]!.body).toEqual({ ttlSeconds: 0 });
  });

  it("a cache that is off says so", async () => {
    await open({ cache: { ...OVERVIEW.cache, ttlSeconds: 0, enabled: false } });
    expect(await screen.findByText(/The cache is OFF/)).toBeOnTheScreen();
  });
});
