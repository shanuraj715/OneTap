import { z } from "zod";

/**
 * GST settings. Indian restaurant menus usually quote tax-inclusive prices and
 * show the breakup on the bill, so that's the default.
 */
export const taxSchema = z.object({
  pricesIncludeTax: z.boolean().default(true),
  defaultGstRatePct: z.number().nonnegative().default(5),
  /** shown on the bill; the GSTIN itself lives on identity */
  placeOfSupply: z.string().default(""),
  /** an optional, never-pre-ticked service charge (2022 consumer guidelines) */
  serviceChargePct: z.number().min(0).max(100).default(0),
});
                                                  
