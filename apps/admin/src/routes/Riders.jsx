import { useState } from "react";
import { Bike, Check, Copy, EllipsisVertical, Eye, EyeOff, KeyRound, Pencil, Plus, Power, ShieldOff, Trash2 } from "lucide-react";
import { SettingsNav } from "../components/SubNav";
import { useAuth } from "../lib/useAuth";
import { useClearRiderPin, useCreateRider, useDeleteRider, useRiderPin, useRiders, useSetRiderPin, useUpdateRider } from "../lib/useGrowth";
import { useOutlet } from "../lib/useOutlet";
import { useStorePlan } from "../lib/useStorePlan";
import { Button, Card, Empty, Field, Menu, Modal, Note, PageHeader, Pill, Table, Td, TextInput, Th, Toast } from "../ui";

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

/** Set or reset a rider's PIN. It is shown as it is typed (the manager has to tell it to the rider) and can be hidden; it can be looked up again later from the menu. */
function PinDialog({ rider, busy, error, onSave, onClose }) {
  const [pin, setPin] = useState(() => suggestPin());
  const [shown, setShown] = useState(true);
  const valid = /^\d{4,6}$/.test(pin);
  return (
    <Modal onClose={onClose} width={460} panelStyle={{ padding: 24, overflowY: "auto" }} ariaLabel={`Rider app login for ${rider.name}`}>
      <form onSubmit={(e) => { e.preventDefault(); if (valid) onSave(pin); }} style={{ display: "grid", gap: 14 }} data-testid="pin-dialog">
        <h2 style={{ margin: 0, fontSize: 18 }}>{rider.appLogin ? "New PIN" : "Rider app login"} for {rider.name}</h2>
        <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 13.5, lineHeight: 1.5 }}>
          {rider.name} signs in to the Rasoi Pulse RDA app with their phone number <strong>{rider.phone}</strong> and this PIN. Tell them the PIN yourself.
          You can look it up again later: open the <strong>⋮</strong> menu and choose <strong>Show PIN</strong>{rider.appLogin ? ". The old PIN stops working at once (they are signed out of the app)" : ""}.
        </p>
        <Field label="PIN (4 to 6 digits)" style={{ width: "100%" }}>
          <TextInput type={shown ? "text" : "password"} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="off" aria-label="Rider PIN" data-testid="pin-input" style={{ letterSpacing: 4, fontSize: 18, fontWeight: 700 }} />
        </Field>
        <div>
          <Button type="button" variant="outline" onClick={() => setShown((v) => !v)} aria-pressed={shown} data-testid="pin-toggle" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {shown ? <EyeOff size={14} /> : <Eye size={14} />} {shown ? "Hide PIN" : "Show PIN"}
          </Button>
        </div>
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
/**
 * "Show PIN": the PIN of a rider who has an app login, looked up from the server when this opens and forgotten when it closes. It starts hidden
 * (somebody may be standing behind the screen); Show reveals it, Copy puts it on the clipboard. A PIN set before PINs could be looked up
 * has no stored copy: the dialog says so and offers to set a new one.
 */
function ShowPinDialog({ rider, outlet, onSetNew, onClose }) {
  const q = useRiderPin(outlet, rider.id);
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);
  const pin = q.data?.pin ?? null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(pin); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* the PIN is on screen: it can still be read out */ }
  };
  return (
    <Modal onClose={onClose} width={440} panelStyle={{ padding: 24, overflowY: "auto" }} ariaLabel={`PIN of ${rider.name}`}>
      <div style={{ display: "grid", gap: 14 }} data-testid="show-pin-dialog">
        <h2 style={{ margin: 0, fontSize: 18 }}>PIN of {rider.name}</h2>
        {q.isLoading ? (
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>Looking it up…</p>
        ) : q.error ? (
          <Toast kind="error">{q.error.message}</Toast>
        ) : pin ? (
          <>
            <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 13.5, lineHeight: 1.5 }}>
              {rider.name} signs in to the Rasoi Pulse RDA app with their phone number <strong>{rider.phone}</strong> and this PIN.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: "1px solid var(--color-border)", borderRadius: 12, background: "var(--color-bg)" }}>
              <span data-testid="show-pin-value" aria-live="polite" style={{ flex: 1, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 28, fontWeight: 700, letterSpacing: "0.25em" }}>
                {shown ? pin : "•".repeat(pin.length)}
              </span>
              <Button type="button" variant="outline" onClick={() => setShown((v) => !v)} aria-pressed={shown} data-testid="show-pin-toggle" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {shown ? <EyeOff size={14} /> : <Eye size={14} />} {shown ? "Hide" : "Show"}
              </Button>
              <Button type="button" variant="outline" onClick={copy} data-testid="show-pin-copy" aria-label="Copy the PIN" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <Note>
              {q.data?.reason === "set_before"
                ? "This PIN was set before PINs could be looked up, so it can't be shown. Set a new PIN and it will show here from then on."
                : q.data?.reason === "unreadable"
                  ? "The stored PIN can't be read any more. Set a new PIN."
                  : `${rider.name} has no app login yet.`}
            </Note>
            <div><Button type="button" onClick={onSetNew} data-testid="show-pin-set-new">Set a new PIN</Button></div>
          </>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
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
  const [viewPinFor, setViewPinFor] = useState(null);
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
        {/* the fields drop the kit's bottom margin so the button lines up with the boxes, and the button is as tall as they are */}
        <form onSubmit={add} style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }} data-testid="add-rider-form">
          <Field label="Name" style={{ flex: "2 1 240px", marginBottom: 0, maxWidth: "none" }}>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Ramesh" aria-label="New rider name" />
          </Field>
          <Field label="Phone" style={{ flex: "2 1 220px", marginBottom: 0, maxWidth: "none" }}>
            <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} inputMode="tel" placeholder="98765 43210" aria-label="New rider phone" />
          </Field>
          <Button type="submit" disabled={!name.trim() || create.isPending} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: 35, minHeight: 35, padding: "0 18px", flex: "0 0 auto" }} data-testid="add-rider">
            <Plus size={15} /> {create.isPending ? "Adding…" : "Add rider"}
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
                <Th width={90} align="right">Actions</Th>
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
                        <Menu
                          width={250}
                          header={r.name}
                          trigger={({ toggle }) => (
                            <Button variant="outline" onClick={toggle} aria-label={`Actions for ${r.name}`} aria-haspopup="menu" data-testid={`rider-menu-${r.name}`} style={{ display: "inline-flex", alignItems: "center", padding: "0 8px", minHeight: 32 }}>
                              <EllipsisVertical size={16} />
                            </Button>
                          )}
                          options={[
                            ...(r.appLogin
                              ? [
                                  { value: "show-pin", label: "Show PIN", icon: <Eye size={15} />, description: "Look it up to tell the rider again", testId: `rider-showpin-${r.name}` },
                                  { value: "pin", label: "Reset PIN", icon: <KeyRound size={15} />, description: "The old PIN stops working at once", testId: `rider-pin-${r.name}` },
                                  { value: "login-off", label: "Switch off app login", icon: <ShieldOff size={15} />, testId: `rider-pin-off-${r.name}` },
                                ]
                              : [{ value: "pin", label: "Set up app login", icon: <KeyRound size={15} />, description: "Phone number + a PIN you choose", testId: `rider-pin-${r.name}` }]),
                            { value: "duty", label: r.isActive ? "Take off the duty list" : "Put on the duty list", icon: <Power size={15} />, description: r.isActive ? "Not offered when an order goes out" : "Offered again when an order goes out", testId: `rider-duty-${r.name}` },
                            { value: "edit", label: "Edit name and phone", icon: <Pencil size={15} />, testId: `rider-edit-${r.name}` },
                            { value: "remove", label: "Remove rider", icon: <Trash2 size={15} />, danger: true, testId: `rider-remove-${r.name}` },
                          ]}
                          onSelect={(v) => {
                            if (v === "show-pin") setViewPinFor(r);
                            else if (v === "pin") setPinFor(r);
                            else if (v === "login-off") { if (window.confirm(`Switch off ${r.name}'s app login? They are signed out of the app and can't sign in until you set a new PIN.`)) clearPin.mutate(r.id); }
                            else if (v === "duty") update.mutate({ id: r.id, body: { isActive: !r.isActive } });
                            else if (v === "edit") setEditing({ id: r.id, name: r.name, phone: r.phone });
                            else if (v === "remove") { if (window.confirm(`Remove ${r.name} from the list? Orders they delivered keep their name.`)) remove.mutate(r.id); }
                          }}
                        />
                      </Td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {viewPinFor ? (
          <ShowPinDialog
            rider={viewPinFor}
            outlet={outlet}
            onClose={() => setViewPinFor(null)}
            onSetNew={() => { setPinFor(viewPinFor); setViewPinFor(null); }}
          />
        ) : null}
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
