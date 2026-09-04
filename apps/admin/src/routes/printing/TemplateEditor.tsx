import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ALIGNS,
  BLOCK_HINTS,
  BLOCK_LABELS,
  COLOR_MODES,
  COLOR_MODE_LABELS,
  DOC_HINTS,
  DOC_LABELS,
  PAPER,
  PAPER_WIDTHS,
  PRINT_BLOCKS,
  PRINT_DOCS,
  SIZES,
  SIZE_LABELS,
  charsFor,
  defaultBlocks,
  type BlockConfig,
  type ColorMode,
  type PaperWidth,
  type PrintAlign,
  type PrintBlockKey,
  type PrintDocType,
  type PrintSize,
  type PrintTemplate,
} from "@onetap/config-schema";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  FileText,
  ImageUp,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { previewTemplate, type Outlet } from "../../lib/api";
import { fileToDataUrl, rasterizeLogo } from "../../lib/rasterize";
import { useCreateTemplate, useDeleteTemplate, useUpdateTemplate } from "../../lib/usePrinting";
import { Button, Card, Checkbox, Field, InfoHint, Note, Pill, Select, STICKY_HEADER_CLEARANCE, TextInput, Toast } from "../../ui";

export function TemplateEditor({
  outlet,
  templates,
  canManage,
}: {
  outlet: Outlet;
  templates: PrintTemplate[];
  canManage: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string>(templates[0]?.id ?? "");
  const selected = templates.find((t) => t.id === selectedId) ?? templates[0];

  const create = useCreateTemplate(outlet);
  const remove = useDeleteTemplate(outlet);

  useEffect(() => {
    if (!templates.some((t) => t.id === selectedId) && templates[0]) setSelectedId(templates[0].id);
  }, [templates, selectedId]);

  if (!selected) {
    return (
      <Card>
        <p style={{ color: "var(--color-text-muted)" }}>Loading templates…</p>
      </Card>
    );
  }

  return (
    <>
      <Note icon={<FileText size={15} />}>
        A template is the layout of one slip. Change what appears, in what order, at what size — and watch the preview
        beside it. What you see here is rendered by the same code that drives the printer, so it is what tears off.
      </Note>

      <Card
        title="Templates"
        action={
          canManage ? (
            <Button
              variant="outline"
              style={{ fontSize: 12.5, padding: "6px 12px", display: "inline-flex", gap: 6, alignItems: "center" }}
              disabled={create.isPending}
              onClick={() =>
                create.mutate(
                  { name: `${DOC_LABELS[selected.docType]} copy`, docType: selected.docType, paperWidth: selected.paperWidth },
                  { onSuccess: (r) => setSelectedId((r as { template: PrintTemplate }).template.id) },
                )
              }
            >
              <Plus size={14} /> New template
            </Button>
          ) : undefined
        }
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedId(t.id)}
              className="ot-press"
              style={{
                ...chip,
                background: t.id === selected.id ? "var(--color-primary)" : "var(--color-bg)",
                color: t.id === selected.id ? "var(--color-on-primary)" : "var(--color-text)",
                borderColor: t.id === selected.id ? "var(--color-primary)" : "var(--color-border)",
              }}
            >
              {t.name}
              {t.isDefault ? <span style={{ opacity: 0.7, fontSize: 10.5 }}>default</span> : null}
            </button>
          ))}
        </div>
        {create.error ? <Toast kind="error">{(create.error as Error).message}</Toast> : null}
        {remove.error ? <Toast kind="error">{(remove.error as Error).message}</Toast> : null}
      </Card>

      <TemplateForm
        key={selected.id}
        outlet={outlet}
        template={selected}
        canManage={canManage}
        onDelete={() =>
          window.confirm(`Delete "${selected.name}"?`) && remove.mutate(selected.id)
        }
      />
    </>
  );
}

/* ------------------------------------------------------------------- form */

function TemplateForm({
  outlet,
  template,
  canManage,
  onDelete,
}: {
  outlet: Outlet;
  template: PrintTemplate;
  canManage: boolean;
  onDelete: () => void;
}) {
  const [form, setForm] = useState<PrintTemplate>(template);
  const [dirty, setDirty] = useState(false);
  const update = useUpdateTemplate(outlet);

  const set = (patch: Partial<PrintTemplate>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  };

  const setBlock = (i: number, patch: Partial<BlockConfig>) => {
    const blocks = form.blocks.map((b, n) => (n === i ? { ...b, ...patch } : b));
    set({ blocks });
  };

  const moveBlock = (i: number, dir: -1 | 1) => {
    const to = i + dir;
    if (to < 0 || to >= form.blocks.length) return;
    const blocks = [...form.blocks];
    const [item] = blocks.splice(i, 1);
    blocks.splice(to, 0, item!);
    set({ blocks });
  };

  const cols = charsFor(form);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 340px)", gap: 18, alignItems: "start" }}>
      <div style={{ minWidth: 0 }}>
        <Card title="Paper & logo">
          <Field
            label="Template name"
            info="Only you see this. Name it after when you'd use it — 'Kitchen ticket — big type' — so the right one is easy to pick on a printer."
          >
            <TextInput value={form.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>

          <Field
            label="Document type"
            info="What kind of slip this is. It decides the defaults and, importantly, whether prices appear at all — a kitchen ticket never shows money."
            hint={DOC_HINTS[form.docType]}
          >
            <Select
              value={form.docType}
              onChange={(e) => set({ docType: e.target.value as PrintDocType })}
              disabled={form.isDefault}
            >
              {PRINT_DOCS.map((d) => (
                <option key={d} value={d}>{DOC_LABELS[d]}</option>
              ))}
            </Select>
          </Field>

          <Field
            label="Paper size"
            info="Sets the width the layout is built for. 80 mm gives 48 characters a line, 58 mm only 32 — so the same receipt wraps very differently on each."
            hint={`${PAPER[form.paperWidth].hint} Currently ${cols} characters per line.`}
          >
            <Select value={form.paperWidth} onChange={(e) => set({ paperWidth: e.target.value as PaperWidth })}>
              {PAPER_WIDTHS.map((w) => (
                <option key={w} value={w}>{PAPER[w].label}</option>
              ))}
            </Select>
          </Field>

          <Field
            label="Colour"
            info="Thermal receipt printers burn black only — a few models add red with special paper. Choose colour only for A4 or A5 documents going to an inkjet or laser printer."
            hint={
              PAPER[form.paperWidth].continuous && form.colorMode === "color"
                ? "⚠ This is a thermal roll, so it will still print black."
                : undefined
            }
          >
            <Select value={form.colorMode} onChange={(e) => set({ colorMode: e.target.value as ColorMode })}>
              {COLOR_MODES.map((c) => (
                <option key={c} value={c}>{COLOR_MODE_LABELS[c]}</option>
              ))}
            </Select>
          </Field>

          <LogoField form={form} set={set} />

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Field
              label="Characters per line"
              info="Overrides the width's default. Only change this if your printer is set to a condensed font and text comes out narrower than the paper."
              style={{ maxWidth: 170 }}
              hint={`Default is ${PAPER[form.paperWidth].chars}`}
            >
              <TextInput
                type="number"
                value={form.charsPerLine ?? ""}
                placeholder={String(PAPER[form.paperWidth].chars)}
                onChange={(e) => set({ charsPerLine: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>
            <Field
              label="Blank lines at the end"
              info="Feeds the paper on before the cut, so the slip clears the tear bar and staff aren't grabbing at the printhead."
              style={{ maxWidth: 170 }}
            >
              <TextInput type="number" min={0} max={10} value={form.feedLines} onChange={(e) => set({ feedLines: Number(e.target.value) || 0 })} />
            </Field>
          </div>
        </Card>

        <Card
          title="What appears on the slip"
          subtitle="Drag order with the arrows. Untick anything you don't want printed."
          action={
            canManage ? (
              <Button
                variant="outline"
                style={{ fontSize: 12, padding: "5px 10px", display: "inline-flex", gap: 5, alignItems: "center" }}
                onClick={() => set({ blocks: defaultBlocks(form.docType) })}
              >
                <RotateCcw size={12} /> Reset
              </Button>
            ) : undefined
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {form.blocks.map((block, i) => (
              <BlockRow
                key={`${block.key}-${i}`}
                block={block}
                index={i}
                total={form.blocks.length}
                onChange={(patch) => setBlock(i, patch)}
                onMove={(dir) => moveBlock(i, dir)}
                onRemove={() => set({ blocks: form.blocks.filter((_, n) => n !== i) })}
              />
            ))}
          </div>

          <AddBlock
            existing={form.blocks.map((b) => b.key)}
            onAdd={(key) =>
              set({
                blocks: [...form.blocks, { key, enabled: true, align: "left", size: "md", bold: false, rule: false, text: "" }],
              })
            }
          />
        </Card>

        <div style={{ display: "flex", gap: 9, alignItems: "center", flexWrap: "wrap" }}>
          <Button
            disabled={!dirty || update.isPending || !canManage}
            onClick={() => {
              const { id, isDefault, ...patch } = form;
              update.mutate({ id: template.id, patch }, { onSuccess: () => setDirty(false) });
            }}
          >
            {update.isPending ? "Saving…" : dirty ? "Save template" : "Saved"}
          </Button>
          {canManage && !form.isDefault ? (
            <Button variant="outline" onClick={onDelete} style={{ fontSize: 13, display: "inline-flex", gap: 6, alignItems: "center" }}>
              <Trash2 size={13} /> Delete
            </Button>
          ) : null}
          {form.isDefault ? <Pill>Built-in — can&apos;t be deleted</Pill> : null}
        </div>
        {update.error ? <Toast kind="error">{(update.error as Error).message}</Toast> : null}
      </div>

      <Preview outlet={outlet} template={form} />
    </div>
  );
}

/* ------------------------------------------------------------------- logo */

function LogoField({ form, set }: { form: PrintTemplate; set: (p: Partial<PrintTemplate>) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dots = PAPER[form.paperWidth].dots;

  /** Re-burn the 1-bit version whenever the logo, width or threshold changes. */
  const convert = async (url: string, threshold: number, widthPct: number) => {
    if (!url) {
      set({ logoRaster: null });
      setPreview(null);
      return;
    }
    setWorking(true);
    setError(null);
    try {
      const { raster, previewUrl } = await rasterizeLogo(url, dots, threshold, widthPct);
      set({ logoRaster: raster });
      setPreview(previewUrl);
    } catch (e) {
      setError((e as Error).message);
      setPreview(null);
    } finally {
      setWorking(false);
    }
  };

  return (
    <fieldset style={fieldset}>
      <legend style={legend}>
        Logo
        <InfoHint
          title="Logo printing"
          text="Your logo can print at the top of the slip. On an A4 or A5 document it prints as-is. On a thermal roll there are no greys — every dot is burned or not — so it is converted to pure black and white here, and the preview shows exactly what the printer will produce. Simple, high-contrast logos work; photographs turn to mud."
        />
      </legend>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <Field label="Image URL or upload" info="Paste a link to your logo, or upload a file. An uploaded file is stored inside the template itself, so it keeps working even if a website moves.">
            <TextInput
              value={form.logoUrl.startsWith("data:") ? "" : form.logoUrl}
              placeholder={form.logoUrl.startsWith("data:") ? "(uploaded file)" : "https://…/logo.png"}
              onChange={(e) => {
                set({ logoUrl: e.target.value });
                void convert(e.target.value, form.logoThreshold, form.logoWidthPct);
              }}
            />
          </Field>

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            style={{ display: "none" }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 900_000) {
                setError("That file is large. Use a logo under about 900 KB — receipts only need a small image.");
                return;
              }
              const url = await fileToDataUrl(file);
              set({ logoUrl: url });
              void convert(url, form.logoThreshold, form.logoWidthPct);
            }}
          />
          <Button
            variant="outline"
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{ fontSize: 12.5, padding: "6px 12px", display: "inline-flex", gap: 6, alignItems: "center" }}
          >
            <ImageUp size={14} /> Upload a logo
          </Button>

          {form.logoUrl ? (
            <>
              <Field
                label={`Width on the slip — ${form.logoWidthPct}%`}
                info="How much of the paper's width the logo fills. Bigger is not always better on a thermal roll: fine detail disappears as the logo grows, because the printer still only has one dot size."
                style={{ marginTop: 12 }}
              >
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={form.logoWidthPct}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    set({ logoWidthPct: v });
                    void convert(form.logoUrl, form.logoThreshold, v);
                  }}
                  style={{ accentColor: "var(--color-primary)", width: "100%" }}
                />
              </Field>

              <Field
                label={`Black & white cut-off — ${form.logoThreshold}`}
                info="Where the line falls between 'burn this dot' and 'leave it white'. Slide left to keep only the darkest parts, right to burn more. Adjust until the preview looks like your logo rather than a blob."
              >
                <input
                  type="range"
                  min={20}
                  max={230}
                  value={form.logoThreshold}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    set({ logoThreshold: v });
                    void convert(form.logoUrl, v, form.logoWidthPct);
                  }}
                  style={{ accentColor: "var(--color-primary)", width: "100%" }}
                />
              </Field>
            </>
          ) : null}
        </div>

        {form.logoUrl ? (
          <div style={{ width: 150, flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--color-text-muted)", marginBottom: 5 }}>
              What the printer burns
            </div>
            <div style={logoPreview}>
              {working ? (
                <span style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>Converting…</span>
              ) : preview ? (
                <img src={preview} alt="Logo as it will print" style={{ width: "100%", imageRendering: "pixelated" }} />
              ) : form.logoRaster ? (
                <span style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>
                  {form.logoRaster.width} × {form.logoRaster.height} dots
                </span>
              ) : (
                <span style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>Not converted yet</span>
              )}
            </div>
            {form.logoRaster ? (
              <p style={{ fontSize: 10.5, color: "var(--color-text-muted)", margin: "5px 0 0" }}>
                {form.logoRaster.width} × {form.logoRaster.height} dots of {dots} available
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {error ? <Toast kind="error">{error}</Toast> : null}
    </fieldset>
  );
}

/* ------------------------------------------------------------------ blocks */

function BlockRow({
  block,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  block: BlockConfig;
  index: number;
  total: number;
  onChange: (p: Partial<BlockConfig>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const takesText = block.key === "message" || block.key === "qr" || block.key === "docTitle";

  return (
    <div style={{ ...blockRow, opacity: block.enabled ? 1 : 0.55 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0} style={arrowBtn} aria-label="Move up">
          <ArrowUp size={12} />
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} style={arrowBtn} aria-label="Move down">
          <ArrowDown size={12} />
        </button>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, flexWrap: "wrap" }}>
          <Checkbox checked={block.enabled} onChange={(v) => onChange({ enabled: v })} label={BLOCK_LABELS[block.key]} />
          <InfoHint title={BLOCK_LABELS[block.key]} text={BLOCK_HINTS[block.key]} />
        </div>

        {block.enabled ? (
          <>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
              <Select value={block.align} onChange={(e) => onChange({ align: e.target.value as PrintAlign })} style={miniSelect} aria-label="Alignment">
                {ALIGNS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </Select>
              <Select value={block.size} onChange={(e) => onChange({ size: e.target.value as PrintSize })} style={miniSelect} aria-label="Text size">
                {SIZES.map((s) => (
                  <option key={s} value={s}>{SIZE_LABELS[s]}</option>
                ))}
              </Select>
              <Checkbox checked={block.bold} onChange={(v) => onChange({ bold: v })} label="Bold" />
              <Checkbox
                checked={block.rule}
                onChange={(v) => onChange({ rule: v })}
                label="Line under"
                info="Prints a dashed divider after this block — the usual way to separate the header from the items, and the items from the total."
              />
            </div>

            {takesText ? (
              <TextInput
                value={block.text}
                onChange={(e) => onChange({ text: e.target.value })}
                placeholder={block.key === "qr" ? "https://… the QR points here" : "Your text"}
                style={{ marginTop: 7, width: "100%", fontSize: 13 }}
              />
            ) : null}
          </>
        ) : null}
      </div>

      <button type="button" onClick={onRemove} style={arrowBtn} aria-label={`Remove ${BLOCK_LABELS[block.key]}`}>
        <Trash2 size={12} />
      </button>
    </div>
  );
}

function AddBlock({ existing, onAdd }: { existing: PrintBlockKey[]; onAdd: (k: PrintBlockKey) => void }) {
  const [key, setKey] = useState<PrintBlockKey | "">("");
  // Spacers repeat freely; everything else appears once.
  const available = PRINT_BLOCKS.filter((b) => b === "spacer" || b === "message" || !existing.includes(b));

  if (!available.length) return null;

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
      <Select value={key} onChange={(e) => setKey(e.target.value as PrintBlockKey)} style={{ fontSize: 13, maxWidth: 230 }}>
        <option value="">Add something to the slip…</option>
        {available.map((b) => (
          <option key={b} value={b}>{BLOCK_LABELS[b]}</option>
        ))}
      </Select>
      <Button
        variant="outline"
        type="button"
        disabled={!key}
        onClick={() => {
          if (key) onAdd(key);
          setKey("");
        }}
        style={{ fontSize: 12.5, padding: "6px 12px", display: "inline-flex", gap: 5, alignItems: "center" }}
      >
        <Plus size={13} /> Add
      </Button>
    </div>
  );
}

/* ---------------------------------------------------------------- preview */

function Preview({ outlet, template }: { outlet: Outlet; template: PrintTemplate }) {
  const [html, setHtml] = useState<string>("");
  const render = useMutation({
    mutationFn: () => {
      const { id, isDefault, ...body } = template;
      return previewTemplate(outlet, body);
    },
    onSuccess: (r) => setHtml(r.html),
  });

  // Debounced so dragging the threshold slider doesn't hammer the API.
  const signature = useMemo(() => JSON.stringify(template), [template]);
  useEffect(() => {
    const t = setTimeout(() => render.mutate(), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const paper = PAPER[template.paperWidth];

  return (
    <div style={{ position: "sticky", top: STICKY_HEADER_CLEARANCE }}>
      <Card title="Preview" icon={<Eye size={15} />} subtitle={`${paper.label} · ${charsFor(template)} characters wide`}>
        <div style={previewFrame}>
          {html ? (
            <iframe
              title="Print preview"
              srcDoc={html}
              style={{
                width: paper.continuous ? `${paper.printableMm}mm` : "100%",
                height: 520,
                border: 0,
                background: "#fff",
                display: "block",
                margin: "0 auto",
              }}
            />
          ) : (
            <div style={{ padding: 30, textAlign: "center", color: "var(--color-text-muted)", fontSize: 13 }}>
              {render.isPending ? "Rendering…" : "…"}
            </div>
          )}
        </div>
        <p style={{ fontSize: 11.5, color: "var(--color-text-muted)", margin: "9px 0 0" }}>
          Shown with a sample order. Real orders use the same layout.
        </p>
        {render.error ? <Toast kind="error">{(render.error as Error).message}</Toast> : null}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ styles */

const chip: CSSProperties = {
  font: "inherit",
  fontSize: 12.5,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 13px",
  borderRadius: 999,
  border: "1px solid var(--color-border)",
  cursor: "pointer",
};
const blockRow: CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  padding: "10px 12px",
  border: "1px solid var(--color-border)",
  borderRadius: 9,
  background: "var(--color-bg)",
};
const arrowBtn: CSSProperties = {
  font: "inherit",
  display: "grid",
  placeItems: "center",
  width: 22,
  height: 20,
  padding: 0,
  border: "1px solid var(--color-border)",
  borderRadius: 5,
  background: "var(--color-surface)",
  color: "var(--color-text)",
  cursor: "pointer",
};
const miniSelect: CSSProperties = { fontSize: 12, padding: "4px 7px", maxWidth: 120 };
const fieldset: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  padding: "12px 14px 14px",
  marginBottom: 14,
};
const legend: CSSProperties = { fontSize: 12.5, fontWeight: 600, padding: "0 6px", display: "inline-flex", alignItems: "center", gap: 6 };
const logoPreview: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  background: "#fff",
  padding: 8,
  minHeight: 70,
  display: "grid",
  placeItems: "center",
};
const previewFrame: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: 9,
  background: "#f3f3f3",
  padding: 12,
  overflow: "auto",
};
