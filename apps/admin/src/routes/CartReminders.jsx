import { useEffect, useState } from "react";
import { CART_REMINDER_CHANNEL_LABELS, CART_REMINDER_CHANNELS, CART_REMINDER_VARIABLES, DEFAULT_CART_REMINDER, formatINR, renderTemplate } from "@rasoipulse/config-schema";
import { ShoppingCart } from "lucide-react";
import { SettingsNav } from "../components/SubNav";
import { useAuth } from "../lib/useAuth";
import { useCartReminders, useSaveCartReminders } from "../lib/useGrowth";
import { useOutlet } from "../lib/useOutlet";
import { Button, Card, Checkbox, Field, Note, PageHeader, Pill, Select, Table, Td, TextInput, Th, Toast } from "../ui";

const when = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—");

/**
 * Settings → Cart reminders (one setting for the whole store): a signed-in customer who leaves food in the cart gets
 * one WhatsApp / SMS nudge. Shows what the reminders achieved in the last 30 days.
 */
export function CartReminders() {
  const { outlet } = useOutlet();
  const { can } = useAuth();
  const allowed = can("settings:update");
  const data = useCartReminders(outlet, allowed);
  const save = useSaveCartReminders(outlet);
  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data.data && !draft) setDraft(data.data.settings);
  }, [data.data, draft]);

  const header = (
    <PageHeader
      title="Cart reminders"
      icon={<ShoppingCart size={23} />}
      subtitle="A gentle nudge to customers who left food in their cart without ordering — once, at a sensible hour."
    />
  );
  if (!allowed) return <>{header}<SettingsNav /><Card>Your role can&apos;t change store settings.</Card></>;
  if (!data.data || !draft) return <>{header}<SettingsNav /><Card>Loading…</Card></>;

  const { planAllows, stats, storeName } = data.data;
  const set = (patch) => {
    setSaved(false);
    setDraft((d) => ({ ...d, ...patch }));
  };
  const preview = renderTemplate(draft.message?.trim() || DEFAULT_CART_REMINDER, {
    name: "Aarav",
    items: "2× Veg Momos, 1× Masala Chai",
    total: "₹349",
    store: storeName || "Your store",
    outlet: outlet?.name ?? "Main",
    link: "https://your-store/main/order?cart=…",
  });

  return (
    <>
      {header}
      <SettingsNav />
      {!planAllows ? <Note>Abandoned-cart reminders aren&apos;t included in your plan. Contact Rasoi Pulse to add them.</Note> : null}

      <Card title="Reminders for this store">
        <div style={{ display: "flex", flexDirection: "column", gap: 14, opacity: planAllows ? 1 : 0.55 }}>
          <Checkbox checked={draft.enabled} onChange={(v) => set({ enabled: v })} label="Send cart reminders" disabled={!planAllows} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            <Field label="Remind after (minutes)" hint="How long the cart must sit untouched">
              <TextInput type="number" min={15} max={720} value={draft.delayMinutes} onChange={(e) => set({ delayMinutes: Number(e.target.value) || 30 })} disabled={!planAllows} aria-label="Remind after minutes" />
            </Field>
            <Field label="Send from" hint="India time">
              <TextInput type="time" value={draft.sendFrom} onChange={(e) => set({ sendFrom: e.target.value })} disabled={!planAllows} aria-label="Send from" />
            </Field>
            <Field label="Send until">
              <TextInput type="time" value={draft.sendUntil} onChange={(e) => set({ sendUntil: e.target.value })} disabled={!planAllows} aria-label="Send until" />
            </Field>
            <Field label="At most one per customer every (days)">
              <TextInput type="number" min={1} max={30} value={draft.minDaysBetween} onChange={(e) => set({ minDaysBetween: Number(e.target.value) || 3 })} disabled={!planAllows} aria-label="Days between reminders" />
            </Field>
          </div>
          <Field label="Send by">
            <Select value={draft.channel} onChange={(e) => set({ channel: e.target.value })} disabled={!planAllows} aria-label="Send by">
              {CART_REMINDER_CHANNELS.map((c) => <option key={c} value={c}>{CART_REMINDER_CHANNEL_LABELS[c]}</option>)}
            </Select>
          </Field>
          <Field label="Message" hint={`Variables: ${Object.keys(CART_REMINDER_VARIABLES).map((k) => `{{${k}}}`).join(" ")}`}>
            <textarea value={draft.message} onChange={(e) => set({ message: e.target.value })} rows={3} maxLength={600} placeholder={DEFAULT_CART_REMINDER} disabled={!planAllows} style={textarea} aria-label="Reminder message" />
          </Field>
          <div style={previewBox} data-testid="reminder-preview"><strong style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-muted)" }}>Preview</strong><br />{preview}</div>
          <Note>
            Only customers who signed in on your storefront can be reminded (we need their number). A cart older than a day is never reminded about, nobody gets more than one reminder in the days you set, and someone who orders is never reminded. SMS in India must match a DLT-registered template — write the message to match yours.
          </Note>
          {save.error ? <Toast kind="error">{save.error.message}</Toast> : null}
          {saved ? <Toast kind="ok">Saved</Toast> : null}
          <div>
            <Button disabled={!planAllows || save.isPending} onClick={() => save.mutate(draft, { onSuccess: (r) => { setDraft(r.settings); setSaved(true); } })} data-testid="save-reminders">
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Last 30 days">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }} data-testid="reminder-stats">
          <Pill tone="info">{stats.sent} sent</Pill>
          <Pill tone="ok">{stats.recovered} won back · {formatINR(stats.recoveredValue)}</Pill>
          {stats.failed ? <Pill tone="error">{stats.failed} couldn&apos;t be sent</Pill> : null}
          <Pill tone="neutral">{stats.waiting} carts waiting now</Pill>
        </div>
        {stats.recent.length ? (
          <Table minWidth={640}>
            <thead>
              <tr>
                <Th>Sent</Th>
                <Th>Customer</Th>
                <Th>Cart</Th>
                <Th align="right">Value</Th>
                <Th>Result</Th>
              </tr>
            </thead>
            <tbody>
              {stats.recent.map((r) => (
                <tr key={r.id}>
                  <Td nowrap>{when(r.remindedAt)}</Td>
                  <Td>{r.name || "—"} <span style={{ color: "var(--color-text-muted)", fontSize: 12 }}>{r.phone}</span></Td>
                  <Td>{r.items}</Td>
                  <Td align="right">{formatINR(r.value)}</Td>
                  <Td>{r.status === "recovered" ? <Pill tone="ok">Ordered · {formatINR(r.recoveredValue)}</Pill> : r.status === "failed" ? <Pill tone="error">Not sent</Pill> : <Pill tone="info">Sent by {r.channel === "linked" ? "WhatsApp" : "SMS"}</Pill>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 13 }}>No reminders have gone out yet.</p>
        )}
      </Card>
    </>
  );
}

const textarea = { width: "100%", boxSizing: "border-box", font: "inherit", fontSize: 13.5, padding: "9px 11px", borderRadius: 9, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)", resize: "vertical" };
const previewBox = { fontSize: 13.5, lineHeight: 1.5, padding: "10px 12px", borderRadius: 10, background: "color-mix(in srgb, var(--tone-success-wash) 70%, var(--color-surface))", border: "1px solid var(--color-border)" };
