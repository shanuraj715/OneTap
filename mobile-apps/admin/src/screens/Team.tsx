import { useState } from "react";
import { Switch, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/runtime";
import type { Member, Role } from "@/api/endpoints";
import { useAction } from "@/data/useAction";
import { dateTime } from "@/lib/format";
import { makePassword, strongEnough } from "@/lib/password";
import { Button, ConfirmSheet, Empty, ErrorState, Field, Glass, Grid, Input, LoadingCards, Pill, Row, Screen, Section, Segmented, Select, Sheet, Text, useTheme } from "@/ui";

const ACTIONS: Record<string, string> = { "role.create": "made the role", "role.update": "changed the role", "role.delete": "deleted the role", "member.create": "added", "member.update": "changed", "member.password": "set a new password for", "member.delete": "removed" };

/** The Rasoi Pulse team: who works for us, what role each has, and what each role may do. The owner's screen — nobody else gets it. */
export function Team() {
  const api = useApi();
  const [tab, setTab] = useState<"people" | "roles" | "activity">("people");
  const roles = useQuery({ queryKey: ["roles"], queryFn: () => api.roles() });
  const team = useQuery({ queryKey: ["team"], queryFn: () => api.team() });
  const audit = useQuery({ queryKey: ["audit"], queryFn: () => api.audit(80), enabled: tab === "activity" });
  const [role, setRole] = useState<Role | "new" | null>(null);
  const [member, setMember] = useState<Member | "new" | null>(null);
  const [ask, setAsk] = useState<null | { kind: "password" | "delete"; member: Member }>(null);
  const [shown, setShown] = useState<null | { name: string; email: string; password: string }>(null);
  const list = roles.data?.roles ?? [];
  const members = team.data?.members ?? [];
  const labelOf = Object.fromEntries((roles.data?.features ?? []).map((f) => [f.key, f.label]));

  const toggle = useAction((m: Member) => api.updateMember(m.id, { isActive: !m.isActive }), { done: (m) => (m.isActive ? `${m.name} is switched off.` : `${m.name} is switched on.`), invalidate: [["team"], ["audit"]] });
  const removeMember = useAction((m: Member) => api.deleteMember(m.id), { done: "Removed.", invalidate: [["team"], ["roles"], ["audit"]], onDone: () => setAsk(null) });
  const removeRole = useAction((r: Role) => api.deleteRole(r.id), { done: "The role is deleted.", invalidate: [["roles"], ["audit"]] });

  return (
    <Screen title="Team & roles" subtitle="The people who work for Rasoi Pulse, and what each role may do. Only you can see this." onRefresh={() => { void roles.refetch(); void team.refetch(); }} refreshing={roles.isFetching || team.isFetching} testID="screen-team"
      right={tab === "roles" ? <Button size="sm" icon="plus" title="New role" onPress={() => setRole("new")} testID="new-role" /> : tab === "people" ? <Button size="sm" icon="plus" title="Add" disabled={!list.length} onPress={() => setMember("new")} testID="new-member" /> : undefined}>
      <Segmented testID="team-tab" value={tab} onChange={setTab} options={[{ value: "people", label: "People", count: members.length }, { value: "roles", label: "Roles", count: list.length }, { value: "activity", label: "Activity" }]} />

      {tab === "people" ? (team.isLoading ? <LoadingCards /> : team.isError ? <ErrorState error={team.error} onRetry={() => void team.refetch()} /> : !members.length ? <Empty icon="team" title="Nobody yet" message={list.length ? "Add the first person: choose their role and give them a password." : "Start with a role (Roles tab), then add people to it."} /> : (
        <Grid min={330}>{members.map((m, i) => (
          <Row key={m.id} index={i} icon="user" title={m.name} subtitle={`${m.email} · last in ${dateTime(m.lastLoginAt)}`} testID={`member-${m.email}`} onPress={() => setMember(m)}
            right={<View style={{ alignItems: "flex-end", gap: 5 }}><Pill tone={m.isActive ? "ok" : "neutral"}>{m.isActive ? "Active" : "Switched off"}</Pill><Pill tone="primary">{m.roleName}</Pill></View>}>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <Button size="sm" variant="glass" icon="key" title="New password" onPress={() => setAsk({ kind: "password", member: m })} testID={`pw-${m.email}`} />
              <Button size="sm" variant="glass" icon="power" title={m.isActive ? "Switch off" : "Switch on"} loading={toggle.isPending} onPress={() => toggle.mutate(m)} testID={`toggle-${m.email}`} />
              <Button size="sm" variant="ghost" icon="trash" title="Remove" onPress={() => setAsk({ kind: "delete", member: m })} testID={`remove-${m.email}`} />
            </View>
          </Row>
        ))}</Grid>
      )) : null}

      {tab === "roles" ? (roles.isLoading ? <LoadingCards /> : roles.isError ? <ErrorState error={roles.error} onRetry={() => void roles.refetch()} /> : !list.length ? <Empty icon="shield" title="No roles yet" message="Make a role, switch on what it may do, then add people to it." /> : (
        <Grid min={330}>{list.map((r, i) => (
          <Row key={r.id} index={i} icon="shield" title={r.name} subtitle={r.description || `${r.members} ${r.members === 1 ? "person" : "people"}`} testID={`role-${r.name}`} onPress={() => setRole(r)}>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {r.features.length ? r.features.map((f) => <Pill key={f} tone="info">{labelOf[f] ?? f}</Pill>) : <Pill>Nothing yet</Pill>}
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <Button size="sm" variant="glass" icon="edit" title="Edit" onPress={() => setRole(r)} testID={`edit-role-${r.name}`} />
              <Button size="sm" variant="ghost" icon="trash" title="Delete" disabled={r.members > 0} onPress={() => removeRole.mutate(r)} testID={`delete-role-${r.name}`} />
            </View>
            {r.members > 0 ? <Text variant="caption" tone="muted" style={{ marginTop: 6 }}>{r.members} {r.members === 1 ? "person has" : "people have"} this role — move them first to delete it.</Text> : null}
          </Row>
        ))}</Grid>
      )) : null}

      {tab === "activity" ? (audit.isLoading ? <LoadingCards /> : audit.isError ? <ErrorState error={audit.error} onRetry={() => void audit.refetch()} /> : !(audit.data?.entries.length) ? <Empty icon="history" title="Nothing yet" message="Changes to roles and people show up here." /> : (
        <Section title="Every change, newest first" hint="Who did it, and what. Passwords are never in it.">
          <View style={{ gap: 8 }}>{audit.data!.entries.map((e, i) => (
            <Row key={e.id} index={i} icon="history" title={`${e.actor} ${ACTIONS[e.action] ?? e.action} ${e.target}`} subtitle={`${dateTime(e.at)}${e.detail ? ` · ${e.detail}` : ""}`} testID="activity-row" />
          ))}</View>
        </Section>
      )) : null}

      {role ? <RoleSheet role={role === "new" ? null : role} groups={roles.data?.groups ?? []} features={roles.data?.features ?? []} onClose={() => setRole(null)} /> : null}
      {member ? <MemberSheet member={member === "new" ? null : member} roles={list} onClose={() => setMember(null)} onCreated={(m, password) => setShown({ name: m.name, email: m.email, password })} /> : null}
      {ask?.kind === "password" ? <PasswordSheet member={ask.member} onClose={() => setAsk(null)} onDone={(password) => { setShown({ name: ask.member.name, email: ask.member.email, password }); setAsk(null); }} /> : null}
      <ConfirmSheet visible={ask?.kind === "delete"} title={`Remove ${ask?.member.name ?? ""}?`} message="Their account is deleted and every device they are signed in on is signed out at once. This can't be undone." confirm="Remove" busy={removeMember.isPending} onConfirm={() => ask && removeMember.mutate(ask.member)} onClose={() => setAsk(null)} />
      <Sheet visible={Boolean(shown)} onClose={() => setShown(null)} title={`Password for ${shown?.name ?? ""}`} footer={<Button title="Done" onPress={() => setShown(null)} testID="password-done" />}>
        <Text tone="muted" style={{ lineHeight: 21 }}>Tell it to them now — it is not stored anywhere you can read it again. They sign in with <Text variant="label">{shown?.email}</Text>.</Text>
        <Glass strong><Text variant="heading" selectable testID="password-shown" style={{ textAlign: "center", letterSpacing: 1.2 }}>{shown?.password}</Text></Glass>
      </Sheet>
    </Screen>
  );
}

function RoleSheet({ role, groups, features, onClose }: { role: Role | null; groups: string[]; features: { key: string; group: string; label: string; hint: string }[]; onClose: () => void }) {
  const api = useApi();
  const { c } = useTheme();
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [on, setOn] = useState<string[]>(role?.features ?? []);
  const save = useAction(() => (role ? api.updateRole(role.id, { name, description, features: on }) : api.createRole({ name, description, features: on })), { done: role ? "Role saved." : "Role made.", invalidate: [["roles"], ["audit"]], onDone: onClose });
  return (
    <Sheet visible onClose={onClose} title={role ? `Edit ${role.name}` : "New role"} testID="role-sheet" footer={<><Button title="Cancel" variant="glass" onPress={onClose} /><Button title={role ? "Save" : "Make the role"} loading={save.isPending} disabled={name.trim().length < 2} onPress={() => save.mutate(undefined as never)} testID="role-save" /></>}>
      <Field label="Role name"><Input value={name} onChangeText={setName} autoCapitalize="words" maxLength={40} testID="role-name" /></Field>
      <Field label="What it is for (optional)"><Input value={description} onChangeText={setDescription} autoCapitalize="sentences" maxLength={200} /></Field>
      <Text variant="label">What people with this role may do</Text>
      {groups.map((g) => (
        <View key={g} style={{ gap: 4 }}>
          <Text variant="overline" tone="muted">{g}</Text>
          {features.filter((f) => f.group === g).map((f) => (
            <View key={f.key} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 }}>
              <View style={{ flex: 1 }}><Text variant="subheading">{f.label}</Text><Text variant="caption" tone="muted">{f.hint}</Text></View>
              <Switch value={on.includes(f.key)} onValueChange={(v) => setOn((cur) => (v ? [...new Set([...cur, f.key])] : cur.filter((k) => k !== f.key)))} accessibilityLabel={f.label} testID={`feature-${f.key}`} trackColor={{ false: c.border, true: c.primary }} thumbColor="#FFFFFF" />
            </View>
          ))}
        </View>
      ))}
      <Text variant="caption" tone="muted">Change or delete on Stores also lets the person view stores. Team & roles is never part of a role — it stays yours alone.</Text>
    </Sheet>
  );
}

function MemberSheet({ member, roles, onClose, onCreated }: { member: Member | null; roles: Role[]; onClose: () => void; onCreated: (m: { name: string; email: string }, password: string) => void }) {
  const api = useApi();
  const [name, setName] = useState(member?.name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [roleId, setRoleId] = useState(member?.roleId ?? roles[0]?.id ?? "");
  const [password, setPassword] = useState(() => (member ? "" : makePassword()));
  const save = useAction(() => (member ? api.updateMember(member.id, { name, roleId }) : api.createMember({ name: name.trim(), email: email.trim(), roleId, password })), {
    done: member ? "Saved." : "Added.", invalidate: [["team"], ["roles"], ["audit"]],
    onDone: () => { if (!member) onCreated({ name, email }, password); onClose(); },
  });
  const ok = name.trim().length >= 2 && Boolean(roleId) && (member ? true : /^\S+@\S+\.\S+$/.test(email.trim()) && strongEnough(password));
  return (
    <Sheet visible onClose={onClose} title={member ? `Change ${member.name}` : "Add a person"} testID="member-sheet" footer={<><Button title="Cancel" variant="glass" onPress={onClose} /><Button title={member ? "Save" : "Add the person"} loading={save.isPending} disabled={!ok} onPress={() => save.mutate(undefined as never)} testID="member-save" /></>}>
      <Field label="Name"><Input value={name} onChangeText={setName} autoCapitalize="words" maxLength={80} testID="member-name" /></Field>
      <Field label="Email (their sign-in)"><Input value={email.trim()} onChangeText={setEmail} keyboardType="email-address" editable={!member} testID="member-email" /></Field>
      <Select label="Role" value={roleId} onChange={setRoleId} options={roles.map((r) => ({ value: r.id, label: r.name, hint: r.description || undefined }))} testID="member-role" />
      {!member ? (
        <Field label="Password" hint="At least 10 characters with letters and a number. You tell it to them.">
          <View style={{ gap: 8 }}>
            <Input value={password} onChangeText={setPassword} autoCapitalize="none" testID="member-password" />
            <Button size="sm" variant="glass" icon="refresh" title="Make another" onPress={() => setPassword(makePassword())} />
          </View>
        </Field>
      ) : null}
    </Sheet>
  );
}

function PasswordSheet({ member, onClose, onDone }: { member: Member; onClose: () => void; onDone: (password: string) => void }) {
  const api = useApi();
  const [password, setPassword] = useState(() => makePassword());
  const save = useAction(() => api.updateMember(member.id, { password }), { done: "New password set.", invalidate: [["audit"]], onDone: () => onDone(password) });
  return (
    <Sheet visible onClose={onClose} title={`New password for ${member.name}`} testID="password-sheet" footer={<><Button title="Cancel" variant="glass" onPress={onClose} /><Button title="Set the password" loading={save.isPending} disabled={!strongEnough(password)} onPress={() => save.mutate(undefined as never)} testID="password-save" /></>}>
      <Text tone="muted" style={{ lineHeight: 21 }}>Every device they are signed in on is signed out at once, and the old password stops working.</Text>
      <Field label="New password" hint="At least 10 characters with letters and a number.">
        <View style={{ gap: 8 }}><Input value={password} onChangeText={setPassword} testID="password-new" /><Button size="sm" variant="glass" icon="refresh" title="Make another" onPress={() => setPassword(makePassword())} /></View>
      </Field>
    </Sheet>
  );
}
