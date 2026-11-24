import { useState } from "react";
import { AI_IMAGE_MODELS } from "@rasoipulse/config-schema";
import { KeyRound, Pause, Play, Plus, Sparkles, Trash2, Zap } from "lucide-react";
import * as api from "../../lib/api";
import { usePlatformAi, usePlatformMutation } from "../../lib/usePlatform";
import { Button, Card, Field, Note, PageHeader, Pill, Select, TextInput, Toast } from "../../ui";
import { fmtDate, muted } from "./shared";

const STATUS = {
  ready: { tone: "ok", label: "Ready" },
  cooling: { tone: "warn", label: "Resting" },
  off: { tone: "neutral", label: "Paused" },
};

/**
 * The Gemini API keys that make dish pictures. Google limits how much each key can do, so there can be SEVERAL: every
 * picture goes to the least-busy key, and a key that has used up its limit rests while the others carry on. Only the
 * super admin sees this page, and only the super admin sees the "make pictures" button on a dish. The keys are
 * encrypted and never shown again — only a masked hint.
 */
export function PlatformAi() {
  const query = usePlatformAi();
  const addKey = usePlatformMutation(api.addPlatformAiKey);
  const updateKey = usePlatformMutation(api.updatePlatformAiKey);
  const removeKey = usePlatformMutation(api.removePlatformAiKey);
  const testKey = usePlatformMutation(api.testPlatformAiKey);
  const saveModel = usePlatformMutation(api.savePlatformAiModel);

  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [custom, setCustom] = useState("");
  const [tested, setTested] = useState({}); // key id -> "ok" | message

  const cfg = query.data;
  const header = (
    <PageHeader
      title="AI pictures"
      icon={<Sparkles size={22} />}
      subtitle="Make dish pictures with Google Gemini. Only you (the platform admin) can use this — store owners never see it."
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

  const known = AI_IMAGE_MODELS.some((m) => m.id === cfg.model);
  const doTest = (id) => {
    setTested((t) => ({ ...t, [id]: "…" }));
    testKey.mutate(id, {
      onSuccess: () => setTested((t) => ({ ...t, [id]: "ok" })),
      onError: (e) => setTested((t) => ({ ...t, [id]: e.message })),
    });
  };

  return (
    <>
      {header}

      <Card
        title="Gemini API keys"
        subtitle={cfg.configured ? `${cfg.readyKeys} of ${cfg.keys.length} ready to use` : "No key yet — add one to turn this on"}
        icon={<KeyRound size={15} />}
      >
        <Note>
          Google limits how many pictures one key can make. Add several keys (from different Google projects) and pictures are shared out between them — when one reaches its
          limit it rests for a while and the others carry on.
        </Note>

        {cfg.keys.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }} data-testid="ai-keys">
            {cfg.keys.map((k) => {
              const st = STATUS[k.status] ?? STATUS.ready;
              const result = tested[k.id];
              return (
                <div key={k.id} style={keyRow} data-testid="ai-key" data-status={k.status}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 14 }}>{k.label || "Unnamed key"}</strong>
                      <code style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>{k.keyHint}</code>
                      <Pill tone={st.tone}>{st.label}</Pill>
                    </div>
                    <div style={muted}>
                      {k.uses} {k.uses === 1 ? "picture" : "pictures"} made{k.lastUsedAt ? ` · last used ${fmtDate(k.lastUsedAt)}` : ""}
                      {k.status === "cooling" && k.cooldownUntil ? ` · back ${fmtDate(k.cooldownUntil)}` : ""}
                    </div>
                    {k.lastError ? <div style={{ ...muted, color: "var(--tone-warning)" }}>{k.lastError}</div> : null}
                    {result === "ok" ? <div style={{ ...muted, color: "var(--tone-success)" }}>✓ Google accepted this key.</div> : null}
                    {result && result !== "ok" && result !== "…" ? <div style={{ ...muted, color: "var(--tone-danger)" }}>{result}</div> : null}
                  </div>
                  <Button variant="outline" onClick={() => doTest(k.id)} disabled={result === "…"} title="Asks Google for its model list — free, no picture is made" style={rowBtn}>
                    <Zap size={13} /> {result === "…" ? "Testing…" : "Test"}
                  </Button>
                  <Button variant="outline" onClick={() => updateKey.mutate({ id: k.id, enabled: !k.enabled })} style={rowBtn}>
                    {k.enabled ? <Pause size={13} /> : <Play size={13} />} {k.enabled ? "Pause" : "Turn on"}
                  </Button>
                  <Button
                    variant="outline"
                    aria-label={`Remove ${k.label || k.keyHint}`}
                    onClick={() => window.confirm(`Remove ${k.label || "this key"} (${k.keyHint})? Pictures already made are kept.`) && removeKey.mutate(k.id)}
                    style={rowBtn}
                  >
                    <Trash2 size={13} /> Remove
                  </Button>
                </div>
              );
            })}
          </div>
        ) : null}
        {updateKey.error ? <Toast kind="error">{updateKey.error.message}</Toast> : null}
        {removeKey.error ? <Toast kind="error">{removeKey.error.message}</Toast> : null}

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Add a key</div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(160px, 1fr) minmax(260px, 2fr) auto", gap: 10, alignItems: "end" }}>
            <Field label="Name (optional)" hint="So you can tell them apart" style={{ maxWidth: "none" }}>
              <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Project 2" />
            </Field>
            <Field label="Gemini API key" hint="From Google AI Studio → Get API key" style={{ maxWidth: "none" }}>
              <TextInput type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AIza…" aria-label="Gemini API key" />
            </Field>
            <Button
              disabled={!apiKey.trim() || addKey.isPending || cfg.keys.length >= cfg.maxKeys}
              onClick={() =>
                addKey.mutate(
                  { label, apiKey },
                  {
                    onSuccess: () => {
                      setLabel("");
                      setApiKey("");
                    },
                  },
                )
              }
              style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
            >
              <Plus size={14} /> {addKey.isPending ? "Adding…" : "Add key"}
            </Button>
          </div>
          {addKey.error ? <Toast kind="error">{addKey.error.message}</Toast> : null}
          <p style={{ ...muted, marginTop: 8 }}>
            The key is stored encrypted and is never shown again — only its first and last characters. Up to {cfg.maxKeys} keys. Pictures need a Google project with billing on; check Google&apos;s current
            pricing and free limits for the model you choose.
          </p>
        </div>
      </Card>

      <Card title="Model" subtitle="Which Gemini picture model makes the pictures." icon={<Sparkles size={15} />}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
          <Field label="Model" style={{ minWidth: 280, maxWidth: "none" }}>
            <Select value={known ? cfg.model : "__custom"} aria-label="Model" onChange={(e) => e.target.value !== "__custom" && saveModel.mutate(e.target.value)}>
              {AI_IMAGE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.note}
                </option>
              ))}
              {!known ? <option value="__custom">{cfg.model} (custom)</option> : null}
            </Select>
          </Field>
          <Field label="…or type a model name" hint="If Google adds a newer one" style={{ minWidth: 240, maxWidth: "none" }}>
            <TextInput value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. gemini-3.1-flash-image" aria-label="Custom model name" />
          </Field>
          <Button variant="outline" style={{ marginTop: 21 }} disabled={!custom.trim() || saveModel.isPending} onClick={() => saveModel.mutate(custom.trim(), { onSuccess: () => setCustom("") })}>
            Use this name
          </Button>
        </div>
        {saveModel.error ? <Toast kind="error">{saveModel.error.message}</Toast> : null}
        <p style={{ ...muted, marginTop: 10 }}>
          Currently: <strong>{cfg.model}</strong>. Every picture is marked by Google with an invisible watermark (SynthID). AI pictures show an idealised dish, not your kitchen&apos;s actual plate.
        </p>
      </Card>

      <Card title="Where to use it" icon={<Sparkles size={15} />}>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
          Open a store from <strong>Stores → Open store dashboard</strong>, go to <strong>Menu</strong>, and press the <strong>✦ sparkles</strong> button on a dish. You choose the shape and how many
          pictures (1–4); they are saved straight onto the dish. Store owners and their team never see that button.
        </p>
      </Card>
    </>
  );
}

const keyRow = { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "12px 14px", border: "1px solid var(--color-border)", borderRadius: 10, background: "var(--color-bg)" };
const rowBtn = { display: "inline-flex", gap: 6, alignItems: "center" };
