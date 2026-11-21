import { z } from "zod";
import { SCHEDULED_ACCEPT_LEAD_MINUTES, scheduledOrdersSchema } from "./scheduling.js";

/**
 * When the Orders screen starts shouting about an order. Only two moments count, because only these two are the
 * restaurant's own to fix:
 *   - a NEW order nobody has accepted (the customer is waiting and nobody knows);
 *   - an order that has been PREPARING longer than the kitchen's own limit (a fresh timer starts when cooking starts).
 * An accepted order that is not yet being cooked, a ready order and a completed one never warn.
 */
export const slaSchema = z.object({
  enabled: z.boolean().default(true),
  /** minutes a new order may stay "placed" (nobody has accepted it) before it counts as missed */
  acceptMinutes: z.number().int().min(1).max(240).default(2),
  /** minutes an order may stay "preparing" before the kitchen is running late */
  prepMinutes: z.number().int().min(1).max(240).default(20),
  /** play a sound as well as showing the banner */
  sound: z.boolean().default(true),
  /** keep re-alerting rather than warning once and going quiet */
  repeatAlert: z.boolean().default(true),
  /**
   * Escalation: an order nobody has accepted after this many minutes is cancelled by itself (and the customer is told, when
   * order alerts are on). 0 = never — the default; an order is then only flagged on the counter's screen. Only orders that
   * are NOT already paid online are cancelled this way: money taken is for a person to deal with.
   */
  autoCancelMinutes: z.number().int().min(0).max(240).default(0),
});
                                                    

/** Which limit applies to an order sitting in a given status. A status that is not listed never warns. */
export const SLA_FOR_STATUS                                                  = {
  placed: "acceptMinutes",
  preparing: "prepMinutes",
};

export const SLA_LABELS                         = {
  acceptMinutes: "not accepted",
  prepMinutes: "still preparing",
};

/** What the staff-facing warning says, in words that name the action. */
export const SLA_MESSAGES                         = {
  acceptMinutes: "hasn't been accepted",
  prepMinutes: "has been cooking longer than expected",
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
                                                      

export const serviceHoursSchema = z.object({
  enabled: z.boolean().default(false),
  opensAt: z.string().default("11:00"),
  closesAt: z.string().default("23:00"),
  /** stop taking online orders this many minutes before closing */
  lastOrderBufferMinutes: z.number().int().min(0).max(180).default(30),
  /** shown to customers when the shop is shut */
  closedMessage: z.string().max(200).default("We're closed right now. Please check back during opening hours."),
});
                                                              

export const prepTimeSchema = z.object({
  /** the "your food will be ready in ~N minutes" a customer sees */
  defaultMinutes: z.number().int().min(1).max(180).default(15),
  /** added on top when the kitchen is slammed */
  busyExtraMinutes: z.number().int().min(0).max(120).default(10),
  /** staff can flip this from the dashboard during a rush */
  busyMode: z.boolean().default(false),
});
                                                      

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
                                                                

export const operationsSchema = z.object({
  sla: slaSchema.default({}),
  orders: orderOpsSchema.default({}),
  hours: serviceHoursSchema.default({}),
  prepTime: prepTimeSchema.default({}),
  limits: orderLimitsSchema.default({}),
  receipts: receiptPolicySchema.default({}),
  /** takeaway pre-orders (a later pickup time) — see scheduling.js */
  scheduling: scheduledOrdersSchema.default({}),
});
                                                          

/* ------------------------------------------------------------ SLA evaluation */

                            
                  
                      
                      
                                    
               
                                                    
                        
                                       
                       
                  
 

/**
 * How long this order has been in its current status, and whether that is
 * longer than the outlet allows.
 *
 * Uses the last status change rather than when the order was created, so an
 * order that moved through three states quickly isn't flagged for the time it
 * spent in the earlier ones.
 */
export function evaluateSla(
  order   
               
                        
                        
                             
                                                            
   ,
  sla             ,
  now         = Date.now(),
)                   {
  if (!sla.enabled) return null;

  const rule = SLA_FOR_STATUS[order.status];
  if (!rule) return null; // completed and cancelled orders have no clock

  const limitMinutes = sla[rule]          ;
  let since = statusSince(order, now);
  // A pre-order for later isn't late just because nobody accepted it straight away: its accept clock starts an hour
  // before its pickup time (or when it was placed, if that was later).
  if (order.status === "placed" && order.scheduledFor) {
    const clockFrom = new Date(order.scheduledFor).getTime() - SCHEDULED_ACCEPT_LEAD_MINUTES * 60_000;
    since = Math.min(since, now - clockFrom);
    if (since < 0) return null;
  }
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
  order                                                                                                            ,
  now         = Date.now(),
)         {
  const entry = [...(order.statusHistory ?? [])].reverse().find((h) => h.status === order.status);
  const at = entry ? new Date(entry.at) : new Date(order.createdAt);
  return Math.max(0, now - at.getTime());
}

/** "4m", "1h 12m" — compact enough for a table cell. */
export function formatElapsed(ms        )         {
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}
