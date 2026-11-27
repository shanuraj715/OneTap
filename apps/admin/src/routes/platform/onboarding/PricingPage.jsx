import { useEffect, useState } from "react";
import { Link } from "../../../lib/nav";
import { FEATURES, priceSteps, resolvePricing } from "@rasoipulse/config-schema";
import { ArrowLeft, Calculator, RotateCcw, Save } from "lucide-react";
import * as api from "../../../lib/api";
import { usePlans, usePlatformMutation, usePricing } from "../../../lib/usePlatform";
import { Button, Card, Field, Modal, Note, PageHeader, TextInput, Toast } from "../../../ui";
import { muted } from "../shared";

const rs = (n) => `₹${new Intl.NumberFormat("en-IN").format(Math.round(n))}`;

/**
 * The price list behind the onboarding form's estimate: what each extra costs a month, before GST. Plan prices are NOT
 * here — they are on the plans themselves (Plans → edit → Website → Monthly price).
 */
export function PricingPage() {
  const q = usePricing();
  const plansQ = usePlans();
  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState("");
  const [confirm, setConfirm] = useState(false);
  const save = usePlatformMutation((p) => api.saveOnboardingPricing(p));

  useEffect(() => {
    if (q.data && !draft) {
      setDraft(q.data.pricing);
      setSaved(JSON.stringify(q.data.pricing));
    }
  }, [q.data, draft]);

  if (!draft) return <p style={muted}>{q.isError ? q.error.message : "Loading…"}</p>;
  const dirty = JSON.stringify(draft) !== saved;
  const plans = (plansQ.data?.plans ?? []).filter((p) => !p.archived);
  const steps = priceSteps(plans, draft);
  const num = (v) => Math.max(0, Math.round((Number(v) || 0) * 100) / 100);
  const setFeature = (key, v) => setDraft({ ...draft, features: { ...draft.features, [key]: num(v) } });
  const onSave = () => save.mutate(draft, { onSuccess: (r) => { setDraft(r.pricing); setSaved(JSON.stringify(r.pricing)); } });

  return (
    <>
      <PageHeader
        title="Price list"
        icon={<Calculator size={23} />}
        subtitle="What each extra costs a client a month (₹, before GST). The estimate on the onboarding form adds these to a plan's own price."
        action={<Link to="/platform/onboarding" style={{ textDecoration: "none" }}><Button type="button" variant="outline" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><ArrowLeft size={14} /> Onboarding</Button></Link>}
      />
      <Note>
        How the estimate works: a standard plan costs its own monthly price (set on the plan) plus these prices for anything the client asks for beyond it.
        The <strong>Custom</strong> plan starts from your dearest plan (which has every feature) and adds the price of each outlet and person beyond that
        plan's limits — so Custom always costs more than every standard plan.
      </Note>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start", marginTop: 14 }}>
        <div style={{ flex: "1 1 520px", display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <Card title="Features" subtitle="Per month, for a feature the plan doesn't include.">
            <div data-price-features style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px 18px" }}>
              {FEATURES.map((f) => (
                <Field key={f.key} label={f.label} style={{ marginBottom: 0 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={muted}>₹</span>
                    <TextInput type="number" min={0} value={draft.features[f.key] ?? 0} onChange={(e) => setFeature(f.key, e.target.value)} style={{ width: 110 }} aria-label={`${f.label} price`} />
                  </span>
                </Field>
              ))}
            </div>
          </Card>
          <Card title="Limits and tax">
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              <Field label="Each extra outlet (₹)" info="For every outlet beyond what the plan allows." style={{ marginBottom: 0 }}>
                <TextInput type="number" min={0} value={draft.extraOutlet} onChange={(e) => setDraft({ ...draft, extraOutlet: num(e.target.value) })} style={{ width: 120 }} aria-label="Each extra outlet price" />
              </Field>
              <Field label="Each extra person (₹)" info="For every person (the owner counts) beyond what the plan allows." style={{ marginBottom: 0 }}>
                <TextInput type="number" min={0} value={draft.extraPerson} onChange={(e) => setDraft({ ...draft, extraPerson: num(e.target.value) })} style={{ width: 120 }} aria-label="Each extra person price" />
              </Field>
              <Field label="Every 5 extra tables (₹)" info="Tables are only sold in fives (5, 10, 15 …), so this is the price of one block of 5 beyond what the plan allows." style={{ marginBottom: 0 }}>
                <TextInput type="number" min={0} value={draft.extraTables} onChange={(e) => setDraft({ ...draft, extraTables: num(e.target.value) })} style={{ width: 120 }} aria-label="Every five extra tables price" />
              </Field>
              <Field label="GST (%)" info="Added on top of every price shown." style={{ marginBottom: 0 }}>
                <TextInput type="number" min={0} max={40} step="0.5" value={draft.gstPct} onChange={(e) => setDraft({ ...draft, gstPct: Math.min(40, num(e.target.value)) })} style={{ width: 100 }} aria-label="GST percent" />
              </Field>
            </div>
          </Card>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Button type="button" onClick={onSave} disabled={!dirty || save.isPending} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Save size={14} /> {save.isPending ? "Saving…" : "Save the price list"}</Button>
            <Button type="button" variant="outline" onClick={() => setConfirm(true)} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><RotateCcw size={14} /> Back to the starting prices</Button>
            {!dirty && saved ? <span data-saved style={{ ...muted, fontSize: 13 }}>Saved</span> : <span style={{ ...muted, fontSize: 13 }}>Unsaved changes</span>}
          </div>
          {save.error ? <Toast kind="error">{save.error.message}</Toast> : null}
        </div>

        <aside style={{ flex: "0 0 340px", display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Your plans" subtitle="Their own monthly prices — set on each plan.">
            {plans.length === 0 ? <p style={muted}>No plans yet.</p> : (
              <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }} aria-label="Plan prices">
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.id}><td style={{ padding: "4px 0" }}>{p.name}</td><td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.custom ? "priced by this list" : p.marketing?.monthly ? `${rs(p.marketing.monthly)} / month` : <span style={{ color: "var(--tone-warning)" }}>no price set</span>}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
          <Card title="Do the prices add up?" subtitle="From one plan up to the next dearer one.">
            <div data-price-steps>
              {steps.length === 0 ? <p style={muted}>Needs two plans with a monthly price.</p> : steps.map((s) => (
                <div key={`${s.from}-${s.to}`} style={{ fontSize: 12.5, marginBottom: 10 }}>
                  <strong>{s.from} → {s.to}</strong>
                  <div style={muted}>
                    adds {s.features.length ? `${s.features.length} feature${s.features.length === 1 ? "" : "s"}` : "no features"}
                    {s.comparable ? `, ${s.outlets} outlet${s.outlets === 1 ? "" : "s"}${s.tables ? `, ${s.tables} table${s.tables === 1 ? "" : "s"}` : ""}, ${s.people} ${s.people === 1 ? "person" : "people"}` : ", a different limit"}
                  </div>
                  <div>This list charges {rs(s.rateCard)} · the plans differ by {rs(s.planDifference)}</div>
                  <div style={{ color: s.gap === 0 ? "var(--tone-success)" : "var(--tone-warning)" }} data-step-gap={s.gap}>
                    {!s.comparable ? "Can't compare (a limit is unlimited)." : s.gap === 0 ? "They agree." : s.gap > 0 ? `The plans are ${rs(s.gap)} dearer than this list says.` : `The plans are ${rs(-s.gap)} cheaper than this list says.`}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </aside>
      </div>

      {confirm ? (
        <Modal onClose={() => setConfirm(false)} width={440} ariaLabel="Back to the starting prices">
          <div style={{ padding: 22 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Go back to the starting prices?</h2>
            <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "var(--color-text-muted)" }}>The prices on this page are replaced by the starting ones. Nothing changes until you press Save.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button type="button" variant="outline" onClick={() => setConfirm(false)}>Keep my prices</Button>
              <Button type="button" onClick={() => { setDraft(resolvePricing({})); setConfirm(false); }}>Use the starting prices</Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
