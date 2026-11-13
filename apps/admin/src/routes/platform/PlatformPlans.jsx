import { useState } from "react";
import { CARD_TEMPLATE_FAMILIES, EFFECT_IDS, EFFECT_PRESETS, FEATURE_KEYS, FEATURES, QR_CARD_FAMILY_IDS } from "@onetap/config-schema";
import { Layers, Pencil, Plus } from "lucide-react";
import * as api from "../../lib/api";
import { usePlans, usePlatformMutation } from "../../lib/usePlatform";
import { Button, Card, Checkbox, Field, Modal, PageHeader, Pill, TextInput, Toast } from "../../ui";
import { muted, row } from "./shared";

const EFFECTS = EFFECT_IDS.filter((id) => id !== "none");

const NEW_PLAN = {
  name: "",
  description: "",
  limits: { maxUsers: 5, multiOutlet: false, maxOutlets: 1 },
  entitlements: { features: [...FEATURE_KEYS], effects: [...EFFECTS], qrCardFamilies: [...QR_CARD_FAMILY_IDS] },
};

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
            action={p.archived ? <Pill tone="warn">Archived</Pill> : <Pill tone="ok">{p.storeCount} store{p.storeCount === 1 ? "" : "s"}</Pill>}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
              <div>
                <strong>{p.limits.maxUsers ?? "Unlimited"}</strong> people ·{" "}
                <strong>{p.limits.multiOutlet ? p.limits.maxOutlets ?? "Unlimited" : 1}</strong> outlet{p.limits.multiOutlet && p.limits.maxOutlets !== 1 ? "s" : ""}
                {!p.limits.multiOutlet ? " (multi-outlet off)" : ""}
              </div>
              <div style={muted}>
                {p.entitlements.features.length}/{FEATURES.length} features · {p.entitlements.effects.filter((e) => e !== "none").length}/{EFFECTS.length} effects ·{" "}
                {p.entitlements.qrCardFamilies.length}/{CARD_TEMPLATE_FAMILIES.length} card styles
              </div>
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
  const [draft, setDraft] = useState(() => structuredClone(plan));
  const save = usePlatformMutation(() => {
    const body = { name: draft.name, description: draft.description, limits: draft.limits, entitlements: draft.entitlements };
    return draft.id ? api.updatePlan(draft.id, body) : api.createPlan(body);
  });
  const setLimit = (k, v) => setDraft({ ...draft, limits: { ...draft.limits, [k]: v } });
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
