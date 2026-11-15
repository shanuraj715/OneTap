import { useState } from "react";
import { Link } from "react-router-dom";
import { MARKETING_CHANNEL_LABELS } from "@onetap/config-schema";
import { ChevronDown, ChevronRight } from "lucide-react";
import * as api from "../../lib/api";
import { useAuth } from "../../lib/useAuth";
import { useMkAction, useMkCampaigns } from "../../lib/useMarketing";
import { useOutlet } from "../../lib/useOutlet";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Empty, Pill } from "../../ui";
import { MarketingHeader } from "./MarketingNav";

/** Every campaign sent, newest first, with how it is going. */
export function Campaigns() {
  const q = useMkCampaigns();
  const { can } = useAuth();
  const cancel = useMkAction((o, id) => api.mkCancelCampaign(o, id));
  const [open, setOpen] = useState(null);
  const list = q.data?.campaigns ?? [];
  return (
    <>
      <MarketingHeader subtitle="Everything you've sent, and how it went." />
      <Card title="Campaigns" subtitle="Newest first. Cancelling stops whatever hasn't gone out yet.">
        {!q.isLoading && !list.length ? (
          <Empty title="Nothing sent yet">Write your first message under <Link to="/marketing/new" style={{ color: "var(--color-primary)" }}>New campaign</Link>.</Empty>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map((c) => (
            <div key={c.id} style={box} data-campaign={c.name}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <button type="button" aria-label={`${open === c.id ? "Hide" : "Show"} details of ${c.name}`} onClick={() => setOpen(open === c.id ? null : c.id)} style={toggle}>
                  {open === c.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</div>
                  <div style={muted}>
                    {MARKETING_CHANNEL_LABELS[c.channel]} · {new Date(c.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} · {c.total.toLocaleString("en-IN")} {c.total === 1 ? "person" : "people"}
                  </div>
                  <div style={muted} data-figures>
                    {c.sent} sent{c.read ? ` (${c.read} read)` : ""} · {c.waiting} waiting · {c.failed} failed{c.skipped ? ` · ${c.skipped} skipped` : ""}
                  </div>
                  <div style={bar} aria-hidden="true"><span style={{ ...barFill, width: `${c.total ? Math.round(((c.sent + c.failed) / c.total) * 100) : 0}%` }} /></div>
                </div>
                <Pill tone={c.status === "done" ? "ok" : c.status === "cancelled" ? "neutral" : "info"}>{c.status === "done" ? "Done" : c.status === "cancelled" ? "Cancelled" : "Sending"}</Pill>
                {c.status === "sending" && can("marketing:send") ? <Button variant="outline" onClick={() => cancel.mutate(c.id)} disabled={cancel.isPending}>Cancel</Button> : null}
              </div>
              {open === c.id ? <Details id={c.id} summary={c} /> : null}
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function Details({ id, summary }) {
  const { outlet } = useOutlet();
  const d = useQuery({ queryKey: ["mk-campaign", outlet?._id, id], queryFn: () => api.mkCampaign(outlet, id), enabled: Boolean(outlet), refetchInterval: 5000 });
  const c = d.data?.campaign ?? summary;
  const b = c.breakdown;
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <div style={label}>{c.template ? "Template" : "Message"}</div>
        <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{c.template ? `${c.template.name} (${c.template.language})` : c.message}</div>
      </div>
      {b ? (
        <div style={muted}>
          Made up of {[b.customers && `${b.customers} customers`, b.waChats && `${b.waChats} WhatsApp chats`, b.lists && `${b.lists} from lists`, b.numbers && `${b.numbers} typed in`].filter(Boolean).join(", ") || "—"}
          {b.duplicates ? ` · ${b.duplicates} repeats merged` : ""}{b.optedOut ? ` · ${b.optedOut} said STOP` : ""}.
        </div>
      ) : null}
      {c.problems?.length ? (
        <div>
          <div style={label}>Didn't go through</div>
          {c.problems.map((p) => <div key={p.phone} style={{ fontSize: 13 }}>{p.name || p.phone} — <span style={{ color: "var(--tone-error)" }}>{p.error}</span></div>)}
        </div>
      ) : null}
    </div>
  );
}

const muted = { fontSize: 13, color: "var(--color-text-muted)" };
const label = { fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--color-text-muted)", marginBottom: 3 };
const box = { padding: "12px 14px", border: "1px solid var(--color-border)", borderRadius: 12, background: "var(--color-bg)" };
const toggle = { border: 0, background: "transparent", cursor: "pointer", color: "inherit", display: "grid", placeItems: "center", padding: 4 };
const bar = { height: 6, borderRadius: 999, background: "var(--color-border)", marginTop: 8, overflow: "hidden" };
const barFill = { display: "block", height: "100%", background: "var(--color-primary)" };
