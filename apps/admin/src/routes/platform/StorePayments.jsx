import { useMemo, useState } from "react";
import { DatePickerInput } from "@rasoipulse/ui";
import { Trash2, Wallet } from "lucide-react";
import * as api from "../../lib/api";
import { useAuth } from "../../lib/useAuth";
import { usePlans, usePlatformMutation, useStorePayments } from "../../lib/usePlatform";
import { Button, Card, Empty, Field, Note, Pill, Select, TextInput, Toast } from "../../ui";
import { muted, row } from "./shared";

const MONEY = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
/** ₹2,499 · ₹999.50 — whole rupees without decimals, paise shown when there are any */
export const money = (v) => `₹${MONEY.format(v ?? 0)}`;
/** "28 Nov 2026" for a "2026-11-28" day */
export const dayText = (s) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) : "—");
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * A store's subscription: where it stands (paid until a day, ran out, or nothing written down yet) and the payments the team has written
 * down. A store pays OUTSIDE the app, so this is a hand-kept list: the first payment is the new sale, later ones are re-subscriptions —
 * that is what the dashboard's "Rasoi Pulse business" numbers are made of.
 */
export function PaymentsTab({ store }) {
  const { canPlatform } = useAuth();
  const mayWrite = canPlatform("stores:manage");
  const q = useStorePayments(store.id);
  const plans = usePlans(mayWrite);
  const record = usePlatformMutation((body) => api.recordStorePayment(store.id, body));
  const remove = usePlatformMutation((paymentId) => api.deleteStorePayment(store.id, paymentId));
  const [paidOn, setPaidOn] = useState(todayKey());
  const [months, setMonths] = useState(1);
  const [planId, setPlanId] = useState("");
  const [amount, setAmount] = useState("");
  const [touched, setTouched] = useState(false); // the amount was typed by a person: stop suggesting
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  const data = q.data;
  const planList = plans.data?.plans ?? [];
  // the plan the payment is for: the one chosen, else the store's own
  const chosen = planList.find((p) => p.id === (planId || data?.suggest?.planId));
  const prices = useMemo(() => {
    const monthly = chosen?.marketing?.monthly ?? (!planId ? data?.suggest?.monthly : 0) ?? 0;
    const discount = chosen?.marketing?.yearlyDiscount ?? 0;
    const yearly = monthly && discount ? Math.round((monthly * 12 * (100 - discount)) / 100) : 0;
    return { monthly, yearly };
  }, [chosen, planId, data]);
  const suggested = months === 12 && prices.yearly ? prices.yearly : prices.monthly * months;

  // until a person types an amount, the box shows the plan's price for the months chosen
  const shownAmount = touched ? amount : suggested ? String(suggested) : "";

  if (q.isError) return <Card title="Subscription">{q.error.message}</Card>;
  if (!data) return <Card title="Subscription">Loading…</Card>;

  const { standing, payments } = data;
  const earliest = payments.length ? payments[payments.length - 1].paidOn : null; // newest first
  const willBe = !payments.length || paidOn < earliest ? "new" : "renewal";
  const amountNumber = Number(shownAmount);
  const problem = !paidOn ? "Pick the day the money arrived." : !(amountNumber > 0) ? "Type the amount that was paid, in rupees." : !(Number.isInteger(months) && months >= 1 && months <= 60) ? "Months must be a whole number from 1 to 60." : null;

  const submit = (e) => {
    e.preventDefault();
    setSaved(false);
    record.mutate(
      { amount: amountNumber, paidOn, months, planId: planId || undefined, note: note.trim() || undefined },
      {
        onSuccess: () => {
          setSaved(true);
          setNote("");
          setTouched(false);
        },
      },
    );
  };

  return (
    <>
      <Card
        title="Subscription"
        icon={<Wallet size={16} />}
        subtitle="What this store has paid Rasoi Pulse. The store pays outside the app, so you write each payment down here — the dashboard's business numbers are made from these."
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }} data-testid="payments-standing">
          {standing.state === "active" ? (
            <Pill tone="ok">
              Paid until {dayText(standing.paidUntil)} · {standing.daysLeft} {standing.daysLeft === 1 ? "day" : "days"} left
            </Pill>
          ) : standing.state === "expired" ? (
            <Pill tone="error">Ran out on {dayText(standing.paidUntil)} — not renewed</Pill>
          ) : (
            <Pill tone="warn">No payment written down yet</Pill>
          )}
          <span style={muted} data-testid="payments-total">
            {payments.length} {payments.length === 1 ? "payment" : "payments"} · {money(data.total)} in all
          </span>
        </div>
      </Card>

      {mayWrite ? (
        <Card title="Write a payment down" subtitle="Use the day the money arrived. Early renewals carry on from where the last payment ends, so no days are lost.">
          <form onSubmit={submit} data-testid="payments-form" style={{ display: "grid", gap: "0 14px", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", alignItems: "start" }}>
            <Field label="Day paid">
              <DatePickerInput variant="filled" fullWidth value={paidOn} maxDate={new Date()} ariaLabel="Day paid" testId="payment-date" onChange={(str) => str && setPaidOn(str)} />
            </Field>
            <Field label="Plan" hint="defaults to the store's plan">
              <Select value={planId} onChange={(e) => setPlanId(e.target.value)} data-testid="payment-plan" aria-label="Plan" style={{ width: "100%" }}>
                <option value="">{data.suggest.planName ? `${data.suggest.planName} (the store's plan)` : "No plan"}</option>
                {planList
                  .filter((p) => p.id !== data.suggest.planId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Months covered" hint="a yearly payment is 12">
              <div style={{ display: "flex", gap: 6 }}>
                <TextInput type="number" min={1} max={60} step={1} value={months} onChange={(e) => setMonths(e.target.value === "" ? 0 : Number(e.target.value))} data-testid="payment-months" aria-label="Months covered" style={{ width: 80 }} />
                <Button type="button" variant="outline" onClick={() => setMonths(1)} aria-pressed={months === 1}>
                  1
                </Button>
                <Button type="button" variant="outline" onClick={() => setMonths(12)} aria-pressed={months === 12}>
                  12
                </Button>
              </div>
            </Field>
            <Field label="Amount paid (₹)" hint={suggested ? "from the plan's price — change it if they paid differently" : "in rupees"}>
              <TextInput type="number" min={0} step="0.01" value={shownAmount} onChange={(e) => (setTouched(true), setAmount(e.target.value))} data-testid="payment-amount" aria-label="Amount paid in rupees" style={{ width: "100%" }} />
              {touched && suggested > 0 && amountNumber !== suggested ? (
                <Button type="button" variant="outline" data-testid="payment-use-price" onClick={() => setTouched(false)} style={{ marginTop: 6, width: "100%" }}>
                  Use the plan's price ({money(suggested)})
                </Button>
              ) : null}
            </Field>
            <Field label="Note" hint="optional — e.g. bank reference">
              <TextInput value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} data-testid="payment-note" aria-label="Note" style={{ width: "100%" }} />
            </Field>
            <Field as="div" label={" "}>
              <Button type="submit" disabled={record.isPending || Boolean(problem)} style={{ width: "100%" }} data-testid="payment-submit">
                {record.isPending ? "Writing…" : "Write it down"}
              </Button>
            </Field>
          </form>
          <p style={{ ...muted, margin: "2px 0 0" }} data-testid="payment-will-be">
            {problem ?? (willBe === "new" ? "This will count as the NEW SALE for this store (its first payment)." : "This will count as a RE-SUBSCRIPTION (the store paid before).")}
          </p>
          {record.isError ? <Toast kind="error">{record.error.message}</Toast> : null}
          {saved && !record.isPending ? <Toast kind="ok">Payment written down.</Toast> : null}
        </Card>
      ) : (
        <Note>Your role can see payments but not write them. Writing a payment down needs access to manage stores.</Note>
      )}

      <Card title={`Payments — ${payments.length}`} subtitle="Newest first.">
        {payments.length === 0 ? (
          <Empty icon={<Wallet size={26} />} title="Nothing written down yet">
            When this store pays, write the payment down above. The first one counts as a new sale, later ones as re-subscriptions.
          </Empty>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {payments.map((p) => (
              <div key={p.id} style={{ ...row, flexWrap: "wrap", alignItems: "center", gap: "8px 14px" }} data-testid="payment-row">
                <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                  <div style={{ fontWeight: 600, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span data-testid="payment-amount-text">{money(p.amount)}</span>
                    <span style={{ fontWeight: 400 }}>on {dayText(p.paidOn)}</span>
                    <span data-testid="payment-kind">
                      <Pill tone={p.kind === "new" ? "ok" : "info"}>{p.kind === "new" ? "New sale" : "Re-subscribed"}</Pill>
                    </span>
                  </div>
                  <div style={{ ...muted, overflowWrap: "anywhere" }}>
                    {p.planName || "No plan"} · {p.months} {p.months === 1 ? "month" : "months"} · covers {dayText(p.coversFrom)} to {dayText(p.coversTo)}
                    {p.recordedBy ? ` · written by ${p.recordedBy}` : ""}
                    {p.note ? ` · “${p.note}”` : ""}
                  </div>
                </div>
                {mayWrite ? (
                  <Button
                    variant="outline"
                    data-testid="payment-delete"
                    aria-label={`Delete the payment of ${money(p.amount)} on ${dayText(p.paidOn)}`}
                    disabled={remove.isPending}
                    onClick={() => window.confirm(`Delete the payment of ${money(p.amount)} made on ${dayText(p.paidOn)}? Only do this if it was written down by mistake.`) && remove.mutate(p.id)}
                    style={{ color: "var(--tone-danger)", display: "inline-flex", gap: 6, alignItems: "center" }}
                  >
                    <Trash2 size={13} /> Delete
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {remove.isError ? <Toast kind="error">{remove.error.message}</Toast> : null}
      </Card>
    </>
  );
}
