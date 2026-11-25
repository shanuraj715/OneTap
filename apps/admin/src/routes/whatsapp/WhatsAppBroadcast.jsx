import { useRef, useState } from "react";
import { WA_MAX_MEDIA_BYTES, WA_OPT_OUT_FOOTER, WA_PACING } from "@rasoipulse/config-schema";
import { ImagePlus, Megaphone, X } from "lucide-react";
import * as api from "../../lib/api";
import { useOutlet } from "../../lib/useOutlet";
import { useWaAction, useWaBroadcasts } from "../../lib/useWhatsApp";
import { Button, Card, Modal, Pill, Toast } from "../../ui";
import { WaHeader } from "./WaNav";

/**
 * Offers and announcements to the store's customers (owner only). Everyone who ordered with a phone number gets
 * it, except people who replied STOP. Someone with a chat hears from that chat's number; new people are spread
 * across the numbers that are online. First contacts are paced, so a long list takes days — the page says so.
 */
export function WhatsAppBroadcast() {
  const { outlet } = useOutlet();
  const q = useWaBroadcasts();
  const p = q.data?.preview;
  const list = q.data?.broadcasts ?? [];
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const input = useRef(null);
  const create = useWaAction((o, body) => api.waCreateBroadcast(o, body));
  const cancel = useWaAction((o, id) => api.waCancelBroadcast(o, id));

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      const media = file ? (await api.waUpload(outlet, file)).media : null;
      await create.mutateAsync({ text, media });
      setText("");
      setFile(null);
      setDone(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <>
      <WaHeader subtitle="Send an offer or an announcement to your customers on WhatsApp." />
      <Card title="New broadcast" subtitle="Goes to every customer who ordered with a phone number, except those who replied STOP.">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} maxLength={3000} placeholder="e.g. Diwali special: 20% off every plate this weekend. Order at gazab.in" aria-label="Broadcast message" style={area} />
        <p style={{ ...muted, margin: "6px 0 12px" }}>
          “{WA_OPT_OUT_FOOTER}” is added at the end of every message. {text.length}/3000
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {file ? (
            <span style={chip}>
              {file.name} <button type="button" onClick={() => setFile(null)} aria-label="Remove the picture" style={chipX}><X size={13} /></button>
            </span>
          ) : (
            <Button variant="outline" onClick={() => input.current?.click()} style={withIcon}>
              <ImagePlus size={14} /> Add a picture
            </Button>
          )}
          <input
            ref={input}
            type="file"
            accept="image/*,video/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f && f.size > WA_MAX_MEDIA_BYTES) return setError("Files can be up to 16 MB.");
              setFile(f ?? null);
            }}
          />
          <span style={{ flex: 1 }} />
          <Button onClick={() => setConfirming(true)} disabled={!text.trim() || busy || !p?.recipients} style={withIcon}>
            <Megaphone size={14} /> Review and send
          </Button>
        </div>
        {p ? (
          <p style={{ ...muted, margin: "12px 0 0" }}>
            {p.recipients} {p.recipients === 1 ? "customer" : "customers"} will get it{p.optedOut ? ` (${p.optedOut} said STOP and are skipped)` : ""}.
            {p.firstContact
              ? ` ${p.firstContact} of them have never written to you, so they get it slowly${p.estimatedDays ? ` — about ${p.estimatedDays} ${p.estimatedDays === 1 ? "day" : "days"} with ${p.numbersOnline.length} ${p.numbersOnline.length === 1 ? "number" : "numbers"} online` : " once a number is online"}.`
              : ""}
          </p>
        ) : null}
        {error ? <Toast kind="error">{error}</Toast> : null}
        {done && !error ? <Toast kind="ok">Queued. Progress shows below.</Toast> : null}
      </Card>

      <Card title="Broadcasts" subtitle="Newest first. Cancelling stops whatever hasn't gone out yet.">
        {list.length === 0 ? <p style={muted}>None yet.</p> : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {list.map((b) => (
            <div key={b.id} style={rowBox}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 14, whiteSpace: "pre-wrap", maxHeight: 64, overflow: "hidden" }}>{b.text.replace(`\n\n${WA_OPT_OUT_FOOTER}`, "")}</div>
                <div style={{ ...muted, marginTop: 6 }}>
                  {new Date(b.createdAt).toLocaleString()} · {b.sent} sent{b.read ? ` (${b.read} read)` : ""} · {b.waiting} waiting · {b.failed} failed
                  {b.skipped ? ` · ${b.skipped} skipped` : ""}
                </div>
                <div style={bar} aria-hidden="true">
                  <span style={{ ...barFill, width: `${b.total ? Math.round(((b.sent + b.failed) / b.total) * 100) : 0}%` }} />
                </div>
              </div>
              <Pill tone={b.status === "done" ? "ok" : b.status === "cancelled" ? "neutral" : "info"}>{b.status === "done" ? "Done" : b.status === "cancelled" ? "Cancelled" : "Sending"}</Pill>
              {b.status === "sending" ? (
                <Button variant="outline" onClick={() => cancel.mutate(b.id)} disabled={cancel.isPending}>
                  Cancel
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      {confirming ? (
        <Modal onClose={() => setConfirming(false)} width={460} ariaLabel="Send broadcast">
          <div style={{ padding: 22 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 19 }}>Send to {p.recipients} customers?</h2>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
              People you already chat with get it within minutes. The {p.firstContact} who never wrote to you get it at {WA_PACING.cold.perDay} a day per number, between {WA_PACING.cold.quietTo} am and{" "}
              {WA_PACING.cold.quietFrom % 12} pm. Personal numbers can be banned if many people report a message as spam — send things your customers will want.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <Button variant="outline" onClick={() => setConfirming(false)}>
                Not now
              </Button>
              <Button onClick={() => void send()} disabled={busy}>
                {busy ? "Queuing…" : "Send"}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

const muted = { fontSize: 13, color: "var(--color-text-muted)" };
const withIcon = { display: "inline-flex", gap: 6, alignItems: "center" };
const area = { width: "100%", boxSizing: "border-box", font: "inherit", fontSize: 14, lineHeight: 1.5, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", resize: "vertical" };
const chip = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, padding: "5px 6px 5px 12px", borderRadius: 999, border: "1px solid var(--color-border)" };
const chipX = { border: 0, background: "transparent", cursor: "pointer", color: "inherit", display: "grid", placeItems: "center" };
const rowBox = { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 14px", border: "1px solid var(--color-border)", borderRadius: 12, background: "var(--color-bg)" };
const bar = { height: 6, borderRadius: 999, background: "var(--color-border)", marginTop: 8, overflow: "hidden" };
const barFill = { display: "block", height: "100%", background: "var(--color-primary)" };
