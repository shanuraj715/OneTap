                                           
                                                              
import { VARIANT_SLOTS,                                       } from "@onetap/ui";
import { ThemeStyle } from "@/components/ThemeStyle";
import { getMenu } from "@/lib/menu";
import { getOutlet } from "@/lib/outlet";

export const dynamic = "force-dynamic";
export const metadata = { title: "Component variants · TablePe" };

export default async function VariantsPage() {
  const outlet = await getOutlet();
  if (!outlet) {
    return (
      <main style={{ maxWidth: 560, margin: "120px auto", padding: 24, textAlign: "center" }}>
        <h1>No outlet</h1>
        <p>
          Run <code>pnpm seed</code> first.
        </p>
      </main>
    );
  }

  const menu = await getMenu(outlet.id);
  const { identity, theme, typography, layout } = outlet.config;
  const name = identity.name || outlet.name;

  const ctx                 = {
    outletName: name,
    tagline: identity.tagline || undefined,
    phone: identity.phone || undefined,
    address: identity.address || undefined,
    fssaiLicense: identity.fssaiLicense || undefined,
    gstin: identity.gstin || undefined,
    items: pickSamples(menu.items),
  };

  const total = VARIANT_SLOTS.reduce((n, s) => n + s.variants.length, 0);

  return (
    <>
      <ThemeStyle theme={theme} typography={typography} />
      <main style={page}>
        <header>
          <p style={eyebrow}>TablePe · component variants</p>
          <h1 style={h1}>Every variant, side by side</h1>
          <p style={lede}>
            {total} variants across {VARIANT_SLOTS.length} component families, rendered with{" "}
            <strong>{name}</strong>&apos;s real theme, typography and menu. Whichever is marked{" "}
            <em>active</em> is what the storefront currently uses — change it under Appearance in the
            admin.
          </p>
          <p style={{ ...lede, marginTop: 10 }}>
            Every variant has a unique code (<strong>H1</strong>, <strong>C07</strong>,{" "}
            <strong>BTN04</strong>…) and a unique id (<code style={code}>card.image-overlay</code>).
            Use either to refer to one exactly.
          </p>
        </header>

        <nav style={indexNav} aria-label="Jump to a family">
          {VARIANT_SLOTS.map((slot) => (
            <a key={slot.key} href={`#${slot.key}`} style={indexLink}>
              {slot.label} <span style={{ opacity: 0.55 }}>{slot.variants.length}</span>
            </a>
          ))}
        </nav>

        {VARIANT_SLOTS.map((slot) => {
          const activeId = (layout                                     )[slot.key];
          return (
            <section key={slot.key} id={slot.key} style={{ marginTop: 46, scrollMarginTop: 16 }}>
              <div style={sectionHead}>
                <div>
                  <h2 style={h2}>{slot.label}</h2>
                  <p style={{ ...lede, fontSize: "0.86rem", marginTop: 3 }}>{slot.description}</p>
                </div>
                <span style={sectionMeta}>
                  {slot.variants.length} variants · active: <code style={code}>{activeId ?? "—"}</code>
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {slot.variants.map((meta             ) => (
                  <Frame key={meta.id} meta={meta} active={meta.id === activeId} flush={slot.flush}>
                    {slot.preview(meta, ctx)}
                  </Frame>
                ))}
              </div>
            </section>
          );
        })}

        <p style={{ ...lede, marginTop: 52 }}>
          <a href="/" style={{ color: "var(--color-primary)" }}>
            ← Back to the storefront
          </a>
        </p>
      </main>
    </>
  );
}

/** One item with sizes + a tag, one plain, one sold out — so every layout is exercised. */
function pickSamples(items            )             {
  if (items.length === 0) return [];
  const withVariants = items.find((i) => i.variants.length > 1) ?? items[0] ;
  const withDesc = items.find((i) => i.id !== withVariants.id && i.description) ?? items[1] ?? withVariants;
  const third = items.find((i) => i.id !== withVariants.id && i.id !== withDesc.id) ?? withVariants;
  return [withVariants, withDesc, { ...third, isAvailable: false }];
}

function Frame({
  meta,
  active,
  flush,
  children,
}   
                    
                  
                  
                            
 ) {
  return (
    <div style={{ ...frame, borderColor: active ? "var(--color-primary)" : "var(--color-border)" }}>
      <div style={frameBar}>
        <span style={codeBadge}>{meta.code}</span>
        <span style={{ fontWeight: 600 }}>{meta.name}</span>
        <code style={code}>{meta.id}</code>
        <span style={frameDesc}>{meta.description}</span>
        {active ? <span style={activeChip}>active</span> : null}
      </div>
      <div style={{ padding: flush ? 0 : 18, background: "var(--color-bg)" }}>{children}</div>
    </div>
  );
}

const page                = { maxWidth: 1140, margin: "0 auto", padding: "56px 24px 96px" };
const eyebrow                = {
  font: "12px/1 var(--font-body)",
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--color-text-muted)",
  margin: 0,
};
const h1                = { fontSize: "clamp(1.8rem, 4vw, 2.4rem)", margin: "10px 0 8px", color: "var(--color-text)" };
const lede                = { color: "var(--color-text-muted)", maxWidth: "70ch", lineHeight: 1.6, margin: 0 };
const indexNav                = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  marginTop: 22,
  paddingTop: 18,
  borderTop: "1px solid var(--color-border)",
};
const indexLink                = {
  fontSize: "0.79rem",
  padding: "5px 11px",
  borderRadius: 999,
  border: "1px solid var(--color-border)",
  color: "var(--color-text)",
  textDecoration: "none",
};
const sectionHead                = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  paddingBottom: 10,
  marginBottom: 18,
  borderBottom: "2px solid var(--color-text)",
};
const h2                = { fontSize: "1.25rem", margin: 0, color: "var(--color-text)" };
const sectionMeta                = { fontSize: "0.8rem", color: "var(--color-text-muted)" };
const frame                = { borderWidth: 1, borderStyle: "solid", borderColor: "var(--color-border)", borderRadius: 12, overflow: "hidden" };
const frameBar                = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  padding: "9px 14px",
  background: "var(--color-surface)",
  borderBottom: "1px solid var(--color-border)",
  fontSize: "0.82rem",
  color: "var(--color-text)",
};
const frameDesc                = { color: "var(--color-text-muted)", fontSize: "0.78rem" };
const code                = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "0.72rem",
  padding: "2px 6px",
  borderRadius: 5,
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text-muted)",
};
const codeBadge                = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "0.68rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  padding: "3px 7px",
  borderRadius: 5,
  background: "var(--color-text)",
  color: "var(--color-bg)",
};
const activeChip                = {
  marginLeft: "auto",
  fontSize: "0.66rem",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  padding: "3px 8px",
  borderRadius: 999,
};
