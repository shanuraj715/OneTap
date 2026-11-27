import { useMemo, useState } from "react";
import { History, KeyRound, MoreVertical, Pencil, Plus, ShieldCheck, Trash2, UserCog, Users } from "lucide-react";
import { PLATFORM_FEATURES } from "@rasoipulse/config-schema";
import * as api from "../../lib/api";
import { useRoles, useTeam, useTeamActivity, usePlatformMutation } from "../../lib/usePlatform";
import { Button, Card, Checkbox, Empty, Field, Menu, Modal, Note, PageHeader, Pill, Select, Table, Tabs, Td, TextInput, Th, Toast } from "../../ui";

const when = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Never");
const labelOf = Object.fromEntries(PLATFORM_FEATURES.map((f) => [f.key, f.label]));

/** A password the super admin can read out or send: letters and digits only, no look-alikes. */
function makePassword() {
  const letters = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const pick = (set, n) => Array.from(crypto.getRandomValues(new Uint32Array(n)), (x) => set[x % set.length]).join("");
  const raw = (pick(letters, 8) + pick(digits, 3) + pick(letters, 3)).split("");
  for (let i = raw.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [raw[i], raw[j]] = [raw[j], raw[i]]; }
  return raw.join("");
}

const ACTIONS = {
  "role.create": "made the role",
  "role.update": "changed the role",
  "role.delete": "deleted the role",
  "member.create": "added",
  "member.update": "changed",
  "member.password": "set a new password for",
  "member.delete": "removed",
};

/** The Rasoi Pulse team: who works for us, what role each person has, and what each role may do. The super admin's page — nobody else sees it. */
export function PlatformTeam() {
  const [tab, setTab] = useState("members");
  const roles = useRoles();
  const team = useTeam();
  const [editingRole, setEditingRole] = useState(null); // { role } | { role: null } for a new one
  const [editingMember, setEditingMember] = useState(null); // { member } | { member: null }
  const [password, setPassword] = useState(null); // { member, password } — shown once after it is set
  const [asked, setAsked] = useState(null); // a member being asked about (password / delete)
  const remove = usePlatformMutation((m) => api.deleteTeamMember(m.id));
  const removeRole = usePlatformMutation((r) => api.deleteRole(r.id));
  const patch = usePlatformMutation(({ id, body }) => api.updateTeamMember(id, body));
  const list = roles.data?.roles ?? [];
  const members = team.data?.members ?? [];

  return (
    <>
      <PageHeader
        title="Team & roles"
        icon={<Users size={23} />}
        subtitle="The people who work for Rasoi Pulse and what each of them may do. Only you can see this page."
        action={
          tab === "roles" ? (
            <Button onClick={() => setEditingRole({ role: null })} data-testid="team-new-role" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Plus size={14} /> New role</Button>
          ) : tab === "members" ? (
            <Button onClick={() => setEditingMember({ member: null })} disabled={!list.length} data-testid="team-new-member" title={list.length ? undefined : "Make a role first"} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Plus size={14} /> Add a person</Button>
          ) : null
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "members", label: "People", icon: <Users size={14} />, count: members.length },
          { id: "roles", label: "Roles", icon: <ShieldCheck size={14} />, count: list.length },
          { id: "activity", label: "Activity", icon: <History size={14} /> },
        ]}
      />

      {tab === "members" ? (
        <Card title="People" subtitle="Each person has one role. Their sign-in is the same as yours (email and password); they only see what the role allows.">
          {remove.error ? <Toast kind="error">{remove.error.message}</Toast> : null}
          {patch.error ? <Toast kind="error">{patch.error.message}</Toast> : null}
          {!team.isLoading && !members.length ? (
            <Empty icon={<Users size={26} />} title="Nobody yet">{list.length ? "Add the first person: choose their role and give them a password." : "Start with a role (Roles tab), then add people to it."}</Empty>
          ) : (
            <Table minWidth={760}>
              <thead><tr><Th>Name</Th><Th>Role</Th><Th>Status</Th><Th>Last signed in</Th><Th> </Th></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} data-testid={`member-row-${m.email}`}>
                    <Td><strong>{m.name}</strong><div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>{m.email}</div></Td>
                    <Td><span data-testid="member-role-name">{m.roleName}</span></Td>
                    <Td>{m.isActive ? <Pill tone="ok">Active</Pill> : <Pill tone="neutral">Switched off</Pill>}</Td>
                    <Td>{when(m.lastLoginAt)}</Td>
                    <Td>
                      <Menu
                        header={m.name}
                        width={230}
                        options={[
                          { value: "edit", label: "Change name or role", icon: <Pencil size={14} />, testId: "member-menu-edit" },
                          { value: "password", label: "Set a new password", icon: <KeyRound size={14} />, testId: "member-menu-password" },
                          { value: "toggle", label: m.isActive ? "Switch off (signs them out)" : "Switch on", icon: <UserCog size={14} />, testId: "member-menu-toggle" },
                          { value: "delete", label: "Remove", icon: <Trash2 size={14} />, danger: true, testId: "member-menu-delete" },
                        ]}
                        onSelect={(v) => {
                          if (v === "edit") setEditingMember({ member: m });
                          else if (v === "password") setAsked({ kind: "password", member: m });
                          else if (v === "toggle") patch.mutate({ id: m.id, body: { isActive: !m.isActive } });
                          else if (v === "delete") setAsked({ kind: "delete", member: m });
                        }}
                        trigger={({ toggle, open }) => (
                          <Button variant="outline" onClick={toggle} aria-expanded={open} aria-label={`Actions for ${m.name}`} data-testid={`member-menu-${m.email}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <MoreVertical size={14} />
                          </Button>
                        )}
                      />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      ) : null}

      {tab === "roles" ? (
        <Card title="Roles" subtitle="A role is a list of what a person may do. Tick only what the work needs: a sales role usually holds just Onboarding.">
          {removeRole.error ? <Toast kind="error">{removeRole.error.message}</Toast> : null}
          {!roles.isLoading && !list.length ? <Empty icon={<ShieldCheck size={26} />} title="No roles yet">Make a role, tick what it may do, then add people to it.</Empty> : (
            <Table minWidth={760}>
              <thead><tr><Th>Role</Th><Th>What it may do</Th><Th>People</Th><Th> </Th></tr></thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} data-testid={`role-row-${r.name}`}>
                    <Td><strong>{r.name}</strong>{r.description ? <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>{r.description}</div> : null}</Td>
                    <Td>
                      <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
                        {r.features.length ? r.features.map((f) => <Pill key={f} tone="info">{labelOf[f] ?? f}</Pill>) : <Pill tone="neutral">Nothing yet</Pill>}
                      </span>
                    </Td>
                    <Td>{r.members}</Td>
                    <Td>
                      <span style={{ display: "inline-flex", gap: 6 }}>
                        <Button variant="outline" onClick={() => setEditingRole({ role: r })} data-testid="role-edit" aria-label={`Edit ${r.name}`}><Pencil size={14} /></Button>
                        <Button
                          variant="outline"
                          onClick={() => { if (window.confirm(`Delete the role “${r.name}”?`)) removeRole.mutate(r); }}
                          disabled={r.members > 0}
                          title={r.members > 0 ? "Move its people to another role first" : undefined}
                          data-testid="role-delete"
                          aria-label={`Delete ${r.name}`}
                        ><Trash2 size={14} /></Button>
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      ) : null}

      {tab === "activity" ? <Activity /> : null}

      {editingRole ? <RoleEditor role={editingRole.role} onClose={() => setEditingRole(null)} /> : null}
      {editingMember ? <MemberEditor member={editingMember.member} roles={list} onClose={() => setEditingMember(null)} onCreated={(m, pw) => setPassword({ member: m, password: pw })} /> : null}
      {asked?.kind === "password" ? <PasswordDialog member={asked.member} onClose={() => setAsked(null)} onDone={(pw) => { setPassword({ member: asked.member, password: pw }); setAsked(null); }} /> : null}
      {asked?.kind === "delete" ? (
        <Modal onClose={() => setAsked(null)} width={420} ariaLabel="Remove this person" panelStyle={{ padding: 24 }}>
          <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-heading)" }}>Remove {asked.member.name}?</h3>
          <p style={{ margin: "0 0 16px", fontSize: 14, color: "var(--color-text-muted)", lineHeight: 1.55 }}>Their account is deleted and every device they are signed in on is signed out at once. This can't be undone.</p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="outline" onClick={() => setAsked(null)}>Keep</Button>
            <Button onClick={() => remove.mutate(asked.member, { onSuccess: () => setAsked(null) })} disabled={remove.isPending} data-testid="member-delete-confirm" style={{ background: "var(--tone-danger)", borderColor: "var(--tone-danger)" }}>Remove</Button>
          </div>
        </Modal>
      ) : null}
      {password ? (
        <Modal onClose={() => setPassword(null)} width={440} ariaLabel="The password" panelStyle={{ padding: 24 }}>
          <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-heading)" }}>Password for {password.member.name}</h3>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--color-text-muted)", lineHeight: 1.55 }}>Tell it to them now — it is not stored anywhere you can read it again. They sign in at the console (or the Rasoi Pulse Admin app) with <strong>{password.member.email}</strong>.</p>
          <div data-testid="member-password-shown" style={{ fontFamily: "ui-monospace, monospace", fontSize: 18, fontWeight: 700, letterSpacing: "0.04em", padding: "12px 14px", border: "1px dashed var(--color-border)", borderRadius: 10, background: "var(--color-bg)", userSelect: "all", textAlign: "center" }}>{password.password}</div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
            <Button variant="outline" onClick={() => navigator.clipboard?.writeText(password.password)}>Copy</Button>
            <Button onClick={() => setPassword(null)}>Done</Button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function RoleEditor({ role, onClose }) {
  const roles = useRoles();
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [features, setFeatures] = useState(role?.features ?? []);
  const save = usePlatformMutation((body) => (role ? api.updateRole(role.id, body) : api.createRole(body)));
  const groups = useMemo(() => {
    const out = [];
    for (const f of roles.data?.features ?? PLATFORM_FEATURES) {
      let g = out.find((x) => x.name === f.group);
      if (!g) out.push((g = { name: f.group, items: [] }));
      g.items.push(f);
    }
    return out;
  }, [roles.data]);
  const toggle = (key, on) => setFeatures((cur) => (on ? [...new Set([...cur, key])] : cur.filter((k) => k !== key)));
  return (
    <Modal onClose={onClose} width={640} ariaLabel={role ? "Edit the role" : "New role"} panelStyle={{ padding: 24, maxHeight: "90vh", overflowY: "auto" }}>
      <h3 style={{ margin: "0 0 14px", fontFamily: "var(--font-heading)" }} data-testid="role-dialog">{role ? `Edit ${role.name}` : "New role"}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        <Field label="Role name"><TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Sales" aria-label="Role name" data-testid="role-name" autoFocus /></Field>
        <Field label="What this role is for (optional)"><TextInput value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} placeholder="e.g. Gets new clients and onboards them" aria-label="Role description" /></Field>
      </div>
      <p style={{ margin: "16px 0 6px", fontSize: 13, fontWeight: 700 }}>What people with this role may do</p>
      <div style={{ display: "grid", gap: 14 }}>
        {groups.map((g) => (
          <div key={g.name}>
            <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 6 }}>{g.name}</div>
            <div style={{ display: "grid", gap: 8 }}>
              {g.items.map((f) => (
                <div key={f.key} data-feature={f.key} style={{ display: "grid", gap: 2 }}>
                  <Checkbox checked={features.includes(f.key)} onChange={(v) => toggle(f.key, v)} label={f.label} />
                  <span style={{ marginLeft: 22, fontSize: 12.5, color: "var(--color-text-muted)" }}>{f.hint}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Note>Ticking <strong>change</strong> or <strong>delete</strong> on Stores also lets the person <strong>view</strong> stores. Team & roles is never part of a role: it stays yours alone.</Note>
      {save.error ? <Toast kind="error">{save.error.message}</Toast> : null}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => save.mutate({ name, description, features }, { onSuccess: onClose })} disabled={save.isPending || name.trim().length < 2} data-testid="role-save">{save.isPending ? "Saving…" : role ? "Save changes" : "Make the role"}</Button>
      </div>
    </Modal>
  );
}

function MemberEditor({ member, roles, onClose, onCreated }) {
  const [name, setName] = useState(member?.name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [roleId, setRoleId] = useState(member?.roleId ?? roles[0]?.id ?? "");
  const [password, setPassword] = useState(member ? "" : makePassword());
  const save = usePlatformMutation((body) => (member ? api.updateTeamMember(member.id, body) : api.createTeamMember(body)));
  const submit = () => {
    const body = member ? { name, roleId } : { name, email, roleId, password };
    save.mutate(body, { onSuccess: (res) => { if (!member) onCreated(res.member ?? { name, email }, password); onClose(); } });
  };
  return (
    <Modal onClose={onClose} width={520} ariaLabel={member ? "Change a person" : "Add a person"} panelStyle={{ padding: 24 }}>
      <h3 style={{ margin: "0 0 14px", fontFamily: "var(--font-heading)" }} data-testid="member-dialog">{member ? `Change ${member.name}` : "Add a person"}</h3>
      <div style={{ display: "grid", gap: 12 }}>
        <Field label="Name"><TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-label="Name" data-testid="member-name" autoFocus /></Field>
        <Field label="Email (their sign-in)"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={Boolean(member)} aria-label="Email" data-testid="member-email" /></Field>
        <Field label="Role">
          <Select value={roleId} onChange={(e) => setRoleId(e.target.value)} aria-label="Role" data-testid="member-role">
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
        {!member ? (
          <Field label="Password" hint="At least 10 characters with letters and a number. You tell it to them; they can't change it themselves yet.">
            <span style={{ display: "flex", gap: 8 }}>
              <TextInput value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Password" data-testid="member-password" style={{ fontFamily: "ui-monospace, monospace" }} />
              <Button variant="outline" onClick={() => setPassword(makePassword())} type="button">Generate</Button>
            </span>
          </Field>
        ) : null}
      </div>
      {save.error ? <Toast kind="error">{save.error.message}</Toast> : null}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={save.isPending || name.trim().length < 2 || !roleId || (!member && (!email.includes("@") || password.length < 10))} data-testid="member-save">{save.isPending ? "Saving…" : member ? "Save changes" : "Add the person"}</Button>
      </div>
    </Modal>
  );
}

function PasswordDialog({ member, onClose, onDone }) {
  const [password, setPassword] = useState(makePassword());
  const save = usePlatformMutation(() => api.updateTeamMember(member.id, { password }));
  return (
    <Modal onClose={onClose} width={460} ariaLabel="Set a new password" panelStyle={{ padding: 24 }}>
      <h3 style={{ margin: "0 0 8px", fontFamily: "var(--font-heading)" }}>New password for {member.name}</h3>
      <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--color-text-muted)", lineHeight: 1.55 }}>Every device they are signed in on is signed out at once, and the old password stops working.</p>
      <Field label="New password" hint="At least 10 characters with letters and a number.">
        <span style={{ display: "flex", gap: 8 }}>
          <TextInput value={password} onChange={(e) => setPassword(e.target.value)} aria-label="New password" data-testid="password-new" style={{ fontFamily: "ui-monospace, monospace" }} />
          <Button variant="outline" onClick={() => setPassword(makePassword())} type="button">Generate</Button>
        </span>
      </Field>
      {save.error ? <Toast kind="error">{save.error.message}</Toast> : null}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={() => save.mutate(undefined, { onSuccess: () => onDone(password) })} disabled={save.isPending || password.length < 10} data-testid="password-save">{save.isPending ? "Saving…" : "Set the password"}</Button>
      </div>
    </Modal>
  );
}

function Activity() {
  const q = useTeamActivity(100);
  const rows = q.data?.entries ?? [];
  return (
    <Card title="Activity" subtitle="Every change to roles and people: who did it, and what. Kept for a year. Passwords are never in it.">
      {!q.isLoading && !rows.length ? <Empty icon={<History size={26} />} title="Nothing yet">Changes to roles and people show up here.</Empty> : (
        <Table minWidth={680}>
          <thead><tr><Th>When</Th><Th>What happened</Th><Th>Details</Th></tr></thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} data-testid="activity-row">
                <Td>{when(e.at)}</Td>
                <Td><strong>{e.actor}</strong> {ACTIONS[e.action] ?? e.action} <strong>{e.target}</strong></Td>
                <Td style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{e.detail}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
