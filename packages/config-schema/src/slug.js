import { z } from "zod";

/**
 * A URL-safe identifier for a brand or an outlet — lowercase, hyphen-
 * separated, no leading/trailing/double hyphens. Used both as a Mongo
 * uniqueness key and directly as a storefront URL segment
 * (food.example.com/<outletSlug>), so it has to be exactly what a browser
 * can round-trip without encoding.
 */
export const slugSchema = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers and single hyphens only");

/**
 * An outlet's slug becomes a top-level storefront URL segment
 * (`/[outletSlug]`), sitting next to the app's own static routes — it can
 * never collide with one of those, or that route becomes unreachable for
 * every outlet on the domain.
 */
export const RESERVED_OUTLET_SLUGS = ["t", "preview", "variants"];

export function isReservedOutletSlug(slug) {
  return RESERVED_OUTLET_SLUGS.includes(slug.toLowerCase());
}
