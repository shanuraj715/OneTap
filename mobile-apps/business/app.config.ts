import type { ConfigContext, ExpoConfig } from "expo/config";

// The version lives in ONE file (app-version.json) and only changes when the owner asks for an upgrade (see scripts/version.js).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const appVersion = require("./app-version.json") as { version: string; versionCode: number };

const API_URL = process.env.EXPO_PUBLIC_API_URL?.trim() || "https://api.rasoipulse.in";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Rasoi Pulse Business", // for restaurant owners (private until the platform admin makes it public in App Management)
  slug: "rasoi-pulse-business",
  scheme: "rpbusiness",
  // the version shown in the app, and the Android versionName; versionCode is the build number inside it
  version: appVersion.version,
  // phones AND tablets, portrait and landscape
  orientation: "default",
  // light/dark follows the phone's setting, live. Expo's default is "light" (the app would ignore dark mode), and on Android the setting only works
  // when the `expo-system-ui` package is installed — so both are needed (a test keeps them in place).
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  platforms: ["android"],
  android: {
    package: "com.rasoipulse.business",
    versionCode: appVersion.versionCode,
    adaptiveIcon: {
      backgroundColor: "#C2185B", // the rose of the Business icon: exactly the app's primary colour (a test keeps them equal)
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-router",
    ["expo-secure-store", { configureAndroidBackup: true }],
    // reports are saved to the phone and handed to the share sheet (save to Drive / Files, send on WhatsApp, open in a viewer)
    "expo-sharing",
    // the optional app lock (fingerprint / face / screen lock) — financial figures are private
    ["expo-local-authentication", { faceIDPermission: "Use Face ID to unlock Rasoi Pulse Business." }],
    [
      "expo-build-properties",
      {
        android: {
          minSdkVersion: 30, // Android 11
          compileSdkVersion: 37,
          targetSdkVersion: 36,
          // only the phone / tablet CPU type (every Android 11+ device, and the Apple-silicon emulator): a quarter of the native work
          buildArchs: ["arm64-v8a"],
          // plain http:// only when asked for (a debug build against a local API) — never in a release build
          usesCleartextTraffic: process.env.RP_ALLOW_HTTP === "1",
        },
      },
    ],
    "./plugins/with-fast-gradle",
    // the release build is signed with our own key (see scripts/signing-lib.js), not Android's shared debug key
    "./plugins/with-release-signing",
  ],
  extra: { apiUrl: API_URL },
});
