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

/** How often the table board and orders refresh by themselves while a screen is in front (milliseconds). */
export const REFRESH_MS = { tables: 8_000, orders: 10_000 } as const;
