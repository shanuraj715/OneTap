import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type {
  AccordionProps,
  AlertProps,
  BadgeProps,
  ChipProps,
  ContentCardProps,
  ProgressProps,
} from "@onetap/ui";
import {
  resolveDarkTokens,
  themeTokensSchema,
  tokensToCssVars,
  TONES_DARK,
  TONES_LIGHT,
  type MenuItem,
  type Theme,
  type ThemeTokens,
} from "@onetap/config-schema";
import { getItemCardVariant, getVariant } from "@onetap/ui";
import { Moon, Palette, RotateCcw, Save, Sun } from "lucide-react";
import { useOutlet, usePatchConfig } from "../lib/useOutlet";
import { Button, Card, ColorInput, Field, InfoHint, Note, PageHeader, STICKY_HEADER_CLEARANCE, Tabs, TextInput, Toast } from "../ui";

type Mode = "light" | "dark";

const COLOR_FIELDS: { key: keyof ThemeTokens; label: string; info: string }[] = [
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
const SAMPLE_ITEM: MenuItem = {
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
  const [mode, setMode] = useState<Mode>("light");
  const [theme, setTheme] = useState<Theme | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (outlet && !theme) setTheme(outlet.config.theme);
  }, [outlet, theme]);

  // The dark palette is derived when it hasn't been customised, so the editor
  // shows what will actually render rather than a copy of the light tokens.
  const tokens = useMemo<ThemeTokens | null>(() => {
    if (!theme) return null;
    return mode === "light" ? themeTokensSchema.parse(theme.light ?? {}) : resolveDarkTokens(theme);
  }, [theme, mode]);

  if (!outlet || !theme || !tokens) {
    return (
      <>
        <PageHeader title="Theme" />
        <Card>Seed an outlet from the Dashboard first.</Card>
      </>
    );
  }

  const set = (key: keyof ThemeTokens, value: string) => {
    setTheme({ ...theme, [mode]: { ...tokens, [key]: value } });
    setDirty(true);
  };

  const save = () =>
    patch.mutate({ outlet, patch: { theme } }, { onSuccess: () => setDirty(false) });

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

      <Tabs<Mode>
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

      <div style={grid}>
        {/* -------------------------------------------------------- controls */}
        <div style={{ minWidth: 0 }}>
          <Card title="Colours">
            {COLOR_FIELDS.map((f) => (
              <Field key={f.key} label={f.label} info={f.info}>
                <ColorInput value={tokens[f.key]} onChange={(v) => set(f.key, v)} />
              </Field>
            ))}
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

          {patch.error ? <Toast kind="error">{(patch.error as Error).message}</Toast> : null}
          {patch.isSuccess && !dirty ? <Toast kind="ok">Saved. Reload the storefront to see it.</Toast> : null}
        </div>

        {/* --------------------------------------------------------- preview */}
        <ThemePreview tokens={tokens} mode={mode} outletName={outlet.config.identity.name || outlet.name} />
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
function ThemePreview({ tokens, mode, outletName }: { tokens: ThemeTokens; mode: Mode; outletName: string }) {
  const vars = { ...tokensToCssVars(tokens), ...(mode === "light" ? TONES_LIGHT : TONES_DARK) } as CSSProperties;

  // Resolved through the registry, so the preview always shows whichever
  // variant the registry considers first for that family.
  const Alert = getVariant("alert").Component as React.ComponentType<AlertProps>;
  const Badge = getVariant("badge").Component as React.ComponentType<BadgeProps>;
  const Chip = getVariant("chip").Component as React.ComponentType<ChipProps>;
  const Accordion = getVariant("accordion").Component as React.ComponentType<AccordionProps>;
  const ContentCard = getVariant("content-card").Component as React.ComponentType<ContentCardProps>;
  const Progress = getVariant("progress").Component as React.ComponentType<ProgressProps>;
  const ItemCard = getItemCardVariant().Component;

  return (
    <div style={{ position: "sticky", top: STICKY_HEADER_CLEARANCE, minWidth: 0 }}>
      <Card
        title="Live preview"
        subtitle="These are the real storefront components."
        action={<InfoHint title="Live preview" text="Every component here is the same code the storefront renders, with your draft colours applied. If something looks wrong here, it will look wrong on the site." />}
      >
        <div style={{ ...vars, ...previewShell, background: tokens.colorBg, color: tokens.colorText }}>
          {/* header */}
          <div style={{ ...previewHeader, borderColor: tokens.colorBorder, background: tokens.colorSurface }}>
            <strong style={{ fontFamily: "var(--font-heading)", fontSize: 15 }}>{outletName}</strong>
            <span style={{ display: "flex", gap: 7 }}>
              <Button style={{ fontSize: 12, padding: "6px 12px" }}>Order now</Button>
              <Button variant="outline" style={{ fontSize: 12, padding: "6px 12px" }}>
                Menu
              </Button>
            </span>
          </div>

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
            <div style={{ background: tokens.colorSurface, border: `1px solid ${tokens.colorBorder}`, borderRadius: tokens.radiusCard, padding: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 3, fontSize: 13.5 }}>Card on surface</div>
              <div style={{ color: tokens.colorTextMuted, fontSize: 12.5 }}>Muted text, as it appears on a panel.</div>
            </div>
          </PreviewSection>

          {/* footer */}
          <div style={{ ...previewFooter, borderColor: tokens.colorBorder, color: tokens.colorTextMuted }}>
            FSSAI: 12345678901234 · © {new Date().getFullYear()} {outletName}
          </div>
        </div>
      </Card>
    </div>
  );
}

function PreviewSection({ label, stack, children }: { label: string; stack?: boolean; children: React.ReactNode }) {
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

function luminance(hex: string): number {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return 0;
  const channel = (v: string) => {
    const c = parseInt(v, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(m[1]!) + 0.7152 * channel(m[2]!) + 0.0722 * channel(m[3]!);
}

/** WCAG contrast ratio — the number that decides whether text is actually legible. */
function contrastRatio(a: string, b: string): number {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

function ContrastRow({ label, fg, bg }: { label: string; fg: string; bg: string }) {
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

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 420px)",
  gap: 22,
  alignItems: "start",
};
const previewShell: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  padding: 14,
  maxHeight: "76vh",
  overflowY: "auto",
  fontFamily: "var(--font-body)",
};
const previewHeader: CSSProperties = {
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
const previewFooter: CSSProperties = {
  borderTop: "1px solid",
  paddingTop: 10,
  marginTop: 4,
  fontSize: 11.5,
  textAlign: "center",
};
const previewLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  opacity: 0.55,
  marginBottom: 7,
};
const btn: CSSProperties = { fontSize: 12.5, padding: "7px 14px" };
const contrastRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "7px 0",
  borderBottom: "1px solid var(--color-border)",
};
const swatch: CSSProperties = {
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
