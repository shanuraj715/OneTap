import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { VARIANT_SLOTS } from "@onetap/ui";
import { useOutlet, usePatchConfig } from "../lib/useOutlet";
import { Button, Card, Field, InfoHint, PageHeader, STICKY_HEADER_CLEARANCE, TextInput, Toast } from "../ui";

const MAX_NAV_LINKS = 8;

const STOREFRONT = "http://localhost:3070";

export function Appearance() {
  const { outlet } = useOutlet();
  const patch = usePatchConfig();
  const [layout, setLayout] = useState               (null);

  // Re-syncs whenever the selected outlet actually changes, not just once —
  // switching in the sidebar doesn't unmount this page. Keyed on outlet?._id
  // (not the outlet object, which gets a new reference on every background
  // refetch) so an in-progress edit on the same outlet is never stomped.
  useEffect(() => {
    if (outlet) setLayout(outlet.config.layout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlet?._id]);

  if (!outlet || !layout) {
    return (
      <>
        <PageHeader title="Appearance" />
        <Card>Seed an outlet from the Dashboard first.</Card>
      </>
    );
  }

  const values = layout                                     ;
  const dirty = JSON.stringify(layout) !== JSON.stringify(outlet.config.layout);
  const total = VARIANT_SLOTS.reduce((n, s) => n + s.variants.length, 0);
  const navLinks = layout.navLinks ?? [];

  const addNavLink = () =>
    setLayout({ ...layout, navLinks: [...navLinks, { label: "", href: "" }] });
  const updateNavLink = (i, patchValue) =>
    setLayout({ ...layout, navLinks: navLinks.map((l, n) => (n === i ? { ...l, ...patchValue } : l)) });
  const removeNavLink = (i) =>
    setLayout({ ...layout, navLinks: navLinks.filter((_, n) => n !== i) });

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
          {patch.error ? <Toast kind="error">{(patch.error         ).message}</Toast> : null}
        </div>
      </div>

      <Card
        title="Header navigation links"
        subtitle="Shown after Menu (and Order at table / Book a table, when those are on). On a narrow screen every header now collapses these into a hamburger menu automatically — no separate mobile setup needed."
      >
        {navLinks.length === 0 ? (
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--color-text-muted)" }}>
            No extra links yet — the header just shows the built-in ones.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {navLinks.map((link, i) => (
              <div key={i} style={navLinkRow}>
                <Field label="Label" style={{ flex: "1 1 160px", maxWidth: "none" }}>
                  <TextInput
                    value={link.label}
                    onChange={(e) => updateNavLink(i, { label: e.target.value })}
                    placeholder="About"
                    maxLength={30}
                  />
                </Field>
                <Field
                  label="Link"
                  style={{ flex: "2 1 220px", maxWidth: "none" }}
                  info="An in-page anchor like #about (jumps to a section with id='about' on this page), or a full URL like https://yoursite.com/about."
                >
                  <TextInput
                    value={link.href}
                    onChange={(e) => updateNavLink(i, { href: e.target.value })}
                    placeholder="#about or https://…"
                    maxLength={300}
                  />
                </Field>
                <button
                  type="button"
                  onClick={() => removeNavLink(i)}
                  style={navLinkRemove}
                  aria-label={`Remove ${link.label || "this link"}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Button
            variant="outline"
            onClick={addNavLink}
            disabled={navLinks.length >= MAX_NAV_LINKS}
            style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
          >
            <Plus size={13} /> Add link
          </Button>
          {navLinks.length >= MAX_NAV_LINKS ? (
            <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>Up to {MAX_NAV_LINKS} links.</span>
          ) : (
            <InfoHint
              title="Header navigation links"
              text="These sit in the same nav as the built-in links — Menu first, then Order at table / Book a table if those channels are on, then whatever you add here, in order."
            />
          )}
        </span>
      </Card>

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
                  onClick={() => setLayout({ ...(layout          ), [slot.key]: opt.id }          )}
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

const navLinkRow                = {
  display: "flex",
  gap: 10,
  alignItems: "flex-end",
  padding: "10px 12px",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  background: "var(--color-bg)",
};
const navLinkRemove                = {
  font: "inherit",
  display: "grid",
  placeItems: "center",
  width: 34,
  height: 34,
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  background: "var(--color-surface)",
  color: "var(--tone-danger)",
  cursor: "pointer",
  flexShrink: 0,
  marginBottom: 1,
};
const galleryLink                = {
  fontSize: 13,
  fontWeight: 600,
  padding: "8px 14px",
  borderRadius: "var(--radius-card)",
  border: "1px solid var(--color-primary)",
  color: "var(--color-primary)",
  textDecoration: "none",
};
const option                = {
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
const codeBadge                = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.04em",
  padding: "2px 6px",
  borderRadius: 4,
  background: "var(--color-text)",
  color: "var(--color-bg)",
};
const optDesc                = { fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.45 };
const optId                = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 10.5,
  color: "var(--color-text-muted)",
  alignSelf: "flex-start",
};
const radio                = {
  width: 14,
  height: 14,
  borderRadius: "50%",
  border: "2px solid var(--color-border)",
  display: "grid",
  placeItems: "center",
  flexShrink: 0,
};
const radioDot                = { width: 6, height: 6, borderRadius: "50%", background: "var(--color-primary)" };
