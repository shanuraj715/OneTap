import type { IconName } from "@/ui/Icon";

/** How an order's status reads and looks. (The kitchen moves orders along; the waiter only watches.) */
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
