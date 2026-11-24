import { useState } from "react";
import { LEAD_STATUSES } from "@rasoipulse/config-schema";
import { Inbox, Mail, MessageCircle, Phone } from "lucide-react";
import * as api from "../../lib/api";
import { useLeads, usePlatformMutation } from "../../lib/usePlatform";
import { Button, Card, PageHeader, Pill, Toast } from "../../ui";
import { muted, row } from "./shared";

const LABELS = { new: "New", contacted: "Contacted", won: "Won", lost: "Lost" };
const TONES = { new: "warn", contacted: "neutral", won: "ok", lost: "neutral" };

const ago = (d) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(d).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
};

/** Enquiries from the website's contact form — who to call, and where each one stands. */
export function PlatformLeads() {
  const [status, setStatus] = useState("");
  const q = useLeads(status || undefined);
  const [openId, setOpenId] = useState(null);
  const counts = q.data?.counts ?? {};
  const total = LEAD_STATUSES.reduce((n, s) => n + (counts[s] ?? 0), 0);
  const leads = q.data?.leads ?? [];

  return (
    <>
      <PageHeader title="Leads" icon={<Inbox size={23} />} subtitle="Restaurants that asked to talk to you on the website. Nobody buys online — every lead is a call to make." />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {[["", "All", total], ...LEAD_STATUSES.map((s) => [s, LABELS[s], counts[s] ?? 0])].map(([s, label, n]) => (
          <button key={s || "all"} type="button" onClick={() => setStatus(s)} style={{ ...filter, ...(status === s ? filterOn : {}) }} aria-pressed={status === s}>
            {label} <span style={{ opacity: 0.75, fontVariantNumeric: "tabular-nums" }}>{n}</span>
          </button>
        ))}
      </div>

      <Card>
        {q.isLoading ? (
          <p style={muted}>Loading…</p>
        ) : leads.length === 0 ? (
          <p style={muted}>{status ? `No ${LABELS[status].toLowerCase()} leads.` : "No enquiries yet. They'll appear here the moment someone sends the Contact form."}</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {leads.map((l) => (
              <Lead key={l.id} lead={l} open={openId === l.id} onToggle={() => setOpenId(openId === l.id ? null : l.id)} />
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function Lead({ lead: l, open, onToggle }) {
  const [note, setNote] = useState("");
  const update = usePlatformMutation((body) => api.updateLead(l.id, body));
  const digits = l.phone.replace(/\D/g, "");
  const wa = digits.length === 10 ? `91${digits}` : digits;

  return (
    <div style={{ ...row, flexDirection: "column", alignItems: "stretch", gap: 0, padding: 0 }}>
      <button type="button" onClick={onToggle} aria-expanded={open} style={head}>
        <span style={{ flex: 1, minWidth: 180, textAlign: "left" }}>
          <span style={{ display: "block", fontWeight: 650, fontSize: 14.5 }}>
            {l.name}
            {l.businessName ? <span style={{ ...muted, fontWeight: 500 }}> · {l.businessName}</span> : null}
          </span>
          <span style={{ ...muted, display: "block" }}>
            {[l.city, l.outlets ? `${l.outlets} outlet${l.outlets === "1" ? "" : "s"}` : "", l.plan ? `asked about ${l.plan}` : ""].filter(Boolean).join(" · ") || l.phone}
          </span>
        </span>
        <span style={{ ...muted, fontSize: 12.5, whiteSpace: "nowrap" }}>{ago(l.createdAt)}</span>
        <Pill tone={TONES[l.status]}>{LABELS[l.status]}</Pill>
      </button>

      {open ? (
        <div style={{ padding: "4px 14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a href={`tel:${digits}`} style={action}>
              <Phone size={14} /> Call {l.phone}
            </a>
            {wa ? (
              <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" style={action}>
                <MessageCircle size={14} /> WhatsApp
              </a>
            ) : null}
            {l.email ? (
              <a href={`mailto:${l.email}`} style={action}>
                <Mail size={14} /> {l.email}
              </a>
            ) : null}
          </div>

          {l.message ? <blockquote style={quote}>{l.message}</blockquote> : null}

          <dl style={facts}>
            <Fact k="Came from" v={l.sourcePage || "—"} />
            {l.utm?.source || l.utm?.campaign ? <Fact k="Campaign" v={[l.utm.source, l.utm.medium, l.utm.campaign].filter(Boolean).join(" / ")} /> : null}
            <Fact k="Received" v={new Date(l.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} />
          </dl>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ ...muted, marginRight: 4 }}>Mark as</span>
            {LEAD_STATUSES.map((s) => (
              <button key={s} type="button" disabled={update.isPending || s === l.status} onClick={() => update.mutate({ status: s })} style={{ ...filter, ...(s === l.status ? filterOn : {}) }}>
                {LABELS[s]}
              </button>
            ))}
          </div>

          <div>
            {l.notes.length ? (
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 10px", display: "flex", flexDirection: "column", gap: 8 }}>
                {l.notes.map((n, i) => (
                  <li key={i} style={noteRow}>
                    <span>{n.text}</span>
                    <span style={{ ...muted, fontSize: 12 }}>
                      {n.by ? `${n.by} · ` : ""}
                      {ago(n.at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (note.trim()) update.mutate({ note }, { onSuccess: () => setNote("") });
              }}
              style={{ display: "flex", gap: 8 }}
            >
              <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 2000))} placeholder="Add a note — e.g. called, demo on Friday" style={noteInput} aria-label="Add a note" />
              <Button type="submit" variant="outline" disabled={!note.trim() || update.isPending}>
                Add note
              </Button>
            </form>
          </div>
          {update.error ? <Toast kind="error">{update.error.message}</Toast> : null}
        </div>
      ) : null}
    </div>
  );
}

const Fact = ({ k, v }) => (
  <div style={{ display: "contents" }}>
    <dt style={{ ...muted }}>{k}</dt>
    <dd style={{ margin: 0, fontSize: 13.5 }}>{v}</dd>
  </div>
);

const head = { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 14px", border: "none", background: "transparent", color: "inherit", font: "inherit", cursor: "pointer", width: "100%" };
const filter = { font: "inherit", fontSize: 13, fontWeight: 600, padding: "6px 12px", borderRadius: 999, borderWidth: 1, borderStyle: "solid", borderColor: "var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", cursor: "pointer" };
const filterOn = { background: "var(--color-text)", borderColor: "var(--color-text)", color: "var(--color-bg)" };
const action = { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: "1px solid var(--color-border)", textDecoration: "none", color: "var(--color-text)", fontSize: 13, fontWeight: 600 };
const quote = { margin: 0, padding: "10px 14px", borderLeft: "3px solid var(--color-border)", background: "var(--color-surface)", borderRadius: 6, fontSize: 14, whiteSpace: "pre-wrap" };
const facts = { display: "grid", gridTemplateColumns: "120px 1fr", gap: "6px 12px", margin: 0 };
const noteRow = { display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 10px", borderRadius: 8, background: "var(--color-surface)", fontSize: 13.5 };
const noteInput = { flex: 1, font: "inherit", fontSize: 13.5, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)" };
