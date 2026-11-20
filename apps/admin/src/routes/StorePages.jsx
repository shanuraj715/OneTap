import { useState } from "react";
import { Link, useNavigate } from "../lib/nav";
import { ArrowDown, ArrowUp, ExternalLink, FileText, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import * as api from "../lib/api";
import { useOutlet } from "../lib/useOutlet";
import { usePageAction, useStorePages } from "../lib/usePages";
import { storefrontHref } from "../lib/storefront";
import { Button, Card, Modal, PageHeader, Pill, TextInput, Toast } from "../ui";
import { StorefrontNav } from "../components/SubNav";

/**
 * Pages — the store's own pages on its storefront: About us, Contact, FAQ, policies, anything else. Each outlet has
 * its own set. Here you see them all, add, reorder and delete; the page editor is one click away.
 */
export function StorePages() {
  const { outlet } = useOutlet();
  const navigate = useNavigate();
  const q = useStorePages(outlet);
  const starter = usePageAction(outlet, () => api.createStarterPages(outlet));
  const create = usePageAction(outlet, (title) => api.createStorePage(outlet, { title }));
  const remove = usePageAction(outlet, (id) => api.deleteStorePage(outlet, id));
  const reorder = usePageAction(outlet, (ids) => api.reorderStorePages(outlet, ids));
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [deleting, setDeleting] = useState(null);

  const header = <PageHeader title="Pages" icon={<FileText size={23} />} subtitle="Your own pages on the storefront — About us, Contact, FAQ, policies and anything else." />;

  if (!outlet) {
    return (
      <>
        {header}
        <StorefrontNav />
        <Card>Choose an outlet first.</Card>
      </>
    );
  }

  const pages = q.data?.pages ?? [];
  const busy = starter.isPending || create.isPending || remove.isPending || reorder.isPending;
  const move = (i, by) => {
    const ids = pages.map((p) => p.id);
    const [id] = ids.splice(i, 1);
    ids.splice(i + by, 0, id);
    reorder.mutate(ids);
  };
  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    create.mutate(title.trim(), {
      onSuccess: (r) => {
        setAdding(false);
        setTitle("");
        navigate(`/pages/${r.page.id}`);
      },
    });
  };

  return (
    <>
      <PageHeader
        title="Pages"
        icon={<FileText size={23} />}
        subtitle={`Your own pages on the storefront of ${outlet.config?.identity?.name || outlet.name} — About us, Contact, FAQ, policies and anything else.`}
        action={
          <Button onClick={() => setAdding(true)} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <Plus size={14} /> Add a page
          </Button>
        }
      />
      <StorefrontNav />

      {q.isLoading ? (
        <Card>Loading…</Card>
      ) : pages.length === 0 ? (
        <Card title="No pages yet" subtitle="Visitors only see a page once you publish it.">
          <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.6 }}>
            Start with the ready-made set — About us, Contact &amp; hours, Gallery, FAQ and the usual policies. They are added as <strong>drafts</strong> with a little
            starter text, so nothing goes live until you have read and published it.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={() => starter.mutate()} disabled={busy} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <Sparkles size={14} /> {starter.isPending ? "Adding…" : "Add the ready-made pages"}
            </Button>
            <Button variant="outline" onClick={() => setAdding(true)} disabled={busy}>
              Start with a blank page
            </Button>
          </div>
          {starter.error ? <Toast kind="error">{starter.error.message}</Toast> : null}
        </Card>
      ) : (
        <Card
          title={`${pages.length} ${pages.length === 1 ? "page" : "pages"}`}
          subtitle="The order here is the order of the links in the header menu and the footer."
          action={
            <Button variant="outline" onClick={() => starter.mutate()} disabled={busy} style={{ display: "inline-flex", gap: 6, alignItems: "center" }} title="Adds any ready-made page you don't have yet — the ones you have are left alone">
              <Sparkles size={13} /> Add ready-made pages
            </Button>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pages.map((p, i) => (
              <div key={p.id} style={row}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <button type="button" aria-label={`Move ${p.title} up`} disabled={i === 0 || busy} onClick={() => move(i, -1)} style={arrow}>
                    <ArrowUp size={13} />
                  </button>
                  <button type="button" aria-label={`Move ${p.title} down`} disabled={i === pages.length - 1 || busy} onClick={() => move(i, 1)} style={arrow}>
                    <ArrowDown size={13} />
                  </button>
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <Link to={`/pages/${p.id}`} style={{ fontWeight: 650, fontSize: 14.5, color: "var(--color-text)", textDecoration: "none" }}>
                    {p.title}
                  </Link>
                  <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginTop: 2 }}>
                    /{outlet.slug}/{p.slug} · {p.blockCount} {p.blockCount === 1 ? "block" : "blocks"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Pill tone={p.status === "published" ? "ok" : "neutral"}>{p.status === "published" ? "Published" : "Draft"}</Pill>
                  {p.showInHeader ? <Pill>In the menu</Pill> : null}
                  {p.showInFooter ? <Pill>In the footer</Pill> : null}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Button variant="outline" onClick={() => navigate(`/pages/${p.id}`)} style={withIcon}>
                    <Pencil size={13} /> Edit
                  </Button>
                  {p.status === "published" ? (
                    <a href={storefrontHref(outlet, p.slug)} target="_blank" rel="noopener" style={{ textDecoration: "none" }}>
                      <Button variant="outline" style={withIcon}>
                        <ExternalLink size={13} /> View
                      </Button>
                    </a>
                  ) : null}
                  <Button variant="outline" aria-label={`Delete ${p.title}`} onClick={() => setDeleting(p)} style={{ ...withIcon, color: "var(--tone-danger)" }}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {reorder.error ? <Toast kind="error">{reorder.error.message}</Toast> : null}
          {starter.isSuccess && starter.data?.created?.length === 0 ? <Toast kind="ok">You already have all the ready-made pages.</Toast> : null}
          {starter.isSuccess && starter.data?.created?.length > 0 ? <Toast kind="ok">Added {starter.data.created.length} drafts — open each one, read it, then publish.</Toast> : null}
        </Card>
      )}

      {adding ? (
        <Modal onClose={() => setAdding(false)} width={440} ariaLabel="Add a page">
          <form onSubmit={submit} style={{ padding: 22 }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 19 }}>Add a page</h2>
            <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--color-text-muted)" }}>Give it a name — you can build it up on the next screen. It stays a draft until you publish it.</p>
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} autoFocus maxLength={80} placeholder="e.g. Our story" aria-label="Page title" />
            {create.error ? <Toast kind="error">{create.error.message}</Toast> : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <Button type="button" variant="outline" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!title.trim() || create.isPending}>
                {create.isPending ? "Adding…" : "Add page"}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {deleting ? (
        <Modal onClose={() => setDeleting(null)} width={440} ariaLabel={`Delete ${deleting.title}`}>
          <div style={{ padding: 22 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 19 }}>Delete “{deleting.title}”?</h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
              {deleting.status === "published" ? "It is live right now, so its address (/" + outlet.slug + "/" + deleting.slug + ") will stop working. " : ""}
              This can&apos;t be undone.
            </p>
            {remove.error ? <Toast kind="error">{remove.error.message}</Toast> : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <Button variant="outline" onClick={() => setDeleting(null)}>
                Keep it
              </Button>
              <Button
                disabled={remove.isPending}
                onClick={() => remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
                style={{ background: "var(--color-primary)" }}
              >
                {remove.isPending ? "Deleting…" : "Delete page"}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

const row = { display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", padding: "11px 13px", border: "1px solid var(--color-border)", borderRadius: 10, background: "var(--color-bg)" };
const arrow = { display: "grid", placeItems: "center", width: 24, height: 22, padding: 0, border: "1px solid var(--color-border)", borderRadius: 6, background: "var(--color-bg)", color: "var(--color-text)", cursor: "pointer" };
const withIcon = { display: "inline-flex", gap: 6, alignItems: "center" };
