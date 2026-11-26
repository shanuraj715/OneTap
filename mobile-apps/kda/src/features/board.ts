import type { KitchenOrder, Stage } from "@/api/schemas";
import type { IconName } from "@/ui/Icon";
import type { Tone } from "./tone";

/* How long an order has waited, how worried to be about it, what to do with it next. Plain functions: the screens only draw what these say. */

export const STAGES: Stage[] = ["new", "preparing", "ready"];
export const STAGE_LABEL: Record<Stage, string> = { new: "New", preparing: "Preparing", ready: "Ready" };
export const STAGE_ICON: Record<Stage, IconName> = { new: "bell", preparing: "flame", ready: "check-circle" };

export type Urgency = "ok" | "warn" | "late";
export interface Limits { warnAfterMinutes: number; lateAfterMinutes: number }

/** Whole minutes since the order was accepted (never negative: a phone clock a little behind the server's is not "−1 min"). */
export const minutesWaiting = (order: Pick<KitchenOrder, "acceptedAt">, now: number): number => {
  const ms = now - new Date(order.acceptedAt).getTime();
  return Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 60_000)) : 0;
};

/** Amber after the store's "warn" minutes, red after its "late" minutes (Settings → Kitchen display in the dashboard). */
export const urgencyOf = (minutes: number, limits: Limits): Urgency => (minutes >= limits.lateAfterMinutes ? "late" : minutes >= limits.warnAfterMinutes ? "warn" : "ok");
export const URGENCY_TONE: Record<Urgency, Tone> = { ok: "neutral", warn: "warn", late: "danger" };

/** "just now", "12 min", "1 h 05 min". */
export const waitText = (minutes: number): string => {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
};

/** Where the food goes: "Table T2", "Takeaway", "Delivery". */
export const channelText = (o: Pick<KitchenOrder, "channel" | "tableNumber">): string =>
  o.channel === "dine-in" ? (o.tableNumber ? `Table ${o.tableNumber}` : "Dine-in") : o.channel === "takeaway" ? "Takeaway" : "Delivery";
export const channelIcon = (o: Pick<KitchenOrder, "channel">): IconName => (o.channel === "dine-in" ? "table" : o.channel === "takeaway" ? "bag" : "pin");

export interface TicketAction { label: string; to: "preparing" | "ready"; icon: IconName; /** a recall asks first: a mis-tap would put a finished order back */ confirm: boolean }
/** The one button on a ticket: Start a new order, mark a preparing one Ready, Recall a ready one. */
export const actionFor = (stage: Stage): TicketAction =>
  stage === "new" ? { label: "Start", to: "preparing", icon: "flame", confirm: false }
  : stage === "preparing" ? { label: "Mark ready", to: "ready", icon: "check-circle", confirm: false }
  : { label: "Recall", to: "preparing", icon: "history", confirm: true };

/** The orders in each lane. Waiting lanes: the one waiting longest first (first come, first served). Ready: the newest first, so a fresh one is on top. */
export function lanes(orders: KitchenOrder[]): Record<Stage, KitchenOrder[]> {
  const out: Record<Stage, KitchenOrder[]> = { new: [], preparing: [], ready: [] };
  for (const o of orders) out[o.stage].push(o);
  const byAccepted = (a: KitchenOrder, b: KitchenOrder) => new Date(a.acceptedAt).getTime() - new Date(b.acceptedAt).getTime();
  out.new.sort(byAccepted);
  out.preparing.sort(byAccepted);
  out.ready.sort((a, b) => byAccepted(b, a));
  return out;
}

/** The orders that are on the board now but were not the last time we looked (a first look finds none: nothing is "new" just because the app opened). */
export const arrivals = (seen: ReadonlySet<string> | null, orders: KitchenOrder[]): KitchenOrder[] => (seen === null ? [] : orders.filter((o) => o.stage === "new" && !seen.has(o.id)));

/** "Table T2 · 3 items": the line a notification reads. */
export const itemCount = (o: Pick<KitchenOrder, "lines">): number => o.lines.reduce((n, l) => n + l.quantity, 0);

/** Where each station is, when more than one has work on the order: "Kitchen: preparing · Bar: new". Empty for an order only one station makes. */
export const stationsText = (o: Pick<KitchenOrder, "stations">): string =>
  o.stations.length > 1 ? o.stations.map((s) => `${s.station === "bar" ? "Bar" : "Kitchen"}: ${STAGE_LABEL[s.stage].toLowerCase()}`).join(" · ") : "";

export interface PrepRow { key: string; name: string; detail: string; quantity: number; orders: number }
/**
 * What there is to cook right now, added up over every order that is not ready yet: "6 × Veg Momos (Full)". The same dish with the same
 * size and add-ons is one row, so a cook can make a batch instead of ticket by ticket. Biggest first.
 */
export function prepList(orders: KitchenOrder[]): PrepRow[] {
  const rows = new Map<string, PrepRow>();
  for (const o of orders) {
    if (o.stage === "ready") continue;
    for (const l of o.lines) {
      const detail = [l.variantLabel, ...l.modifiers].filter(Boolean).join(" · ");
      const key = `${l.name}|${detail}`;
      const row = rows.get(key) ?? { key, name: l.name, detail, quantity: 0, orders: 0 };
      row.quantity += l.quantity;
      row.orders += 1;
      rows.set(key, row);
    }
  }
  return [...rows.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
}
