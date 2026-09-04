import { z } from "zod";
import type { OrderStatus } from "./order";

/**
 * How long an order may sit in one status before the admin starts shouting.
 *
 * A missed order is the single most expensive failure in a small restaurant:
 * the customer is waiting, nobody knows, and the first sign of trouble is a
 * complaint. These thresholds turn "nobody noticed" into a visible warning.
 */
export const slaSchema = z.object({
  enabled: z.boolean().default(true),
  /** minutes a new order may stay "placed" before it counts as unaccepted */
  acceptMinutes: z.number().int().min(1).max(240).default(2),
  /** minutes an order may stay "accepted" before someone should have started it */
  startMinutes: z.number().int().min(1).max(240).default(5),
  /** minutes an order may stay "preparing" before the kitchen is running late */
  prepMinutes: z.number().int().min(1).max(240).default(20),
  /** minutes food may sit "ready" before it goes cold on the pass */
  handoverMinutes: z.number().int().min(1).max(240).default(10),
  /** play a sound as well as showing the banner */
  sound: z.boolean().default(true),
  /** keep re-alerting rather than warning once and going quiet */
  repeatAlert: z.boolean().default(true),
});
export type SlaSettings = z.infer<typeof slaSchema>;

/** Which SLA applies to an order sitting in a given status. */
export const SLA_FOR_STATUS: Partial<Record<OrderStatus, keyof SlaSettings>> = {
  placed: "acceptMinutes",
  accepted: "startMinutes",
  preparing: "prepMinutes",
  ready: "handoverMinutes",
};

export const SLA_LABELS: Record<string, string> = {
  acceptMinutes: "not accepted",
  startMinutes: "not started",
  prepMinutes: "still preparing",
  handoverMinutes: "waiting on the pass",
};

/** What the staff-facing warning says, in words that name the action. */
export const SLA_MESSAGES: Record<string, string> = {
  acceptMinutes: "hasn't been accepted",
  startMinutes: "was accepted but nobody has started cooking",
  prepMinutes: "has been cooking longer than expected",
  handoverMinutes: "is ready and still waiting to go out",
};

/* -------------------------------------------------------------- operations */

export const orderOpsSchema = z.object({
  /** show a running clock on every open order row */
  showTimers: z.boolean().default(true),
  /** how often the list refreshes when the live connection is unavailable */
  pollSeconds: z.number().int().min(3).max(120).default(10),
  /** newest-first is right for a kitchen; oldest-first for a queue you work through */
  oldestFirst: z.boolean().default(false),
  /** staff must confirm before cancelling an order */
  confirmCancel: z.boolean().default(true),
  /** allow staff to move an order backwards, e.g. after a mis-tap */
  allowStatusRewind: z.boolean().default(true),
  /** allow editing an order's items after it has been placed */
  allowOrderEdit: z.boolean().default(true),
  /** an edit after this status needs a manager */
  editLockAfter: z.enum(["never", "preparing", "ready", "completed"]).default("ready"),
  /** auto-accept incoming orders instead of waiting for staff */
  autoAccept: z.boolean().default(false),
});
export type OrderOps = z.infer<typeof orderOpsSchema>;

export const serviceHoursSchema = z.object({
  enabled: z.boolean().default(false),
  opensAt: z.string().default("11:00"),
  closesAt: z.string().default("23:00"),
  /** stop taking online orders this many minutes before closing */
  lastOrderBufferMinutes: z.number().int().min(0).max(180).default(30),
  /** shown to customers when the shop is shut */
  closedMessage: z.string().max(200).default("We're closed right now. Please check back during opening hours."),
});
export type ServiceHours = z.infer<typeof serviceHoursSchema>;

export const prepTimeSchema = z.object({
  /** the "your food will be ready in ~N minutes" a customer sees */
  defaultMinutes: z.number().int().min(1).max(180).default(15),
  /** added on top when the kitchen is slammed */
  busyExtraMinutes: z.number().int().min(0).max(120).default(10),
  /** staff can flip this from the dashboard during a rush */
  busyMode: z.boolean().default(false),
});
export type PrepTime = z.infer<typeof prepTimeSchema>;

export const orderLimitsSchema = z.object({
  minOrderValue: z.number().int().min(0).max(1_000_000).default(0),
  maxItemsPerOrder: z.number().int().min(1).max(200).default(50),
  /** delivery only */
  freeDeliveryAbove: z.number().int().min(0).max(1_000_000).default(0),
  deliveryFee: z.number().int().min(0).max(1_000_000).default(0),
  deliveryRadiusKm: z.number().min(0).max(50).default(5),
  /** minutes added to the ETA per km between shop and address */
  deliveryMinutesPerKm: z.number().min(0).max(30).default(4),
  /** the ETA never drops below this, however close the address */
  deliveryMinEtaMinutes: z.number().int().min(1).max(180).default(20),
});
export type OrderLimits = z.infer<typeof orderLimitsSchema>;

export const receiptPolicySchema = z.object({
  /** print a customer receipt without anyone asking */
  autoPrintReceipt: z.boolean().default(true),
  /** offer to text or email the receipt instead of printing it */
  offerDigitalReceipt: z.boolean().default(false),
  /** show a tip line on the bill */
  showTipLine: z.boolean().default(false),
  /** percentage service charge, 0 to switch it off */
  serviceChargePct: z.number().min(0).max(25).default(0),
});
export type ReceiptPolicy = z.infer<typeof receiptPolicySchema>;

export const operationsSchema = z.object({
  sla: slaSchema.default({}),
  orders: orderOpsSchema.default({}),
  hours: serviceHoursSchema.default({}),
  prepTime: prepTimeSchema.default({}),
  limits: orderLimitsSchema.default({}),
  receipts: receiptPolicySchema.default({}),
});
export type Operations = z.infer<typeof operationsSchema>;

/* ------------------------------------------------------------ SLA evaluation */

export interface SlaBreach {
  orderId: string;
  orderNumber: string;
  status: OrderStatus;
  /** which threshold was crossed */
  rule: string;
  /** minutes the order has actually been sitting */
  waitedMinutes: number;
  /** the configured limit it passed */
  limitMinutes: number;
  message: string;
}

/**
 * How long this order has been in its current status, and whether that is
 * longer than the outlet allows.
 *
 * Uses the last status change rather than when the order was created, so an
 * order that moved through three states quickly isn't flagged for the time it
 * spent in the earlier ones.
 */
export function evaluateSla(
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    createdAt: string | Date;
    statusHistory?: { status: string; at: string | Date }[];
  },
  sla: SlaSettings,
  now: number = Date.now(),
): SlaBreach | null {
  if (!sla.enabled) return null;

  const rule = SLA_FOR_STATUS[order.status];
  if (!rule) return null; // completed and cancelled orders have no clock

  const limitMinutes = sla[rule] as number;
  const since = statusSince(order, now);
  const waitedMinutes = Math.floor(since / 60_000);
  if (waitedMinutes < limitMinutes) return null;

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    rule,
    waitedMinutes,
    limitMinutes,
    message: SLA_MESSAGES[rule] ?? "needs attention",
  };
}

/** Milliseconds the order has been sitting in its current status. */
export function statusSince(
  order: { status: OrderStatus; createdAt: string | Date; statusHistory?: { status: string; at: string | Date }[] },
  now: number = Date.now(),
): number {
  const entry = [...(order.statusHistory ?? [])].reverse().find((h) => h.status === order.status);
  const at = entry ? new Date(entry.at) : new Date(order.createdAt);
  return Math.max(0, now - at.getTime());
}

/** "4m", "1h 12m" — compact enough for a table cell. */
export function formatElapsed(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
