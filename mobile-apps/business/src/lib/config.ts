import Constants from "expo-constants";

/** Which app this is, as the server knows it (`x-app-id`). For restaurant owners (and the managers and accountants they share reports with). */
export const APP_ID = "business";
export const APP_NAME = "Rasoi Pulse Business";
export const APP_TAGLINE = "For restaurant owners";

/** Where the API lives (set per build by app.config.ts; the live API unless a build says otherwise). */
export const API_URL: string = String((Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl || "https://api.rasoipulse.in").replace(/\/$/, "");
/** The server's name without "https://" — shown on the sign-in screen, so it is always clear WHICH server the app talks to. */
export const API_HOST: string = API_URL.replace(/^https?:\/\//, "");
export const APP_VERSION: string = Constants.expoConfig?.version ?? "dev";
export const APP_BUILD: number = Constants.expoConfig?.android?.versionCode ?? 0;
/** The sign-in is kept on the phone only when the person asks for it ("Keep me signed in"). */
export const SECURE_KEYS = { token: "business.token" } as const;
