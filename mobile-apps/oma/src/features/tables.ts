import type { Session, Table } from "@/api/schemas";
import { formatMoney } from "@/lib/money";
import { elapsed } from "@/lib/time";
import type { IconName } from "@/ui/Icon";
import type { Tone } from "./orders";

export type TableStatus = Table["status"];
export const STATUS_LABEL: Record<TableStatus, string> = { free: "Free", seated: "Seated", "bill-requested": "Bill asked", reserved: "Reserved" };

/** "T2" before "T10", "2" before "10", "A1" before "B1". */
export const naturalCompare = (a: string, b: string): number => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

/** By zone, then by table number (tables with no zone first). */
export function sortTables(tables: Table[]): Table[] {
  return [...tables].sort((a, b) => naturalCompare(a.zone, b.zone) || naturalCompare(a.number, b.number));
}

export function zonesOf(tables: Table[]): string[] {
  return [...new Set(tables.filter((t) => t.isActive).map((t) => t.zone).filter(Boolean))].sort(naturalCompare);
}

export interface TableFilter { zone?: string | null; status?: TableStatus | null; query?: string }

export function filterTables(tables: Table[], filter: TableFilter = {}): Table[] {
  const q = (filter.query ?? "").trim().toLowerCase();
  return sortTables(
    tables.filter((t) => t.isActive && (!filter.zone || t.zone === filter.zone) && (!filter.status || t.status === filter.status) && (!q || t.number.toLowerCase().includes(q))),
  );
}

export function countByStatus(tables: Table[]): Record<TableStatus | "all", number> {
  const active = tables.filter((t) => t.isActive);
  const counts: Record<TableStatus | "all", number> = { all: active.length, free: 0, seated: 0, "bill-requested": 0, reserved: 0 };
  for (const t of active) counts[t.status] += 1;
  return counts;
}

export const sessionForTable = (sessions: Session[], tableId: string): Session | undefined => sessions.find((s) => s.tableId === tableId);

/** Tables a party can be moved to: free, in use, and not the one they are on. */
export const moveTargets = (tables: Table[], fromTableId: string): Table[] => sortTables(tables.filter((t) => t.isActive && t.status === "free" && t.id !== fromTableId));

/**
 * What a seated table is waiting for, in one phrase for the card: everything paid → "Paid — ready to close", else the amount still due.
 * (A table with no open orders and nothing owed shows nothing extra.)
 */
export type SessionState = "due" | "paid" | "empty";
export function sessionState(session: Session | undefined): SessionState {
  if (!session) return "empty";
  if (session.orderCount === 0) return "empty";
  return session.allPaid ? "paid" : "due";
}

/** The name shown for tables that have no area. */
export const NO_ZONE_LABEL = "Other tables";

export interface ZoneGroup { zone: string; label: string; tables: Table[] }

/**
 * Tables under their area ("Ground floor", "Terrace"): areas A–Z (numbers in order), tables with no area last, and inside an area the
 * tables in number order ("T2" before "T10"). Areas with no table in `tables` are not listed.
 */
export function groupTablesByZone(tables: Table[]): ZoneGroup[] {
  const by = new Map<string, Table[]>();
  for (const t of tables) by.set(t.zone, [...(by.get(t.zone) ?? []), t]);
  return [...by.entries()]
    .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : naturalCompare(a, b)))
    .map(([zone, list]) => ({ zone, label: zone || NO_ZONE_LABEL, tables: [...list].sort((x, y) => naturalCompare(x.number, y.number)) }));
}

/** How an area stands, in numbers — shown on its heading, so a CLOSED area still tells the waiter what is going on in it. */
export interface ZoneSummary { total: number; free: number; seated: number; billAsked: number; reserved: number }
export function summarizeZone(tables: Table[]): ZoneSummary {
  const n = (status: TableStatus) => tables.filter((t) => t.status === status).length;
  return { total: tables.length, free: n("free"), seated: n("seated"), billAsked: n("bill-requested"), reserved: n("reserved") };
}

/**
 * What the board draws: a heading per area (it opens and closes; they start closed) and, under an open one, its tables in rows of
 * `columns`. `open`: the areas that are open, by label ("all" = every one).
 */
export type TableRow = { kind: "header"; id: string; label: string; count: number; expanded: boolean; summary: ZoneSummary } | { kind: "tables"; id: string; tables: Table[] };
export function buildTableRows(groups: ZoneGroup[], columns: number, open: ReadonlySet<string> | "all" = "all"): TableRow[] {
  const per = Math.max(1, Math.floor(columns));
  const rows: TableRow[] = [];
  for (const g of groups) {
    const expanded = open === "all" || open.has(g.label);
    rows.push({ kind: "header", id: `z-${g.zone || "none"}`, label: g.label, count: g.tables.length, expanded, summary: summarizeZone(g.tables) });
    if (!expanded) continue;
    for (let i = 0; i < g.tables.length; i += per) rows.push({ kind: "tables", id: `t-${g.zone || "none"}-${i}`, tables: g.tables.slice(i, i + per) });
  }
  return rows;
}

/** The picture that goes with each table state. */
export const STATUS_ICON: Record<TableStatus, IconName> = { free: "check-circle", seated: "chair", "bill-requested": "receipt", reserved: "calendar" };

export const STATUS_TONE: Record<TableStatus, Tone> = { free: "ok", seated: "info", "bill-requested": "warn", reserved: "neutral" };

export interface TableSummary {
  /** who is sitting here ("Mehta family"), or null for a free table */
  who: string | null;
  /** how long they have been seated ("2 h 10 min") */
  since: string;
  /** what is still owed, or that all is paid; null while nothing is ordered yet */
  money: string | null;
  moneyTone: Tone;
  /** the whole card in one sentence, for a screen reader */
  spoken: string;
}

/** What a table card says, worked out in one place so the card, the detail page and the screen-reader sentence always agree. */
export function summarizeTable(table: Table, session: Session | undefined, now: number = Date.now()): TableSummary {
  const who = session ? session.customerName || session.customerPhone || "Guest" : null;
  const since = session ? elapsed(session.openedAt, now) : "";
  const state = sessionState(session);
  const money = !session || state === "empty" ? null : state === "paid" ? "Paid" : `${formatMoney(session.unpaidTotal)} to pay`;
  const moneyTone: Tone = state === "paid" ? "ok" : state === "due" ? "warn" : "neutral";
  const parts = [`Table ${table.number}`, table.zone, `${table.seats} ${table.seats === 1 ? "seat" : "seats"}`, STATUS_LABEL[table.status], who, since, money].filter(Boolean);
  return { who, since, money, moneyTone, spoken: parts.join(", ") };
}
