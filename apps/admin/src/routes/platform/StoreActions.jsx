import { useId, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Ban, EllipsisVertical, ExternalLink, Power, Store, Trash2, TriangleAlert } from "lucide-react";
import * as api from "../../lib/api";
import { useMedia } from "../../lib/useMedia";
import { useOpenStore } from "../../lib/useOutlet";
import { usePlatformMutation } from "../../lib/usePlatform";
import { Button, Menu, Modal, Toast } from "../../ui";
import { DeleteStoreModal } from "./DeleteStoreModal";
import { fmtDate, muted } from "./shared";
import { count } from "./viz/format";

/**
 * What you can do to a store from the console: the "⋮" menu on a store, and the dialogs it opens.
 *
 *   <StoreActionsMenu store={s} onChoose={(kind) => setDialog({ kind, store: s })} />
 *   <StoreDialogs dialog={dialog} setDialog={setDialog} />
 *
 * The page owns the dialog (not each row), so a confirmation such as "was deleted" stays on screen even after
 * the row it came from has disappeared from the list.
 */

const plural = (n, one, many) => `${count(n)} ${n === 1 ? one : many}`;
export const MESSAGE_MAX = 500;

/* ------------------------------------------------------------------- menu */

/** The "⋮" button and its popup of choices. Opening the dashboard and the details page happen here; the rest ask the page to open a dialog. */
export function StoreActionsMenu({ store, onChoose, exclude = [] }) {
  const navigate = useNavigate();
  const { openStore } = useOpenStore();
  // a bigger target on a phone, where it's tapped rather than clicked
  const narrow = useMedia("(max-width: 767px)");

  const options = [
    { value: "open", label: "Open store dashboard", description: "See it the way its team does", icon: <ExternalLink size={14} /> },
    { value: "details", label: "View details", description: "Plan, owners, outlets, domains", icon: <Store size={14} /> },
    store.disabled
      ? { value: "enable", label: "Enable store", description: "Let customers order and the team sign in again", icon: <Power size={14} /> }
      : { value: "disable", label: "Disable store", description: "Pause it, for example for a late payment. Nothing is deleted.", icon: <Ban size={14} /> },
    { value: "delete", label: "Delete store", description: "Remove it and everything in it, for good", icon: <Trash2 size={14} />, danger: true },
  ].filter((o) => !exclude.includes(o.value));

  const choose = (value) => {
    if (value === "open") {
      openStore(store.id);
      navigate("/");
    } else if (value === "details") {
      navigate(`/platform/stores/${store.id}`);
    } else {
      onChoose(value);
    }
  };

  return (
    <Menu
      options={options}
      onSelect={choose}
      width={296}
      align="right"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          style={narrow ? { ...kebab, width: 40, height: 40 } : kebab}
          aria-label={`Actions for ${store.name}`}
          aria-haspopup="menu"
          aria-expanded={open}
          title="More actions"
        >
          <EllipsisVertical size={16} />
        </button>
      )}
    />
  );
}

/** The dialog the page should be showing: `{ kind, store }` or null. */
export function StoreDialogs({ dialog, setDialog }) {
  if (!dialog) return null;
  const { kind, store } = dialog;
  const close = () => setDialog(null);
  if (kind === "disable" || kind === "message") return <DisableStoreModal store={store} editing={kind === "message"} onClose={close} />;
  if (kind === "enable") return <EnableStoreModal store={store} onClose={close} />;
  if (kind === "delete") return <DeleteStoreModal store={store} onClose={close} onDisableInstead={store.disabled ? undefined : () => setDialog({ kind: "disable", store })} />;
  return null;
}

/* ---------------------------------------------------------- shared helpers */

/** Put a store's new state on screen at once, in the list and on its own page — don't make the console wait for a refetch. */
function useShowStore() {
  const qc = useQueryClient();
  return (updated) => {
    qc.setQueryData(["platform", "store", updated.id], { store: updated });
    qc.setQueryData(["platform", "stores"], (old) => old && { ...old, stores: old.stores.map((s) => (s.id === updated.id ? { ...s, disabled: updated.disabled } : s)) });
  };
}

/* ---------------------------------------------------------------- disable */

/**
 * "Disable this store". Customers can't order and the team can't use the dashboard, but nothing is deleted. The
 * dialog says exactly what that means for this store and takes an optional message for its team.
 * `editing` = the store is already disabled and only the message is being changed.
 */
export function DisableStoreModal({ store, editing = false, onClose }) {
  const messageId = useId();
  const [message, setMessage] = useState(store.disabled?.message ?? "");
  const summary = useQuery({ queryKey: ["platform", "disable-summary", store.id], queryFn: () => api.getDisableSummary(store.id), gcTime: 0, enabled: !editing });
  const show = useShowStore();
  const save = usePlatformMutation(() => api.disableStore(store.id, message.trim()));
  const n = summary.data?.counts;
  const busy = save.isPending;

  const submit = (e) => {
    e.preventDefault();
    save.mutate(undefined, {
      onSuccess: (result) => {
        show(result.store);
        onClose();
      },
    });
  };

  return (
    <Modal onClose={busy ? () => {} : onClose} width={540} ariaLabel={editing ? `Message for ${store.name}'s team` : `Disable ${store.name}`}>
      <form onSubmit={submit} style={{ padding: 22, overflowY: "auto" }}>
        <h2 style={heading}>
          <Ban size={20} style={{ flexShrink: 0 }} /> {editing ? `Message for ${store.name}'s team` : `Disable ${store.name}?`}
        </h2>

        {editing ? (
          <p style={{ margin: "0 0 14px" }}>
            {store.name} has been disabled since {fmtDate(store.disabled?.at)}. This is what its team sees when they sign in.
          </p>
        ) : (
          <>
            <p style={{ margin: "0 0 12px" }}>
              This switches the whole store off — for example while a payment is overdue. <strong>Nothing is deleted</strong>, and you can switch it back on whenever you like.
            </p>
            <ul style={effects} aria-label="What happens">
              <li>
                Customers see “temporarily unavailable” and can&apos;t order{n ? ` — at ${plural(n.outlets, "outlet", "outlets")}` : ""}.
              </li>
              <li>
                Its team{n ? ` (${plural(n.people, "person", "people")})` : ""} can&apos;t use the dashboard — they see your message instead.
              </li>
              {n && n.ordersInProgress > 0 ? (
                <li style={{ color: "var(--tone-warning)", fontWeight: 600 }}>
                  <TriangleAlert size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} aria-hidden="true" />
                  {plural(n.ordersInProgress, "order is", "orders are")} still in progress. Staff won&apos;t be able to update {n.ordersInProgress === 1 ? "it" : "them"} while the store is off.
                </li>
              ) : null}
              <li>Your own access doesn&apos;t change — you can still open the store from this console.</li>
            </ul>
            {summary.isError ? <p style={{ ...muted, margin: "0 0 10px" }}>Couldn&apos;t count what it affects ({summary.error.message}). You can still continue.</p> : null}
          </>
        )}

        <label htmlFor={messageId} style={label}>
          Message for the team <span style={{ fontWeight: 400, color: "var(--color-text-muted)" }}>(optional)</span>
        </label>
        <textarea
          id={messageId}
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
          rows={3}
          maxLength={MESSAGE_MAX}
          autoFocus={editing}
          placeholder="e.g. Your subscription payment is pending. Please call us on 98765 43210 to switch your store back on."
          style={textarea}
        />
        <div style={{ ...muted, display: "flex", justifyContent: "space-between", gap: 12, marginTop: 5 }}>
          <span>They see this when they sign in. Leave it empty to show a standard notice.</span>
          <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            {message.length}/{MESSAGE_MAX}
          </span>
        </div>

        {save.error ? <Toast kind="error">{save.error.message}</Toast> : null}
        <div style={footer}>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          {/* the standard (brand red) button: it keeps its white-on-red contrast in both themes */}
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save message" : "Disable store"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ----------------------------------------------------------------- enable */

/** "Enable this store" — customers can order again and the team can sign in, everything exactly as it was. */
export function EnableStoreModal({ store, onClose }) {
  const show = useShowStore();
  const save = usePlatformMutation(() => api.enableStore(store.id));
  const busy = save.isPending;

  return (
    <Modal onClose={busy ? () => {} : onClose} width={480} ariaLabel={`Enable ${store.name}`}>
      <div style={{ padding: 22 }}>
        <h2 style={{ ...heading, color: "var(--color-text)" }}>
          <Power size={20} style={{ flexShrink: 0 }} /> Enable {store.name}?
        </h2>
        <p style={{ margin: "0 0 6px" }}>
          Customers will be able to order again, and its team can sign in and use the dashboard — everything exactly as it was
          {store.disabled?.at ? ` before it was disabled on ${fmtDate(store.disabled.at)}` : ""}.
        </p>
        {save.error ? <Toast kind="error">{save.error.message}</Toast> : null}
        <div style={footer}>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              save.mutate(undefined, {
                onSuccess: (result) => {
                  show(result.store);
                  onClose();
                },
              })
            }
          >
            {busy ? "Enabling…" : "Enable store"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------------- styles */

const kebab = {
  font: "inherit",
  display: "grid",
  placeItems: "center",
  width: 34,
  height: 34,
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
  flexShrink: 0,
};
const heading = { margin: "0 0 10px", fontSize: 19, display: "flex", alignItems: "center", gap: 9, color: "var(--tone-danger)", textWrap: "balance" };
const effects = { margin: "0 0 14px", padding: "10px 14px 10px 30px", lineHeight: 1.65, border: "1px solid var(--color-border)", borderRadius: 10, background: "var(--color-surface)", fontSize: 13.5 };
const label = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 };
const textarea = {
  font: "inherit",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  resize: "vertical",
  minHeight: 76,
  maxHeight: 220,
};
const footer = { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16, flexWrap: "wrap" };
