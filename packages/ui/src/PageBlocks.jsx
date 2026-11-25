import { renderMarkdown, safeHref } from "@rasoipulse/config-schema";
import { fx } from "./fx";
import { getVariant } from "./registry";

/**
 * The blocks of a store page, drawn. One renderer for the storefront (what visitors see) and the dashboard's page
 * editor (its live preview), so the owner sees exactly what will be published.
 *
 *   blocks   the page's blocks, in order (see config-schema/store-pages.js)
 *   contact  `contactDetails(outletConfig)` — what the "Find us" block shows for the outlet being viewed
 *   layout   the store's look choices, for the FAQ and carousel styles
 *   preview  in the editor: an empty photo shows a placeholder instead of nothing
 *
 * Text is Markdown, rendered by the same escape-first renderer the Rasoi Pulse website uses, so whatever is typed can
 * never carry a script; links are checked again here before they become `<a>`.
 */

const column = { maxWidth: 820, margin: "0 auto", padding: "8px 18px 56px", display: "flex", flexDirection: "column", gap: 30, boxSizing: "border-box" };
const headingFont = { fontFamily: "var(--font-heading)", fontWeight: "var(--font-weight-heading)", letterSpacing: "var(--letter-spacing-heading)", color: "var(--color-text)", margin: 0, lineHeight: 1.2, textWrap: "balance" };
const photoBox = { width: "100%", height: "auto", display: "block", borderRadius: "var(--radius-card)", background: "var(--color-surface)" };
const placeholder = { display: "grid", placeItems: "center", minHeight: 140, borderRadius: "var(--radius-card)", border: "1.5px dashed var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-muted)", fontSize: 13 };
const caption = { fontSize: 13, color: "var(--color-text-muted)", marginTop: 8, textAlign: "center" };
const btn = { display: "inline-block", padding: "11px 22px", borderRadius: "var(--radius-card)", background: "var(--color-primary)", color: "var(--color-on-primary)", fontWeight: 700, fontSize: 14.5, textDecoration: "none" };

function Prose({ markdown }) {
  const html = renderMarkdown(markdown);
  if (!html) return null;
  return <div className="ot-prose" dangerouslySetInnerHTML={{ __html: html }} />;
}

function Photo({ url, alt, preview, style }) {
  if (!url) return preview ? <div style={{ ...placeholder, ...style }}>Add a photo</div> : null;
  return <img src={url} alt={alt || ""} loading="lazy" decoding="async" style={{ ...photoBox, ...style }} />;
}

function Block({ block, contact, layout, preview }) {
  switch (block.type) {
    case "heading": {
      const Tag = block.level === 3 ? "h3" : "h2";
      if (!block.text) return null;
      return (
        <Tag style={{ ...headingFont, fontSize: block.level === 3 ? "1.2rem" : "clamp(1.45rem, 3.6vw, 1.95rem)", textAlign: block.align === "center" ? "center" : "left" }}>
          {block.text}
        </Tag>
      );
    }

    case "text":
      return <Prose markdown={block.markdown} />;

    case "image":
      if (!block.url && !preview) return null;
      return (
        <figure style={{ margin: 0 }}>
          <Photo url={block.url} alt={block.alt} preview={preview} style={{ maxHeight: 520, objectFit: "cover" }} />
          {block.caption ? <figcaption style={caption}>{block.caption}</figcaption> : null}
        </figure>
      );

    case "imageText": {
      if (!block.imageUrl && !block.markdown && !preview) return null;
      const image = (
        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
          <Photo url={block.imageUrl} alt={block.imageAlt} preview={preview} style={{ aspectRatio: "4 / 3", objectFit: "cover" }} />
        </div>
      );
      const text = (
        <div style={{ flex: "1 1 280px", minWidth: 0 }}>
          <Prose markdown={block.markdown} />
        </div>
      );
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center" }}>
          {block.imageSide === "right" ? (
            <>
              {text}
              {image}
            </>
          ) : (
            <>
              {image}
              {text}
            </>
          )}
        </div>
      );
    }

    case "gallery": {
      const images = block.images.filter((im) => im.url);
      if (!images.length) return preview ? <div style={placeholder}>Add photos to the gallery</div> : null;
      if (block.style === "carousel") {
        const Carousel = getVariant("carouselVariant", layout?.carouselVariant).Component;
        return <Carousel items={images.map((im, i) => ({ id: `g${i}`, imageUrl: im.url, title: im.caption || "", subtitle: "" }))} autoplay={!preview} />;
      }
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10 }}>
          {images.map((im, i) => (
            <figure key={`${im.url}-${i}`} style={{ margin: 0 }}>
              <Photo url={im.url} alt={im.caption} style={{ aspectRatio: "4 / 3", objectFit: "cover" }} />
              {im.caption ? <figcaption style={{ ...caption, marginTop: 5, fontSize: 12.5 }}>{im.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
      );
    }

    case "faq": {
      const items = block.items.filter((it) => it.q.trim() || it.a.trim());
      if (!items.length) return preview ? <div style={placeholder}>Add a question</div> : null;
      const Faq = getVariant("faqVariant", layout?.faqVariant).Component;
      return <Faq items={items} heading={block.heading} />;
    }

    case "contact": {
      const rows = [
        block.showAddress && contact?.address ? ["Address", contact.address] : null,
        block.showPhone && contact?.phone ? ["Phone", contact.phone, `tel:${String(contact.phone).replace(/[^+\d]/g, "")}`] : null,
        block.showEmail && contact?.email ? ["Email", contact.email, `mailto:${contact.email}`] : null,
        block.showHours && contact?.hours ? ["Hours", contact.hours] : null,
      ].filter(Boolean);
      const mapHref = block.showMap ? safeHref(contact?.mapUrl) : null;
      if (!rows.length && !mapHref) return preview ? <div style={placeholder}>Nothing to show yet — add the address, phone and hours in Settings</div> : null;
      return (
        <section className="ot-fx-card" style={fx("card", { border: "1px solid var(--color-border)", borderRadius: "var(--radius-card)", background: "var(--color-surface)", padding: "20px clamp(16px, 4vw, 26px)" })}>
          {block.heading ? <h2 style={{ ...headingFont, fontSize: "1.35rem", marginBottom: 14 }}>{block.heading}</h2> : null}
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", gap: "10px 18px", alignItems: "baseline" }}>
            {rows.map(([label, value, href]) => (
              <div key={label} style={{ display: "contents" }}>
                <dt style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>{label}</dt>
                <dd style={{ margin: 0, color: "var(--color-text)", overflowWrap: "anywhere" }}>
                  {href ? (
                    <a href={href} style={{ color: "inherit" }}>
                      {value}
                    </a>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {mapHref ? (
            <a href={mapHref} target="_blank" rel="noopener" style={{ ...btn, marginTop: rows.length ? 18 : 0 }}>
              Open in Maps
            </a>
          ) : null}
        </section>
      );
    }

    case "cta": {
      const href = safeHref(block.buttonHref);
      if (!block.heading && !block.text && !(href && block.buttonLabel)) return null;
      return (
        <section style={{ textAlign: "center", padding: "30px clamp(16px, 5vw, 36px)", borderRadius: "var(--radius-card)", background: "color-mix(in srgb, var(--color-primary) 9%, var(--color-surface))", border: "1px solid color-mix(in srgb, var(--color-primary) 18%, var(--color-border))" }}>
          {block.heading ? <h2 style={{ ...headingFont, fontSize: "clamp(1.3rem, 3.4vw, 1.75rem)" }}>{block.heading}</h2> : null}
          {block.text ? <p style={{ margin: "10px auto 0", maxWidth: "48ch", color: "var(--color-text-muted)", lineHeight: 1.55 }}>{block.text}</p> : null}
          {href && block.buttonLabel ? (
            <a href={href} style={{ ...btn, marginTop: 18 }}>
              {block.buttonLabel}
            </a>
          ) : null}
        </section>
      );
    }

    default:
      return null;
  }
}

export function PageBlocks({ blocks = [], contact, layout, preview = false }) {
  return (
    <div className="ot-page-px" style={column}>
      {blocks.map((block) => (
        <Block key={block.id} block={block} contact={contact} layout={layout} preview={preview} />
      ))}
    </div>
  );
}
