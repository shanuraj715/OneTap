import { DoorOpen } from "lucide-react";
import { useCloseSession } from "../../lib/useTables";
import { disabledLook, ghostBtn, muted } from "./styles";

/**
 * Shown at the top of the menu — on a phone too, before anything has been added — when the party at the table has
 * finished (everything served and paid): "New guests at this table?" with the button that frees it. (The same button also
 * sits in the order panel, which on a phone is only reached after an item is added.)
 */
export function PartyDoneBanner({ outlet, session, onFreed }) {
  const freeTable = useCloseSession(outlet);
  return (
    <div style={box} data-testid="party-done-banner">
      <div style={{ minWidth: 0, flex: "1 1 200px" }}>
        <strong style={{ fontSize: 14.5 }}>New guests at this table?</strong>
        <div style={{ ...muted, fontSize: 12.5, marginTop: 2 }}>{session.customerName || "The last party"}&apos;s meal is done and paid.</div>
        {freeTable.error ? <div style={{ color: "var(--tone-danger)", fontSize: 12.5, fontWeight: 600, marginTop: 4 }}>{freeTable.error.message}</div> : null}
      </div>
      <button
        type="button"
        data-testid="free-table-front"
        onClick={() => freeTable.mutate(session.id, { onSuccess: () => onFreed?.() })}
        disabled={freeTable.isPending}
        style={{ ...ghostBtn, minHeight: 46, fontSize: 14.5, flex: "0 0 auto", ...(freeTable.isPending ? disabledLook : {}) }}
      >
        <DoorOpen size={17} /> {freeTable.isPending ? "Freeing…" : "Free table for new guests"}
      </button>
    </div>
  );
}

const box = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  margin: "12px 16px 0",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid color-mix(in srgb, var(--tone-success) 35%, transparent)",
  background: "var(--tone-success-wash)",
};
