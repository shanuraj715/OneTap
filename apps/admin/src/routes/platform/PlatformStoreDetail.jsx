import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CARD_TEMPLATE_FAMILIES, EFFECT_IDS, EFFECT_PRESETS, FEATURES } from "@onetap/config-schema";
import { ArrowLeft, ExternalLink, Globe, Save, Store, Trash2 } from "lucide-react";
import * as api from "../../lib/api";
import { useOpenStore } from "../../lib/useOutlet";
import { usePlans, usePlatformMutation, useStore } from "../../lib/usePlatform";
import { Button, Card, Field, Note, PageHeader, Pill, Select, Tabs, TextInput, Toast } from "../../ui";
import { fmtDate, muted, planLabel, row, StatusPill, usageText } from "./shared";

const TABS = [
  { id: "plan", label: "Plan & limits" },
  { id: "features", label: "Features" },
  { id: "owners", label: "Owners" },
  { id: "outlets", label: "Outlets" },
  { id: "domains", label: "Domains" },
  { id: "people", label: "People" },
  { id: "appearance", label: "Appearance" },
];

const EFFECT_ITEMS = EFFECT_IDS.filter((id) => id !== "none").map((id) => ({ key: id, label: EFFECT_PRESETS[id].label }));
const QR_ITEMS = CARD_TEMPLATE_FAMILIES.map((f) => ({ key: f.id, label: f.label, description: f.hint }));

const emptyAdjust = () => ({ features: { unlock: [], lock: [] }, effects: { unlock: [], lock: [] }, qrCardFamilies: { unlock: [], lock: [] } });

/** One client store: its plan and overrides, what's unlocked, owners, outlets, people, and appearance. */
export function PlatformStoreDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { openStore } = useOpenStore();
  const q = useStore(id);
  const plans = usePlans();
  const store = q.data?.store;
  const [tab, setTab] = useState("plan");

  // The plan + overrides are edited as one draft, saved together.
  const [draft, setDraft] = useState(null);
  useEffect(() => {
    if (store) {
      setDraft({
        planId: store.plan?.id ?? "",
        limits: { ...store.overrides.limits },
        entitlements: { ...emptyAdjust(), ...store.overrides.entitlements },
      });
    }
    // Re-sync only when a different store loads or after a save — not on every refetch mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id, q.dataUpdatedAt]);
  const save = usePlatformMutation(() =>
    api.setStorePlan(id, { planId: draft.planId || null, overrides: { limits: draft.limits, entitlements: draft.entitlements } }),
  );

  const allPlans = plans.data?.plans ?? [];
  const selectedPlan = allPlans.find((p) => p.id === draft?.planId) ?? null;

  const open = (path = "/") => {
    openStore(id);
    navigate(path);
  };

  if (!store || !draft) {
    return (
      <>
        <PageHeader title="Store" />
        <Card>{q.isError ? q.error.message : "Loading…"}</Card>
      </>
    );
  }

  const dirty =
    (draft.planId || null) !== (store.plan?.id ?? null) ||
    JSON.stringify(draft.limits) !== JSON.stringify(store.overrides.limits) ||
    JSON.stringify(draft.entitlements) !== JSON.stringify({ ...emptyAdjust(), ...store.overrides.entitlements });

  return (
    <>
      <PageHeader
        title={store.name}
        icon={<Store size={23} />}
        subtitle={`${planLabel(store.plan)} · created ${fmtDate(store.createdAt)}`}
        action={
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link to="/platform/stores" style={{ textDecoration: "none" }}>
              <Button variant="outline" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <ArrowLeft size={14} /> All stores
              </Button>
            </Link>
            <Button onClick={() => open("/")} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <ExternalLink size={14} /> Open store dashboard
            </Button>
          </span>
        }
      />

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <StatusPill store={store} />
        <Pill>People {usageText(store.usage.users, store.max.users)}</Pill>
        <Pill>Outlets {usageText(store.usage.outlets, store.max.outlets)}</Pill>
        {store.blocked.outlets + store.blocked.people > 0 ? (
          <Pill tone="warn">
            {store.blocked.outlets} outlet{store.blocked.outlets === 1 ? "" : "s"}, {store.blocked.people} {store.blocked.people === 1 ? "person" : "people"} blocked
          </Pill>
        ) : null}
      </div>

      <Tabs value={tab} onChange={setTab} tabs={TABS} />

      {(tab === "plan" || tab === "features") && dirty ? (
        <div style={saveBar}>
          <span>Unsaved changes to this store's plan.</span>
          <Button onClick={() => save.mutate()} disabled={save.isPending} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <Save size={14} /> {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      ) : null}
      {save.error ? <Toast kind="error">{save.error.message}</Toast> : null}

      {tab === "plan" ? <PlanTab store={store} draft={draft} setDraft={setDraft} plans={allPlans} selectedPlan={selectedPlan} /> : null}
      {tab === "features" ? <FeaturesTab draft={draft} setDraft={setDraft} selectedPlan={selectedPlan} /> : null}
      {tab === "owners" ? <OwnersTab store={store} /> : null}
      {tab === "outlets" ? <OutletsTab store={store} /> : null}
      {tab === "domains" ? <DomainsTab store={store} /> : null}
      {tab === "people" ? <PeopleTab store={store} /> : null}
      {tab === "appearance" ? <AppearanceTab open={open} /> : null}
    </>
  );
}

/* ---------------------------------------------------------------- plan tab */

function PlanTab({ store, draft, setDraft, plans, selectedPlan }) {
  const base = selectedPlan?.limits ?? { maxUsers: null, multiOutlet: true, maxOutlets: null };
  const setLimit = (key, value) => setDraft({ ...draft, limits: { ...draft.limits, [key]: value } });
  const unset = (key) => {
    const { [key]: _drop, ...rest } = draft.limits;
    setDraft({ ...draft, limits: rest });
  };
  const choosable = plans.filter((p) => !p.archived || p.id === draft.planId);
  const custom = Boolean(selectedPlan?.custom);

  const choosePlan = (planId) => {
    const next = plans.find((p) => p.id === planId) ?? null;
    if (next?.custom && !custom) {
      // Onto a custom plan: start from what the store has today — its current
      // limits, and everything it can use now unlocked — then trim from there.
      const keep = (list) => ({ unlock: list.filter((k) => k !== "none"), lock: [] });
      setDraft({
        planId,
        limits: { maxUsers: store.limits.maxUsers, multiOutlet: store.limits.multiOutlet, maxOutlets: store.limits.maxOutlets },
        entitlements: {
          features: keep(store.entitlements.features),
          effects: keep(store.entitlements.effects),
          qrCardFamilies: keep(store.entitlements.qrCardFamilies),
        },
      });
    } else if (!next?.custom && custom) {
      // Off a custom plan: the new plan brings its own limits and features.
      setDraft({ planId, limits: {}, entitlements: emptyAdjust() });
    } else {
      setDraft({ ...draft, planId });
    }
  };

  return (
    <>
      <Card title="Plan" subtitle="What this store has bought. Payment is handled outside the app.">
        <Field label="Plan" style={{ maxWidth: 360 }}>
          <Select value={draft.planId} onChange={(e) => choosePlan(e.target.value)}>
            <option value="">No plan — unlimited, everything unlocked</option>
            {choosable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.custom && !/custom/i.test(p.name) ? " (custom)" : ""}
                {p.archived ? " (archived)" : ""}
              </option>
            ))}
          </Select>
        </Field>
        {custom ? (
          <div style={{ marginTop: 12 }}>
            <Note>
              Custom plan: nothing comes from the plan. This store gets exactly the limits below and what you unlock on the <strong>Features</strong> tab.
              {selectedPlan.id !== store.plan?.id ? " To start with, it keeps what it has today — trim it before saving." : ""}
            </Note>
          </div>
        ) : null}
      </Card>

      <Card
        title="Limits for this store"
        subtitle={custom ? "Set by you for this store — the custom plan has no limits of its own." : "Leave on “From plan” to follow the plan; change one to override it for this store only."}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <NumberLimit
            label="People (owners included)"
            custom={custom}
            base={base.maxUsers}
            value={draft.limits.maxUsers}
            onSet={(v) => setLimit("maxUsers", v)}
            onInherit={() => unset("maxUsers")}
          />
          <Field label="Multi-outlet">
            {custom ? (
              <Select value={(draft.limits.multiOutlet ?? base.multiOutlet) ? "on" : "off"} onChange={(e) => setLimit("multiOutlet", e.target.value === "on")}>
                <option value="on">On</option>
                <option value="off">Off (1 outlet)</option>
              </Select>
            ) : (
              <Select
                value={draft.limits.multiOutlet === undefined ? "plan" : draft.limits.multiOutlet ? "on" : "off"}
                onChange={(e) => (e.target.value === "plan" ? unset("multiOutlet") : setLimit("multiOutlet", e.target.value === "on"))}
              >
                <option value="plan">From plan — {base.multiOutlet ? "on" : "off"}</option>
                <option value="on">On for this store</option>
                <option value="off">Off for this store (1 outlet)</option>
              </Select>
            )}
          </Field>
          <NumberLimit
            label="Outlets"
            custom={custom}
            base={base.maxOutlets}
            value={draft.limits.maxOutlets}
            onSet={(v) => setLimit("maxOutlets", v)}
            onInherit={() => unset("maxOutlets")}
          />
        </div>
      </Card>

      <Card title="Usage">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <Pill>People {usageText(store.usage.users, store.max.users)}</Pill>
          <Pill>Outlets {usageText(store.usage.outlets, store.max.outlets)}</Pill>
        </div>
        {store.grace.over ? (
          <Note>
            {store.grace.ended
              ? `This store went over its limits on ${fmtDate(store.grace.since)} and its ${store.grace.days}-day grace period ended on ${fmtDate(store.grace.until)}. Choose what to block on the Outlets and People tabs — or raise its limits.`
              : `Over its limits since ${fmtDate(store.grace.since)}. Everything keeps working until ${fmtDate(store.grace.until)}; after that you'll be asked to choose what to block.`}
          </Note>
        ) : (
          <p style={muted}>Within its plan. Blocked outlets and people don't count toward the limits.</p>
        )}
      </Card>
    </>
  );
}

/** A limit: from the plan, a number, or unlimited. On a custom plan there's no "from the plan" — it's always the store's own. */
function NumberLimit({ label, base, value, onSet, onInherit, custom = false }) {
  if (custom && value === undefined) value = base;
  const mode = value === undefined ? "plan" : value === null ? "unlimited" : "custom";
  return (
    <Field label={label}>
      <div style={{ display: "flex", gap: 8 }}>
        <Select
          value={mode}
          onChange={(e) => {
            const m = e.target.value;
            if (m === "plan") onInherit();
            else if (m === "unlimited") onSet(null);
            else onSet(base ?? 5);
          }}
          style={{ flex: 1 }}
        >
          {custom ? null : <option value="plan">From plan — {base ?? "unlimited"}</option>}
          <option value="custom">{custom ? "Number" : "Custom number"}</option>
          <option value="unlimited">Unlimited</option>
        </Select>
        {mode === "custom" ? (
          <TextInput
            type="number"
            min={1}
            value={value}
            onChange={(e) => onSet(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            style={{ width: 90 }}
          />
        ) : null}
      </div>
    </Field>
  );
}

/* ------------------------------------------------------------ features tab */

function FeaturesTab({ draft, setDraft, selectedPlan }) {
  const ent = selectedPlan?.entitlements;
  const custom = Boolean(selectedPlan?.custom);
  const sections = [
    { key: "features", title: "Features", subtitle: "What the store can switch on. The owner can still turn an unlocked feature off.", items: FEATURES, base: ent?.features },
    { key: "effects", title: "Visual effects", subtitle: "Which storefront effects the owner can pick (“None” is always available).", items: EFFECT_ITEMS, base: ent?.effects },
    { key: "qrCardFamilies", title: "QR card styles", subtitle: "Which table-card styles the owner can design with.", items: QR_ITEMS, base: ent?.qrCardFamilies },
  ];
  // custom plans include nothing — the store has exactly what's unlocked here
  const setAll = (section, items) =>
    setDraft({ ...draft, entitlements: { ...draft.entitlements, [section]: { unlock: items.map((i) => i.key), lock: [] } } });

  const setChoice = (section, key, choice) => {
    const adj = draft.entitlements[section];
    const unlock = adj.unlock.filter((k) => k !== key);
    const lock = adj.lock.filter((k) => k !== key);
    if (choice === "unlock") unlock.push(key);
    if (choice === "lock") lock.push(key);
    setDraft({ ...draft, entitlements: { ...draft.entitlements, [section]: { unlock, lock } } });
  };

  return sections.map((s) => (
    <Card
      key={s.key}
      title={s.title}
      subtitle={custom ? `Custom plan — nothing is included until you unlock it here. ${s.subtitle}` : s.subtitle}
      action={
        custom ? (
          <span style={{ display: "flex", gap: 6 }}>
            <Button variant="outline" onClick={() => setAll(s.key, s.items)}>
              Unlock all
            </Button>
            <Button variant="outline" onClick={() => setAll(s.key, [])}>
              Clear
            </Button>
          </span>
        ) : undefined
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {s.items.map((item) => {
          const inPlan = !s.base || s.base.includes(item.key);
          const adj = draft.entitlements[s.key];
          const choice = adj.unlock.includes(item.key) ? "unlock" : adj.lock.includes(item.key) ? "lock" : "plan";
          const effective = choice === "plan" ? inPlan : choice === "unlock";
          return (
            <div key={item.key} style={row}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{item.label}</div>
                {item.description ? <div style={muted}>{item.description}</div> : null}
              </div>
              {custom ? (
                <Select value={choice === "unlock" ? "unlock" : "plan"} onChange={(e) => setChoice(s.key, item.key, e.target.value)} style={{ width: 230 }}>
                  <option value="plan">Not included</option>
                  <option value="unlock">Unlocked for this store</option>
                </Select>
              ) : (
                <Select value={choice} onChange={(e) => setChoice(s.key, item.key, e.target.value)} style={{ width: 230 }}>
                  <option value="plan">From plan — {inPlan ? "unlocked" : "locked"}</option>
                  <option value="unlock">Unlocked for this store</option>
                  <option value="lock">Locked for this store</option>
                </Select>
              )}
              <Pill tone={effective ? "ok" : "neutral"}>{effective ? "Unlocked" : "Locked"}</Pill>
            </div>
          );
        })}
      </div>
    </Card>
  ));
}

/* ------------------------------------------------------------- domains tab */

/**
 * The domains the store's website answers on — every outlet shares them,
 * told apart by path (dominos.com/laxmi-nagar). The main one is what table
 * QR codes and "View storefront" use. A domain can belong to one store only.
 */
function DomainsTab({ store }) {
  const [hostnames, setHostnames] = useState(store.domains.hostnames);
  const [primary, setPrimary] = useState(store.domains.primary);
  const [adding, setAdding] = useState("");
  const save = usePlatformMutation(() => api.setStoreDomains(store.id, { hostnames, primary }));
  const dirty = JSON.stringify(hostnames) !== JSON.stringify(store.domains.hostnames) || primary !== store.domains.primary;

  const add = () => {
    const h = adding.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/\/.*$/, "");
    if (!h || hostnames.includes(h)) return setAdding("");
    setHostnames([...hostnames, h]);
    if (!primary) setPrimary(h);
    setAdding("");
  };
  const remove = (h) => {
    const next = hostnames.filter((x) => x !== h);
    setHostnames(next);
    if (primary === h) setPrimary(next[0] ?? "");
  };

  return (
    <>
      <Card title="Domains" icon={<Globe size={16} />} subtitle="Where this store's website opens. Every outlet shares these — customers pick an outlet from the path, like dominos.com/laxmi-nagar.">
        {hostnames.length === 0 ? <p style={muted}>No domains yet — the store isn't reachable on its own address.</p> : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {hostnames.map((h) => (
            <div key={h} style={row}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0, cursor: "pointer" }}>
                <input type="radio" name="primary-domain" checked={primary === h} onChange={() => setPrimary(h)} style={{ accentColor: "var(--color-primary)" }} />
                <span style={{ fontWeight: 600, fontFamily: "ui-monospace, monospace", fontSize: 13.5 }}>{h}</span>
                {primary === h ? <Pill tone="ok">Main</Pill> : null}
              </label>
              <Button variant="outline" onClick={() => remove(h)} aria-label={`Remove ${h}`} style={{ display: "inline-flex", alignItems: "center" }}>
                <Trash2 size={13} />
              </Button>
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}
        >
          <TextInput value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="dominos.com" style={{ flex: "1 1 220px" }} aria-label="Add a domain" />
          <Button type="submit" variant="outline" disabled={!adding.trim()}>
            Add domain
          </Button>
        </form>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16 }}>
          <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
            {save.isPending ? "Saving…" : "Save domains"}
          </Button>
          {dirty ? <span style={muted}>Unsaved changes</span> : null}
        </div>
        {save.error ? <Toast kind="error">{save.error.message}</Toast> : null}
        {save.isSuccess && !dirty ? <Toast kind="ok">Saved. Table QR codes now point to {primary || "the platform address"}.</Toast> : null}
      </Card>

      <Card title="Connecting a new domain" subtitle="What the store (or whoever manages their domain) does, and what you do.">
        <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, fontSize: 13.5 }}>
          <li>
            At their domain registrar, add an <strong>A record</strong> for the domain (and for <code>www</code>) pointing to your server's IP address.
          </li>
          <li>Add the domain here and save.</li>
          <li>
            On the server, issue its certificate:{" "}
            <code>
              certbot --nginx{" "}
              {(store.domains.hostnames.filter((h) => h.includes(".") && !/\.(test|local)$/.test(h)).map((h) => `-d ${h}`).join(" ")) || "-d dominos.com -d www.dominos.com"}
            </code>
            .
          </li>
          <li>Open the domain — the store's website appears. Reprint table QR cards if the main domain changed.</li>
        </ol>
      </Card>
    </>
  );
}

/* -------------------------------------------------------------- owners tab */

function OwnersTab({ store }) {
  const owners = store.people.filter((p) => p.role === "owner");
  const add = usePlatformMutation((body) => api.addStoreOwner(store.id, body));
  const update = usePlatformMutation(({ userId, body }) => api.updateStoreOwner(store.id, userId, body));
  const remove = usePlatformMutation((userId) => api.removeStoreOwner(store.id, userId));
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [resetFor, setResetFor] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const error = add.error ?? update.error ?? remove.error;

  return (
    <>
      <Card title={`Owners — ${owners.length}`} subtitle="Owners have full access to this store. Only you can add or remove them.">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {owners.map((o) => (
            <div key={o.id} style={row}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 600 }}>{o.name}</div>
                <div style={muted}>
                  {o.email} · last sign-in {fmtDate(o.lastLoginAt)}
                </div>
              </div>
              {!o.isActive ? <Pill tone="warn">Deactivated</Pill> : null}
              {o.blockedAt ? <Pill tone="error">Blocked</Pill> : null}
              {resetFor === o.id ? (
                <>
                  <TextInput type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ width: 170 }} />
                  <Button
                    disabled={newPassword.length < 8 || update.isPending}
                    onClick={() => update.mutate({ userId: o.id, body: { password: newPassword } }, { onSuccess: () => setResetFor(null) })}
                  >
                    Set
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => (setResetFor(o.id), setNewPassword(""))}>
                  Reset password
                </Button>
              )}
              <Button variant="outline" onClick={() => update.mutate({ userId: o.id, body: { isActive: !o.isActive } })}>
                {o.isActive ? "Deactivate" : "Activate"}
              </Button>
              <Button
                variant="outline"
                onClick={() => window.confirm(`Remove ${o.name} as an owner of ${store.name}?`) && remove.mutate(o.id)}
                style={{ color: "var(--tone-danger)" }}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        {error ? <Toast kind="error">{error.message}</Toast> : null}
        {update.isSuccess && !update.isPending ? <Toast kind="ok">Saved.</Toast> : null}
      </Card>

      <Card title="Add an owner" subtitle="An email that already has a TablePe login just gains access to this store — its password stays as it is.">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate({ ...form, password: form.password || undefined }, { onSuccess: () => setForm({ name: "", email: "", password: "" }) });
          }}
          style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}
        >
          <Field label="Name">
            <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="Email">
            <TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
          <Field label="Password" hint="for a new login">
            <TextInput type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} />
          </Field>
          <div style={{ marginBottom: 14 }}>
            <Button type="submit" disabled={add.isPending}>
              {add.isPending ? "Adding…" : "Add owner"}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------- outlets tab */

function OutletsTab({ store }) {
  const block = usePlatformMutation(({ outletId, blocked }) => api.setOutletBlocked(store.id, outletId, blocked));
  const del = usePlatformMutation(({ outletId, confirmName }) => api.deleteStoreOutlet(store.id, outletId, confirmName));
  const error = block.error ?? del.error;

  return (
    <Card
      title={`Outlets — ${store.outlets.length}`}
      subtitle="A blocked outlet stays visible to customers as “temporarily unavailable”, can't take orders, and its staff can't open it. Its data is kept."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {store.outlets.map((o) => (
          <div key={o.id} style={row}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontWeight: 600 }}>{o.name}</div>
              <div style={muted}>
                /{o.slug} · created {fmtDate(o.createdAt)}
              </div>
            </div>
            {o.blocked ? <Pill tone="error">Blocked {fmtDate(o.blocked.at)}</Pill> : <Pill tone="ok">Open</Pill>}
            <Button
              variant="outline"
              disabled={block.isPending}
              onClick={() => block.mutate({ outletId: o.id, blocked: !o.blocked })}
            >
              {o.blocked ? "Unblock" : "Block"}
            </Button>
            {o.blocked ? (
              <Button
                variant="outline"
                style={{ color: "var(--tone-danger)" }}
                onClick={() => {
                  const typed = window.prompt(
                    `Permanently delete “${o.name}”? Its menu, tables, printers and QR card are deleted; past orders are kept.\n\nType the outlet name to confirm:`,
                  );
                  if (typed !== null) del.mutate({ outletId: o.id, confirmName: typed });
                }}
              >
                Delete
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      {error ? <Toast kind="error">{error.message}</Toast> : null}
    </Card>
  );
}

/* -------------------------------------------------------------- people tab */

function PeopleTab({ store }) {
  const block = usePlatformMutation(({ userId, blocked }) => api.setPersonBlocked(store.id, userId, blocked));
  const del = usePlatformMutation((userId) => api.deleteStorePerson(store.id, userId));
  const error = block.error ?? del.error;
  const people = useMemo(() => [...store.people].sort((a, b) => (a.role === "owner" ? -1 : 0) - (b.role === "owner" ? -1 : 0)), [store.people]);

  return (
    <Card
      title={`People — ${store.people.length}`}
      subtitle="Everyone with access to this store counts toward its people limit, owners included. A blocked person can't sign in to this store."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {people.map((p) => (
          <div key={p.id} style={row}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div style={muted}>
                {p.email} · {p.role} · added {fmtDate(p.createdAt)}
              </div>
            </div>
            {!p.isActive ? <Pill tone="warn">Deactivated</Pill> : null}
            {p.blockedAt ? <Pill tone="error">Blocked {fmtDate(p.blockedAt)}</Pill> : null}
            <Button variant="outline" disabled={block.isPending} onClick={() => block.mutate({ userId: p.id, blocked: !p.blockedAt })}>
              {p.blockedAt ? "Unblock" : "Block"}
            </Button>
            {p.blockedAt && p.role !== "owner" ? (
              <Button
                variant="outline"
                style={{ color: "var(--tone-danger)" }}
                onClick={() => window.confirm(`Remove ${p.name}'s access to ${store.name}?`) && del.mutate(p.id)}
              >
                Remove
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      {error ? <Toast kind="error">{error.message}</Toast> : null}
    </Card>
  );
}

/* ---------------------------------------------------------- appearance tab */

function AppearanceTab({ open }) {
  return (
    <Card
      title="Appearance"
      subtitle="Colours, effect, fonts and component styles are shared by every outlet of this store. The owner can change them too."
    >
      <p style={{ ...muted, marginTop: 0 }}>These open the store's own editors, with its live preview.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button onClick={() => open("/theme")}>Colours &amp; effect</Button>
        <Button variant="outline" onClick={() => open("/typography")}>
          Fonts
        </Button>
        <Button variant="outline" onClick={() => open("/appearance")}>
          Component styles
        </Button>
      </div>
    </Card>
  );
}

const saveBar = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "10px 14px",
  margin: "12px 0",
  borderRadius: 10,
  background: "var(--tone-info-wash)",
  color: "var(--tone-info)",
  fontSize: 13,
};
