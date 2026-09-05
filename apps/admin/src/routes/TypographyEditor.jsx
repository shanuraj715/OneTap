import { useEffect, useState } from "react";
                                           
import {
  FONT_FAMILIES,
  fontById,
  googleFontsUrl,
  TYPE_SCALES,
                  
} from "@onetap/config-schema";
import { useOutlet, usePatchConfig } from "../lib/useOutlet";
import { Button, Card, Field, PageHeader, TextInput, Toast } from "../ui";
import { StorefrontNav } from "../components/SubNav";

const CATEGORIES = ["sans", "serif", "display", "mono"]         ;
const CATEGORY_LABELS = { sans: "Sans-serif", serif: "Serif", display: "Display", mono: "Monospace" };

/** Loads the preview fonts so the picker shows each face in its own typeface. */
function useFontPreloader() {
  useEffect(() => {
    const id = "onetap-font-previews";
    if (document.getElementById(id)) return;
    const specs = FONT_FAMILIES.map((f) => f.google).filter(Boolean)            ;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${specs.map((s) => `family=${s}`).join("&")}&display=swap`;
    document.head.appendChild(link);
  }, []);
}

export function TypographyEditor() {
  useFontPreloader();
  const { outlet } = useOutlet();
  const patch = usePatchConfig();
  const [typo, setTypo] = useState                   (null);

  // Re-syncs whenever the selected outlet actually changes, not just once —
  // switching in the sidebar doesn't unmount this page. Keyed on outlet?._id
  // (not the outlet object, which gets a new reference on every background
  // refetch) so an in-progress edit on the same outlet is never stomped.
  useEffect(() => {
    if (outlet) setTypo(outlet.config.typography);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlet?._id]);

  if (!outlet || !typo) {
    return (
      <>
        <PageHeader title="Typography" />
        <StorefrontNav />
        <Card>Seed an outlet from the Dashboard first.</Card>
      </>
    );
  }

  const set =                             (key   , value               ) => setTypo({ ...typo, [key]: value });
  const dirty = JSON.stringify(typo) !== JSON.stringify(outlet.config.typography);
  const heading = fontById(typo.headingFont);
  const bodyFont = fontById(typo.bodyFont);

  return (
    <>
      <PageHeader title="Typography" subtitle="Fonts and type scale. Applies to every storefront component." />

      <StorefrontNav />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>
        <div>
          <FontPicker label="Heading font" value={typo.headingFont} onChange={(v) => set("headingFont", v)} />
          <FontPicker label="Body font" value={typo.bodyFont} onChange={(v) => set("bodyFont", v)} />

          <Card title="Scale & weight">
            <Field label={`Base size — ${typo.baseSize}px`} hint="Everything else scales from this" info="The size of ordinary body text. Every heading is calculated from it, so nudging this one number resizes the whole site in proportion. 16px is the comfortable default for reading on a phone.">
              <input
                type="range"
                min={13}
                max={20}
                value={typo.baseSize}
                onChange={(e) => set("baseSize", Number(e.target.value))}
                style={{ width: 260 }}
              />
            </Field>

            <Field label="Type scale" hint="How fast headings grow relative to body text" info="The gap between each heading level. A small scale keeps everything close in size and feels calm and dense; a large scale makes headings dominate and feels bold and airy.">
              <div style={{ display: "flex", gap: 8 }}>
                {(Object.keys(TYPE_SCALES)                                ).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => set("scale", k)}
                    style={{ ...pill, ...(typo.scale === k ? pillOn : {}) }}
                  >
                    {TYPE_SCALES[k].label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label={`Heading weight — ${typo.headingWeight}`} info="How heavy headings are. 400 is normal, 700 bold, 900 very heavy. Not every font has every weight — if a change does nothing visible, that font does not include it.">
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[400, 500, 600, 700, 800, 900].map((w) => (
                  <button key={w} type="button" onClick={() => set("headingWeight", w)} style={{ ...pill, ...(typo.headingWeight === w ? pillOn : {}) }}>
                    {w}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Heading letter spacing" info="Extra space between letters in headings. Slightly negative tightens large display type and usually looks better; positive space suits small uppercase labels.">
              <div style={{ display: "flex", gap: 8 }}>
                {(["tight", "normal", "wide"]         ).map((k) => (
                  <button key={k} type="button" onClick={() => set("headingLetterSpacing", k)} style={{ ...pill, ...(typo.headingLetterSpacing === k ? pillOn : {}) }}>
                    {k}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Uppercase headings" info="Prints headings in CAPITALS. It reads as formal and can look striking on short headings, but long ones become hard to read — capitals remove the word shapes people scan by.">
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                <input type="checkbox" checked={typo.uppercaseHeadings} onChange={(e) => set("uppercaseHeadings", e.target.checked)} />
                Render all headings in capitals
              </label>
            </Field>

            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <Button onClick={() => patch.mutate({ outlet, patch: { typography: typo } })} disabled={!dirty || patch.isPending}>
                {patch.isPending ? "Saving…" : "Save typography"}
              </Button>
              <Button variant="outline" onClick={() => setTypo(outlet.config.typography)} disabled={!dirty}>
                Reset
              </Button>
            </div>
            {patch.isSuccess && !dirty ? <Toast kind="ok">Saved. Reload the storefront to see it.</Toast> : null}
            {patch.error ? <Toast kind="error">{(patch.error         ).message}</Toast> : null}
          </Card>
        </div>

        <Card title="Preview">
          <div style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: 16, fontSize: typo.baseSize, lineHeight: TYPE_SCALES[typo.scale].lineHeight }}>
            <div
              style={{
                fontFamily: heading.stack,
                fontWeight: typo.headingWeight,
                letterSpacing: typo.headingLetterSpacing === "tight" ? "-0.02em" : typo.headingLetterSpacing === "wide" ? "0.04em" : 0,
                textTransform: typo.uppercaseHeadings ? "uppercase" : "none",
                fontSize: `${TYPE_SCALES[typo.scale].ratio ** 3}em`,
                lineHeight: 1.15,
                marginBottom: 8,
                color: "var(--color-text)",
              }}
            >
              {outlet.config.identity.name || outlet.name}
            </div>
            <p style={{ fontFamily: bodyFont.stack, margin: 0, color: "var(--color-text-muted)" }}>
              Steamed, fried, kurkure — momos made fresh through the day. Half plate from ₹60.
            </p>
            <p style={{ fontFamily: bodyFont.stack, margin: "10px 0 0", fontSize: "0.85em", color: "var(--color-text-muted)" }}>
              {heading.name} + {bodyFont.name}
            </p>
          </div>
          <p style={{ fontSize: 11.5, color: "var(--color-text-muted)", marginTop: 10, lineHeight: 1.5 }}>
            {googleFontsUrl(typo)
              ? "Loaded from Google Fonts on the storefront."
              : "System fonts only — nothing to download."}
          </p>
        </Card>
      </div>
    </>
  );
}

function FontPicker({ label, value, onChange }                                                                 ) {
  return (
    <Card title={label}>
      {CATEGORIES.map((cat) => {
        const fonts = FONT_FAMILIES.filter((f) => f.category === cat);
        if (!fonts.length) return null;
        return (
          <div key={cat} style={{ marginBottom: 14 }}>
            <div style={groupTitle}>{CATEGORY_LABELS[cat]}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 7 }}>
              {fonts.map((f) => {
                const on = f.id === value;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onChange(f.id)}
                    style={{
                      ...fontBtn,
                      fontFamily: f.stack,
                      borderColor: on ? "var(--color-primary)" : "var(--color-border)",
                      boxShadow: on ? "inset 0 0 0 1px var(--color-primary)" : "none",
                    }}
                  >
                    <span style={{ fontSize: 17, lineHeight: 1.2 }}>Gazab Momos</span>
                    <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--color-text-muted)" }}>{f.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </Card>
  );
}

const pill                = {
  font: "inherit",
  fontSize: 13,
  padding: "6px 13px",
  borderRadius: 999,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text-muted)",
  cursor: "pointer",
  textTransform: "capitalize",
};
const pillOn                = { background: "var(--color-primary)", color: "var(--color-on-primary)", borderColor: "var(--color-primary)" };
const groupTitle                = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--color-text-muted)",
  marginBottom: 7,
};
const fontBtn                = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  alignItems: "flex-start",
  padding: "10px 12px",
  borderRadius: 9,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
  textAlign: "left",
};
