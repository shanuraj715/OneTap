import { useEffect, useRef, useState } from "react";
import {
  CARD_BLOCK_HINTS,
  CARD_BLOCK_LABELS,
  CARD_FONT_GROUPS,
  CARD_ICONS,
  CARD_TOKENS,
  cardFontGroupOf,
  cardFontsInGroup,
  fontIsItalicOnly,
  isRiskyEyePairing,
} from "@onetap/config-schema";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  Minus,
  QrCode,
  Smile,
  Space,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import { clampWeight, weightsFor } from "../../lib/card/cardFonts";
import { fileToCardImage, IMAGE_ACCEPT } from "../../lib/card/imageInput";
import { Button, Checkbox, ColorInput, Field, Select, TextInput } from "../../ui";
import { GradientEditor, defaultGradient } from "./GradientEditor";
import { IconButton, mm, Row, Segmented, Slider } from "./controls";

const KIND_ICONS = {
  text: <Type size={14} />,
  qr: <QrCode size={14} />,
  image: <ImageIcon size={14} />,
  icon: <Smile size={14} />,
  divider: <Minus size={14} />,
  spacer: <Space size={14} />,
};

const ALIGNS = [
  { value: "left", label: "Left" },
  { value: "center", label: "Centre" },
  { value: "right", label: "Right" },
];

/** One block: a header that is always visible, and its controls when opened. */
export function BlockRow({ block, shortMm, cardGapPct, onChange, onRemove, onMove, isFirst, isLast }) {
  const [open, setOpen] = useState(false);
  const pct = (v) => mm((v / 100) * shortMm);
  const set = (patch) => onChange({ ...block, ...patch });
  const setGroup = (group, patch) => onChange({ ...block, [group]: { ...block[group], ...patch } });

  return (
    <div style={{ ...shell, opacity: block.enabled ? 1 : 0.55 }}>
      <div style={header}>
        <span style={{ color: "var(--color-text-muted)", display: "flex" }}>
          <GripVertical size={14} />
        </span>
        <button type="button" onClick={() => setOpen((v) => !v)} style={titleBtn}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            {KIND_ICONS[block.kind]}
            <strong style={{ fontSize: 13 }}>{CARD_BLOCK_LABELS[block.kind]}</strong>
          </span>
          <span style={summary}>{summarise(block)}</span>
        </button>

        <span style={{ display: "flex", gap: 2, alignItems: "center" }}>
          <IconButton onClick={() => onMove(-1)} disabled={isFirst} title="Move up">
            <ChevronUp size={15} />
          </IconButton>
          <IconButton onClick={() => onMove(1)} disabled={isLast} title="Move down">
            <ChevronDown size={15} />
          </IconButton>
          <IconButton onClick={() => set({ enabled: !block.enabled })} title={block.enabled ? "Hide from the card" : "Show on the card"}>
            {block.enabled ? <Eye size={15} /> : <EyeOff size={15} />}
          </IconButton>
          <IconButton onClick={onRemove} title="Remove this block" danger>
            <Trash2 size={15} />
          </IconButton>
          <IconButton onClick={() => setOpen((v) => !v)} title={open ? "Collapse" : "Edit"}>
            {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </IconButton>
        </span>
      </div>

      {open ? (
        <div style={body}>
          <Row>
            <Segmented
              label="Alignment"
              value={block.align ?? "inherit"}
              onChange={(v) => set({ align: v === "inherit" ? null : v })}
              options={[{ value: "inherit", label: "Card default" }, ...ALIGNS]}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {/* Shows the card's own gap while unset, rather than 0. A slider
                  reading "0mm" next to a block that visibly has space above it
                  is worse than no control at all. */}
              <Slider
                label="Space above"
                value={block.gapPct ?? cardGapPct}
                onChange={(v) => set({ gapPct: v })}
                min={0}
                max={20}
                step={0.5}
                resolve={pct}
                info="Only set this when one block needs to sit closer or further away than the rest."
              />
              <Checkbox
                checked={block.gapPct === null}
                onChange={(on) => set({ gapPct: on ? null : cardGapPct })}
                label="Use the card's spacing"
              />
            </div>
          </Row>

          {block.kind === "text" ? <TextControls block={block} setGroup={setGroup} pct={pct} /> : null}
          {block.kind === "qr" ? <QrControls block={block} setGroup={setGroup} pct={pct} /> : null}
          {block.kind === "image" ? <ImageControls block={block} setGroup={setGroup} /> : null}
          {block.kind === "icon" ? <IconControls block={block} setGroup={setGroup} pct={pct} /> : null}
          {block.kind === "divider" ? <DividerControls block={block} setGroup={setGroup} pct={pct} /> : null}
          {block.kind === "spacer" ? (
            <Slider label="Height" value={block.spacer.heightPct} onChange={(v) => setGroup("spacer", { heightPct: v })} min={0} max={40} step={0.5} resolve={pct} />
          ) : null}

          <p style={hint}>{CARD_BLOCK_HINTS[block.kind]}</p>
        </div>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------- text */

/**
 * Category first, then the faces in it.
 *
 * Sixty-two fonts in one dropdown is a wall nobody reads to the bottom of, and
 * the choice is never "which of these sixty-two" — it is "something like
 * handwriting", then which one. Splitting it in two also means only the group
 * you opened is even on screen.
 *
 * Nothing is previewed in its own face here on purpose: a font list that shows
 * each name in its own lettering has to download all sixty-two to do it. The
 * card beside the editor is the preview, and it redraws the moment you choose.
 */
function FontPicker({ fontId, weight, onChange, colour }) {
  const currentGroup = cardFontGroupOf(fontId);
  const [group, setGroup] = useState(currentGroup);

  // Following the selection keeps the two dropdowns honest when the font is
  // changed from elsewhere — applying a template, for instance.
  useEffect(() => setGroup(currentGroup), [currentGroup]);

  const fonts = cardFontsInGroup(group);
  const weights = weightsFor(fontId);
  const groupMeta = CARD_FONT_GROUPS.find((g) => g.id === group);

  const pickGroup = (next) => {
    setGroup(next);
    // Move to the first face in the new group straight away, so the card
    // updates on one click instead of leaving the old font showing until a
    // second choice is made.
    const first = cardFontsInGroup(next)[0];
    if (first && first.id !== fontId) {
      onChange({ fontId: first.id, weight: clampWeight(first.id, weight) });
    }
  };

  return (
    <>
      <Row>
        <Field label="Style of lettering" hint={groupMeta?.hint}>
          <Select value={group} onChange={(e) => pickGroup(e.target.value)}>
            {CARD_FONT_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Font">
          <Select
            value={fontId}
            onChange={(e) => onChange({ fontId: e.target.value, weight: clampWeight(e.target.value, weight) })}
          >
            {fonts.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </Field>
      </Row>
      <Row>
        <Field label="Weight" hint={weights.length === 1 ? "This font ships in one weight only." : undefined}>
          <Select value={String(clampWeight(fontId, weight))} onChange={(e) => onChange({ weight: Number(e.target.value) })}>
            {/* Only the weights the face actually ships. Offering the rest gets
                a smeared synthetic bold that reads as a rendering fault. */}
            {weights.map((w) => (
              <option key={w} value={w}>
                {w}
                {WEIGHT_NAMES[w] ? ` — ${WEIGHT_NAMES[w]}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Colour">{colour}</Field>
      </Row>
    </>
  );
}

const WEIGHT_NAMES = {
  100: "Thin",
  200: "Extra light",
  300: "Light",
  400: "Regular",
  500: "Medium",
  600: "Semi bold",
  700: "Bold",
  800: "Extra bold",
  900: "Black",
};

function TextControls({ block, setGroup, pct }) {
  const t = block.text;
  const set = (patch) => setGroup("text", patch);
  const italicOnly = fontIsItalicOnly(t.fontId);

  return (
    <>
      <Field label="Words" hint="Use a token below to fill in each table's own details.">
        <TextInput value={t.content} onChange={(e) => set({ content: e.target.value })} placeholder="Table {table}" />
      </Field>

      <div style={tokenRow}>
        {CARD_TOKENS.map((tok) => (
          <button
            key={tok.token}
            type="button"
            title={tok.hint}
            onClick={() => set({ content: `${t.content}${tok.token}` })}
            style={tokenChip}
          >
            {tok.token}
          </button>
        ))}
      </div>

      <FontPicker
        fontId={t.fontId}
        weight={t.weight}
        onChange={(patch) => set(patch)}
        colour={<ColorInput value={t.color} onChange={(color) => set({ color })} />}
      />

      <Row>
        <Slider label="Size" value={t.sizePct} onChange={(v) => set({ sizePct: v })} min={1} max={30} step={0.1} resolve={pct} />
        <Slider label="Line spacing" value={t.lineHeight} onChange={(v) => set({ lineHeight: v })} min={0.8} max={2.4} step={0.05} suffix="×" />
        <Slider label="Letter spacing" value={t.letterSpacing} onChange={(v) => set({ letterSpacing: v })} min={-0.05} max={0.5} step={0.01} suffix="em" />
      </Row>

      <Row>
        <Slider label="Opacity" value={t.opacity} onChange={(v) => set({ opacity: v })} min={0} max={100} />
        <Slider label="Text width" value={t.widthPct} onChange={(v) => set({ widthPct: v })} min={10} max={100} info="Narrower text wraps sooner, which is how you control where a long line breaks." />
        <Slider label="Maximum lines" value={t.maxLines} onChange={(v) => set({ maxLines: v })} min={1} max={8} suffix="" info="Anything longer is trimmed with an ellipsis rather than running off the card." />
      </Row>

      <Row>
        <Segmented
          label="Capitals"
          value={t.transform}
          onChange={(transform) => set({ transform })}
          options={[
            { value: "none", label: "As typed" },
            { value: "upper", label: "UPPER" },
            { value: "lower", label: "lower" },
          ]}
        />
        <Segmented
          label="Shadow"
          value={t.shadow}
          onChange={(shadow) => set({ shadow })}
          options={[
            { value: "none", label: "None" },
            { value: "soft", label: "Soft" },
            { value: "hard", label: "Hard" },
          ]}
          info="Lifts text off a photo background. Unnecessary on a plain colour."
        />
      </Row>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        {/* Molle only exists as an italic, so the control would be a lie. */}
        {italicOnly ? (
          <span style={hint}>This font is only made in italic.</span>
        ) : (
          <Checkbox checked={t.italic} onChange={(italic) => set({ italic })} label="Italic" />
        )}
        <Checkbox
          checked={t.chip}
          onChange={(chip) => set({ chip })}
          label="Filled pill behind the text"
          info="Turns a line into a badge — the usual treatment for the table number."
        />
      </div>

      {t.chip ? (
        <Row>
          <Field label="Pill colour">
            <ColorInput value={t.chipColor} onChange={(chipColor) => set({ chipColor })} />
          </Field>
          <Slider label="Pill roundness" value={t.chipRadiusPct} onChange={(v) => set({ chipRadiusPct: v })} min={0} max={50} />
          <Slider label="Pill padding" value={t.chipPadXPct} onChange={(v) => set({ chipPadXPct: v })} min={0} max={20} step={0.5} resolve={pct} />
        </Row>
      ) : null}
    </>
  );
}

/* ---------------------------------------------------------------------- QR */

const MODULE_STYLES = [
  { value: "square", label: "Square" },
  { value: "dot", label: "Dots" },
  { value: "rounded", label: "Rounded" },
  { value: "classy", label: "Fused" },
  { value: "diamond", label: "Diamond" },
  { value: "bar-h", label: "Row bars" },
  { value: "bar-v", label: "Column bars" },
];

const EYE_FRAMES = [
  { value: "square", label: "Square" },
  { value: "rounded", label: "Rounded" },
  { value: "circle", label: "Circle" },
  { value: "leaf", label: "Leaf" },
];

const EYE_BALLS = [
  { value: "square", label: "Square" },
  { value: "rounded", label: "Rounded" },
  { value: "circle", label: "Circle" },
];

function QrControls({ block, setGroup, pct }) {
  const q = block.qr;
  const set = (patch) => setGroup("qr", patch);
  const risky = isRiskyEyePairing(q.eyeFrame, q.eyeBall);

  return (
    <>
      <Row>
        <Slider label="Code size" value={q.sizePct} onChange={(v) => set({ sizePct: v })} min={15} max={90} step={0.5} resolve={pct} />
        <Slider
          label="Padding"
          value={q.paddingPct}
          onChange={(v) => set({ paddingPct: v })}
          min={0}
          max={25}
          step={0.5}
          info="Space between the code and the edge of its plate. A protective margin is always added on top of this, so the code stays scannable even at zero."
        />
      </Row>

      <Row>
        <Field label="Code colour">
          <ColorInput value={q.color} onChange={(color) => set({ color })} />
        </Field>
        <Field label="Behind the code">
          <ColorInput value={q.background} onChange={(background) => set({ background })} />
        </Field>
      </Row>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
        <Checkbox
          checked={q.plate}
          onChange={(plate) => set({ plate })}
          label="Light plate behind the code"
          info="What lets a code sit on a dark or photographic card at all. Leave this on unless the card is already light."
        />
        <Checkbox
          checked={Boolean(q.gradient)}
          onChange={(on) => set({ gradient: on ? defaultGradient() : null })}
          label="Colour the code with a gradient"
        />
      </div>

      {q.plate ? (
        <Row>
          <Field label="Plate colour">
            <ColorInput value={q.plateColor} onChange={(plateColor) => set({ plateColor })} />
          </Field>
          <Slider label="Plate roundness" value={q.plateRadiusPct} onChange={(v) => set({ plateRadiusPct: v })} min={0} max={50} />
        </Row>
      ) : null}

      {q.gradient ? <GradientEditor value={q.gradient} onChange={(gradient) => set({ gradient })} /> : null}

      <Segmented label="Square shape" value={q.moduleStyle} onChange={(moduleStyle) => set({ moduleStyle })} options={MODULE_STYLES} />

      <Row>
        <Segmented label="Corner shape" value={q.eyeFrame} onChange={(eyeFrame) => set({ eyeFrame })} options={EYE_FRAMES} />
        <Segmented label="Corner centre" value={q.eyeBall} onChange={(eyeBall) => set({ eyeBall })} options={EYE_BALLS} />
      </Row>

      {risky ? (
        <p style={{ ...hint, color: "var(--tone-danger)" }}>
          A {q.eyeBall} centre inside a {q.eyeFrame} corner stops phones recognising the code. Set the centre to rounded, or match it to the corner shape.
        </p>
      ) : null}

      {/* An inherited colour is shown as a checkbox rather than a swatch: a
          swatch showing the code's colour looks like an override that has been
          set, and there is no way to un-set it once touched. */}
      <Row>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Checkbox
            checked={q.eyeColor === null}
            onChange={(on) => set({ eyeColor: on ? null : q.color })}
            label="Corners match the code colour"
          />
          {q.eyeColor !== null ? (
            <Field label="Corner colour">
              <ColorInput value={q.eyeColor} onChange={(eyeColor) => set({ eyeColor })} />
            </Field>
          ) : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Checkbox
            checked={q.eyeBallColor === null}
            onChange={(on) => set({ eyeBallColor: on ? null : (q.eyeColor ?? q.color) })}
            label="Centres match the corners"
          />
          {q.eyeBallColor !== null ? (
            <Field label="Centre colour">
              <ColorInput value={q.eyeBallColor} onChange={(eyeBallColor) => set({ eyeBallColor })} />
            </Field>
          ) : null}
        </div>
      </Row>

      <ImagePicker
        label="Logo in the middle of the code"
        role="logo"
        value={q.logo}
        onChange={(logo) => set({ logo })}
        hint="Error correction is raised automatically whenever a logo is set."
      />

      {q.logo ? (
        <Row>
          <Slider label="Logo size" value={q.logoSizePct} onChange={(v) => set({ logoSizePct: v })} min={5} max={28} step={0.5} />
          <Slider label="Space around logo" value={q.logoPadPct} onChange={(v) => set({ logoPadPct: v })} min={0} max={50} />
          <Segmented
            label="Logo shape"
            value={q.logoShape}
            onChange={(logoShape) => set({ logoShape })}
            options={[
              { value: "square", label: "Square" },
              { value: "rounded", label: "Rounded" },
              { value: "circle", label: "Circle" },
            ]}
          />
        </Row>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------- image */

function ImageControls({ block, setGroup }) {
  const im = block.image;
  const set = (patch) => setGroup("image", patch);
  return (
    <>
      <ImagePicker label="Picture" role="block" value={im.src} onChange={(src) => set({ src })} />
      <Row>
        <Slider label="Width" value={im.widthPct} onChange={(v) => set({ widthPct: v })} min={5} max={100} />
        <Slider label="Roundness" value={im.radiusPct} onChange={(v) => set({ radiusPct: v })} min={0} max={50} />
        <Slider label="Opacity" value={im.opacity} onChange={(v) => set({ opacity: v })} min={0} max={100} />
      </Row>
      <Segmented
        label="Fit"
        value={im.fit}
        onChange={(fit) => set({ fit })}
        options={[
          { value: "contain", label: "Whole picture" },
          { value: "cover", label: "Fill the box" },
        ]}
      />
    </>
  );
}

/* -------------------------------------------------------------------- icons */

function IconControls({ block, setGroup, pct }) {
  const ic = block.icon;
  const set = (patch) => setGroup("icon", patch);
  const toggle = (name) =>
    set({ names: ic.names.includes(name) ? ic.names.filter((n) => n !== name) : [...ic.names, name].slice(0, 6) });

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {CARD_ICONS.map((i) => {
          const on = ic.names.includes(i.name);
          return (
            <button
              key={i.name}
              type="button"
              onClick={() => toggle(i.name)}
              style={{
                ...tokenChip,
                background: on ? "var(--color-primary)" : "transparent",
                color: on ? "var(--color-on-primary, #fff)" : "var(--color-text)",
                borderColor: on ? "var(--color-primary)" : "var(--color-border)",
              }}
            >
              {i.label}
            </button>
          );
        })}
      </div>
      <p style={hint}>Up to six, shown in the order you pick them.</p>

      <Row>
        <Slider label="Size" value={ic.sizePct} onChange={(v) => set({ sizePct: v })} min={1} max={20} step={0.2} resolve={pct} />
        <Slider label="Spacing" value={ic.gapPct} onChange={(v) => set({ gapPct: v })} min={0} max={20} step={0.2} resolve={pct} />
        <Slider label="Line weight" value={ic.strokePct} onChange={(v) => set({ strokePct: v })} min={2} max={20} step={0.5} />
      </Row>

      <Row>
        <Field label="Colour">
          <ColorInput value={ic.color} onChange={(color) => set({ color })} />
        </Field>
        <Segmented
          label="Background"
          value={ic.style}
          onChange={(style) => set({ style })}
          options={[
            { value: "plain", label: "None" },
            { value: "circle", label: "Circle" },
            { value: "square", label: "Square" },
          ]}
        />
        {ic.style !== "plain" ? (
          <Field label="Background colour">
            <ColorInput value={ic.badgeColor} onChange={(badgeColor) => set({ badgeColor })} />
          </Field>
        ) : null}
      </Row>
    </>
  );
}

/* ----------------------------------------------------------------- divider */

function DividerControls({ block, setGroup, pct }) {
  const d = block.divider;
  const set = (patch) => setGroup("divider", patch);
  return (
    <>
      <Row>
        <Slider label="Thickness" value={d.thicknessPct} onChange={(v) => set({ thicknessPct: v })} min={0.05} max={4} step={0.05} resolve={pct} />
        <Slider label="Width" value={d.widthPct} onChange={(v) => set({ widthPct: v })} min={5} max={100} />
        <Field label="Colour">
          <ColorInput value={d.color} onChange={(color) => set({ color })} />
        </Field>
      </Row>
      <Segmented
        label="Style"
        value={d.style}
        onChange={(style) => set({ style })}
        options={[
          { value: "solid", label: "Solid" },
          { value: "dashed", label: "Dashed" },
          { value: "dotted", label: "Dotted" },
          { value: "double", label: "Double" },
        ]}
      />
    </>
  );
}

/* ------------------------------------------------------------ image picker */

export function ImagePicker({ label, role, value, onChange, hint: extraHint }) {
  const inputRef = useRef(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { dataUrl } = await fileToCardImage(file, role);
      onChange(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That image could not be used.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 12.5, fontWeight: 500 }}>{label}</span>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {value ? <img src={value} alt="" style={thumb} /> : null}
        <input
          ref={inputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          onChange={(e) => pick(e.target.files?.[0])}
          style={{ display: "none" }}
        />
        <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={busy} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <Upload size={14} /> {busy ? "Preparing…" : value ? "Replace" : "Choose a file"}
        </Button>
        {value ? (
          <Button variant="outline" onClick={() => onChange("")}>
            Remove
          </Button>
        ) : null}
      </div>
      {error ? <p style={{ ...hint, color: "var(--tone-danger)" }}>{error}</p> : null}
      {extraHint && !error ? <p style={hint}>{extraHint}</p> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- helpers */

const labelOf = (options, value) => options.find((o) => o.value === value)?.label ?? value;

function summarise(block) {
  if (block.kind === "text") return block.text.content || "(empty)";
  if (block.kind === "qr") return `${Math.round(block.qr.sizePct)}% · ${labelOf(MODULE_STYLES, block.qr.moduleStyle).toLowerCase()}`;
  if (block.kind === "image") return block.image.src ? "picture set" : "no picture yet";
  if (block.kind === "icon") {
    const names = block.icon.names.map((n) => CARD_ICONS.find((i) => i.name === n)?.label ?? n);
    return names.join(" · ") || "no icons yet";
  }
  if (block.kind === "divider") return block.divider.style;
  return `${block.spacer.heightPct}% tall`;
}

const shell = { border: "1px solid var(--color-border)", borderRadius: 10, background: "var(--color-surface, transparent)" };
const header = { display: "flex", alignItems: "center", gap: 6, padding: "8px 10px" };
const titleBtn = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 2,
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  textAlign: "left",
  color: "inherit",
};
const summary = { fontSize: 11.5, color: "var(--color-text-muted)", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const iconBtn = { padding: 5 };
const body = { display: "flex", flexDirection: "column", gap: 14, padding: "4px 12px 14px", borderTop: "1px solid var(--color-border)" };
const hint = { margin: 0, fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.5 };
const tokenRow = { display: "flex", flexWrap: "wrap", gap: 5 };
const tokenChip = {
  border: "1px solid var(--color-border)",
  background: "transparent",
  borderRadius: 999,
  padding: "3px 9px",
  fontSize: 11.5,
  cursor: "pointer",
  color: "var(--color-text)",
};
const thumb = { width: 46, height: 46, objectFit: "contain", borderRadius: 8, border: "1px solid var(--color-border)", background: "#fff" };
