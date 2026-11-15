import { useEffect, useState } from "react";
import { Check, Globe, Settings as SettingsIcon, X } from "lucide-react";
import * as api from "../../lib/api";
import { usePlatformMutation, usePlatformSettings } from "../../lib/usePlatform";
import { Button, Card, Field, Note, PageHeader, TextInput, Toast } from "../../ui";
import { CacheSettingsCard } from "./CachePanels";
import { browserCanOpen, describeHttpError, muted, row, SERVER_CHECK_FAILED } from "./shared";

/** Platform-wide settings. */
export function PlatformSettings() {
  const q = usePlatformSettings();
  const [graceDays, setGraceDays] = useState("");
  const save = usePlatformMutation(() => api.updatePlatformSettings({ graceDays: Number(graceDays) }));

  useEffect(() => {
    if (q.data) setGraceDays(String(q.data.settings.graceDays));
  }, [q.data]);

  const valid = /^\d+$/.test(graceDays) && Number(graceDays) <= 365;

  // the domain stores' TablePe addresses live under — set on the server (STORE_SUBDOMAIN_BASE), not here
  const probe = usePlatformMutation(api.probeSubdomains);
  const base = q.data?.settings.subdomainBase ?? "";

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

      <CacheSettingsCard />

      <Card
        title="Store addresses"
        icon={<Globe size={16} />}
        subtitle="Every store without its own domain opens on a TablePe address — acme.yourdomain.com. You create, rename and remove these on each store's Domains tab; there is nothing to install per store."
      >
        {base ? (
          <>
            <div style={{ ...row, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={muted}>Base domain</div>
                <div style={{ fontWeight: 700, fontFamily: "ui-monospace, monospace", fontSize: 15 }}>{base}</div>
              </div>
              <span style={muted}>
                a store named <strong>acme</strong> opens on <strong>acme.{base}</strong>
              </span>
            </div>
            <p style={muted}>
              This comes from the server's <code>STORE_SUBDOMAIN_BASE</code> setting (production: your real domain, such as <code>tablepe.in</code>; on a developer's machine:
              <code> localhost:3070</code>), so local work and production can differ even though they share a database. It's set up once on the server — a wildcard DNS
              record, one wildcard certificate and one nginx block (steps in <code>deploy/wildcard-subdomains.md</code>). After that, no store ever needs server work.
            </p>
            <div style={{ marginTop: 14 }}>
              <Button variant="outline" disabled={probe.isPending} onClick={() => probe.mutate()}>
                {probe.isPending ? "Checking…" : "Check the server setup"}
              </Button>
              {probe.error ? <Toast kind="error">{probe.error.message}</Toast> : null}
              {probe.data ? <ProbeResult status={probe.data.status} base={base} /> : null}
            </div>
          </>
        ) : (
          <Note>
            This server has no base domain for store addresses yet. Add <code>STORE_SUBDOMAIN_BASE=tablepe.in</code> to the API's <code>.env</code> and restart it (for local
            development use <code>STORE_SUBDOMAIN_BASE=localhost:3070</code>). The steps are in <code>deploy/wildcard-subdomains.md</code>.
          </Note>
        )}
      </Card>
    </>
  );
}

/** What a visitor's browser would run into on an address under the base domain, step by step. */
function ProbeResult({ status: serverStatus, base }) {
  // The server checks from inside its hosting network, where a firewall can block a brand-new domain that
  // every visitor reaches fine. If its check failed, ask this browser too — a visitor's view.
  const serverFailed = !serverStatus.local && SERVER_CHECK_FAILED.includes(serverStatus.state);
  const [browserOk, setBrowserOk] = useState(null); // null = not asked / still asking
  useEffect(() => {
    setBrowserOk(null);
    if (!serverFailed) return undefined;
    let current = true;
    browserCanOpen(`https://${serverStatus.host}/`).then((ok) => current && setBrowserOk(ok));
    return () => {
      current = false;
    };
  }, [serverFailed, serverStatus.host]);
  const status = serverFailed && browserOk ? { ...serverStatus, dns: true, tls: true, state: "live", addresses: ["checked from your browser"] } : serverStatus;

  const steps = [
    { ok: status.dns, label: status.local ? "This machine: the storefront is reachable" : `DNS: *.${base} points to a server`, detail: status.dns ? status.addresses.join(", ") : "Add a wildcard A record (*) for the base domain." },
    {
      ok: status.dns && status.tls === true,
      label: "HTTPS: the certificate covers any subdomain",
      detail: !status.dns ? "" : status.tls === true ? "" : status.tls === false ? "The server answered, but without a valid wildcard certificate." : "Nothing answered on port 443.",
    },
    {
      ok: status.state === "live",
      label: "The storefront answers",
      detail: status.state === "live" ? "" : status.state === "error" ? describeHttpError(status.httpStatus) : "",
    },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
      {/* there is no certificate to check on a developer's machine */}
      {steps.filter((s) => !(status.local && s.label.startsWith("HTTPS"))).map((s) => (
        <div key={s.label} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13.5 }}>
          {s.ok ? <Check size={16} color="var(--tone-ok, #1a7f37)" style={{ marginTop: 2 }} /> : <X size={16} color="var(--tone-error, #c0392b)" style={{ marginTop: 2 }} />}
          <span>
            {s.label}
            {s.detail ? <span style={muted}> — {s.detail}</span> : null}
          </span>
        </div>
      ))}
      {serverFailed && browserOk === null ? <p style={muted}>The server couldn't check this itself — asking your browser…</p> : null}
      {status.state === "live" ? (
        <Note>
          All set — any address under {base} will open its store as soon as you create it.
          {serverFailed
            ? " The server's own check couldn't get through, because the network around it blocks this domain (a firewall there rates brand-new domains “Unrated”). Visitors aren't affected — your browser reached it."
            : ""}
        </Note>
      ) : null}
    </div>
  );
}
