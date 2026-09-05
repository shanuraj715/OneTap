import { InfoHint } from "../../ui";

/**
 * Shared controls for the card designer.
 *
 * Every spatial value in a card spec is a percentage of the short edge, which
 * is what makes one design work at A7 and A4 — but "font size 5.2%" is not
 * something anyone can picture. So each slider shows the millimetres that
 * percentage currently resolves to, and the owner reasons in real units while
 * the design stays scale-independent.
 */
export function Slider({ label, value, onChange, min, max, step = 1, resolve, suffix = "%", info }) {
  return (
    <label style={wrap}>
      <span style={head}>
        <span style={labelText}>
          {label}
          {info ? <InfoHint text={info} title={label} /> : null}
        </span>
        <span style={readout}>
          {Math.round(value * 10) / 10}
          {suffix}
          {resolve ? <em style={resolved}>{resolve(value)}</em> : null}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={range}
      />
    </label>
  );
}

/** Millimetres, to one decimal — the readout under every percentage slider. */
export const mm = (v) => `${Math.round(v * 10) / 10}mm`;

/** A row of controls that wraps, so a panel is not one tall column of inputs. */
export function Row({ children, min = 150 }) {
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12 }}>{children}</div>;
}

/** A compact segmented picker — better than a select for three or four visual choices. */
export function Segmented({ label, value, onChange, options, info }) {
  return (
    <div style={wrap}>
      {label ? (
        <span style={labelText}>
          {label}
          {info ? <InfoHint text={info} title={label} /> : null}
        </span>
      ) : null}
      <div style={segWrap}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              title={o.hint ?? o.label}
              style={{
                ...segBtn,
                background: active ? "var(--color-primary)" : "transparent",
                color: active ? "var(--color-on-primary, #fff)" : "var(--color-text)",
                fontWeight: active ? 600 : 500,
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * A quiet icon control for the block rows.
 *
 * Deliberately not the shared `Button`: that has two skins, filled and
 * outlined, both in the brand's primary colour. A row of six outlined red
 * squares next to every block turns reordering and visibility — incidental
 * controls — into the loudest thing on the page, and makes "delete" look
 * identical to "move up".
 */
export function IconButton({ onClick, disabled, title, children, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        padding: 0,
        border: "1px solid transparent",
        borderRadius: 7,
        background: "transparent",
        color: disabled ? "var(--color-border)" : danger ? "var(--tone-danger)" : "var(--color-text-muted)",
        cursor: disabled ? "default" : "pointer",
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = "var(--color-border)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}

const wrap = { display: "flex", flexDirection: "column", gap: 6 };
const head = { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 };
const labelText = { fontSize: 12.5, fontWeight: 500, color: "var(--color-text)", display: "inline-flex", alignItems: "center", gap: 5 };
const readout = { fontSize: 12, color: "var(--color-text-muted)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
const resolved = { fontStyle: "normal", opacity: 0.75, marginLeft: 6 };
const range = { width: "100%", accentColor: "var(--color-primary)", margin: 0 };

const segWrap = {
  display: "flex",
  flexWrap: "wrap",
  gap: 3,
  padding: 3,
  border: "1px solid var(--color-border)",
  borderRadius: 9,
  background: "var(--color-surface, transparent)",
};
const segBtn = {
  border: "none",
  borderRadius: 6,
  padding: "5px 10px",
  fontSize: 12.5,
  cursor: "pointer",
  lineHeight: 1.3,
};
