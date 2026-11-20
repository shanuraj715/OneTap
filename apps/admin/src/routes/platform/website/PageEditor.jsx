import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "../../../lib/nav";
import { FOOTER_GROUPS, newSection, SECTION_META, SECTION_TYPES } from "@onetap/config-schema";
import { ArrowDown, ArrowLeft, ArrowUp, ChevronDown, ChevronRight, ExternalLink, Eye, Plus, Trash2 } from "lucide-react";
import * as api from "../../../lib/api";
import { useMedia } from "../../../lib/useMedia";
import { usePlatformMutation, useSitePage, useSitePages, useSiteSettings } from "../../../lib/usePlatform";
import { Button, Card, Checkbox, Menu, PageHeader, Pill, Toast } from "../../../ui";
import { Row, smallBtn, Text } from "./fields";
import { SectionForm, sectionSummary } from "./sectionForms";
import { siteBase } from "./WebsitePages";

const newId = () => `s-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const FOOTER_LABELS = { "": "Not in the footer", product: "Product", company: "Company", legal: "Legal" };

/**
 * Edit one website page: its sections (add, reorder, collapse, remove, fill
 * in), and its settings — address, menu/footer placement, search appearance.
 * Save draft / Publish / Preview. Nothing reaches the live site until it's
 * published, and a publish refreshes the site within seconds.
 */
export function PageEditor() {
  const { id } = useParams();
  const q = useSitePage(id);
  const pages = useSitePages().data?.pages ?? [];
  const settings = useSiteSettings().data?.settings;
  const [draft, setDraft] = useState(null);
  const [open, setOpen] = useState(null);
  const wide = useMedia("(min-width: 1100px)");
  const save = usePlatformMutation((status) => api.updateSitePage(id, { ...toInput(draft), status }));

  useEffect(() => {
    if (q.data?.page) setDraft(q.data.page);
    // reload from the server only when a different page opens or after a save
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.page?.id, q.dataUpdatedAt]);

  const dirty = useMemo(() => draft && q.data?.page && JSON.stringify(toInput(draft)) !== JSON.stringify(toInput(q.data.page)), [draft, q.data]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  if (!draft) {
    return (
      <>
        <PageHeader title="Page" />
        <Card>{q.isError ? q.error.message : "Loading…"}</Card>
      </>
    );
  }

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setSeo = (patch) => set({ seo: { ...draft.seo, ...patch } });
  const setNav = (patch) => set({ nav: { ...draft.nav, ...patch } });
  const setSection = (i, s) => set({ sections: draft.sections.map((x, n) => (n === i ? s : x)) });
  const moveSection = (i, d) => {
    const j = i + d;
    if (j < 0 || j >= draft.sections.length) return;
    const next = [...draft.sections];
    [next[i], next[j]] = [next[j], next[i]];
    set({ sections: next });
  };
  const addSection = (type) => {
    const s = newSection(type, newId());
    set({ sections: [...draft.sections, s] });
    setOpen(s.id);
  };
  const removeSection = (i) => {
    const s = draft.sections[i];
    if (!window.confirm(`Remove the ${SECTION_META[s.type]?.label ?? s.type} section?`)) return;
    set({ sections: draft.sections.filter((_, n) => n !== i) });
  };

  const path = draft.slug === "home" ? "/" : `/${draft.slug}`;
  const live = `${siteBase(settings)}${path}`;
  const preview = async () => {
    // opened first, filled after: a window opened after an await is blocked as a pop-up
    const w = window.open("about:blank", "_blank");
    try {
      if (dirty) await save.mutateAsync(draft.status);
      const r = await api.sitePreviewLink(id);
      if (w) w.location.href = r.url;
    } catch (e) {
      w?.close();
      window.alert(e.message);
    }
  };

  const seoTitle = draft.seo.title || draft.title;
  const seoDesc = draft.seo.description || settings?.seo?.description || "";

  return (
    <>
      <PageHeader
        title={draft.title || "Untitled page"}
        subtitle={
          <span style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <code style={{ fontSize: 12.5 }}>{path}</code>
            <Pill tone={draft.status === "published" ? "ok" : "neutral"}>{draft.status === "published" ? "Published" : "Draft"}</Pill>
            {dirty ? <Pill tone="warn">Unsaved changes</Pill> : null}
          </span>
        }
        action={
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Link to="/platform/website" style={{ textDecoration: "none" }}>
              <Button variant="outline" style={btnIcon}>
                <ArrowLeft size={14} /> Pages
              </Button>
            </Link>
            <Button variant="outline" onClick={preview} style={btnIcon}>
              <Eye size={14} /> Preview
            </Button>
            {draft.status === "published" ? (
              <>
                <Button variant="outline" disabled={save.isPending} onClick={() => save.mutate("draft")}>
                  Unpublish
                </Button>
                <Button disabled={!dirty || save.isPending} onClick={() => save.mutate("published")}>
                  {save.isPending ? "Saving…" : "Save & publish"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" disabled={!dirty || save.isPending} onClick={() => save.mutate("draft")}>
                  Save draft
                </Button>
                <Button disabled={save.isPending} onClick={() => save.mutate("published")}>
                  {save.isPending ? "Saving…" : "Publish"}
                </Button>
              </>
            )}
          </span>
        }
      />
      {save.error ? <Toast kind="error">{save.error.message}</Toast> : null}
      {save.isSuccess && !dirty ? (
        <Toast kind="ok">
          Saved{draft.status === "published" ? " and live" : " as a draft"}.{" "}
          {draft.status === "published" ? (
            <a href={live} target="_blank" rel="noreferrer">
              View on the site
            </a>
          ) : null}
        </Toast>
      ) : null}

      <div style={{ ...layout, gridTemplateColumns: wide ? layout.gridTemplateColumns : "minmax(0, 1fr)" }}>
        {/* ----------------------------------------------------------- sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          {draft.sections.length === 0 ? (
            <Card>
              <p style={{ margin: 0, color: "var(--color-text-muted)" }}>No sections yet — add the first one below.</p>
            </Card>
          ) : null}
          {draft.sections.map((s, i) => {
            const isOpen = open === s.id;
            return (
              <section key={s.id} style={sectionCard} aria-label={`${SECTION_META[s.type]?.label} section`}>
                <div style={sectionHead}>
                  <button type="button" onClick={() => setOpen(isOpen ? null : s.id)} style={sectionToggle} aria-expanded={isOpen}>
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span style={typeBadge}>{SECTION_META[s.type]?.label ?? s.type}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--color-text-muted)", fontSize: 13 }}>
                      {sectionSummary(s)}
                    </span>
                  </button>
                  <button type="button" style={iconOnly} onClick={() => moveSection(i, -1)} disabled={i === 0} aria-label="Move section up">
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" style={iconOnly} onClick={() => moveSection(i, 1)} disabled={i === draft.sections.length - 1} aria-label="Move section down">
                    <ArrowDown size={14} />
                  </button>
                  <button type="button" style={{ ...iconOnly, color: "var(--tone-danger)" }} onClick={() => removeSection(i)} aria-label="Remove section">
                    <Trash2 size={14} />
                  </button>
                </div>
                {isOpen ? (
                  <div style={{ padding: "4px 16px 18px" }}>
                    <SectionForm section={s} onChange={(next) => setSection(i, next)} pages={pages} />
                  </div>
                ) : null}
              </section>
            );
          })}
          <Menu
            trigger={({ toggle }) => (
              <button type="button" onClick={toggle} style={addBtn}>
                <Plus size={15} /> Add a section
              </button>
            )}
            options={SECTION_TYPES.map((t) => ({ value: t, label: SECTION_META[t].label, description: SECTION_META[t].description }))}
            onSelect={addSection}
            align="left"
            width={340}
          />
        </div>

        {/* -------------------------------------------------------- page settings */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <Card title="Page">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Text label="Title" value={draft.title} onChange={(v) => set({ title: v })} max={120} />
              <Text
                label="Address"
                value={draft.slug}
                onChange={(v) => set({ slug: v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-") })}
                max={80}
                hint={draft.slug === "home" ? "The home page is always at /" : `${siteBase(settings).replace(/^https?:\/\//, "")}/${draft.slug}`}
              />
              <Checkbox checked={Boolean(draft.nav.show)} onChange={(v) => setNav({ show: v })} label="Show in the top menu" />
              {draft.nav.show ? (
                <Row>
                  <Text label="Menu label" value={draft.nav.label} onChange={(v) => setNav({ label: v })} max={30} placeholder={draft.title} />
                  <label style={smallLabel}>
                    Position
                    <input type="number" min={0} max={99} value={draft.nav.order} onChange={(e) => setNav({ order: Math.max(0, Math.min(99, Number(e.target.value) || 0)) })} style={numInput} />
                  </label>
                </Row>
              ) : null}
              <label style={smallLabel}>
                Footer
                <select value={draft.footerGroup} onChange={(e) => set({ footerGroup: e.target.value })} style={numInput}>
                  {FOOTER_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {FOOTER_LABELS[g]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Card>

          <Card title="Search & sharing" subtitle="How this page looks on Google and when its link is shared.">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={serp} aria-label="Google result preview">
                <div style={{ fontSize: 12, color: "#4d5156", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{live}</div>
                <div style={{ fontSize: 18, color: "#1a0dab", lineHeight: 1.3, margin: "2px 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {draft.slug === "home" ? seoTitle : (settings?.seo?.titleTemplate || "%s").replace("%s", seoTitle)}
                </div>
                <div style={{ fontSize: 13.5, color: "#4d5156", lineHeight: 1.45 }}>{seoDesc || <em>No description yet — Google will pick text from the page.</em>}</div>
              </div>
              <Text label="Search title" value={draft.seo.title} onChange={(v) => setSeo({ title: v })} max={70} placeholder={draft.title} hint="50–60 characters reads best. Leave empty to use the page title." />
              <Text label="Search description" value={draft.seo.description} onChange={(v) => setSeo({ description: v })} max={170} multiline rows={3} hint="Around 150 characters: what the page offers, in plain words." />
              <Text label="Share image address (optional)" value={draft.seo.ogImage} onChange={(v) => setSeo({ ogImage: v })} max={600} hint="Without one, a share image with the page title is made automatically." />
              <Checkbox checked={Boolean(draft.seo.noindex)} onChange={(v) => setSeo({ noindex: v })} label="Hide this page from Google" />
            </div>
          </Card>

          {draft.status === "published" ? (
            <a href={live} target="_blank" rel="noreferrer" style={{ ...smallBtn, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none", alignSelf: "flex-start" }}>
              <ExternalLink size={13} /> Open the live page
            </a>
          ) : null}
        </div>
      </div>
    </>
  );
}

/** Only what the API accepts. */
const toInput = (p) => ({ slug: p.slug, title: p.title, status: p.status, seo: p.seo, nav: p.nav, footerGroup: p.footerGroup, sections: p.sections });

const btnIcon = { display: "inline-flex", gap: 6, alignItems: "center" };
const layout = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 360px)", gap: 18, alignItems: "start" };
const sectionCard = { border: "1px solid var(--color-border)", borderRadius: 12, background: "var(--color-bg)" };
const sectionHead = { display: "flex", alignItems: "center", gap: 6, padding: "8px 10px 8px 6px" };
const sectionToggle = { flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", border: "none", background: "transparent", color: "var(--color-text)", font: "inherit", cursor: "pointer", textAlign: "left" };
const typeBadge = { fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "var(--color-surface)", border: "1px solid var(--color-border)", whiteSpace: "nowrap" };
const iconOnly = { ...smallBtn, padding: 6, display: "inline-flex" };
const addBtn = { ...smallBtn, display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 16px", borderStyle: "dashed", width: "100%", justifyContent: "center", fontSize: 14 };
const smallLabel = { display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600 };
const numInput = { font: "inherit", fontSize: 13.5, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)" };
const serp = { padding: "12px 14px", borderRadius: 10, background: "#fff", border: "1px solid #dadce0", fontFamily: "Arial, sans-serif" };
