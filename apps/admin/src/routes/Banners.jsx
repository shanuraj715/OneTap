import { useEffect, useMemo, useState } from "react";
import {
  CAROUSEL_HEIGHT_LABELS,
  CAROUSEL_HEIGHTS,
  emptyAnnouncementMessage,
  emptyCarouselSlide,
  isSafeHref,
  MAX_ANNOUNCEMENT_MESSAGES,
  MAX_CAROUSEL_SLIDES,
} from "@onetap/config-schema";
import { announcementVariants, carouselVariants, getVariant } from "@onetap/ui";
import { ArrowDown, ArrowUp, Megaphone, Plus, Trash2 } from "lucide-react";
import { useOutlet, usePatchConfig } from "../lib/useOutlet";
import { Button, Card, Checkbox, Field, PageHeader, Select, STICKY_HEADER_CLEARANCE, TextInput, Toast } from "../ui";
import { ImageField } from "../components/ImageField";
import { StorefrontNav } from "../components/SubNav";
import { StorePreviewFrame } from "../lib/storePreview";

const LINK_HINT = "https://…, a page like /about, or #menu";

/**
 * Banners — the two pieces of the storefront that sit around the menu: the message bar above the header
 * ("Free delivery today") and the promo carousel under it (offers, new dishes). What they SAY is saved for this
 * outlet; their STYLE is shared by every outlet of the store, like the rest of the look.
 */
export function Banners() {
  const { outlet } = useOutlet();
  const patch = usePatchConfig();
  const [draft, setDraft] = useState(null);

  const original = useMemo(
    () =>
      outlet
        ? {
            announcement: outlet.config.announcement,
            carousel: outlet.config.carousel,
            announcementVariant: outlet.config.layout.announcementVariant,
            carouselVariant: outlet.config.layout.carouselVariant,
          }
        : null,
    [outlet],
  );

  // keyed on the outlet's id (not the object, which is a new reference on every refetch) so editing is never overwritten
  useEffect(() => {
    if (original) setDraft(structuredClone(original));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlet?._id]);

  if (!outlet || !draft) {
    return (
      <>
        <PageHeader title="Banners" icon={<Megaphone size={23} />} />
        <StorefrontNav />
        <Card>Choose an outlet first.</Card>
      </>
    );
  }

  const { announcement: bar, carousel } = draft;
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);
  const set = (part, value) => setDraft((d) => ({ ...d, [part]: { ...d[part], ...value } }));

  const badLink = (href) => href !== "" && !isSafeHref(href);
  const hasBadLink = bar.messages.some((m) => badLink(m.linkHref)) || carousel.slides.some((s) => badLink(s.ctaHref));

  const save = () =>
    patch.mutate({
      outlet,
      patch: {
        // a message or slide with nothing in it is just an unfilled form row — don't keep it
        announcement: { ...bar, messages: bar.messages.filter((m) => m.text.trim()) },
        carousel: { ...carousel, slides: carousel.slides.filter((s) => s.imageUrl || s.title.trim()) },
        layout: { announcementVariant: draft.announcementVariant, carouselVariant: draft.carouselVariant },
      },
    });

  return (
    <>
      <PageHeader title="Banners" icon={<Megaphone size={23} />} subtitle="The message bar above your header, and the promo carousel under it." />
      <StorefrontNav />

      {/* Sits below the sticky PageHeader, not on top of it — see STICKY_HEADER_CLEARANCE. */}
      <div style={{ position: "sticky", top: STICKY_HEADER_CLEARANCE, zIndex: 4, background: "var(--color-bg)", padding: "10px 0 14px", marginBottom: 4 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <Button onClick={save} disabled={!dirty || patch.isPending || hasBadLink}>
            {patch.isPending ? "Saving…" : "Save banners"}
          </Button>
          <Button variant="outline" onClick={() => setDraft(structuredClone(original))} disabled={!dirty}>
            Reset
          </Button>
          {dirty ? <span style={muted}>Unsaved changes</span> : null}
          {hasBadLink ? <span style={{ fontSize: 13, color: "var(--tone-danger)" }}>A link isn't a valid address — fix it to save.</span> : null}
          {patch.isSuccess && !dirty ? <Toast kind="ok">Saved. Reload the storefront to see it.</Toast> : null}
          {patch.error ? <Toast kind="error">{patch.error.message}</Toast> : null}
        </div>
      </div>

      {/* ------------------------------------------------------------ message bar */}
      <Card title="Message bar" subtitle="A strip across the very top of the storefront for something everyone should see — a festival offer, free delivery, a day you're closed.">
        <Checkbox
          checked={bar.enabled}
          onChange={(v) => set("announcement", { enabled: v })}
          label="Show the message bar"
          info="Switched off, nothing appears — your messages are kept here for next time."
        />

        <BarPreview outlet={outlet} bar={bar} variantId={draft.announcementVariant} />

        <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "16px 0" }}>
          {bar.messages.length === 0 ? <p style={{ ...muted, margin: 0 }}>No messages yet — add one below. (The preview above shows sample text.)</p> : null}
          {bar.messages.map((m, i) => (
            <div key={m.id} style={rowBox}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, flex: 1, minWidth: 0 }}>
                <Field label={`Message ${i + 1}`} style={tight} hint={`${m.text.length}/140`}>
                  <TextInput value={m.text} maxLength={140} placeholder="e.g. Free delivery on orders above ₹499" onChange={(e) => set("announcement", { messages: swap(bar.messages, i, { text: e.target.value }) })} />
                </Field>
                <Field label="Link text (optional)" style={tight}>
                  <TextInput value={m.linkLabel} maxLength={30} placeholder="Order now" onChange={(e) => set("announcement", { messages: swap(bar.messages, i, { linkLabel: e.target.value }) })} />
                </Field>
                <Field label="Link address (optional)" style={tight} hint={badLink(m.linkHref) ? undefined : LINK_HINT}>
                  <TextInput value={m.linkHref} maxLength={300} aria-invalid={badLink(m.linkHref)} placeholder="#menu" onChange={(e) => set("announcement", { messages: swap(bar.messages, i, { linkHref: e.target.value }) })} />
                  {badLink(m.linkHref) ? <span style={{ fontSize: 12, color: "var(--tone-danger)" }}>Not a valid address — use {LINK_HINT}</span> : null}
                </Field>
              </div>
              <IconButton label={`Remove message ${i + 1}`} onClick={() => set("announcement", { messages: bar.messages.filter((_, k) => k !== i) })}>
                <Trash2 size={14} />
              </IconButton>
            </div>
          ))}
          <div>
            <Button variant="outline" disabled={bar.messages.length >= MAX_ANNOUNCEMENT_MESSAGES} onClick={() => set("announcement", { messages: [...bar.messages, emptyAnnouncementMessage()] })} style={withIcon}>
              <Plus size={14} /> Add a message
            </Button>
            <span style={{ ...muted, marginLeft: 10 }}>
              {bar.messages.length}/{MAX_ANNOUNCEMENT_MESSAGES} · with more than one, they take turns
            </span>
          </div>
        </div>

        <div style={options}>
          <Checkbox checked={bar.showPhone} onChange={(v) => set("announcement", { showPhone: v })} label="Show our phone number" info="In the styles that have room for it (like “Split info”). It comes from Settings → Business." />
          <Checkbox checked={bar.dismissible} onChange={(v) => set("announcement", { dismissible: v })} label="Visitors can close it" info="Adds a ✕. A visitor who closes it won't see that message again — until you change it." />
          {bar.messages.length > 1 ? (
            <Field label="Seconds per message" style={{ ...tight, maxWidth: 150 }}>
              <TextInput type="number" min={2} max={20} value={bar.rotateSeconds} onChange={(e) => set("announcement", { rotateSeconds: clamp(e.target.value, 2, 20) })} />
            </Field>
          ) : null}
        </div>

        <h3 style={h3}>Style</h3>
        <StylePicker
          variants={announcementVariants}
          value={draft.announcementVariant}
          onChange={(v) => setDraft((d) => ({ ...d, announcementVariant: v }))}
          config={outlet.config}
          render={(Component) => <Component messages={previewMessages(bar, outlet)} phone={outlet.config.identity.phone || "+91 98765 43210"} dismissible={false} rotateSeconds={bar.rotateSeconds} />}
        />
      </Card>

      {/* --------------------------------------------------------------- carousel */}
      <Card title="Promo carousel" subtitle="Slides with a picture, a headline and a button — new dishes, festival offers, a free-delivery weekend. Shown under the header on the menu page.">
        <Checkbox checked={carousel.enabled} onChange={(v) => set("carousel", { enabled: v })} label="Show the carousel" info="Switched off, nothing appears — your slides are kept here for next time." />

        <CarouselPreview outlet={outlet} carousel={carousel} variantId={draft.carouselVariant} />

        <div style={{ display: "flex", flexDirection: "column", gap: 12, margin: "16px 0" }}>
          {carousel.slides.length === 0 ? <p style={{ ...muted, margin: 0 }}>No slides yet — add one below. (The preview above shows sample slides.)</p> : null}
          {carousel.slides.map((s, i) => (
            <div key={s.id} style={rowBox}>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                <ImageField outlet={outlet} kind="banners" label="Picture" value={s.imageUrl} onChange={(url) => set("carousel", { slides: swap(carousel.slides, i, { imageUrl: url }) })} />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
                  <Field label={`Slide ${i + 1} headline`} style={tight} hint={`${s.title.length}/80`}>
                    <TextInput value={s.title} maxLength={80} placeholder="Festival feast" onChange={(e) => set("carousel", { slides: swap(carousel.slides, i, { title: e.target.value }) })} />
                  </Field>
                  <Field label="Line under it (optional)" style={tight} hint={`${s.subtitle.length}/160`}>
                    <TextInput value={s.subtitle} maxLength={160} placeholder="Buy 2 plates, get a lassi free" onChange={(e) => set("carousel", { slides: swap(carousel.slides, i, { subtitle: e.target.value }) })} />
                  </Field>
                  <Field label="Button text (optional)" style={tight}>
                    <TextInput value={s.ctaLabel} maxLength={30} placeholder="Order now" onChange={(e) => set("carousel", { slides: swap(carousel.slides, i, { ctaLabel: e.target.value }) })} />
                  </Field>
                  <Field label="Button link" style={tight} hint={badLink(s.ctaHref) ? undefined : LINK_HINT}>
                    <TextInput value={s.ctaHref} maxLength={300} aria-invalid={badLink(s.ctaHref)} placeholder="#menu" onChange={(e) => set("carousel", { slides: swap(carousel.slides, i, { ctaHref: e.target.value }) })} />
                    {badLink(s.ctaHref) ? <span style={{ fontSize: 12, color: "var(--tone-danger)" }}>Not a valid address — use {LINK_HINT}</span> : null}
                  </Field>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <IconButton label={`Move slide ${i + 1} up`} disabled={i === 0} onClick={() => set("carousel", { slides: move(carousel.slides, i, -1) })}>
                  <ArrowUp size={14} />
                </IconButton>
                <IconButton label={`Move slide ${i + 1} down`} disabled={i === carousel.slides.length - 1} onClick={() => set("carousel", { slides: move(carousel.slides, i, 1) })}>
                  <ArrowDown size={14} />
                </IconButton>
                <IconButton label={`Remove slide ${i + 1}`} onClick={() => set("carousel", { slides: carousel.slides.filter((_, k) => k !== i) })}>
                  <Trash2 size={14} />
                </IconButton>
              </div>
            </div>
          ))}
          <div>
            <Button variant="outline" disabled={carousel.slides.length >= MAX_CAROUSEL_SLIDES} onClick={() => set("carousel", { slides: [...carousel.slides, emptyCarouselSlide()] })} style={withIcon}>
              <Plus size={14} /> Add a slide
            </Button>
            <span style={{ ...muted, marginLeft: 10 }}>
              {carousel.slides.length}/{MAX_CAROUSEL_SLIDES}
            </span>
          </div>
        </div>

        <div style={options}>
          <Checkbox checked={carousel.autoplay} onChange={(v) => set("carousel", { autoplay: v })} label="Move on by itself" info="Slides advance on their own. It stops while someone points at it, in a background tab, and for visitors who asked their phone for less motion." />
          {carousel.autoplay ? (
            <Field label="Seconds per slide" style={{ ...tight, maxWidth: 150 }}>
              <TextInput type="number" min={3} max={15} value={carousel.intervalSeconds} onChange={(e) => set("carousel", { intervalSeconds: clamp(e.target.value, 3, 15) })} />
            </Field>
          ) : null}
          <Checkbox checked={carousel.showArrows} onChange={(v) => set("carousel", { showArrows: v })} label="Show arrows" />
          <Checkbox checked={carousel.showDots} onChange={(v) => set("carousel", { showDots: v })} label="Show dots" />
          <Field label="Height" style={{ ...tight, maxWidth: 170 }}>
            <Select value={carousel.height} onChange={(e) => set("carousel", { height: e.target.value })}>
              {CAROUSEL_HEIGHTS.map((h) => (
                <option key={h} value={h}>
                  {CAROUSEL_HEIGHT_LABELS[h]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <h3 style={h3}>Style</h3>
        <StylePicker
          variants={carouselVariants}
          value={draft.carouselVariant}
          onChange={(v) => setDraft((d) => ({ ...d, carouselVariant: v }))}
          config={outlet.config}
          render={(Component) => <Component items={slideItems(carousel)} height="compact" showArrows={carousel.showArrows} showDots={carousel.showDots} />}
        />
      </Card>
    </>
  );
}

/* ----------------------------------------------------------------- previews */

const SAMPLE_MESSAGES = [
  { id: "sample1", text: "Free delivery on orders above ₹499", linkLabel: "Order now", linkHref: "#menu" },
  { id: "sample2", text: "Fresh, hot and made to order", linkLabel: "", linkHref: "" },
];
const SAMPLE_SLIDES = [
  { id: "s1", title: "Festival feast", subtitle: "Buy 2 plates, get a lassi free", ctaLabel: "Order now", href: "#menu" },
  { id: "s2", title: "New: Kurkure momos", subtitle: "Crisp outside, juicy inside", ctaLabel: "See the menu", href: "#menu" },
  { id: "s3", title: "Smoky tandoori momos", subtitle: "Char-grilled to order" },
];

/** What the bar shows in a preview: the messages typed so far, or a sample until there are some. */
function previewMessages(bar) {
  const typed = bar.messages.filter((m) => m.text.trim());
  return typed.length ? typed : SAMPLE_MESSAGES;
}

const slideItems = (carousel) => {
  const typed = carousel.slides.filter((s) => s.imageUrl || s.title.trim());
  return typed.length ? typed.map((s) => ({ id: s.id, imageUrl: s.imageUrl || undefined, title: s.title, subtitle: s.subtitle, ctaLabel: s.ctaLabel, href: s.ctaHref })) : SAMPLE_SLIDES;
};

function BarPreview({ outlet, bar, variantId }) {
  const Bar = getVariant("announcementVariant", variantId).Component;
  return (
    <div style={{ marginTop: 14, opacity: bar.enabled ? 1 : 0.5 }} aria-label="Preview of the message bar">
      <StorePreviewFrame config={outlet.config} flush maxHeight={120}>
        <Bar messages={previewMessages(bar)} phone={bar.showPhone ? outlet.config.identity.phone || "+91 98765 43210" : undefined} dismissible={bar.dismissible} rotateSeconds={bar.rotateSeconds} />
      </StorePreviewFrame>
      {!bar.enabled ? <p style={{ ...muted, margin: "6px 0 0" }}>Switched off — this is how it will look once you turn it on.</p> : null}
    </div>
  );
}

function CarouselPreview({ outlet, carousel, variantId }) {
  const Carousel = getVariant("carouselVariant", variantId).Component;
  return (
    <div style={{ marginTop: 14, opacity: carousel.enabled ? 1 : 0.5 }} aria-label="Preview of the carousel">
      <StorePreviewFrame config={outlet.config} maxHeight={460}>
        {/* the preview doesn't move on its own — press the arrows to see the slides */}
        <Carousel items={slideItems(carousel)} showArrows={carousel.showArrows} showDots={carousel.showDots} height={carousel.height} />
      </StorePreviewFrame>
      {!carousel.enabled ? <p style={{ ...muted, margin: "6px 0 0" }}>Switched off — this is how it will look once you turn it on.</p> : null}
    </div>
  );
}

/** Every style, drawn with this store's own colours and fonts; click one to choose it. */
function StylePicker({ variants, value, onChange, config, render }) {
  return (
    <div role="radiogroup" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 12 }}>
      {variants.map((v) => {
        const selected = v.id === value;
        return (
          <button key={v.id} type="button" role="radio" aria-checked={selected} onClick={() => onChange(v.id)} style={{ ...tile, ...(selected ? tileOn : null) }}>
            {/* inert: a click anywhere on the tile chooses the style, it doesn't operate the preview */}
            <div style={{ pointerEvents: "none", width: "100%" }} aria-hidden="true">
              <StorePreviewFrame config={config} flush maxHeight={190}>
                {render(v.Component)}
              </StorePreviewFrame>
            </div>
            <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline", width: "100%" }}>
              <strong style={{ fontSize: 13.5 }}>{v.name}</strong>
              <span style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>{v.code}</span>
            </span>
            <span style={{ fontSize: 12, color: "var(--color-text-muted)", lineHeight: 1.4 }}>{v.description}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ helpers */

function IconButton({ label, onClick, disabled, children }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} style={{ ...iconBtn, opacity: disabled ? 0.4 : 1, cursor: disabled ? "default" : "pointer" }}>
      {children}
    </button>
  );
}

const swap = (list, i, patchValue) => list.map((x, k) => (k === i ? { ...x, ...patchValue } : x));
const move = (list, i, by) => {
  const next = [...list];
  const [item] = next.splice(i, 1);
  next.splice(i + by, 0, item);
  return next;
};
const clamp = (raw, min, max) => Math.min(max, Math.max(min, Math.round(Number(raw)) || min));

const muted = { fontSize: 13, color: "var(--color-text-muted)" };
const tight = { maxWidth: "none", marginBottom: 0 };
const withIcon = { display: "inline-flex", gap: 6, alignItems: "center" };
const h3 = { fontSize: 14, margin: "20px 0 10px" };
const options = { display: "flex", flexWrap: "wrap", gap: "14px 24px", alignItems: "flex-end", padding: "14px 0 4px", borderTop: "1px solid var(--color-border)" };
const rowBox = { display: "flex", gap: 12, alignItems: "flex-start", padding: 12, border: "1px solid var(--color-border)", borderRadius: 10, background: "var(--color-surface)" };
const iconBtn = { display: "grid", placeItems: "center", width: 32, height: 32, border: "1px solid var(--color-border)", borderRadius: 8, background: "var(--color-bg)", color: "var(--color-text)", padding: 0 };
const tile = { font: "inherit", textAlign: "left", display: "flex", flexDirection: "column", gap: 6, padding: 10, borderRadius: 12, border: "1.5px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", cursor: "pointer" };
const tileOn = { borderColor: "var(--color-primary)", background: "color-mix(in srgb, var(--color-primary) 6%, var(--color-bg))" };
