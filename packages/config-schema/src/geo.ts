import { z } from "zod";

/** A point on the earth. Longitude first would match GeoJSON, but lat/lng
 *  reads the way people say it and matches every mapping SDK's `{lat, lng}`. */
export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type GeoPoint = z.infer<typeof geoPointSchema>;

/** Where the shop is, plus the address text a human typed or a map returned. */
export const shopLocationSchema = z.object({
  /** null until the owner drops the pin — delivery can't be offered without it */
  point: geoPointSchema.nullable().default(null),
  /** the formatted address string, for the receipt and the "we're here" line */
  formattedAddress: z.string().max(300).default(""),
});
export type ShopLocation = z.infer<typeof shopLocationSchema>;

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Great-circle distance between two points, in kilometres.
 *
 * This is straight-line distance, not driving distance — a road route is
 * typically 20–40% longer. The delivery radius check uses it because it needs
 * no API key, no cost and no network call; an outlet that wants true routing
 * distance can set a tighter radius to compensate.
 */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export interface DeliveryCheck {
  serviceable: boolean;
  /** straight-line km from the shop, rounded to one decimal */
  distanceKm: number;
  /** the configured limit it was checked against */
  radiusKm: number;
  /** delivery charge in paise for this address, after the free-above threshold */
  fee: number;
  /** minutes from order to doorstep — prep + a per-km travel estimate */
  etaMinutes: number;
  reason?: string;
}

export interface DeliveryRules {
  radiusKm: number;
  fee: number;
  freeDeliveryAbove: number;
  /** base minutes before travel time is added */
  prepMinutes: number;
  /** minutes of travel time added per km of distance */
  minutesPerKm: number;
  /** floor for the ETA regardless of a very short distance */
  minEtaMinutes: number;
}

/**
 * Decide whether an address can be delivered to, and on what terms.
 *
 * `orderSubtotal` is optional: without it the fee is quoted at full price (the
 * "will you deliver here at all" check before a cart exists); with it the
 * free-delivery threshold is applied.
 */
export function checkDelivery(
  shop: GeoPoint | null,
  address: GeoPoint,
  rules: DeliveryRules,
  orderSubtotal?: number,
): DeliveryCheck {
  if (!shop) {
    return {
      serviceable: false,
      distanceKm: 0,
      radiusKm: rules.radiusKm,
      fee: rules.fee,
      etaMinutes: rules.prepMinutes,
      reason: "This outlet hasn't set its location yet, so delivery distance can't be checked.",
    };
  }

  const raw = haversineKm(shop, address);
  const distanceKm = Math.round(raw * 10) / 10;

  const etaMinutes = Math.max(
    rules.minEtaMinutes,
    Math.round(rules.prepMinutes + raw * rules.minutesPerKm),
  );

  if (raw > rules.radiusKm) {
    return {
      serviceable: false,
      distanceKm,
      radiusKm: rules.radiusKm,
      fee: rules.fee,
      etaMinutes,
      reason: `That address is about ${distanceKm} km away — outside the ${rules.radiusKm} km delivery area.`,
    };
  }

  const free =
    rules.freeDeliveryAbove > 0 &&
    orderSubtotal !== undefined &&
    orderSubtotal >= rules.freeDeliveryAbove;

  return {
    serviceable: true,
    distanceKm,
    radiusKm: rules.radiusKm,
    fee: free ? 0 : rules.fee,
    etaMinutes,
  };
}
