import { useState } from "react";
import { View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import type { Expense } from "@/api/endpoints";
import { useApi } from "@/runtime";
import { useOptions, useReport } from "@/data/queries";
import { useAction } from "@/data/useAction";
import { bucketLabel, prettyDay, today } from "@/lib/dates";
import { count, money, moneyShort } from "@/lib/format";
import { Async, BarChart, Button, Chips, ConfirmSheet, DateField, Donut, Empty, Field, Glass, Grid, Input, KpiTile, RankedBars, Row, Section, Select, Sheet, Text, useTheme } from "@/ui";
import { thin } from "../Sales";

/** The bills the store has paid, written down by the day: totals, where the money went, and the list (add / change / remove with the right role). */
export function ExpensesTab() {
  const { c } = useTheme();
  const options = useOptions();
  const [category, setCategory] = useState("");
  const q = useReport(`expenses-${category || "all"}`, (api, s) => api.expenses(s, category));
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const cats = options.data?.ledgerCategories ?? [];
  const canWrite = Boolean(options.data?.canWriteExpenses);

  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text variant="caption" tone="muted" style={{ flex: 1 }}>The bills you wrote down. They make the profit page exact.</Text>
        {canWrite ? <Button size="sm" icon="plus" title="Add expense" onPress={() => setEditing("new")} testID="expense-add" /> : null}
      </View>
      <Chips testID="exp-cat" value={category} onChange={setCategory} options={[{ value: "", label: "All" }, ...cats.map((x) => ({ value: x.key, label: x.label }))]} />

      <Async q={q} lines={2}>
        {(d) => (
          <>
            <Grid min={160}>
              <KpiTile testID="exp-total" icon="receipt" label="Spent" value={money(d.totals.amount)} invert delta={d.totals.change} sub={`${money(d.totals.previous)} the period before`} />
              <KpiTile testID="exp-bills" icon="orders" label="Bills" value={count(d.totals.entries)} sub={`${money(Math.round(d.totals.perDay))} a day`} />
            </Grid>

            {d.totals.entries === 0 ? <Empty icon="receipt" title="No bills in this period" message={canWrite ? "Press “Add expense” and write down what you paid." : "Nothing has been written down for these days."} /> : (
              <>
                <Section title="Where the money went">
                  <Glass><Donut testID="chart-exp-categories" items={d.byCategory.map((x) => ({ label: x.label, value: x.amount }))} format={(n) => moneyShort(n)} centerBottom="spent" /></Glass>
                </Section>
                <Section title="Over time" hint={`By ${d.granularity}`}>
                  <Glass><BarChart testID="chart-exp-series" format={(n) => moneyShort(n)} color={c.chart[3]} data={thin(d.series.map((p) => bucketLabel(p.key, d.granularity))).map((label, i) => ({ label, value: d.series[i]!.amount }))} /></Glass>
                </Section>
                {d.byVendor.length ? <Section title="Who you paid most"><Glass><RankedBars rows={d.byVendor.map((v) => ({ label: v.name, value: v.amount, note: `${v.entries} ${v.entries === 1 ? "bill" : "bills"}` }))} format={(n) => money(Math.round(n))} /></Glass></Section> : null}
                {d.byOutlet.length > 1 ? <Section title="By outlet"><Glass><RankedBars rows={d.byOutlet.map((o) => ({ label: o.name, value: o.amount }))} format={(n) => money(Math.round(n))} /></Glass></Section> : null}
                <Section title="How it was paid"><Glass><RankedBars rows={d.byPaymentMode.map((m) => ({ label: m.label, value: m.amount }))} format={(n) => money(Math.round(n))} /></Glass></Section>
                <Section title="Every bill" hint={canWrite ? "Press one to change or remove it" : undefined}>
                  <View style={{ gap: 10 }}>
                    {d.entries.map((e, i) => (
                      <Row key={e.id} index={i} testID={`expense-${e.id}`} icon="receipt" title={e.label || e.categoryLabel} subtitle={`${prettyDay(e.day)} · ${e.outlet || "Whole store"} · ${e.categoryLabel}${e.vendor ? ` · ${e.vendor}` : ""}`} right={<Text variant="subheading">{money(e.amount)}</Text>} onPress={canWrite ? () => setEditing(e) : undefined} />
                    ))}
                  </View>
                </Section>
              </>
            )}
          </>
        )}
      </Async>
      {editing ? <ExpenseSheet entry={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

/** Add a bill, or change / remove one. */
function ExpenseSheet({ entry, onClose }: { entry: Expense | null; onClose: () => void }) {
  const api = useApi();
  const qc = useQueryClient();
  const options = useOptions();
  const o = options.data;
  const [day, setDay] = useState(entry?.day ?? today());
  const [amount, setAmount] = useState(entry ? String(entry.amount) : "");
  const [picked, setCategory] = useState(entry?.category ?? "");
  const category = picked || o?.ledgerCategories[0]?.key || ""; // a new bill starts on the first kind until another is chosen
  const [label, setLabel] = useState(entry?.label ?? "");
  const [outletId, setOutletId] = useState(entry?.outletId ?? "");
  const [mode, setMode] = useState(entry?.paymentMode ?? "cash");
  const [vendor, setVendor] = useState(entry?.vendor ?? "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [confirm, setConfirm] = useState(false);
  const n = Number(amount.replace(/,/g, ""));
  const valid = Boolean(day) && n > 0 && Boolean(category);
  const body = { day, amount: n, category, label: label.trim(), outletId: outletId || null, vendor: vendor.trim(), note: note.trim(), paymentMode: mode };
  const done = () => { void qc.invalidateQueries({ queryKey: ["report"] }); onClose(); };
  const save = useAction(() => (entry ? api.updateExpense(entry.id, body) : api.addExpense(body)), { done: entry ? "Expense changed." : "Expense saved.", onDone: done });
  const remove = useAction(() => api.deleteExpense(entry!.id), { done: "Expense removed.", onDone: done });
  return (
    <>
      <Sheet visible onClose={onClose} title={entry ? "Change this expense" : "Add an expense"} testID="expense-sheet"
        footer={<>{entry ? <Button title="Remove" variant="danger" icon="trash" onPress={() => setConfirm(true)} testID="expense-remove" /> : <Button title="Cancel" variant="glass" onPress={onClose} />}<Button title="Save" loading={save.isPending} disabled={!valid} onPress={() => save.mutate(undefined)} testID="expense-save" /></>}>
        <DateField label="Day it was paid" value={day} onChange={setDay} max={today()} clearable={false} testID="expense-day" />
        <Field label="Amount (₹)" error={amount !== "" && !(n > 0) ? "Type an amount more than 0." : undefined}><Input value={amount} onChangeText={setAmount} keyboardType="numeric" testID="expense-amount" /></Field>
        <Select label="What kind of bill" value={category} options={(o?.ledgerCategories ?? []).map((x) => ({ value: x.key, label: x.label }))} onChange={setCategory} testID="expense-category" />
        <Field label="What was it? (optional)"><Input value={label} onChangeText={setLabel} autoCapitalize="sentences" testID="expense-label" /></Field>
        <Select label="For which outlet" value={outletId} options={[{ value: "", label: "Whole store" }, ...(o?.outlets ?? []).map((x) => ({ value: x.id, label: x.title }))]} onChange={setOutletId} testID="expense-outlet" />
        <Select label="Paid by" value={mode} options={(o?.paymentModes ?? []).map((x) => ({ value: x.id, label: x.label }))} onChange={setMode} testID="expense-mode" />
        <Field label="Paid to (optional)"><Input value={vendor} onChangeText={setVendor} autoCapitalize="words" testID="expense-vendor" /></Field>
        <Field label="Note (optional)"><Input value={note} onChangeText={setNote} multiline autoCapitalize="sentences" testID="expense-note" /></Field>
      </Sheet>
      <ConfirmSheet visible={confirm} title="Remove this expense?" message={`${entry?.label || entry?.categoryLabel || "This bill"} for ${money(entry?.amount ?? 0)} will be taken out of the totals and the profit.`} confirm="Remove" busy={remove.isPending} onConfirm={() => remove.mutate(undefined)} onClose={() => setConfirm(false)} />
    </>
  );
}
