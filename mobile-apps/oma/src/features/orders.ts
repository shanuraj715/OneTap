import type { IconName } from "@/ui/Icon";

/** How an order's status reads and looks, and the steps an order goes through (the same flow as the store dashboard's Orders page). */
export type Tone = "neutral" | "info" | "warn" | "ok" | "danger";

const LABELS: Record<string, string> = {
  placed: "Placed", accepted: "Accepted", preparing: "Preparing", ready: "Ready to serve", out_for_delivery: "Out for delivery", completed: "Served", cancelled: "Cancelled",
};
const TONES: Record<string, Tone> = { placed: "info", accepted: "info", preparing: "warn", ready: "ok", out_for_delivery: "info", completed: "neutral", cancelled: "danger" };

/** The picture that goes with each status (colour is never the only signal). */
const ICONS: Record<string, IconName> = { placed: "clock", accepted: "check", preparing: "pot", ready: "bell", out_for_delivery: "arrow-right", completed: "check-circle", cancelled: "x-circle" };
export const statusIcon = (status: string): IconName => ICONS[status] ?? "info";

export const statusLabel = (status: string): string => LABELS[status] ?? status;
export const statusTone = (status: string): Tone => TONES[status] ?? "neutral";
/** Still being made or waiting to be served. */
export const isOpenStatus = (status: string): boolean => ["placed", "accepted", "preparing", "ready", "out_for_delivery"].includes(status);

export const paymentLabel = (status: string): string => ({ paid: "Paid", pending: "Not paid yet", failed: "Payment failed", refunded: "Refunded" } as Record<string, string>)[status] ?? status;

/* ------------------------------------------------------------------ the order flow (the same one as the dashboard's) */

export const ORDER_STATUSES = ["placed", "accepted", "preparing", "ready", "out_for_delivery", "completed", "cancelled"] as const;
/** Which statuses an order can move to next. Kept in step with `NEXT_STATUSES` in packages/config-schema/src/order.js (a test compares them). */
export const NEXT_STATUSES: Record<string, readonly string[]> = {
  placed: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["out_for_delivery", "completed"],
  out_for_delivery: ["completed"],
  completed: [],
  cancelled: [],
};
/** The statuses an order of this channel can move to next — a takeaway or dine-in order never goes "out for delivery". */
export const nextStatusesFor = (status: string, channel: string): string[] => (NEXT_STATUSES[status] ?? []).filter((s) => channel === "delivery" || s !== "out_for_delivery");
/** The way forward (no "cancel"): what the big button on an order does. */
export const forwardStatusesFor = (status: string, channel: string): string[] => nextStatusesFor(status, channel).filter((s) => s !== "cancelled");
export const canCancelStatus = (status: string): boolean => (NEXT_STATUSES[status] ?? []).includes("cancelled");
/** Every status a person may force by hand for this order's channel (the mis-tap correction). */
export const manualStatusesFor = (channel: string): string[] => ORDER_STATUSES.filter((s) => s !== "out_for_delivery" || channel === "delivery");

export type Channel = "dine-in" | "takeaway" | "delivery";
export const CHANNELS: Channel[] = ["dine-in", "takeaway", "delivery"];
export const CHANNEL_LABEL: Record<string, string> = { "dine-in": "Dine-in", takeaway: "Takeaway", delivery: "Delivery" };
export const CHANNEL_ICON: Record<string, IconName> = { "dine-in": "utensils", takeaway: "bag", delivery: "bike" };
export const channelLabel = (channel: string): string => CHANNEL_LABEL[channel] ?? channel;

/** A status as the people of this order say it (a delivery is "Delivered", a takeaway is "Ready for pickup"). */
export function statusLabelFor(status: string, channel: string): string {
  if (channel === "delivery" && status === "completed") return "Delivered";
  if (channel === "delivery" && status === "ready") return "Ready";
  if (channel === "takeaway" && status === "ready") return "Ready for pickup";
  if (channel === "takeaway" && status === "completed") return "Picked up";
  return statusLabel(status);
}

/** What the button that moves an order into `to` says (a verb: the person is doing it). */
export function actionLabel(to: string, channel: string): string {
  switch (to) {
    case "accepted": return channel === "dine-in" ? "Approve" : "Accept";
    case "preparing": return "Start preparing";
    case "ready": return "Mark ready";
    case "out_for_delivery": return "Send out";
    case "completed": return channel === "delivery" ? "Mark delivered" : channel === "takeaway" ? "Handed over" : "Mark served";
    case "cancelled": return "Cancel order";
    default: return statusLabel(to);
  }
}
export const actionIcon = (to: string): IconName => (to === "cancelled" ? "x-circle" : to === "out_for_delivery" ? "bike" : statusIcon(to));

/** The tone of the button that moves an order into `to`: colour is read before the word in a rush (green for ready, red for cancel). */
export const actionTone = (to: string): "primary" | "ok" | "danger" | "warn" => (to === "cancelled" ? "danger" : to === "ready" || to === "completed" ? "ok" : to === "preparing" ? "warn" : "primary");

/** When the order last changed status (the kitchen clock runs from here, not from when it was placed). */
export function statusSince(order: { createdAt: string; statusHistory: { status: string; at: string; edited?: boolean }[]; status: string }): string {
  const moves = order.statusHistory.filter((h) => !h.edited && h.status === order.status);
  return moves.length ? moves[moves.length - 1]!.at : order.createdAt;
}

/** The delivery address as one line, with its landmark. */
export const addressLine = (a: { text: string | null; landmark: string | null } | null): string => (a ? [a.text, a.landmark ? `(${a.landmark})` : ""].filter(Boolean).join(" ") : "");

/** Money-free summary of what an edit history line says: "Items edited", "Moved by hand — tapped by mistake". */
export function historyNote(step: { edited?: boolean; manual?: boolean; reason: string | null; from: string | null }): string {
  if (step.edited) return step.reason ? step.reason.replace(/^items edited ·.*$/, "Items edited").replace(/^details edited$/, "Details edited") : "Edited";
  if (step.manual) return step.reason ? `Set by hand — ${step.reason}` : "Set by hand";
  return step.reason ?? "";
}

export interface OrderFilter { status: "open" | "all" | string; channel: "all" | string; search: string }
/** Digits only, for matching a phone number typed with spaces or a +91 in front. */
const digitsOf = (t: string) => t.replace(/\D/g, "");
/** The orders that match what is chosen and typed: by status, by channel, and a search over number, customer, phone, table, rider and address. */
export function filterOrders<O extends { orderNumber: string; status: string; channel: string; tableId: string | null; customer?: { name?: string | null; phone?: string | null } | null; rider: { name: string; phone: string | null } | null; deliveryAddress: { text: string | null } | null }>(orders: O[], tableNumber: (id: string) => string | undefined, f: OrderFilter): O[] {
  const q = f.search.trim().toLowerCase().replace(/^#/, "");
  // a number typed with the country code (+91 …) still finds a phone stored without it: compare the last ten digits
  const typedDigits = digitsOf(q);
  const qDigits = typedDigits.length > 10 ? typedDigits.slice(-10) : typedDigits;
  return orders.filter((o) => {
    if (f.status === "open" ? !isOpenStatus(o.status) : f.status !== "all" && o.status !== f.status) return false;
    if (f.channel !== "all" && o.channel !== f.channel) return false;
    if (!q) return true;
    const table = o.tableId ? tableNumber(o.tableId) ?? "" : "";
    const text = [o.orderNumber, o.customer?.name, table && `table ${table}`, o.rider?.name, o.deliveryAddress?.text].filter(Boolean).join(" ").toLowerCase();
    if (text.includes(q)) return true;
    // a number typed in any form finds the customer's / rider's phone (but not on one or two digits: those would match everything)
    return qDigits.length >= 3 && [o.customer?.phone, o.rider?.phone].some((ph) => digitsOf(ph ?? "").includes(qDigits));
  });
}

/** How the customer pays: "cod" is cash (or card/UPI) at the counter or to the rider; anything else was paid online. */
export const paymentMethodLabel = (gateway: string | null | undefined): string => (!gateway || gateway === "cod" ? "Cash, card or UPI on delivery / at the counter" : gateway === "mock" ? "Online (test payment)" : "Online");
