import { useEffect, useMemo, useRef, useState } from "react";
import { CARD_TEMPLATES, CARD_TEMPLATE_FAMILIES } from "@onetap/config-schema";
import { Check, LayoutTemplate, X } from "lucide-react";
import { layoutCard, prepareCard, renderCard } from "../../lib/card/cardRenderer";
import { Button, Checkbox, Modal } from "../../ui";

/**
 * The starting-point library.
 *
 * Every tile is drawn by the same renderer that draws the editor preview and
 * the print export — no thumbnail images anywhere. Shipping 36 pictures would
 * mean 36 files to regenerate whenever a colour, a font or a QR shape changed,
 * and they would drift the first time somebody forgot. Drawing them live costs
 * a few hundred milliseconds once, and they can never be out of date.
 */
export function TemplateGallery({ data, currentSize, onApply, onClose }) {
  const [family, setFamily] = useState("all");
  const [orientation, setOrientation] = useState("all");
  const [keepSize, setKeepSize] = useState(false);

  const shown = useMemo(
    () =>
      CARD_TEMPLATES.filter(
        (t) => (family === "all" || t.family === family) && (orientation === "all" || t.orientation === orientation),
      ),
    [family, orientation],
  );

  const apply = (tpl) => {
    const spec = tpl.build();
    if (keepSize) spec.size = { ...currentSize };
    onApply(spec);
    onClose();
  };

  return (
    <Modal onClose={onClose} ariaLabel="Card designs" width={1080}>
      <header style={header}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <span style={headerIcon}>
            <LayoutTemplate size={18} />
          </span>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>Card designs</h3>
            <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "var(--color-text-muted)" }}>
              Pick one to start from — everything stays editable afterwards.
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} style={closeBtn} aria-label="Close">
          <X size={17} />
        </button>
      </header>

      <div style={filters}>
        <div style={chipRow}>
          <Chip label="All styles" active={family === "all"} onClick={() => setFamily("all")} />
          {CARD_TEMPLATE_FAMILIES.map((f) => (
            <Chip key={f.id} label={f.label} title={f.hint} active={family === f.id} onClick={() => setFamily(f.id)} />
          ))}
        </div>
        <div style={chipRow}>
          <Chip label="Any shape" active={orientation === "all"} onClick={() => setOrientation("all")} />
          <Chip label="Portrait" active={orientation === "portrait"} onClick={() => setOrientation("portrait")} />
          <Chip label="Landscape" active={orientation === "landscape"} onClick={() => setOrientation("landscape")} />
        </div>
        <Checkbox
          checked={keepSize}
          onChange={setKeepSize}
          label={`Keep my card size (${currentSize.widthMm}×${currentSize.heightMm}mm)`}
          info="Templates come with a size that suits them. Tick this to take only the look and keep the paper you already chose."
        />
      </div>

      <div style={body}>
        {shown.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Nothing matches those filters.</p>
        ) : (
          <div style={grid}>
            {shown.map((tpl) => (
              <TemplateTile key={tpl.id} tpl={tpl} data={data} onApply={() => apply(tpl)} />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function TemplateTile({ tpl, data, onApply }) {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const spec = tpl.build();
      const prepared = await prepareCard({ spec, data });
      if (cancelled) return;
      const layout = layoutCard(spec, data, prepared);
      const fit = Math.min(TILE / spec.size.widthMm, TILE / spec.size.heightMm);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderCard(canvas, { spec, layout, prepared, pxPerMm: fit * dpr });
      canvas.style.width = `${spec.size.widthMm * fit}px`;
      canvas.style.height = `${spec.size.heightMm * fit}px`;
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [tpl, data]);

  return (
    <button type="button" onClick={onApply} style={tile} title={tpl.hint}>
      <span style={{ ...tileArt, opacity: ready ? 1 : 0 }}>
        <canvas ref={canvasRef} style={{ display: "block", borderRadius: 2, boxShadow: "0 1px 6px rgba(0,0,0,0.18)" }} />
      </span>
      <span style={tileMeta}>
        <strong style={{ fontSize: 12.5 }}>{tpl.name}</strong>
        <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
          {tpl.widthMm}×{tpl.heightMm}mm
        </span>
      </span>
      <span style={tileUse}>
        <Check size={12} /> Use this
      </span>
    </button>
  );
}

function Chip({ label, active, onClick, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        ...chip,
        background: active ? "var(--color-primary)" : "transparent",
        color: active ? "var(--color-on-primary)" : "var(--color-text)",
        borderColor: active ? "var(--color-primary)" : "var(--color-border)",
        fontWeight: active ? 600 : 500,
      }}
    >
      {label}
    </button>
  );
}

/** Tile art box, in millimetres-equivalent — the fit is computed against this. */
const TILE = 150;

const header = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
  padding: "16px 18px",
  borderBottom: "1px solid var(--color-border)",
};
const headerIcon = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 34,
  height: 34,
  borderRadius: 9,
  background: "var(--tone-info-wash, rgba(0,0,0,0.05))",
  color: "var(--tone-info, inherit)",
  flexShrink: 0,
};
const closeBtn = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: "var(--color-text-muted)",
  padding: 4,
  borderRadius: 7,
  lineHeight: 0,
};
const filters = { display: "flex", flexDirection: "column", gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--color-border)" };
const chipRow = { display: "flex", flexWrap: "wrap", gap: 6 };
const chip = { border: "1px solid var(--color-border)", borderRadius: 999, padding: "4px 11px", fontSize: 12, cursor: "pointer" };
const body = { padding: 18, maxHeight: "62vh", overflowY: "auto" };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(178px, 1fr))", gap: 16 };
const tile = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 9,
  padding: 12,
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  background: "transparent",
  cursor: "pointer",
  color: "inherit",
  font: "inherit",
  textAlign: "center",
};
const tileArt = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  // Fixed height so a portrait and a landscape tile line up in the same grid
  // row instead of the row growing to the tallest card.
  height: TILE,
  transition: "opacity 160ms ease",
};
const tileMeta = { display: "flex", flexDirection: "column", gap: 2 };
const tileUse = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--color-primary)", fontWeight: 600 };
