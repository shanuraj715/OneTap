import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ROLE_LABELS, WA_ACCESS_LABELS, WA_ACCESS_LEVELS, WA_DELEGABLE_ROLES } from "@onetap/config-schema";
import * as api from "../../lib/api";
import { useOutlet } from "../../lib/useOutlet";
import { useWaAction } from "../../lib/useWhatsApp";
import { Button, Card, Select, Toast } from "../../ui";
import { WaHeader } from "./WaNav";

/** Which of the store's roles may read or answer WhatsApp chats (owner only). Nobody but the owner by default. */
export function WhatsAppAccess() {
  const { outlet } = useOutlet();
  const q = useQuery({ queryKey: ["wa-access", outlet?._id], queryFn: () => api.waGetAccess(outlet), enabled: Boolean(outlet) });
  const [draft, setDraft] = useState(null);
  useEffect(() => {
    if (q.data?.access) setDraft(q.data.access);
  }, [q.data]);
  const save = useWaAction((o, access) => api.waSetAccess(o, access));
  const dirty = draft && q.data && JSON.stringify(draft) !== JSON.stringify(q.data.access);

  return (
    <>
      <WaHeader subtitle="Choose who on your team can read and answer WhatsApp chats." />
      <Card title="Who can use WhatsApp chat" subtitle="You, the owner, can always do everything: link numbers, send broadcasts and change this. TablePe's own support staff can read chats.">
        {!draft ? <p style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Loading…</p> : null}
        {draft ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {WA_DELEGABLE_ROLES.map((role) => (
              <label key={role} style={row}>
                <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{ROLE_LABELS[role]}</span>
                <Select value={draft[role]} onChange={(e) => setDraft({ ...draft, [role]: e.target.value })} aria-label={`${ROLE_LABELS[role]} access`} style={{ maxWidth: 220 }}>
                  {WA_ACCESS_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {WA_ACCESS_LABELS[l]}
                    </option>
                  ))}
                </Select>
              </label>
            ))}
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
          <Button onClick={() => save.mutate(draft)} disabled={!dirty || save.isPending}>
            {save.isPending ? "Saving…" : "Save access"}
          </Button>
          {save.isSuccess && !dirty ? <Toast kind="ok">Saved.</Toast> : null}
          {save.error ? <Toast kind="error">{save.error.message}</Toast> : null}
        </div>
        <p style={{ fontSize: 12.5, color: "var(--color-text-muted)", margin: "12px 0 0" }}>
          “Read chats” can see every conversation but not reply. “Read and reply” can also start chats, send files, switch a chat&apos;s number, clear and delete chats. Linking numbers and broadcasts
          stay with you.
        </p>
      </Card>
    </>
  );
}

const row = { display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", border: "1px solid var(--color-border)", borderRadius: 10, background: "var(--color-bg)" };
