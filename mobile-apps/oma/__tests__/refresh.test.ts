import fs from "node:fs";
import path from "node:path";
import { createRefreshStore, parseRefreshSeconds } from "@/data/refresh";
import { REFRESH_DEFAULT_SECONDS, REFRESH_MAX_SECONDS, REFRESH_MIN_SECONDS, refreshPlan } from "@/lib/config";

describe("how often OMA asks the server for new data", () => {
  it("is 8 seconds until the server says otherwise", () => {
    expect(REFRESH_DEFAULT_SECONDS).toBe(8);
    expect(createRefreshStore().getState().seconds).toBe(8);
  });

  it("takes the platform admin's number for this app (a whole number of seconds, 3 to 600)", () => {
    const s = createRefreshStore();
    s.getState().set("15");
    expect(s.getState().seconds).toBe(15);
    s.getState().set(20);
    expect(s.getState().seconds).toBe(20);
    s.getState().set(String(REFRESH_MIN_SECONDS));
    expect(s.getState().seconds).toBe(3);
    s.getState().set(String(REFRESH_MAX_SECONDS));
    expect(s.getState().seconds).toBe(600);
  });

  it("ignores anything else, so a broken answer can never make the app hammer the server or stop refreshing", () => {
    const s = createRefreshStore();
    s.getState().set("15");
    for (const bad of ["2", "0", "-5", "601", "7.5", "abc", "", "NaN", null, undefined, {}]) {
      s.getState().set(bad);
      expect(s.getState().seconds).toBe(15);
    }
    expect(parseRefreshSeconds("2")).toBeNull();
    expect(parseRefreshSeconds("601")).toBeNull();
    expect(parseRefreshSeconds("8")).toBe(8);
  });

  it("tells subscribers only when the number really changes", () => {
    const s = createRefreshStore();
    const seen = jest.fn();
    s.subscribe(seen);
    s.getState().set("8");
    expect(seen).not.toHaveBeenCalled();
    s.getState().set("12");
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it("turns the one number into a wait for each thing the app refreshes", () => {
    expect(refreshPlan(8)).toEqual({ tables: 8000, orders: 8000, unavailable: 60000 });
    expect(refreshPlan(15)).toEqual({ tables: 15000, orders: 15000, unavailable: 60000 });
    expect(refreshPlan(120)).toEqual({ tables: 120000, orders: 120000, unavailable: 120000 }); // never faster than the setting
  });

  it("uses the same limits as the server (packages/config-schema APP_REFRESH)", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "..", "..", "packages", "config-schema", "src", "app-release.js"), "utf8");
    const m = /APP_REFRESH = \{ default: (\d+), min: (\d+), max: (\d+) \}/.exec(src);
    expect(m).not.toBeNull();
    expect([REFRESH_DEFAULT_SECONDS, REFRESH_MIN_SECONDS, REFRESH_MAX_SECONDS]).toEqual([Number(m![1]), Number(m![2]), Number(m![3])]);
    expect(src).toContain('APP_REFRESH_HEADER = "x-refresh-seconds"');
  });
});
