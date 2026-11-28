import fs from "node:fs";
import path from "node:path";
import type { ConfigContext, ExpoConfig } from "expo/config";

// The version lives in ONE file (app-version.json) and only changes when the owner asks for an upgrade (see scripts/version.js).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const appVersion = require("./app-version.json") as { version: string; versionCode: number };

const API_URL = process.env.EXPO_PUBLIC_API_URL?.trim() || "https://api.rasoipulse.in";

// Push notifications (a delivery for you, with the app closed) need the Firebase project's `google-services.json` for com.rasoipulse.rda in this
// folder (never committed — see the README). Without it the app still builds and works; it just can't get a device token ("not available").
const GOOGLE_SERVICES = "./google-services.json";
const hasFirebase = fs.existsSync(path.join(__dirname, GOOGLE_SERVICES));

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Rasoi Pulse RDA", // {our app name} RDA — RDA = Rider Delivery App
  slug: "rasoi-pulse-rda",
  scheme: "rpda",
  // the version shown in the app, and the Android versionName; versionCode is the build number inside it
  version: appVersion.version,
  // phones AND tablets, portrait and landscape
  orientation: "default",
  // light/dark follows the phone's setting, live. Expo's default is "light" (the app would ignore the phone's dark mode), and on Android the setting only
  // works when the `expo-system-ui` package is installed — so both are needed (a test keeps them in place).
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  platforms: ["android"],
  android: {
    package: "com.rasoipulse.rda",
    versionCode: appVersion.versionCode,
    adaptiveIcon: {
      backgroundColor: "#764ED1", // the violet of the RDA icon: exactly the app's primary colour (a test keeps them equal)
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
    ...(hasFirebase ? { googleServicesFile: GOOGLE_SERVICES } : {}),
  },
  plugins: [
    "expo-router",
    ["expo-secure-store", { configureAndroidBackup: true }],
    // the small status-bar icon (white on transparent: the phone colours it), its colour (the app's violet), and the loud channel the server names
    ["expo-notifications", { icon: "./assets/android-icon-monochrome.png", color: "#764ED1", defaultChannel: "deliveries" }],
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
