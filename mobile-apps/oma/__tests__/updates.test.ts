import fs from "node:fs";
import path from "node:path";
import { ApiError } from "@/api/client";
import type { Api } from "@/api/endpoints";
import * as S from "@/api/schemas";
import { formatBytes } from "@/lib/size";
import { RECHECK_AFTER_MS, createUpdateStore, shouldOfferUpdate } from "@/updates/store";

const fx = (n: string) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "test", "fixtures", `${n}.json`), "utf8"));
const answer = (name: string) => S.updateCheckSchema.parse(fx(name));

function setup(first: unknown, build = 1) {
  let clock = 1_000_000;
  const check = jest.fn(async (_code: number) => {
    if (first instanceof Error) throw first;
    return first as S.UpdateCheck;
  });
  const api = { checkForUpdate: check } as unknown as Api;
  const store = createUpdateStore({ api: () => api, build, now: () => clock });
  return { store, check, tick: (ms: number) => { clock += ms; }, set: (v: unknown) => { first = v; } };
}

describe("the recorded answers match what the app expects", () => {
  it("all four are understood", () => {
    for (const n of ["update-check-none", "update-check-optional", "update-check-current", "update-check-required"]) expect(() => answer(n)).not.toThrow();
    expect(S.updateRequiredSchema.safeParse(fx("error-update-required").details).success).toBe(true);
  });
});

describe("checking for an update", () => {
  it("nothing published: the app is current, and the server is asked with THIS phone's build number", async () => {
    const { store, check } = setup(answer("update-check-none"), 7);
    expect(store.getState().status).toBe("unknown");
    await store.getState().check();
    expect(check).toHaveBeenCalledWith(7);
    expect(store.getState()).toMatchObject({ status: "current", latest: null, whatsNew: [], error: null, checking: false });
  });

  it("a newer version that may be skipped: 'available', with its notes and the download page", async () => {
    const { store } = setup(answer("update-check-optional"));
    await store.getState().check();
    const s = store.getState();
    expect(s.status).toBe("available");
    expect(s.latest).toMatchObject({ version: "v-27.11.26-002", versionCode: 2, size: 3_400_000 });
    expect(s.whatsNew.map((n) => n.version)).toEqual(["v-27.11.26-002"]);
    expect(s.pageUrl).toBe("https://rasoipulse.in/app");
    expect(shouldOfferUpdate(s)).toBe(true);
  });

  it("a required version: 'required', listing everything that changed since, newest first", async () => {
    const { store } = setup(answer("update-check-required"));
    await store.getState().check();
    const s = store.getState();
    expect(s.status).toBe("required");
    expect(s.latest?.version).toBe("v-28.11.26-003");
    expect(s.whatsNew.map((n) => n.version)).toEqual(["v-28.11.26-003", "v-27.11.26-002"]);
    expect(shouldOfferUpdate(s)).toBe(false); // the optional pop-up is for optional updates only
  });

  it("already on the newest: current, nothing to offer", async () => {
    const { store } = setup(answer("update-check-current"), 2);
    await store.getState().check();
    expect(store.getState().status).toBe("current");
    expect(shouldOfferUpdate(store.getState())).toBe(false);
  });

  it("can't reach the server: nothing changes, nobody is blocked, the reason is kept for the 'Check for updates' button", async () => {
    const { store } = setup(new ApiError(0, "Can't reach the server."));
    await store.getState().check();
    expect(store.getState()).toMatchObject({ status: "unknown", error: "Can't reach the server.", checking: false, checkedAt: null });
    expect(shouldOfferUpdate(store.getState())).toBe(false);
  });

  it("a failed check never UN-requires an update that was already required", async () => {
    const t = setup(answer("update-check-required"));
    await t.store.getState().check();
    t.set(new ApiError(0, "Can't reach the server."));
    await t.store.getState().check();
    expect(t.store.getState().status).toBe("required");
  });

  it("two checks at once make one request", async () => {
    const t = setup(answer("update-check-optional"));
    await Promise.all([t.store.getState().check(), t.store.getState().check()]);
    expect(t.check).toHaveBeenCalledTimes(1);
  });

  it("the admin switching 'Required' off (or the app being updated) lets a blocked phone through on the next check", async () => {
    const t = setup(answer("update-check-required"));
    await t.store.getState().check();
    expect(t.store.getState().status).toBe("required");
    t.set(answer("update-check-current"));
    await t.store.getState().check(true);
    expect(t.store.getState()).toMatchObject({ status: "current", latest: null, whatsNew: [] });
  });
});

describe("'Later'", () => {
  it("hides the pop-up for that version, and only that version", async () => {
    const t = setup(answer("update-check-optional"));
    await t.store.getState().check();
    t.store.getState().later();
    expect(t.store.getState().postponed).toBe(2);
    expect(shouldOfferUpdate(t.store.getState())).toBe(false);
    // asked again in the background: still quiet
    await t.store.getState().check();
    expect(shouldOfferUpdate(t.store.getState())).toBe(false);
    // a NEWER optional version appears: offered again
    const newer = { ...answer("update-check-optional"), latest: { ...answer("update-check-optional").latest!, version: "v-29.11.26-004", versionCode: 4 } };
    t.set(newer);
    await t.store.getState().check();
    expect(shouldOfferUpdate(t.store.getState())).toBe(true);
  });

  it("the person asking for updates by hand is told about it again", async () => {
    const t = setup(answer("update-check-optional"));
    await t.store.getState().check();
    t.store.getState().later();
    await t.store.getState().check(true);
    expect(t.store.getState().postponed).toBeNull();
    expect(shouldOfferUpdate(t.store.getState())).toBe(true);
  });

  it("does nothing when there is no optional update (a required update can't be put off)", async () => {
    const t = setup(answer("update-check-required"));
    await t.store.getState().check();
    t.store.getState().later();
    expect(t.store.getState().postponed).toBeNull();
    expect(t.store.getState().status).toBe("required");
  });
});

describe("the server's 'update required' refusal at sign-in", () => {
  it("puts the app into 'required', with the page and the version to install", () => {
    const { store } = setup(answer("update-check-none"));
    store.getState().markRequired(fx("error-update-required").details);
    expect(store.getState()).toMatchObject({ status: "required", pageUrl: "https://rasoipulse.in/app" });
    expect(store.getState().latest?.version).toBe("v-28.11.26-003");
  });

  it("ignores anything that isn't that refusal", () => {
    const { store } = setup(answer("update-check-none"));
    store.getState().markRequired({ code: "something_else" });
    store.getState().markRequired({});
    expect(store.getState().status).toBe("unknown");
  });
});

describe("asking again after a long time away", () => {
  it("is 'stale' before the first answer, fresh right after, and stale after 30 minutes", async () => {
    const t = setup(answer("update-check-none"));
    expect(t.store.getState().isStale()).toBe(true);
    await t.store.getState().check();
    expect(t.store.getState().isStale()).toBe(false);
    t.tick(RECHECK_AFTER_MS - 1000);
    expect(t.store.getState().isStale()).toBe(false);
    t.tick(2000);
    expect(t.store.getState().isStale()).toBe(true);
  });

  it("a failed check leaves it stale, so the next return to the app tries again", async () => {
    const t = setup(new ApiError(0, "offline"));
    await t.store.getState().check();
    expect(t.store.getState().isStale()).toBe(true);
  });
});

describe("sizes", () => {
  it("are written the way people read them", () => {
    expect(formatBytes(3_400_000)).toBe("3.2 MB");
    expect(formatBytes(34_200_000)).toBe("32.6 MB");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(900)).toBe("900 B");
    expect(formatBytes(0)).toBe("");
    expect(formatBytes(NaN)).toBe("");
  });
});
