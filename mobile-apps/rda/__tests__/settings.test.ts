import { createSettings } from "@/prefs/settings";
import { memoryPrefs } from "../test/harness";

const KEY = "rda.settings.v1:R1";

describe("what a rider keeps the way they like it", () => {
  it("starts with the new-delivery alert on", async () => {
    const s = createSettings(memoryPrefs());
    await s.load("R1");
    expect(s.store.getState()).toMatchObject({ alerts: true, loaded: true });
  });
  it("remembers a change for THIS rider, and only for them", async () => {
    const prefs = memoryPrefs();
    const s = createSettings(prefs);
    await s.load("R1");
    await s.set({ alerts: false });
    expect(JSON.parse(prefs.data.get(KEY)!)).toEqual({ alerts: false });
    await s.load("R2"); // someone else on the same phone
    expect(s.store.getState()).toMatchObject({ alerts: true });
    await s.load("R1"); // and back: it is still there
    expect(s.store.getState()).toMatchObject({ alerts: false });
  });
  it("unreadable or odd saved values fall back to the default instead of breaking the list", async () => {
    const bad = createSettings(memoryPrefs({ [KEY]: "{not json" }));
    await bad.load("R1");
    expect(bad.store.getState()).toMatchObject({ alerts: true, loaded: true });
    const odd = createSettings(memoryPrefs({ [KEY]: JSON.stringify({ alerts: "yes" }) }));
    await odd.load("R1");
    expect(odd.store.getState()).toMatchObject({ alerts: true });
  });
  it("a late answer for someone who has since signed out is ignored", async () => {
    const prefs = memoryPrefs({ "rda.settings.v1:R1": JSON.stringify({ alerts: false }) });
    const s = createSettings(prefs);
    const first = s.load("R1");
    await s.load("R2");
    await first;
    expect(s.store.getState()).toMatchObject({ alerts: true }); // R2's, not R1's
  });
});
