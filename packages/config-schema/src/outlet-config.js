import { z } from "zod";
import { capacitySettingsSchema } from "./capacity.js";
import { dashboardSettingsSchema } from "./dashboard.js";
import { effectSchema } from "./effect.js";
import { featureFlagsSchema } from "./features.js";
import { shopLocationSchema } from "./geo.js";
import { feedbackSettingsSchema, menuTimesSchema, upsellSettingsSchema } from "./growth.js";
import { reservationSettingsSchema } from "./reservations.js";
import { kitchenDisplaySettingsSchema } from "./kitchen-display.js";
import { menuLayoutSchema } from "./homepage.js";
import { layoutSchema } from "./layout.js";
import { operationsSchema } from "./operations.js";
import { orderNotifySettingsSchema } from "./order-notify.js";
import { paymentSettingsSchema } from "./payments.js";
import { announcementSchema, carouselSchema } from "./storefront.js";
import { taxSchema } from "./tax.js";
import { themeSchema } from "./theme.js";
import { typographySchema } from "./typography.js";
import { walletSettingsSchema } from "./wallet.js";

export const outletIdentitySchema = z.object({
  name: z.string().default("TablePe Restaurant"),
  tagline: z.string().default(""),
  logoAssetId: z.string().nullable().default(null),
  /** the restaurant's logo — the address of an uploaded picture; shown by headers that have room for one */
  logoUrl: z.string().max(600).default(""),
  /** 14-digit FSSAI licence number — shown in the storefront footer */
  fssaiLicense: z.string().default(""),
  gstin: z.string().default(""),
  phone: z.string().default(""),
  email: z.string().default(""),
  address: z.string().default(""),
  /** map pin + formatted address — the origin for delivery distance */
  location: shopLocationSchema.default({}),
});
                                                                  

/**
 * The whole per-outlet configuration blob. Versioned: when this shape changes,
 * a migration walks every outlet's config document forward.
 */
const outletConfigObject = z.object({
  version: z.literal(1).default(1),
  identity: outletIdentitySchema.default({}),
  features: featureFlagsSchema.default({}),
  theme: themeSchema.default({}),
  /** storefront surface treatment (glass, neumorph, …) — see effect.js */
  effect: effectSchema.default({}),
  /** the browser-tab icon — one for the whole store (shared like the look; see APPEARANCE_AREAS), plan feature "favicon" */
  branding: z.object({ faviconUrl: z.string().max(600).default("") }).default({}),
  layout: layoutSchema.default({}),
  tax: taxSchema.default({}),
  typography: typographySchema.default({}),
  payments: paymentSettingsSchema.default({}),
  operations: operationsSchema.default({}),
  /** how the storefront menu is arranged — see homepage.ts */
  menuLayout: menuLayoutSchema.default({}),
  /** the coin / loyalty wallet — see wallet.ts */
  wallet: walletSettingsSchema.default({}),
  /** WhatsApp/SMS order-lifecycle alerts — see order-notify.ts. Credentials are
   *  NOT here; this outlet.config blob is served to the public storefront. */
  orderNotify: orderNotifySettingsSchema.default({}),
  /** load management — see capacity.ts */
  capacity: capacitySettingsSchema.default({}),
  /** which dashboard widgets are on, and who sees each one — see dashboard.ts */
  dashboard: dashboardSettingsSchema.default({}),
  /** the message bar above the header (its style is `layout.announcementVariant`) — see storefront.js */
  announcement: announcementSchema.default({}),
  /** the promo carousel under the header (its style is `layout.carouselVariant`) — see storefront.js */
  carousel: carouselSchema.default({}),
  /** table bookings (switched on by features.reservations.enabled) — see reservations.js */
  reservations: reservationSettingsSchema.default({}),
  /** the kitchen's own screen (/kitchen) — see kitchen-display.js */
  kitchenDisplay: kitchenDisplaySettingsSchema.default({}),
  /** ratings after an order — see growth.js */
  feedback: feedbackSettingsSchema.default({}),
  /** "goes well with your order" suggestions — see growth.js */
  upsell: upsellSettingsSchema.default({}),
  /** dishes with hours (breakfast, lunch…) — see growth.js */
  menuTimes: menuTimesSchema.default({}),
});

/**
 * Look choices that no longer exist, and what replaced them. The header used to be able to carry its own
 * message bar ("header.top-bar"); that bar is now a component of its own, so a store that chose it gets the
 * plain header that has the same main row, plus the bar — with the same tagline and phone it showed before.
 */
export const LEGACY_VARIANT_IDS = { "header.top-bar": "header.left-logo" };

function upgradeLegacy(config) {
  if (config.layout.headerVariant !== "header.top-bar") return config;
  const { identity, announcement, layout } = config;
  // only fill the bar in when the owner hasn't set one up themselves
  const untouched = !announcement.enabled && announcement.messages.length === 0;
  return {
    ...config,
    layout: {
      ...layout,
      headerVariant: LEGACY_VARIANT_IDS["header.top-bar"],
      announcementVariant: layout.announcementVariant === "announcement.solid" ? "announcement.split" : layout.announcementVariant,
    },
    announcement: untouched
      ? {
          ...announcement,
          enabled: true,
          // the old top bar had no ✕ — keep it that way until the owner chooses otherwise
          dismissible: false,
          showPhone: Boolean(identity.phone),
          messages: [{ id: "from-top-bar", text: identity.tagline || "Fresh, hot and made to order", linkLabel: "", linkHref: "" }],
        }
      : announcement,
  };
}

export const outletConfigSchema = outletConfigObject.transform(upgradeLegacy);
                                                              

/** A fully-defaulted config for a brand-new outlet. */
export function defaultOutletConfig()               {
  return outletConfigSchema.parse({});
}

/** Validate + fill defaults on a partial/loaded config. */
export function parseOutletConfig(input         )               {
  return outletConfigSchema.parse(input ?? {});
}
