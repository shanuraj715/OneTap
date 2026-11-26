#!/usr/bin/env node
/**
 * Version management for the staff app. The version lives in ONE file: app-version.json.
 *
 *   npm run version:show               print the current version
 *   npm run version:check              fail when app-version.json is not a valid version (also part of `npm run check`)
 *   npm run version:bump -- --confirm  cut the NEXT version (today's date, build + 1)
 *
 * THE VERSION IS ONLY CHANGED WHEN THE OWNER ASKS FOR AN UPGRADE. Nothing else (a build, a deploy, a bug fix, CI) may run `bump`;
 * it refuses to do anything without --confirm so it can't happen by accident.
 */
const fs = require("node:fs");
const path = require("node:path");
const { nextVersion, problems } = require("./version-lib");

const FILE = path.join(__dirname, "..", "app-version.json");
const read = () => JSON.parse(fs.readFileSync(FILE, "utf8"));
const [command = "show", ...flags] = process.argv.slice(2);

if (command === "show") {
  console.log(read().version);
} else if (command === "check") {
  const bad = problems(read());
  if (bad.length) {
    console.error(`app-version.json is not valid:\n - ${bad.join("\n - ")}`);
    process.exit(1);
  }
  console.log(`app-version.json is valid (${read().version})`);
} else if (command === "bump") {
  if (!flags.includes("--confirm")) {
    console.error("Not bumping. The app version changes ONLY when the owner asks for an upgrade.\nIf they did, run:  npm run version:bump -- --confirm");
    process.exit(2);
  }
  const before = read();
  const after = nextVersion(before);
  fs.writeFileSync(FILE, `${JSON.stringify(after, null, 2)}\n`);
  console.log(`${before.version}  →  ${after.version}   (Android versionCode ${before.versionCode} → ${after.versionCode})`);
} else {
  console.error(`Unknown command "${command}". Use: show | check | bump --confirm`);
  process.exit(2);
}
