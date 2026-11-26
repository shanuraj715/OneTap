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

/** How often the board, the dishes and the numbers refresh by themselves while a screen is in front (milliseconds). The kitchen needs a new order fast. */
export const REFRESH_MS = { board: 5_000, items: 15_000, summary: 30_000 } as const;
