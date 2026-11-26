import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/* eslint-disable @typescript-eslint/no-require-imports */
const lib = require("../scripts/signing-lib");
const { patchBuildGradle, MARKER } = require("../plugins/with-release-signing");
/* eslint-enable @typescript-eslint/no-require-imports */

const fixture = (name: string) => fs.readFileSync(path.join(__dirname, "..", "test", "fixtures", name), "utf8");
const root = path.join(__dirname, "..");
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "rda-signing-"));

const DEBUG = lib.parseApksignerCerts(fixture("apksigner-debug-key.txt"));
const OURS = "ab".repeat(32); // a stand-in fingerprint for the unit checks
const ours = (over = {}) => ({ verified: true, signers: 1, subject: "CN=Rasoi Pulse OMA, O=Rasoi Pulse, C=IN", sha256: OURS, sha256s: [OURS], ...over });

describe("reading apksigner's answer (real output of a debug-signed APK)", () => {
  it("finds who signed it and the certificate fingerprint, in the 'V2 Signer' wording this apksigner uses", () => {
    expect(DEBUG).toMatchObject({ verified: true, signers: 1, subject: expect.stringContaining("CN=Android Debug") });
    expect(DEBUG.sha256).toBe("fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c");
    expect(DEBUG.sha256s).toHaveLength(1);
  });
  it("also reads the older 'Signer #1' wording", () => {
    const old = "Verifies\nNumber of signers: 1\nSigner #1 certificate DN: CN=Rasoi Pulse OMA\nSigner #1 certificate SHA-256 digest: AABB\n";
    expect(lib.parseApksignerCerts(old)).toMatchObject({ subject: "CN=Rasoi Pulse OMA", sha256: "aabb", signers: 1, verified: true });
  });
  it("lists a certificate once even when v2 and v3 both name it, and lists two different ones separately", () => {
    const same = "Verifies\nNumber of signers: 1\nV2 Signer: certificate SHA-256 digest: aa\nV3 Signer: certificate SHA-256 digest: AA\n";
    expect(lib.parseApksignerCerts(same).sha256s).toEqual(["aa"]);
    const differ = "Verifies\nNumber of signers: 1\nV2 Signer: certificate SHA-256 digest: aa\nV3 Signer: certificate SHA-256 digest: bb\n";
    expect(lib.parseApksignerCerts(differ).sha256s).toEqual(["aa", "bb"]);
  });
  it("an invalid or unreadable answer is 'not verified', never a pass", () => {
    expect(lib.parseApksignerCerts("DOES NOT VERIFY\nERROR: JAR_SIG_NO_SIGNATURES").verified).toBe(false);
    expect(lib.parseApksignerCerts("").verified).toBe(false);
    expect(lib.parseApksignerCerts(undefined)).toMatchObject({ verified: false, sha256: null, subject: null });
  });
});

describe("is an APK fit to hand out?", () => {
  it("the one signed with OUR key is", () => expect(lib.signatureProblems(ours(), OURS)).toEqual([]));
  it("the shared debug key is refused, with or without a recorded fingerprint", () => {
    expect(lib.signatureProblems(DEBUG, OURS).join(" ")).toMatch(/DEBUG key/);
    expect(lib.signatureProblems(DEBUG, null).join(" ")).toMatch(/DEBUG key/);
  });
  it("a different key is refused, and both fingerprints are named so the mix-up is obvious", () => {
    const other = "11".repeat(32);
    const out = lib.signatureProblems(ours({ sha256: other, sha256s: [other] }), OURS).join(" ");
    expect(out).toMatch(/DIFFERENT key/);
    expect(out).toContain(lib.prettyFingerprint(other));
    expect(out).toContain(lib.prettyFingerprint(OURS));
  });
  it("compares fingerprints without caring about colons or capitals", () => {
    expect(lib.signatureProblems(ours(), lib.prettyFingerprint(OURS))).toEqual([]);
    expect(lib.signatureProblems(ours(), OURS.toUpperCase())).toEqual([]);
  });
  it("with no fingerprint recorded, even a good-looking key is refused (nothing to prove it is THE key)", () => {
    expect(lib.signatureProblems(ours(), null).join(" ")).toMatch(/No key fingerprint is recorded/);
  });
  it("an invalid signature, two signers, or two certificates are all refused", () => {
    expect(lib.signatureProblems({ ...ours(), verified: false }, OURS)).toHaveLength(1);
    expect(lib.signatureProblems(ours({ signers: 2 }), OURS).join(" ")).toMatch(/2 signers/);
    expect(lib.signatureProblems(ours({ sha256s: [OURS, "22".repeat(32)] }), OURS).join(" ")).toMatch(/different certificates/);
  });
  it("the fingerprint recorded in git is well formed and is not the debug key", () => {
    const recorded = lib.parseExpectedFingerprint(fs.readFileSync(path.join(root, lib.FINGERPRINT_FILE), "utf8"));
    expect(recorded).toMatch(/^[0-9a-f]{64}$/);
    expect(recorded).not.toBe(DEBUG.sha256);
  });
  it("reads the recorded fingerprint through comments, a label and colons", () => {
    expect(lib.parseExpectedFingerprint(`# note\n\nsha256: ${lib.prettyFingerprint(OURS)}\n`)).toBe(OURS);
    expect(lib.parseExpectedFingerprint("# only a comment")).toBeNull();
    expect(lib.parseExpectedFingerprint("sha256: nonsense")).toBeNull();
  });
});

describe("keystore.properties", () => {
  it("reads key=value lines and skips comments", () => {
    expect(lib.parseProperties("# c\nstoreFile=/a b/c.jks\n\nkeyAlias = x \nstorePassword=p=q\n")).toEqual({ storeFile: "/a b/c.jks", keyAlias: "x", storePassword: "p=q" });
  });
  it("says what is missing", () => {
    expect(lib.propertyProblems({ storeFile: "/x", storePassword: "p", keyAlias: "a", keyPassword: "p" })).toEqual([]);
    expect(lib.propertyProblems({ storeFile: "/x", keyAlias: "a" })).toEqual(['"storePassword" is missing', '"keyPassword" is missing']);
    expect(lib.propertyProblems(null)).toHaveLength(4);
  });
  it("is looked for in the setting first, then the app folder, then the default key folder", () => {
    const home = tmp(), app = tmp(), custom = tmp();
    const inHome = path.join(lib.defaultKeyDir(home), "keystore.properties");
    fs.mkdirSync(path.dirname(inHome), { recursive: true });
    fs.writeFileSync(inHome, "x=1");
    expect(lib.findKeystoreProperties({ root: app, home, env: {} })).toBe(inHome);
    fs.writeFileSync(path.join(app, "keystore.properties"), "x=1");
    expect(lib.findKeystoreProperties({ root: app, home, env: {} })).toBe(path.join(app, "keystore.properties"));
    fs.writeFileSync(path.join(custom, "k.properties"), "x=1");
    expect(lib.findKeystoreProperties({ root: app, home, env: { OMA_KEYSTORE_PROPERTIES: path.join(custom, "k.properties") } })).toBe(path.join(custom, "k.properties"));
    // a setting that points at nothing falls through to the next place instead of failing silently
    expect(lib.findKeystoreProperties({ root: app, home, env: { OMA_KEYSTORE_PROPERTIES: path.join(custom, "missing") } })).toBe(path.join(app, "keystore.properties"));
    expect(lib.findKeystoreProperties({ root: tmp(), home: tmp(), env: {} })).toBeNull();
  });
  it("the default key folder is outside any repository (under the home folder)", () => {
    expect(lib.defaultKeyDir("/home/x")).toBe(path.join("/home/x", ".rasoi-pulse", "signing", "oma"));
  });
  it("passwords are random and long", () => {
    const a = lib.generatePassword(), b = lib.generatePassword();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });
});

describe("one company key for the Rasoi Pulse apps (OMA, KDA and RDA)", () => {
  const node = (home: string) => {
    try { return { code: 0, out: execFileSync("node", [path.join(root, "scripts", "signing.js"), "create"], { env: { ...process.env, HOME: home }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) }; }
    catch (e) { const x = e as { status: number; stdout: string }; return { code: x.status, out: String(x.stdout) }; }
  };
  it("the fingerprint this app must be signed with is the staff app's: the same key, so one backup covers both", () => {
    const sibling = path.join(root, "..", "oma", "signing-fingerprint.txt");
    expect(fs.existsSync(sibling)).toBe(true);
    expect(lib.parseExpectedFingerprint(fs.readFileSync(path.join(root, "signing-fingerprint.txt"), "utf8"))).toBe(lib.parseExpectedFingerprint(fs.readFileSync(sibling, "utf8")));
  });
  it("'signing:create' never makes a second key: with a key present it says where it is", () => {
    const home = tmp();
    const dir = lib.defaultKeyDir(home);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "keystore.properties"), "storeFile=/x\nstorePassword=p\nkeyAlias=a\nkeyPassword=p\n");
    const r = node(home);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/share ONE release key, and it already exists/);
    expect(fs.readdirSync(dir)).toEqual(["keystore.properties"]); // nothing was made
  });
  it("…and with no key present it points to the staff app, where the key is made once, and makes nothing", () => {
    const home = tmp();
    const r = node(home);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/cd \.\.\/oma && npm run signing:create/);
    expect(fs.existsSync(lib.defaultKeyDir(home))).toBe(false);
  });
  it("the password is not on keytool's command line (other programs can read command lines)", () => {
    const src = fs.readFileSync(path.join(root, "scripts", "signing.js"), "utf8");
    expect(src).toContain('"-storepass:env"');
    expect(src).not.toMatch(/"-storepass",/);
    expect(src).not.toMatch(/"-keypass",/);
  });
});

describe("the Gradle change that signs the release build (against the real generated app/build.gradle)", () => {
  const generated = fixture("build.gradle.generated");

  it("starts from a file that signs release with the debug key (the problem)", () => {
    expect(generated).toMatch(/release \{[^}]*signingConfig signingConfigs\.debug/);
    expect(generated).not.toContain(MARKER);
  });

  const patched = patchBuildGradle(generated);
  it("adds a release signing config that reads the key from the settings file, and no secret is written into the file", () => {
    expect(patched).toContain(MARKER);
    expect(patched).toContain("System.getenv('OMA_KEYSTORE_PROPERTIES')");
    expect(patched).toMatch(/signingConfigs \{\s+release \{[\s\S]*storeFile file\(omaKeystore\.getProperty\('storeFile'\)\)/);
    expect(patched).not.toMatch(/storePassword '[^']*'\s*\n\s*keyAlias 'rasoi/);
    expect(patched).toContain("storePassword 'android'"); // only Android's public debug key password, which was there already
  });
  it("makes the release build type use it — and leaves the debug build type on the debug key", () => {
    expect(patched).toMatch(/release \{[^}]*signingConfig omaHasReleaseKey \? signingConfigs\.release : signingConfigs\.debug/);
    expect(patched).toMatch(/debug \{\s+signingConfig signingConfigs\.debug\s+\}/);
  });
  it("is done once, however many times prebuild runs over the same file", () => {
    expect(patchBuildGradle(patched)).toBe(patched);
    expect(patched.split(MARKER).length).toBe(2);
  });
  it("everything else in the file is untouched", () => {
    const strip = (s: string) => s.replace(/\/\/ --- release signing[\s\S]*?\/\/ --- end release signing ---\n\n/, "").replace(/release \{\s+if \(omaHasReleaseKey\)[\s\S]*?\n {8}\}\n {8}/, "").replace("signingConfig omaHasReleaseKey ? signingConfigs.release : signingConfigs.debug", "signingConfig signingConfigs.debug");
    expect(strip(patched)).toBe(generated);
  });
  it("fails loudly (never silently skips) when the Expo template changes shape", () => {
    expect(() => patchBuildGradle("plugins {}\n")).toThrow(/android \{/);
    expect(() => patchBuildGradle("android {\n  buildTypes { release { } }\n}\n")).toThrow(/signingConfigs \{/);
    expect(() => patchBuildGradle("android {\n  signingConfigs { debug { } }\n  buildTypes { debug { } }\n}\n")).toThrow(/release build type/);
  });
});

describe("the build script's guard", () => {
  const script = fs.readFileSync(path.join(root, "scripts", "build-android.js"), "utf8");
  it("refuses a release build with no key (unless asked, in words, to make a throwaway)", () => {
    expect(script).toMatch(/No release signing key found/);
    expect(script).toContain("RP_ALLOW_DEBUG_SIGNING");
  });
  it("checks the finished APK BEFORE anything copies it anywhere", () => {
    const check = script.indexOf("verifyApk(apk)");
    expect(check).toBeGreaterThan(0);
    // EVERY copy of the APK comes after the check (and there is at least one)
    const copies = [...script.matchAll(/copyFileSync\(/g)].map((m) => m.index as number);
    expect(copies.length).toBeGreaterThan(0);
    for (const at of copies) expect(at).toBeGreaterThan(check);
    // and a failed check stops the build there
    expect(script.slice(check, script.indexOf("copyFileSync("))).toMatch(/process\.exit\(1\)/);
  });
  it("a throwaway debug-key release is named so it can't be mistaken for a real one", () => {
    expect(script).toContain("release-DEBUGKEY");
  });
  it("the Gradle change is registered in the app config", () => {
    expect(fs.readFileSync(path.join(root, "app.config.ts"), "utf8")).toContain("./plugins/with-release-signing");
  });
});
