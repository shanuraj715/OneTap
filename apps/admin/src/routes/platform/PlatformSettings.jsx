import { useEffect, useState } from "react";
import { Check, Globe, Settings as SettingsIcon, X } from "lucide-react";
import * as api from "../../lib/api";
import { usePlatformMutation, usePlatformSettings } from "../../lib/usePlatform";
import { Button, Card, Field, Note, PageHeader, TextInput, Toast } from "../../ui";
import { muted } from "./shared";

/** Platform-wide settings. */
export function PlatformSettings() {
  const q = usePlatformSettings();
  const [graceDays, setGraceDays] = useState("");
  const save = usePlatformMutation(() => api.updatePlatformSettings({ graceDays: Number(graceDays) }));

  useEffect(() => {
    if (q.data) setGraceDays(String(q.data.settings.graceDays));
  }, [q.data]);

  const valid = /^\d+$/.test(graceDays) && Number(graceDays) <= 365;

  // the domain stores' TablePe addresses live under
  const [base, setBase] = useState("");
  const saveBase = usePlatformMutation(() => api.updatePlatformSettings({ subdomainBase: base }));
  const probe = usePlatformMutation(api.probeSubdomains);
  useEffect(() => {
    if (q.data) setBase(q.data.settings.subdomainBase ?? "");
  }, [q.data]);
  const savedBase = q.data?.settings.subdomainBase ?? "";

  return (
    <>
      <PageHeader title="Platform settings" icon={<SettingsIcon size={23} />} />
      <Card
        title="Grace period"
        subtitle="When a store goes over its plan's limits (for example after moving to a smaller plan), everything keeps working for this many days. After that the store is flagged “Over limit” and you choose what to block — nothing is ever blocked or deleted automatically."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
          style={{ display: "flex", gap: 12, alignItems: "flex-end" }}
        >
          <Field label="Days" hint="0–365">
            <TextInput type="number" min={0} max={365} value={graceDays} onChange={(e) => setGraceDays(e.target.value)} style={{ width: 110 }} />
          </Field>
          <div style={{ marginBottom: 14 }}>
            <Button type="submit" disabled={!valid || save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
        <p style={muted}>Applies to every store, including ones already in a grace period.</p>
        {save.error ? <Toast kind="error">{save.error.message}</Toast> : null}
        {save.isSuccess && !save.isPending ? <Toast kind="ok">Saved.</Toast> : null}
      </Card>

      <Card
        title="Store addresses"
        icon={<Globe size={16} />}
        subtitle="Every store without its own domain opens on a TablePe address — acme.yourdomain.com. You create, rename and remove these on each store's Domains tab; there is nothing to install per store."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveBase.mutate(undefined, { onSuccess: () => probe.reset() });
          }}
          style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}
        >
          <Field label="Base domain" hint="e.g. tablepe.in — a store named acme opens on acme.tablepe.in">
            <TextInput value={base} onChange={(e) => setBase(e.target.value)} placeholder="tablepe.in" style={{ width: 280 }} maxLength={253} />
          </Field>
          <div style={{ marginBottom: 14 }}>
            <Button type="submit" disabled={saveBase.isPending || base.trim() === savedBase}>
              {saveBase.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
        {saveBase.error ? <Toast kind="error">{saveBase.error.message}</Toast> : null}
        {saveBase.isSuccess && !saveBase.isPending ? <Toast kind="ok">Saved.</Toast> : null}
        <p style={muted}>
          Use a domain separate from your marketing site and dashboard. It's set up once on the server — a wildcard DNS record, one wildcard certificate and one
          nginx block (steps in <code>deploy/wildcard-subdomains.md</code>). After that, no store ever needs server work.
        </p>

        {savedBase ? (
          <div style={{ marginTop: 14 }}>
            <Button variant="outline" disabled={probe.isPending} onClick={() => probe.mutate()}>
              {probe.isPending ? "Checking…" : "Check the server setup"}
            </Button>
            {probe.error ? <Toast kind="error">{probe.error.message}</Toast> : null}
            {probe.data ? <ProbeResult status={probe.data.status} base={savedBase} /> : null}
          </div>
        ) : null}
      </Card>
    </>
  );
}

/** What a visitor's browser would run into on an address under the base domain, step by step. */
function ProbeResult({ status, base }) {
  const steps = [
    { ok: status.dns, label: `DNS: *.${base} points to a server`, detail: status.dns ? status.addresses.join(", ") : "Add a wildcard A record (*) for the base domain." },
    {
      ok: status.dns && status.tls === true,
      label: "HTTPS: the certificate covers any subdomain",
      detail: !status.dns ? "" : status.tls === true ? "" : status.tls === false ? "The server answered, but without a valid wildcard certificate." : "Nothing answered on port 443.",
    },
    {
      ok: status.state === "live",
      label: "The storefront answers",
      detail: status.state === "live" ? "" : status.state === "error" ? `It answered with an error (${status.httpStatus}).` : "",
    },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
      {steps.map((s) => (
        <div key={s.label} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13.5 }}>
          {s.ok ? <Check size={16} color="var(--tone-ok, #1a7f37)" style={{ marginTop: 2 }} /> : <X size={16} color="var(--tone-error, #c0392b)" style={{ marginTop: 2 }} />}
          <span>
            {s.label}
            {s.detail ? <span style={muted}> — {s.detail}</span> : null}
          </span>
        </div>
      ))}
      {status.state === "live" ? <Note>All set — any address under {base} will open its store as soon as you create it.</Note> : null}
    </div>
  );
}
