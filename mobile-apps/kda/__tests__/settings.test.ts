import { createSettings } from "@/prefs/settings";
import { memoryPrefs } from "../test/harness";

const KEY = "kda.settings.v1:U1:O1";

describe("what a kitchen person keeps the way they like it", () => {
  it("starts with the alert on, the screen kept awake and every station", async () => {
    const s = createSettings(memoryPrefs());
    await s.load("U1", "O1");
    expect(s.store.getState()).toMatchObject({ alerts: true, keepAwake: true, screen: "all", loaded: true });
  });
  it("remembers a change for THIS person at THIS outlet, and only for them", async () => {
    const prefs = memoryPrefs();
    const s = createSettings(prefs);
    await s.load("U1", "O1");
    await s.set({ alerts: false, screen: "bar" });
    expect(JSON.parse(prefs.data.get(KEY)!)).toEqual({ alerts: false, keepAwake: true, screen: "bar" });
    await s.load("U2", "O1"); // someone else on the same phone
    expect(s.store.getState()).toMatchObject({ alerts: true, screen: "all" });
    await s.load("U1", "O2"); // the same person at another outlet
    expect(s.store.getState()).toMatchObject({ alerts: true, screen: "all" });
    await s.load("U1", "O1"); // and back: it is all still there
    expect(s.store.getState()).toMatchObject({ alerts: false, screen: "bar" });
  });
  it("unreadable or odd saved values fall back to the defaults instead of breaking the board", async () => {
    const bad = createSettings(memoryPrefs({ [KEY]: "{not json" }));
    await bad.load("U1", "O1");
    expect(bad.store.getState()).toMatchObject({ alerts: true, keepAwake: true, screen: "all", loaded: true });
    const odd = createSettings(memoryPrefs({ [KEY]: JSON.stringify({ alerts: "yes", keepAwake: 3, screen: "freezer" }) }));
    await odd.load("U1", "O1");
    expect(odd.store.getState()).toMatchObject({ alerts: true, keepAwake: true, screen: "all" });
  });
  it("a late answer for someone who has since signed out is ignored", async () => {
    const prefs = memoryPrefs({ "kda.settings.v1:U1:O1": JSON.stringify({ alerts: false, keepAwake: false, screen: "bar" }) });
    const s = createSettings(prefs);
    const first = s.load("U1", "O1");
    await s.load("U2", "O1"); // loaded while the first read was still on its way
    await first;
    expect(s.store.getState()).toMatchObject({ alerts: true, keepAwake: true, screen: "all" }); // U2's, not U1's
  });
});
