import Constants from "expo-constants";

/** Which app this is, as the server knows it (the update check, the sign-in rule, the download page). */
export const APP_ID = "kda";
/** The app's name: "{our app name} KDA" — KDA = Kitchen Display App. */
export const APP_NAME = "Rasoi Pulse KDA";
export const APP_TAGLINE = "Kitchen Display App";

/** Where the API lives (set per build by app.config.ts; the live API unless a build says otherwise). */
export const API_URL: string = String((Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl || "https://api.rasoipulse.in").replace(/\/$/, "");

/** The server's name without "https://" — shown on the sign-in and account screens, so it is always clear WHICH server the app is talking to. */
export const API_HOST: string = API_URL.replace(/^https?:\/\//, "");

/** The version shown in the app: v-DDMMYY-NNN (from app-version.json, through app.config.ts). */
export const APP_VERSION: string = Constants.expoConfig?.version ?? "dev";

/** The build number inside that version (Android's versionCode). */
export const APP_BUILD: number = Constants.expoConfig?.android?.versionCode ?? 0;

/** The sign-in is kept on the phone only when the person asks for it ("Keep me signed in"). */
export const SECURE_KEYS = { token: "kda.token", outlet: "kda.outlet" } as const;

/**
 * How often KDA asks the server for new data while a screen is in front. ONE number: the platform admin's setting for this app (console →
 * App updates → KDA → Refresh interval), which the server states in every answer (header `x-refresh-seconds`); until the first answer the
 * default is used. These three numbers are the same as `APP_REFRESH` in packages/config-schema (a test keeps them equal).
 */
export const REFRESH_DEFAULT_SECONDS = 8;
export const REFRESH_MIN_SECONDS = 3;
export const REFRESH_MAX_SECONDS = 600;

/** The wait, in milliseconds, for each thing the app refreshes by itself: the kitchen board refreshes at the setting; the dishes list (15 s) and today's numbers (30 s) keep their own slower pace, never faster than the setting. */
export const refreshPlan = (seconds: number) => {
  const live = seconds * 1000;
  return { board: live, items: Math.max(15_000, live), summary: Math.max(30_000, live) } as const;
};
