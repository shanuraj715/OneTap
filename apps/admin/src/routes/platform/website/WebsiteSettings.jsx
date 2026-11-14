import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import * as api from "../../../lib/api";
import { usePlatformMutation, useSiteSettings } from "../../../lib/usePlatform";
import { Button, Card, Checkbox, ColorInput, PageHeader, STICKY_HEADER_CLEARANCE, Toast } from "../../../ui";
import { ImageField, Row, Text } from "./fields";
import { WebsiteTabs } from "./WebsitePages";

/** The website's name, look, contact details, social links and default search settings. */
export function WebsiteSettings() {
  const q = useSiteSettings();
  const [draft, setDraft] = useState(null);
  const save = usePlatformMutation(() => api.saveSiteSettings(draft));

  useEffect(() => {
    if (q.data?.settings) setDraft(q.data.settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.dataUpdatedAt]);

  if (!draft) {
    return (
      <>
        <PageHeader title="Website settings" icon={<Globe size={23} />} />
        <WebsiteTabs active="settings" />
        <Card>{q.isError ? q.error.message : "Loading…"}</Card>
      </>
    );
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(q.data.settings);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const sub = (key) => (patch) => setDraft((d) => ({ ...d, [key]: { ...d[key], ...patch } }));
  const contact = sub("contact");
  const social = sub("social");
  const seo = sub("seo");
  const announcement = sub("announcement");

  return (
    <>
      <PageHeader title="Website settings" icon={<Globe size={23} />} subtitle="Shown on every page of the TablePe website." />
      <WebsiteTabs active="settings" />

      <div style={{ position: "sticky", top: STICKY_HEADER_CLEARANCE, zIndex: 4, background: "var(--color-bg)", padding: "8px 0 12px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
          {save.isPending ? "Saving…" : "Save settings"}
        </Button>
        {dirty ? <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Unsaved changes</span> : null}
        {save.isSuccess && !dirty ? <Toast kind="ok">Saved — the website updates within seconds.</Toast> : null}
        {save.error ? <Toast kind="error">{save.error.message}</Toast> : null}
      </div>

      <Card title="Brand">
        <div style={stack}>
          <Row>
            <Text label="Name" value={draft.brandName} onChange={(v) => set({ brandName: v })} max={60} />
            <Text label="Tagline" value={draft.tagline} onChange={(v) => set({ tagline: v })} max={140} />
          </Row>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 600 }}>
            Brand colour — buttons, highlights and links
            <ColorInput value={draft.brandColor} onChange={(v) => set({ brandColor: v.toUpperCase() })} />
          </label>
          <Row>
            <ImageField label="Logo (optional — the name shows without one)" value={draft.logoUrl} onChange={(v) => set({ logoUrl: v })} withAlt={false} />
            <ImageField label="Browser tab icon (optional)" value={draft.faviconUrl} onChange={(v) => set({ faviconUrl: v })} withAlt={false} />
          </Row>
          <Text
            label="Website address"
            value={draft.siteUrl}
            onChange={(v) => set({ siteUrl: v.trim() })}
            max={200}
            placeholder="https://tablepe.com"
            hint="The address the website is live on. Used for links Google and social networks see, and the sitemap."
          />
        </div>
      </Card>

      <Card title="Contact details" subtitle="Shown on the Contact page and in the footer. Leave a field empty to hide it.">
        <div style={stack}>
          <Row>
            <Text label="Phone" value={draft.contact.phone} onChange={(v) => contact({ phone: v })} max={30} placeholder="+91 98xxx xxxxx" />
            <Text label="WhatsApp number" value={draft.contact.whatsapp} onChange={(v) => contact({ whatsapp: v })} max={30} placeholder="98xxx xxxxx" />
            <Text label="Email" value={draft.contact.email} onChange={(v) => contact({ email: v })} max={120} placeholder="hello@tablepe.com" />
          </Row>
          <Row>
            <Text label="Address" value={draft.contact.address} onChange={(v) => contact({ address: v })} max={300} />
            <Text label="Hours" value={draft.contact.hours} onChange={(v) => contact({ hours: v })} max={120} placeholder="Mon–Sat, 10am–8pm" />
          </Row>
        </div>
      </Card>

      <Card title="Social links" subtitle="Full addresses, e.g. https://instagram.com/tablepe">
        <Row>
          <Text label="Instagram" value={draft.social.instagram} onChange={(v) => social({ instagram: v })} max={300} />
          <Text label="Facebook" value={draft.social.facebook} onChange={(v) => social({ facebook: v })} max={300} />
          <Text label="LinkedIn" value={draft.social.linkedin} onChange={(v) => social({ linkedin: v })} max={300} />
          <Text label="X (Twitter)" value={draft.social.x} onChange={(v) => social({ x: v })} max={300} />
          <Text label="YouTube" value={draft.social.youtube} onChange={(v) => social({ youtube: v })} max={300} />
        </Row>
      </Card>

      <Card title="Search defaults" subtitle="Used by any page that doesn't set its own.">
        <div style={stack}>
          <Text label="Title pattern" value={draft.seo.titleTemplate} onChange={(v) => seo({ titleTemplate: v })} max={80} hint='"%s" becomes the page title — e.g. "%s · TablePe" gives "Pricing · TablePe".' />
          <Text label="Description" value={draft.seo.description} onChange={(v) => seo({ description: v })} max={170} multiline rows={2} />
          <ImageField label="Share image (optional)" value={draft.seo.ogImage} onChange={(v) => seo({ ogImage: v })} withAlt={false} />
        </div>
      </Card>

      <Card title="Announcement bar" subtitle="A one-line message above the header on every page.">
        <div style={stack}>
          <Checkbox checked={draft.announcement.show} onChange={(v) => announcement({ show: v })} label="Show the announcement bar" />
          <Row>
            <Text label="Message" value={draft.announcement.text} onChange={(v) => announcement({ text: v })} max={140} placeholder="Now with staff ordering on phones →" />
            <Text label="Link (optional)" value={draft.announcement.href} onChange={(v) => announcement({ href: v })} max={300} placeholder="/pricing" />
          </Row>
        </div>
      </Card>

      <Card title="Footer">
        <Text label="Footer line" value={draft.footerNote} onChange={(v) => set({ footerNote: v })} max={300} />
      </Card>
    </>
  );
}

const stack = { display: "flex", flexDirection: "column", gap: 14 };
