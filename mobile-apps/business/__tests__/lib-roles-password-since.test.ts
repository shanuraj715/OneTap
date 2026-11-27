import { execFileSync } from "node:child_process";
import path from "node:path";
import { since } from "@/lib/dates";
import { generatePassword } from "@/lib/password";
import { ASSIGNABLE_ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, roleLabel } from "@/lib/roles";

describe("roles are named and described the same as in the web dashboard", () => {
  it("labels and descriptions match packages/config-schema", () => {
    const file = path.resolve(__dirname, "../../../packages/config-schema/src/rbac.js");
    const theirs = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", `import { ROLE_LABELS, ROLE_DESCRIPTIONS, ROLES } from ${JSON.stringify(file)}; console.log(JSON.stringify({ ROLE_LABELS, ROLE_DESCRIPTIONS, ROLES }));`], { encoding: "utf8" })) as { ROLE_LABELS: Record<string, string>; ROLE_DESCRIPTIONS: Record<string, string>; ROLES: string[] };
    expect(ROLE_LABELS).toEqual(theirs.ROLE_LABELS);
    expect(ROLE_DESCRIPTIONS).toEqual(theirs.ROLE_DESCRIPTIONS);
    for (const r of ASSIGNABLE_ROLES) expect(theirs.ROLES).toContain(r);
  });
  it("the app never offers the owner or super admin role", () => {
    expect(ASSIGNABLE_ROLES).not.toContain("owner");
    expect(ASSIGNABLE_ROLES).not.toContain("super_admin");
  });
  it("an unknown or missing role is shown plainly", () => {
    expect(roleLabel("staff")).toBe("Cashier / Staff");
    expect(roleLabel(null)).toBe("No role");
    expect(roleLabel("barista")).toBe("barista");
  });
});

describe("generatePassword", () => {
  it("is at least 8 characters, 10 by default, from characters that can't be mixed up", () => {
    expect(generatePassword()).toHaveLength(10);
    expect(generatePassword(3)).toHaveLength(8);
    expect(generatePassword(16)).toHaveLength(16);
    for (let i = 0; i < 50; i++) expect(generatePassword(24)).toMatch(/^[A-HJ-NP-Za-km-z2-9]+$/);
  });
  it("is different every time", () => {
    expect(new Set(Array.from({ length: 40 }, () => generatePassword())).size).toBe(40);
  });
});

describe("since — how long ago", () => {
  const now = new Date("2026-11-28T12:00:00+05:30");
  const at = (iso: string) => since(new Date(iso).toISOString(), now);
  it("says never for nothing", () => { expect(since(null, now)).toBe("never"); expect(since("", now)).toBe("never"); expect(since("not a date", now)).toBe("never"); });
  it("minutes, hours, yesterday, days, weeks, then the date", () => {
    expect(at("2026-11-28T11:59:40+05:30")).toBe("just now");
    expect(at("2026-11-28T11:25:00+05:30")).toBe("35 min ago");
    expect(at("2026-11-28T11:00:00+05:30")).toBe("1 hour ago");
    expect(at("2026-11-28T07:00:00+05:30")).toBe("5 hours ago");
    expect(at("2026-11-27T15:00:00+05:30")).toBe("21 hours ago");
    expect(at("2026-11-27T10:00:00+05:30")).toBe("yesterday"); // more than a day, and yesterday's date
    expect(at("2026-11-24T09:00:00+05:30")).toBe("4 days ago");
    expect(at("2026-11-07T09:00:00+05:30")).toBe("3 weeks ago");
    expect(at("2026-08-01T09:00:00+05:30")).toBe("1 Aug 2026");
  });
});
