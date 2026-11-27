import { useState } from "react";
import { View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/runtime";
import { useAction } from "@/data/useAction";
import type { PaymentRow } from "@/api/endpoints";
import { money } from "@/lib/format";
import { kindFor, paymentProblem, suggestedAmount, yearlyPrice } from "@/lib/payments";
import { prettyDay, todayKey } from "@/ui/calendar";
import { Button, ConfirmSheet, DateField, Empty, Field, Glass, Input, Pill, Row, Select, Sheet, Text } from "@/ui";

/**
 * A store's subscription: where it stands (paid until a day, ran out, or nothing written down yet) and the payments the team has written
 * down. A store pays OUTSIDE the app, so this is a hand-kept list: the first payment is the new sale, later ones are re-subscriptions —
 * that is what the dashboard's "Rasoi Pulse business" numbers are made of.
 */
export function PaymentsSection({ id, mayManage }: { id: string; mayManage: boolean }) {
  const api = useApi();
  const q = useQuery({ queryKey: ["store-payments", id], queryFn: () => api.storePayments(id) });
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => api.plans(), enabled: mayManage });
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<PaymentRow | null>(null);
  const [paidOn, setPaidOn] = useState(todayKey());
  const [planId, setPlanId] = useState("");
  const [months, setMonths] = useState("1");
  const [amount, setAmount] = useState("");
  const [touched, setTouched] = useState(false); // the amount was typed by a person: stop suggesting
  const [note, setNote] = useState("");
  const keys = [["store-payments", id], ["business"]];

  const record = useAction((v: { amount: number; paidOn: string; months: number; planId?: string; note?: string }) => api.recordPayment(id, v), {
    done: "Payment written down.", invalidate: keys,
    onDone: () => { setOpen(false); setNote(""); setTouched(false); },
  });
  const remove = useAction((paymentId: string) => api.deletePayment(id, paymentId), { done: "Payment deleted.", invalidate: keys, onDone: () => setToDelete(null) });

  const data = q.data;
  if (q.isLoading) return <Glass><Text tone="muted">Loading the payments…</Text></Glass>;
  if (q.isError || !data) return <Glass><View style={{ gap: 8 }}><Text tone="muted">The payments could not be loaded.</Text><Button size="sm" variant="glass" icon="refresh" title="Try again" onPress={() => void q.refetch()} testID="payments-retry" /></View></Glass>;

  const { standing, payments, suggest } = data;
  const chosen = (plans.data?.plans ?? []).find((p) => p.id === planId);
  const monthly = chosen ? chosen.marketing?.monthly ?? 0 : suggest.monthly;
  const yearly = chosen ? yearlyPrice(monthly, chosen.marketing?.yearlyDiscount ?? 0) : suggest.yearly;
  const m = Number(months);
  const suggested = suggestedAmount(monthly, yearly, m);
  // until a person types an amount, the box shows the plan's price for the months chosen
  const shownAmount = touched ? amount : suggested ? String(suggested) : "";
  const amountNumber = Number(shownAmount);
  const willBe = kindFor(payments, paidOn);
  const problem = paymentProblem(paidOn, amountNumber, m);

  return (
    <View style={{ gap: 12 }} testID="payments">
      <Glass>
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }} testID="payments-standing">
            {standing.state === "active" ? <Pill tone="ok">Paid until {prettyDay(standing.paidUntil!)} · {standing.daysLeft} {standing.daysLeft === 1 ? "day" : "days"} left</Pill>
              : standing.state === "expired" ? <Pill tone="danger">Ran out on {prettyDay(standing.paidUntil!)} — not renewed</Pill>
              : <Pill tone="warn">No payment written down yet</Pill>}
            <Text variant="caption" tone="muted" testID="payments-total">{payments.length} {payments.length === 1 ? "payment" : "payments"} · {money(data.total)} in all</Text>
          </View>
          <Text variant="caption" tone="muted">The store pays outside the app, so you write each payment down. The first is the new sale, later ones are re-subscriptions.</Text>
          {mayManage ? <Button size="sm" icon="plus" title="Write a payment down" onPress={() => setOpen(true)} testID="payment-add" /> : <Text variant="caption" tone="muted" testID="payments-readonly">Your role can see payments, not write them — that needs access to manage stores.</Text>}
        </View>
      </Glass>

      {payments.length ? payments.map((p, i) => (
        <Row key={p.id} index={i} icon="rupee" testID={`payment-${p.id}`} title={`${money(p.amount)} · ${prettyDay(p.paidOn)}`}
          subtitle={`${p.planName || "No plan"} · ${p.months} ${p.months === 1 ? "month" : "months"} · covers ${prettyDay(p.coversFrom)} to ${prettyDay(p.coversTo)}`}
          right={<Pill tone={p.kind === "new" ? "ok" : "info"}>{p.kind === "new" ? "New sale" : "Re-subscribed"}</Pill>}>
          {p.recordedBy || p.note ? <Text variant="caption" tone="muted">{[p.recordedBy ? `written by ${p.recordedBy}` : "", p.note ? `“${p.note}”` : ""].filter(Boolean).join(" · ")}</Text> : null}
          {mayManage ? <Button size="sm" variant="glass" icon="trash" title="Delete" onPress={() => setToDelete(p)} testID={`payment-delete-${p.id}`} /> : null}
        </Row>
      )) : <Empty icon="wallet" title="Nothing written down yet" message="When this store pays, write the payment down." />}

      <Sheet visible={open} onClose={() => setOpen(false)} title="Write a payment down" testID="payment-sheet"
        footer={<><Button title="Cancel" variant="glass" onPress={() => setOpen(false)} /><Button title="Write it down" loading={record.isPending} disabled={Boolean(problem)} onPress={() => record.mutate({ amount: amountNumber, paidOn, months: m, planId: planId || undefined, note: note.trim() || undefined })} testID="payment-save" /></>}>
        <DateField label="Day paid" value={paidOn} onChange={(v) => v && setPaidOn(v)} max={todayKey()} clearable={false} testID="payment-date" />
        <Select label="Plan" value={planId} onChange={setPlanId} testID="payment-plan" options={[{ value: "", label: suggest.planName ? `${suggest.planName} (the store's plan)` : "No plan" }, ...(plans.data?.plans ?? []).filter((p) => !p.archived && p.id !== suggest.planId).map((p) => ({ value: p.id, label: p.name }))]} />
        <Field label="Months covered" hint="a yearly payment is 12"><Input value={months} onChangeText={setMonths} keyboardType="numeric" testID="payment-months" /></Field>
        <Field label="Amount paid (₹)" hint={suggested ? "from the plan's price — change it if they paid differently" : "in rupees"}>
          <View style={{ gap: 8 }}>
            <Input value={shownAmount} onChangeText={(t) => { setTouched(true); setAmount(t); }} keyboardType="numeric" testID="payment-amount" />
            {touched && suggested > 0 && amountNumber !== suggested ? <Button size="sm" variant="glass" title={`Use the plan's price (${money(suggested)})`} onPress={() => setTouched(false)} testID="payment-use-price" /> : null}
          </View>
        </Field>
        <Field label="Note" hint="optional — e.g. bank reference"><Input value={note} onChangeText={setNote} maxLength={200} autoCapitalize="sentences" testID="payment-note" /></Field>
        <Text variant="caption" tone="muted" testID="payment-will-be">{problem ?? (willBe === "new" ? "This will count as the NEW SALE for this store (its first payment)." : "This will count as a RE-SUBSCRIPTION (the store paid before).")}</Text>
      </Sheet>

      <ConfirmSheet visible={Boolean(toDelete)} title="Delete this payment" message={toDelete ? `Delete the payment of ${money(toDelete.amount)} made on ${prettyDay(toDelete.paidOn)}? Only do this if it was written down by mistake.` : ""} confirm="Delete" busy={remove.isPending} onConfirm={() => toDelete && remove.mutate(toDelete.id)} onClose={() => setToDelete(null)} />
    </View>
  );
}
