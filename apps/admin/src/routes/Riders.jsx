import { useState } from "react";
import { Bike, KeyRound, Pencil, Plus, Trash2 } from "lucide-react";
import { SettingsNav } from "../components/SubNav";
import { useAuth } from "../lib/useAuth";
import { useClearRiderPin, useCreateRider, useDeleteRider, useRiders, useSetRiderPin, useUpdateRider } from "../lib/useGrowth";
import { useOutlet } from "../lib/useOutlet";
import { useStorePlan } from "../lib/useStorePlan";
import { Button, Card, Empty, Field, Modal, Note, PageHeader, Pill, Table, Td, TextInput, Th, Toast } from "../ui";

/**
 * Settings → Delivery riders: the outlet's riders (name + phone). On the Orders page, "Out for delivery" asks which
 * of them is taking the order; the customer then sees that name and number. A rider can also be given a login for the
 * Rasoi Pulse RDA app (their phone number + a PIN set here) so they see their own deliveries on their phone.
 */

/** A PIN the manager can hand to the rider: 4 digits, never a run like 0000 or 1234 that anyone would try first. */
const suggestPin = () => {
  for (;;) {
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    if (!/^(\d)\1+$/.test(pin) && !"0123456789876543210".includes(pin)) return pin;
  }
};

/** Set or reset a rider's PIN. The PIN is shown here once, as it is typed: it is stored only as a hash and can't be looked up later. */
function PinDialog({ rider, busy, error, onSave, onClose }) {
  const [pin, setPin] = useState(() => suggestPin());
  const valid = /^\d{4,6}$/.test(pin);
  return (
    <Modal onClose={onClose} width={460} panelStyle={{ padding: 24, overflowY: "auto" }} ariaLabel={`Rider app login for ${rider.name}`}>
      <form onSubmit={(e) => { e.preventDefault(); if (valid) onSave(pin); }} style={{ display: "grid", gap: 14 }} data-testid="pin-dialog">
        <h2 style={{ margin: 0, fontSize: 18 }}>{rider.appLogin ? "New PIN" : "Rider app login"} for {rider.name}</h2>
        <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 13.5, lineHeight: 1.5 }}>
          {rider.name} signs in to the Rasoi Pulse RDA app with their phone number <strong>{rider.phone}</strong> and this PIN. Tell them the PIN yourself:
          it is not shown again{rider.appLogin ? ", and the old PIN stops working at once (they are signed out of the app)" : ""}.
        </p>
        <Field label="PIN (4 to 6 digits)" style={{ width: "100%" }}>
          <TextInput value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="off" aria-label="Rider PIN" data-testid="pin-input" style={{ letterSpacing: 4, fontSize: 18, fontWeight: 700 }} />
        </Field>
        {error ? <Toast kind="error">{error}</Toast> : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", marginTop: 4 }}>
          <Button type="button" variant="outline" onClick={() => setPin(suggestPin())}>Suggest another</Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={!valid || busy} data-testid="pin-save">{busy ? "Saving…" : rider.appLogin ? "Set new PIN" : "Turn on app login"}</Button>
        </div>
      </form>
    </Modal>
  );
}
export function Riders() {
  const { outlet } = useOutlet();
  const { can } = useAuth();
  const { hasFeature } = useStorePlan();
  const allowed = can("rider:manage") && hasFeature("delivery");
  const riders = useRiders(outlet, allowed);
  const create = useCreateRider(outlet);
  const update = useUpdateRider(outlet);
  const remove = useDeleteRider(outlet);
  const setPin = useSetRiderPin(outlet);
  const clearPin = useClearRiderPin(outlet);
  const [pinFor, setPinFor] = useState(null);
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
  const error = create.error?.message ?? update.error?.message ?? remove.error?.message ?? clearPin.error?.message;

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
                <Th width={150}>Rider app</Th>
                <Th width={280} align="right">Actions</Th>
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
                      <Td>{r.appLogin ? <Pill tone="ok">Login on</Pill> : <Pill tone="neutral">No login</Pill>}</Td>
                      <Td align="right">
                        <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          <Button variant="outline" onClick={() => setPinFor(r)} data-testid={`rider-pin-${r.name}`} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                            <KeyRound size={13} /> {r.appLogin ? "Reset PIN" : "App login"}
                          </Button>
                          {r.appLogin ? (
                            <Button variant="outline" onClick={() => { if (window.confirm(`Switch off ${r.name}'s app login? They are signed out of the app and can't sign in until you set a new PIN.`)) clearPin.mutate(r.id); }} data-testid={`rider-pin-off-${r.name}`}>Login off</Button>
                          ) : null}
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
        {pinFor ? (
          <PinDialog
            rider={pinFor}
            busy={setPin.isPending}
            error={setPin.error?.message}
            onClose={() => { setPinFor(null); setPin.reset(); }}
            onSave={(pin) => setPin.mutate({ id: pinFor.id, pin }, { onSuccess: () => { setPinFor(null); setPin.reset(); } })}
          />
        ) : null}
        <div style={{ marginTop: 12 }}>
          <Note>A rider needs a 10-digit phone number to get an app login: it is the name they sign in with. A rider who is switched off isn&apos;t offered when an order goes out. Removing a rider never changes past orders — each keeps the name and number it went out with.</Note>
        </div>
      </Card>
    </>
  );
}
