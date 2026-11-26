#!/usr/bin/env node
/**
 * The release signing key of the staff app.
 *
 *   npm run signing:create              make the key ONCE (refuses if one exists), record its public fingerprint in git
 *   npm run signing:show                where the key is, its fingerprint, and whether it matches the one recorded in git
 *   npm run signing:verify [file.apk]   check an APK (default: the newest release in build-output/) against that fingerprint
 *
 * Read scripts/signing-lib.js for why: an update only installs over an app signed with the SAME key.
 * The key and its password are never printed and never go into git; the fingerprint (public) does.
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const lib = require("./signing-lib");

const root = path.join(__dirname, "..");
const fingerprintPath = path.join(root, lib.FINGERPRINT_FILE);

const keytool = () => (process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, "bin", "keytool") : "keytool");

/** The SHA-256 fingerprint of the certificate in a keystore. */
function keystoreFingerprint(file, password, alias = lib.KEY_ALIAS) {
  const out = execFileSync(keytool(), ["-list", "-v", "-keystore", file, "-alias", alias, "-storepass:env", "OMA_KS_PASS"], { env: { ...process.env, OMA_KS_PASS: password }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const fp = lib.parseKeytoolFingerprint(out);
  if (!fp) throw new Error("keytool did not print a SHA-256 fingerprint.");
  return fp;
}

/**
 * Makes a new key + its keystore.properties in `dir` and returns the fingerprint. Refuses to touch an existing key (a new key
 * could never update apps signed by the old one). The password is random, passed to keytool through the environment (not the
 * command line, where other programs could read it) and written only to the properties file (readable by this user only).
 */
function createKeystore({ dir = lib.defaultKeyDir(), keySize = 4096, validityDays = 10000 } = {}) {
  const storeFile = path.join(dir, "oma-release.jks");
  const propsFile = path.join(dir, lib.PROPERTIES_NAME);
  for (const f of [storeFile, propsFile]) {
    if (fs.existsSync(f)) throw new Error(`${f} already exists. Never replace the release key: a new one can't update apps signed with the old one.`);
  }
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
  const password = lib.generatePassword();
  try {
    execFileSync(
      keytool(),
      ["-genkeypair", "-alias", lib.KEY_ALIAS, "-keyalg", "RSA", "-keysize", String(keySize), "-validity", String(validityDays), "-storetype", "PKCS12", "-keystore", storeFile,
        "-storepass:env", "OMA_KS_PASS", "-keypass:env", "OMA_KS_PASS", "-dname", "CN=Rasoi Pulse OMA, O=Rasoi Pulse, C=IN"],
      { env: { ...process.env, OMA_KS_PASS: password }, stdio: ["ignore", "pipe", "pipe"] },
    );
    fs.chmodSync(storeFile, 0o600);
    fs.writeFileSync(propsFile, `# Rasoi Pulse OMA release signing. SECRET: never commit, never share. Keep a backup of this folder (see README).\nstoreFile=${storeFile}\nstorePassword=${password}\nkeyAlias=${lib.KEY_ALIAS}\nkeyPassword=${password}\n`, { mode: 0o600 });
    fs.chmodSync(propsFile, 0o600);
    return { dir, storeFile, propsFile, fingerprint: keystoreFingerprint(storeFile, password) };
  } catch (e) {
    // never leave half a key behind: it would block the next attempt, and a key with no properties is useless
    fs.rmSync(storeFile, { force: true });
    fs.rmSync(propsFile, { force: true });
    throw e;
  }
}

function runApksigner(apk) {
  const bin = lib.findApksigner(lib.findSdk());
  if (!bin) throw new Error("apksigner not found. Install the Android SDK build-tools (Android Studio → SDK Manager) or set ANDROID_HOME.");
  try {
    return execFileSync(bin, ["verify", "--verbose", "--print-certs", apk], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    return `${e.stdout ?? ""}${e.stderr ?? ""}` || String(e.message);
  }
}

const recorded = () => (fs.existsSync(fingerprintPath) ? lib.parseExpectedFingerprint(fs.readFileSync(fingerprintPath, "utf8")) : null);

/** Check an APK: returns { found, problems }. */
function verifyApk(apk, expected = recorded()) {
  const found = lib.parseApksignerCerts(runApksigner(apk));
  return { found, problems: lib.signatureProblems(found, expected) };
}

function loadProps() {
  const file = lib.findKeystoreProperties({ root });
  if (!file) return null;
  const props = lib.parseProperties(fs.readFileSync(file, "utf8"));
  return { file, props };
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "create") {
    const dirAt = rest.indexOf("--dir");
    const result = createKeystore({ dir: dirAt >= 0 ? path.resolve(rest[dirAt + 1]) : undefined });
    fs.writeFileSync(fingerprintPath, `# The public fingerprint (SHA-256) of the key every Rasoi Pulse OMA release must be signed with. Safe to commit.\n# Checked on every release build and by "npm run signing:verify". If this ever has to change, every phone must uninstall the app first.\nsha256: ${lib.prettyFingerprint(result.fingerprint)}\n`);
    console.log(`✔ Release key created.\n  key + settings : ${result.dir}   (only this user can read it)\n  fingerprint    : ${lib.prettyFingerprint(result.fingerprint)}\n  recorded in    : ${path.relative(process.cwd(), fingerprintPath)}   ← commit this file (it is public)\n`);
    console.log("NOW: back up that folder — the .jks AND keystore.properties — into your password manager or other safe storage.\nIf the key is lost, no existing phone can be updated again: every one has to uninstall the app first.");
    return;
  }
  if (cmd === "show") {
    const loaded = loadProps();
    if (!loaded) { console.log(`No release key found.\nRun: npm run signing:create`); process.exit(1); }
    const problems = lib.propertyProblems(loaded.props);
    if (problems.length) { console.log(`${loaded.file} is incomplete: ${problems.join(", ")}.`); process.exit(1); }
    if (!fs.existsSync(loaded.props.storeFile)) { console.log(`The key file ${loaded.props.storeFile} (named in ${loaded.file}) is missing.`); process.exit(1); }
    const fp = keystoreFingerprint(loaded.props.storeFile, loaded.props.storePassword, loaded.props.keyAlias);
    const exp = recorded();
    console.log(`Key settings : ${loaded.file}\nKey file     : ${loaded.props.storeFile}\nFingerprint  : ${lib.prettyFingerprint(fp)}\nRecorded     : ${exp ? lib.prettyFingerprint(exp) : "(none)"}  → ${exp ? (exp === fp ? "MATCH ✔" : "DIFFERENT ✖ — this is not the key the app was released with") : "run signing:create or restore signing-fingerprint.txt"}`);
    process.exit(exp === fp ? 0 : 1);
  }
  if (cmd === "verify") {
    const given = rest[0];
    const dir = path.join(root, "build-output");
    const apk = given ? path.resolve(given) : fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith("-release.apk")).map((f) => path.join(dir, f)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] : null;
    if (!apk || !fs.existsSync(apk)) { console.error("No APK to check. Pass a file, or build one first (npm run build:release)."); process.exit(2); }
    const { found, problems } = verifyApk(apk);
    console.log(`${path.basename(apk)}\n  signed by   : ${found.subject ?? "?"}\n  fingerprint : ${found.sha256 ? lib.prettyFingerprint(found.sha256) : "?"}`);
    if (problems.length) { console.log(`\n✖ NOT fit to hand out:\n${problems.map((p) => `  - ${p}`).join("\n")}`); process.exit(1); }
    console.log("\n✔ Signed with the release key.");
    return;
  }
  console.log("Usage: node scripts/signing.js <create|show|verify> [file.apk]");
  process.exit(2);
}

module.exports = { createKeystore, keystoreFingerprint, verifyApk, recorded, loadProps };
if (require.main === module) {
  try { main(); } catch (e) { console.error(`✖ ${e.message}`); process.exit(1); }
}
