import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { CreateOutletModal } from "../components/CreateOutletModal";
import { useAuth } from "../lib/useAuth";
import { useDeleteOutlet, useOutlets } from "../lib/useOutlet";
import { Button, Card, PageHeader, Toast } from "../ui";

/**
 * Every outlet in the current brand, with edit/delete — the management
 * surface the sidebar switcher itself deliberately doesn't try to be (it's
 * for picking one quickly, not administering them).
 */
export function Outlets() {
  const { can } = useAuth();
  const { outlet, outlets, scope } = useOutlets();
  const remove = useDeleteOutlet();
  const [modal, setModal] = useState(null); // "create" | outlet object to edit | null

  if (!can("outlet:manage")) {
    return (
      <>
        <PageHeader title="Outlets" />
        <Card>Your role can&apos;t manage outlets.</Card>
      </>
    );
  }

  // A superadmin's outlet list spans every brand — only manage the current one's.
  const siblings = outlets.filter((o) => !scope || o.brandId === outlet?.brandId);

  const askDelete = (o) => {
    if (!window.confirm(`Delete "${o.name}"? This can't be undone.`)) return;
    remove.mutate(o._id);
  };

  return (
    <>
      <PageHeader
        title="Outlets"
        subtitle="Every physical location this brand runs, and the web address each one answers to."
        action={
          <Button onClick={() => setModal("create")} style={{ display: "inline-flex", gap: 7, alignItems: "center" }}>
            <Plus size={15} /> Add outlet
          </Button>
        }
      />

      <Card title={`Outlets — ${siblings.length}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {siblings.map((o) => (
            <div key={o._id} style={row}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                  {o.name}
                  {o._id === outlet?._id ? <span style={currentChip}>current</span> : null}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", fontFamily: "ui-monospace, monospace" }}>
                  /{o.slug}
                </div>
              </div>
              <button type="button" style={iconBtn} title="Edit" onClick={() => setModal(o)}>
                <Pencil size={13} />
              </button>
              <button
                type="button"
                style={iconBtn}
                title={siblings.length <= 1 ? "A brand needs at least one outlet" : "Delete"}
                disabled={siblings.length <= 1}
                onClick={() => askDelete(o)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        {remove.error ? <Toast kind="error">{remove.error.message}</Toast> : null}
      </Card>

      {modal === "create" ? (
        <CreateOutletModal brandId={outlet?.brandId} onClose={() => setModal(null)} />
      ) : modal ? (
        <CreateOutletModal outlet={modal} onClose={() => setModal(null)} />
      ) : null}
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
const iconBtn = {
  font: "inherit",
  fontSize: 14,
  width: 28,
  height: 28,
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  background: "var(--color-bg)",
  color: "var(--color-text-muted)",
  cursor: "pointer",
  flexShrink: 0,
  display: "grid",
  placeItems: "center",
};
const currentChip = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  padding: "2px 6px",
  borderRadius: 4,
};
