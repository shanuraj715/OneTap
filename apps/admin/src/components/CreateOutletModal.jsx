import { useState } from "react";
import { Button, Field, Modal, TextInput, Toast } from "../ui";
import { useCreateOutlet } from "../lib/useOutlet";

function slugify(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** A new physical location for an existing brand — same domain, its own menu and appearance. */
export function CreateOutletModal({ brandId, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const create = useCreateOutlet();

  const effectiveSlug = slugTouched ? slug : slugify(name);

  const submit = (e) => {
    e.preventDefault();
    create.mutate(
      { brandId, body: { name, slug: effectiveSlug } },
      {
        onSuccess: (r) => {
          onCreated?.(r.outlet);
          onClose();
        },
      },
    );
  };

  return (
    <Modal onClose={onClose} ariaLabel="Add outlet" width={440}>
      <h2 style={{ margin: "0 0 4px", fontSize: 17 }}>Add outlet</h2>
      <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--color-text-muted)" }}>
        A new physical location for this brand — same domain, its own menu and appearance.
      </p>
      <form onSubmit={submit}>
        <Field label="Name" info="Shown to customers and staff — e.g. the neighbourhood or mall it's in.">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} required autoFocus maxLength={80} />
        </Field>
        <Field
          label="URL slug"
          info="Becomes part of this outlet's web address, e.g. yourdomain.com/preet-vihar. Lowercase letters, numbers and hyphens only."
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
        <Button type="submit" disabled={create.isPending || !name || !effectiveSlug} style={{ width: "100%", marginTop: 4 }}>
          {create.isPending ? "Creating…" : "Create outlet"}
        </Button>
        {create.error ? <Toast kind="error">{create.error.message}</Toast> : null}
      </form>
    </Modal>
  );
}
