import fs from "node:fs";
import path from "node:path";
import { AREAS, APP_AREAS, areasFor, canDo } from "@/lib/access";
import { SCREENS } from "@/screens/AreaScreen";
import { OWNER, SALES, SUPPORT } from "../test/harness";

describe("who sees what", () => {
  it("the owner sees every area, and Team & roles", () => {
    expect(areasFor(OWNER).map((a) => a.id)).toEqual(AREAS.map((a) => a.id));
    expect(areasFor(OWNER).some((a) => a.id === "team")).toBe(true);
  });
  it("a Sales person who holds only Onboarding sees ONE area", () => {
    expect(areasFor(SALES).map((a) => a.id)).toEqual(["onboarding"]);
  });
  it("a Support person sees the dashboard and the stores, never Team & roles", () => {
    expect(areasFor(SUPPORT).map((a) => a.id)).toEqual(["dashboard", "stores"]);
  });
  it("nobody signed in sees nothing; a person with no features sees nothing", () => {
    expect(areasFor(null)).toEqual([]);
    expect(areasFor({ ...SALES, platform: { access: false, features: [], role: null } })).toEqual([]);
  });
  it("canDo: the owner may do anything; others only what their role holds", () => {
    expect(canDo(OWNER, "storage:manage")).toBe(true);
    expect(canDo(SALES, "onboarding:manage")).toBe(true);
    expect(canDo(SALES, "stores:read")).toBe(false);
    expect(canDo(null, "dashboard:read")).toBe(false);
  });
  it("the app has a REAL screen for every area it lists as its own (a listed area without one would tell the person their role lacks it)", () => {
    for (const id of APP_AREAS) {
      expect(AREAS.some((a) => a.id === id)).toBe(true);
      expect(SCREENS[id]).toBeDefined();
    }
  });
  it("what the web console keeps for itself is not offered in the app", () => {
    for (const id of ["website", "storage", "ai"]) expect(APP_AREAS.has(id)).toBe(false);
    expect(APP_AREAS.has("app-management")).toBe(true); // the Public / Private switch is in the app; uploading a version is not
  });

  it("uses the same areas and features as the server (packages/config-schema PLATFORM_AREAS)", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "..", "..", "packages", "config-schema", "src", "platform-access.js"), "utf8");
    const block = src.slice(src.indexOf("export const PLATFORM_AREAS"), src.indexOf("/** The areas a person"));
    const server = [...block.matchAll(/\{ id: "([^"]+)", label: "([^"]+)", path: "[^"]+", features: \[([^\]]*)\](, superAdminOnly: true)? \}/g)].map((m) => ({ id: m[1]!, label: m[2]!, features: [...m[3]!.matchAll(/"([^"]+)"/g)].map((x) => x[1]!), superAdminOnly: Boolean(m[4]) }));
    expect(server.length).toBe(AREAS.length);
    expect(AREAS.map((a) => ({ id: a.id, label: a.label, features: a.features, superAdminOnly: Boolean(a.superAdminOnly) }))).toEqual(server);
  });
});
