import type { Delivery, DeliveryStatus } from "@/api/schemas";
import type { IconName } from "@/ui/Icon";
import type { Tone } from "./tone";

/* What a delivery is waiting for, what the rider does next, and how the list is ordered. Plain functions: the screens only draw what these say. */

export const STATUS_TEXT: Record<DeliveryStatus, string> = {
  placed: "Waiting for the store",
  accepted: "Being prepared",
  preparing: "Being prepared",
  ready: "Ready to pick up",
  out_for_delivery: "On the way",
  completed: "Delivered",
  cancelled: "Cancelled",
};
export const STATUS_TONE: Record<DeliveryStatus, Tone> = { placed: "neutral", accepted: "neutral", preparing: "neutral", ready: "warn", out_for_delivery: "info", completed: "ok", cancelled: "danger" };

export type Step = "wait" | "pickup" | "deliver" | "done";
/** Where the rider is with a delivery: waiting for the kitchen, ready to pick up, on the way, or finished. */
export const stepOf = (d: Pick<Delivery, "status">): Step => (d.status === "ready" ? "pickup" : d.status === "out_for_delivery" ? "deliver" : d.status === "completed" ? "done" : "wait");

export interface RiderAction { label: string; icon: IconName }
/** The one big button: "Picked up" once the food is ready, "Delivered" once it is on the way; nothing to press while the kitchen is still cooking. */
export const actionFor = (d: Pick<Delivery, "status">): RiderAction | null => {
  const step = stepOf(d);
  return step === "pickup" ? { label: "Picked up", icon: "bag" } : step === "deliver" ? { label: "Delivered", icon: "check-circle" } : null;
};

/** On the way first (they are on the road), then ready to pick up, then the ones still being made; each group oldest first. */
export function sortDeliveries(list: Delivery[]): Delivery[] {
  const rank = (d: Delivery) => ({ deliver: 0, pickup: 1, wait: 2, done: 3 }[stepOf(d)]);
  const at = (d: Delivery) => new Date(d.assignedAt ?? d.placedAt).getTime();
  return [...list].sort((a, b) => rank(a) - rank(b) || at(a) - at(b));
}

/** The deliveries that are in the list now but were not the last time we looked (a first look finds none: nothing is "new" just because the app opened). */
export const arrivals = (seen: ReadonlySet<string> | null, list: Delivery[]): Delivery[] => (seen === null ? [] : list.filter((d) => !seen.has(d.id)));

/** Whole minutes since an ISO time (never negative). */
export const minutesSince = (iso: string | null | undefined, now: number): number => {
  if (!iso) return 0;
  const ms = now - new Date(iso).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 60_000)) : 0;
};
export const minutesText = (m: number): string => (m < 1 ? "just now" : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`);

/** "2 × Veg Momos (Full) · 1 × Chai": what is in the bag, short. */
export const bagText = (d: Pick<Delivery, "items">): string =>
  d.items.map((i) => `${i.quantity} × ${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ""}`).join(" · ");
export const itemCount = (d: Pick<Delivery, "items">): number => d.items.reduce((n, i) => n + i.quantity, 0);

/** "2.4 km" / "800 m" / "" when the distance is not known. */
export const distanceText = (km: number | null | undefined): string => (km === null || km === undefined ? "" : km < 1 ? `${Math.round(km * 1000)} m` : `${Math.round(km * 10) / 10} km`);

/** Is this what the customer's code could be? (4 digits.) Checked before asking the server, so a typo never uses up one of the few tries. */
export const isCodeShape = (text: string): boolean => /^\d{4}$/.test(text.trim());

/** Money was taken online ("Paid"), or has not been ("Not paid yet"): the rider never collects cash on a delivery. */
export const paymentText = (d: Pick<Delivery, "payment">): { label: string; tone: Tone } => (d.payment.status === "paid" ? { label: "Paid online", tone: "ok" } : { label: "Not paid yet", tone: "warn" });
