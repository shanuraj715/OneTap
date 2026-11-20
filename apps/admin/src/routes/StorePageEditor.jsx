import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "../lib/nav";
import { contactDetails, emptyPageBlock, MAX_PAGE_BLOCKS, PAGE_BLOCK_META, PAGE_BLOCK_TYPES, slugFromTitle } from "@onetap/config-schema";
import { PageBlocks } from "@onetap/ui";
import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, ImagePlus, Loader, Plus, Save, Trash2 } from "lucide-react";
import * as api from "../lib/api";
import { useOutlet } from "../lib/useOutlet";
import { usePageAction, useStorePage } from "../lib/usePages";
import { storefrontHref } from "../lib/storefront";
import { StorePreviewFrame } from "../lib/storePreview";
import { useImageUpload } from "../lib/useStorage";
import { Button, Card, Checkbox, Field, Menu, PageHeader, Pill, Select, TextInput, Toast } from "../ui";
import { ImageField } from "../components/ImageField";

/**
 * One storefront page: its settings, its blocks (each with a small form), and a live preview drawn by the same
 * code the storefront uses — so what you see is what visitors get once it is published.
 */
export function StorePageEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { outlet } = useOutlet();
  const q = useStorePage(outlet, id);
  const save = usePageAction(outlet, (body) => api.updateStorePage(outlet, id, body));
  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState(null);
  // a slug follows the title until the owner edits it by hand
  const [slugTouched, setSlugTouched] = useState(true);

  useEffect(() => {
    const page = q.data?.page;
    if (page && page.id === id && (!draft || saved?.id !== page.id)) {
      const base = pickEditable(page);
      setDraft(base);
      setSaved(base);
      setSlugTouched(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data?.page?.id, id]);

  const contact = useMemo(() => contactDetails(outlet?.config), [outlet]);

  const back = (
    <Link to="/pages" style={{ textDecoration: "none" }}>
      <Button variant="outline" style={withIcon}>
        <ArrowLeft size={14} /> All pages
      </Button>
    </Link>
  );

  if (!outlet || !draft) {
    return (
      <>
        <PageHeader title="Page" icon={null} action={back} />
        <Card>{q.isError ? q.error.message : "Loading…"}</Card>
      </>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setBlock = (i, patch) => set({ blocks: draft.blocks.map((b, k) => (k === i ? { ...b, ...patch } : b)) });
  const moveBlock = (i, by) => {
    const blocks = [...draft.blocks];
    const [b] = blocks.splice(i, 1);
    blocks.splice(i + by, 0, b);
    set({ blocks });
  };
  const addBlock = (type) => set({ blocks: [...draft.blocks, emptyPageBlock(type)] });

  const onSave = () =>
    save.mutate(draft, {
      onSuccess: (r) => {
        const fresh = pickEditable(r.page);
        setDraft(fresh);
        setSaved(fresh);
        setSlugTouched(true);
      },
    });

  const address = `/${outlet.slug}/${draft.slug || "…"}`;

  return (
    <>
      <PageHeader
        title={draft.title || "Untitled page"}
        icon={null}
        subtitle={address}
        action={
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {dirty ? (
              <Button variant="outline" onClick={() => window.confirm("Leave without saving your changes?") && navigate("/pages")} style={withIcon}>
                <ArrowLeft size={14} /> All pages
              </Button>
            ) : (
              back
            )}
            {saved?.status === "published" && !dirty ? (
              <a href={storefrontHref(outlet, saved.slug)} target="_blank" rel="noopener" style={{ textDecoration: "none" }}>
                <Button variant="outline" style={withIcon}>
                  <ExternalLink size={14} /> View on the storefront
                </Button>
              </a>
            ) : null}
            <Button onClick={onSave} disabled={!dirty || save.isPending || !draft.title.trim() || !draft.slug} style={withIcon}>
              <Save size={14} /> {save.isPending ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </Button>
          </span>
        }
      />
      {save.error ? <Toast kind="error">{save.error.message}</Toast> : null}

      <div style={layout}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <Card title="The page">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <Field label="Title" style={tight} hint={`${draft.title.length}/80`}>
                <TextInput
                  value={draft.title}
                  maxLength={80}
                  onChange={(e) => set({ title: e.target.value, ...(slugTouched ? null : { slug: slugFromTitle(e.target.value) }) })}
                />
              </Field>
              <Field label="Address" style={tight} hint={`On the storefront: ${address}`}>
                <TextInput
                  value={draft.slug}
                  maxLength={60}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set({ slug: slugFromTitle(e.target.value) });
                  }}
                />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginTop: 14 }}>
              <Field label="Status" style={tight} hint={draft.status === "published" ? "Visitors can open it." : "Only you can see it."}>
                <Select value={draft.status} onChange={(e) => set({ status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </Select>
              </Field>
              <Field label="Short description" style={tight} hint="For search results and link previews">
                <TextInput value={draft.description} maxLength={200} onChange={(e) => set({ description: e.target.value })} />
              </Field>
            </div>
            <div style={{ display: "flex", gap: "10px 28px", flexWrap: "wrap", marginTop: 14 }}>
              <Checkbox checked={draft.showInHeader} onChange={(v) => set({ showInHeader: v })} label="Link it in the header menu" />
              <Checkbox checked={draft.showInFooter} onChange={(v) => set({ showInFooter: v })} label="Link it in the footer" />
            </div>
            {draft.status === "published" && saved?.status !== "published" ? <p style={hint}>It goes live when you press Save.</p> : null}
          </Card>

          <Card title="What's on the page" subtitle="Blocks, top to bottom. Add, reorder and fill them in.">
            {draft.blocks.length === 0 ? <p style={{ ...hint, margin: "0 0 12px" }}>Nothing here yet — add a first block below.</p> : null}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {draft.blocks.map((block, i) => (
                <div key={block.id} style={blockBox}>
                  <div style={blockHead}>
                    <Pill>{PAGE_BLOCK_META[block.type]?.label ?? block.type}</Pill>
                    <span style={{ flex: 1 }} />
                    <MiniButton label={`Move block ${i + 1} up`} disabled={i === 0} onClick={() => moveBlock(i, -1)}>
                      <ArrowUp size={13} />
                    </MiniButton>
                    <MiniButton label={`Move block ${i + 1} down`} disabled={i === draft.blocks.length - 1} onClick={() => moveBlock(i, 1)}>
                      <ArrowDown size={13} />
                    </MiniButton>
                    <MiniButton label={`Remove block ${i + 1}`} onClick={() => set({ blocks: draft.blocks.filter((_, k) => k !== i) })}>
                      <Trash2 size={13} />
                    </MiniButton>
                  </div>
                  <BlockForm block={block} outlet={outlet} onChange={(patch) => setBlock(i, patch)} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <Menu
                align="left"
                width={330}
                header="Add a block"
                options={PAGE_BLOCK_TYPES.map((t) => ({ value: t, label: PAGE_BLOCK_META[t].label, description: PAGE_BLOCK_META[t].description }))}
                onSelect={addBlock}
                trigger={({ toggle, open }) => (
                  <Button variant="outline" onClick={toggle} aria-haspopup="menu" aria-expanded={open} disabled={draft.blocks.length >= MAX_PAGE_BLOCKS} style={withIcon}>
                    <Plus size={14} /> Add a block
                  </Button>
                )}
              />
            </div>
          </Card>
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={previewColumn}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--color-text-muted)", margin: "0 0 8px", letterSpacing: "0.04em", textTransform: "uppercase" }}>Preview</div>
            <StorePreviewFrame config={outlet.config} flush maxHeight={780}>
              <h1
                style={{
                  margin: 0,
                  padding: "26px 18px 6px",
                  maxWidth: 820,
                  marginInline: "auto",
                  fontFamily: "var(--font-heading)",
                  fontSize: "clamp(1.7rem, 4vw, 2.3rem)",
                  lineHeight: 1.15,
                  color: "var(--color-text)",
                }}
              >
                {draft.title || "Untitled page"}
              </h1>
              <PageBlocks blocks={draft.blocks} contact={contact} layout={outlet.config.layout} preview />
            </StorePreviewFrame>
          </div>
        </div>
      </div>
    </>
  );
}

/** The part of a page the editor changes (and sends back). */
const pickEditable = (page) => ({
  title: page.title,
  slug: page.slug,
  status: page.status,
  description: page.description ?? "",
  showInHeader: Boolean(page.showInHeader),
  showInFooter: Boolean(page.showInFooter),
  blocks: structuredClone(page.blocks ?? []),
});

/* -------------------------------------------------------------- block forms */

function BlockForm({ block, outlet, onChange }) {
  switch (block.type) {
    case "heading":
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <Field label="Heading" style={{ ...tight, gridColumn: "1 / -1" }}>
            <TextInput value={block.text} maxLength={120} onChange={(e) => onChange({ text: e.target.value })} />
          </Field>
          <Field label="Size" style={tight}>
            <Select value={block.level} onChange={(e) => onChange({ level: Number(e.target.value) })}>
              <option value={2}>Large</option>
              <option value={3}>Medium</option>
            </Select>
          </Field>
          <Field label="Alignment" style={tight}>
            <Select value={block.align} onChange={(e) => onChange({ align: e.target.value })}>
              <option value="left">Left</option>
              <option value="center">Centred</option>
            </Select>
          </Field>
        </div>
      );

    case "text":
      return <MarkdownField label="Text" value={block.markdown} max={8000} rows={7} onChange={(markdown) => onChange({ markdown })} />;

    case "image":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <ImageField outlet={outlet} kind="pages" label="Photo" value={block.url} onChange={(url) => onChange({ url })} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <Field label="Describe the photo" style={tight} hint="For people using a screen reader">
              <TextInput value={block.alt} maxLength={160} onChange={(e) => onChange({ alt: e.target.value })} />
            </Field>
            <Field label="Caption (optional)" style={tight}>
              <TextInput value={block.caption} maxLength={200} onChange={(e) => onChange({ caption: e.target.value })} />
            </Field>
          </div>
        </div>
      );

    case "imageText":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <ImageField outlet={outlet} kind="pages" label="Photo" value={block.imageUrl} onChange={(imageUrl) => onChange({ imageUrl })} />
          <MarkdownField label="Words beside the photo" value={block.markdown} max={4000} rows={5} onChange={(markdown) => onChange({ markdown })} />
          <Field label="Photo on the" style={{ ...tight, maxWidth: 200 }}>
            <Select value={block.imageSide} onChange={(e) => onChange({ imageSide: e.target.value })}>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </Select>
          </Field>
        </div>
      );

    case "gallery":
      return <GalleryForm block={block} outlet={outlet} onChange={onChange} />;

    case "faq":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="Heading above the questions" style={tight} hint="Leave empty for none">
            <TextInput value={block.heading} maxLength={80} onChange={(e) => onChange({ heading: e.target.value })} />
          </Field>
          {block.items.map((item, i) => (
            <div key={i} style={{ ...blockBox, background: "var(--color-bg)" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                  <TextInput aria-label={`Question ${i + 1}`} placeholder="Question" value={item.q} maxLength={200} onChange={(e) => onChange({ items: block.items.map((x, k) => (k === i ? { ...x, q: e.target.value } : x)) })} />
                  <textarea
                    aria-label={`Answer ${i + 1}`}
                    placeholder="Answer"
                    value={item.a}
                    maxLength={2000}
                    rows={3}
                    onChange={(e) => onChange({ items: block.items.map((x, k) => (k === i ? { ...x, a: e.target.value } : x)) })}
                    style={textarea}
                  />
                </div>
                <MiniButton label={`Remove question ${i + 1}`} onClick={() => onChange({ items: block.items.filter((_, k) => k !== i) })}>
                  <Trash2 size={13} />
                </MiniButton>
              </div>
            </div>
          ))}
          <div>
            <Button variant="outline" disabled={block.items.length >= 20} onClick={() => onChange({ items: [...block.items, { q: "", a: "" }] })} style={withIcon}>
              <Plus size={13} /> Add a question
            </Button>
          </div>
        </div>
      );

    case "contact":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Field label="Heading" style={tight}>
            <TextInput value={block.heading} maxLength={80} onChange={(e) => onChange({ heading: e.target.value })} />
          </Field>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 22px" }}>
            <Checkbox checked={block.showAddress} onChange={(v) => onChange({ showAddress: v })} label="Address" />
            <Checkbox checked={block.showPhone} onChange={(v) => onChange({ showPhone: v })} label="Phone" />
            <Checkbox checked={block.showEmail} onChange={(v) => onChange({ showEmail: v })} label="Email" />
            <Checkbox checked={block.showHours} onChange={(v) => onChange({ showHours: v })} label="Opening hours" />
            <Checkbox checked={block.showMap} onChange={(v) => onChange({ showMap: v })} label="“Open in Maps” button" />
          </div>
          <p style={hint}>
            These come from this outlet&apos;s own settings (Settings → Business and Opening hours), so each outlet shows its own details. Change them there.
          </p>
        </div>
      );

    case "cta":
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <Field label="Heading" style={tight}>
            <TextInput value={block.heading} maxLength={100} onChange={(e) => onChange({ heading: e.target.value })} />
          </Field>
          <Field label="Line under it" style={tight}>
            <TextInput value={block.text} maxLength={300} onChange={(e) => onChange({ text: e.target.value })} />
          </Field>
          <Field label="Button text" style={tight}>
            <TextInput value={block.buttonLabel} maxLength={30} onChange={(e) => onChange({ buttonLabel: e.target.value })} />
          </Field>
          <Field label="Button link" style={tight} hint="https://…, a page like /about, or #menu">
            <TextInput value={block.buttonHref} maxLength={300} onChange={(e) => onChange({ buttonHref: e.target.value })} />
          </Field>
        </div>
      );

    default:
      return null;
  }
}

function MarkdownField({ label, value, max, rows, onChange }) {
  return (
    <Field label={label} style={tight} hint={`${value.length}/${max} · **bold**, *italic*, lists with “- ”, headings with “# ”, [links](https://…)`}>
      <textarea value={value} maxLength={max} rows={rows} onChange={(e) => onChange(e.target.value)} style={textarea} />
    </Field>
  );
}

function GalleryForm({ block, outlet, onChange }) {
  const input = useRef(null);
  const { upload, busy, error, clearError } = useImageUpload(outlet, { kind: "pages" });
  const room = 12 - block.images.length;

  const add = async (files) => {
    try {
      const stored = await upload(Array.from(files).slice(0, room));
      if (stored.length) onChange({ images: [...block.images, ...stored.map((s) => ({ url: s.url, caption: "" }))] });
    } catch {
      /* shown below */
    }
    if (input.current) input.current.value = "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Field label="Show them as" style={{ ...tight, maxWidth: 260 }}>
        <Select value={block.style} onChange={(e) => onChange({ style: e.target.value })}>
          <option value="grid">A grid of photos</option>
          <option value="carousel">A carousel (your carousel style)</option>
        </Select>
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
        {block.images.map((im, i) => (
          <div key={`${im.url}-${i}`} style={{ ...blockBox, padding: 8, background: "var(--color-bg)" }}>
            <img src={im.url} alt="" style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 8, display: "block" }} />
            <TextInput aria-label={`Caption for photo ${i + 1}`} placeholder="Caption" value={im.caption} maxLength={160} style={{ marginTop: 6 }} onChange={(e) => onChange({ images: block.images.map((x, k) => (k === i ? { ...x, caption: e.target.value } : x)) })} />
            <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
              <MiniButton label={`Move photo ${i + 1} earlier`} disabled={i === 0} onClick={() => onChange({ images: swapAt(block.images, i, i - 1) })}>
                <ArrowUp size={12} style={{ transform: "rotate(-90deg)" }} />
              </MiniButton>
              <MiniButton label={`Move photo ${i + 1} later`} disabled={i === block.images.length - 1} onClick={() => onChange({ images: swapAt(block.images, i, i + 1) })}>
                <ArrowDown size={12} style={{ transform: "rotate(-90deg)" }} />
              </MiniButton>
              <span style={{ flex: 1 }} />
              <MiniButton label={`Remove photo ${i + 1}`} onClick={() => onChange({ images: block.images.filter((_, k) => k !== i) })}>
                <Trash2 size={12} />
              </MiniButton>
            </div>
          </div>
        ))}
      </div>
      <div>
        <Button variant="outline" disabled={busy || room <= 0} onClick={() => input.current?.click()} style={withIcon}>
          {busy ? <Loader size={13} className="ot-spin" /> : <ImagePlus size={13} />} {busy ? "Uploading…" : "Add photos"}
        </Button>
        <span style={{ ...hint, marginLeft: 10 }}>{block.images.length}/12</span>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => (e.target.files?.length ? void add(e.target.files) : undefined)} aria-label="Choose photos" />
      </div>
      {error ? (
        <span role="alert" style={{ fontSize: 12.5, color: "var(--tone-danger)" }}>
          {error}{" "}
          <button type="button" onClick={clearError} style={{ font: "inherit", border: 0, background: "none", color: "inherit", textDecoration: "underline", cursor: "pointer", padding: 0 }}>
            Dismiss
          </button>
        </span>
      ) : null}
    </div>
  );
}

function MiniButton({ label, onClick, disabled, children }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} style={{ ...mini, opacity: disabled ? 0.4 : 1, cursor: disabled ? "default" : "pointer" }}>
      {children}
    </button>
  );
}

const swapAt = (list, a, b) => {
  const next = [...list];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
};

const layout = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 460px), 1fr))", gap: 16, alignItems: "start" };
const previewColumn = { position: "sticky", top: 132 };
const tight = { maxWidth: "none", marginBottom: 0 };
const hint = { fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5, margin: "8px 0 0" };
const withIcon = { display: "inline-flex", gap: 6, alignItems: "center" };
const blockBox = { padding: 12, border: "1px solid var(--color-border)", borderRadius: 10, background: "var(--color-surface)" };
const blockHead = { display: "flex", alignItems: "center", gap: 6, marginBottom: 10 };
const mini = { display: "grid", placeItems: "center", width: 28, height: 28, border: "1px solid var(--color-border)", borderRadius: 7, background: "var(--color-bg)", color: "var(--color-text)", padding: 0, flexShrink: 0 };
const textarea = { font: "inherit", fontSize: 14, width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", resize: "vertical", minHeight: 70 };
