import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  NOTIFY_VARIABLE_HINTS,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  renderTemplate,
  sampleNotifyValues,
  type NotifyOrderChannel,
  type OrderStatus,
  type OutletConfig,
  type SmsEventTemplate,
  type WhatsAppEventTemplate,
} from "@onetap/config-schema";
import { AlertTriangle, Bell, CheckCircle2, Filter, MessageCircle, MessagesSquare, ScrollText, XCircle } from "lucide-react";
import type { NotifyChannelConfig } from "../lib/api";
import { useAuth } from "../lib/useAuth";
import { useNotificationLogs, useClearNotifyConfig, useNotifyConfig, useSaveNotifyConfig } from "../lib/useNotify";
import { useOutlet, usePatchConfig } from "../lib/useOutlet";
import { Button, Card, Checkbox, Empty, Field, MultiFilter, Note, PageHeader, Table, Td, Tabs, TextInput, Th, Toast } from "../ui";

type Tab = "whatsapp" | "sms" | "logs";

export function Notifications() {
  const { outlet } = useOutlet();
  const { can } = useAuth();
  const canRead = can("notification-config:read");
  const [tab, setTab] = useState<Tab>("whatsapp");

  if (!canRead) {
    return (
      <>
        <PageHeader title="Notifications" />
        <Card>Your role can&apos;t view notification settings.</Card>
      </>
    );
  }
  if (!outlet) {
    return (
      <>
        <PageHeader title="Notifications" />
        <Card>Seed an outlet from the Dashboard first.</Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        icon={<Bell size={23} />}
        subtitle="Order-lifecycle alerts to the customer over WhatsApp or SMS."
      />

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "whatsapp", label: "WhatsApp", icon: <MessageCircle size={14} /> },
          { id: "sms", label: "SMS", icon: <MessagesSquare size={14} /> },
          { id: "logs", label: "Logs", icon: <ScrollText size={14} /> },
        ]}
      />

      {tab === "whatsapp" ? <ChannelSettings channel="whatsapp" /> : null}
      {tab === "sms" ? <ChannelSettings channel="sms" /> : null}
      {tab === "logs" ? <LogsTab /> : null}
    </>
  );
}

/* ------------------------------------------------------------------ channel */

function ChannelSettings({ channel }: { channel: NotifyOrderChannel }) {
  const { outlet } = useOutlet();
  const { can } = useAuth();
  const canManage = can("notification-config:manage");
  const config = useNotifyConfig(outlet, true);
  const patch = usePatchConfig();

  const settingsPath = outlet!.config.orderNotify[channel];
  const [draft, setDraft] = useState<OutletConfig["orderNotify"]["whatsapp" | "sms"] | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setDraft(settingsPath);
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, outlet?._id]);

  const chan = config.data?.channels.find((c) => c.channel === channel);

  if (!draft) return null;

  const toggleEvent = (status: OrderStatus) => {
    const events = draft.events.includes(status) ? draft.events.filter((s) => s !== status) : [...draft.events, status];
    setDraft({ ...draft, events });
    setDirty(true);
  };

  const setTemplate = (status: OrderStatus, patchValue: Partial<WhatsAppEventTemplate & SmsEventTemplate>) => {
    setDraft({
      ...draft,
      templates: {
        ...draft.templates,
        [status]: { ...(draft.templates[status] as object), ...patchValue },
      },
    } as typeof draft);
    setDirty(true);
  };

  const save = () =>
    patch.mutate(
      { outlet: outlet!, patch: { orderNotify: { ...outlet!.config.orderNotify, [channel]: draft } } },
      { onSuccess: () => setDirty(false) },
    );

  return (
    <>
      {chan ? <CredentialCard channel={channel} config={chan} canManage={canManage} /> : null}

      <Card
        title={`${channel === "whatsapp" ? "WhatsApp" : "SMS"} alerts`}
        subtitle="Which order statuses send a message, and what it says."
      >
        <Checkbox
          checked={draft.enabled}
          onChange={(v) => {
            setDraft({ ...draft, enabled: v });
            setDirty(true);
          }}
          label={`Send ${channel === "whatsapp" ? "WhatsApp" : "SMS"} alerts`}
          info="With this off, nothing is ever sent on this channel, whatever the statuses below say."
        />

        {draft.enabled ? (
          <>
            <div style={{ marginTop: 14, marginBottom: 4, fontSize: 12.5, fontWeight: 600, color: "var(--color-text-muted)" }}>
              Send an alert when the order becomes:
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
              {ORDER_STATUSES.map((s) => (
                <label key={s} style={{ ...eventChip, ...(draft.events.includes(s) ? eventChipActive : {}) }}>
                  <input type="checkbox" checked={draft.events.includes(s)} onChange={() => toggleEvent(s)} style={{ display: "none" }} />
                  {ORDER_STATUS_LABELS[s]}
                </label>
              ))}
            </div>
          </>
        ) : null}

        {canManage ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
            <Button onClick={save} disabled={!dirty || patch.isPending}>
              {patch.isPending ? "Saving…" : "Save"}
            </Button>
            {dirty ? <span style={hint}>Unsaved changes</span> : null}
          </div>
        ) : null}
        {patch.error ? <Toast kind="error">{(patch.error as Error).message}</Toast> : null}
      </Card>

      {draft.enabled && draft.events.length > 0 ? (
        <Card title="Message templates" subtitle="One message per status that's switched on above.">
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {draft.events.map((status) => (
              <TemplateEditor
                key={status}
                channel={channel}
                status={status}
                outletName={outlet!.config.identity.name}
                value={draft.templates[status] as (WhatsAppEventTemplate & SmsEventTemplate) | undefined}
                onChange={(v) => setTemplate(status, v)}
                disabled={!canManage}
              />
            ))}
          </div>
        </Card>
      ) : null}
    </>
  );
}

function TemplateEditor({
  channel,
  status,
  outletName,
  value,
  onChange,
  disabled,
}: {
  channel: NotifyOrderChannel;
  status: OrderStatus;
  outletName: string;
  value?: Partial<WhatsAppEventTemplate & SmsEventTemplate>;
  onChange: (v: Partial<WhatsAppEventTemplate & SmsEventTemplate>) => void;
  disabled: boolean;
}) {
  return (
    <div style={templateBox}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>{ORDER_STATUS_LABELS[status]}</div>

      {channel === "whatsapp" ? (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Field
            label="Template name"
            info="The exact name of the template Meta has approved for this message — WhatsApp only accepts pre-approved templates, not free text."
            style={{ flex: "1 1 220px" }}
          >
            <TextInput
              value={value?.templateName ?? ""}
              disabled={disabled}
              placeholder="order_ready_v1"
              onChange={(e) => onChange({ templateName: e.target.value })}
            />
          </Field>
          <Field label="Language code" info="The template's approved language, e.g. en or en_US." style={{ width: 140 }}>
            <TextInput
              value={value?.languageCode ?? "en"}
              disabled={disabled}
              onChange={(e) => onChange({ languageCode: e.target.value })}
            />
          </Field>
        </div>
      ) : (
        <>
          <Field
            label="Message"
            info={`Placeholders: ${Object.entries(NOTIFY_VARIABLE_HINTS).map(([k, v]) => `{{${k}}} (${v})`).join(", ")}`}
          >
            <textarea
              value={value?.body ?? ""}
              disabled={disabled}
              placeholder="Hi {{customerName}}, your order #{{orderNumber}} at {{outletName}} is {{statusLabel}}."
              onChange={(e) => onChange({ body: e.target.value })}
              rows={2}
              style={textarea}
            />
          </Field>
          <Field label="DLT template ID" hint="Optional — kept for your own reference" info="The DLT-registered template id this text corresponds to, per TRAI regulations for commercial SMS in India.">
            <TextInput value={value?.dltTemplateId ?? ""} disabled={disabled} onChange={(e) => onChange({ dltTemplateId: e.target.value })} />
          </Field>
          {value?.body ? (
            <div style={preview}>
              <span style={{ fontWeight: 700, marginRight: 6 }}>Preview:</span>
              {renderTemplate(value.body, sampleNotifyValues(outletName))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function CredentialCard({
  channel,
  config,
  canManage,
}: {
  channel: NotifyOrderChannel;
  config: NotifyChannelConfig;
  canManage: boolean;
}) {
  const { outlet } = useOutlet();
  const save = useSaveNotifyConfig(outlet);
  const clear = useClearNotifyConfig(outlet);
  const [values, setValues] = useState<Record<string, string>>({});

  return (
    <Card title="Connection" subtitle={config.configured ? "Configured" : "Not configured yet"}>
      {config.fields.map((f) => (
        <Field key={f.key} label={f.label} hint={f.hint} info={f.info}>
          {f.multiline ? (
            <textarea
              value={values[f.key] ?? (f.secret ? "" : f.value)}
              placeholder={f.placeholder ?? (f.secret && f.isSet ? `saved · ${f.value}` : "")}
              disabled={!canManage}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              rows={2}
              style={textarea}
            />
          ) : (
            <TextInput
              type={f.secret ? "password" : "text"}
              value={values[f.key] ?? (f.secret ? "" : f.value)}
              placeholder={f.placeholder ?? (f.secret && f.isSet ? `saved · ${f.value}` : "")}
              disabled={!canManage}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            />
          )}
        </Field>
      ))}

      {canManage ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Button
            onClick={() => save.mutate({ channel, values }, { onSuccess: () => setValues({}) })}
            disabled={save.isPending || Object.keys(values).length === 0}
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          {config.configured ? (
            <Button
              variant="outline"
              onClick={() => window.confirm(`Remove ${channel} credentials?`) && clear.mutate(channel)}
            >
              Remove
            </Button>
          ) : null}
        </div>
      ) : null}
      {save.isSuccess ? <Toast kind="ok">Saved and encrypted.</Toast> : null}
      {save.error ? <Toast kind="error">{(save.error as Error).message}</Toast> : null}
    </Card>
  );
}

/* --------------------------------------------------------------------- logs */

const STATUS_ICON: Record<"sent" | "failed" | "skipped", { icon: typeof CheckCircle2; color: string }> = {
  sent: { icon: CheckCircle2, color: "var(--tone-success)" },
  failed: { icon: XCircle, color: "var(--tone-danger)" },
  skipped: { icon: AlertTriangle, color: "var(--tone-warning)" },
};

function LogsTab() {
  const { outlet } = useOutlet();
  const [channels, setChannels] = useState<NotifyOrderChannel[]>([]);
  const [statuses, setStatuses] = useState<("sent" | "failed" | "skipped")[]>([]);
  const [events, setEvents] = useState<OrderStatus[]>([]);

  const logs = useNotificationLogs(outlet, {
    channel: channels.length === 1 ? channels[0] : undefined,
    status: statuses.length === 1 ? statuses[0] : undefined,
    event: events.length === 1 ? events[0] : undefined,
  });

  const rows = (logs.data?.logs ?? []).filter(
    (l) => (channels.length === 0 || channels.includes(l.channel)) && (statuses.length === 0 || statuses.includes(l.status)) && (events.length === 0 || events.includes(l.event)),
  );

  return (
    <Card title="Delivery log" subtitle="Every alert attempted, and why one didn't go out.">
      <Note icon={<Filter size={15} />}>
        A misconfigured or unreachable channel never blocks an order — it lands here as <strong>failed</strong> or{" "}
        <strong>skipped</strong> instead, so the order flow always completes.
      </Note>

      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <MultiFilter
          label="Channel"
          options={[
            { value: "whatsapp", label: "WhatsApp" },
            { value: "sms", label: "SMS" },
          ]}
          value={channels}
          onChange={setChannels}
        />
        <MultiFilter
          label="Result"
          options={[
            { value: "sent", label: "Sent" },
            { value: "failed", label: "Failed" },
            { value: "skipped", label: "Skipped" },
          ]}
          value={statuses}
          onChange={setStatuses}
        />
        <MultiFilter
          label="Order status"
          options={ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] }))}
          value={events}
          onChange={setEvents}
        />
      </div>

      {logs.isLoading ? (
        <p style={{ margin: 0, color: "var(--color-text-muted)" }}>Loading…</p>
      ) : rows.length === 0 ? (
        <Empty icon={<ScrollText size={28} />} title="No alerts yet">
          Once WhatsApp or SMS is switched on, every attempt shows up here.
        </Empty>
      ) : (
        <Table minWidth={860}>
          <thead>
            <tr>
              <Th width={70}>Result</Th>
              <Th width={90}>Channel</Th>
              <Th width={110}>Order</Th>
              <Th width={110}>Status</Th>
              <Th>To</Th>
              <Th>Detail</Th>
              <Th width={140}>When</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const s = STATUS_ICON[l.status];
              const Icon = s.icon;
              return (
                <tr key={l.id}>
                  <Td>
                    <span title={l.status} style={{ display: "inline-flex", alignItems: "center", gap: 5, color: s.color, fontWeight: 600, fontSize: 12 }}>
                      <Icon size={13} /> {l.status}
                    </span>
                  </Td>
                  <Td>{l.channel === "whatsapp" ? "WhatsApp" : "SMS"}</Td>
                  <Td nowrap>{l.orderNumber ? `#${l.orderNumber}` : "—"}</Td>
                  <Td>{ORDER_STATUS_LABELS[l.event]}</Td>
                  <Td nowrap>{l.to || "—"}</Td>
                  <Td>
                    <span style={{ color: l.status === "sent" ? "var(--color-text-muted)" : "var(--color-text)", fontSize: 12.5 }}>
                      {l.status === "sent" ? l.providerMessageId ?? "delivered to provider" : l.error}
                    </span>
                  </Td>
                  <Td nowrap>{new Date(l.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

const hint: CSSProperties = { fontSize: 12.5, color: "var(--color-text-muted)" };
const eventChip: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  padding: "6px 12px",
  borderRadius: 999,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text-muted)",
  cursor: "pointer",
  userSelect: "none",
};
const eventChipActive: CSSProperties = {
  borderColor: "var(--color-primary)",
  background: "color-mix(in srgb, var(--color-primary) 12%, var(--color-bg))",
  color: "var(--color-primary)",
};
const templateBox: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: 9,
  padding: "14px 16px",
  background: "var(--color-bg)",
};
const textarea: CSSProperties = {
  width: "100%",
  font: "inherit",
  fontSize: 13.5,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  resize: "vertical",
};
const preview: CSSProperties = {
  marginTop: 4,
  fontSize: 12.5,
  padding: "8px 10px",
  borderRadius: 8,
  background: "var(--color-surface)",
  border: "1px dashed var(--color-border)",
  color: "var(--color-text-muted)",
};
