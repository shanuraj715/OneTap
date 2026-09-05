import { useState } from "react";
                                           
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES,           } from "@onetap/config-schema";
import { useAuth, useCreateUser, useDeleteUser, useUpdateUser, useUsers } from "../lib/useAuth";
import { useOutlet } from "../lib/useOutlet";
import { Button, Card, Field, PageHeader, TextInput, Toast } from "../ui";
import { SettingsNav } from "../components/SubNav";

const ASSIGNABLE = ROLES.filter((r) => r !== "super_admin");

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

  const [form, setForm] = useState({ name: "", email: "", password: "", role: "manager"         });

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
    create.mutate(
      { body: form, brandId },
      { onSuccess: () => setForm({ name: "", email: "", password: "", role: "manager" }) },
    );
  };

  return (
    <>
      <PageHeader title="Users & roles" subtitle="Who can sign in, and what each role may do." />

      <SettingsNav />

      <Card title={`Team — ${users.length}`}>
        {usersQuery.isLoading ? (
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>Loading…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {users.map((u) => {
              const isMe = u.id === me?.id;
              return (
                <div key={u.id} style={row}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, display: "flex", gap: 8, alignItems: "center" }}>
                      {u.name}
                      {isMe ? <span style={youChip}>you</span> : null}
                      {!u.isActive ? <span style={{ ...youChip, background: "var(--color-text-muted)" }}>disabled</span> : null}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>{u.email}</div>
                  </div>

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

                  {manage && !isMe ? (
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
        <Card title="Add someone">
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
            </div>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Adding…" : "Add user"}
            </Button>
            {create.error ? <Toast kind="error">{(create.error         ).message}</Toast> : null}
          </form>
        </Card>
      ) : null}

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
