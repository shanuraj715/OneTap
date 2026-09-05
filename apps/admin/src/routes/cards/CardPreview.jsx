import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { layoutCard, prepareCard, renderCard } from "../../lib/card/cardRenderer";

/**
 * The live card. Draws through exactly the same renderer the export uses, at a
 * different scale — which is the whole point of the layout/paint split, and the
 * only way "what you see" can actually be "what you print".
 */
export function CardPreview({ spec, data, maxWidth = 400, maxHeight = 540, onWarnings }) {
  const canvasRef = useRef(null);
  const seq = useRef(0);
  const [error, setError] = useState(null);

  // The displayed size is known from the spec alone, so it is set in the markup
  // rather than after the async render finishes. Otherwise the canvas occupies
  // its 300×150 default until fonts and images resolve, and the whole panel
  // jumps — on first load, and again on every card-size change.
  const fit = Math.min(maxWidth / spec.size.widthMm, maxHeight / spec.size.heightMm);

  useEffect(() => {
    const token = ++seq.current;
    let timer = 0;

    const run = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        // prepareCard is async — fonts and image decodes. A slow first render
        // must not be allowed to paint over a newer one that already finished,
        // so the token is checked after every await rather than only up front.
        const prepared = await prepareCard({ spec, data });
        if (token !== seq.current) return;

        const layout = layoutCard(spec, data, prepared);
        if (token !== seq.current) return;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        renderCard(canvas, { spec, layout, prepared, pxPerMm: fit * dpr });

        setError(null);
        onWarnings?.(layout.warnings);
      } catch (e) {
        if (token === seq.current) setError(e instanceof Error ? e.message : "Could not draw this card.");
      }
    };

    // Sliders fire continuously; redrawing on every tick makes them stutter.
    timer = window.setTimeout(run, 90);
    return () => window.clearTimeout(timer);
  }, [spec, data, fit, onWarnings]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={shell}>
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            borderRadius: 3,
            width: `${spec.size.widthMm * fit}px`,
            height: `${spec.size.heightMm * fit}px`,
          }}
        />
      </div>
      <p style={caption}>
        {spec.size.widthMm} × {spec.size.heightMm} mm ·{" "}
        {spec.size.widthMm >= spec.size.heightMm ? "landscape" : "portrait"}
      </p>
      {error ? <p style={{ ...caption, color: "var(--tone-danger)" }}>{error}</p> : null}
    </div>
  );
}

/** The scannability report, shown beside the card rather than only at export. */
export function CardWarnings({ warnings }) {
  if (!warnings?.length) {
    return (
      <p style={{ ...row, color: "var(--color-text-muted)" }}>
        <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
        This card should scan reliably in normal light.
      </p>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {warnings.map((w) => (
        <p
          key={w.text}
          style={{ ...row, color: w.level === "error" ? "var(--tone-danger)" : "var(--tone-warning, #A16207)" }}
        >
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          {w.text}
        </p>
      ))}
    </div>
  );
}

const shell = {
  // A neutral surround, so a white card still reads as a card and a dark one
  // does not merge into the page.
  background: "repeating-conic-gradient(#e9edf2 0% 25%, #f6f8fa 0% 50%) 50% / 16px 16px",
  padding: 16,
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.06)",
};

const caption = { margin: 0, fontSize: 12, color: "var(--color-text-muted)" };

const row = { margin: 0, fontSize: 12.5, lineHeight: 1.5, display: "flex", gap: 7, alignItems: "flex-start" };
