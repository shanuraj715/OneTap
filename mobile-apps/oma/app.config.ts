import type { ConfigContext, ExpoConfig } from "expo/config";

// The version lives in ONE file (app-version.json) and only changes when the owner asks for an upgrade (see scripts/version.js).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const appVersion = require("./app-version.json") as { version: string; versionCode: number };

const API_URL = process.env.EXPO_PUBLIC_API_URL?.trim() || "https://api.rasoipulse.in";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Rasoi Pulse OMA", // {our app name} OMA — OMA = Order Management App
  slug: "rasoi-pulse-oma",
  scheme: "rpoma",
  // the version shown in the app, and the Android versionName; versionCode is the build number inside it
  version: appVersion.version,
  // phones AND tablets, portrait and landscape
  orientation: "default",
  // light/dark follows the phone's setting (Android's default) — nothing to configure, and no extra package needed
  icon: "./assets/icon.png",
  platforms: ["android"],
  android: {
    package: "com.rasoipulse.oma",
    versionCode: appVersion.versionCode,
    adaptiveIcon: {
      backgroundColor: "#C6362F",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-router",
    ["expo-secure-store", { configureAndroidBackup: true }],
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
