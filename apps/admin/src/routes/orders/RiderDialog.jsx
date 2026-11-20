import { useState } from "react";
import { Bike, Phone, UserPlus } from "lucide-react";
import { useAssignRider, useCreateRider, useRiders } from "../../lib/useGrowth";
import { Button, Field, Modal, TextInput, Toast } from "../../ui";

/**
 * Who is taking a delivery order. Opened by the order's "Out for delivery" button (`sendOut`: the order goes out in
 * the same step) or by "Change" next to its rider. Pick a rider from the outlet's list, add a new one to the list
 * (managers), type a name and number just this once, or — when sending out — no rider at all.
 */
export function RiderDialog({ outlet, order, sendOut, canManageRiders, onClose }) {
  const riders = useRiders(outlet);
  const assign = useAssignRider(outlet);
  const create = useCreateRider(outlet);
  const active = (riders.data?.riders ?? []).filter((r) => r.isActive);
  const [choice, setChoice] = useState(order.rider?.riderId ?? (sendOut ? "" : "other"));
  const [name, setName] = useState(order.rider && !order.rider.riderId ? order.rider.name : "");
  const [phone, setPhone] = useState(order.rider && !order.rider.riderId ? order.rider.phone : "");
  const [save, setSave] = useState(canManageRiders);

  const typed = choice === "other";
  const ready = typed ? name.trim().length > 0 : sendOut || Boolean(choice);
  const busy = assign.isPending || create.isPending;
  const error = assign.error?.message ?? create.error?.message;

  const submit = async () => {
    let body;
    if (typed) {
      if (save && canManageRiders) {
        // put them on the list for next time, then hand the order to them
        const { rider } = await create.mutateAsync({ name: name.trim(), phone: phone.trim() });
        body = { riderId: rider.id };
      } else body = { name: name.trim(), phone: phone.trim() };
    } else body = choice ? { riderId: choice } : { riderId: null };
    await assign.mutateAsync({ id: order.id, body: { ...body, sendOut } });
    onClose();
  };

  return (
    <Modal onClose={onClose} width={440} ariaLabel={sendOut ? "Send out for delivery" : "Change rider"}>
      <div style={{ padding: "20px 22px 4px" }} data-testid="rider-dialog">
        <h3 style={{ margin: 0, fontSize: 17, fontFamily: "var(--font-heading)", display: "flex", alignItems: "center", gap: 8 }}>
          <Bike size={18} /> {sendOut ? `Order #${order.orderNumber} — out for delivery` : `Rider for order #${order.orderNumber}`}
        </h3>
        <p style={{ margin: "6px 0 14px", fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
          {sendOut ? "Who is taking it? The customer is told it's on the way — with the rider's name and number." : "The customer's order page shows the new rider straight away."}
        </p>

        <div role="radiogroup" aria-label="Rider" style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
          {active.map((r) => (
            <Choice key={r.id} checked={choice === r.id} onSelect={() => setChoice(r.id)} testId={`rider-option-${r.name}`}>
              <strong>{r.name}</strong>
              {r.phone ? (
                <span style={{ color: "var(--color-text-muted)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Phone size={11} /> {r.phone}
                </span>
              ) : null}
            </Choice>
          ))}
          {riders.isLoading ? <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Loading riders…</span> : null}
          {!riders.isLoading && !active.length ? (
            <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>No riders on this outlet&apos;s list yet{canManageRiders ? " — add one below." : "."}</span>
          ) : null}
          <Choice checked={typed} onSelect={() => setChoice("other")} testId="rider-option-other">
            <UserPlus size={13} /> {canManageRiders ? "Someone new" : "Someone else"}
          </Choice>
          {sendOut ? (
            <Choice checked={choice === ""} onSelect={() => setChoice("")} testId="rider-option-none">
              <span style={{ color: "var(--color-text-muted)" }}>No rider — just mark it out for delivery</span>
            </Choice>
          ) : null}
        </div>

        {typed ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
            <Field label="Name">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus aria-label="Rider name" />
            </Field>
            <Field label="Phone">
              <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} inputMode="tel" aria-label="Rider phone" />
            </Field>
            {canManageRiders ? (
              <label style={{ gridColumn: "1 / -1", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} /> Add them to the rider list
              </label>
            ) : null}
          </div>
        ) : null}

        {error ? <div style={{ marginTop: 12 }}><Toast kind="error">{error}</Toast></div> : null}
      </div>
      <footer style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "16px 22px 18px" }}>
        <Button variant="outline" type="button" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" onClick={submit} disabled={!ready || busy} data-testid="rider-submit">
          {busy ? "Saving…" : sendOut ? "Send out" : "Save rider"}
        </Button>
      </footer>
    </Modal>
  );
}

function Choice({ checked, onSelect, children, testId }) {
  return (
    <label
      data-testid={testId}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "9px 12px",
        borderRadius: 10,
        border: `1.5px solid ${checked ? "var(--color-primary)" : "var(--color-border)"}`,
        background: checked ? "color-mix(in srgb, var(--color-primary) 7%, var(--color-surface))" : "var(--color-surface)",
        cursor: "pointer",
        fontSize: 13.5,
        flexWrap: "wrap",
      }}
    >
      <input type="radio" checked={checked} onChange={onSelect} style={{ margin: 0 }} />
      {children}
    </label>
  );
}
