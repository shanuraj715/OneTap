import { Component, useEffect, useMemo, useState } from "react";
import { Link } from "../lib/nav";
import { Plus, Trash2 } from "lucide-react";
import { getVariant, VARIANT_SLOTS } from "@rasoipulse/ui";
import { useMenu } from "../lib/useMenu";
import { useOutlet, usePatchConfig } from "../lib/useOutlet";
import { StorePreviewFrame } from "../lib/storePreview";
import { Button, Card, Field, InfoHint, PageHeader, STICKY_HEADER_CLEARANCE, TextInput, Toast } from "../ui";
import { PictureShape } from "../components/PictureShape";
import { StorefrontNav } from "../components/SubNav";

const MAX_NAV_LINKS = 8;

const STOREFRONT = "http://localhost:3070";

export function Appearance() {
  const { outlet } = useOutlet();
  const patch = usePatchConfig();
  const [layout, setLayout] = useState               (null);
  const menuQ = useMenu(outlet);

  // What the previews are filled with: this outlet's own name, details and a
  // few real dishes (ones with photos first), falling back to samples.
  const previewCtx = useMemo(() => {
    const id = outlet?.config?.identity ?? {};
    const available = (menuQ.data?.items ?? []).filter((i) => i.isAvailable);
    const withPhotos = available.filter((i) => i.images?.length);
    const items = (withPhotos.length >= 3 ? withPhotos : available).slice(0, 3);
    return {
      outletName: id.name || outlet?.name || "Your restaurant",
      logoUrl: id.logoUrl || "",
      tagline: id.tagline || "Freshly made, every day",
      phone: id.phone || "+91 98765 43210",
      address: id.address || "Shop 12, Main Market",
      fssaiLicense: id.fssaiLicense || "",
      gstin: id.gstin || "",
      items: items.length ? items : SAMPLE_ITEMS,
    };
  }, [outlet, menuQ.data]);

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
        <StorefrontNav />
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

      <StorefrontNav />

      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
            See every variant rendered with your real menu, theme and fonts:
          </span>
          <Link to="/components" style={galleryLink}>
            Browse all components & variants →
          </Link>
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
                  onClick={() =>
                    setLayout(
                      // choosing another card style puts its own picture shape back (the owner can override it again below)
                      { ...(layout          ), [slot.key]: opt.id, ...(slot.key === "itemCardVariant" && opt.id !== values.itemCardVariant ? { itemImageRatio: "" } : null) }          ,
                    )
                  }
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
          {slot.key === "itemCardVariant" ? <PictureShape variantId={values.itemCardVariant} value={values.itemImageRatio} style={{ marginTop: 16 }} onChange={(itemImageRatio) => setLayout({ ...(layout          ), itemImageRatio }          )} /> : null}
          <SlotPreview
            slot={slot}
            selectedId={values[slot.key]}
            savedId={outlet.config.layout?.[slot.key]}
            ctx={slot.key === "itemCardVariant" ? { ...previewCtx, imageRatio: values.itemImageRatio ?? "" } : previewCtx}
            config={outlet.config}
            navLinks={navLinks}
          />
        </Card>
      ))}
    </>
  );
}

/**
 * The selected variant of one family, drawn with the store's own colours,
 * fonts and effect, at the bottom of that family's card. It follows the
 * selection live — before saving — so you see what you're about to choose.
 */
function SlotPreview({ slot, selectedId, savedId, ctx, config, navLinks }) {
  // resolved the way the storefront resolves it (falls back to the family's default)
  const meta = getVariant(slot.key, selectedId);
  if (!meta) return null;
  const unsaved = (selectedId ?? null) !== (savedId ?? null);

  let body;
  if (slot.key === "headerVariant") {
    // the header shows the same links the storefront's would, including the
    // extra ones edited above
    const features = config?.features ?? {};
    const links = [
      { label: "Menu", href: "#" },
      ...(features.ordering?.dineInQr ? [{ label: "Order at table", href: "#" }] : []),
      ...(features.reservations?.enabled ? [{ label: "Book a table", href: "#" }] : []),
      ...navLinks.filter((l) => l.label?.trim()).map((l) => ({ label: l.label, href: "#" })),
    ];
    const Header = meta.Component;
    body = <Header name={ctx.outletName} tagline={ctx.tagline} phone={ctx.phone} links={links} />;
  } else {
    body = slot.preview(meta, ctx);
  }

  return (
    <div style={{ marginTop: 18 }}>
      <div style={previewHead}>
        <span style={previewLabel}>Preview</span>
        <span style={codeBadge}>{meta.code}</span>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{meta.name}</span>
        {unsaved ? <span style={unsavedPill}>Not saved yet</span> : null}
      </div>
      <PreviewBoundary resetKey={meta.id}>
        <StorePreviewFrame config={config} flush={slot.flush}>
          {body}
        </StorePreviewFrame>
      </PreviewBoundary>
    </div>
  );
}

/** One broken preview must never take the whole Appearance page down with it. */
class PreviewBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }
  render() {
    if (this.state.failed) {
      return <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)" }}>This preview couldn't be drawn here — check it on the storefront.</p>;
    }
    return this.props.children;
  }
}

/** Shown when the outlet's menu has nothing in it yet. Prices in paise, like the real menu. */
const SAMPLE_ITEMS = [
  {
    id: "sample-1",
    categoryId: "sample",
    name: "Steamed Veg Momos",
    description: "Hand-folded, cabbage & carrot, steamed to order",
    foodType: "veg",
    tags: ["bestseller"],
    images: [],
    basePrice: 0,
    variants: [
      { id: "half", label: "Half (5 pcs)", price: 6000 },
      { id: "full", label: "Full (10 pcs)", price: 11000 },
    ],
    modifierGroupIds: [],
    isAvailable: true,
  },
  { id: "sample-2", categoryId: "sample", name: "Kurkure Momos", description: "Crisp-fried with a spicy schezwan dip", foodType: "veg", tags: ["spicy"], images: [], basePrice: 15000, variants: [], modifierGroupIds: [], isAvailable: true },
  { id: "sample-3", categoryId: "sample", name: "Chicken Tandoori Momos", description: "Char-grilled, with mint chutney", foodType: "non-veg", tags: [], images: [], basePrice: 16000, variants: [], modifierGroupIds: [], isAvailable: true },
];

const previewHead = { display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" };
const previewLabel = { fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text-muted)" };
const unsavedPill = { fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--tone-warning-wash)", color: "var(--tone-warning)" };

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
