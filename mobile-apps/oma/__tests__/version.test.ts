import fs from "node:fs";
import path from "node:path";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { FORMAT, parseVersion, formatVersion, nextVersion, problems, ddmmyy } = require("../scripts/version-lib");

const record = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app-version.json"), "utf8"));
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);

describe("the version is v-DDMMYY-NNN", () => {
  it("the shipped app-version.json is valid and the CURRENT version is v-261126-002 (the first was v-261126-001)", () => {
    expect(problems(record)).toEqual([]);
    expect(FORMAT.test(record.version)).toBe(true);
    // The first version ever cut. It changes only when the owner asks for an upgrade, so this test names it on purpose: if
    // someone bumps the version without being asked, this fails and says so.
    expect(record.version).toBe("v-261126-002");
    expect(record.versionCode).toBe(2);
  });

  it("formats a date and a build number", () => {
    expect(ddmmyy(at(2026, 11, 26))).toBe("261126");
    expect(formatVersion(at(2026, 11, 26), 1)).toBe("v-261126-001");
    expect(formatVersion(at(2027, 1, 5), 42)).toBe("v-050127-042");
    expect(formatVersion(at(2026, 12, 31), 1000)).toBe("v-311226-1000");
  });

  it("reads a version back, and rejects what is not one", () => {
    expect(parseVersion("v-261126-001")).toEqual({ day: 26, month: 11, year: 26, build: 1 });
    for (const bad of ["261126-001", "v-261126-01", "v-26112-001", "V-261126-001", "v-321126-001", "v-261326-001", "v-000126-001", "v-261126-001 ", "", "1.0.0"]) {
      expect(parseVersion(bad)).toBeNull();
    }
  });
});

describe("upgrading (only ever on request)", () => {
  it("the next version is today's date and the next build number", () => {
    expect(nextVersion({ version: "v-261126-001", versionCode: 1, cutOn: "2026-11-26" }, at(2026, 11, 26))).toEqual({ version: "v-261126-002", versionCode: 2, cutOn: "2026-11-26" }); // (a fixed input: it must not depend on the version the app has now)
    expect(nextVersion({ version: "v-261126-002", versionCode: 2, cutOn: "2026-11-26" }, at(2026, 12, 3))).toEqual({ version: "v-031226-003", versionCode: 3, cutOn: "2026-12-03" });
  });

  it("the build number only ever goes up, even across a year change", () => {
    const a = nextVersion({ version: "v-311226-009", versionCode: 9, cutOn: "2026-12-31" }, at(2027, 1, 1));
    expect(a).toEqual({ version: "v-010127-010", versionCode: 10, cutOn: "2027-01-01" });
  });

  it("does not change anything by itself (the record it is given is left alone)", () => {
    const copy = JSON.stringify(record);
    nextVersion(record, at(2030, 1, 1));
    expect(JSON.stringify(record)).toBe(copy);
  });

  it("refuses to build on a broken record", () => {
    expect(() => nextVersion({ version: "v-261126-001", versionCode: 5, cutOn: "2026-11-26" })).toThrow(/versionCode/);
    expect(() => nextVersion({ version: "1.0.0", versionCode: 1, cutOn: "2026-11-26" })).toThrow(/not a version/);
  });

  it("flags a versionCode or date that disagrees with the version", () => {
    expect(problems({ version: "v-261126-003", versionCode: 2, cutOn: "2026-11-26" }).join()).toMatch(/versionCode/);
    expect(problems({ version: "v-261126-001", versionCode: 1, cutOn: "2026-11-27" }).join()).toMatch(/cutOn/);
    expect(problems({ version: "v-261126-001", versionCode: 1, cutOn: "26/11/2026" }).join()).toMatch(/cutOn/);
  });
});

describe("the bump command is locked", () => {
  const { spawnSync } = require("node:child_process");
  const script = path.join(__dirname, "..", "scripts", "version.js");
  const before = fs.readFileSync(path.join(__dirname, "..", "app-version.json"), "utf8");

  it("refuses to bump without --confirm and leaves the file untouched", () => {
    const r = spawnSync(process.execPath, [script, "bump"], { encoding: "utf8" });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/only when the owner asks/i);
    expect(fs.readFileSync(path.join(__dirname, "..", "app-version.json"), "utf8")).toBe(before);
  });

  it("show and check work", () => {
    expect(spawnSync(process.execPath, [script, "show"], { encoding: "utf8" }).stdout.trim()).toBe(record.version);
    expect(spawnSync(process.execPath, [script, "check"], { encoding: "utf8" }).status).toBe(0);
  });
});

describe("the app config reads the same file", () => {
  it("app.config.ts hands the version and versionCode to Expo", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "app.config.ts"), "utf8");
    expect(src).toContain('require("./app-version.json")');
    expect(src).toContain("version: appVersion.version");
    expect(src).toContain("versionCode: appVersion.versionCode");
  });
});
