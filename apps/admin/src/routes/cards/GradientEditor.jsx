import { Plus, Trash2 } from "lucide-react";
import { Button, ColorInput } from "../../ui";
import { IconButton, Row, Segmented, Slider } from "./controls";

const DEFAULT_STOPS = [
  { color: "#1B2A6B", at: 0 },
  { color: "#F2C14E", at: 100 },
];

export const defaultGradient = () => ({ kind: "linear", angle: 160, stops: DEFAULT_STOPS.map((s) => ({ ...s })) });

/**
 * Colour stops, an angle, and a live strip showing the result.
 *
 * The strip is CSS rather than a canvas: it costs nothing, and matching the
 * renderer here is not important — what matters is that the owner can see the
 * ramp while dragging. The card preview beside it is the authority.
 */
export function GradientEditor({ value, onChange }) {
  const g = value ?? defaultGradient();
  const set = (patch) => onChange({ ...g, ...patch });

  const setStop = (i, patch) => set({ stops: g.stops.map((s, n) => (n === i ? { ...s, ...patch } : s)) });

  const addStop = () => {
    if (g.stops.length >= 6) return;
    const sorted = [...g.stops].sort((a, b) => a.at - b.at);
    const last = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2] ?? sorted[0];
    set({ stops: [...g.stops, { color: last.color, at: Math.round((prev.at + last.at) / 2) }] });
  };

  const removeStop = (i) => {
    // Two stops is the floor — one "gradient" is just a colour, and the schema
    // rejects it rather than silently rendering something else.
    if (g.stops.length <= 2) return;
    set({ stops: g.stops.filter((_, n) => n !== i) });
  };

  const css =
    g.kind === "radial"
      ? `radial-gradient(circle at 50% 50%, ${[...g.stops].sort((a, b) => a.at - b.at).map((s) => `${s.color} ${s.at}%`).join(", ")})`
      : `linear-gradient(${g.angle}deg, ${[...g.stops].sort((a, b) => a.at - b.at).map((s) => `${s.color} ${s.at}%`).join(", ")})`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ ...strip, background: css }} />

      <Row>
        <Segmented
          label="Shape"
          value={g.kind}
          onChange={(kind) => set({ kind })}
          options={[
            { value: "linear", label: "Linear" },
            { value: "radial", label: "Radial" },
          ]}
        />
        {g.kind === "linear" ? (
          <Slider label="Angle" value={g.angle} onChange={(angle) => set({ angle })} min={0} max={360} suffix="°" />
        ) : null}
      </Row>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {g.stops.map((stop, i) => (
          <div key={i} style={stopRow}>
            <ColorInput value={stop.color} onChange={(color) => setStop(i, { color })} />
            <div style={{ flex: 1, minWidth: 120 }}>
              <Slider label="Position" value={stop.at} onChange={(at) => setStop(i, { at })} min={0} max={100} />
            </div>
            <IconButton
              onClick={() => removeStop(i)}
              disabled={g.stops.length <= 2}
              title={g.stops.length <= 2 ? "A gradient needs at least two colours" : "Remove this colour"}
              danger
            >
              <Trash2 size={14} />
            </IconButton>
          </div>
        ))}
      </div>

      <div>
        <Button variant="outline" onClick={addStop} disabled={g.stops.length >= 6} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <Plus size={14} /> Add colour
        </Button>
      </div>
    </div>
  );
}

const strip = { height: 46, borderRadius: 8, border: "1px solid var(--color-border)" };
const stopRow = { display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" };
