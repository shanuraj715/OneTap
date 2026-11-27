/**
 * The app's release signing key: where it lives, how it is read, and how a finished APK is checked against it.
 *
 * Why this matters: Android installs an update over an installed app ONLY when both files are signed by the same key. A release signed
 * with a different key can't update the phones that have the old one — staff would have to uninstall (and lose their sign-in).
 * So the key is made once, kept safe for the life of the app, and every release is checked against its fingerprint before it is
 * allowed out of `build-output/`.
 *
 * Plain CommonJS with no side effects, so the command line (signing.js, build-android.js), the Gradle plugin and the tests all use it.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

/**
 * Where the key lives by default: outside every repository, so no `git clean`, worktree or deploy can ever touch it.
 * The Rasoi Pulse apps (OMA, KDA, RDA, Admin) are signed with ONE company key: the same folder, the same alias. (Android allows one key for many apps.)
 * The folder is called "oma" because the key was first made for OMA; renaming it would break every existing build setup.
 */
const defaultKeyDir = (home = os.homedir()) => path.join(home, ".rasoi-pulse", "signing", "oma");
const KEY_ALIAS = "rasoipulse-oma";
const PROPERTIES_NAME = "keystore.properties";
const FINGERPRINT_FILE = "signing-fingerprint.txt";

/** Java-style `key=value` lines (what Gradle reads). Blank lines and `#` comments are skipped. */
function parseProperties(text) {
  const out = {};
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("!")) continue;
    const at = line.search(/[=:]/);
    if (at < 1) continue;
    out[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return out;
}

/** What is missing from a keystore.properties (an empty list = complete). */
function propertyProblems(props) {
  const out = [];
  for (const key of ["storeFile", "storePassword", "keyAlias", "keyPassword"]) {
    if (!props || !String(props[key] ?? "").trim()) out.push(`"${key}" is missing`);
  }
  return out;
}

/**
 * The keystore.properties to use, in this order: the OMA_KEYSTORE_PROPERTIES setting, one in the app's folder (the usual Android
 * place; git-ignored), then the one in the default key folder. Returns a path, or null when there is none.
 */
function findKeystoreProperties({ root, home = os.homedir(), env = process.env } = {}) {
  const candidates = [env.OMA_KEYSTORE_PROPERTIES, root && path.join(root, PROPERTIES_NAME), path.join(defaultKeyDir(home), PROPERTIES_NAME)].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

/** "AA:BB:cc" → "aabbcc" — fingerprints are compared without colons and case. */
const normalizeFingerprint = (s) => String(s ?? "").replace(/[^0-9a-fA-F]/g, "").toLowerCase();

/** "aabb…" → "AA:BB:…" for people to read */
const prettyFingerprint = (hex) => (normalizeFingerprint(hex).match(/.{1,2}/g) ?? []).join(":").toUpperCase();

/** The SHA-256 certificate fingerprint printed by `keytool -list -v`. */
function parseKeytoolFingerprint(output) {
  const m = /SHA-?256:\s*([0-9A-Fa-f:]{64,})/.exec(String(output ?? ""));
  return m ? normalizeFingerprint(m[1]) : null;
}

/**
 * Who signed an APK, from `apksigner verify --print-certs`. The wording depends on the signature schemes in the file: older output says
 * "Signer #1 certificate …", newer says "V2 Signer: certificate …" (and "V3 Signer: …" when there is also a v3 signature). All of them
 * must name the same certificate; `sha256s` lists the distinct ones so a file with two different signers can be refused.
 */
function parseApksignerCerts(output) {
  const text = String(output ?? "");
  const WHO = String.raw`(?:Signer #\d+|V\d(?:\.\d)? Signer):?`;
  const subjects = [...text.matchAll(new RegExp(`${WHO} certificate DN:\\s*(.+)`, "g"))].map((m) => m[1].trim());
  const digests = [...text.matchAll(new RegExp(`${WHO} certificate SHA-256 digest:\\s*([0-9a-fA-F]+)`, "g"))].map((m) => normalizeFingerprint(m[1]));
  const sha256s = [...new Set(digests)];
  const signers = Number(/Number of signers:\s*(\d+)/.exec(text)?.[1] ?? 0);
  const verified = /^Verifies\s*$/m.test(text);
  return { subject: subjects[0] ?? null, sha256: sha256s[0] ?? null, sha256s, signers, verified };
}

/** The fingerprint kept in git (signing-fingerprint.txt): the first line that is not a comment. */
function parseExpectedFingerprint(text) {
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const fp = normalizeFingerprint(line.replace(/^sha-?256\s*[:=]?\s*/i, ""));
    return fp.length === 64 ? fp : null;
  }
  return null;
}

const isDebugSubject = (subject) => /CN=Android Debug/i.test(String(subject ?? ""));

/**
 * Is this APK fit to hand out? Everything wrong with it, in words (an empty list = fine).
 * `expected` is the fingerprint of OUR key (null = none recorded yet).
 */
function signatureProblems(found, expected) {
  const out = [];
  if (!found || !found.verified) return ["Android's own check (apksigner) says the signature is not valid."];
  if (found.signers !== 1) out.push(`The APK has ${found.signers} signers; it must have exactly one.`);
  if ((found.sha256s?.length ?? 0) > 1) out.push("The APK's signature schemes name different certificates; it must be signed with one key throughout.");
  if (isDebugSubject(found.subject)) out.push("It is signed with Android's shared DEBUG key. Phones can't update it from, or to, a properly signed app.");
  if (!found.sha256) out.push("Couldn't read the signing certificate's fingerprint.");
  else if (expected && found.sha256 !== normalizeFingerprint(expected)) {
    out.push(`It is signed by a DIFFERENT key (${prettyFingerprint(found.sha256)}) than the one this app is released with (${prettyFingerprint(expected)}). Phones that have the earlier version would refuse it as an update.`);
  } else if (!expected && !isDebugSubject(found.subject)) {
    out.push(`No key fingerprint is recorded yet (${FINGERPRINT_FILE}). Run "npm run signing:create" once, or restore the file from git.`);
  }
  return out;
}

/** A random password nobody has to remember (it lives in keystore.properties, next to the key, and in your backup). */
const generatePassword = () => crypto.randomBytes(24).toString("base64url");

/** The newest `apksigner` of the Android SDK's build-tools, or null. */
function findApksigner(sdk) {
  if (!sdk) return null;
  const dir = path.join(sdk, "build-tools");
  if (!fs.existsSync(dir)) return null;
  const newest = fs.readdirSync(dir).filter((d) => /^\d+(\.\d+)*$/.test(d)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop();
  const bin = newest && path.join(dir, newest, process.platform === "win32" ? "apksigner.bat" : "apksigner");
  return bin && fs.existsSync(bin) ? bin : null;
}

function findSdk(env = process.env, home = os.homedir()) {
  return [env.ANDROID_HOME, env.ANDROID_SDK_ROOT, path.join(home, "Library/Android/sdk"), path.join(home, "Android/Sdk")].find((p) => p && fs.existsSync(path.join(p, "platforms")));
}

module.exports = {
  defaultKeyDir, KEY_ALIAS, PROPERTIES_NAME, FINGERPRINT_FILE,
  parseProperties, propertyProblems, findKeystoreProperties,
  normalizeFingerprint, prettyFingerprint, parseKeytoolFingerprint, parseApksignerCerts, parseExpectedFingerprint,
  isDebugSubject, signatureProblems, generatePassword, findApksigner, findSdk,
};
