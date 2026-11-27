const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * Signs the RELEASE build with our own key instead of Android's shared debug key.
 *
 * The native android/ folder is generated (never edited by hand), so the Gradle change goes in here. The key itself is NOT in the
 * generated file: Gradle reads the keystore.properties named by the OMA_KEYSTORE_PROPERTIES setting while it builds
 * (scripts/build-android.js sets it). Without that setting the build falls back to the debug key, and build-android.js refuses to
 * hand such a file out (see scripts/signing-lib.js).
 */
const MARKER = "// --- release signing (plugins/with-release-signing.js) ---";

const READ_PROPERTIES = `${MARKER}
def omaKeystoreFile = System.getenv('OMA_KEYSTORE_PROPERTIES') ? new File(System.getenv('OMA_KEYSTORE_PROPERTIES')) : null
def omaKeystore = new Properties()
if (omaKeystoreFile != null && omaKeystoreFile.exists()) {
    omaKeystoreFile.withInputStream { omaKeystore.load(it) }
}
def omaHasReleaseKey = omaKeystore.getProperty('storeFile') != null
// --- end release signing ---

`;

const RELEASE_CONFIG = `signingConfigs {
        release {
            if (omaHasReleaseKey) {
                storeFile file(omaKeystore.getProperty('storeFile'))
                storePassword omaKeystore.getProperty('storePassword')
                keyAlias omaKeystore.getProperty('keyAlias')
                keyPassword omaKeystore.getProperty('keyPassword')
            }
        }`;

/** Pure: the generated app/build.gradle in, the signed-release version out. Throws (loudly) when the Expo template is not what it expects. */
function patchBuildGradle(contents) {
  if (contents.includes(MARKER)) return contents; // already done (prebuild without --clean starts from the previous file)
  let out = contents;

  if (!/^android \{/m.test(out)) throw new Error("with-release-signing: could not find `android {` in app/build.gradle — the Expo template changed; update plugins/with-release-signing.js.");
  out = out.replace(/^android \{/m, `${READ_PROPERTIES}android {`);

  if (!/signingConfigs \{/.test(out)) throw new Error("with-release-signing: could not find `signingConfigs {` in app/build.gradle — the Expo template changed; update plugins/with-release-signing.js.");
  out = out.replace(/signingConfigs \{/, RELEASE_CONFIG);

  const releaseBlock = /(buildTypes \{[\s\S]*?release \{[^}]*?)signingConfig signingConfigs\.debug/;
  if (!releaseBlock.test(out)) throw new Error("with-release-signing: could not find the release build type's signingConfig in app/build.gradle — the Expo template changed; update plugins/with-release-signing.js.");
  out = out.replace(releaseBlock, "$1signingConfig omaHasReleaseKey ? signingConfigs.release : signingConfigs.debug");
  return out;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = patchBuildGradle(cfg.modResults.contents);
    return cfg;
  });
};
module.exports.patchBuildGradle = patchBuildGradle;
module.exports.MARKER = MARKER;
