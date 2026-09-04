import { useState } from "react";
import { Button, Field, Modal, TextInput, Toast } from "../ui";
import { useCreateOutlet, useUpdateOutlet } from "../lib/useOutlet";

function slugify(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Create a new physical location for a brand, or edit an existing one's name
 * and slug — same form either way, just a different verb and mutation.
 * Pass `outlet` to edit it in place; omit it to create a new one under
 * `brandId`.
 */
export function CreateOutletModal({ brandId, outlet, onClose, onCreated }) {
  const editing = Boolean(outlet);
  const [name, setName] = useState(outlet?.name ?? "");
  const [slug, setSlug] = useState(outlet?.slug ?? "");
  // Editing an outlet whose slug is already live somewhere shouldn't silently
  // re-derive out from under the owner as they fix a typo in the name — only
  // a brand-new outlet auto-fills the slug from the name as they type.
  const [slugTouched, setSlugTouched] = useState(editing);
  const create = useCreateOutlet();
  const update = useUpdateOutlet();
  const pending = editing ? update.isPending : create.isPending;
  const error = editing ? update.error : create.error;

  const effectiveSlug = slugTouched ? slug : slugify(name);

  const submit = (e) => {
    e.preventDefault();
    if (editing) {
      update.mutate(
        { id: outlet._id, body: { name, slug: effectiveSlug } },
        { onSuccess: () => onClose() },
      );
    } else {
      create.mutate(
        { brandId, body: { name, slug: effectiveSlug } },
        {
          onSuccess: (r) => {
            onCreated?.(r.outlet);
            onClose();
          },
        },
      );
    }
  };

  return (
    <Modal onClose={onClose} ariaLabel={editing ? "Edit outlet" : "Add outlet"} width={480}>
      <h2 style={{ margin: "0 0 4px", fontSize: 17 }}>{editing ? "Edit outlet" : "Add outlet"}</h2>
      <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--color-text-muted)" }}>
        {editing
          ? "The name and web address for this location."
          : "A new physical location for this brand — same domain, its own menu and appearance."}
      </p>
      <form onSubmit={submit}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <Field label="Name" info="Shown to customers and staff — e.g. the neighbourhood or mall it's in." style={{ maxWidth: "none" }}>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} required autoFocus maxLength={80} />
          </Field>
          <Field
            label="URL slug"
            info="Becomes part of this outlet's web address, e.g. yourdomain.com/preet-vihar. Lowercase letters, numbers and hyphens only."
            style={{ maxWidth: "none" }}
          >
            <TextInput
              value={effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              required
              maxLength={63}
            />
          </Field>
        </div>
        <Button type="submit" disabled={pending || !name || !effectiveSlug} style={{ width: "100%", marginTop: 4 }}>
          {pending ? "Saving…" : editing ? "Save changes" : "Create outlet"}
        </Button>
        {error ? <Toast kind="error">{error.message}</Toast> : null}
      </form>
    </Modal>
  );
}
