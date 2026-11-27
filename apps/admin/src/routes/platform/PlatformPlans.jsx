import { useEffect, useState } from "react";
import { CARD_TEMPLATE_FAMILIES, EFFECT_IDS, EFFECT_PRESETS, FEATURE_KEYS, featureProblems, FEATURES, planPrices, QR_CARD_FAMILY_IDS, TABLE_STEP } from "@rasoipulse/config-schema";
import { Layers, Pencil, Plus } from "lucide-react";
import * as api from "../../lib/api";
import { useMedia } from "../../lib/useMedia";
import { usePlans, usePlatformMutation } from "../../lib/usePlatform";
import { Button, Card, Checkbox, Field, Modal, Note as Callout, PageHeader, Pill, TextInput, Toast } from "../../ui";
import { muted, row } from "./shared";

const EFFECTS = EFFECT_IDS.filter((id) => id !== "none");

const NEW_PLAN = {
  name: "",
  description: "",
  custom: false,
  limits: { maxUsers: 5, multiOutlet: false, maxOutlets: 1, maxTables: TABLE_STEP },
  entitlements: { allFeatures: false, features: [...FEATURE_KEYS], effects: [...EFFECTS], qrCardFamilies: [...QR_CARD_FAMILY_IDS] },
  marketing: { show: false, monthly: 0, yearlyDiscount: 0, price: "", period: "/month", pitch: "", highlight: false, order: 50 },
};

const rupees = (n) => `₹${new Intl.NumberFormat("en-IN").format(n)}`;
/** "₹999/month · ₹9,590/year at 20% off", as the website shows it. */
function priceSummary(m) {
  const { monthly, yearly } = planPrices(m);
  if (!monthly) return m.price || "no price";
  return `${rupees(monthly)}/month${yearly ? ` · ${rupees(yearly.total)}/year at ${yearly.discount}% off` : ""}`;
}

/** The plans stores can be put on — limits and what each one unlocks. */
export function PlatformPlans() {
  const plans = usePlans();
  const [editing, setEditing] = useState(null);
  const archive = usePlatformMutation(({ id, archived }) => api.updatePlan(id, { archived }));
  const list = plans.data?.plans ?? [];

  return (
    <>
      <PageHeader
        title="Plans"
        icon={<Layers size={23} />}
        subtitle="Limits and unlocked features for each plan. Changing a plan updates every store on it."
        action={
          <Button onClick={() => setEditing({ ...NEW_PLAN })} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <Plus size={14} /> New plan
          </Button>
        }
      />

      <Note />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {list.map((p) => (
          <Card
            key={p.id}
            title={p.name}
            subtitle={p.description || undefined}
            action={
              <span style={{ display: "flex", gap: 6 }}>
                {p.custom ? <Pill>Custom</Pill> : null}
                {p.archived ? <Pill tone="warn">Archived</Pill> : <Pill tone="ok">{p.storeCount} store{p.storeCount === 1 ? "" : "s"}</Pill>}
              </span>
            }
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              {p.custom ? (
                <div>
                  <strong>Nothing included</strong> — you set each store's limits and features on its page
                </div>
              ) : (
                <div>
                  <strong>{p.limits.maxUsers ?? "Unlimited"}</strong> people ·{" "}
                  <strong>{p.limits.multiOutlet ? p.limits.maxOutlets ?? "Unlimited" : 1}</strong> outlet{p.limits.multiOutlet && p.limits.maxOutlets !== 1 ? "s" : ""}
                  {!p.limits.multiOutlet ? " (multi-outlet off)" : ""} · <strong>{p.limits.maxTables ?? "Unlimited"}</strong> tables
                </div>
              )}
              {p.marketing?.show ? (
                <div style={{ fontSize: 12.5 }}>
                  On the website: <strong>{priceSummary(p.marketing)}</strong>
                  {p.marketing.highlight ? " · most popular" : ""}
                </div>
              ) : (
                <div style={muted}>Not on the website</div>
              )}
              {p.custom ? null : (
                <div style={muted}>
                  {p.entitlements.allFeatures ? "Every feature, and any added later" : `${p.entitlements.features.length}/${FEATURES.length} features`} · {p.entitlements.effects.filter((e) => e !== "none").length}/{EFFECTS.length} effects ·{" "}
                  {p.entitlements.qrCardFamilies.length}/{CARD_TEMPLATE_FAMILIES.length} card styles
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <Button variant="outline" data-testid={`plan-edit-${p.name}`} onClick={() => setEditing(p)} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <Pencil size={13} /> Edit
              </Button>
              <Button variant="outline" disabled={archive.isPending} onClick={() => archive.mutate({ id: p.id, archived: !p.archived })}>
                {p.archived ? "Restore" : "Archive"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
      {list.length === 0 && !plans.isLoading ? (
        <Card>
          <p style={muted}>No plans yet. Stores without a plan are unlimited, with everything unlocked.</p>
        </Card>
      ) : null}

      {editing ? <PlanModal plan={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function Note() {
  return (
    <p style={{ ...muted, margin: "0 0 14px" }}>
      Archived plans stay on the stores already using them but can't be chosen for new ones.
    </p>
  );
}

function PlanModal({ plan, onClose }) {
  const wide = useMedia("(min-width: 1200px)");
  const [draft, setDraft] = useState(() => {
    const marketing = { ...NEW_PLAN.marketing, ...(plan.marketing ?? {}) };
    // a price typed as text before there was a number ("₹999") is brought across, so saving makes it a real one
    return { ...structuredClone(plan), marketing: { ...marketing, monthly: marketing.monthly || planPrices(marketing).monthly } };
  });
  const save = usePlatformMutation(() => {
    const body = { name: draft.name, description: draft.description, custom: draft.custom, limits: draft.limits, entitlements: draft.entitlements, marketing: draft.marketing };
    return draft.id ? api.updatePlan(draft.id, body) : api.createPlan(body);
  });
  const setLimit = (k, v) => setDraft({ ...draft, limits: { ...draft.limits, [k]: v } });
  // switching a plan that stores use between custom and regular would change what all of them get at once
  const typeLocked = Boolean(draft.id && plan.storeCount);
  const setMarketing = (patch) => setDraft({ ...draft, marketing: { ...draft.marketing, ...patch } });
  const toggle = (k, item) => {
    if (k === "features" && draft.entitlements.allFeatures) return; // the list is "everything" while the switch is on
    const list = draft.entitlements[k];
    setDraft({ ...draft, entitlements: { ...draft.entitlements, [k]: list.includes(item) ? list.filter((x) => x !== item) : [...list, item] } });
  };

  return (
    // wide, with the sections in columns side by side, so a normal screen shows the whole plan without scrolling
    <Modal onClose={onClose} width={1360} ariaLabel={draft.id ? `Edit ${draft.name}` : "New plan"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined, { onSuccess: onClose });
        }}
        data-testid="plan-form"
        style={{ padding: "20px 24px 0", overflowY: "auto" }}
      >
        <h3 style={{ margin: "0 0 2px", fontFamily: "var(--font-heading)", fontSize: 19 }}>{draft.id ? `Edit ${plan.name}` : "New plan"}</h3>
        <p style={{ ...muted, margin: "0 0 14px", fontSize: 13 }}>What a store on this plan can have: its limits, its features and what the website shows for it.</p>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 1fr) minmax(240px, 2fr) auto", gap: 14, alignItems: "end" }}>
          <Field label="Name" style={{ marginBottom: 0 }}>
            <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required maxLength={60} />
          </Field>
          <Field label="Description" style={{ marginBottom: 0 }}>
            <TextInput value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={300} />
          </Field>
          <div style={{ paddingBottom: 6 }}>
            <Checkbox
              checked={Boolean(draft.custom)}
              onChange={(v) => setDraft({ ...draft, custom: v })}
              disabled={typeLocked}
              label="Custom plan — I set each store's limits and features myself"
            />
          </div>
        </div>
        {typeLocked ? (
          <p style={{ ...muted, margin: "6px 0 0" }}>
            {plan.storeCount} store{plan.storeCount === 1 ? " is" : "s are"} on this plan, so it can't switch between custom and regular. Create a new plan instead.
          </p>
        ) : null}

        {draft.custom ? null : <PlanLimits draft={draft} setLimit={setLimit} />}

        <div style={{ display: "grid", gridTemplateColumns: wide ? (draft.custom ? "1fr 1fr" : "1.45fr 1fr 1fr") : "repeat(auto-fit, minmax(340px, 1fr))", gap: "0 32px", alignItems: "start" }}>
          {draft.custom ? (
            <div style={{ marginTop: 14 }}>
              <Callout>
                A store on this plan gets nothing until you set it up: open the store from Stores, set its people, outlets and tables on <strong>Plan &amp; limits</strong>, and
                unlock what it bought on <strong>Features</strong> — features, visual effects and QR card styles. A store moved onto this plan keeps what it has today
                until you change it.
              </Callout>
            </div>
          ) : (
            <>
              <PlanFeatures draft={draft} setDraft={setDraft} toggle={toggle} />
              <PlanLooks draft={draft} toggle={toggle} />
            </>
          )}

          <Section first title="On the website" hint="The Pricing page's card for this plan. Buying is never online — its button opens Contact.">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Checkbox checked={draft.marketing.show} onChange={(v) => setMarketing({ show: v })} label="Show this plan on the website's Pricing" />
              {draft.marketing.show ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px", gap: 12, alignItems: "start" }}>
                    <Field label="Monthly price (₹)" hint="Before GST. Empty = no number" style={{ marginBottom: 0 }}>
                      <TextInput
                        type="number"
                        min={0}
                        max={1000000}
                        value={draft.marketing.monthly || ""}
                        onChange={(e) => setMarketing({ monthly: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                        placeholder="999"
                      />
                    </Field>
                    <Field label="Yearly discount (%)" hint="0 = no yearly option" style={{ marginBottom: 0 }}>
                      <TextInput
                        type="number"
                        min={0}
                        max={90}
                        value={draft.marketing.yearlyDiscount || ""}
                        onChange={(e) => setMarketing({ yearlyDiscount: Math.max(0, Math.min(90, Math.floor(Number(e.target.value) || 0))) })}
                        placeholder="20"
                        disabled={!draft.marketing.monthly}
                      />
                    </Field>
                    <Field label="Order" style={{ marginBottom: 0 }}>
                      <TextInput type="number" min={0} max={99} value={draft.marketing.order} onChange={(e) => setMarketing({ order: Math.max(0, Math.min(99, Number(e.target.value) || 0)) })} />
                    </Field>
                  </div>
                  <div style={{ fontSize: 13, ...muted }}>
                    {draft.marketing.monthly ? (
                      <>
                        Visitors will see <strong>{priceSummary(draft.marketing)}</strong>
                        {planPrices(draft.marketing).yearly ? ` — about ${rupees(planPrices(draft.marketing).yearly.perMonth)} a month, saving ${rupees(planPrices(draft.marketing).yearly.saves)} a year.` : "."}
                      </>
                    ) : (
                      "No monthly price, so the card shows the text below — or “Price on request”."
                    )}
                  </div>
                  {!draft.marketing.monthly ? (
                    <Field label="Price as text" hint={draft.custom ? "Leave empty to show “Custom pricing”" : "Only used with no monthly price — e.g. “Custom”"} style={{ marginBottom: 0 }}>
                      <TextInput value={draft.marketing.price} onChange={(e) => setMarketing({ price: e.target.value })} maxLength={30} placeholder="Custom" />
                    </Field>
                  ) : null}
                  <Field label="One-line pitch" style={{ marginBottom: 0 }}>
                    <TextInput value={draft.marketing.pitch} onChange={(e) => setMarketing({ pitch: e.target.value })} maxLength={140} placeholder="For a single café or quick-service counter." />
                  </Field>
                  <Checkbox checked={draft.marketing.highlight} onChange={(v) => setMarketing({ highlight: v })} label='Mark as "Most popular"' />
                </>
              ) : null}
            </div>
          </Section>
        </div>

        {save.error ? <Toast kind="error">{save.error.message}</Toast> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18, padding: "12px 24px", position: "sticky", bottom: 0, margin: "18px -24px 0", background: "var(--color-bg)", borderTop: "1px solid var(--color-border)" }}>
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending || !draft.name.trim()}>
            {save.isPending ? "Saving…" : "Save plan"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** The plan's limits, side by side in one row. */
function PlanLimits({ draft, setLimit }) {
  return (
    <Section first title="Limits" hint="Tables are sold in fives — 5, 10, 15 … — and counted for the whole store, all outlets together.">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "10px 24px", alignItems: "end" }}>
        <LimitInput label="People (owners included)" value={draft.limits.maxUsers} onChange={(v) => setLimit("maxUsers", v)} testId="plan-limit-people" />
        <LimitInput label="Tables" value={draft.limits.maxTables ?? null} onChange={(v) => setLimit("maxTables", v)} step={TABLE_STEP} testId="plan-limit-tables" />
        <div style={{ paddingBottom: 8 }}>
          <Checkbox checked={draft.limits.multiOutlet} onChange={(v) => setLimit("multiOutlet", v)} label="Multi-outlet" info="Off: a store on this plan can have one outlet only. On: it can have several, up to the number beside it." />
        </div>
        {draft.limits.multiOutlet ? <LimitInput label="Outlets" value={draft.limits.maxOutlets} onChange={(v) => setLimit("maxOutlets", v)} testId="plan-limit-outlets" /> : <div />}
      </div>
    </Section>
  );
}

/** What the plan unlocks: its features. */
function PlanFeatures({ draft, setDraft, toggle }) {
  const allFeatures = Boolean(draft.entitlements.allFeatures);
  return (
    <Section first title="Features">
      <div style={{ marginBottom: 10 }}>
        <Checkbox
          checked={allFeatures}
          onChange={(v) => setDraft({ ...draft, entitlements: { ...draft.entitlements, allFeatures: v, features: v ? [...FEATURE_KEYS] : draft.entitlements.features } })}
          label="Include every feature — also the ones we add later"
          info="A plan's own list is a snapshot: a feature built after the plan was made never reaches it. Turn this on for the top plan and every new feature arrives by itself. Individual stores can still have one locked."
        />
      </div>
      <Grid>
        {FEATURES.map((f) => (
          <Checkbox key={f.key} checked={allFeatures || draft.entitlements.features.includes(f.key)} disabled={allFeatures} onChange={() => toggle("features", f.key)} label={f.label} />
        ))}
      </Grid>
      {featureProblems(allFeatures ? FEATURE_KEYS : draft.entitlements.features).map((p) => (
        <div key={`${p.feature}-${p.needs}`} role="alert" data-testid="plan-feature-warning" style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, fontSize: 13, background: "var(--tone-warning-wash)", color: "var(--tone-warning)" }}>
          {p.text}
        </div>
      ))}
    </Section>
  );
}

/** The storefront looks the plan allows: visual effects and QR card styles. */
function PlanLooks({ draft, toggle }) {
  return (
    <div>
      <Section first title="Visual effects" hint="“None” is always available.">
        <Grid>
          {EFFECTS.map((id) => (
            <Checkbox key={id} checked={draft.entitlements.effects.includes(id)} onChange={() => toggle("effects", id)} label={EFFECT_PRESETS[id].label} />
          ))}
        </Grid>
      </Section>
      <Section title="QR card styles">
        <Grid>
          {CARD_TEMPLATE_FAMILIES.map((f) => (
            <Checkbox key={f.id} checked={draft.entitlements.qrCardFamilies.includes(f.id)} onChange={() => toggle("qrCardFamilies", f.id)} label={f.label} />
          ))}
        </Grid>
      </Section>
    </div>
  );
}

/** A number, or "Unlimited" (null). With a `step` (tables: 5) the number goes up by that much and a typed number is rounded UP to the next step. */
function LimitInput({ label, value, onChange, step = 1, testId }) {
  const min = step > 1 ? step : 1;
  const snap = (n) => Math.max(min, step > 1 ? Math.ceil((Number(n) || 0) / step) * step : Math.floor(Number(n) || 1));
  // a stepped number is held as typed ("1", "12") and rounded when the box is left; a plain one follows every keystroke
  const [typed, setTyped] = useState(null);
  useEffect(() => setTyped(null), [value]);
  const commit = () => {
    if (typed === null) return;
    setTyped(null);
    onChange(snap(typed));
  };
  return (
    <Field label={label} style={{ marginBottom: 0 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <TextInput
          type="number"
          min={min}
          step={step}
          value={typed ?? value ?? ""}
          disabled={value === null}
          data-testid={testId}
          aria-label={label}
          onChange={(e) => (step > 1 ? setTyped(e.target.value) : onChange(snap(e.target.value)))}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && typed !== null) {
              e.preventDefault(); // (Enter would save the whole plan)
              commit();
            }
          }}
          style={{ width: 96 }}
        />
        <Checkbox checked={value === null} onChange={(v) => onChange(v ? null : Math.max(min, 5))} label="Unlimited" />
      </div>
    </Field>
  );
}

function Section({ title, hint, children, first = false }) {
  return (
    <div style={first ? { marginTop: 12 } : { marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: hint ? 2 : 10 }}>{title}</div>
      {hint ? <p style={{ ...muted, fontSize: 12.5, margin: "0 0 10px" }}>{hint}</p> : null}
      {children}
    </div>
  );
}

const Grid = ({ children }) => <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))", gap: "6px 10px" }}>{children}</div>;
