import { useState } from "react";
import { Bike, Pencil, Plus, Trash2 } from "lucide-react";
import { SettingsNav } from "../components/SubNav";
import { useAuth } from "../lib/useAuth";
import { useCreateRider, useDeleteRider, useRiders, useUpdateRider } from "../lib/useGrowth";
import { useOutlet } from "../lib/useOutlet";
import { useStorePlan } from "../lib/useStorePlan";
import { Button, Card, Empty, Field, Note, PageHeader, Pill, Table, Td, TextInput, Th, Toast } from "../ui";

/**
 * Settings → Delivery riders: the outlet's riders (name + phone). On the Orders page, "Out for delivery" asks which
 * of them is taking the order; the customer then sees that name and number. Riders don't sign in — this is a list.
 */
export function Riders() {
  const { outlet } = useOutlet();
  const { can } = useAuth();
  const { hasFeature } = useStorePlan();
  const allowed = can("rider:manage") && hasFeature("delivery");
  const riders = useRiders(outlet, allowed);
  const create = useCreateRider(outlet);
  const update = useUpdateRider(outlet);
  const remove = useDeleteRider(outlet);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [editing, setEditing] = useState(null);

  const header = <PageHeader title="Delivery riders" icon={<Bike size={23} />} subtitle="Who takes delivery orders out. The customer sees the rider's name and number while the food is on its way." />;
  if (!allowed) {
    return (
      <>
        {header}
        <SettingsNav />
        <Card>{hasFeature("delivery") ? "Your role can't manage riders." : "Delivery isn't included in your plan."}</Card>
      </>
    );
  }

  const add = (e) => {
    e.preventDefault();
    create.mutate({ name: name.trim(), phone: phone.trim() }, { onSuccess: () => { setName(""); setPhone(""); } });
  };
  const rows = riders.data?.riders ?? [];
  const error = create.error?.message ?? update.error?.message ?? remove.error?.message;

  return (
    <>
      {header}
      <SettingsNav />
      <Card title="Add a rider">
        <form onSubmit={add} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Field label="Name" style={{ flex: "1 1 200px" }}>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Ramesh" aria-label="New rider name" />
          </Field>
          <Field label="Phone" style={{ flex: "1 1 180px" }}>
            <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} inputMode="tel" placeholder="98765 43210" aria-label="New rider phone" />
          </Field>
          <Button type="submit" disabled={!name.trim() || create.isPending} style={{ display: "inline-flex", alignItems: "center", gap: 6 }} data-testid="add-rider">
            <Plus size={14} /> {create.isPending ? "Adding…" : "Add rider"}
          </Button>
        </form>
        {error ? <div style={{ marginTop: 10 }}><Toast kind="error">{error}</Toast></div> : null}
      </Card>

      <Card title={`Riders (${rows.length})`}>
        {riders.isLoading ? (
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>Loading…</p>
        ) : !rows.length ? (
          <Empty icon={<Bike size={28} />} title="No riders yet">Add the people who deliver for this outlet. You can still send an order out without one.</Empty>
        ) : (
          <Table minWidth={560}>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Phone</Th>
                <Th width={120}>Status</Th>
                <Th width={200} align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} data-testid={`rider-row-${r.name}`}>
                  {editing?.id === r.id ? (
                    <>
                      <Td>
                        <TextInput value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} aria-label="Rider name" />
                      </Td>
                      <Td>
                        <TextInput value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} aria-label="Rider phone" />
                      </Td>
                      <Td />
                      <Td align="right">
                        <span style={{ display: "inline-flex", gap: 6 }}>
                          <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                          <Button onClick={() => update.mutate({ id: r.id, body: { name: editing.name.trim(), phone: editing.phone.trim() } }, { onSuccess: () => setEditing(null) })} disabled={!editing.name.trim()}>
                            Save
                          </Button>
                        </span>
                      </Td>
                    </>
                  ) : (
                    <>
                      <Td><strong>{r.name}</strong></Td>
                      <Td>{r.phone || <span style={{ color: "var(--color-text-muted)" }}>—</span>}</Td>
                      <Td>{r.isActive ? <Pill tone="ok">On duty list</Pill> : <Pill tone="neutral">Switched off</Pill>}</Td>
                      <Td align="right">
                        <span style={{ display: "inline-flex", gap: 6 }}>
                          <Button variant="outline" onClick={() => update.mutate({ id: r.id, body: { isActive: !r.isActive } })}>{r.isActive ? "Switch off" : "Switch on"}</Button>
                          <Button variant="outline" onClick={() => setEditing({ id: r.id, name: r.name, phone: r.phone })} aria-label={`Edit ${r.name}`}><Pencil size={13} /></Button>
                          <Button variant="outline" onClick={() => { if (window.confirm(`Remove ${r.name} from the list? Orders they delivered keep their name.`)) remove.mutate(r.id); }} aria-label={`Remove ${r.name}`}>
                            <Trash2 size={13} />
                          </Button>
                        </span>
                      </Td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <div style={{ marginTop: 12 }}>
          <Note>A rider who is switched off isn&apos;t offered when an order goes out. Removing a rider never changes past orders — each keeps the name and number it went out with.</Note>
        </div>
      </Card>
    </>
  );
}
