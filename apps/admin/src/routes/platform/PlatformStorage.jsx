import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_IMAGE_PROCESSING,
  STORAGE_PROVIDER_DESCRIPTIONS,
  STORAGE_PROVIDER_LABELS,
  STORAGE_PROVIDERS,
} from "@onetap/config-schema";
import { Check, Cloud, HardDrive, Loader, PlugZap, RotateCcw } from "lucide-react";
import * as api from "../../lib/api";
import { usePlatformMutation, usePlatformStorage, useStores } from "../../lib/usePlatform";
import { Button, Card, Field, Note, PageHeader, Pill, TextInput, Toast } from "../../ui";
import { fmtDate, muted } from "./shared";
import { MoveCard, TestResult, UsageCard } from "./StorageTools";
import { OptimizeCard } from "./StorageOptimize";

const ICONS = { local: HardDrive, s3: Cloud };

/**
 * Where every store's pictures are kept — this server's disk, or an S3-compatible bucket — and how they are
 * compressed. ONE setting for the whole platform: it is yours, not the store owners' (they only upload photos).
 * Each store's files stay in a folder of their own, so a single bucket serves everyone.
 */
export function PlatformStorage() {
  const query = usePlatformStorage();
  const save = usePlatformMutation(api.savePlatformStorage);
  const reset = usePlatformMutation(api.resetPlatformStorage);
  const test = usePlatformMutation(api.testPlatformStorage);
  const storesQ = useStores();
  const adopt = usePlatformMutation(api.adoptStoreStorage);

  const [choice, setChoice] = useState(null);
  const [values, setValues] = useState({});
  const [proc, setProc] = useState(null);

  const cfg = query.data;

  // Re-syncs whenever fresh settings arrive (first load, after a save, reset or adopt).
  useEffect(() => {
    if (cfg?.processing) setProc(cfg.processing);
  }, [cfg]);

  const activeProvider = choice ?? cfg?.provider ?? "local";
  const activeSpec = useMemo(() => cfg?.providers?.find((p) => p.id === activeProvider), [cfg, activeProvider]);

  const header = (
    <PageHeader
      title="Storage"
      icon={<HardDrive size={22} />}
      subtitle="Where every store's photos are kept — one setting for the whole platform. Store owners never see it."
    />
  );

  if (!cfg) {
    return (
      <>
        {header}
        <Card>{query.error ? `⚠ ${query.error.message}` : "Loading…"}</Card>
      </>
    );
  }

  const pickProvider = (id) => {
    setChoice(id);
    setValues({});
    test.reset();
  };

  const doSave = () =>
    save.mutate(
      { provider: activeProvider, values },
      {
        onSuccess: () => {
          setValues({});
          setChoice(null);
          test.reset();
        },
      },
    );

  const procNum = (key, raw, min, max) => {
    const n = Math.round(Number(raw));
    setProc({ ...proc, [key]: Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : DEFAULT_IMAGE_PROCESSING[key] });
  };
  const procDirty = proc && JSON.stringify(proc) !== JSON.stringify(cfg.processing);
  const dirty = activeProvider !== cfg.provider || Object.keys(values).length > 0;
  const own = cfg.ownSettings ?? [];

  return (
    <>
      {header}

      {cfg.inUse !== "platform" ? (
        <Note>
          {cfg.inUse === "store"
            ? "Nothing is saved here yet, so the stores below still use the storage settings they were set up with. Saving this page (or adopting one of them) makes it the one setting for every store."
            : "Nothing is saved here yet — pictures are saved on this server's disk. Pick where they should go and save."}
        </Note>
      ) : null}

      {own.length > 0 ? (
        <Card
          title="Stores with settings of their own"
          subtitle={
            cfg.inUse === "platform"
              ? "These were set before storage moved here. They are ignored now — every store uses the settings on this page."
              : "These were set before storage moved here, and they are still being used. Adopt one to make it everyone's."
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {own.map((s) => (
              <div key={s.brandId} style={ownRow}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.brandName}</div>
                  <div style={muted}>
                    {STORAGE_PROVIDER_LABELS[s.provider] ?? s.provider}
                    {s.updatedAt ? ` · saved ${fmtDate(s.updatedAt)}` : ""}
                    {s.provider !== "local" && !s.configured ? " · incomplete" : ""}
                  </div>
                </div>
                <Button
                  variant="outline"
                  disabled={adopt.isPending || (s.provider !== "local" && !s.configured)}
                  onClick={() =>
                    window.confirm(
                      `Use ${s.brandName}'s storage settings for EVERY store?${cfg.inUse === "platform" ? " This replaces what is saved on this page." : ""} Pictures already uploaded keep working.`,
                    ) &&
                    adopt.mutate(s.brandId, {
                      onSuccess: () => {
                        setChoice(null);
                        setValues({});
                      },
                    })
                  }
                >
                  Use for the whole platform
                </Button>
              </div>
            ))}
          </div>
          {adopt.error ? <Toast kind="error">{adopt.error.message}</Toast> : null}
          {adopt.isSuccess ? <Toast kind="ok">Done — these settings now apply to every store.</Toast> : null}
        </Card>
      ) : null}

      <Card title="Where images are stored">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {STORAGE_PROVIDERS.map((id) => {
            const Icon = ICONS[id] ?? HardDrive;
            const spec = cfg.providers.find((p) => p.id === id);
            const selected = activeProvider === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => pickProvider(id)}
                style={{
                  ...providerRow,
                  borderColor: selected ? "var(--color-primary)" : "var(--color-border)",
                  background: selected ? "color-mix(in srgb, var(--color-primary) 7%, var(--color-bg))" : "var(--color-bg)",
                }}
              >
                <Icon size={18} style={{ marginTop: 2, flexShrink: 0, color: selected ? "var(--color-primary)" : "var(--color-text-muted)" }} />
                <span style={{ flex: 1 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong style={{ fontSize: 14 }}>{STORAGE_PROVIDER_LABELS[id]}</strong>
                    {cfg.saved && id === cfg.provider ? <Pill tone="ok">in use</Pill> : null}
                    {spec?.configured ? null : id !== "local" ? <Pill>needs keys</Pill> : null}
                  </span>
                  <span style={{ display: "block", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5, marginTop: 3 }}>
                    {STORAGE_PROVIDER_DESCRIPTIONS[id]}
                  </span>
                </span>
                {selected ? <Check size={16} style={{ color: "var(--color-primary)", flexShrink: 0 }} /> : null}
              </button>
            );
          })}
        </div>

        {/* try ANY storage right here, without switching it on or saving it */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
          <Button
            variant="outline"
            onClick={() => test.mutate({ provider: activeProvider, values })}
            disabled={test.isPending}
            data-testid="storage-test"
            style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
          >
            {test.isPending ? <Loader size={13} className="ot-spin" /> : <PlugZap size={14} />}
            {test.isPending ? "Testing…" : `Test connection — ${STORAGE_PROVIDER_LABELS[activeProvider]}`}
          </Button>
          <span style={hint}>Tries the one selected above with the details filled in below. Nothing is saved or switched on. A blank secret key means the saved one.</span>
        </div>
        {test.error ? <Toast kind="error">{test.error.message}</Toast> : null}
        <TestResult result={test.data} />
      </Card>

      {activeSpec && activeSpec.fields.length > 0 ? (
        <Card title={`${STORAGE_PROVIDER_LABELS[activeProvider]} — settings`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            {activeSpec.fields.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint} info={f.info} style={{ maxWidth: "none" }}>
                <TextInput
                  type={f.secret ? "password" : "text"}
                  value={values[f.key] ?? (f.secret ? "" : f.value)}
                  placeholder={f.secret && f.isSet ? `saved · ${f.value}` : (f.placeholder ?? "")}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                />
              </Field>
            ))}
          </div>
          {activeProvider === "s3" ? (
            <p style={hint}>
              The key needs to read, write, delete and list objects (<code>GetObject</code>, <code>PutObject</code>, <code>DeleteObject</code>, <code>ListBucket</code> — for R2 an “Object Read &amp; Write” token) on this one bucket: uploads need write and delete, Test and “Move files” also read and list. Objects must be publicly readable (bucket policy /
              “public bucket”), or point <em>Public base URL</em> at a CDN in front of the bucket. Every store&apos;s pictures go in this bucket, each under its own folder.
            </p>
          ) : null}
        </Card>
      ) : null}

      <Card title="Apply">
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Button onClick={doSave} disabled={save.isPending || (!dirty && cfg.saved)}>
            {save.isPending ? "Saving…" : cfg.saved ? "Save storage settings" : "Save as the platform's storage"}
          </Button>
          {cfg.saved && cfg.provider !== "local" ? (
            <Button variant="outline" onClick={() => window.confirm("Switch every store back to this server's disk?") && reset.mutate()}>
              Reset to this server's disk
            </Button>
          ) : null}
          {dirty ? <span style={hint}>Unsaved changes</span> : null}
        </div>
        {save.isSuccess && save.variables?.provider ? <Toast kind="ok">Saved. Secret keys are encrypted at rest.</Toast> : null}
        {save.error && save.variables?.provider ? <Toast kind="error">{save.error.message}</Toast> : null}
        {reset.error ? <Toast kind="error">{reset.error.message}</Toast> : null}
      </Card>

      <UsageCard />

      <MoveCard cfg={cfg} stores={(storesQ.data?.stores ?? []).map((st) => ({ id: String(st.id ?? st._id), name: st.name }))} />

      {proc ? (
        <Card title="Image compression">
          <p style={{ ...hint, margin: "0 0 12px" }}>
            Every uploaded photo — whatever format it arrives in — is scaled down and re-encoded by the server to these settings. Applies to new uploads; pictures already
            stored stay as they are — use “Optimize pictures” below to compress the big ones.
          </p>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Field label="Max width / height" hint="pixels — the longest edge" style={{ maxWidth: 150 }}>
              <TextInput type="number" min={320} max={4096} step={80} value={proc.maxDimension} onChange={(e) => procNum("maxDimension", e.target.value, 320, 4096)} />
            </Field>
            <Field label="Quality" hint="30–100 · lower = smaller files" style={{ maxWidth: 130 }}>
              <TextInput type="number" min={30} max={100} value={proc.quality} onChange={(e) => procNum("quality", e.target.value, 30, 100)} />
            </Field>
            <Field label="Target max size" hint="KB — steps quality down to fit · 0 = off" style={{ maxWidth: 160 }}>
              <TextInput type="number" min={0} max={20000} step={50} value={proc.targetMaxKB} onChange={(e) => procNum("targetMaxKB", e.target.value, 0, 20000)} />
            </Field>
            <Field label="Output format" style={{ maxWidth: 320, flex: "1 1 260px" }}>
              <select value={proc.format} onChange={(e) => setProc({ ...proc, format: e.target.value })} style={selectStyle}>
                {cfg.formats.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 6, flexWrap: "wrap" }}>
            <Button onClick={() => save.mutate({ processing: proc })} disabled={save.isPending || !procDirty}>
              {save.isPending ? "Saving…" : "Save compression settings"}
            </Button>
            <Button variant="outline" onClick={() => setProc({ ...DEFAULT_IMAGE_PROCESSING })} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <RotateCcw size={13} /> Defaults
            </Button>
            {procDirty ? <span style={hint}>Unsaved changes</span> : null}
          </div>
          {save.isSuccess && save.variables?.processing ? <Toast kind="ok">Compression settings saved.</Toast> : null}
          {save.error && save.variables?.processing ? <Toast kind="error">{save.error.message}</Toast> : null}
        </Card>
      ) : null}

      <OptimizeCard />

      <Card title="How it works">
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.8, color: "var(--color-text-muted)" }}>
          <li>Store owners just upload photos — menu items, banners, pages. They are never asked where to keep them.</li>
          <li>Upload any image — JPEG, PNG, WebP, AVIF, HEIC/HEIF, GIF, TIFF. The server re-encodes it to the format and size above.</li>
          <li>Each store&apos;s files live in a folder named after the store, so one bucket can serve every store without mixing them.</li>
          <li>Only the finished public image address is saved on a menu item or page; the storefront never sees storage keys.</li>
          <li>The secret access key is encrypted (AES-256-GCM) before it touches the database and is never sent back here.</li>
          <li>Changing storage only affects new uploads — pictures already uploaded keep working from wherever they are. To bring the old ones along, use “Move files to another storage” above: it copies them, checks the copies, and updates every store's picture addresses.</li>
          <li>Pictures uploaded before a size limit was set (or never compressed) stay big until you run “Optimize pictures” above: it lists the ones over the limit and compresses the ones you choose.</li>
        </ul>
      </Card>
    </>
  );
}

const selectStyle = {
  font: "inherit",
  fontSize: 14,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  width: "100%",
};

const providerRow = {
  font: "inherit",
  textAlign: "left",
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
  padding: "13px 15px",
  borderRadius: 10,
  border: "1.5px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
};
const ownRow = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  padding: "11px 13px",
  border: "1px solid var(--color-border)",
  borderRadius: 9,
  background: "var(--color-bg)",
};
const hint = { fontSize: 12.5, color: "var(--color-text-muted)", margin: "8px 0 0", lineHeight: 1.55 };
