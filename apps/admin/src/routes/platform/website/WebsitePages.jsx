import { useState } from "react";
import { Link, useNavigate } from "../../../lib/nav";
import { Copy, ExternalLink, FileText, Globe, Pencil, Plus, Settings as SettingsIcon, Trash2 } from "lucide-react";
import * as api from "../../../lib/api";
import { usePlatformMutation, useSitePages, useSiteSettings } from "../../../lib/usePlatform";
import { Button, Card, Field, Modal, PageHeader, Pill, TextInput, Toast } from "../../../ui";
import { smallBtn } from "./fields";

const DEV_SITE = import.meta.env.VITE_WEBSITE_URL ?? "http://localhost:3073";

/** Where the live website is: its address from Website settings, or the local one in development. */
export const siteBase = (settings) => (import.meta.env.DEV || !settings?.siteUrl ? DEV_SITE : settings.siteUrl).replace(/\/+$/, "");

const slugify = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // "cafés" → "cafes"
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export function WebsiteTabs({ active }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      <Link to="/platform/website" style={{ ...tab, ...(active === "pages" ? tabOn : {}) }}>
        <FileText size={14} /> Pages
      </Link>
      <Link to="/platform/website/settings" style={{ ...tab, ...(active === "settings" ? tabOn : {}) }}>
        <SettingsIcon size={14} /> Settings
      </Link>
    </div>
  );
}

/** Every page of the TablePe website — status, menu placement, and where to edit it. */
export function WebsitePages() {
  const pages = useSitePages();
  const settings = useSiteSettings().data?.settings;
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const duplicate = usePlatformMutation((id) => api.duplicateSitePage(id));
  const remove = usePlatformMutation((id) => api.deleteSitePage(id));
  const list = pages.data?.pages ?? [];
  const base = siteBase(settings);

  return (
    <>
      <PageHeader
        title="Website"
        icon={<Globe size={23} />}
        subtitle="TablePe's own website — the pages restaurants find on Google."
        action={
          <span style={{ display: "flex", gap: 8 }}>
            <a href={base} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
              <Button variant="outline" style={btnIcon}>
                <ExternalLink size={14} /> Open the website
              </Button>
            </a>
            <Button onClick={() => setAdding(true)} style={btnIcon}>
              <Plus size={14} /> New page
            </Button>
          </span>
        }
      />
      <WebsiteTabs active="pages" />

      <Card title={`Pages — ${list.length}`}>
        {pages.isLoading ? (
          <p style={muted}>Loading…</p>
        ) : list.length === 0 ? (
          <p style={muted}>No pages yet. Create one, or run the starter-content script to get Home, Pricing, FAQ, About, Contact, Privacy and Terms ready to edit.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {list.map((p) => {
              const path = p.slug === "home" ? "/" : `/${p.slug}`;
              return (
                <div key={p.id} style={row}>
                  <Link to={`/platform/website/pages/${p.id}`} style={{ flex: 1, minWidth: 180, textDecoration: "none", color: "inherit" }}>
                    <div style={{ fontWeight: 600, fontSize: 14.5 }}>{p.title}</div>
                    <div style={{ ...muted, fontFamily: "ui-monospace, monospace", fontSize: 12.5 }}>{path}</div>
                  </Link>
                  <span style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <Pill tone={p.status === "published" ? "ok" : "neutral"}>{p.status === "published" ? "Published" : "Draft"}</Pill>
                    {p.nav?.show ? <Pill>In menu</Pill> : null}
                    {p.seo?.noindex ? <Pill tone="warn">Hidden from Google</Pill> : null}
                    {p.system ? <Pill>Built-in</Pill> : null}
                  </span>
                  <span style={{ ...muted, fontSize: 12, minWidth: 110, textAlign: "right" }}>
                    {p.sections} section{p.sections === 1 ? "" : "s"} · {new Date(p.updatedAt).toLocaleDateString([], { day: "numeric", month: "short" })}
                  </span>
                  <span style={{ display: "flex", gap: 6 }}>
                    <Link to={`/platform/website/pages/${p.id}`} style={{ ...smallBtn, ...iconLink }} aria-label={`Edit ${p.title}`}>
                      <Pencil size={13} />
                    </Link>
                    {p.status === "published" ? (
                      <a href={`${base}${path}`} target="_blank" rel="noreferrer" style={{ ...smallBtn, ...iconLink }} aria-label={`View ${p.title} on the site`}>
                        <ExternalLink size={13} />
                      </a>
                    ) : null}
                    <button
                      type="button"
                      style={{ ...smallBtn, ...iconLink }}
                      aria-label={`Duplicate ${p.title}`}
                      onClick={() => duplicate.mutate(p.id, { onSuccess: (r) => navigate(`/platform/website/pages/${r.page.id}`) })}
                    >
                      <Copy size={13} />
                    </button>
                    {!p.system ? (
                      <button
                        type="button"
                        style={{ ...smallBtn, ...iconLink, color: "var(--tone-danger)" }}
                        aria-label={`Delete ${p.title}`}
                        onClick={() => window.confirm(`Delete "${p.title}"? It disappears from the website straight away.`) && remove.mutate(p.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    ) : null}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {duplicate.error ? <Toast kind="error">{duplicate.error.message}</Toast> : null}
        {remove.error ? <Toast kind="error">{remove.error.message}</Toast> : null}
      </Card>

      {adding ? <NewPage onClose={() => setAdding(false)} onCreated={(id) => navigate(`/platform/website/pages/${id}`)} /> : null}
    </>
  );
}

function NewPage({ onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const create = usePlatformMutation(() =>
    api.createSitePage({ title: title.trim(), slug: touched ? slug : slugify(title), status: "draft", sections: [] }),
  );
  const address = touched ? slug : slugify(title);
  return (
    <Modal onClose={onClose} ariaLabel="New page" width={520}>
      <form
        style={{ padding: 22 }}
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(undefined, { onSuccess: (r) => onCreated(r.page.id) });
        }}
      >
        <h3 style={{ margin: "0 0 14px", fontFamily: "var(--font-heading)" }}>New page</h3>
        <Field label="Title">
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} autoFocus placeholder="e.g. QR ordering for cafés" />
        </Field>
        <Field label="Address" hint={`/${address || "…"}`}>
          <TextInput
            value={address}
            onChange={(e) => {
              setTouched(true);
              setSlug(slugify(e.target.value));
            }}
            required
            maxLength={80}
          />
        </Field>
        <p style={muted}>It starts as a draft — add sections, preview it, then publish.</p>
        {create.error ? <Toast kind="error">{create.error.message}</Toast> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!title.trim() || !address || create.isPending}>
            {create.isPending ? "Creating…" : "Create page"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const muted = { color: "var(--color-text-muted)", fontSize: 13, margin: 0 };
const btnIcon = { display: "inline-flex", gap: 6, alignItems: "center" };
const row = { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--color-bg)" };
const iconLink = { display: "inline-flex", padding: 7, textDecoration: "none" };
const tab = { display: "inline-flex", alignItems: "center", gap: 7, padding: "7px 14px", borderRadius: 999, borderWidth: 1, borderStyle: "solid", borderColor: "var(--color-border)", textDecoration: "none", color: "var(--color-text)", fontSize: 13.5, fontWeight: 600 };
const tabOn = { background: "var(--color-primary)", borderColor: "var(--color-primary)", color: "var(--color-on-primary)" };
