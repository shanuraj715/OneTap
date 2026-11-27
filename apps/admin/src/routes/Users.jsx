import { useMemo, useState } from "react";
                                           
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES,           } from "@rasoipulse/config-schema";
import { useAuth, useCreateUser, useDeleteUser, useUpdateUser, useUsers } from "../lib/useAuth";
import { useOutlet, useOutlets } from "../lib/useOutlet";
import { useStorePlan } from "../lib/useStorePlan";
import { Button, Card, Field, Modal, MultiSelect, PageHeader, TextInput, Toast } from "../ui";
import { SettingsNav } from "../components/SubNav";

const ALL_ASSIGNABLE = ROLES.filter((r) => r !== "super_admin");
// Store owners are added and managed by Rasoi Pulse from the platform console,
// so the store's own dashboard can't hand out (or take away) the owner role.
const STORE_ASSIGNABLE = ALL_ASSIGNABLE.filter((r) => r !== "owner");

export function Users() {
  const { user: me, can } = useAuth();
  // A superadmin has no brand of their own — which team they're managing
  // follows whichever outlet is selected in the switcher. Everyone else's
  // brand is already implicit server-side, so this stays undefined for them.
  const { outlet } = useOutlet();
  const brandId = me?.isSuperAdmin ? outlet?.brandId : undefined;
  const manage = can("user:manage");
  const usersQuery = useUsers(can("user:read"), brandId);
  const create = useCreateUser();
  const update = useUpdateUser();
  const remove = useDeleteUser();
  const { plan, canAddPerson } = useStorePlan();
  const ASSIGNABLE = me?.isSuperAdmin ? ALL_ASSIGNABLE : STORE_ASSIGNABLE;

  const { outlets: allOutlets } = useOutlets();
  // the outlets of the store being managed (a platform admin has opened one store; everyone else only has their own)
  const storeOutlets = useMemo(() => allOutlets.filter((o) => !brandId || o.brandId === brandId), [allOutlets, brandId]);
  const outletName = (id) => storeOutlets.find((o) => o._id === id)?.name ?? "an outlet that no longer exists";
  const blank = { name: "", email: "", password: "", role: "manager", allOutlets: false, outletIds: [] };
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null); // the person whose outlets are being changed
  // a store with a single outlet has nothing to choose; with several, a new person must be given outlets (or "all") on purpose
  const choosesOutlets = storeOutlets.length > 1 && form.role !== "owner";
  const missingOutlets = choosesOutlets && !form.allOutlets && form.outletIds.length === 0;

  if (!can("user:read")) {
    return (
      <>
        <PageHeader title="Users & roles" />
        <SettingsNav />
        <Card>Your role can&apos;t view users.</Card>
      </>
    );
  }

  const users = usersQuery.data?.users ?? [];

  const submit = (e                 ) => {
    e.preventDefault();
    if (missingOutlets) return;
    const { allOutlets: all, outletIds, ...rest } = form;
    create.mutate(
      { body: { ...rest, outletIds: choosesOutlets && !all ? outletIds : [] }, brandId },
      { onSuccess: () => setForm(blank) },
    );
  };

  return (
    <>
      <PageHeader title="Users & roles" subtitle="Who can sign in, and what each role may do." />

      <SettingsNav />

      <Card
        title={`Team — ${users.length}`}
        subtitle={
          plan && plan.max.users !== null
            ? `${plan.usage.users} of ${plan.max.users} people on your plan (owners included${users.some((u) => u.blockedAt) ? ", paused people not counted" : ""}).`
            : undefined
        }
      >
        {usersQuery.isLoading ? (
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>Loading…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {users.map((u) => {
              const isMe = u.id === me?.id;
              // owner rows are read-only here — Rasoi Pulse manages them
              const platformManaged = u.role === "owner" && !me?.isSuperAdmin;
              return (
                <div key={u.id} style={row}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, display: "flex", gap: 8, alignItems: "center" }}>
                      {u.name}
                      {isMe ? <span style={youChip}>you</span> : null}
                      {!u.isActive ? <span style={{ ...youChip, background: "var(--color-text-muted)" }}>disabled</span> : null}
                      {u.blockedAt ? (
                        <span style={{ ...youChip, background: "var(--tone-danger, #b42318)" }} title="Paused by Rasoi Pulse — the store is over its plan's people limit">
                          paused
                        </span>
                      ) : null}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>{u.email}</div>
                    {storeOutlets.length > 1 ? (
                      <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginTop: 2 }} data-testid={`outlets-of-${u.email}`}>
                        {u.role === "owner" || !u.outletIds?.length ? "All outlets" : `Outlets: ${u.outletIds.map(outletName).join(", ")}`}
                        {manage && !isMe && !platformManaged ? (
                          <>
                            {" · "}
                            <button type="button" style={linkBtn} onClick={() => setEditing(u)}>Change outlets</button>
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {platformManaged ? (
                    <span style={{ fontSize: 12.5, color: "var(--color-text-muted)", textAlign: "right" }}>
                      <strong style={{ color: "var(--color-text)" }}>{ROLE_LABELS.owner}</strong>
                      <br />
                      Managed by Rasoi Pulse
                    </span>
                  ) : (
                  <select
                    value={u.role ?? "manager"}
                    disabled={!manage || isMe}
                    onChange={(e) => update.mutate({ id: u.id, body: { role: e.target.value         }, brandId })}
                    style={select}
                  >
                    {ASSIGNABLE.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  )}

                  {manage && !isMe && !platformManaged ? (
                    <>
                      <button
                        type="button"
                        style={iconBtn}
                        title={u.isActive ? "Disable" : "Enable"}
                        onClick={() => update.mutate({ id: u.id, body: { isActive: !u.isActive }, brandId })}
                      >
                        {u.isActive ? "◉" : "○"}
                      </button>
                      <button
                        type="button"
                        style={iconBtn}
                        title="Remove"
                        onClick={() => window.confirm(`Remove ${u.email}?`) && remove.mutate({ id: u.id, brandId })}
                      >
                        ×
                      </button>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        {update.error ? <Toast kind="error">{(update.error         ).message}</Toast> : null}
        {remove.error ? <Toast kind="error">{(remove.error         ).message}</Toast> : null}
      </Card>

      {manage ? (
        <Card
          title="Add someone"
          subtitle={
            canAddPerson
              ? undefined
              : `Your plan allows ${plan?.max.users} people and all are in use. Remove someone, or ask Rasoi Pulse to raise the limit.`
          }
        >
          <form onSubmit={submit}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
              <Field label="Name" info="How this person appears in the order history and the audit trail — so when a refund is questioned, you know who pressed the button.">
                <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </Field>
              <Field label="Email" info="Used to sign in, and the address any future password reset goes to. It has to be unique across the whole brand.">
                <TextInput type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </Field>
              <Field label="Password" hint="At least 8 characters" info="Their first password. Share it with them directly and ask them to change it — it is stored only as a one-way hash, so nobody, including you, can read it back from here.">
                <TextInput type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
              </Field>
              <Field label="Role" info="What this person can reach. Give the narrowest role that lets them do their job — a cashier who cannot open payment settings cannot leak your gateway keys. The table below spells out each role.">
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value         })} style={select}>
                  {ASSIGNABLE.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </Field>
              {choosesOutlets ? (
                <Field as="div" label="Outlets" hint="Where this person works" info="They see — and can use — only the outlets you pick: not their tables, orders or customers of any other outlet. Pick 'All outlets' for someone who works across the whole store (it includes outlets you add later).">
                  <OutletPicker
                    testId="new-user-outlets"
                    outlets={storeOutlets}
                    all={form.allOutlets}
                    ids={form.outletIds}
                    onAll={(v) => setForm({ ...form, allOutlets: v })}
                    onIds={(ids) => setForm({ ...form, outletIds: ids })}
                    invalid={missingOutlets}
                  />
                  {missingOutlets ? <span style={{ fontSize: 12, color: "var(--tone-danger)" }} role="alert">Pick at least one outlet, or choose All outlets.</span> : null}
                </Field>
              ) : null}
            </div>
            <Button
              type="submit"
              disabled={create.isPending || !canAddPerson || missingOutlets}
              // the shared Button doesn't dim when disabled — make the plan block visible
              style={canAddPerson ? undefined : { opacity: 0.5, cursor: "not-allowed" }}
            >
              {create.isPending ? "Adding…" : "Add user"}
            </Button>
            {create.error ? <Toast kind="error">{(create.error         ).message}</Toast> : null}
          </form>
        </Card>
      ) : null}

      {editing ? <OutletsDialog person={editing} outlets={storeOutlets} busy={update.isPending} onCancel={() => setEditing(null)} onSave={(outletIds) => update.mutate({ id: editing.id, body: { outletIds }, brandId }, { onSuccess: () => setEditing(null) })} /> : null}

      <Card title="What each role can do">
        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "160px 1fr", gap: "8px 16px", fontSize: 13.5 }}>
          {ROLES.map((r) => (
            <div key={r} style={{ display: "contents" }}>
              <dt style={{ fontWeight: 600 }}>{ROLE_LABELS[r]}</dt>
              <dd style={{ margin: 0, color: "var(--color-text-muted)" }}>{ROLE_DESCRIPTIONS[r]}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </>
  );
}

/** The one outlet picker (adding a person, changing a person): a dropdown with search, and an "All outlets" row that also covers outlets added later. */
function OutletPicker({ testId, outlets, all, ids, onAll, onIds, invalid }) {
  return (
    <MultiSelect
      testId={testId}
      ariaLabel="Outlets this person can work in"
      options={outlets.map((o) => ({ value: o._id, label: o.name, hint: o.slug && o.slug !== o.name.toLowerCase() ? o.slug : undefined }))}
      value={ids}
      onChange={onIds}
      all={all}
      onAllChange={onAll}
      allLabel="All outlets"
      placeholder="Choose outlets"
      searchPlaceholder="Search outlets"
      noun="outlet"
      invalid={invalid}
    />
  );
}

/** Change which outlets one person can work in. "All outlets" = no limit (and covers outlets added later). */
function OutletsDialog({ person, outlets, busy, onSave, onCancel }) {
  const [all, setAll] = useState(!person.outletIds?.length);
  const [ids, setIds] = useState(person.outletIds ?? []);
  const none = !all && ids.length === 0;
  return (
    <Modal onClose={onCancel} width={420} ariaLabel={`Outlets for ${person.name}`}>
      <div style={{ padding: "20px 22px 8px" }} data-testid="outlets-dialog">
        <h3 style={{ margin: "0 0 4px", fontSize: 16, fontFamily: "var(--font-heading)" }}>Outlets for {person.name}</h3>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
          They see and can use only the outlets ticked here. A change takes effect straight away — they don&apos;t need to sign in again.
        </p>
        <OutletPicker testId="edit-user-outlets" outlets={outlets} all={all} ids={ids} onAll={setAll} onIds={setIds} invalid={none} />
        {none ? <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--tone-danger)" }} role="alert">Pick at least one outlet, or choose All outlets.</p> : null}
      </div>
      <footer style={{ display: "flex", gap: 9, justifyContent: "flex-end", padding: "14px 20px" }}>
        <Button variant="outline" type="button" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button type="button" disabled={busy || none} onClick={() => onSave(all ? [] : ids)}>{busy ? "Saving…" : "Save"}</Button>
      </footer>
    </Modal>
  );
}

const linkBtn = { font: "inherit", fontSize: 12.5, padding: 0, border: 0, background: "none", color: "var(--color-primary)", cursor: "pointer", textDecoration: "underline" };
const row                = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  background: "var(--color-bg)",
};
const select                = {
  font: "inherit",
  fontSize: 13.5,
  padding: "7px 9px",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
};
const iconBtn                = {
  font: "inherit",
  fontSize: 14,
  width: 28,
  height: 28,
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  background: "var(--color-bg)",
  color: "var(--color-text-muted)",
  cursor: "pointer",
  flexShrink: 0,
};
const youChip                = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  padding: "2px 6px",
  borderRadius: 4,
};
