import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { Layout } from "@onetap/config-schema";
import { VARIANT_SLOTS } from "@onetap/ui";
import { useOutlet, usePatchConfig } from "../lib/useOutlet";
import { Button, Card, PageHeader, STICKY_HEADER_CLEARANCE, Toast } from "../ui";

const STOREFRONT = "http://localhost:3070";

export function Appearance() {
  const { outlet } = useOutlet();
  const patch = usePatchConfig();
  const [layout, setLayout] = useState<Layout | null>(null);

  useEffect(() => {
    if (outlet && !layout) setLayout(outlet.config.layout);
  }, [outlet, layout]);

  if (!outlet || !layout) {
    return (
      <>
        <PageHeader title="Appearance" />
        <Card>Seed an outlet from the Dashboard first.</Card>
      </>
    );
  }

  const values = layout as unknown as Record<string, string>;
  const dirty = JSON.stringify(layout) !== JSON.stringify(outlet.config.layout);
  const total = VARIANT_SLOTS.reduce((n, s) => n + s.variants.length, 0);

  return (
    <>
      <PageHeader
        title="Appearance"
        subtitle={`${total} variants across ${VARIANT_SLOTS.length} families. Every one has a unique code and id.`}
      />

      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
            See every variant rendered with your real menu, theme and fonts:
          </span>
          <a href={`${STOREFRONT}/variants`} target="_blank" rel="noreferrer" style={galleryLink}>
            Open variant gallery ↗
          </a>
        </div>
      </Card>

      {/* Sits below the sticky PageHeader, not on top of it — see STICKY_HEADER_CLEARANCE. */}
      <div style={{ position: "sticky", top: STICKY_HEADER_CLEARANCE, zIndex: 4, background: "var(--color-bg)", padding: "10px 0 14px", marginBottom: 4 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Button onClick={() => patch.mutate({ outlet, patch: { layout } })} disabled={!dirty || patch.isPending}>
            {patch.isPending ? "Saving…" : "Save appearance"}
          </Button>
          <Button variant="outline" onClick={() => setLayout(outlet.config.layout)} disabled={!dirty}>
            Reset
          </Button>
          {dirty ? <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Unsaved changes</span> : null}
          {patch.isSuccess && !dirty ? <Toast kind="ok">Saved. Reload the storefront to see it.</Toast> : null}
          {patch.error ? <Toast kind="error">{(patch.error as Error).message}</Toast> : null}
        </div>
      </div>

      {VARIANT_SLOTS.map((slot) => (
        <Card key={slot.key} title={`${slot.label} — ${slot.variants.length} variants`}>
          <p style={{ margin: "-6px 0 12px", fontSize: 13, color: "var(--color-text-muted)" }}>{slot.description}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(215px, 1fr))", gap: 8 }}>
            {slot.variants.map((opt) => {
              const selected = values[slot.key] === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLayout({ ...(layout as Layout), [slot.key]: opt.id } as Layout)}
                  style={{
                    ...option,
                    borderColor: selected ? "var(--color-primary)" : "var(--color-border)",
                    boxShadow: selected ? "inset 0 0 0 1px var(--color-primary)" : "none",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ ...radio, borderColor: selected ? "var(--color-primary)" : "var(--color-border)" }}>
                      {selected ? <span style={radioDot} /> : null}
                    </span>
                    <span style={codeBadge}>{opt.code}</span>
                    <span style={{ fontWeight: 600, fontSize: 13.5 }}>{opt.name}</span>
                  </span>
                  <span style={optDesc}>{opt.description}</span>
                  <code style={optId}>{opt.id}</code>
                </button>
              );
            })}
          </div>
        </Card>
      ))}
    </>
  );
}

const galleryLink: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  padding: "8px 14px",
  borderRadius: "var(--radius-card)",
  border: "1px solid var(--color-primary)",
  color: "var(--color-primary)",
  textDecoration: "none",
};
const option: CSSProperties = {
  font: "inherit",
  textAlign: "left",
  display: "flex",
  flexDirection: "column",
  gap: 5,
  padding: "11px 13px",
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
};
const codeBadge: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.04em",
  padding: "2px 6px",
  borderRadius: 4,
  background: "var(--color-text)",
  color: "var(--color-bg)",
};
const optDesc: CSSProperties = { fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.45 };
const optId: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 10.5,
  color: "var(--color-text-muted)",
  alignSelf: "flex-start",
};
const radio: CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: "50%",
  border: "2px solid var(--color-border)",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};
const radioDot: CSSProperties = { width: 6, height: 6, borderRadius: "50%", background: "var(--color-primary)" };
