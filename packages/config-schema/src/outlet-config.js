import { z } from "zod";
import { capacitySettingsSchema } from "./capacity.js";
import { dashboardSettingsSchema } from "./dashboard.js";
import { featureFlagsSchema } from "./features.js";
import { shopLocationSchema } from "./geo.js";
import { menuLayoutSchema } from "./homepage.js";
import { layoutSchema } from "./layout.js";
import { operationsSchema } from "./operations.js";
import { orderNotifySettingsSchema } from "./order-notify.js";
import { paymentSettingsSchema } from "./payments.js";
import { taxSchema } from "./tax.js";
import { themeSchema } from "./theme.js";
import { typographySchema } from "./typography.js";
import { walletSettingsSchema } from "./wallet.js";

export const outletIdentitySchema = z.object({
  name: z.string().default("TablePe Restaurant"),
  tagline: z.string().default(""),
  logoAssetId: z.string().nullable().default(null),
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
export const outletConfigSchema = z.object({
  version: z.literal(1).default(1),
  identity: outletIdentitySchema.default({}),
  features: featureFlagsSchema.default({}),
  theme: themeSchema.default({}),
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
});
                                                              

/** A fully-defaulted config for a brand-new outlet. */
export function defaultOutletConfig()               {
  return outletConfigSchema.parse({});
}

/** Validate + fill defaults on a partial/loaded config. */
export function parseOutletConfig(input         )               {
  return outletConfigSchema.parse(input ?? {});
}
