import { useEffect, useMemo, useState } from "react";
import { STORAGE_FIELDS } from "@onetap/config-schema";
import { AlertTriangle, ArrowRight, Check, ChevronDown, ChevronRight, CircleAlert, Loader, ScanSearch, Truck, X } from "lucide-react";
import * as api from "../../lib/api";
import { useStorageMove, useStorageUsage } from "../../lib/usePlatform";
import { usePlatformMutation } from "../../lib/usePlatform";
import { Button, Card, Checkbox, Field, Note, Select, TextInput, Toast } from "../../ui";
import { ago, bytes, count } from "./viz/format";
import { muted } from "./shared";

/* ---------------------------------------------------------------- a test's result */

/** The steps of a connection test: ✓ passed, ⚠ passed with a warning, ✗ failed — with what each one found. */
export function TestResult({ result }) {
  if (!result) return null;
  const headline = !result.ok
    ? "This storage did NOT work — see the step that failed."
    : result.publicOk
      ? `${result.label} works: files can be saved, read back and opened from their public address (${result.ms} ms).`
      : `${result.label} accepts files, but pictures would not show yet — see the warning.`;
  return (
    <div data-testid="storage-test-result" data-ok={result.ok ? "true" : "false"} data-public={result.publicOk ? "true" : "false"} style={{ marginTop: 12 }}>
      <Toast kind={result.ok && result.publicOk ? "ok" : result.ok ? "info" : "error"}>{headline}</Toast>
      <ol style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {result.steps.map((s) => (
          <li key={s.id} data-testid={`storage-step-${s.id}`} data-state={s.ok ? "ok" : s.warn ? "warn" : "fail"} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5 }}>
            <span style={{ ...stepDot, background: s.ok ? "var(--tone-success)" : s.warn ? "var(--tone-warning)" : "var(--tone-danger)" }} aria-hidden="true">
              {s.ok ? <Check size={12} /> : s.warn ? <AlertTriangle size={11} /> : <X size={12} />}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <strong>{s.label}</strong>
              {s.detail ? <span style={{ ...muted, display: "block", marginTop: 1, overflowWrap: "anywhere" }}>{s.detail}</span> : null}
            </span>
            <span style={{ ...muted, fontVariantNumeric: "tabular-nums" }}>{s.ms} ms</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------- what's stored */

const WHERE = { local: "On this server's disk", cloud: "In the cloud storage" };

/** Files and size, as "12 files · 3.4 MB" (or a dash for none). */
const amount = (s) => (s?.files ? `${count(s.files)} ${s.files === 1 ? "file" : "files"} · ${bytes(s.bytes)}` : "—");

export function UsageCard() {
  const q = useStorageUsage();
  const scan = usePlatformMutation(api.scanStorageUsage);
  const usage = scan.data?.usage ?? q.data?.usage;
  const [open, setOpen] = useState(() => new Set());
  const flip = (id) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const places = usage?.locations ?? [];

  return (
    <Card
      title="What is stored, and where"
      icon={<ScanSearch size={16} />}
      subtitle="Counts every file on this server's disk and in the cloud storage, per store and per outlet, and checks it against what the stores actually use."
      action={
        <Button onClick={() => scan.mutate()} disabled={scan.isPending} data-testid="storage-scan" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          {scan.isPending ? <Loader size={14} className="ot-spin" /> : <ScanSearch size={14} />} {scan.isPending ? "Counting…" : usage ? "Scan again" : "Scan storage"}
        </Button>
      }
    >
      {scan.error ? <Toast kind="error">{scan.error.message}</Toast> : null}
      {!usage ? (
        <p style={muted}>{scan.isPending ? "Counting the files — this can take a little while for a big bucket…" : "Press “Scan storage” to count the files. Nothing is changed by looking."}</p>
      ) : (
        <div data-testid="storage-usage">
          <p style={{ ...muted, margin: "0 0 12px" }}>
            Scanned {ago(usage.scannedAt)} · took {Math.max(1, Math.round(usage.tookMs / 100) / 10)} s
          </p>
          <div style={tiles}>
            <Tile label="Everything" value={amount(usage.total)} note="across every place and store" testid="usage-total" />
            {places.map((p) => (
              <Tile key={p.id} label={WHERE[p.id] ?? p.label} value={amount(p)} note={`${p.label}${p.inUse ? " · in use for new uploads" : ""}${p.partial ? " · listing was cut short (very large)" : ""}`} testid={`usage-${p.id}`} />
            ))}
          </div>

          {usage.health.broken > 0 ? (
            <Callout tone="danger" testid="usage-broken" icon={<CircleAlert size={16} />}>
              <strong>{count(usage.health.broken)} picture{usage.health.broken === 1 ? " is" : "s are"} used by a store but can't be found anywhere</strong> — they show as broken on the storefront (e.g. the files were never copied here).
              <span style={{ display: "block", ...muted, marginTop: 3 }}>{usage.health.brokenExamples.slice(0, 4).map((e) => `${e.store}: …${e.key.slice(-26)}`).join(" · ")}</span>
            </Callout>
          ) : null}
          {usage.health.waiting && usage.health.waiting.files > 0 ? (
            <Callout tone="warn" testid="usage-waiting" icon={<Truck size={16} />}>
              <strong>{amount(usage.health.waiting)}</strong> are on this server's disk but not in the cloud storage yet — use “Move files” below to copy them.
            </Callout>
          ) : null}
          {Object.entries(usage.health.unused).some(([, s]) => s.files > 0) ? (
            <Callout tone="info" testid="usage-unused" icon={<CircleAlert size={16} />}>
              Not used by any store (older than a day): {Object.entries(usage.health.unused).filter(([, s]) => s.files > 0).map(([id, s]) => `${amount(s)} ${id === "local" ? "on the disk" : "in the cloud"}`).join(" · ")} — leftovers from photos that were replaced or never saved. Nothing deletes them for you.
            </Callout>
          ) : null}

          <h3 style={h3}>By store and outlet</h3>
          <div style={{ overflowX: "auto" }}>
            <table style={table} data-testid="usage-stores">
              <thead>
                <tr>
                  <th style={th}>Store / outlet</th>
                  {places.map((p) => (
                    <th key={p.id} style={{ ...th, textAlign: "right" }}>{WHERE[p.id] ?? p.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usage.stores.map((s) => (
                  <StoreRows key={s.id} store={s} places={places} open={open.has(s.id)} onFlip={() => flip(s.id)} />
                ))}
                {usage.stores.length === 0 ? (
                  <tr>
                    <td style={td} colSpan={1 + places.length}>No files yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {usage.kinds.length > 0 ? (
            <>
              <h3 style={h3}>By kind of file</h3>
              <div style={{ overflowX: "auto" }}>
                <table style={table}>
                  <tbody>
                    {usage.kinds.map((k) => (
                      <tr key={k.kind}>
                        <td style={td}>{k.kind}</td>
                        {places.map((p) => (
                          <td key={p.id} style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{amount(k.by[p.id])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      )}
    </Card>
  );
}

function StoreRows({ store, places, open, onFlip }) {
  return (
    <>
      <tr data-testid="usage-store" data-store={store.name}>
        <td style={{ ...td, fontWeight: 600 }}>
          <button type="button" onClick={onFlip} style={flipBtn} aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} the outlets of ${store.name}`}>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {store.name}
          </button>
        </td>
        {places.map((p) => (
          <td key={p.id} style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{amount(store.by[p.id])}</td>
        ))}
      </tr>
      {open
        ? store.outlets.map((o) => (
            <tr key={o.id} data-testid="usage-outlet" style={{ background: "var(--color-surface)" }}>
              <td style={{ ...td, paddingLeft: 36, color: "var(--color-text-muted)" }}>{o.name}</td>
              {places.map((p) => (
                <td key={p.id} style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--color-text-muted)" }}>{amount(o.by[p.id])}</td>
              ))}
            </tr>
          ))
        : null}
    </>
  );
}

const Tile = ({ label, value, note, testid }) => (
  <div style={tile} data-testid={testid}>
    <div style={{ ...muted, fontSize: 12 }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 800, margin: "3px 0 2px", fontVariantNumeric: "tabular-nums" }}>{value}</div>
    <div style={{ ...muted, fontSize: 11.5, overflowWrap: "anywhere" }}>{note}</div>
  </div>
);

const Callout = ({ tone, icon, children, testid }) => (
  <div data-testid={testid} style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "10px 0 0", padding: "10px 12px", borderRadius: 10, fontSize: 13.5, lineHeight: 1.5, background: tone === "danger" ? "var(--tone-danger-wash)" : tone === "warn" ? "var(--tone-warning-wash)" : "var(--tone-info-wash)", color: tone === "danger" ? "var(--tone-danger)" : tone === "warn" ? "var(--tone-warning)" : "var(--tone-info)" }}>
    <span style={{ flexShrink: 0, marginTop: 1 }}>{icon}</span>
    <span style={{ color: "var(--color-text)" }}>{children}</span>
  </div>
);

/* --------------------------------------------------------------------- move files */

const S3_FIELDS = STORAGE_FIELDS.s3;

/**
 * One end of a move: this server's disk, the storage in use, or another S3-compatible bucket whose details are typed in
 * here (and can be tried before anything moves).
 */
function EndPicker({ title, testid, value, onChange, cfg, hideActive }) {
  const test = usePlatformMutation(() => api.testPlatformStorage({ provider: "s3", values: value.values }));
  const inUseIsDisk = cfg.provider === "local";
  const choices = [
    { type: "local", label: "This server's disk" },
    { type: "active", label: `The storage in use — ${cfg.inUseLabel ?? "…"}`, disabled: inUseIsDisk || hideActive },
    { type: "s3", label: "Another S3-compatible storage (Cloudflare R2, Amazon S3, DigitalOcean Spaces, Backblaze B2, MinIO)…" },
  ];
  return (
    <div style={endBox} data-testid={testid}>
      <strong style={{ fontSize: 13.5 }}>{title}</strong>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "8px 0" }}>
        {choices.map((c) => (
          <label key={c.type} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13.5, opacity: c.disabled ? 0.45 : 1, cursor: c.disabled ? "not-allowed" : "pointer" }}>
            <input type="radio" name={testid} checked={value.type === c.type} disabled={c.disabled} onChange={() => { test.reset(); onChange({ type: c.type, values: value.values }); }} data-testid={`${testid}-${c.type}`} />
            <span>{c.label}</span>
          </label>
        ))}
      </div>
      {value.type === "s3" ? (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
            {S3_FIELDS.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint} info={f.info} style={{ maxWidth: "none", marginBottom: 6 }}>
                <TextInput type={f.secret ? "password" : "text"} value={value.values[f.key] ?? ""} placeholder={f.placeholder ?? ""} onChange={(e) => onChange({ ...value, values: { ...value.values, [f.key]: e.target.value } })} aria-label={`${title}: ${f.label}`} />
              </Field>
            ))}
          </div>
          <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending} data-testid={`${testid}-test`} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            {test.isPending ? <Loader size={13} className="ot-spin" /> : null} {test.isPending ? "Testing…" : "Test this storage"}
          </Button>
          {test.error ? <Toast kind="error">{test.error.message}</Toast> : null}
          <TestResult result={test.data} />
        </div>
      ) : null}
    </div>
  );
}

const STAGES = [
  ["listing", "Looking at both places"],
  ["copying", "Copying files"],
  ["links", "Updating the pictures' addresses"],
  ["cleanup", "Removing the old copies"],
];
const STATUS_TEXT = { running: "Moving…", done: "Finished", done_with_errors: "Finished — some files could not be moved", failed: "Stopped by an error", cancelled: "Cancelled", interrupted: "Interrupted" };

export function MoveCard({ cfg, stores }) {
  const status = useStorageMove();
  const preview = usePlatformMutation(api.previewStorageMove);
  const start = usePlatformMutation(api.startStorageMove);
  const cancel = usePlatformMutation(api.cancelStorageMove);
  const inUseIsDisk = cfg.provider === "local";
  const [source, setSource] = useState({ type: "local", values: {} });
  const [target, setTarget] = useState({ type: inUseIsDisk ? "s3" : "active", values: {} });
  const [brandId, setBrandId] = useState("");
  const [deleteSource, setDeleteSource] = useState(false);
  const [activate, setActivate] = useState(false);
  const job = status.data?.current;
  const running = job?.status === "running";

  // when what is "in use" changes (a save), keep the choices sensible
  useEffect(() => {
    setTarget((t) => (t.type === "active" && inUseIsDisk ? { type: "s3", values: t.values } : t));
    setSource((s) => (s.type === "active" && inUseIsDisk ? { type: "local", values: s.values } : s));
  }, [inUseIsDisk]);

  const body = useMemo(
    () => ({ source: { type: source.type, ...(source.type === "s3" ? { values: source.values } : {}) }, target: { type: target.type, ...(target.type === "s3" ? { values: target.values } : {}) }, ...(brandId ? { scope: { brandId } } : {}), options: { deleteSource, activate: activate && target.type === "s3" } }),
    [source, target, brandId, deleteSource, activate],
  );
  // a changed choice makes the last preview out of date
  useEffect(() => preview.reset(), [JSON.stringify(body)]); // eslint-disable-line react-hooks/exhaustive-deps

  const p = preview.data?.preview;
  const go = () => {
    const what = p ? `${count(p.plan.toCopy)} file${p.plan.toCopy === 1 ? "" : "s"} (${bytes(p.plan.toCopyBytes)}) will be copied` : "The files will be copied";
    const del = deleteSource ? " The old copies are DELETED afterwards (only files verified in the new place)." : " The old copies are kept.";
    if (window.confirm(`Move files from “${p?.source.label ?? "the source"}” to “${p?.target.label ?? "the destination"}”?\n\n${what}, then the stores' picture addresses are updated.${del}`)) start.mutate(body);
  };
  const pct = job?.plan?.files ? Math.min(100, Math.round(((job.progress.done ?? 0) / Math.max(1, job.plan.files)) * 100)) : 0;
  const stageIndex = STAGES.findIndex(([id]) => id === job?.stage);

  return (
    <Card
      title="Move files to another storage"
      icon={<Truck size={16} />}
      subtitle="Copy every picture (or one store's) from one place to another — this server's disk to Cloudflare R2 or S3, back again, or bucket to bucket — and update the stores' picture addresses to follow. Nothing is deleted unless you ask."
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 12, alignItems: "start" }}>
        <EndPicker title="From — where the files are now" testid="move-source" value={source} onChange={setSource} cfg={cfg} hideActive={target.type === "active"} />
        <EndPicker title="To — where they should go" testid="move-target" value={target} onChange={setTarget} cfg={cfg} hideActive={source.type === "active"} />
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-end", margin: "14px 0 4px" }}>
        <Field label="Which stores" style={{ maxWidth: 280, marginBottom: 0 }}>
          <Select value={brandId} onChange={(e) => setBrandId(e.target.value)} data-testid="move-scope" aria-label="Which stores to move">
            <option value="">All stores (and the website)</option>
            <option value="platform">Marketing website &amp; platform only</option>
            {(stores ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name} only</option>
            ))}
          </Select>
        </Field>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Checkbox checked={deleteSource} onChange={setDeleteSource} label="Delete the old copies once they are safely in the new place" info="Frees the space. Only files that were copied and checked (same size) are deleted, and only after the stores' addresses were updated. Leave it off, look at a storefront, and run the move again with this ticked when you are happy." />
          {target.type === "s3" ? <Checkbox checked={activate} onChange={setActivate} label="Use this destination for all NEW uploads too" info="Saves the destination's details as the platform's storage (the secret is encrypted), so new photos go there. Without it only the existing files move." /> : null}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 18 }}>
        <Button variant="outline" onClick={() => preview.mutate(body)} disabled={preview.isPending || running} data-testid="move-preview">
          {preview.isPending ? "Checking…" : "Check what would move"}
        </Button>
        <Button onClick={go} disabled={start.isPending || running || preview.isPending || !p} data-testid="move-start" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <ArrowRight size={14} /> Move files
        </Button>
        {!p && !running ? <span style={muted}>Check first — it shows exactly what would happen.</span> : null}
      </div>
      {preview.error || start.error || p ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 20, lineHeight: 1.6 }}>
          {preview.error ? <Toast kind="error">{preview.error.message}</Toast> : null}
          {start.error ? <Toast kind="error">{start.error.message}</Toast> : null}
          {p ? (
            <Note>
              <span data-testid="move-preview-result">
                {p.source.label} <ArrowRight size={12} style={{ verticalAlign: -1 }} /> {p.target.label}{p.scope?.brandName ? ` · ${p.scope.brandName} only` : ""}:{" "}
                <strong>{count(p.plan.toCopy)}</strong> file{p.plan.toCopy === 1 ? "" : "s"} ({bytes(p.plan.toCopyBytes)}) to copy, {count(p.plan.alreadyThere)} already there,{" "}
                <strong>{count(p.linksToUpdate)}</strong> stored picture address{p.linksToUpdate === 1 ? "" : "es"} to update.
              </span>
            </Note>
          ) : null}
        </div>
      ) : null}

      {job ? (
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--color-border)" }} data-testid="move-job" data-status={job.status}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <strong>{STATUS_TEXT[job.status] ?? job.status}</strong>
            <span style={muted}>
              {job.source.label} → {job.target.label}{job.scope?.brandName ? ` · ${job.scope.brandName}` : ""} · started {ago(job.startedAt)}
            </span>
            {running ? (
              <Button variant="outline" onClick={() => cancel.mutate(job.id)} disabled={cancel.isPending || job.cancelRequested} data-testid="move-cancel" style={{ marginLeft: "auto" }}>
                {job.cancelRequested ? "Stopping…" : "Cancel"}
              </Button>
            ) : null}
          </div>
          {running ? (
            <>
              <ol style={{ display: "flex", gap: 6, flexWrap: "wrap", listStyle: "none", padding: 0, margin: "10px 0 6px" }}>
                {STAGES.filter(([id]) => id !== "cleanup" || job.options?.deleteSource).map(([id, label]) => {
                  const i = STAGES.findIndex(([x]) => x === id);
                  return (
                    <li key={id} data-testid={`move-stage-${id}`} data-state={i < stageIndex ? "done" : i === stageIndex ? "now" : "next"} style={{ ...stage, ...(i === stageIndex ? stageNow : i < stageIndex ? stageDone : null) }}>
                      {i < stageIndex ? <Check size={11} /> : i === stageIndex ? <Loader size={11} className="ot-spin" /> : null} {label}
                    </li>
                  );
                })}
              </ol>
              <div style={track} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress"><div style={{ ...fill, width: `${pct}%` }} /></div>
            </>
          ) : null}
          <p style={{ ...muted, margin: "8px 0 0", fontVariantNumeric: "tabular-nums" }} data-testid="move-progress">
            {count(job.progress.done ?? 0)} of {count(job.plan.files ?? 0)} checked · {count(job.progress.copied ?? 0)} copied ({bytes(job.progress.bytesCopied ?? 0)}) · {count(job.progress.skipped ?? 0)} already there ·{" "}
            {count(job.progress.failed ?? 0)} failed · {count(job.progress.linksUpdated ?? 0)} addresses updated{job.options?.deleteSource ? ` · ${count(job.progress.deleted ?? 0)} old copies deleted` : ""}
          </p>
          {job.error ? <Toast kind={job.status === "interrupted" ? "info" : "error"}>{job.error}</Toast> : null}
          {job.failures.length > 0 ? (
            <details style={{ marginTop: 8 }} open={job.status !== "running"}>
              <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--tone-danger)" }}>{job.failures.length} problem{job.failures.length === 1 ? "" : "s"}</summary>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }} data-testid="move-failures">
                {job.failures.slice(0, 20).map((f, i) => (
                  <li key={i}><code style={{ overflowWrap: "anywhere" }}>{f.key}</code> — {f.error}</li>
                ))}
              </ul>
              <p style={muted}>Those files stayed where they were and still work from there. Fix the cause and press “Move files” again — only what is left is copied.</p>
            </details>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

/* ----------------------------------------------------------------------- styles */

const stepDot = { display: "inline-grid", placeItems: "center", width: 20, height: 20, borderRadius: 99, color: "#fff", flexShrink: 0, marginTop: 1 };
const tiles = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 };
const tile = { border: "1px solid var(--color-border)", borderRadius: 12, padding: "11px 13px", background: "var(--color-bg)" };
const h3 = { margin: "20px 0 8px", fontSize: 14.5, fontFamily: "var(--font-heading)" };
const table = { width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 440 };
const th = { textAlign: "left", fontSize: 12, fontWeight: 700, color: "var(--color-text-muted)", padding: "6px 10px", borderBottom: "1px solid var(--color-border)" };
const td = { padding: "8px 10px", borderBottom: "1px solid var(--color-border)" };
const flipBtn = { font: "inherit", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5, border: "none", background: "transparent", color: "var(--color-text)", cursor: "pointer", padding: 0 };
const endBox = { border: "1px solid var(--color-border)", borderRadius: 12, padding: "12px 14px", background: "var(--color-bg)" };
const stage = { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 99, border: "1px solid var(--color-border)", color: "var(--color-text-muted)" };
const stageNow = { color: "var(--color-primary)", borderColor: "var(--color-primary)", background: "color-mix(in srgb, var(--color-primary) 8%, var(--color-bg))" };
const stageDone = { color: "var(--tone-success)", borderColor: "var(--tone-success)" };
const track = { height: 8, borderRadius: 99, background: "var(--color-surface)", border: "1px solid var(--color-border)", overflow: "hidden" };
const fill = { height: "100%", background: "var(--color-primary)", transition: "width 300ms" };
