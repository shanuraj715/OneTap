#!/usr/bin/env node
/**
 * Version management for the web side (API, storefront, website, admin panel). The version lives in ONE file: version.json at the repository root.
 *
 *   pnpm version:show               print the current version
 *   pnpm version:check              fail when version.json is not a valid version
 *   pnpm version:bump -- --confirm  cut the NEXT version (today's date in India, build + 1)
 *
 * THE VERSION IS ONLY CHANGED WHEN THE OWNER ASKS FOR AN UPGRADE. Nothing else (a build, a deploy, a bug fix) may run `bump`; it refuses to do
 * anything without --confirm so it can't happen by accident.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { nextVersion, versionProblems } from "../packages/config-schema/src/version.js";

const FILE = fileURLToPath(new URL("../version.json", import.meta.url));
const read = () => JSON.parse(readFileSync(FILE, "utf8"));
const [command = "show", ...flags] = process.argv.slice(2);

if (command === "show") {
  console.log(read().version);
} else if (command === "check") {
  const bad = versionProblems(read().version);
  if (bad.length) {
    console.error(`version.json is not valid:\n - ${bad.join("\n - ")}`);
    process.exit(1);
  }
  console.log(`version.json is valid (${read().version})`);
} else if (command === "bump") {
  if (!flags.includes("--confirm")) {
    console.error("Not bumping. The version changes ONLY when the owner asks for an upgrade.\nIf they did, run:  pnpm version:bump -- --confirm");
    process.exit(2);
  }
  const before = read().version;
  const after = nextVersion(before);
  writeFileSync(FILE, `${JSON.stringify({ version: after }, null, 2)}\n`);
  console.log(`${before}  →  ${after}`);
} else {
  console.error(`Unknown command "${command}". Use: show | check | bump --confirm`);
  process.exit(2);
}
