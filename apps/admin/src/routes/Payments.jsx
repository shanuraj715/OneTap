import { useEffect, useState } from "react";
                                           
import {
  GATEWAY_DESCRIPTIONS,
  GATEWAY_LABELS,
               
                       
} from "@onetap/config-schema";
                                                
import { useAuth } from "../lib/useAuth";
import { useOutlet, usePatchConfig } from "../lib/useOutlet";
import { useClearPaymentConfig, usePaymentConfig, useSavePaymentConfig } from "../lib/usePayments";
import { Button, Card, Field, PageHeader, TextInput, Toast } from "../ui";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3072";

export function Payments() {
  const { outlet } = useOutlet();
  const { can } = useAuth();
  const canRead = can("payment-config:read");
  const canManage = can("payment-config:manage");
  const config = usePaymentConfig(outlet, canRead);
  const patch = usePatchConfig();
  const [enabled, setEnabled] = useState                  (null);

  // Re-syncs whenever the selected outlet actually changes, not just once —
  // switching in the sidebar doesn't unmount this page. Keyed on outlet?._id
  // (not the outlet object, which gets a new reference on every background
  // refetch) so an in-progress edit on the same outlet is never stomped.
  useEffect(() => {
    if (outlet) setEnabled(outlet.config.payments.enabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlet?._id]);

  if (!canRead) {
    return (
      <>
        <PageHeader title="Payments" />
        <Card>Your role can&apos;t view payment settings.</Card>
      </>
    );
  }
  if (!outlet || !enabled) {
    return (
      <>
        <PageHeader title="Payments" />
        <Card>Seed an outlet from the Dashboard first.</Card>
      </>
    );
  }

  const gateways = config.data?.gateways ?? [];
  const dirty = JSON.stringify(enabled) !== JSON.stringify(outlet.config.payments.enabled);
  const toggle = (g         ) =>
    setEnabled((prev) => (prev .includes(g) ? prev .filter((x) => x !== g) : [...prev , g]));

  const saveEnabled = () =>
    patch.mutate({
      outlet,
      patch: { payments: { ...outlet.config.payments, enabled }                    },
    });

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Your own gateway account — money settles directly to you. TablePe never holds funds."
      />

      <Card title="Offered at checkout">
        <p style={hint}>Diners see these in this order. A gateway must be configured before it can be offered.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {gateways.map((g) => (
            <label key={g.gateway} style={{ ...row, opacity: g.available ? 1 : 0.5 }}>
              <input
                type="checkbox"
                checked={enabled.includes(g.gateway)}
                disabled={!canManage || !g.configured || !g.available}
                onChange={() => toggle(g.gateway)}
              />
              <span style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{GATEWAY_LABELS[g.gateway]}</span>
                <span style={{ ...hint, display: "block", margin: 0 }}>{GATEWAY_DESCRIPTIONS[g.gateway]}</span>
              </span>
              <span style={{ ...pill, ...(g.configured ? pillOk : pillWarn) }}>
                {g.configured ? "configured" : "needs keys"}
              </span>
            </label>
          ))}
        </div>
        {canManage ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
            <Button onClick={saveEnabled} disabled={!dirty || patch.isPending}>
              {patch.isPending ? "Saving…" : "Save"}
            </Button>
            {dirty ? <span style={hint}>Unsaved changes</span> : null}
          </div>
        ) : null}
        {patch.error ? <Toast kind="error">{(patch.error         ).message}</Toast> : null}
      </Card>

      {gateways
        .filter((g) => g.fields.length > 0)
        .map((g) => (
          <CredentialCard key={g.gateway} gateway={g} outletId={outlet._id} canManage={canManage} />
        ))}

      <Card title="Security">
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.8, color: "var(--color-text-muted)" }}>
          <li>Secret keys are encrypted (AES-256-GCM) before they touch the database and are never sent back to this page.</li>
          <li>Card details never reach TablePe&apos;s servers — the gateway&apos;s own checkout collects them.</li>
          <li>Webhooks are signature-verified and de-duplicated, so a retry can&apos;t settle an order twice.</li>
        </ul>
      </Card>
    </>
  );
}

function CredentialCard({
  gateway,
  outletId,
  canManage,
}   
                         
                   
                     
 ) {
  const { outlet } = useOutlet();
  const save = useSavePaymentConfig(outlet);
  const clear = useClearPaymentConfig(outlet);
  const [values, setValues] = useState                        ({});

  const webhookUrl = `${API_BASE}/api/payments/webhook/${gateway.gateway}`;

  return (
    <Card title={GATEWAY_LABELS[gateway.gateway]}>
      <p style={hint}>{GATEWAY_DESCRIPTIONS[gateway.gateway]}</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        {gateway.fields.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint} info={f.info} style={{ maxWidth: "none" }}>
            <TextInput
              type={f.secret ? "password" : "text"}
              value={values[f.key] ?? (f.secret ? "" : f.value)}
              placeholder={f.secret && f.isSet ? `saved · ${f.value}` : ""}
              disabled={!canManage}
              onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            />
          </Field>
        ))}

        {gateway.gateway === "razorpay" ? (
          <Field
            label="Webhook URL"
            hint="Add this in your Razorpay dashboard under Settings → Webhooks"
            info="Razorpay calls this address to tell us a payment succeeded or failed. Without it, an order paid by a customer whose phone died mid-payment stays marked unpaid until somebody checks the Razorpay dashboard by hand."
            style={{ maxWidth: "none", gridColumn: "1 / -1" }}
          >
            <code style={codeBox}>{webhookUrl}</code>
          </Field>
        ) : null}
      </div>

      {canManage ? (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Button
            onClick={() => save.mutate({ gateway: gateway.gateway, values }, { onSuccess: () => setValues({}) })}
            disabled={save.isPending || Object.keys(values).length === 0}
          >
            {save.isPending ? "Saving…" : "Save keys"}
          </Button>
          {gateway.configured ? (
            <Button
              variant="outline"
              onClick={() => window.confirm(`Remove ${GATEWAY_LABELS[gateway.gateway]} keys?`) && clear.mutate(gateway.gateway)}
            >
              Remove
            </Button>
          ) : null}
          <span style={hint}>Leave a secret blank to keep the saved value. Outlet {outletId.slice(-6)}.</span>
        </div>
      ) : null}
      {save.isSuccess ? <Toast kind="ok">Saved and encrypted.</Toast> : null}
      {save.error ? <Toast kind="error">{(save.error         ).message}</Toast> : null}
    </Card>
  );
}

const hint                = { fontSize: 12.5, color: "var(--color-text-muted)", margin: "-4px 0 12px", lineHeight: 1.5 };
const row                = {
  display: "flex",
  alignItems: "flex-start",
  gap: 11,
  padding: "12px 14px",
  border: "1px solid var(--color-border)",
  borderRadius: 9,
  background: "var(--color-bg)",
  cursor: "pointer",
};
const pill                = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  padding: "3px 9px",
  borderRadius: 999,
  whiteSpace: "nowrap",
};
const pillOk                = { background: "var(--tone-success-wash)", color: "var(--tone-success)" };
const pillWarn                = { background: "var(--tone-warning-wash)", color: "var(--tone-warning)" };
const codeBox                = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12,
  padding: "9px 11px",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  display: "block",
  overflowX: "auto",
};
