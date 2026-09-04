import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  emptySection,
  MENU_SECTION_SOURCE_LABELS,
  MENU_SECTION_SOURCES,
  menuLayoutSchema,
  resolveMenuSections,
  type MenuLayout as MenuLayoutT,
  type MenuSection,
  type MenuSectionSource,
} from "@onetap/config-schema";
import { itemCardVariants, MenuSections } from "@onetap/ui";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  LayoutList,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { useMenu } from "../lib/useMenu";
import { useOutlet, usePatchConfig } from "../lib/useOutlet";
import { Button, Card, Checkbox, Empty, Field, InfoHint, Note, PageHeader, Pill, Select, STICKY_HEADER_CLEARANCE, TextInput, Toast } from "../ui";

export function MenuLayout() {
  const { outlet } = useOutlet();
  const patch = usePatchConfig();
  const menu = useMenu(outlet);
  const [layout, setLayout] = useState<MenuLayoutT | null>(null);

  useEffect(() => {
    if (outlet && !layout) setLayout(outlet.config.menuLayout);
  }, [outlet, layout]);

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

  const set = (patchValue: Partial<MenuLayoutT>) => setLayout({ ...layout, ...patchValue });
  const setSection = (i: number, patchValue: Partial<MenuSection>) =>
    set({ sections: layout.sections.map((s, n) => (n === i ? { ...s, ...patchValue } : s)) });
  const moveSection = (i: number, dir: -1 | 1) => {
    const to = i + dir;
    if (to < 0 || to >= layout.sections.length) return;
    const next = [...layout.sections];
    const [item] = next.splice(i, 1);
    next.splice(to, 0, item!);
    set({ sections: next });
  };

  const save = () =>
    patch.mutate({ outlet, patch: { menuLayout: layout } });

  return (
    <>
      <PageHeader
        title="Menu layout"
        icon={<LayoutList size={23} />}
        subtitle="How the storefront menu is arranged — sections, order, and a card style for each."
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
                            source: "category" as MenuSectionSource,
                            categoryId: c.id,
                          })),
                  })
                }
                title="Custom sections"
                desc="Choose which sections appear, their order, and a card style each."
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
                A <strong>category</strong> section shows one category. A <strong>hand-picked</strong> section shows
                exactly the items you list, in that order — good for a &ldquo;Chef&apos;s picks&rdquo; strip. An
                <strong> everything else</strong> section sweeps up whatever no earlier section has shown, so you can
                feature a few things and still list the full menu below.
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

          {patch.error ? <Toast kind="error">{(patch.error as Error).message}</Toast> : null}
          {patch.isSuccess && !dirty ? <Toast kind="ok">Saved. Reload the storefront to see it.</Toast> : null}
        </div>

        {/* preview */}
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

/* --------------------------------------------------------------- section row */

function SectionRow({
  section,
  index,
  total,
  categories,
  items,
  onChange,
  onMove,
  onRemove,
}: {
  section: MenuSection;
  index: number;
  total: number;
  categories: { id: string; name: string }[];
  items: { id: string; name: string; categoryId: string }[];
  onChange: (p: Partial<MenuSection>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const resolvedCount = useMemo(() => {
    if (section.source === "category") return items.filter((i) => i.categoryId === section.categoryId).length;
    if (section.source === "picks") return section.itemIds.length;
    return items.length;
  }, [section, items]);

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
            <Pill>{resolvedCount} item{resolvedCount === 1 ? "" : "s"}</Pill>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Field label="Section title" style={{ flex: "1 1 180px", maxWidth: "none" }} info="The heading above this section. Leave blank to use the category name.">
              <TextInput value={section.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="e.g. Chef's picks" />
            </Field>
            <Field label="Subtitle" style={{ flex: "1 1 180px", maxWidth: "none" }} info="Optional line under the heading.">
              <TextInput value={section.subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} />
            </Field>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Field label="Contents" style={{ flex: "1 1 160px", maxWidth: "none" }} info="Where this section's items come from.">
              <Select value={section.source} onChange={(e) => onChange({ source: e.target.value as MenuSectionSource })}>
                {MENU_SECTION_SOURCES.map((s) => (
                  <option key={s} value={s}>{MENU_SECTION_SOURCE_LABELS[s]}</option>
                ))}
              </Select>
            </Field>

            {section.source === "category" ? (
              <Field label="Category" style={{ flex: "1 1 160px", maxWidth: "none" }}>
                <Select value={section.categoryId} onChange={(e) => onChange({ categoryId: e.target.value })}>
                  <option value="">Choose a category…</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </Field>
            ) : null}

            <Field label="Card style" style={{ flex: "1 1 160px", maxWidth: "none" }} info="How each item in this section is drawn. Different sections can use different styles.">
              <CardVariantSelect value={section.cardVariant} onChange={(v) => onChange({ cardVariant: v })} />
            </Field>

            <Field label="Max items" style={{ maxWidth: 110 }} info="Cap the number shown. 0 = show all. Useful to keep a 'picks' strip short.">
              <TextInput type="number" min={0} value={section.maxItems} onChange={(e) => onChange({ maxItems: Number(e.target.value) || 0 })} />
            </Field>
          </div>

          {section.source === "picks" ? (
            <Field label="Items in this section" info="Tick the items to feature. They appear in the order you tick them.">
              <PickItems
                items={items}
                selected={section.itemIds}
                onChange={(ids) => onChange({ itemIds: ids })}
              />
            </Field>
          ) : null}

          <div style={{ marginTop: 4 }}>
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

function PickItems({
  items,
  selected,
  onChange,
}: {
  items: { id: string; name: string; categoryId: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div style={pickBox}>
      {items.map((it) => {
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
      {!items.length ? <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", margin: 8 }}>No menu items yet.</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------- card select */

function CardVariantSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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

function ModeBtn({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) {
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

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 420px)",
  gap: 20,
  alignItems: "start",
};
const previewShell: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  padding: 6,
  maxHeight: "74vh",
  overflowY: "auto",
  background: "var(--color-bg)",
};
const sectionCard: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  padding: "12px 14px",
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
  flexShrink: 0,
};
const modeBtn: CSSProperties = {
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
const pickBox: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  maxHeight: 190,
  overflowY: "auto",
  padding: 4,
};
const pickRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "6px 8px",
  borderRadius: 6,
  cursor: "pointer",
};
const pickOrder: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  minWidth: 18,
  textAlign: "center",
  padding: "1px 5px",
  borderRadius: 999,
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
};
