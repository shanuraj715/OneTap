import { useMemo, useState } from "react";
import { Pressable, Share, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { OutletRef, StaffMember } from "@/api/endpoints";
import { useApi, useMe } from "@/runtime";
import { can } from "@/lib/access";
import { since } from "@/lib/dates";
import { generatePassword } from "@/lib/password";
import { ASSIGNABLE_ROLES, ROLE_DESCRIPTIONS, roleLabel } from "@/lib/roles";
import { useOptions } from "@/data/queries";
import { useAction } from "@/data/useAction";
import { AppSwitch, Button, Chips, ConfirmSheet, Empty, ErrorState, Field, Glass, Grid, Icon, Input, KpiTile, LoadingCards, Pill, Row, Screen, SearchField, Section, Select, Sheet, Text, useTheme } from "@/ui";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Staff: your team — who works for you, in which role and outlets, who signed in lately. The owner adds people, changes roles, switches them off, resets passwords. */
export function Staff() {
  const api = useApi();
  const me = useMe();
  const qc = useQueryClient();
  const options = useOptions();
  const q = useQuery({ queryKey: ["staff"], queryFn: () => api.staff() });
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [editing, setEditing] = useState<StaffMember | "new" | null>(null);
  const [added, setAdded] = useState<{ email: string; password: string; name: string } | null>(null);
  const mayManage = can(me, "user:manage");
  const outlets = options.data?.outlets ?? [];

  const users = useMemo(() => q.data?.users ?? [], [q.data]);
  const roles = useMemo(() => [...new Set(users.map((u) => u.role).filter((r): r is string => Boolean(r)))], [users]);
  const shown = users.filter((u) => (!role || u.role === role) && (!search.trim() || `${u.name} ${u.email}`.toLowerCase().includes(search.trim().toLowerCase())));
  const active = users.filter((u) => u.isActive && !u.blockedAt).length;

  return (
    <Screen title="Staff" subtitle={q.data ? `${users.length} ${users.length === 1 ? "person" : "people"}` : undefined} onRefresh={() => void qc.invalidateQueries({ queryKey: ["staff"] })} testID="screen-staff"
      right={mayManage ? <Button size="sm" icon="plus" title="Add person" onPress={() => setEditing("new")} testID="staff-add" /> : undefined}>
      {q.isLoading ? <LoadingCards n={3} /> : q.isError ? <ErrorState error={q.error} onRetry={() => void q.refetch()} /> : (
        <>
          <Grid min={150}>
            <KpiTile testID="staff-total" icon="users" label="People" value={String(users.length)} />
            <KpiTile testID="staff-active" icon="circleCheck" label="Can sign in" value={String(active)} />
            <KpiTile testID="staff-off" icon="block" label="Switched off" value={String(users.length - active)} />
          </Grid>
          <SearchField value={search} onChange={setSearch} placeholder="Search by name or email" testID="staff-search" />
          {roles.length > 1 ? <Chips testID="staff-role" value={role} onChange={setRole} options={[{ value: "", label: "Everyone" }, ...roles.map((r) => ({ value: r, label: roleLabel(r) }))]} /> : null}
          <Section title="Your team" hint={mayManage ? "Press a person to change their role, outlets or password" : "Only the owner can change people"}>
            {shown.length ? (
              <View style={{ gap: 10 }}>
                {shown.map((u, i) => <Person key={u.id} u={u} index={i} outlets={outlets} onPress={() => setEditing(u)} />)}
              </View>
            ) : <Empty icon="users" title={users.length ? "Nobody matches" : "No people yet"} message={users.length ? "Try another name or role." : undefined} />}
          </Section>
        </>
      )}
      {editing ? <PersonSheet person={editing === "new" ? null : editing} outlets={outlets} mayManage={mayManage} myId={me?.id} onClose={() => setEditing(null)} onAdded={setAdded} /> : null}
      <AddedSheet info={added} onClose={() => setAdded(null)} />
    </Screen>
  );
}

function Person({ u, index, outlets, onPress }: { u: StaffMember; index: number; outlets: OutletRef[]; onPress: () => void }) {
  const where = !u.outletIds.length ? "All outlets" : u.outletIds.map((id) => outlets.find((o) => o.id === id)?.title ?? "an outlet").join(", ");
  return (
    <Row index={index} testID={`staff-${u.id}`} icon={u.role === "owner" ? "shield" : "person"} title={u.name} subtitle={`${u.email}\n${where} · signed in ${since(u.lastLoginAt)}`} onPress={onPress}
      right={<View style={{ alignItems: "flex-end", gap: 4 }}><Pill tone={u.role === "owner" ? "primary" : "neutral"}>{roleLabel(u.role)}</Pill>{u.blockedAt ? <Pill tone="danger">Blocked</Pill> : !u.isActive ? <Pill tone="warn">Switched off</Pill> : null}</View>} />
  );
}

/** Which outlets: none ticked = every outlet. */
function OutletChoice({ outlets, value, onChange }: { outlets: OutletRef[]; value: string[]; onChange: (v: string[]) => void }) {
  const { c } = useTheme();
  const all = value.length === 0;
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const box = (on: boolean) => <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: on ? c.primary : c.fieldBorder, backgroundColor: on ? c.primary : "transparent", alignItems: "center", justifyContent: "center" }}>{on ? <Icon name="check" size={14} color={c.onPrimary} /> : null}</View>;
  return (
    <Field label="Which outlets can they work in?" hint={all ? "Every outlet, now and later." : `${value.length} chosen`}>
      <Glass padding={6}>
        <Pressable onPress={() => onChange([])} accessibilityRole="checkbox" accessibilityState={{ checked: all }} testID="staff-outlet-all" style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 10 }}>{box(all)}<Text>All outlets</Text></Pressable>
        {outlets.map((o) => {
          const on = value.includes(o.id);
          return <Pressable key={o.id} onPress={() => toggle(o.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} testID={`staff-outlet-${o.id}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 10 }}>{box(on)}<Text>{o.title}</Text></Pressable>;
        })}
      </Glass>
    </Field>
  );
}

function PersonSheet({ person, outlets, mayManage, myId, onClose, onAdded }: { person: StaffMember | null; outlets: OutletRef[]; mayManage: boolean; myId?: string; onClose: () => void; onAdded: (a: { email: string; password: string; name: string }) => void }) {
  const api = useApi();
  const qc = useQueryClient();
  const [name, setName] = useState(person?.name ?? "");
  const [email, setEmail] = useState(person?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>(person?.role ?? "staff");
  const [outletIds, setOutletIds] = useState<string[]>(person?.outletIds ?? []);
  const [isActive, setIsActive] = useState(person?.isActive ?? true);
  const [confirm, setConfirm] = useState(false);
  const owner = person?.role === "owner";
  const self = Boolean(person && person.id === myId);
  const readOnly = !mayManage || owner;
  const nameOk = name.trim().length > 0;
  const emailOk = EMAIL.test(email.trim());
  const passwordOk = person ? password === "" || password.length >= 8 : password.length >= 8;
  const valid = nameOk && (person ? true : emailOk) && passwordOk;

  const done = () => { void qc.invalidateQueries({ queryKey: ["staff"] }); onClose(); };
  const save = useAction(async () => {
    if (!person) {
      const r = await api.addStaff({ name: name.trim(), email: email.trim().toLowerCase(), password, role, outletIds });
      onAdded({ name: name.trim(), email: email.trim().toLowerCase(), password });
      return r;
    }
    const body: Parameters<typeof api.updateStaff>[1] = {};
    if (name.trim() !== person.name) body.name = name.trim();
    if (role !== person.role) body.role = role;
    if (isActive !== person.isActive) body.isActive = isActive;
    if (password) body.password = password;
    if ([...outletIds].sort().join() !== [...person.outletIds].sort().join()) body.outletIds = outletIds;
    return api.updateStaff(person.id, body);
  }, { done: person ? "Saved." : "Person added.", onDone: done });
  const remove = useAction(() => api.removeStaff(person!.id), { done: "Person removed.", onDone: done });

  return (
    <>
      <Sheet visible onClose={onClose} title={person ? person.name : "Add a person"} testID="staff-sheet"
        footer={readOnly ? <Button title="Close" variant="glass" onPress={onClose} /> : <>{person && !self ? <Button title="Remove" variant="danger" icon="trash" onPress={() => setConfirm(true)} testID="staff-remove" /> : <Button title="Cancel" variant="glass" onPress={onClose} />}<Button title={person ? "Save" : "Add"} loading={save.isPending} disabled={!valid} onPress={() => save.mutate(undefined)} testID="staff-save" /></>}>
        {owner ? <Text tone="muted" testID="staff-owner-note">Store owners are managed by Rasoi Pulse. Ask them to change this account.</Text> : null}
        {!mayManage && !owner ? <Text tone="muted">Only the owner can change people.</Text> : null}
        <Field label="Name" error={name !== "" && !nameOk ? "Type a name." : undefined}><Input value={name} onChangeText={setName} autoCapitalize="words" editable={!readOnly} testID="staff-name" /></Field>
        <Field label="Email (they sign in with it)" error={!person && email !== "" && !emailOk ? "That doesn't look like an email address." : undefined}><Input value={email} onChangeText={setEmail} keyboardType="email-address" editable={!person} testID="staff-email" /></Field>
        {!readOnly ? (
          <Field label={person ? "New password (leave empty to keep theirs)" : "Password"} error={password !== "" && password.length < 8 ? "Use at least 8 characters." : undefined} hint={person ? undefined : "They can use it to sign in right away."}>
            <View style={{ gap: 8 }}>
              <Input value={password} onChangeText={setPassword} secure testID="staff-password" />
              <Button size="sm" variant="glass" icon="key" title="Make a password" onPress={() => setPassword(generatePassword())} testID="staff-generate" />
            </View>
          </Field>
        ) : null}
        <Select label="Role" value={role} disabled={readOnly || self} testID="staff-role-select"
          options={(owner ? ["owner"] : [...ASSIGNABLE_ROLES]).map((r) => ({ value: r, label: roleLabel(r), hint: ROLE_DESCRIPTIONS[r] }))} onChange={setRole} />
        {self ? <Text variant="caption" tone="muted">{"You can't change your own role or switch yourself off."}</Text> : null}
        {!owner ? <OutletChoice outlets={outlets} value={outletIds} onChange={readOnly ? () => undefined : setOutletIds} /> : null}
        {person && !owner ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1 }}><Text variant="label">Can sign in</Text><Text variant="caption" tone="muted">Switch off to stop their access without deleting them.</Text></View>
            <AppSwitch value={isActive} onValueChange={setIsActive} disabled={readOnly || self} accessibilityLabel="Can sign in" testID="staff-active-switch" />
          </View>
        ) : null}
        {person ? <Text variant="caption" tone="muted">Last signed in {since(person.lastLoginAt)}.</Text> : null}
      </Sheet>
      <ConfirmSheet visible={confirm} title={`Remove ${person?.name ?? "this person"}?`} message="They lose access to your store at once. Their orders and history stay." confirm="Remove" busy={remove.isPending} onConfirm={() => remove.mutate(undefined)} onClose={() => setConfirm(false)} />
    </>
  );
}

/** Shown once after adding someone: the sign-in details, to send to them. */
function AddedSheet({ info, onClose }: { info: { email: string; password: string; name: string } | null; onClose: () => void }) {
  const send = async () => { if (info) { try { await Share.share({ message: `Your Rasoi Pulse sign-in\nEmail: ${info.email}\nPassword: ${info.password}` }); } catch { /* the person closed the share sheet */ } } };
  return (
    <Sheet visible={Boolean(info)} onClose={onClose} title="Person added" testID="staff-added"
      footer={<><Button title="Done" variant="glass" onPress={onClose} testID="staff-added-done" /><Button title="Send details" icon="share" onPress={() => void send()} testID="staff-added-send" /></>}>
      <Text>{info?.name} can sign in to the Rasoi Pulse apps with:</Text>
      <Glass><Text variant="label" testID="staff-added-email">{info?.email}</Text><Text variant="label" testID="staff-added-password">{info?.password}</Text></Glass>
      <Text variant="caption" tone="muted">This is the only time the password is shown. Send it now.</Text>
    </Sheet>
  );
}
