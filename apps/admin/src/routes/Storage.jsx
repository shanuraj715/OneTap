import { useMemo, useState } from "react";
import {
  STORAGE_PROVIDER_DESCRIPTIONS,
  STORAGE_PROVIDER_LABELS,
  STORAGE_PROVIDERS,
} from "@onetap/config-schema";
import { HardDrive, Cloud, Check, Loader } from "lucide-react";
import { useAuth } from "../lib/useAuth";
import { useOutlet } from "../lib/useOutlet";
import {
  useResetStorageConfig,
  useSaveStorageConfig,
  useStorageConfig,
  useTestStorageConfig,
} from "../lib/useStorage";
import { Button, Card, Field, PageHeader, Pill, TextInput, Toast } from "../ui";

const ICONS = { local: HardDrive, s3: Cloud };

export function Storage() {
  const { outlet } = useOutlet();
  const { can } = useAuth();
  const canRead = can("storage-config:read");
  const canManage = can("storage-config:manage");

  const query = useStorageConfig(canRead ? outlet : undefined);
  const save = useSaveStorageConfig(outlet);
  const reset = useResetStorageConfig(outlet);
  const test = useTestStorageConfig(outlet);

  const [choice, setChoice] = useState(null);
  const [values, setValues] = useState({});

  const cfg = query.data;
  const activeProvider = choice ?? cfg?.provider ?? "local";
  const activeSpec = useMemo(
    () => cfg?.providers?.find((p) => p.id === activeProvider),
    [cfg, activeProvider],
  );

  if (!canRead) {
    return (
      <>
        <PageHeader title="Storage" />
        <Card>Your role can&apos;t view storage settings.</Card>
      </>
    );
  }
  if (!outlet || !cfg) {
    return (
      <>
        <PageHeader title="Storage" />
        <Card>{query.error ? `⚠ ${query.error.message}` : "Loading…"}</Card>
      </>
    );
  }

  const pickProvider = (id) => {
    setChoice(id);
    setValues({});
    test.reset();
  };

  const doSave = () => {
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
  };

  const dirty = activeProvider !== cfg.provider || Object.keys(values).length > 0;

  return (
    <>
      <PageHeader
        title="Storage"
        icon={<HardDrive size={22} />}
        subtitle="Where menu photos (and later, logos) are kept. Change it any time — existing images keep working."
      />

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
                disabled={!canManage}
                onClick={() => pickProvider(id)}
                style={{
                  ...providerRow,
                  borderColor: selected ? "var(--color-primary)" : "var(--color-border)",
                  background: selected
                    ? "color-mix(in srgb, var(--color-primary) 7%, var(--color-bg))"
                    : "var(--color-bg)",
                  cursor: canManage ? "pointer" : "default",
                }}
              >
                <Icon size={18} style={{ marginTop: 2, flexShrink: 0, color: selected ? "var(--color-primary)" : "var(--color-text-muted)" }} />
                <span style={{ flex: 1 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <strong style={{ fontSize: 14 }}>{STORAGE_PROVIDER_LABELS[id]}</strong>
                    {id === cfg.provider ? <Pill>current</Pill> : null}
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
      </Card>

      {activeSpec && activeSpec.fields.length > 0 ? (
        <Card title={`${STORAGE_PROVIDER_LABELS[activeProvider]} — settings`}>
          {activeSpec.fields.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint} info={f.info}>
              <TextInput
                type={f.secret ? "password" : "text"}
                value={values[f.key] ?? (f.secret ? "" : f.value)}
                placeholder={f.secret && f.isSet ? `saved · ${f.value}` : (f.placeholder ?? "")}
                disabled={!canManage}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
              />
            </Field>
          ))}
          {activeProvider === "s3" ? (
            <p style={hint}>
              The key needs only <code>PutObject</code> and <code>DeleteObject</code> on this one bucket. Objects must be
              publicly readable (bucket policy / “public bucket”), or point <em>Public base URL</em> at a CDN in front of
              the bucket.
            </p>
          ) : null}
        </Card>
      ) : null}

      {canManage ? (
        <Card title="Apply">
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <Button onClick={doSave} disabled={save.isPending || (!dirty && activeProvider === cfg.provider)}>
              {save.isPending ? "Saving…" : "Save storage settings"}
            </Button>
            <Button
              variant="outline"
              onClick={() => test.mutate()}
              disabled={test.isPending}
              style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
            >
              {test.isPending ? <Loader size={13} /> : null}
              {test.isPending ? "Testing…" : "Test connection"}
            </Button>
            {cfg.provider !== "local" ? (
              <Button
                variant="outline"
                onClick={() => window.confirm("Switch back to local disk storage?") && reset.mutate()}
              >
                Reset to local
              </Button>
            ) : null}
            {dirty ? <span style={hint}>Unsaved changes</span> : null}
          </div>

          {test.data ? (
            <Toast kind="ok">
              {STORAGE_PROVIDER_LABELS[test.data.provider]} works — round-tripped a test file in {test.data.ms} ms.
            </Toast>
          ) : null}
          {test.error ? <Toast kind="error">{test.error.message}</Toast> : null}
          {save.isSuccess ? <Toast kind="ok">Saved. Secret keys are encrypted at rest.</Toast> : null}
          {save.error ? <Toast kind="error">{save.error.message}</Toast> : null}
          {reset.error ? <Toast kind="error">{reset.error.message}</Toast> : null}
        </Card>
      ) : null}

      <Card title="How it works">
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.8, color: "var(--color-text-muted)" }}>
          <li>Photos are downscaled to {cfg.limits.maxDimension}px in your browser before upload — up to {cfg.limits.maxPerItem} per item.</li>
          <li>Only the finished public image URL is stored on the menu item; the storefront never sees storage keys.</li>
          <li>The secret access key is encrypted (AES-256-GCM) before it touches the database and is never sent back here.</li>
          <li>Deleting an item (or removing a photo) deletes the underlying file, best-effort.</li>
        </ul>
      </Card>
    </>
  );
}

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
};
const hint = { fontSize: 12.5, color: "var(--color-text-muted)", margin: "8px 0 0", lineHeight: 1.55 };
