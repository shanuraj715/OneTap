import { useState } from "react";
import { CARD_TEMPLATE_FAMILIES, EFFECT_IDS, EFFECT_PRESETS, FEATURE_KEYS, FEATURES, planPrices, QR_CARD_FAMILY_IDS } from "@onetap/config-schema";
import { Layers, Pencil, Plus } from "lucide-react";
import * as api from "../../lib/api";
import { usePlans, usePlatformMutation } from "../../lib/usePlatform";
import { Button, Card, Checkbox, Field, Modal, Note as Callout, PageHeader, Pill, TextInput, Toast } from "../../ui";
import { muted, row } from "./shared";

const EFFECTS = EFFECT_IDS.filter((id) => id !== "none");

const NEW_PLAN = {
  name: "",
  description: "",
  custom: false,
  limits: { maxUsers: 5, multiOutlet: false, maxOutlets: 1 },
  entitlements: { features: [...FEATURE_KEYS], effects: [...EFFECTS], qrCardFamilies: [...QR_CARD_FAMILY_IDS] },
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
                  {!p.limits.multiOutlet ? " (multi-outlet off)" : ""}
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
                  {p.entitlements.features.length}/{FEATURES.length} features · {p.entitlements.effects.filter((e) => e !== "none").length}/{EFFECTS.length} effects ·{" "}
                  {p.entitlements.qrCardFamilies.length}/{CARD_TEMPLATE_FAMILIES.length} card styles
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <Button variant="outline" onClick={() => setEditing(p)} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
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
    const list = draft.entitlements[k];
    setDraft({ ...draft, entitlements: { ...draft.entitlements, [k]: list.includes(item) ? list.filter((x) => x !== item) : [...list, item] } });
  };

  return (
    <Modal onClose={onClose} width={720} ariaLabel={draft.id ? `Edit ${draft.name}` : "New plan"}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined, { onSuccess: onClose });
        }}
        style={{ padding: 22, overflowY: "auto" }}
      >
        <h3 style={{ margin: "0 0 16px", fontFamily: "var(--font-heading)" }}>{draft.id ? `Edit ${plan.name}` : "New plan"}</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14 }}>
          <Field label="Name">
            <TextInput value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required maxLength={60} />
          </Field>
          <Field label="Description">
            <TextInput value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={300} />
          </Field>
        </div>

        <div style={{ marginTop: 18 }}>
          <Checkbox
            checked={Boolean(draft.custom)}
            onChange={(v) => setDraft({ ...draft, custom: v })}
            disabled={typeLocked}
            label="Custom plan — nothing included; I set each store's limits and features myself"
          />
          {typeLocked ? (
            <p style={{ ...muted, margin: "6px 0 0" }}>
              {plan.storeCount} store{plan.storeCount === 1 ? " is" : "s are"} on this plan, so it can't switch between custom and regular. Create a new plan instead.
            </p>
          ) : null}
        </div>

        {draft.custom ? (
          <div style={{ marginTop: 14 }}>
            <Callout>
              A store on this plan gets nothing until you set it up: open the store from Stores, set its people and outlets on <strong>Plan &amp; limits</strong>, and
              unlock what it bought on <strong>Features</strong> — features, visual effects and QR card styles. A store moved onto this plan keeps what it has today
              until you change it.
            </Callout>
          </div>
        ) : (
          <PlanContents draft={draft} setLimit={setLimit} toggle={toggle} />
        )}

        <Section title="On the website" hint="The Pricing page's card for this plan. Buying is never online — its button opens Contact.">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Checkbox checked={draft.marketing.show} onChange={(v) => setMarketing({ show: v })} label="Show this plan on the website's Pricing" />
            {draft.marketing.show ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 110px", gap: 12 }}>
                  <Field label="Monthly price (₹)" hint="Before GST. Empty = no number shown">
                    <TextInput
                      type="number"
                      min={0}
                      max={1000000}
                      value={draft.marketing.monthly || ""}
                      onChange={(e) => setMarketing({ monthly: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                      placeholder="999"
                    />
                  </Field>
                  <Field label="Yearly discount (%)" hint="When paid for the year. 0 = no yearly option">
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
                  <Field label="Order">
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
                  <Field label="Price as text" hint={draft.custom ? "Leave empty to show “Custom pricing”" : "Only used with no monthly price — e.g. “Custom”"}>
                    <TextInput value={draft.marketing.price} onChange={(e) => setMarketing({ price: e.target.value })} maxLength={30} placeholder="Custom" />
                  </Field>
                ) : null}
                <Field label="One-line pitch">
                  <TextInput value={draft.marketing.pitch} onChange={(e) => setMarketing({ pitch: e.target.value })} maxLength={140} placeholder="For a single café or quick-service counter." />
                </Field>
                <Checkbox checked={draft.marketing.highlight} onChange={(v) => setMarketing({ highlight: v })} label='Mark as "Most popular"' />
              </>
            ) : null}
          </div>
        </Section>

        {save.error ? <Toast kind="error">{save.error.message}</Toast> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
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

/** A regular plan's limits and what it unlocks. */
function PlanContents({ draft, setLimit, toggle }) {
  return (
    <>
      <Section title="Limits">
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-end" }}>
          <LimitInput label="People (owners included)" value={draft.limits.maxUsers} onChange={(v) => setLimit("maxUsers", v)} />
          <Checkbox checked={draft.limits.multiOutlet} onChange={(v) => setLimit("multiOutlet", v)} label="Multi-outlet" />
          {draft.limits.multiOutlet ? <LimitInput label="Outlets" value={draft.limits.maxOutlets} onChange={(v) => setLimit("maxOutlets", v)} /> : null}
        </div>
      </Section>

      <Section title="Features">
        <Grid>
          {FEATURES.map((f) => (
            <Checkbox key={f.key} checked={draft.entitlements.features.includes(f.key)} onChange={() => toggle("features", f.key)} label={f.label} />
          ))}
        </Grid>
      </Section>

      <Section title="Visual effects" hint="“None” is always available.">
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
    </>
  );
}

/** A number, or "Unlimited" (null). */
function LimitInput({ label, value, onChange }) {
  return (
    <Field label={label}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <TextInput
          type="number"
          min={1}
          value={value ?? ""}
          disabled={value === null}
          onChange={(e) => onChange(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
          style={{ width: 90 }}
        />
        <Checkbox checked={value === null} onChange={(v) => onChange(v ? null : 5)} label="Unlimited" />
      </div>
    </Field>
  );
}

function Section({ title, hint, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
        {title}
        {hint ? <span style={{ ...muted, fontWeight: 400, marginLeft: 8 }}>{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

const Grid = ({ children }) => <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 6 }}>{children}</div>;
