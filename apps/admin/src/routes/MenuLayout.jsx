import { useEffect, useMemo, useState } from "react";
import {
  emptySection,
  MENU_ITEM_SELECTIONS,
  MENU_SECTION_SORT_LABELS,
  MENU_SECTION_SORTS,
  MENU_SECTION_SOURCE_LABELS,
  MENU_SECTION_SOURCES,
  MENU_TITLE_ALIGNS,
  menuLayoutSchema,
} from "@onetap/config-schema";
import { itemCardVariants, MenuSections } from "@onetap/ui";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  ExternalLink,
  Eye,
  LayoutList,
  Plus,
  Radio,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { useMenu } from "../lib/useMenu";
import { useOutlet, usePatchConfig } from "../lib/useOutlet";
import { usePreviewSession } from "../lib/usePreviewSession";
import { Button, Card, Checkbox, Empty, Field, Note, PageHeader, Pill, Select, STICKY_HEADER_CLEARANCE, TextInput, Toast } from "../ui";

const ITEM_SELECTION_LABELS = { auto: "Automatic — every item", manual: "Hand-picked items" };
const TITLE_ALIGN_LABELS = { left: "Left", center: "Centred" };

export function MenuLayout() {
  const { outlet } = useOutlet();
  const patch = usePatchConfig();
  const menu = useMenu(outlet);
  const [layout, setLayout] = useState(null);

  useEffect(() => {
    if (outlet && !layout) setLayout(outlet.config.menuLayout);
  }, [outlet, layout]);

  const preview = usePreviewSession(outlet, layout, Boolean(outlet && layout));

  if (!outlet || !layout) {
    return (
      <>
        <PageHeader title="Menu layout" />
        <Card>Seed an outlet from the Dashboard first.</Card>
      </>
    );
  }

  const dirty = JSON.stringify(layout) !== JSON.stringify(outlet.config.menuLayout);
  const categories = menu.data?.categories ?? [];
  const items = menu.data?.items ?? [];

  const set = (patchValue) => setLayout({ ...layout, ...patchValue });
  const setSection = (i, patchValue) =>
    set({ sections: layout.sections.map((s, n) => (n === i ? { ...s, ...patchValue } : s)) });
  const moveSection = (i, dir) => {
    const to = i + dir;
    if (to < 0 || to >= layout.sections.length) return;
    const next = [...layout.sections];
    const [item] = next.splice(i, 1);
    next.splice(to, 0, item);
    set({ sections: next });
  };

  const save = () => patch.mutate({ outlet, patch: { menuLayout: layout } });

  return (
    <>
      <PageHeader
        title="Menu layout"
        icon={<LayoutList size={23} />}
        subtitle="How the storefront menu is arranged — sections, order, a card style each, and how much shows before a “View all”."
        action={
          <span style={{ display: "flex", gap: 8 }}>
            <Button variant="outline" onClick={() => setLayout(outlet.config.menuLayout)} disabled={!dirty} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <RotateCcw size={14} /> Reset
            </Button>
            <Button onClick={save} disabled={!dirty || patch.isPending} style={{ display: "inline-flex", gap: 7, alignItems: "center" }}>
              <Save size={15} />
              {patch.isPending ? "Saving…" : dirty ? "Save layout" : "Saved"}
            </Button>
          </span>
        }
      />

      <div style={{ marginBottom: 16 }}>
        <PreviewLink preview={preview} dirty={dirty} />
      </div>

      <div style={grid}>
        <div style={{ minWidth: 0 }}>
          <Card title="Mode">
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <ModeBtn
                active={layout.mode === "auto"}
                onClick={() => set({ mode: "auto" })}
                title="Automatic"
                desc="Every active category, in order, one card style throughout."
              />
              <ModeBtn
                active={layout.mode === "custom"}
                onClick={() =>
                  set({
                    mode: "custom",
                    sections:
                      layout.sections.length > 0
                        ? layout.sections
                        : categories.map((c) => ({
                            ...emptySection(layout.defaultCardVariant),
                            title: c.name,
                            source: "category",
                            categoryId: c.id,
                          })),
                  })
                }
                title="Custom sections"
                desc="Choose which sections appear, their order, a card style each, and a “View all” cut-off."
              />
            </div>

            <Field
              label="Default card style"
              info="Used in automatic mode, and as the starting style for a new custom section. See the Appearance page for what each one looks like."
            >
              <CardVariantSelect value={layout.defaultCardVariant} onChange={(v) => set({ defaultCardVariant: v })} />
            </Field>

            <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 8 }}>
              <Checkbox
                checked={layout.showFoodTypeFilter}
                onChange={(v) => set({ showFoodTypeFilter: v })}
                label="Veg / non-veg filter"
                info="Shows a small filter above the menu so a diner can hide everything that isn't their type. Only appears when the menu actually has more than one food type."
              />
              <Checkbox
                checked={layout.showCategoryNav}
                onChange={(v) => set({ showCategoryNav: v })}
                label="Category quick-jump"
                info="A row of section links that scrolls the diner straight to a part of the menu. Useful on a long menu, clutter on a short one."
              />
            </div>
          </Card>

          {layout.mode === "custom" ? (
            <>
              <Note icon={<LayoutList size={15} />}>
                Each section pulls items from <strong>one category</strong>, a <strong>hand-picked</strong> list, or{" "}
                <strong>everything else</strong> not shown above it. Turn on <strong>“Limit &amp; View all”</strong> to
                keep a long section short — the first few items show, the rest sit behind a button whose text you choose.
              </Note>

              <Card
                title={`Sections — ${layout.sections.length}`}
                action={
                  <Button
                    variant="outline"
                    style={{ fontSize: 12.5, padding: "6px 12px", display: "inline-flex", gap: 6, alignItems: "center" }}
                    onClick={() => set({ sections: [...layout.sections, emptySection(layout.defaultCardVariant)] })}
                  >
                    <Plus size={14} /> Add section
                  </Button>
                }
              >
                {!layout.sections.length ? (
                  <Empty icon={<LayoutList size={26} />} title="No sections">
                    Add one, or switch to automatic mode.
                  </Empty>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {layout.sections.map((section, i) => (
                      <SectionRow
                        key={section.id}
                        section={section}
                        index={i}
                        total={layout.sections.length}
                        categories={categories}
                        items={items}
                        onChange={(p) => setSection(i, p)}
                        onMove={(d) => moveSection(i, d)}
                        onRemove={() => set({ sections: layout.sections.filter((_, n) => n !== i) })}
                      />
                    ))}
                  </div>
                )}
              </Card>
            </>
          ) : null}

          {patch.error ? <Toast kind="error">{patch.error.message}</Toast> : null}
          {patch.isSuccess && !dirty ? <Toast kind="ok">Saved. Reload the storefront to see it.</Toast> : null}
        </div>

        {/* inline preview */}
        <div style={{ position: "sticky", top: STICKY_HEADER_CLEARANCE, minWidth: 0 }}>
          <Card title="Preview" icon={<Eye size={15} />} subtitle="The real storefront menu components, with your live menu.">
            {menu.data ? (
              <div style={previewShell}>
                <MenuSections menu={menu.data} layout={menuLayoutSchema.parse(layout)} />
              </div>
            ) : (
              <p style={{ color: "var(--color-text-muted)" }}>Loading menu…</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

/* ----------------------------------------------------------- preview link */

const PREVIEW_STATUS = {
  idle: { text: "starting…", color: "var(--color-text-muted)" },
  creating: { text: "opening session…", color: "var(--color-text-muted)" },
  connecting: { text: "connecting…", color: "var(--tone-warning)" },
  live: { text: "live — edits stream instantly", color: "var(--tone-success)" },
  offline: { text: "reconnecting…", color: "var(--tone-warning)" },
  error: { text: "couldn't start — save and reload", color: "var(--tone-danger)" },
};

function PreviewLink({ preview, dirty }) {
  const [copied, setCopied] = useState(false);
  const meta = PREVIEW_STATUS[preview.status] ?? PREVIEW_STATUS.idle;

  const copy = async () => {
    if (!preview.previewUrl) return;
    try {
      await navigator.clipboard.writeText(preview.previewUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the field below is selectable */
    }
  };

  return (
    <Card
      title="Live preview"
      icon={<Radio size={15} />}
      subtitle="Open on a second screen or your phone. It follows your edits over a WebSocket — nothing is saved."
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5 }}>
          <span style={{ width: 9, height: 9, borderRadius: 999, background: meta.color, flexShrink: 0 }} />
          {meta.text}
        </span>

        <input
          readOnly
          value={preview.previewUrl ?? "…"}
          onFocus={(e) => e.currentTarget.select()}
          style={urlField}
        />

        <Button
          variant="outline"
          onClick={copy}
          disabled={!preview.previewUrl}
          style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12.5, padding: "7px 12px" }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy link"}
        </Button>

        <a
          href={preview.previewUrl ?? "#"}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!preview.previewUrl}
          style={{ ...openLink, pointerEvents: preview.previewUrl ? "auto" : "none", opacity: preview.previewUrl ? 1 : 0.5 }}
        >
          <ExternalLink size={13} /> Open preview
        </a>
      </div>
      {dirty ? (
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "var(--color-text-muted)" }}>
          The preview shows your unsaved edits. The live storefront still shows the last saved layout until you press
          Save.
        </p>
      ) : null}
    </Card>
  );
}

/* --------------------------------------------------------------- section row */

function SectionRow({ section, index, total, categories, items, onChange, onMove, onRemove }) {
  const manual = section.source === "picks" || section.itemSelection === "manual";
  const categoryItems = useMemo(
    () => (section.categoryId ? items.filter((i) => i.categoryId === section.categoryId) : items),
    [items, section.categoryId],
  );

  const resolvedCount = useMemo(() => {
    if (manual) return section.itemIds.filter((id) => items.some((i) => i.id === id)).length;
    if (section.source === "category") return items.filter((i) => i.categoryId === section.categoryId).length;
    return items.length;
  }, [section, items, manual]);

  const capped = section.maxItems > 0 ? Math.min(resolvedCount, section.maxItems) : resolvedCount;

  return (
    <div style={{ ...sectionCard, opacity: section.visible ? 1 : 0.6 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} style={arrowBtn} aria-label="Move up">
            <ArrowUp size={12} />
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} style={arrowBtn} aria-label="Move down">
            <ArrowDown size={12} />
          </button>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
            <Checkbox checked={section.visible} onChange={(v) => onChange({ visible: v })} label="Show" />
            <Pill>{capped} item{capped === 1 ? "" : "s"}</Pill>
            {section.collapsible && capped > section.initialItems ? (
              <Pill>{section.initialItems} shown · “{section.viewAllLabel || "View all"}” for {capped - section.initialItems}</Pill>
            ) : null}
          </div>

          {/* heading */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Field label="Section title" style={fieldWide} info="The heading above this section. Leave blank to use the category name.">
              <TextInput value={section.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="e.g. Chef's picks" />
            </Field>
            <Field label="Subtitle" style={fieldWide} info="Optional line under the heading.">
              <TextInput value={section.subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} />
            </Field>
            <Field label="Heading" style={{ maxWidth: 130 }} info="Alignment of the section heading and subtitle.">
              <Select value={section.titleAlign} onChange={(e) => onChange({ titleAlign: e.target.value })}>
                {MENU_TITLE_ALIGNS.map((a) => (
                  <option key={a} value={a}>{TITLE_ALIGN_LABELS[a]}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 2 }}>
            <Checkbox checked={section.hideTitle} onChange={(v) => onChange({ hideTitle: v })} label="Hide the heading" info="For a bare strip that needs no label — the items only." />
            <Checkbox checked={section.showItemCount} onChange={(v) => onChange({ showItemCount: v })} label="Show item count" info="Prints the number of items next to the heading, e.g. “Momos (8)”." />
          </div>

          {/* contents */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
            <Field label="Items come from" style={fieldMed} info="The pool this section draws from.">
              <Select value={section.source} onChange={(e) => onChange({ source: e.target.value })}>
                {MENU_SECTION_SOURCES.map((s) => (
                  <option key={s} value={s}>{MENU_SECTION_SOURCE_LABELS[s]}</option>
                ))}
              </Select>
            </Field>

            {section.source === "category" ? (
              <Field label="Category" style={fieldMed}>
                <Select value={section.categoryId} onChange={(e) => onChange({ categoryId: e.target.value })}>
                  <option value="">Choose a category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </Field>
            ) : null}

            {section.source !== "picks" ? (
              <Field label="Selection" style={fieldMed} info="Automatic keeps the section in sync with the menu. Hand-picked shows only the items you tick, in that order.">
                <Select value={section.itemSelection} onChange={(e) => onChange({ itemSelection: e.target.value })}>
                  {MENU_ITEM_SELECTIONS.map((s) => (
                    <option key={s} value={s}>{ITEM_SELECTION_LABELS[s]}</option>
                  ))}
                </Select>
              </Field>
            ) : null}

            <Field label="Sort items" style={fieldMed} info="Order of items inside this section.">
              <Select value={section.sortBy} onChange={(e) => onChange({ sortBy: e.target.value })}>
                {MENU_SECTION_SORTS.map((s) => (
                  <option key={s} value={s}>{MENU_SECTION_SORT_LABELS[s]}</option>
                ))}
              </Select>
            </Field>
          </div>

          {manual ? (
            <Field
              label="Items in this section"
              info="Tick the items to include. They appear in the order you tick them."
              style={{ marginTop: 8 }}
            >
              <PickItems
                items={categoryItems}
                allItems={items}
                selected={section.itemIds}
                onChange={(ids) => onChange({ itemIds: ids })}
              />
            </Field>
          ) : null}

          {/* display */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
            <Field label="Card style" style={fieldMed} info="How each item in this section is drawn. Different sections can use different styles.">
              <CardVariantSelect value={section.cardVariant} onChange={(v) => onChange({ cardVariant: v })} />
            </Field>
            <Field label="Hard limit" style={{ maxWidth: 110 }} info="Never show more than this many items in the section, ever. 0 = no limit. (Separate from “View all”, which only hides the extras behind a button.)">
              <TextInput type="number" min={0} value={section.maxItems} onChange={(e) => onChange({ maxItems: Number(e.target.value) || 0 })} />
            </Field>
          </div>

          <div style={{ marginTop: 8, padding: "10px 12px", border: "1px solid var(--color-border)", borderRadius: 8 }}>
            <Checkbox
              checked={section.collapsible}
              onChange={(v) => onChange({ collapsible: v })}
              label="Limit & “View all”"
              info="Show only the first few items; the rest appear inline when the diner taps the button. Keeps a long menu from running for screens."
            />
            {section.collapsible ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                <Field label="Show first" style={{ maxWidth: 110 }} info="How many items are visible before the button.">
                  <TextInput
                    type="number"
                    min={1}
                    value={section.initialItems}
                    onChange={(e) => onChange({ initialItems: Math.max(1, Number(e.target.value) || 1) })}
                  />
                </Field>
                <Field label="Button text" style={fieldMed} info="Shown while the section is collapsed. A count of the hidden items is appended automatically.">
                  <TextInput value={section.viewAllLabel} onChange={(e) => onChange({ viewAllLabel: e.target.value })} placeholder="View all" />
                </Field>
                <Field label="Collapse text" style={fieldMed} info="Shown once the section is expanded.">
                  <TextInput value={section.showLessLabel} onChange={(e) => onChange({ showLessLabel: e.target.value })} placeholder="Show less" />
                </Field>
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: 8 }}>
            <Checkbox
              checked={section.hideUnavailable}
              onChange={(v) => onChange({ hideUnavailable: v })}
              label="Hide sold-out items in this section"
              info="On: a sold-out item just disappears from this section. Off: it shows greyed out with 'sold out'."
            />
          </div>
        </div>

        <button type="button" onClick={onRemove} style={arrowBtn} aria-label="Remove section">
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function PickItems({ items, allItems, selected, onChange }) {
  const toggle = (id) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  // Selected items from another category still count — show them even if the
  // current category filter would hide them.
  const extraSelected = allItems.filter((i) => selected.includes(i.id) && !items.some((x) => x.id === i.id));
  const rows = [...items, ...extraSelected];

  return (
    <div style={pickBox}>
      {rows.map((it) => {
        const on = selected.includes(it.id);
        const order = selected.indexOf(it.id) + 1;
        return (
          <label key={it.id} style={{ ...pickRow, background: on ? "var(--color-bg)" : "transparent" }}>
            <input type="checkbox" checked={on} onChange={() => toggle(it.id)} style={{ accentColor: "var(--color-primary)" }} />
            <span style={{ flex: 1, fontSize: 13 }}>{it.name}</span>
            {on ? <span style={pickOrder}>{order}</span> : null}
          </label>
        );
      })}
      {!rows.length ? <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", margin: 8 }}>No menu items yet.</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------- card select */

function CardVariantSelect({ value, onChange }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      {itemCardVariants.map((v) => (
        <option key={v.id} value={v.id}>
          {v.code} · {v.name}
        </option>
      ))}
    </Select>
  );
}

function ModeBtn({ active, onClick, title, desc }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...modeBtn,
        borderColor: active ? "var(--color-primary)" : "var(--color-border)",
        background: active ? "color-mix(in srgb, var(--color-primary) 8%, var(--color-bg))" : "var(--color-bg)",
      }}
    >
      <strong style={{ fontSize: 13.5, color: active ? "var(--color-primary)" : "var(--color-text)" }}>{title}</strong>
      <span style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.4 }}>{desc}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ styles */

const grid = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 420px)",
  gap: 20,
  alignItems: "start",
};
const fieldWide = { flex: "1 1 180px", maxWidth: "none" };
const fieldMed = { flex: "1 1 160px", maxWidth: "none" };
const urlField = {
  font: "inherit",
  fontSize: 12,
  flex: "1 1 240px",
  minWidth: 0,
  padding: "7px 10px",
  border: "1px solid var(--color-border)",
  borderRadius: 7,
  background: "var(--color-surface)",
  color: "var(--color-text)",
};
const openLink = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--color-primary)",
  textDecoration: "none",
  padding: "7px 12px",
  border: "1px solid var(--color-primary)",
  borderRadius: 7,
};
const previewShell = {
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  padding: 6,
  maxHeight: "74vh",
  overflowY: "auto",
  background: "var(--color-bg)",
};
const sectionCard = {
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  padding: "12px 14px",
  background: "var(--color-bg)",
};
const arrowBtn = {
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
  flexShrink: 0,
};
const modeBtn = {
  font: "inherit",
  flex: 1,
  textAlign: "left",
  display: "flex",
  flexDirection: "column",
  gap: 3,
  padding: "12px 14px",
  borderRadius: 10,
  border: "1.5px solid var(--color-border)",
  cursor: "pointer",
};
const pickBox = {
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  maxHeight: 190,
  overflowY: "auto",
  padding: 4,
};
const pickRow = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "6px 8px",
  borderRadius: 6,
  cursor: "pointer",
};
const pickOrder = {
  fontSize: 10.5,
  fontWeight: 700,
  minWidth: 18,
  textAlign: "center",
  padding: "1px 5px",
  borderRadius: 999,
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
};
