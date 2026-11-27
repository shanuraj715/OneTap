import fs from "node:fs";
import path from "node:path";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseVersion, formatVersion, nextVersion, problems, yymmdd } = require("../scripts/version-lib");

const record = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app-version.json"), "utf8"));
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);

describe("the version is v-YY.MM.DD-NNN", () => {
  it("the shipped app-version.json is valid, in the new form, and is v-26.11.28-002 (the build with push notifications; the first version was v-26.11.27-001)", () => {
    expect(problems(record)).toEqual([]);
    expect(parseVersion(record.version)).toMatchObject({ legacy: false });
    // It changes only when the owner asks for an upgrade, so this test names it on purpose: if someone bumps the version
    // without being asked, this fails and says so. (When the owner asks for the next upgrade, update this line.)
    expect(record.version).toBe("v-26.11.28-002");
    expect(record.versionCode).toBe(2);
  });

  it("formats a date and a build number: year.month.day then the build", () => {
    expect(yymmdd(at(2026, 11, 27))).toBe("26.11.27");
    expect(formatVersion(at(2026, 11, 27), 1)).toBe("v-26.11.27-001");
    expect(formatVersion(at(2027, 1, 5), 42)).toBe("v-27.01.05-042");
    expect(formatVersion(at(2026, 12, 31), 1000)).toBe("v-26.12.31-1000");
  });

  it("reads a version back, and rejects what is not one", () => {
    expect(parseVersion("v-26.11.27-001")).toEqual({ day: 27, month: 11, year: 26, build: 1, legacy: false });
    for (const bad of ["26.11.27-001", "v-26.11.27-01", "v-26.1.27-001", "v-26-11-27-001", "V-26.11.27-001", "v-26.11.32-001", "v-26.13.01-001", "v-26.00.01-001", "v-26.11.27-001 ", "", "1.0.0"]) {
      expect(parseVersion(bad)).toBeNull();
    }
  });

  it("still READS the old form v-DDMMYY-NNN (an app made before 2026-11-27 keeps working), and says it is old", () => {
    expect(parseVersion("v-261126-002")).toEqual({ day: 26, month: 11, year: 26, build: 2, legacy: true });
    for (const bad of ["v-261126-01", "v-26112-001", "v-321126-001", "v-261326-001", "v-000126-001"]) expect(parseVersion(bad)).toBeNull();
  });
});

describe("upgrading (only ever on request)", () => {
  it("the next version is today's date and the next build number", () => {
    expect(nextVersion({ version: "v-261126-001", versionCode: 1, cutOn: "2026-11-26" }, at(2026, 11, 26))).toEqual({ version: "v-26.11.26-002", versionCode: 2, cutOn: "2026-11-26" }); // (from an old-form record: the next one is in the new form) // (a fixed input: it must not depend on the version the app has now)
    expect(nextVersion({ version: "v-26.11.27-002", versionCode: 2, cutOn: "2026-11-27" }, at(2026, 12, 3))).toEqual({ version: "v-26.12.03-003", versionCode: 3, cutOn: "2026-12-03" });
  });

  it("the build number only ever goes up, even across a year change", () => {
    const a = nextVersion({ version: "v-26.12.31-009", versionCode: 9, cutOn: "2026-12-31" }, at(2027, 1, 1));
    expect(a).toEqual({ version: "v-27.01.01-010", versionCode: 10, cutOn: "2027-01-01" });
  });

  it("does not change anything by itself (the record it is given is left alone)", () => {
    const copy = JSON.stringify(record);
    nextVersion(record, at(2030, 1, 1));
    expect(JSON.stringify(record)).toBe(copy);
  });

  it("refuses to build on a broken record", () => {
    expect(() => nextVersion({ version: "v-26.11.26-001", versionCode: 5, cutOn: "2026-11-26" })).toThrow(/versionCode/);
    expect(() => nextVersion({ version: "1.0.0", versionCode: 1, cutOn: "2026-11-26" })).toThrow(/not a version/);
  });

  it("flags a versionCode or date that disagrees with the version", () => {
    expect(problems({ version: "v-26.11.26-003", versionCode: 2, cutOn: "2026-11-26" }).join()).toMatch(/versionCode/);
    expect(problems({ version: "v-26.11.26-001", versionCode: 1, cutOn: "2026-11-27" }).join()).toMatch(/cutOn/);
    expect(problems({ version: "v-26.11.26-001", versionCode: 1, cutOn: "26/11/2026" }).join()).toMatch(/cutOn/);
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
