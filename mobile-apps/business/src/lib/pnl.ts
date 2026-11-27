import { addDays, daysBetween, type Range } from "./dates";

/**
 * The profit calculation: net sales − food cost − expenses = profit. A port of computeProfitLoss / computeProfitLossRecorded in
 * packages/config-schema/src/analytics.js (a test runs both on the same numbers), so the app and the web dashboard can never disagree.
 * Money in RUPEES here (netSalesPaise is the one paise number, converted once at the top).
 */
export interface PnlLine { label: string; monthly: number; cost: number }
export interface Pnl {
  sales: number; foodCost: number; grossProfit: number; lines: PnlLine[]; totalExpenses: number; net: number;
  marginPct: number | null; days: number; months: number; breakEvenSales: number | null; breakEvenPerDay: number | null;
}

/** How many "months" of a monthly bill a range costs: each day pays its month's share (a calendar month is exactly 1). */
export function monthsInRange({ from, to }: Range): number {
  let total = 0;
  for (let k = from; k <= to; k = addDays(k, 1)) {
    const [y, m] = k.split("-").map(Number) as [number, number];
    total += 1 / new Date(Date.UTC(y, m, 0)).getUTCDate();
  }
  return total;
}

const shape = (sales: number, foodCostPct: number, lines: PnlLine[], range: Range, months: number): Pnl => {
  const pct = Math.max(0, Math.min(100, Number(foodCostPct) || 0));
  const foodCost = (sales * pct) / 100;
  const grossProfit = sales - foodCost;
  const totalExpenses = lines.reduce((s, l) => s + l.cost, 0);
  const net = grossProfit - totalExpenses;
  const days = daysBetween(range.from, range.to);
  return {
    sales, foodCost, grossProfit, lines, totalExpenses, net, marginPct: sales > 0 ? (net / sales) * 100 : null, days, months,
    breakEvenSales: pct < 100 ? totalExpenses / (1 - pct / 100) : null,
    breakEvenPerDay: pct < 100 ? totalExpenses / (1 - pct / 100) / days : null,
  };
};

/** From MONTHLY estimates: each monthly bill × the months in the range. */
export function computeProfitLoss(i: { netSalesPaise: number; foodCostPct: number; expenses: { label: string; monthly: number }[]; range: Range }): Pnl {
  const months = monthsInRange(i.range);
  const lines = (i.expenses ?? []).map((e) => ({ label: e.label, monthly: Number(e.monthly) || 0, cost: (Number(e.monthly) || 0) * months })).filter((l) => l.monthly > 0);
  return shape((i.netSalesPaise ?? 0) / 100, i.foodCostPct, lines, i.range, months);
}

/** From the bills actually RECORDED in the range (the expenses ledger): `recorded` = [{ label, amount }] in rupees, already summed. */
export function computeProfitLossRecorded(i: { netSalesPaise: number; foodCostPct: number; recorded: { label: string; amount: number }[]; range: Range }): Pnl {
  const months = monthsInRange(i.range) || 1;
  const lines = (i.recorded ?? []).map((e) => ({ label: e.label, cost: Number(e.amount) || 0, monthly: (Number(e.amount) || 0) / months })).filter((l) => l.cost > 0);
  return shape((i.netSalesPaise ?? 0) / 100, i.foodCostPct, lines, i.range, months);
}
