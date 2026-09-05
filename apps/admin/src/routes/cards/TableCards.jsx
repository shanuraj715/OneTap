import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CARD_BLOCK_KINDS,
  CARD_BLOCK_LABELS,
  CARD_SIZES,
  cardSizeById,
  qrCardSpecSchema,
} from "@onetap/config-schema";
import { IdCard, Plus, RotateCcw, RotateCw, Save } from "lucide-react";
import { useCardDesign, useResetCardDesign, useSaveCardDesign, useTableQrUrls } from "../../lib/useCardDesign";
import { useOutlet } from "../../lib/useOutlet";
import {
  Button,
  Card,
  Checkbox,
  ColorInput,
  Field,
  Note,
  PageHeader,
  Select,
  STICKY_HEADER_CLEARANCE,
  Tabs,
  TextInput,
  Toast,
} from "../../ui";
import { BlockRow, ImagePicker } from "./BlockRow";
import { CardPreview, CardWarnings } from "./CardPreview";
import { GradientEditor, defaultGradient } from "./GradientEditor";
import { mm, Row, Segmented, Slider } from "./controls";

/**
 * The card designer.
 *
 * One design per outlet, printed for every table — so everything here edits a
 * single shared spec, and the table shown in the preview is only a sample. The
 * real table's number and its own signed code are substituted per card at
 * export time.
 */
export function TableCards() {
  const { outlet } = useOutlet();
  const design = useCardDesign(outlet);
  const qrUrls = useTableQrUrls(outlet);
  const save = useSaveCardDesign(outlet);
  const reset = useResetCardDesign(outlet);

  const [draft, setDraft] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState("blocks");
  const [warnings, setWarnings] = useState([]);
  const [previewTableId, setPreviewTableId] = useState("");

  // Keyed on the outlet id, not on "have I loaded yet". Guarding with `!draft`
  // leaves the previous outlet's design on screen after a switch — and saving
  // then writes it over the new outlet's own card.
  useEffect(() => {
    if (design.data) {
      setDraft(design.data.spec);
      setDirty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlet?._id, design.data?.updatedAt]);

  const tables = qrUrls.data?.tables ?? [];
  const origin = qrUrls.data?.origin ?? "";

  const previewTable = tables.find((t) => t.id === previewTableId) ?? tables[0] ?? null;

  const data = useMemo(
    () => ({
      table: previewTable?.number ?? "7",
      zone: previewTable?.zone ?? "",
      seats: previewTable ? String(previewTable.seats) : "4",
      outlet: outlet?.config.identity.name || outlet?.name || "Your restaurant",
      tagline: outlet?.config.identity.tagline ?? "",
      address: outlet?.config.identity.address ?? "",
      phone: outlet?.config.identity.phone ?? "",
      url: previewTable?.url ?? "",
    }),
    [previewTable, outlet],
  );

  const update = useCallback((next) => {
    setDraft(next);
    setDirty(true);
  }, []);

  const patch = useCallback((p) => update({ ...draft, ...p }), [draft, update]);

  const onWarnings = useCallback((w) => setWarnings(w), []);

  if (!outlet) return null;
  if (design.isLoading || !draft) {
    return (
      <>
        <PageHeader title="Table cards" icon={<IdCard size={23} />} subtitle="Loading your design…" />
      </>
    );
  }

  const short = Math.min(draft.size.widthMm, draft.size.heightMm);
  const pct = (v) => mm((v / 100) * short);

  const doSave = () =>
    save.mutate(
      { spec: draft, baseUpdatedAt: design.data?.updatedAt ?? null },
      { onSuccess: () => setDirty(false) },
    );

  const localOrigin = /localhost|127\.0\.0\.1|\/\/192\.168\./.test(origin);
  const blockingErrors = warnings.filter((w) => w.level === "error").length;

  return (
    <>
      <PageHeader
        title="Table cards"
        icon={<IdCard size={23} />}
        subtitle="Design one card, print it for every table. Each printed card carries its own table's code."
        action={
          <span style={{ display: "flex", gap: 8 }}>
            <Button
              variant="outline"
              onClick={() => {
                if (design.data) {
                  setDraft(design.data.spec);
                  setDirty(false);
                }
              }}
              disabled={!dirty}
              style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
            >
              <RotateCcw size={14} /> Discard
            </Button>
            <Button onClick={doSave} disabled={!dirty || save.isPending} style={{ display: "inline-flex", gap: 7, alignItems: "center" }}>
              <Save size={15} />
              {save.isPending ? "Saving…" : dirty ? "Save design" : "Saved"}
            </Button>
          </span>
        }
      />

      {localOrigin ? (
        <Note icon={<IdCard size={15} />}>
          <strong>These codes point at {origin}</strong>, which only works on this computer. Printed cards would be
          useless. Set STOREFRONT_ORIGIN on the server before printing anything.
        </Note>
      ) : null}

      {tables.length === 0 && !qrUrls.isLoading ? (
        <Note icon={<IdCard size={15} />}>
          You have no tables yet, so the preview uses sample details. Add tables under Tables &amp; QR and each one gets
          its own printable card.
        </Note>
      ) : null}

      <div style={grid}>
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { id: "blocks", label: "Content" },
              { id: "card", label: "Card & layout" },
              { id: "background", label: "Background" },
            ]}
          />

          {tab === "blocks" ? <BlocksPanel draft={draft} update={update} short={short} /> : null}
          {tab === "card" ? <CardPanel draft={draft} patch={patch} pct={pct} /> : null}
          {tab === "background" ? <BackgroundPanel draft={draft} patch={patch} pct={pct} /> : null}

          {save.error ? <Toast kind="error">{save.error.message}</Toast> : null}
          {save.isSuccess && !dirty ? <Toast kind="ok">Saved. Every table's card uses this design.</Toast> : null}
        </div>

        <div style={{ position: "sticky", top: STICKY_HEADER_CLEARANCE, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          <Card title="Preview" subtitle={previewTable ? `Showing table ${previewTable.number}` : "Sample details"}>
            {tables.length > 1 ? (
              <Field label="Preview with">
                <Select value={previewTable?.id ?? ""} onChange={(e) => setPreviewTableId(e.target.value)}>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      Table {t.number}
                      {t.zone ? ` · ${t.zone}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <CardPreview spec={draft} data={data} onWarnings={onWarnings} />
          </Card>

          <Card
            title={blockingErrors ? `${blockingErrors} problem${blockingErrors > 1 ? "s" : ""} to fix` : "Scannability"}
            subtitle="Checked as you edit, so nothing is discovered after printing."
          >
            <CardWarnings warnings={warnings} />
          </Card>

          <Card title="Start over">
            <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.55 }}>
              Replaces this outlet's design with the default. Printed cards already on tables keep working — only the
              design changes.
            </p>
            <Button
              variant="outline"
              onClick={() => reset.mutate(undefined, { onSuccess: () => setDirty(false) })}
              disabled={reset.isPending}
              style={{ display: "inline-flex", gap: 6, alignItems: "center" }}
            >
              <RotateCcw size={14} /> {reset.isPending ? "Resetting…" : "Reset to default"}
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ blocks */

function BlocksPanel({ draft, update, short }) {
  const setBlocks = (blocks) => update({ ...draft, blocks });

  const move = (i, dir) => {
    const next = [...draft.blocks];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setBlocks(next);
  };

  const add = (kind) => {
    // Parsed through the schema so a new block arrives fully populated —
    // otherwise every control below reads undefined and React switches the
    // inputs from controlled to uncontrolled mid-edit.
    const block = qrCardSpecSchema.parse({
      blocks: [{ id: `${kind}${Date.now().toString(36)}`, kind }],
    }).blocks[0];
    if (kind === "text") block.text.content = "New line";
    setBlocks([...draft.blocks, block]);
  };

  const hasQr = draft.blocks.some((b) => b.kind === "qr");

  return (
    <Card
      title="What's on the card"
      subtitle="Blocks stack down the card in this order. Drag handles aside, use the arrows to reorder."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {draft.blocks.map((block, i) => (
          <BlockRow
            key={block.id}
            block={block}
            shortMm={short}
            cardGapPct={draft.gapPct}
            isFirst={i === 0}
            isLast={i === draft.blocks.length - 1}
            onChange={(next) => setBlocks(draft.blocks.map((b, n) => (n === i ? next : b)))}
            onRemove={() => setBlocks(draft.blocks.filter((_, n) => n !== i))}
            onMove={(dir) => move(i, dir)}
          />
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 14 }}>
        {CARD_BLOCK_KINDS.map((kind) => (
          <Button
            key={kind}
            variant="outline"
            onClick={() => add(kind)}
            disabled={kind === "qr" && hasQr}
            title={kind === "qr" && hasQr ? "A card has one code" : undefined}
            style={{ display: "inline-flex", gap: 5, alignItems: "center" }}
          >
            <Plus size={13} /> {CARD_BLOCK_LABELS[kind]}
          </Button>
        ))}
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------- card setup */

function CardPanel({ draft, patch, pct }) {
  const setSize = (p) => patch({ size: { ...draft.size, ...p } });

  const applyPreset = (id) => {
    const preset = cardSizeById(id);
    // Keep the orientation the owner is already working in — switching card
    // size should not silently rotate their design.
    const landscape = draft.size.widthMm >= draft.size.heightMm;
    const long = Math.max(preset.widthMm, preset.heightMm);
    const shortSide = Math.min(preset.widthMm, preset.heightMm);
    setSize({
      preset: preset.id,
      widthMm: landscape ? long : shortSide,
      heightMm: landscape ? shortSide : long,
    });
  };

  const rotate = () => setSize({ widthMm: draft.size.heightMm, heightMm: draft.size.widthMm });

  return (
    <>
      <Card title="Card size" subtitle="Pick the paper you'll print on, or type your own measurements.">
        <Row>
          <Field label="Size">
            <Select value={draft.size.preset} onChange={(e) => applyPreset(e.target.value)}>
              {CARD_SIZES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} — {s.widthMm}×{s.heightMm}mm
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Width" hint="millimetres">
            <TextInput
              type="number"
              value={draft.size.widthMm}
              onChange={(e) => setSize({ widthMm: Number(e.target.value) || draft.size.widthMm, preset: "custom" })}
            />
          </Field>
          <Field label="Height" hint="millimetres">
            <TextInput
              type="number"
              value={draft.size.heightMm}
              onChange={(e) => setSize({ heightMm: Number(e.target.value) || draft.size.heightMm, preset: "custom" })}
            />
          </Field>
        </Row>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
          <Button variant="outline" onClick={rotate} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <RotateCw size={14} /> Turn {draft.size.widthMm >= draft.size.heightMm ? "portrait" : "landscape"}
          </Button>
          <p style={{ margin: 0, fontSize: 12, color: "var(--color-text-muted)" }}>
            {cardSizeById(draft.size.preset)?.hint}
          </p>
        </div>
        <div style={{ marginTop: 12 }}>
          <Slider label="Corner rounding" value={draft.size.cornerRadiusPct} onChange={(v) => setSize({ cornerRadiusPct: v })} min={0} max={20} step={0.5} resolve={pct} />
        </div>
      </Card>

      <Card title="Spacing" subtitle="The margin around everything, and the gap between blocks.">
        <Row>
          <Slider label="Top margin" value={draft.padTopPct} onChange={(v) => patch({ padTopPct: v })} min={0} max={45} step={0.5} resolve={(v) => mm((v / 100) * draft.size.heightMm)} />
          <Slider label="Bottom margin" value={draft.padBottomPct} onChange={(v) => patch({ padBottomPct: v })} min={0} max={45} step={0.5} resolve={(v) => mm((v / 100) * draft.size.heightMm)} />
        </Row>
        <Row>
          <Slider label="Left margin" value={draft.padLeftPct} onChange={(v) => patch({ padLeftPct: v })} min={0} max={45} step={0.5} resolve={(v) => mm((v / 100) * draft.size.widthMm)} />
          <Slider label="Right margin" value={draft.padRightPct} onChange={(v) => patch({ padRightPct: v })} min={0} max={45} step={0.5} resolve={(v) => mm((v / 100) * draft.size.widthMm)} />
        </Row>
        <Slider label="Gap between blocks" value={draft.gapPct} onChange={(v) => patch({ gapPct: v })} min={0} max={30} step={0.25} resolve={pct} />

        <div style={{ marginTop: 12 }}>
          <Row>
            <Segmented
              label="Alignment"
              value={draft.align}
              onChange={(align) => patch({ align })}
              options={[
                { value: "left", label: "Left" },
                { value: "center", label: "Centre" },
                { value: "right", label: "Right" },
              ]}
            />
            <Segmented
              label="Vertical position"
              value={draft.justify}
              onChange={(justify) => patch({ justify })}
              info="Where the stack sits when it is shorter than the card."
              options={[
                { value: "start", label: "Top" },
                { value: "center", label: "Middle" },
                { value: "end", label: "Bottom" },
                { value: "between", label: "Spread" },
              ]}
            />
          </Row>
        </div>
      </Card>

      <Card title="Border">
        <Checkbox checked={draft.border.enabled} onChange={(enabled) => patch({ border: { ...draft.border, enabled } })} label="Draw a border" />
        {draft.border.enabled ? (
          <>
            <Row>
              <Field label="Colour">
                <ColorInput value={draft.border.color} onChange={(color) => patch({ border: { ...draft.border, color } })} />
              </Field>
              <Segmented
                label="Style"
                value={draft.border.style}
                onChange={(style) => patch({ border: { ...draft.border, style } })}
                options={[
                  { value: "solid", label: "Solid" },
                  { value: "dashed", label: "Dashed" },
                  { value: "dotted", label: "Dotted" },
                  { value: "double", label: "Double" },
                ]}
              />
            </Row>
            <Row>
              <Slider label="Thickness" value={draft.border.widthPct} onChange={(v) => patch({ border: { ...draft.border, widthPct: v } })} min={0.1} max={6} step={0.05} resolve={pct} />
              <Slider label="Distance from edge" value={draft.border.insetPct} onChange={(v) => patch({ border: { ...draft.border, insetPct: v } })} min={0} max={20} step={0.5} resolve={pct} />
              <Slider label="Roundness" value={draft.border.radiusPct} onChange={(v) => patch({ border: { ...draft.border, radiusPct: v } })} min={0} max={20} step={0.5} />
            </Row>
          </>
        ) : null}
      </Card>
    </>
  );
}

/* -------------------------------------------------------------- background */

function BackgroundPanel({ draft, patch }) {
  const bg = draft.background;
  const set = (p) => patch({ background: { ...bg, ...p } });

  return (
    <Card title="Background" subtitle="A flat colour, a gradient, or your own photograph.">
      <Segmented
        value={bg.kind}
        onChange={(kind) => set({ kind, gradient: kind !== "color" && !bg.gradient ? defaultGradient() : bg.gradient })}
        options={[
          { value: "color", label: "Colour" },
          { value: "gradient", label: "Gradient" },
          { value: "image", label: "Photograph" },
        ]}
      />

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
        {bg.kind === "color" ? (
          <Field label="Colour">
            <ColorInput value={bg.color} onChange={(color) => set({ color })} />
          </Field>
        ) : null}

        {bg.kind === "gradient" ? <GradientEditor value={bg.gradient ?? defaultGradient()} onChange={(gradient) => set({ gradient })} /> : null}

        {bg.kind === "image" ? (
          <>
            <ImagePicker
              label="Photograph"
              role="background"
              value={bg.image}
              onChange={(image) => set({ image })}
              hint="Stored with the design so it prints even if the file moves. Until you add one, the gradient below is shown."
            />
            <Row>
              <Segmented
                label="Fit"
                value={bg.imageFit}
                onChange={(imageFit) => set({ imageFit })}
                options={[
                  { value: "cover", label: "Fill the card" },
                  { value: "contain", label: "Whole picture" },
                  { value: "tile", label: "Tile" },
                ]}
              />
              <Slider label="Opacity" value={bg.imageOpacity} onChange={(v) => set({ imageOpacity: v })} min={0} max={100} />
            </Row>
            {!bg.image ? <GradientEditor value={bg.gradient ?? defaultGradient()} onChange={(gradient) => set({ gradient })} /> : null}
          </>
        ) : null}

        {bg.kind === "image" ? (
          <Row>
            <Field label="Darkening colour">
              <ColorInput value={bg.scrimColor} onChange={(scrimColor) => set({ scrimColor })} />
            </Field>
            <Slider
              label="Darkening"
              value={bg.scrimOpacity}
              onChange={(v) => set({ scrimOpacity: v })}
              min={0}
              max={100}
              info="A wash over the photo. Text over an untouched photograph becomes unreadable somewhere in every photograph."
            />
          </Row>
        ) : null}
      </div>
    </Card>
  );
}

const grid = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 420px)",
  gap: 22,
  alignItems: "start",
};
