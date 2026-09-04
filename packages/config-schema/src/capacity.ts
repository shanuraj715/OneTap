import { z } from "zod";

/**
 * Load management. A busy kitchen (or a short-handed delivery fleet) needs a
 * way to tell customers "we're slower than usual" or "we've stopped taking
 * more" WITHOUT anyone touching the menu or the ordering feature flags by
 * hand mid-rush — this is computed live from how many orders are actually in
 * the queue right now, against thresholds the outlet sets once.
 *
 * Two independent triggers:
 *  - overall queue size (every open/accepted/preparing order) → a "busy" or
 *    "stopped" banner, and stopped also switches delivery off
 *  - delivery queue size alone (a proxy for "not enough riders right now") →
 *    its own warn/stop pair, also capable of switching delivery off
 *
 * Either trigger disabling delivery is a live, computed fact — nothing here
 * writes to `features.ordering.delivery`, which stays the outlet's own
 * long-term switch. See {@link evaluateCapacity}.
 */
export const capacitySettingsSchema = z.object({
  enabled: z.boolean().default(false),

  /** active orders at/above this show the "High Orders" message */
  highOrdersThreshold: z.number().int().min(1).max(999).default(15),
  highOrdersMessage: z
    .string()
    .max(240)
    .default("We're experiencing high order volume right now — your order may take a little longer than usual."),

  /** active orders at/above this show "Not Accepting Orders" AND switch delivery off */
  stopOrdersThreshold: z.number().int().min(1).max(999).default(25),
  stopOrdersMessage: z
    .string()
    .max(240)
    .default("We're not accepting new orders right now — please check back shortly."),

  /** active delivery orders at/above this warns about limited riders */
  deliveryWarnThreshold: z.number().int().min(1).max(999).default(8),
  deliveryWarnMessage: z
    .string()
    .max(240)
    .default("Limited delivery riders are available right now — your delivery may take longer than usual."),

  /** active delivery orders at/above this switches delivery off */
  deliveryStopThreshold: z.number().int().min(1).max(999).default(12),
  deliveryStopMessage: z
    .string()
    .max(240)
    .default("We're not able to take delivery orders right now — too few riders for the orders already out."),
});
export type CapacitySettings = z.infer<typeof capacitySettingsSchema>;

export const CAPACITY_ORDER_LEVELS = ["normal", "high", "stopped"] as const;
export type CapacityOrderLevel = (typeof CAPACITY_ORDER_LEVELS)[number];

export const CAPACITY_DELIVERY_LEVELS = ["normal", "warn", "stopped"] as const;
export type CapacityDeliveryLevel = (typeof CAPACITY_DELIVERY_LEVELS)[number];

export interface CapacityCounts {
  /** orders currently placed, accepted, or preparing — across every channel */
  active: number;
  /** the same, but delivery orders only */
  activeDelivery: number;
}

export interface CapacityStatus extends CapacityCounts {
  enabled: boolean;
  orderLevel: CapacityOrderLevel;
  orderMessage: string | null;
  deliveryLevel: CapacityDeliveryLevel;
  deliveryMessage: string | null;
  /** true when either trigger currently forces delivery off */
  deliveryBlocked: boolean;
}

/**
 * Pure — the live counts come from the database, the thresholds from
 * settings, and this just does the comparison. Used identically by the order
 * side (`GET /api/orders/capacity`, and the block inside `placeOrder`) and
 * would be used the same way by a future admin dashboard widget.
 */
export function evaluateCapacity(counts: CapacityCounts, s: CapacitySettings): CapacityStatus {
  if (!s.enabled) {
    return { ...counts, enabled: false, orderLevel: "normal", orderMessage: null, deliveryLevel: "normal", deliveryMessage: null, deliveryBlocked: false };
  }

  let orderLevel: CapacityOrderLevel = "normal";
  let orderMessage: string | null = null;
  if (counts.active >= s.stopOrdersThreshold) {
    orderLevel = "stopped";
    orderMessage = s.stopOrdersMessage;
  } else if (counts.active >= s.highOrdersThreshold) {
    orderLevel = "high";
    orderMessage = s.highOrdersMessage;
  }

  let deliveryLevel: CapacityDeliveryLevel = "normal";
  let deliveryMessage: string | null = null;
  if (counts.activeDelivery >= s.deliveryStopThreshold) {
    deliveryLevel = "stopped";
    deliveryMessage = s.deliveryStopMessage;
  } else if (counts.activeDelivery >= s.deliveryWarnThreshold) {
    deliveryLevel = "warn";
    deliveryMessage = s.deliveryWarnMessage;
  }

  return {
    ...counts,
    enabled: true,
    orderLevel,
    orderMessage,
    deliveryLevel,
    deliveryMessage,
    deliveryBlocked: orderLevel === "stopped" || deliveryLevel === "stopped",
  };
}
