import { useMemo, useState } from "react";
import { View } from "react-native";
import { useOptions, useReport } from "@/data/queries";
import { rangeOfScope, useScope } from "@/data/scope";
import { usePnlPlan } from "@/data/pnlPlan";
import { rangeLabel } from "@/lib/dates";
import { money, moneyShort, share } from "@/lib/format";
import { computeProfitLoss, computeProfitLossRecorded } from "@/lib/pnl";
import { Async, BarChart, Button, Empty, Field, Glass, Grid, Input, KpiTile, Pill, RankedBars, Section, Segmented, Sheet, Text, useTheme } from "@/ui";

/**
 * Profit and loss for the chosen period: net sales − food cost − expenses = profit. The expenses are either the bills written in the Expenses
 * list (default) or monthly estimates the owner types here. The same maths as the web dashboard (a test runs both on the same numbers).
 */
export function PnlTab() {
  const { c } = useTheme();
  const options = useOptions();
  const q = useReport("pnl", (api, s) => api.pnl(s));
  const plan = usePnlPlan();
  const range = rangeOfScope(useScope());
  const defaultPct = options.data?.defaults.foodCostPct ?? 35;
  const pct = plan.foodCostPct ?? defaultPct;
  const [pctText, setPctText] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [monthly, setMonthly] = useState("");

  const pnl = useMemo(() => {
    const d = q.data;
    if (!d) return null;
    return plan.mode === "recorded"
      ? computeProfitLossRecorded({ netSalesPaise: d.total.net, foodCostPct: pct, recorded: d.recorded.map((r) => ({ label: r.label, amount: r.amount })), range })
      : computeProfitLoss({ netSalesPaise: d.total.net, foodCostPct: pct, expenses: plan.lines.map((l) => ({ label: l.label, monthly: l.monthly })), range });
  }, [q.data, plan.mode, plan.lines, pct, range]);

  const onPct = (t: string) => {
    setPctText(t);
    const n = Number(t);
    if (t.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= 100) plan.setFoodCostPct(n);
  };
  const pctBad = pctText !== null && (pctText.trim() === "" || !Number.isFinite(Number(pctText)) || Number(pctText) < 0 || Number(pctText) > 100);
  const monthlyN = Number(monthly.replace(/,/g, ""));
  const canAdd = label.trim().length > 0 && monthlyN > 0;

  return (
    <>
      <Segmented testID="pnl-mode" value={plan.mode} onChange={plan.setMode} options={[{ value: "recorded", label: "Bills I wrote down" }, { value: "monthly", label: "Monthly estimates" }]} />
      <Glass>
        <Field label="What the food and ingredients cost, out of every ₹100 of sales" error={pctBad ? "Type a number from 0 to 100." : undefined} hint={plan.foodCostPct === null ? `Starting from ${defaultPct}% — a common figure for restaurants. Change it to your own.` : "Used for every calculation on this page."}>
          <Input testID="pnl-food-input" value={pctText ?? String(pct)} onChangeText={onPct} keyboardType="numeric" maxLength={5} />
        </Field>
      </Glass>

      <Async q={q} lines={2}>
        {() => pnl ? (
          <>
            <Glass testID="pnl-card">
              <View style={{ gap: 6 }}>
                <Text variant="caption" tone="muted">Profit for {rangeLabel(range)}</Text>
                <Text variant="hero" testID="pnl-net" style={{ color: pnl.net >= 0 ? c.ok : c.danger }}>{money(Math.round(pnl.net))}</Text>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  <Pill tone={pnl.net >= 0 ? "ok" : "danger"} icon={pnl.net >= 0 ? "trend" : "trendDown"}>{pnl.marginPct === null ? "No sales yet" : `${Math.round(pnl.marginPct * 10) / 10}% margin`}</Pill>
                  <Pill tone="neutral">{`${pnl.days} ${pnl.days === 1 ? "day" : "days"}`}</Pill>
                </View>
              </View>
            </Glass>

            <Grid min={150}>
              <KpiTile testID="pnl-sales" icon="rupee" label="Sales without GST" value={money(Math.round(pnl.sales))} />
              <KpiTile testID="pnl-food" icon="utensils" label={`Food cost (${pct}%)`} value={money(Math.round(pnl.foodCost))} />
              <KpiTile testID="pnl-gross" icon="wallet" label="Left after food" value={money(Math.round(pnl.grossProfit))} />
              <KpiTile testID="pnl-expenses" icon="receipt" label="Expenses" value={money(Math.round(pnl.totalExpenses))} />
              <KpiTile testID="pnl-breakeven" icon="target" label="Needed each day to break even" value={pnl.breakEvenPerDay === null ? "–" : money(Math.round(pnl.breakEvenPerDay))}
                sub={pnl.breakEvenPerDay === null ? undefined : `${share(pnl.breakEvenSales && pnl.sales ? pnl.sales / pnl.breakEvenSales : 0)} of the break-even point reached`} />
            </Grid>

            <Section title="Where the money goes" hint="Net sales, then what is taken out of them">
              <Glass><BarChart testID="chart-pnl" format={(n) => moneyShort(n)} data={[{ label: "Sales", value: Math.max(0, pnl.sales) }, { label: "Food", value: pnl.foodCost }, { label: "Bills", value: pnl.totalExpenses }, { label: "Profit", value: Math.max(0, pnl.net) }]} color={c.chart[0]} /></Glass>
            </Section>

            <Section title="Expenses counted" hint={plan.mode === "recorded" ? "From the bills in the Expenses tab" : "Your monthly estimates, shared out over the days"}
              action={plan.mode === "monthly" ? <Button size="sm" icon="plus" title="Add" variant="glass" onPress={() => { setLabel(""); setMonthly(""); setAdding(true); }} testID="pnl-line-add" /> : undefined}>
              {pnl.lines.length ? (
                <Glass>
                  <RankedBars rows={pnl.lines.map((l) => ({ label: l.label, value: l.cost, note: plan.mode === "monthly" ? `${money(l.monthly)} a month` : undefined }))} format={(n) => money(Math.round(n))} />
                </Glass>
              ) : plan.mode === "recorded" ? <Empty icon="receipt" title="No bills written down for this period" message="Add them in the Expenses tab, or switch to Monthly estimates above." />
                : <Empty icon="receipt" title="No monthly estimates yet" message="Add your rent, salaries, electricity… and the profit is worked out from them." />}
              {plan.mode === "monthly" && plan.lines.length ? (
                <View style={{ gap: 8, marginTop: 10 }}>
                  {plan.lines.map((l) => <Button key={l.id} size="sm" variant="glass" icon="trash" title={`Remove ${l.label}`} onPress={() => plan.removeLine(l.id)} testID={`pnl-line-remove-${l.id}`} />)}
                </View>
              ) : null}
            </Section>

            {q.data && q.data.perOutlet.length > 1 ? (
              <Section title="Sales by outlet" hint="Net sales without GST">
                <Glass><RankedBars rows={q.data.perOutlet.map((o) => ({ id: o.id, label: o.name, value: o.net }))} format={(n) => moneyShort(n / 100)} /></Glass>
              </Section>
            ) : null}
          </>
        ) : null}
      </Async>

      <Sheet visible={adding} onClose={() => setAdding(false)} title="Add a monthly expense" testID="pnl-line-sheet"
        footer={<><Button title="Cancel" variant="glass" onPress={() => setAdding(false)} /><Button title="Add" disabled={!canAdd} onPress={() => { plan.addLine(label, monthlyN); setAdding(false); }} testID="pnl-line-save" /></>}>
        <Field label="What is it?" hint="Rent, salaries, electricity, gas…"><Input value={label} onChangeText={setLabel} autoCapitalize="sentences" testID="pnl-line-label" /></Field>
        <Field label="How much each month (₹)"><Input value={monthly} onChangeText={setMonthly} keyboardType="numeric" testID="pnl-line-monthly" /></Field>
      </Sheet>
    </>
  );
}
