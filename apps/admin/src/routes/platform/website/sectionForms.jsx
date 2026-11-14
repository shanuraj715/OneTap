import { Checkbox, Note } from "../../../ui";
import { IconPicker, ImageField, LinkField, ListEditor, Row, Text } from "./fields";

/**
 * The form for each kind of section. Field limits mirror SECTION_SCHEMAS in
 * config-schema. `set(patch)` merges into the section being edited.
 */

function Header({ s, set, intro = true }) {
  return (
    <>
      <Row>
        <Text label="Small label above the heading" value={s.eyebrow} onChange={(v) => set({ eyebrow: v })} max={60} placeholder="e.g. Why TablePe" />
        <Text label="Anchor (for links like #pricing)" value={s.anchor} onChange={(v) => set({ anchor: v.toLowerCase().replace(/[^a-z0-9-]/g, "") })} max={40} placeholder="optional" />
      </Row>
      <Text label="Heading" value={s.heading} onChange={(v) => set({ heading: v })} max={140} />
      {intro ? <Text label="Intro" value={s.intro} onChange={(v) => set({ intro: v })} max={400} multiline rows={2} /> : null}
    </>
  );
}

const FORMS = {
  hero: ({ s, set, pages }) => (
    <>
      <Text label="Small label above the headline" value={s.eyebrow} onChange={(v) => set({ eyebrow: v })} max={60} />
      <Text
        label="Headline"
        value={s.heading}
        onChange={(v) => set({ heading: v })}
        max={140}
        multiline
        rows={2}
        hint="This is the page's main heading (its <h1>) — say what you do. Wrap words in *asterisks* to colour them."
      />
      <Text label="Sub-headline" value={s.subheading} onChange={(v) => set({ subheading: v })} max={400} multiline rows={3} />
      <Row>
        <LinkField label="Main button" value={s.primary} onChange={(v) => set({ primary: v })} pages={pages} />
        <LinkField label="Second button" value={s.secondary} onChange={(v) => set({ secondary: v })} pages={pages} />
      </Row>
      <ImageField label="Picture (optional — without one, the kitchen-ticket illustration shows)" value={s.image} onChange={(v) => set({ image: v })} />
      <ListEditor label="Numbers" items={s.stats} onChange={(v) => set({ stats: v })} newItem={() => ({ value: "", label: "" })} max={4} itemTitle={(i) => i.value}>
        {(it, up) => (
          <Row>
            <Text label="Number" value={it.value} onChange={(v) => up({ value: v })} max={20} placeholder="0%" />
            <Text label="What it means" value={it.label} onChange={(v) => up({ label: v })} max={60} placeholder="commission on your orders" />
          </Row>
        )}
      </ListEditor>
    </>
  ),
  features: ({ s, set }) => (
    <>
      <Header s={s} set={set} />
      <ListEditor label="Features" items={s.items} onChange={(v) => set({ items: v })} newItem={() => ({ icon: "zap", title: "", text: "" })} max={12} itemTitle={(i) => i.title}>
        {(it, up) => (
          <>
            <IconPicker value={it.icon} onChange={(v) => up({ icon: v })} />
            <Text label="Title" value={it.title} onChange={(v) => up({ title: v })} max={80} />
            <Text label="Text" value={it.text} onChange={(v) => up({ text: v })} max={300} multiline rows={2} />
          </>
        )}
      </ListEditor>
    </>
  ),
  audience: ({ s, set }) => (
    <>
      <Header s={s} set={set} />
      <ListEditor label="Kinds of restaurant" items={s.items} onChange={(v) => set({ items: v })} newItem={() => ({ title: "", text: "", image: { url: "", alt: "" } })} max={8} itemTitle={(i) => i.title}>
        {(it, up) => (
          <>
            <Text label="Title" value={it.title} onChange={(v) => up({ title: v })} max={80} placeholder="Cafés & quick-service" />
            <Text label="Text" value={it.text} onChange={(v) => up({ text: v })} max={300} multiline rows={2} />
            <ImageField label="Picture (optional)" value={it.image} onChange={(v) => up({ image: v })} />
          </>
        )}
      </ListEditor>
    </>
  ),
  useCases: ({ s, set }) => (
    <>
      <Header s={s} set={set} />
      <ListEditor label="Moments" items={s.items} onChange={(v) => set({ items: v })} newItem={() => ({ icon: "clock", when: "", text: "" })} max={8} itemTitle={(i) => i.when}>
        {(it, up) => (
          <>
            <IconPicker value={it.icon} onChange={(v) => up({ icon: v })} />
            <Text label="When…" value={it.when} onChange={(v) => up({ when: v })} max={80} placeholder="When the queue is out the door" />
            <Text label="How TablePe helps" value={it.text} onChange={(v) => up({ text: v })} max={300} multiline rows={2} />
          </>
        )}
      </ListEditor>
    </>
  ),
  logos: ({ s, set }) => (
    <>
      <Header s={s} set={set} intro={false} />
      <ListEditor label="Stores" items={s.items} onChange={(v) => set({ items: v })} newItem={() => ({ name: "", logo: "", href: "" })} max={24} itemTitle={(i) => i.name}>
        {(it, up) => (
          <>
            <Row>
              <Text label="Name" value={it.name} onChange={(v) => up({ name: v })} max={80} />
              <Text label="Their website (optional)" value={it.href} onChange={(v) => up({ href: v })} max={300} placeholder="https://…" />
            </Row>
            <ImageField label="Logo (optional — the name shows without one)" value={it.logo} onChange={(v) => up({ logo: v })} withAlt={false} />
          </>
        )}
      </ListEditor>
    </>
  ),
  testimonials: ({ s, set }) => (
    <>
      <Note>Use real quotes from real owners, with their permission — made-up reviews can break consumer law and Google's rules.</Note>
      <Header s={s} set={set} />
      <ListEditor label="Quotes" items={s.items} onChange={(v) => set({ items: v })} newItem={() => ({ quote: "", name: "", role: "", business: "", photo: "" })} max={9} itemTitle={(i) => i.name}>
        {(it, up) => (
          <>
            <Text label="Quote" value={it.quote} onChange={(v) => up({ quote: v })} max={600} multiline rows={3} />
            <Row>
              <Text label="Name" value={it.name} onChange={(v) => up({ name: v })} max={80} />
              <Text label="Role" value={it.role} onChange={(v) => up({ role: v })} max={80} placeholder="Owner" />
              <Text label="Business" value={it.business} onChange={(v) => up({ business: v })} max={80} />
            </Row>
            <ImageField label="Photo (optional)" value={it.photo} onChange={(v) => up({ photo: v })} withAlt={false} />
          </>
        )}
      </ListEditor>
    </>
  ),
  pricing: ({ s, set }) => (
    <>
      <Note>The cards come from your Plans — tick "Show on the website" and set a price in Plans → Edit. Each card's button opens Contact with that plan picked.</Note>
      <Header s={s} set={set} />
      <Text label="Note under the cards" value={s.note} onChange={(v) => set({ note: v })} max={300} placeholder="Prices exclude GST." />
    </>
  ),
  faq: ({ s, set }) => (
    <>
      <Header s={s} set={set} />
      <ListEditor label="Questions" items={s.items} onChange={(v) => set({ items: v })} newItem={() => ({ q: "", a: "" })} max={30} itemTitle={(i) => i.q}>
        {(it, up) => (
          <>
            <Text label="Question" value={it.q} onChange={(v) => up({ q: v })} max={200} />
            <Text label="Answer" value={it.a} onChange={(v) => up({ a: v })} max={1500} multiline rows={3} />
          </>
        )}
      </ListEditor>
    </>
  ),
  cta: ({ s, set, pages }) => (
    <>
      <Text label="Heading" value={s.heading} onChange={(v) => set({ heading: v })} max={140} />
      <Text label="Line under it" value={s.text} onChange={(v) => set({ text: v })} max={300} multiline rows={2} />
      <LinkField label="Button" value={s.button} onChange={(v) => set({ button: v })} pages={pages} />
    </>
  ),
  text: ({ s, set }) => (
    <>
      <Text label="Heading (optional)" value={s.heading} onChange={(v) => set({ heading: v })} max={140} />
      <Text
        label="Text"
        value={s.body}
        onChange={(v) => set({ body: v })}
        max={40000}
        multiline
        rows={14}
        mono
        hint="# Heading · ## Smaller heading · - list item · 1. numbered item · **bold** · *italic* · [link text](/contact) · --- for a line"
      />
    </>
  ),
  imageText: ({ s, set, pages }) => (
    <>
      <Text label="Small label above the heading" value={s.eyebrow} onChange={(v) => set({ eyebrow: v })} max={60} />
      <Text label="Heading" value={s.heading} onChange={(v) => set({ heading: v })} max={140} />
      <Text label="Text" value={s.body} onChange={(v) => set({ body: v })} max={4000} multiline rows={6} hint="Same formatting as Text sections: **bold**, [links](/contact), - lists." />
      <ImageField label="Picture (without one, the kitchen-ticket illustration shows)" value={s.image} onChange={(v) => set({ image: v })} />
      <Row>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600 }}>
          Picture on the
          <select value={s.imageSide} onChange={(e) => set({ imageSide: e.target.value })} style={{ font: "inherit", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)" }}>
            <option value="right">Right</option>
            <option value="left">Left</option>
          </select>
        </label>
        <LinkField label="Button (optional)" value={s.button} onChange={(v) => set({ button: v })} pages={pages} />
      </Row>
    </>
  ),
  contact: ({ s, set }) => (
    <>
      <Header s={s} set={set} />
      <Checkbox checked={s.showDetails} onChange={(v) => set({ showDetails: v })} label="Show phone, WhatsApp, email and address beside the form (from Website settings)" />
    </>
  ),
};

export function SectionForm({ section, onChange, pages }) {
  const F = FORMS[section.type];
  if (!F) return <p>Unknown section.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <F s={section} set={(patch) => onChange({ ...section, ...patch })} pages={pages} />
    </div>
  );
}

/** A one-line summary of a section for its collapsed header. */
export function sectionSummary(s) {
  const t = s.heading || s.eyebrow || "";
  const n = s.items?.length;
  return [t, n !== undefined ? `${n} item${n === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ") || "Empty";
}
