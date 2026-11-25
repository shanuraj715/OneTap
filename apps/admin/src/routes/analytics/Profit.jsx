import { useMemo, useState } from "react";
import { computeProfitLoss, daysBetween } from "@rasoipulse/config-schema";
import { Calculator, CloudUpload, Plus, Trash2 } from "lucide-react";
import { defaultLines, useAn, useAnFilters, useAnOptions, useFinanceProfile } from "../../lib/useAnalytics";
import { Button, Card, Field, Note, TextInput } from "../../ui";
import { Figure, SegmentedBar, StatTile } from "../platform/viz/charts";
import { rupees } from "../platform/viz/format";
import { AnalyticsShell } from "./AnalyticsShell";
import { Insight } from "./parts";

const COLORS = ["#c4506b", "#e5822b", "#a259c4", "#0f8b8d", "#6b7a90", "#b08a3e"];
const inr = (n) => `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(n))}`;

/** the lines of one scope as the owner sees them: what they saved, or the usual bills at ₹0 (a one-outlet store gets every usual bill in one list) */
const linesOf = (scopes, scope, single = false) => (scopes[scope]?.length ? scopes[scope] : single ? defaultLines("all") : defaultLines(scope === "store" ? "store" : "outlet"));

export function Profit() {
  const filters = useAnFilters();
  const opts = useAnOptions();
  const fin = useFinanceProfile(true);
  const pnl = useAn("pnl", filters);
  const outlets = opts.data?.outlets ?? [];
  const single = (opts.data?.outlets?.length ?? 0) <= 1;
  const [picked, setScope] = useState(null);
  const scope = picked ?? outlets[0]?.id ?? "store";
  const [newLabel, setNewLabel] = useState("");
  const { state } = fin;
  const range = filters.range;
  const days = daysBetween(range.from, range.to);

  const setLines = (key, lines) => fin.update({ scopes: { ...state.scopes, [key]: lines } });
  const editAmount = (i, v) => setLines(scope, linesOf(state.scopes, scope, single).map((l, j) => (j === i ? { ...l, monthly: v === "" ? 0 : Math.max(0, Number(v) || 0) } : l)));
  const editLabel = (i, v) => setLines(scope, linesOf(state.scopes, scope, single).map((l, j) => (j === i ? { ...l, label: v } : l)));
  const remove = (i) => setLines(scope, linesOf(state.scopes, scope, single).filter((_, j) => j !== i));
  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    setLines(scope, [...linesOf(state.scopes, scope, single), { key: `custom-${Date.now()}`, label, monthly: 0 }]);
    setNewLabel("");
  };

  // ---- the result for the chosen outlets and dates
  const shown = pnl.data?.perOutlet ?? [];
  const totalNet = pnl.data?.total.net ?? 0;
  const result = useMemo(() => {
    if (!pnl.data) return null;
    const shareOf = (net) => (totalNet ? net / totalNet : 1 / Math.max(1, shown.length));
    const sharedLines = single ? [] : linesOf(state.scopes, "store");
    const per = shown.map((o) => {
      const own = linesOf(state.scopes, o.id, single).map((l) => ({ label: l.label, monthly: l.monthly }));
      const shared = sharedLines.map((l) => ({ label: `${l.label} (shared)`, monthly: l.monthly * shareOf(o.net) }));
      return { id: o.id, name: o.name, net: o.net, calc: computeProfitLoss({ netSalesPaise: o.net, foodCostPct: state.foodCostPct, expenses: [...own, ...shared], range }) };
    });
    const expenses = [
      ...sharedLines.map((l) => ({ label: l.label, monthly: l.monthly })),
      ...shown.flatMap((o) => linesOf(state.scopes, o.id, single).map((l) => ({ label: shown.length > 1 ? `${l.label} — ${o.name}` : l.label, monthly: l.monthly }))),
    ];
    return { per, total: computeProfitLoss({ netSalesPaise: totalNet, foodCostPct: state.foodCostPct, expenses, range }) };
  }, [pnl.data, state, range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps

  const t = result?.total;
  const scopeTotal = linesOf(state.scopes, scope, single).reduce((a, l) => a + (Number(l.monthly) || 0), 0);
  const noExpenses = t && t.totalExpenses === 0;

  return (
    <AnalyticsShell needs="analytics:finance" subtitle="What is left after food, rent, salaries and the rest.">
      <Card title="Your monthly expenses" icon={<Calculator size={16} />} subtitle="Type each bill once, as a monthly amount. They are remembered in this browser, so next time they're already there — change only what changed.">
        <div role="tablist" aria-label="Whose expenses" style={{ display: single ? "none" : "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {(single ? [] : [...outlets.map((o) => ({ id: o.id, label: o.title })), { id: "store", label: "Shared by every outlet" }]).map((s) => (
            <button key={s.id} type="button" role="tab" aria-selected={scope === s.id} onClick={() => setScope(s.id)} style={{ ...tabBtn, ...(scope === s.id ? tabOn : null) }}>{s.label}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1fr) 150px 34px", gap: 8, alignItems: "center", maxWidth: 560 }}>
          {linesOf(state.scopes, scope, single).map((l, i) => (
            <Row key={`${scope}-${l.key}`} line={l} custom={String(l.key).startsWith("custom-")} onAmount={(v) => editAmount(i, v)} onLabel={(v) => editLabel(i, v)} onRemove={() => remove(i)} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Field label="Add another bill"><TextInput value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Loan instalment" onKeyDown={(e) => e.key === "Enter" && add()} style={{ width: 240 }} /></Field>
          <Button variant="outline" onClick={add} disabled={!newLabel.trim()} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Plus size={14} /> Add</Button>
          <span style={{ marginLeft: "auto", fontSize: 14 }}>These add up to <strong data-scope-total>{inr(scopeTotal)}</strong> a month</span>
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--color-border)", alignItems: "flex-end", flexWrap: "wrap" }}>
          <Field label="Food cost (% of sales)" hint="What the ingredients cost, as a share of sales without GST. Most restaurants run 28–38%."><TextInput type="number" min={0} max={100} value={state.foodCostPct} onChange={(e) => fin.update({ foodCostPct: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} style={{ width: 110 }} /></Field>
          <span style={{ flex: 1 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {fin.serverCopy ? <Button variant="outline" onClick={fin.loadFromStore}>Use the version saved to my store</Button> : null}
              <Button onClick={() => void fin.saveToStore()} disabled={fin.saving} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><CloudUpload size={14} /> {fin.saving ? "Saving…" : "Save to my store"}</Button>
            </div>
            <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }} data-finance-note>
              {fin.note || (state.savedAt ? `Saved to your store ${new Date(state.savedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}. Also remembered in this browser.` : "Remembered in this browser only. “Save to my store” also keeps a copy for other devices.")}
            </span>
          </div>
        </div>
      </Card>

      {!result ? <p style={{ color: "var(--color-text-muted)" }}>{pnl.isError ? pnl.error.message : "Loading the sales…"}</p> : (
        <>
          <div className="dash-tiles">
            <StatTile label="Net sales" value={inr(t.sales)} note={`${days} day${days === 1 ? "" : "s"}, without GST`} />
            <StatTile label="Food cost" value={inr(t.foodCost)} note={`${state.foodCostPct}% of net sales`} />
            <StatTile label="Gross profit" value={inr(t.grossProfit)} note="after food cost" />
            <StatTile label="Expenses" value={inr(t.totalExpenses)} note="rent, salaries, bills… for these days" />
            <StatTile label="Net profit" value={<span data-net-profit data-sign={t.net >= 0 ? "profit" : "loss"} style={{ color: t.net >= 0 ? "var(--tone-ok, #1a7f45)" : "var(--tone-error, #b42318)" }}>{t.net < 0 ? "−" : ""}{inr(Math.abs(t.net))}</span>} note={t.marginPct === null ? "no sales yet" : `${t.marginPct.toFixed(1)}% margin · ${t.net >= 0 ? "profit" : "loss"}`} />
          </div>
          <Figure title="Where each rupee of sales goes" subtitle={`${inr(t.sales)} of net sales over ${days} days`} busy={pnl.isFetching}>
            <SegmentedBar parts={splitParts(t)} />
            {noExpenses ? <Insight>No expenses entered yet, so this shows only the food cost. Fill in the bills above for the real profit.</Insight> : t.breakEvenPerDay !== null ? <Insight>To cover food and bills you need about <strong>{inr(t.breakEvenPerDay)} of net sales a day</strong> ({inr(t.breakEvenSales)} over these {days} days). You are averaging <strong>{inr(t.sales / days)}</strong> a day — {t.sales / days >= t.breakEvenPerDay ? "above break-even." : "below break-even; the gap is " + inr(t.breakEvenPerDay - t.sales / days) + " a day."}</Insight> : null}
          </Figure>
          <Figure title="Where the money goes" subtitle="Every expense for these days (monthly amounts shared out by the day)" busy={pnl.isFetching}>
            <div className="viz-tablewrap"><table className="viz-table viz" aria-label="Profit and loss"><tbody>
              <tr><td>Net sales (without GST)</td><td className="r">{inr(t.sales)}</td></tr>
              <tr><td>Food cost ({state.foodCostPct}%)</td><td className="r">− {inr(t.foodCost)}</td></tr>
              <tr style={{ fontWeight: 700 }}><td>Gross profit</td><td className="r">{inr(t.grossProfit)}</td></tr>
              {t.lines.map((l) => <tr key={l.label}><td>{l.label}</td><td className="r">− {inr(l.cost)}</td></tr>)}
              <tr style={{ fontWeight: 700 }}><td>Total expenses</td><td className="r">− {inr(t.totalExpenses)}</td></tr>
              <tr style={{ fontWeight: 700 }}><td>Net profit</td><td className="r">{t.net < 0 ? "− " : ""}{inr(Math.abs(t.net))}</td></tr>
            </tbody></table></div>
          </Figure>
          {result.per.length > 1 ? (
            <Figure title="Profit by outlet" subtitle="Each outlet's own bills, plus its share of the shared ones (by sales)" busy={pnl.isFetching}>
              <div className="viz-tablewrap"><table className="viz-table viz" aria-label="Profit by outlet"><thead><tr><th>Outlet</th><th className="r">Net sales</th><th className="r">Food cost</th><th className="r">Expenses</th><th className="r">Net profit</th><th className="r">Margin</th></tr></thead>
                <tbody>{result.per.map((o) => <tr key={o.id}><td>{o.name}</td><td className="r">{inr(o.calc.sales)}</td><td className="r">{inr(o.calc.foodCost)}</td><td className="r">{inr(o.calc.totalExpenses)}</td><td className="r" style={{ color: o.calc.net < 0 ? "var(--tone-error, #b42318)" : undefined, fontWeight: 700 }}>{o.calc.net < 0 ? "− " : ""}{inr(Math.abs(o.calc.net))}</td><td className="r">{o.calc.marginPct === null ? "—" : `${o.calc.marginPct.toFixed(1)}%`}</td></tr>)}</tbody></table></div>
            </Figure>
          ) : null}
          <Note>Sales here are net sales: paid orders without GST (the tax belongs to the government) and without cancelled orders. A monthly bill is charged for each day of the period — a full calendar month costs exactly one month's amount. Bills shared by every outlet are split between the outlets you chose, by their sales.</Note>
        </>
      )}
    </AnalyticsShell>
  );
}

function Row({ line, custom, onAmount, onLabel, onRemove }) {
  return (
    <>
      {custom ? <TextInput value={line.label} onChange={(e) => onLabel(e.target.value)} aria-label={`Name of ${line.label}`} /> : <label htmlFor={`exp-${line.key}`} style={{ fontSize: 14 }}>{line.label}</label>}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "var(--color-text-muted)" }}>₹</span>
        <TextInput id={`exp-${line.key}`} type="number" min={0} inputMode="decimal" value={line.monthly || ""} placeholder="0" onChange={(e) => onAmount(e.target.value)} aria-label={`${line.label} per month`} />
      </div>
      {custom ? <button type="button" onClick={onRemove} aria-label={`Remove ${line.label}`} style={iconBtn}><Trash2 size={14} /></button> : <span />}
    </>
  );
}

function splitParts(t) {
  const parts = [{ id: "food", name: "Food cost", amount: t.foodCost, value: t.foodCost, color: COLORS[0] }];
  const sorted = [...t.lines].sort((a, b) => b.cost - a.cost);
  sorted.slice(0, 4).forEach((l, i) => parts.push({ id: l.label, name: l.label, amount: l.cost, value: l.cost, color: COLORS[(i + 1) % COLORS.length] }));
  const rest = sorted.slice(4).reduce((a, l) => a + l.cost, 0);
  if (rest > 0) parts.push({ id: "rest", name: "Other bills", amount: rest, value: rest, color: COLORS[5] });
  if (t.net > 0) parts.push({ id: "profit", name: "Profit", amount: t.net, value: t.net, color: "#2e9d61" });
  return parts.filter((p) => p.value > 0).map((p) => ({ ...p, display: t.sales ? `${Math.round((p.value / t.sales) * 100)}%` : "" }));
}
void rupees;
const tabBtn = { font: "inherit", fontSize: 13, padding: "6px 14px", borderRadius: 999, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", cursor: "pointer" };
const tabOn = { background: "var(--color-primary)", color: "var(--color-on-primary)", borderColor: "var(--color-primary)", fontWeight: 600 };
const iconBtn = { border: 0, background: "transparent", cursor: "pointer", color: "var(--color-text-muted)", display: "grid", placeItems: "center", padding: 6 };
