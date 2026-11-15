import { useRef, useState } from "react";
import { Trash2, Upload, UsersRound } from "lucide-react";
import { formatWaPhone } from "@onetap/config-schema";
import * as api from "../../lib/api";
import { useAuth } from "../../lib/useAuth";
import { useMkAction, useMkList, useMkLists } from "../../lib/useMarketing";
import { Button, Card, Empty, Field, TextInput, Toast } from "../../ui";
import { MarketingGate, MarketingHeader } from "./MarketingNav";

/** Saved contact lists: numbers you imported (a CSV from an event, a WhatsApp group export…) kept for next time. */
export function Lists() {
  return (
    <MarketingGate>
      <ListsPage />
    </MarketingGate>
  );
}

function ListsPage() {
  const { can } = useAuth();
  const canSend = can("marketing:send");
  const lists = useMkLists();
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [openId, setOpenId] = useState("");
  const [note, setNote] = useState(null);
  const [error, setError] = useState("");
  const file = useRef(null);
  const create = useMkAction((o, body) => api.mkCreateList(o, body));
  const del = useMkAction((o, id) => api.mkDeleteList(o, id));

  const make = async () => {
    setError("");
    setNote(null);
    try {
      const r = await create.mutateAsync({ name, text });
      setNote(`“${r.list.name}” saved with ${r.result.added} ${r.result.added === 1 ? "person" : "people"}${r.result.duplicates ? ` (${r.result.duplicates} repeats left out)` : ""}${r.result.invalidCount ? ` — ${r.result.invalidCount} line${r.result.invalidCount === 1 ? "" : "s"} couldn't be used` : ""}.`);
      setName("");
      setText("");
      setOpenId(r.list.id);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <MarketingHeader subtitle="Numbers you've imported, kept so you can send to them again." />
      {canSend ? (
        <Card title="New list" subtitle="Paste numbers (one per line, a name is optional) or upload a CSV / text file.">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Field label="List name"><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Event guests" style={{ maxWidth: 320 }} /></Field>
            <textarea aria-label="Numbers for the new list" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={"Asha, 98765 43210\n+91 91234 56789"} style={area} />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button variant="outline" onClick={() => file.current?.click()} style={withIcon}><Upload size={14} /> Upload a file</Button>
              <input ref={file} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const body = await f.text(); setText((t) => (t.trim() ? `${t.trim()}\n${body}` : body)); }} />
              <span style={{ flex: 1 }} />
              <Button onClick={() => void make()} disabled={!name.trim() || create.isPending}>{create.isPending ? "Saving…" : "Save list"}</Button>
            </div>
            {note ? <Toast kind="ok">{note}</Toast> : null}
            {error ? <Toast kind="error">{error}</Toast> : null}
          </div>
        </Card>
      ) : null}

      <Card title="Your lists" icon={<UsersRound size={16} />}>
        {!lists.isLoading && !(lists.data?.lists ?? []).length ? <Empty title="No lists yet">Save one above and it appears here.</Empty> : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(lists.data?.lists ?? []).map((l) => (
            <div key={l.id} style={box} data-list={l.name}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 600 }}>{l.name}</div>
                  <div style={muted}>{l.count} {l.count === 1 ? "person" : "people"} · saved {new Date(l.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                </div>
                <Button variant="outline" onClick={() => setOpenId(openId === l.id ? "" : l.id)}>{openId === l.id ? "Hide" : "View"}</Button>
                {canSend ? <Button variant="outline" aria-label={`Delete ${l.name}`} onClick={() => { if (window.confirm(`Delete the list “${l.name}” and its ${l.count} numbers?`)) del.mutate(l.id); }}><Trash2 size={14} /></Button> : null}
              </div>
              {openId === l.id ? <ListBody id={l.id} canEdit={canSend} /> : null}
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function ListBody({ id, canEdit }) {
  const q = useMkList(id);
  const [more, setMore] = useState("");
  const [msg, setMsg] = useState("");
  const add = useMkAction((o, text) => api.mkAddToList(o, id, text));
  const remove = useMkAction((o, contactId) => api.mkRemoveContact(o, id, contactId));
  const contacts = q.data?.list?.contacts ?? [];
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: 10 }}>
      {canEdit ? (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <textarea aria-label="Add more numbers" rows={2} value={more} onChange={(e) => setMore(e.target.value)} placeholder={"Name, number — one per line"} style={{ ...area, width: 300, minHeight: 0 }} />
          <Button variant="outline" disabled={!more.trim() || add.isPending} onClick={async () => { const r = await add.mutateAsync(more); setMsg(`${r.added} added${r.duplicates ? `, ${r.duplicates} already there` : ""}${r.invalidCount ? `, ${r.invalidCount} unusable` : ""}.`); setMore(""); }}>Add</Button>
          {msg ? <span style={muted}>{msg}</span> : null}
        </div>
      ) : null}
      {!contacts.length && !q.isLoading ? <span style={muted}>Empty.</span> : null}
      <div style={{ display: "flex", flexDirection: "column", maxHeight: 280, overflowY: "auto" }}>
        {contacts.map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 2px", borderBottom: "1px solid var(--color-border)", fontSize: 14 }}>
            <span style={{ flex: 1 }}>{c.name || <span style={muted}>—</span>}</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatWaPhone(c.phone)}</span>
            {canEdit ? <button type="button" aria-label={`Remove ${c.name || c.phone}`} onClick={() => remove.mutate(c.id)} style={xBtn}>×</button> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

const muted = { fontSize: 13, color: "var(--color-text-muted)" };
const withIcon = { display: "inline-flex", gap: 6, alignItems: "center" };
const box = { padding: "12px 14px", border: "1px solid var(--color-border)", borderRadius: 12, background: "var(--color-bg)" };
const area = { width: "100%", boxSizing: "border-box", font: "inherit", fontSize: 14, lineHeight: 1.5, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", resize: "vertical" };
const xBtn = { border: 0, background: "transparent", cursor: "pointer", color: "var(--color-text-muted)", fontSize: 18, lineHeight: 1 };
