import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../lib/api";
import { Button, Card, Field, PageHeader, TextInput, Toast } from "../ui";

function slugify(s) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const EMPTY = {
  brandName: "",
  brandSlug: "",
  outletName: "",
  outletSlug: "",
  hostnames: "",
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
};

/**
 * Onboard a brand-new restaurant onto the platform: the Brand, its first
 * Outlet, and an owner account to sign into it with — all in one step.
 * Superadmin-only (see App.jsx's route gating); everything past this point
 * (theme, menu, staff, more outlets) is the new owner's own to shape.
 */
export function Brands() {
  const qc = useQueryClient();
  const brandsQuery = useQuery({ queryKey: ["brands"], queryFn: api.listBrands });
  const create = useMutation({
    mutationFn: api.createBrand,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["brands"] }),
  });

  const [form, setForm] = useState(EMPTY);
  const [brandSlugTouched, setBrandSlugTouched] = useState(false);
  const [outletSlugTouched, setOutletSlugTouched] = useState(false);

  const brandSlug = brandSlugTouched ? form.brandSlug : slugify(form.brandName);
  const outletSlug = outletSlugTouched ? form.outletSlug : slugify(form.outletName);

  const submit = (e) => {
    e.preventDefault();
    create.mutate(
      {
        brandName: form.brandName,
        brandSlug,
        outletName: form.outletName,
        outletSlug,
        hostnames: form.hostnames.split(",").map((h) => h.trim()).filter(Boolean),
        ownerName: form.ownerName,
        ownerEmail: form.ownerEmail,
        ownerPassword: form.ownerPassword,
      },
      {
        onSuccess: () => {
          setForm(EMPTY);
          setBrandSlugTouched(false);
          setOutletSlugTouched(false);
        },
      },
    );
  };

  const brands = brandsQuery.data?.brands ?? [];

  return (
    <>
      <PageHeader title="Brands" subtitle="Every tenant on the platform, and where a new one gets onboarded." />

      <Card title={`Brands — ${brands.length}`}>
        {brandsQuery.isLoading ? (
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>Loading…</p>
        ) : brands.length === 0 ? (
          <p style={{ margin: 0, color: "var(--color-text-muted)" }}>No brands yet — add the first one below.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {brands.map((b) => (
              <div key={b._id} style={row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{b.name}</div>
                  <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
                    {b.slug} · {b.ownerEmail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Add a brand">
        <form onSubmit={submit}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <Field label="Brand name" info="The restaurant's name across every location it runs.">
              <TextInput value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} required maxLength={80} />
            </Field>
            <Field label="Brand slug" info="A short identifier for this brand, used internally.">
              <TextInput
                value={brandSlug}
                onChange={(e) => {
                  setBrandSlugTouched(true);
                  setForm({ ...form, brandSlug: slugify(e.target.value) });
                }}
                required
                maxLength={63}
              />
            </Field>
            <Field label="First outlet's name" info="Its first physical location — e.g. the neighbourhood or mall it's in.">
              <TextInput value={form.outletName} onChange={(e) => setForm({ ...form, outletName: e.target.value })} required maxLength={80} />
            </Field>
            <Field label="Outlet URL slug" info="Becomes part of the outlet's web address, e.g. yourdomain.com/laxmi-nagar.">
              <TextInput
                value={outletSlug}
                onChange={(e) => {
                  setOutletSlugTouched(true);
                  setForm({ ...form, outletSlug: slugify(e.target.value) });
                }}
                required
                maxLength={63}
              />
            </Field>
            <Field label="Domain(s)" style={{ gridColumn: "1 / -1" }} info="Comma-separated — the hostname(s) the storefront resolves this brand from, e.g. yourdomain.com. Every outlet added later shares these.">
              <TextInput value={form.hostnames} onChange={(e) => setForm({ ...form, hostnames: e.target.value })} required placeholder="yourdomain.com" />
            </Field>
            <Field label="Owner name">
              <TextInput value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} required />
            </Field>
            <Field label="Owner email" info="Their sign-in for the admin — has full access to this brand.">
              <TextInput type="email" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} required />
            </Field>
            <Field label="Owner password" hint="At least 8 characters" info="Their first password — share it with them directly and ask them to change it.">
              <TextInput
                type="password"
                value={form.ownerPassword}
                onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })}
                required
                minLength={8}
              />
            </Field>
          </div>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create brand"}
          </Button>
          {create.error ? <Toast kind="error">{create.error.message}</Toast> : null}
        </form>
      </Card>
    </>
  );
}

const row = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  background: "var(--color-bg)",
};
