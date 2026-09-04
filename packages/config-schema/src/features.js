import { z } from "zod";

/**
 * Per-outlet feature flags. Resolution order (built later): platform defaults →
 * plan entitlements → brand → outlet override. Also gates which order paths the
 * storefront and admin expose.
 */
export const featureFlagsSchema = z.object({
  ordering: z
    .object({
      takeaway: z.boolean().default(true),
      dineInQr: z.boolean().default(true),
      delivery: z.boolean().default(false),
    })
    .default({}),
  reservations: z
    .object({
      enabled: z.boolean().default(false),
    })
    .default({}),
  payments: z
    .object({
      razorpay: z.boolean().default(false),
      cod: z.boolean().default(true),
    })
    .default({}),
  ui: z
    .object({
      scrollToTop: z.boolean().default(true),
      announcementBar: z.boolean().default(false),
    })
    .default({}),
});
                                                              
