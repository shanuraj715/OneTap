// Secrets already stored in the database (gateway keys, R2/S3 keys, AI keys, SMS / WhatsApp Business tokens, the linked WhatsApp
// sessions…) must stay readable whatever the product is called. They are locked with a key derived from ENCRYPTION_KEY and one
// fixed text (the "salt") in apps/api/src/lib/crypto.js. That text once got renamed together with the product name, which would
// have made every stored secret unreadable. This suite uses a secret locked with the ORIGINAL text, made here by an independent
// copy of the algorithm, so it keeps failing if that text ever changes. No browser, no database.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

let pass = 0, fail = 0;
const ok = (c, l, x = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${l}${x ? "  — " + x : ""}`); };

const KEY = "golden-encryption-key-for-the-regression-test";
const PLAIN = "rzp_live_golden_secret_value_0123456789";
const ORIGINAL_SALT = "onetap.payment-credentials.v1";
const RENAMED_SALT = "rasoipulse.payment-credentials.v1";
// A secret locked with ORIGINAL_SALT before the rename — it is written down here as plain text on purpose, it must never be regenerated.
const GOLDEN = "v1.AAECAwQFBgcICQoL.YG78dF6Gs2Bpvamj__9iBA.vQZ9nr5kX5Jk18hzW9xGM6YIqsyz9RFWZT5_gkPMcqvpzpASdKkl";

// the same algorithm, written out again here (not imported), for a chosen salt
const lock = (plain, salt) => {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", scryptSync(KEY, salt, 32), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
};
const unlock = (envelope, salt) => {
  const [, iv, tag, ct] = envelope.split(".");
  const d = createDecipheriv("aes-256-gcm", scryptSync(KEY, salt, 32), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
};

console.log("== The fixed test secret itself");
ok(unlock(GOLDEN, ORIGINAL_SALT) === PLAIN, "the stored test secret opens with the original text (so the test value is correct)");
let failsWithRenamed = false; try { unlock(GOLDEN, RENAMED_SALT); } catch { failsWithRenamed = true; }
ok(failsWithRenamed, "…and does NOT open with the renamed text (so this test would notice a rename)");

console.log("== The app's own code");
// load the real module with a controlled key; it reads ENCRYPTION_KEY once, at import
Object.assign(process.env, {
  NODE_ENV: "test", ENCRYPTION_KEY: KEY,
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://127.0.0.1:1/none",
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "a".repeat(48),
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "b".repeat(48),
});
const cryptoUrl = pathToFileURL(fileURLToPath(new URL("../../../apps/api/src/lib/crypto.js", import.meta.url))).href;
const app = await import(cryptoUrl);

let opened = null, err = "";
try { opened = app.decryptSecret(GOLDEN); } catch (e) { err = e.message; }
ok(opened === PLAIN, "the app opens a secret that was stored before the rename", opened === PLAIN ? "" : `got ${opened === null ? "an error: " + err : "a different value"}`);

const fresh = app.encryptSecret(PLAIN);
ok(app.decryptSecret(fresh) === PLAIN, "a secret the app locks today opens again (round trip)");
let independent = null; try { independent = unlock(fresh, ORIGINAL_SALT); } catch { /* stays null */ }
ok(independent === PLAIN, "a secret the app locks today also opens with the ORIGINAL text — old and new builds can read each other's secrets");

let renamedRejected = false; try { app.decryptSecret(lock(PLAIN, RENAMED_SALT)); } catch { renamedRejected = true; }
ok(renamedRejected, "a secret locked with the renamed text is not readable by the app (the app really uses the original text)");

console.log(`\nSUMMARY ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
