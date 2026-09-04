import type { CSSProperties } from "react";
import { Photo } from "../primitives";
import type { ContentCardProps } from "./types";

const shell: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-card)",
  background: "var(--color-surface)",
  overflow: "hidden",
  maxWidth: 340,
};
const h: CSSProperties = {
  fontFamily: "var(--font-heading)",
  fontWeight: "var(--font-weight-heading)" as unknown as number,
  letterSpacing: "var(--letter-spacing-heading)",
  fontSize: "1.05rem",
  margin: "0 0 6px",
  color: "var(--color-text)",
};
const body: CSSProperties = { fontSize: "0.86rem", color: "var(--color-text-muted)", lineHeight: 1.5, margin: 0 };
const tagStyle: CSSProperties = {
  fontSize: "0.66rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--color-primary)",
  marginBottom: 6,
  display: "block",
};

/** 01 photo above the text */
export function ContentImageTop({ title, body: text, tag, imageSeed }: ContentCardProps) {
  return (
    <article className="ot-lift" style={shell}>
      <Photo name={imageSeed ?? title} style={{ aspectRatio: "16 / 9", width: "100%" }} radius={0} />
      <div style={{ padding: 16 }}>
        {tag ? <span style={tagStyle}>{tag}</span> : null}
        <h3 style={h}>{title}</h3>
        <p style={body}>{text}</p>
      </div>
    </article>
  );
}

/** 02 no photo, quiet */
export function ContentPlain({ title, body: text, tag }: ContentCardProps) {
  return (
    <article className="ot-lift" style={{ ...shell, padding: 18 }}>
      {tag ? <span style={tagStyle}>{tag}</span> : null}
      <h3 style={h}>{title}</h3>
      <p style={body}>{text}</p>
    </article>
  );
}

/** 03 photo beside the text */
export function ContentHorizontal({ title, body: text, tag, imageSeed }: ContentCardProps) {
  return (
    <article className="ot-lift" style={{ ...shell, display: "flex", maxWidth: 460 }}>
      <Photo name={imageSeed ?? title} style={{ width: 120, flexShrink: 0 }} radius={0} />
      <div style={{ padding: 16 }}>
        {tag ? <span style={tagStyle}>{tag}</span> : null}
        <h3 style={h}>{title}</h3>
        <p style={body}>{text}</p>
      </div>
    </article>
  );
}

/** 04 full-bleed photo, text over a gradient */
export function ContentOverlay({ title, body: text, tag, imageSeed }: ContentCardProps) {
  return (
    <article className="ot-lift" style={{ ...shell, position: "relative", minHeight: 210, display: "flex" }}>
      <Photo name={imageSeed ?? title} style={{ position: "absolute", inset: 0 }} radius={0} />
      <div style={{ position: "relative", marginTop: "auto", width: "100%", padding: 16, color: "#fff", background: "linear-gradient(to top, rgba(0,0,0,0.85), transparent)" }}>
        {tag ? <span style={{ ...tagStyle, color: "#fff", opacity: 0.85 }}>{tag}</span> : null}
        <h3 style={{ ...h, color: "#fff" }}>{title}</h3>
        <p style={{ ...body, color: "rgba(255,255,255,0.85)" }}>{text}</p>
      </div>
    </article>
  );
}

/** 05 top accent rule */
export function ContentTopAccent({ title, body: text, tag }: ContentCardProps) {
  return (
    <article className="ot-lift" style={{ ...shell, padding: 18, borderTop: "4px solid var(--color-primary)" }}>
      {tag ? <span style={tagStyle}>{tag}</span> : null}
      <h3 style={h}>{title}</h3>
      <p style={body}>{text}</p>
    </article>
  );
}

/** 06 hard offset shadow */
export function ContentOffset({ title, body: text, tag }: ContentCardProps) {
  return (
    <article className="ot-lift" style={{ ...shell, padding: 18, borderColor: "var(--color-text)", boxShadow: "5px 5px 0 var(--color-text)" }}>
      {tag ? <span style={tagStyle}>{tag}</span> : null}
      <h3 style={h}>{title}</h3>
      <p style={body}>{text}</p>
    </article>
  );
}

/** 07 borderless, elevated */
export function ContentElevated({ title, body: text, tag, imageSeed }: ContentCardProps) {
  return (
    <article className="ot-lift" style={{ ...shell, border: "none", background: "var(--color-bg)", boxShadow: "0 10px 30px rgba(0,0,0,0.12)" }}>
      <Photo name={imageSeed ?? title} style={{ aspectRatio: "3 / 2", width: "100%" }} radius={0} />
      <div style={{ padding: 16 }}>
        {tag ? <span style={tagStyle}>{tag}</span> : null}
        <h3 style={h}>{title}</h3>
        <p style={body}>{text}</p>
      </div>
    </article>
  );
}

/** 08 editorial — big number, hairline rule */
export function ContentEditorial({ title, body: text, tag }: ContentCardProps) {
  return (
    <article style={{ maxWidth: 340, paddingTop: 14, borderTop: "2px solid var(--color-text)" }}>
      {tag ? <span style={tagStyle}>{tag}</span> : null}
      <h3 style={{ ...h, fontSize: "1.3rem" }}>{title}</h3>
      <p style={body}>{text}</p>
    </article>
  );
}
