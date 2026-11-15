import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Ban, TriangleAlert } from "lucide-react";
import * as api from "../../lib/api";
import { useOpenStore } from "../../lib/useOutlet";
import { usePlatformMutation } from "../../lib/usePlatform";
import { Button, Modal, TextInput, Toast } from "../../ui";
import { count } from "./viz/format";
import { muted } from "./shared";

const plural = (n, one, many) => `${count(n)} ${n === 1 ? one : many}`;

/**
 * "Delete this store". It removes the store and everything it owns, for good, so
 * the dialog says exactly what will go and asks for the store's name to be typed.
 *
 * `onDisableInstead`, when given, adds a way out: a store that is only late with its payment can be switched
 * off instead — nothing is deleted and it can be turned back on.
 */
export function DeleteStoreModal({ store, onClose, onDisableInstead }) {
  const navigate = useNavigate();
  const { openStoreId, closeStore } = useOpenStore();
  const [typed, setTyped] = useState("");
  const summary = useQuery({ queryKey: ["platform", "deletion-summary", store.id], queryFn: () => api.getDeletionSummary(store.id), gcTime: 0 });
  const del = usePlatformMutation(() => api.deleteStore(store.id, typed));
  const done = del.data;
  const sure = typed.trim() === store.name;
  const n = summary.data?.counts;

  const leave = () => {
    // if this store was open in the store dashboard, step back out of it
    if (openStoreId === store.id) closeStore();
    onClose();
    navigate("/platform/stores");
  };

  return (
    <Modal onClose={del.isPending ? () => {} : done ? leave : onClose} width={520} ariaLabel={`Delete ${store.name}`}>
      <div style={{ padding: 22 }}>
        {done ? (
          <>
            <h2 style={{ margin: "0 0 8px", fontSize: 19 }}>{done.store.name} was deleted</h2>
            <p style={muted}>
              Removed {plural(done.removed.Outlet ?? 0, "outlet", "outlets")}, {plural(done.removed.MenuItem ?? 0, "menu item", "menu items")}, {plural(done.removed.Order ?? 0, "order", "orders")} and{" "}
              {plural(done.removed.Customer ?? 0, "customer", "customers")}; {plural(done.users.removed, "account", "accounts")} that belonged only to this store {done.users.removed === 1 ? "was" : "were"} deleted
              {done.users.kept ? `, and ${plural(done.users.kept, "person", "people")} who also work at another store keep their account.` : "."}
            </p>
            <p style={muted}>
              Photos that were uploaded for it are still in your storage, in the folder <code>{done.storagePrefix}</code>. Delete that folder there if you want them gone.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
              <Button onClick={leave}>Back to the stores</Button>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ margin: "0 0 6px", fontSize: 19, display: "flex", alignItems: "center", gap: 8, color: "var(--tone-danger)" }}>
              <TriangleAlert size={20} /> Delete {store.name}?
            </h2>
            <p style={{ margin: "0 0 12px" }}>
              This permanently deletes the store and <strong>everything in it</strong>. It can't be undone, and its web addresses stop working straight away.
            </p>
            {onDisableInstead ? (
              <div style={nudge}>
                <span style={{ flex: 1, minWidth: 200 }}>
                  <strong>Just late with payment?</strong> Disable the store instead. Customers can&apos;t order and its team is locked out, but nothing is deleted and you can switch it back on any time.
                </span>
                <Button variant="outline" onClick={onDisableInstead} disabled={del.isPending} style={{ display: "inline-flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                  <Ban size={14} /> Disable instead
                </Button>
              </div>
            ) : null}
            <div style={{ border: "1px solid var(--color-border)", borderRadius: 10, padding: "10px 14px", marginBottom: 12, background: "var(--color-surface)" }}>
              {!n ? (
                <span style={muted}>{summary.isError ? summary.error.message : "Counting what is in it…"}</span>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                  <li>{plural(n.outlets, "outlet", "outlets")}</li>
                  <li>{plural(n.menuItems, "menu item", "menu items")}</li>
                  <li>
                    <strong>{plural(n.orders, "order", "orders")}</strong> and their history
                  </li>
                  <li>{plural(n.customers, "customer", "customers")}</li>
                  <li>{plural(n.tables, "table", "tables")}</li>
                  <li>
                    {plural(n.people, "person", "people")} — accounts that belong only to this store are deleted; anyone who also works at another store just loses access to this one
                  </li>
                </ul>
              )}
            </div>
            <label style={{ display: "block", fontSize: 13, marginBottom: 6 }}>
              Type <strong>{store.name}</strong> to confirm
            </label>
            <TextInput value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus placeholder={store.name} aria-label="Type the store's name to confirm" />
            {del.error ? <Toast kind="error">{del.error.message}</Toast> : null}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <Button variant="outline" onClick={onClose} disabled={del.isPending}>
                Cancel
              </Button>
              <Button
                disabled={!sure || del.isPending}
                onClick={() => del.mutate()}
                style={sure ? { background: "var(--tone-danger)", border: "1px solid var(--tone-danger)", color: "#fff" } : undefined}
              >
                {del.isPending ? "Deleting…" : "Delete this store"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

const nudge = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  margin: "0 0 12px",
  padding: "10px 12px",
  borderRadius: 10,
  fontSize: 13,
  lineHeight: 1.5,
  background: "var(--tone-info-wash)",
  color: "var(--color-text)",
};
