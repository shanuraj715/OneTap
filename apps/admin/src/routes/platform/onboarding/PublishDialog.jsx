import { useEffect, useState } from "react";
import { Link } from "../../../lib/nav";
import { forcedOverrides, onboardingOutletSlug, onboardingSubdomain, FEATURES } from "@rasoipulse/config-schema";
import { CheckCircle2, KeyRound, Store } from "lucide-react";
import * as api from "../../../lib/api";
import { usePlatformMutation } from "../../../lib/usePlatform";
import { Button, Field, Modal, TextInput, Toast } from "../../../ui";

const label = (key) => FEATURES.find((f) => f.key === key)?.label ?? key;

function makePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  return [...bytes].map((n) => alphabet[n % alphabet.length]).join("");
}

/**
 * "Publish as store": a last look at what will be created, the owner's password (typed here, never stored with the form),
 * and then the result — with the way into the new store.
 */
export function PublishDialog({ formId, data, plan, allow, base, onClose }) {
  const [password, setPassword] = useState("");
  const [serverIssues, setServerIssues] = useState(null);
  const publish = usePlatformMutation((pw) => api.publishOnboarding(formId, pw));
  const result = publish.data;

  useEffect(() => {
    let live = true;
    api.checkOnboarding(formId).then((r) => live && setServerIssues([...r.errors, ...r.server])).catch(() => live && setServerIssues([]));
    return () => {
      live = false;
    };
  }, [formId]);

  const extras = forcedOverrides(data, allow);
  const unlocked = [...extras.entitlements.features.unlock.map(label), ...extras.entitlements.effects.unlock.map((e) => `${e} style`)];
  const limits = [];
  if (extras.limits.maxOutlets && !allow.custom) limits.push(`${extras.limits.maxOutlets} outlets`);
  if (extras.limits.maxUsers && !allow.custom && extras.limits.maxUsers > allow.maxUsers) limits.push(`${extras.limits.maxUsers} people`);
  if (extras.limits.maxTables && !allow.custom && extras.limits.maxTables > allow.maxTables) limits.push(`${extras.limits.maxTables} tables`);
  const address = onboardingSubdomain(data);
  const problem = publish.error?.message;

  if (result) {
    const sub = result.store.subdomain;
    const url = sub?.host ? `${sub.scheme}://${sub.host}` : "";
    return (
      <Modal onClose={onClose} width={520} ariaLabel="Store published">
        <div data-published style={{ padding: 22 }}>
          <h2 style={{ margin: "0 0 6px", display: "flex", gap: 8, alignItems: "center", fontSize: 19 }}><CheckCircle2 size={22} color="var(--tone-success)" /> {result.store.name} is live</h2>
          <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--color-text-muted)" }}>The store, its {result.store.outlets.length} outlet{result.store.outlets.length === 1 ? "" : "s"} and the owner's login were created from this form.</p>
          <dl style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: "6px 12px", margin: "0 0 16px", fontSize: 13.5 }}>
            <dt style={{ color: "var(--color-text-muted)" }}>Owner signs in with</dt><dd style={{ margin: 0, fontWeight: 600 }} data-owner-email>{result.ownerEmail}</dd>
            <dt style={{ color: "var(--color-text-muted)" }}>Password</dt><dd style={{ margin: 0 }}>the one you just set (it isn't saved anywhere — share it with them now)</dd>
            {url ? (<><dt style={{ color: "var(--color-text-muted)" }}>Store address</dt><dd style={{ margin: 0 }}><a href={url} target="_blank" rel="noreferrer" data-store-url>{url}</a></dd></>) : null}
          </dl>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Link to={`/platform/stores/${result.store.id}`} style={{ textDecoration: "none" }}><Button type="button">Open the store</Button></Link>
            <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={publish.isPending ? () => {} : onClose} width={560} ariaLabel="Publish as store">
      <form
        style={{ padding: 22 }}
        onSubmit={(e) => {
          e.preventDefault();
          publish.mutate(password);
        }}
      >
        <h2 style={{ margin: "0 0 4px", display: "flex", gap: 8, alignItems: "center", fontSize: 19 }}><Store size={20} /> Publish as store</h2>
        <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--color-text-muted)" }}>This creates the store, its outlets and the owner's login from this form.</p>
        <dl style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "6px 12px", margin: "0 0 14px", fontSize: 13.5 }}>
          <dt style={{ color: "var(--color-text-muted)" }}>Store</dt><dd style={{ margin: 0, fontWeight: 600 }}>{data.business.storeName}</dd>
          <dt style={{ color: "var(--color-text-muted)" }}>Plan</dt><dd style={{ margin: 0 }}>{plan?.name}{unlocked.length || limits.length ? ` + added for this client: ${[...unlocked, ...limits].join(", ")}` : ""}</dd>
          <dt style={{ color: "var(--color-text-muted)" }}>Outlets</dt><dd style={{ margin: 0 }}>{data.outlets.map((o) => `${o.name} (/${onboardingOutletSlug(o)})`).join(", ")}</dd>
          <dt style={{ color: "var(--color-text-muted)" }}>Address</dt><dd style={{ margin: 0 }}>{address ? `${address}${base ? `.${base}` : ""}` : "—"}{data.address.ownDomain ? ` and ${data.address.ownDomain}` : ""}</dd>
          <dt style={{ color: "var(--color-text-muted)" }}>Owner</dt><dd style={{ margin: 0 }}>{data.business.ownerName} · {data.business.ownerEmail}</dd>
        </dl>
        {serverIssues?.length ? (
          <div data-publish-problems>{serverIssues.map((i, n) => <Toast key={n} kind="error">{i.message}</Toast>)}</div>
        ) : null}
        <Field label="Owner's password" hint="At least 8 characters. Shown here once — it isn't stored with the form or printed in the PDF.">
          <span style={{ display: "flex", gap: 8 }}>
            <TextInput value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete="off" style={{ flex: 1, minWidth: 0, fontFamily: "monospace" }} aria-label="Owner's password" />
            <Button type="button" variant="outline" onClick={() => setPassword(makePassword())} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><KeyRound size={14} /> Generate</Button>
          </span>
        </Field>
        {problem ? <Toast kind="error">{problem}</Toast> : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <Button type="button" variant="outline" onClick={onClose} disabled={publish.isPending}>Not yet</Button>
          <Button type="submit" disabled={publish.isPending || password.length < 8 || Boolean(serverIssues?.length)}>{publish.isPending ? "Creating the store…" : "Create the store"}</Button>
        </div>
      </form>
    </Modal>
  );
}
