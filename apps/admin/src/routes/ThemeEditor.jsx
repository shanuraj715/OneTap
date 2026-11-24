import { useEffect, useMemo, useState } from "react";
                                           
             
                 
             
             
            
                   
                
                    
import {
  EFFECT_IDS,
  EFFECT_PRESETS,
  effectPreset,
  resolveDarkTokens,
  themeTokensSchema,
  tokensToCssVars,
  TONES_DARK,
  TONES_LIGHT,
                
             
                   
} from "@rasoipulse/config-schema";
import { fx, getItemCardVariant, getVariant } from "@rasoipulse/ui";
import { Moon, Palette, RotateCcw, Save, Sparkles, Sun, Undo2 } from "lucide-react";
import { useOutlet, usePatchConfig } from "../lib/useOutlet";
import { useStorePlan } from "../lib/useStorePlan";
import { useEffectCss } from "../lib/storePreview";
import { Button, Card, ColorInput, Field, InfoHint, Note, PageHeader, STICKY_HEADER_CLEARANCE, Tabs, TextInput, Toast } from "../ui";
import { StorefrontNav } from "../components/SubNav";

                             

const COLOR_FIELDS                                                            = [
  {
    key: "colorPrimary",
    label: "Primary",
    info: "Your brand colour. Buttons, links and the active menu item use it. Pick something with enough contrast against the background that white or black text sits readably on top.",
  },
  {
    key: "colorOnPrimary",
    label: "Text on primary",
    info: "The colour of text sitting on top of the primary colour. Usually white or near-black — whichever you can actually read on your brand colour.",
  },
  {
    key: "colorBg",
    label: "Background",
    info: "The page behind everything. Keep it close to white in light mode and close to black in dark mode; a strongly tinted background fights every other colour on the page.",
  },
  {
    key: "colorSurface",
    label: "Surface",
    info: "Cards, panels and the header sit on this. It should differ from the background just enough to separate a card from the page — a step, not a jump.",
  },
  {
    key: "colorText",
    label: "Text",
    info: "The main reading colour. Aim for strong contrast against the background; grey-on-grey body text is the most common accessibility failure on a restaurant site.",
  },
  {
    key: "colorTextMuted",
    label: "Muted text",
    info: "Secondary information — item descriptions, timestamps, captions. It must still be readable: muted means quieter, not invisible.",
  },
  {
    key: "colorBorder",
    label: "Border",
    info: "Card outlines and dividers. Usually a shade between the surface and the text; too dark and the page looks like a spreadsheet.",
  },
];

/** A complete MenuItem, so the real card component renders without stubs. */
const SAMPLE_ITEM           = {
  id: "preview-1",
  name: "Steam Momo",
  categoryId: "preview",
  description: "Eight pieces, hand-folded and steamed to order",
  foodType: "veg",
  tags: ["bestseller"],
  basePrice: 11000,
  variants: [{ id: "full", label: "Full plate", price: 11000 }],
  modifierGroupIds: [],
  gstRatePct: 5,
  isAvailable: true,
  sortOrder: 0,
};

export function ThemeEditor() {
  const { outlet } = useOutlet();
  const patch = usePatchConfig();
  const { effectAllowed } = useStorePlan();
  const [mode, setMode] = useState      ("light");
  const [theme, setTheme] = useState              (null);
  const [effect, setEffect] = useState("none");
  // The theme as it was before an effect's suggested palette was applied, so
  // the owner can take the effect's look but keep their own colours.
  const [beforePalette, setBeforePalette] = useState(null);
  const [dirty, setDirty] = useState(false);

  // Re-syncs whenever the selected outlet actually changes, not just once —
  // switching in the sidebar doesn't unmount this page. Keyed on outlet?._id
  // (not the outlet object, which gets a new reference on every background
  // refetch) so an in-progress edit on the same outlet is never stomped.
  useEffect(() => {
    if (outlet) {
      setTheme(outlet.config.theme);
      setEffect(outlet.config.effect?.style ?? "none");
      setBeforePalette(null);
      setDirty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlet?._id]);

  // The dark palette is derived when it hasn't been customised, so the editor
  // shows what will actually render rather than a copy of the light tokens.
  const forcesDark = effectPreset(effect).forcesDark;
  // A dark-only effect never shows the light palette, so editing it would be
  // editing something no visitor sees.
  const shownMode = forcesDark ? "dark" : mode;

  const tokens = useMemo                    (() => {
    if (!theme) return null;
    return shownMode === "light" ? themeTokensSchema.parse(theme.light ?? {}) : resolveDarkTokens(theme);
  }, [theme, shownMode]);

  if (!outlet || !theme || !tokens) {
    return (
      <>
        <PageHeader title="Theme" />
        <StorefrontNav />
        <Card>Seed an outlet from the Dashboard first.</Card>
      </>
    );
  }

  const set = (key                   , value        ) => {
    setTheme({ ...theme, [shownMode]: { ...tokens, [key]: value } });
    setDirty(true);
  };

  /** Switch effect and load its suggested palette into the draft — the owner can still edit or undo it. */
  const chooseEffect = (id) => {
    if (id === effect) return;
    const palette = EFFECT_PRESETS[id].palette;
    setEffect(id);
    setDirty(true);
    if (!palette) {
      setBeforePalette(null);
      return;
    }
    setBeforePalette({ theme, effectLabel: EFFECT_PRESETS[id].label });
    setTheme({
      ...theme,
      light: palette.light ? { ...theme.light, ...palette.light } : theme.light,
      dark: palette.dark ? { ...theme.dark, ...palette.dark } : theme.dark,
    });
  };

  const save = () =>
    patch.mutate(
      { outlet, patch: { theme, effect: { style: effect } } },
      {
        onSuccess: () => {
          setDirty(false);
          setBeforePalette(null);
        },
      },
    );

  return (
    <>
      <PageHeader
        title="Theme"
        icon={<Palette size={23} />}
        subtitle="Every storefront component takes its colours from here."
        action={
          <span style={{ display: "flex", gap: 8 }}>
            <Button
              variant="outline"
              onClick={() => {
                setTheme(outlet.config.theme);
                setEffect(outlet.config.effect?.style ?? "none");
                setBeforePalette(null);
                setDirty(false);
              }}
              style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
            >
              <RotateCcw size={14} /> Reset
            </Button>
            <Button onClick={save} disabled={!dirty || patch.isPending} style={{ display: "inline-flex", gap: 7, alignItems: "center" }}>
              <Save size={15} />
              {patch.isPending ? "Saving…" : dirty ? "Save theme" : "Saved"}
            </Button>
          </span>
        }
      />

      <StorefrontNav />

      <Card
        title="Effect"
        icon={<Sparkles size={16} />}
        subtitle="The look of every card, popup and page on your storefront. Your admin panel isn't affected."
      >
        <EffectPicker value={effect} onChange={chooseEffect} primary={tokens.colorPrimary} isAllowed={effectAllowed} />
        {beforePalette ? (
          <div style={paletteNotice}>
            <span>
              Colours set to the {beforePalette.effectLabel} palette. Your brand colour is unchanged.
            </span>
            <Button
              variant="outline"
              onClick={() => {
                setTheme(beforePalette.theme);
                setBeforePalette(null);
              }}
              style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12.5, padding: "5px 11px" }}
            >
              <Undo2 size={13} /> Keep my colours
            </Button>
          </div>
        ) : null}
      </Card>

      {forcesDark ? (
        <Note icon={<Moon size={15} />}>
          {EFFECT_PRESETS[effect].label} always shows your dark palette, whatever the visitor&apos;s phone is set to — so that&apos;s the one you&apos;re editing.
        </Note>
      ) : (
        <>
          <Tabs
            value={mode}
            onChange={setMode}
            tabs={[
              { id: "light", label: "Light mode", icon: <Sun size={14} /> },
              { id: "dark", label: "Dark mode", icon: <Moon size={14} /> },
            ]}
          />

          <Note icon={mode === "light" ? <Sun size={15} /> : <Moon size={15} />}>
            {mode === "light"
              ? "The palette most visitors see. Everything below previews with these exact values."
              : "Shown to visitors whose phone is in dark mode. Start from the derived values and adjust — don't just invert the light palette, or text ends up unreadable on tinted panels."}
          </Note>
        </>
      )}

      <div style={grid}>
        {/* -------------------------------------------------------- controls */}
        <div style={{ minWidth: 0 }}>
          <Card title="Colours">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
              {COLOR_FIELDS.map((f) => (
                <Field key={f.key} label={f.label} info={f.info} style={{ maxWidth: "none" }}>
                  <ColorInput value={tokens[f.key]} onChange={(v) => set(f.key, v)} />
                </Field>
              ))}
            </div>
          </Card>

          <Card title="Shape">
            <Field
              label="Card radius"
              hint="e.g. 12px, 4px, 999px"
              info="How rounded the corners of cards and buttons are across the whole storefront. 0px reads sharp and formal, 12px friendly, 999px fully pill-shaped. One value sets it everywhere so the site stays consistent."
            >
              <TextInput value={tokens.radiusCard} onChange={(e) => set("radiusCard", e.target.value)} style={{ width: 130 }} />
            </Field>
          </Card>

          <Card title="Contrast check" subtitle="Text has to be readable, not just on-brand.">
            <ContrastRow label="Body text on background" fg={tokens.colorText} bg={tokens.colorBg} />
            <ContrastRow label="Muted text on background" fg={tokens.colorTextMuted} bg={tokens.colorBg} />
            <ContrastRow label="Body text on surface" fg={tokens.colorText} bg={tokens.colorSurface} />
            <ContrastRow label="Text on primary" fg={tokens.colorOnPrimary} bg={tokens.colorPrimary} />
          </Card>

          {patch.error ? <Toast kind="error">{(patch.error         ).message}</Toast> : null}
          {patch.isSuccess && !dirty ? <Toast kind="ok">Saved. Reload the storefront to see it.</Toast> : null}
        </div>

        {/* --------------------------------------------------------- preview */}
        <ThemePreview tokens={tokens} mode={shownMode} effect={effect} outletName={outlet.config.identity.name || outlet.name} />
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- preview */

/**
 * Real components, rendered under the draft palette.
 *
 * The tokens are applied as CSS custom properties on this wrapper, so every
 * component inside picks them up exactly as it would on the storefront — this
 * is the actual UI, not a mock-up of it.
 */
function ThemePreview({ tokens, mode, effect, outletName }) {
  const vars = { ...tokensToCssVars(tokens), ...(mode === "light" ? TONES_LIGHT : TONES_DARK) }                 ;
  const effectCss = useEffectCss(effect);

  // Resolved through the registry, so the preview always shows whichever
  // variant the registry considers first for that family.
  const Alert = getVariant("alertVariant").Component                                   ;
  const Badge = getVariant("badgeVariant").Component                                   ;
  const Chip = getVariant("chipVariant").Component                                  ;
  const Accordion = getVariant("accordionVariant").Component                                       ;
  const ContentCard = getVariant("contentCardVariant").Component                                         ;
  const Progress = getVariant("progressVariant").Component                                      ;
  const ItemCard = getItemCardVariant().Component;

  return (
    <div style={{ position: "sticky", top: STICKY_HEADER_CLEARANCE, minWidth: 0 }}>
      <Card
        title="Live preview"
        subtitle="These are the real storefront components."
        action={<InfoHint title="Live preview" text="Every component here is the same code the storefront renders, with your draft colours applied. If something looks wrong here, it will look wrong on the site." />}
      >
        {/* The effect's CSS is scoped to [data-fx-preview], so it can't leak
            into the admin around it. `transform` makes this box the
            containing block for the effect's fixed background layer, keeping
            it inside the preview; the inner div is what scrolls, so that
            layer stays put behind the content. */}
        {effectCss ? <style>{effectCss}</style> : null}
        <div data-fx-preview="" data-theme={mode} style={{ ...vars, ...previewFrame, background: tokens.colorBg, color: tokens.colorText }}>
        <div style={previewScroll}>
          {/* header */}
          <div className="ot-fx-bar" style={fx("bar", { ...previewHeader, border: `1px solid ${tokens.colorBorder}`, background: tokens.colorSurface })}>
            <strong style={{ fontFamily: "var(--font-heading)", fontSize: 15 }}>{outletName}</strong>
            <span style={{ display: "flex", gap: 7 }}>
              <Button style={{ fontSize: 12, padding: "6px 12px" }}>Order now</Button>
              <Button variant="outline" style={{ fontSize: 12, padding: "6px 12px" }}>
                Menu
              </Button>
            </span>
          </div>

          <PreviewSection label="Ordering" stack>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="ot-fx-chip" data-active="true" style={fx("chip", { ...sampleChip, border: "1.5px solid var(--color-primary)", background: "color-mix(in srgb, var(--color-primary) 10%, var(--color-bg))", color: "var(--color-primary)" })}>
                Takeaway
              </button>
              <button type="button" className="ot-fx-chip" data-active="false" style={fx("chip", { ...sampleChip, border: "1.5px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)" })}>
                Delivery
              </button>
            </div>
            <input className="ot-fx-input" placeholder="Note for the kitchen" readOnly style={fx("input", sampleInput)} />
            <button type="button" className="ot-fx-btn" style={fx("btn", sampleCartBar)}>
              <span>2 items · ₹220</span>
              <span>View cart →</span>
            </button>
          </PreviewSection>

          <PreviewSection label="Buttons">
            <Button style={btn}>Primary</Button>
            <Button variant="outline" style={btn}>
              Outline
            </Button>
            <Button disabled style={btn}>
              Disabled
            </Button>
          </PreviewSection>

          <PreviewSection label="Badges & chips">
            <Badge>New</Badge>
            <Badge tone="success">Paid</Badge>
            <Badge tone="warning">Pending</Badge>
            <Badge tone="danger">Failed</Badge>
            <Chip>Bestseller</Chip>
            <Chip selected>Spicy</Chip>
          </PreviewSection>

          <PreviewSection label="Status messages" stack>
            <Alert tone="success" title="Order placed">
              We&apos;ll have it ready in about 15 minutes.
            </Alert>
            <Alert tone="warning" title="Running late">
              The kitchen is busy — this may take a little longer.
            </Alert>
            <Alert tone="danger" title="Payment failed">
              That card was declined. Try another payment method.
            </Alert>
            <Alert tone="info" title="Table 7">
              You&apos;re ordering to your table.
            </Alert>
          </PreviewSection>

          <PreviewSection label="Menu item" stack>
            <ItemCard item={SAMPLE_ITEM} />
          </PreviewSection>

          <PreviewSection label="Content card" stack>
            <ContentCard title="Fresh every morning" body="Dough made at 6am, filled by hand, steamed to order." />
          </PreviewSection>

          <PreviewSection label="Accordion" stack>
            <Accordion
              items={[
                { q: "Do you deliver?", a: "Yes, within 5 km of Laxmi Nagar." },
                { q: "Are the momos veg?", a: "Everything on our menu is pure vegetarian." },
              ]}
            />
          </PreviewSection>

          <PreviewSection label="Progress" stack>
            <Progress value={64} label="Preparing your order" />
          </PreviewSection>

          <PreviewSection label="Surfaces" stack>
            <div className="ot-fx-card" style={fx("card", { background: tokens.colorSurface, border: `1px solid ${tokens.colorBorder}`, borderRadius: tokens.radiusCard, padding: 12 })}>
              <div style={{ fontWeight: 600, marginBottom: 3, fontSize: 13.5 }}>Card on surface</div>
              <div style={{ color: tokens.colorTextMuted, fontSize: 12.5 }}>Muted text, as it appears on a panel.</div>
            </div>
          </PreviewSection>

          {/* footer */}
          <div style={{ ...previewFooter, borderColor: tokens.colorBorder, color: tokens.colorTextMuted }}>
            FSSAI: 12345678901234 · © {new Date().getFullYear()} {outletName}
          </div>
        </div>
        </div>
      </Card>
    </div>
  );
}

/**
 * The selected effect's CSS, scoped to the preview box. Dynamic import, so the
 * admin bundle never carries any effect up front and only the chosen one is
 * ever downloaded.
 */

/* ---------------------------------------------------------- effect picker */

function EffectPicker({ value, onChange, primary, isAllowed }) {
  return (
    <div style={tileGrid} role="radiogroup" aria-label="Storefront effect">
      {EFFECT_IDS.map((id) => {
        const p = EFFECT_PRESETS[id];
        const active = value === id;
        // An effect outside the plan can't be newly chosen — but one already
        // in use stays shown as selected (the storefront shows "none" for it).
        const locked = !isAllowed(id);
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-disabled={locked || undefined}
            onClick={() => !locked && onChange(id)}
            className={locked ? undefined : "ot-press"}
            title={locked ? "Not in your plan" : undefined}
            style={{ ...tile, ...(active ? tileActive : {}), ...(locked ? tileLocked : {}) }}
          >
            <EffectSwatch id={id} primary={primary} />
            <span style={{ fontWeight: 600, fontSize: 13 }}>{p.label}</span>
            <span style={{ fontSize: 11.5, color: "var(--color-text-muted)", lineHeight: 1.4 }}>
              {locked ? "Not in your plan" : p.description}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * A thumbnail of each effect drawn with a few inline styles — deliberately
 * NOT the effect's real CSS, so showing all seven tiles downloads none of it.
 */
function EffectSwatch({ id, primary }) {
  const tint = (pct) => `color-mix(in srgb, ${primary} ${pct}%, transparent)`;
  const looks = {
    none: { bg: "#F6F6F4", card: { background: "#fff", border: "1px solid #E4E4E0" } },
    glass: {
      bg: `radial-gradient(60% 70% at 15% 20%, ${tint(45)}, transparent 70%), radial-gradient(60% 70% at 90% 30%, rgba(91,140,255,.4), transparent 70%), #EEF1F7`,
      card: { background: "rgba(255,255,255,.5)", border: "1px solid rgba(255,255,255,.75)", boxShadow: "0 6px 16px rgba(22,30,56,.12)" },
    },
    neumorph: { bg: "#E6E9EF", card: { background: "#E6E9EF", boxShadow: "5px 5px 10px #BDC2CA, -5px -5px 10px #FFFFFF" } },
    clay: {
      bg: "#F6F0FF",
      card: { background: "#fff", borderRadius: 16, boxShadow: `0 8px 14px ${tint(22)}, inset 0 2px 1px #fff, inset 0 -4px 8px rgba(40,24,80,.1)` },
    },
    aurora: {
      bg: "radial-gradient(45% 60% at 20% 30%, rgba(139,92,246,.75), transparent 70%), radial-gradient(45% 60% at 80% 25%, rgba(34,211,238,.6), transparent 70%), radial-gradient(45% 60% at 70% 85%, rgba(236,72,153,.55), transparent 70%), #0B0A1A",
      card: { background: "rgba(21,19,43,.6)", border: "1px solid rgba(167,139,250,.3)" },
    },
    cyberpunk: {
      bg: `linear-gradient(${tint(18)} 1px, transparent 1px) 0 0 / 12px 12px, linear-gradient(90deg, ${tint(18)} 1px, transparent 1px) 0 0 / 12px 12px, #07060D`,
      card: { background: "#0F0E1A", border: `1px solid ${primary}`, borderRadius: 3, boxShadow: `0 0 10px ${tint(55)}` },
    },
    "dark-premium": {
      bg: `radial-gradient(90% 60% at 50% -10%, ${tint(30)}, transparent 70%), #0B0B0C`,
      card: { background: "linear-gradient(180deg, #202023, #151517)", border: "1px solid rgba(255,255,255,.09)" },
    },
  };
  const look = looks[id] ?? looks.none;
  return (
    <span aria-hidden style={{ ...swatchBox, background: look.bg }}>
      <span style={{ ...swatchCard, ...look.card }}>
        <span style={{ ...swatchDot, background: primary }} />
      </span>
    </span>
  );
}

function PreviewSection({ label, stack, children }                                                               ) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={previewLabel}>{label}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flexDirection: stack ? "column" : "row", alignItems: stack ? "stretch" : "center" }}>
        {children}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- contrast */

function luminance(hex        )         {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return 0;
  const channel = (v        ) => {
    const c = parseInt(v, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(m[1] ) + 0.7152 * channel(m[2] ) + 0.0722 * channel(m[3] );
}

/** WCAG contrast ratio — the number that decides whether text is actually legible. */
function contrastRatio(a        , b        )         {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

function ContrastRow({ label, fg, bg }                                           ) {
  const ratio = contrastRatio(fg, bg);
  const pass = ratio >= 4.5;
  const large = ratio >= 3;

  return (
    <div style={contrastRow}>
      <span style={{ ...swatch, background: bg, color: fg, borderColor: "var(--color-border)" }}>Aa</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5 }}>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums", fontSize: 12.5, fontWeight: 600 }}>{ratio.toFixed(1)}:1</span>
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          padding: "2px 8px",
          borderRadius: 999,
          whiteSpace: "nowrap",
          background: pass ? "var(--tone-success-wash)" : large ? "var(--tone-warning-wash)" : "var(--tone-danger-wash)",
          color: pass ? "var(--tone-success)" : large ? "var(--tone-warning)" : "var(--tone-danger)",
        }}
      >
        {pass ? "Good" : large ? "Large text only" : "Too low"}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ styles */

const grid                = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 420px)",
  gap: 22,
  alignItems: "start",
};
const previewFrame                = {
  position: "relative",
  transform: "translateZ(0)",
  overflow: "hidden",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  fontFamily: "var(--font-body)",
};
const previewScroll = { padding: 14, maxHeight: "76vh", overflowY: "auto" };
const sampleChip = { flex: 1, font: "inherit", fontSize: 13, fontWeight: 600, padding: "10px 8px", borderRadius: 12, cursor: "pointer" };
const sampleInput = {
  width: "100%",
  boxSizing: "border-box",
  font: "inherit",
  fontSize: 13.5,
  padding: "9px 11px",
  borderRadius: 9,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
};
const sampleCartBar = {
  display: "flex",
  justifyContent: "space-between",
  font: "inherit",
  fontSize: 13.5,
  fontWeight: 700,
  padding: "11px 18px",
  borderRadius: 999,
  border: "none",
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  boxShadow: "0 8px 30px rgba(0, 0, 0, 0.28)",
  cursor: "pointer",
};
const paletteNotice                = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginTop: 14,
  padding: "9px 12px",
  borderRadius: 9,
  fontSize: 12.5,
  background: "var(--tone-info-wash)",
  color: "var(--tone-info)",
};
const tileGrid                = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 };
const tile                = {
  font: "inherit",
  textAlign: "left",
  display: "flex",
  flexDirection: "column",
  gap: 5,
  padding: 8,
  borderRadius: 11,
  border: "1.5px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
};
const tileLocked = { opacity: 0.5, cursor: "not-allowed" };
const tileActive                = {
  border: "1.5px solid var(--color-primary)",
  boxShadow: "0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent)",
};
const swatchBox                = {
  display: "grid",
  placeItems: "center",
  height: 58,
  borderRadius: 7,
  marginBottom: 3,
  overflow: "hidden",
};
const swatchCard                = { width: "56%", height: 30, borderRadius: 8, display: "flex", alignItems: "center", padding: "0 8px" };
const swatchDot                = { width: 14, height: 6, borderRadius: 3 };
const previewHeader                = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  padding: "10px 12px",
  border: "1px solid",
  borderRadius: 10,
  marginBottom: 16,
};
const previewFooter                = {
  borderTop: "1px solid",
  paddingTop: 10,
  marginTop: 4,
  fontSize: 11.5,
  textAlign: "center",
};
const previewLabel                = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  opacity: 0.55,
  marginBottom: 7,
};
const btn                = { fontSize: 12.5, padding: "7px 14px" };
const contrastRow                = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "7px 0",
  borderBottom: "1px solid var(--color-border)",
};
const swatch                = {
  display: "grid",
  placeItems: "center",
  width: 34,
  height: 26,
  borderRadius: 6,
  border: "1px solid",
  fontSize: 12,
  fontWeight: 700,
  flexShrink: 0,
};
