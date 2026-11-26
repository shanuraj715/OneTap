import Constants from "expo-constants";

/** The app's name: "{our app name} OMA" — OMA = Order Management App. */
export const APP_NAME = "Rasoi Pulse OMA";
export const APP_TAGLINE = "Order Management App";

/** Where the API lives (set per build by app.config.ts; the live API unless a build says otherwise). */
export const API_URL: string = String((Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl || "https://api.rasoipulse.in").replace(/\/$/, "");

/** The server's name without "https://" — shown on the sign-in and account screens, so it is always clear WHICH server the app is talking to. */
export const API_HOST: string = API_URL.replace(/^https?:\/\//, "");

/** The version shown in the app: v-DDMMYY-NNN (from app-version.json, through app.config.ts). */
export const APP_VERSION: string = Constants.expoConfig?.version ?? "dev";

/** The build number inside that version (Android's versionCode). */
export const APP_BUILD: number = Constants.expoConfig?.android?.versionCode ?? 0;

/** The sign-in is kept on the phone only when the person asks for it ("Keep me signed in"). */
export const SECURE_KEYS = { token: "oma.token", outlet: "oma.outlet" } as const;

/**
 * How often OMA asks the server for new data while a screen is in front. ONE number: the platform admin's setting for this app (console →
 * App updates → OMA → Refresh interval), which the server states in every answer (header `x-refresh-seconds`); until the first answer the
 * default is used. These three numbers are the same as `APP_REFRESH` in packages/config-schema (a test keeps them equal).
 */
export const REFRESH_DEFAULT_SECONDS = 8;
export const REFRESH_MIN_SECONDS = 3;
export const REFRESH_MAX_SECONDS = 600;

/** The wait, in milliseconds, for each thing the app refreshes by itself: the table board and the orders list refresh at the setting; "what can't be ordered" keeps its own once-a-minute pace (never faster than the setting). */
export const refreshPlan = (seconds: number) => {
  const live = seconds * 1000;
  return { tables: live, orders: live, unavailable: Math.max(60_000, live) } as const;
};
