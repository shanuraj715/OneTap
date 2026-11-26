import Constants from "expo-constants";

/** Which app this is, as the server knows it (the update check, the sign-in rule, the download page). */
export const APP_ID = "rda";
/** The app's name: "{our app name} RDA" — RDA = Rider Delivery App. */
export const APP_NAME = "Rasoi Pulse RDA";
export const APP_TAGLINE = "Rider Delivery App";

/** Where the API lives (set per build by app.config.ts; the live API unless a build says otherwise). */
export const API_URL: string = String((Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl || "https://api.rasoipulse.in").replace(/\/$/, "");

/** The server's name without "https://" — shown on the sign-in and account screens, so it is always clear WHICH server the app is talking to. */
export const API_HOST: string = API_URL.replace(/^https?:\/\//, "");

/** The version shown in the app: v-DDMMYY-NNN (from app-version.json, through app.config.ts). */
export const APP_VERSION: string = Constants.expoConfig?.version ?? "dev";

/** The build number inside that version (Android's versionCode). */
export const APP_BUILD: number = Constants.expoConfig?.android?.versionCode ?? 0;

/** The sign-in is kept on the phone only when the person asks for it ("Keep me signed in"). */
export const SECURE_KEYS = { token: "rda.token" } as const;

/** How often the rider's deliveries refresh by themselves while the screen is in front (milliseconds): a new delivery must show within seconds. */
export const REFRESH_MS = { deliveries: 10_000 } as const;
