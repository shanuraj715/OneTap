import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Store } from "lucide-react";
import * as api from "../../lib/api";
import { usePlans, usePlatformMutation, usePlatformSettings, useStores } from "../../lib/usePlatform";
import { Button, Card, Field, Note, PageHeader, Select, TextInput, Toast } from "../../ui";
import { DisabledPill, muted, planLabel, row, StatusPill, usageText } from "./shared";
import { StoreActionsMenu, StoreDialogs } from "./StoreActions";

function slugify(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const EMPTY = {
  brandName: "",
  brandSlug: "",
  outletName: "",
  outletSlug: "",
  hostnames: "",
  subdomain: "",
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
  planId: "",
};

/** Every client store on the platform, and where a new one is onboarded. */
export function PlatformStores() {
  const stores = useStores();
  const plans = usePlans();
  const create = usePlatformMutation(api.createBrand);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [brandSlugTouched, setBrandSlugTouched] = useState(false);
  const [outletSlugTouched, setOutletSlugTouched] = useState(false);

  const brandSlug = brandSlugTouched ? form.brandSlug : slugify(form.brandName);
  const outletSlug = outletSlugTouched ? form.outletSlug : slugify(form.outletName);
  const activePlans = (plans.data?.plans ?? []).filter((p) => !p.archived);
  const selectedPlan = activePlans.find((p) => p.id === form.planId);
  const customPlan = Boolean(selectedPlan?.custom);
  // a store's TablePe address (acme.<base>) comes with every plan; an own domain only with plans that include it
  const base = usePlatformSettings().data?.settings.subdomainBase ?? "";
  const ownAllowed = !selectedPlan || selectedPlan.entitlements.features.includes("customDomain");
  const [subTouched, setSubTouched] = useState(false);
  const subdomain = subTouched ? form.subdomain : base ? slugify(form.brandName) : "";
  const navigate = useNavigate();
  const list = stores.data?.stores ?? [];
  // the "⋮" menu on a store opens one of these dialogs — kept here, not in the row, so it survives the row disappearing (a deleted store)
  const [dialog, setDialog] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    create.mutate(
      {
        brandName: form.brandName,
        brandSlug,
        outletName: form.outletName,
        outletSlug,
        hostnames: ownAllowed ? form.hostnames.split(",").map((h) => h.trim()).filter(Boolean) : [],
        subdomain: base && subdomain ? subdomain : undefined,
        ownerName: form.ownerName,
        ownerEmail: form.ownerEmail,
        ownerPassword: form.ownerPassword,
        planId: form.planId || null,
      },
      {
        onSuccess: (result) => {
          setForm(EMPTY);
          setBrandSlugTouched(false);
          setOutletSlugTouched(false);
          setSubTouched(false);
          setAdding(false);
          // a custom-plan store has nothing yet — go straight to setting it up
          const id = result?.brand?._id;
          if (customPlan && id) navigate(`/platform/stores/${id}`);
        },
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Stores"
        icon={<Store size={23} />}
        subtitle="Your clients — their plan, limits, owners and outlets."
        action={
          <Button onClick={() => setAdding((a) => !a)} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <Plus size={14} /> Create store
          </Button>
        }
      />

      {adding ? (
        <Card title="Create a store" subtitle="The store, its first outlet and its owner's login — in one step.">
          <form onSubmit={submit}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <Field label="Store name" info="The restaurant's name across every location it runs.">
                <TextInput value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} required maxLength={80} />
              </Field>
              <Field label="Store slug" info="A short identifier for this store, used internally.">
                <TextInput
                  value={brandSlug}
                  onChange={(e) => {
                    setBrandSlugTouched(true);
                    setForm({ ...form, brandSlug: slugify(e.target.value) });
                  }}
                  required
                  maxLength={63}
                />
              </Field>
              <Field label="Plan" info="What the store has bought — its limits and unlocked features. Leave on “No plan” for an unlimited store.">
                <Select value={form.planId} onChange={(e) => setForm({ ...form, planId: e.target.value })}>
                  <option value="">No plan — unlimited</option>
                  {activePlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.custom && !/custom/i.test(p.name) ? " (custom)" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="First outlet's name" info="Its first physical location — e.g. the neighbourhood or mall it's in.">
                <TextInput value={form.outletName} onChange={(e) => setForm({ ...form, outletName: e.target.value })} required maxLength={80} />
              </Field>
              <Field label="Outlet URL slug" info="Becomes part of the outlet's web address, e.g. yourdomain.com/laxmi-nagar.">
                <TextInput
                  value={outletSlug}
                  onChange={(e) => {
                    setOutletSlugTouched(true);
                    setForm({ ...form, outletSlug: slugify(e.target.value) });
                  }}
                  required
                  maxLength={63}
                />
              </Field>
              {base ? (
                <Field label="TablePe address" info={`A free address on ${base} — the store opens on ${subdomain || "name"}.${base}. Set up instantly, nothing to install on the server.`}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <TextInput
                      value={subdomain}
                      onChange={(e) => {
                        setSubTouched(true);
                        setForm({ ...form, subdomain: slugify(e.target.value) });
                      }}
                      maxLength={40}
                      required={!ownAllowed || !form.hostnames.trim()}
                      style={{ minWidth: 0, flex: 1 }}
                    />
                    <span style={{ ...muted, whiteSpace: "nowrap" }}>.{base}</span>
                  </div>
                </Field>
              ) : null}
              {ownAllowed ? (
                <Field
                  label={base ? "Own domain (optional)" : "Domain(s)"}
                  info="Comma-separated hostname(s) the storefront is served on, e.g. yourdomain.com. Every outlet added later shares these. Needs DNS and a certificate set up on the server."
                >
                  <TextInput
                    value={form.hostnames}
                    onChange={(e) => setForm({ ...form, hostnames: e.target.value })}
                    required={!base}
                    placeholder="yourdomain.com"
                  />
                </Field>
              ) : (
                <Field label="Own domain" info="Not included in this plan — the store gets a TablePe address. Unlock “Own domain name” on its Features tab later if it buys one.">
                  <TextInput value="Not included in this plan" disabled />
                </Field>
              )}
              <Field label="Owner name">
                <TextInput value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} required />
              </Field>
              <Field label="Owner email" info="Their sign-in for the store dashboard.">
                <TextInput type="email" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} required />
              </Field>
              <Field label="Owner password" hint="At least 8 characters" info="Share it with them directly.">
                <TextInput type="password" value={form.ownerPassword} onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })} required minLength={8} />
              </Field>
            </div>
            {customPlan ? (
              <div style={{ margin: "14px 0" }}>
                <Note>
                  Custom plan: the store starts with just its owner, one outlet and nothing unlocked. After creating it you'll land on its page to set its limits and
                  unlock its features.
                </Note>
              </div>
            ) : null}
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : customPlan ? "Create store and set it up" : "Create store"}
            </Button>
            {create.error ? <Toast kind="error">{create.error.message}</Toast> : null}
          </form>
        </Card>
      ) : null}

      <Card title={`All stores — ${list.length}`}>
        {stores.isLoading ? (
          <p style={muted}>Loading…</p>
        ) : list.length === 0 ? (
          <p style={muted}>No stores yet — create the first one.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {list.map((s) => (
              // The row is a link to the store; the "⋮" button sits over its right-hand padding, beside the link
              // rather than inside it (a button inside a link is invalid, and would open the store as well).
              <div key={s.id} style={{ position: "relative" }}>
                <Link to={`/platform/stores/${s.id}`} className="ot-press" style={{ ...row, paddingRight: 58, textDecoration: "none", color: "inherit" }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                    <div style={muted}>{s.ownerEmail}</div>
                  </div>
                  <div style={{ minWidth: 130 }}>
                    <div style={{ fontSize: 12, ...muted }}>Plan</div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{planLabel(s.plan)}</div>
                  </div>
                  <Meter label="People" used={s.usage.users} max={s.max.users} />
                  <Meter label="Outlets" used={s.usage.outlets} max={s.max.outlets} />
                  {/* a fixed width, so a longer pill ("Disabled Nov 15, 2026") doesn't push this row's columns out of line with the others */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end", width: 176, flexShrink: 0 }}>
                    {s.disabled ? <DisabledPill store={s} withDate /> : <StatusPill store={s} />}
                    {s.blocked.outlets + s.blocked.people > 0 ? (
                      <span style={{ ...muted, fontSize: 11.5 }}>{s.blocked.outlets + s.blocked.people} blocked</span>
                    ) : null}
                  </div>
                </Link>
                <div style={{ position: "absolute", right: 12, top: 11 }}>
                  <StoreActionsMenu store={s} onChoose={(kind) => setDialog({ kind, store: s })} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <StoreDialogs dialog={dialog} setDialog={setDialog} />
    </>
  );
}

function Meter({ label, used, max }) {
  const over = max !== null && used > max;
  return (
    <div style={{ minWidth: 80 }}>
      <div style={{ fontSize: 12, ...muted }}>{label}</div>
      <div style={{ fontWeight: 600, fontSize: 13, color: over ? "var(--tone-danger)" : "var(--color-text)", fontVariantNumeric: "tabular-nums" }}>
        {usageText(used, max)}
      </div>
    </div>
  );
}
