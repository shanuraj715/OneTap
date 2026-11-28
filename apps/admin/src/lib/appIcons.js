import { appAccentFor, generatedAppIcon } from "@rasoipulse/config-schema";

/** The artwork of the built-in apps (public/app-icons, the same pictures as the phone apps and the website). */
const ARTWORK = { oma: "/app-icons/oma.svg", kda: "/app-icons/kda.svg", rda: "/app-icons/rda.svg", admin: "/app-icons/admin.svg", business: "/app-icons/business.svg" };

/** The picture for an app (one row of the console's app list: `{ app, code }`): its artwork, or a tile with its code on it for an app added in the console. */
export const appIconUrl = (a) => ARTWORK[a?.app] ?? generatedAppIcon(a?.code, appAccentFor(a?.app ?? ""));
