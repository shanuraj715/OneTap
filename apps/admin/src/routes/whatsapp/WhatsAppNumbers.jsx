import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { formatWaPhone, WA_NUMBER_COLORS, WA_PACING, waTextOn } from "@onetap/config-schema";
import { ArrowRight, Link2, Pencil, Plus, RefreshCw, Shuffle, Smartphone, Trash2, Unlink } from "lucide-react";
import { useOutlet } from "../../lib/useOutlet";
import { NumberChip, WaConfirm } from "./WaConfirm";
import * as api from "../../lib/api";
import { useWaAccounts, useWaAction } from "../../lib/useWhatsApp";
import { Button, Card, Modal, Pill, Select, TextInput, Toast } from "../../ui";
import { WaHeader } from "./WaNav";

const STATUS = {
  pending: { tone: "info", label: "Waiting for the scan" },
  connected: { tone: "ok", label: "Connected" },
  disconnected: { tone: "warn", label: "Offline" },
  logged_out: { tone: "neutral", label: "Unlinked" },
  expired: { tone: "neutral", label: "QR expired" },
};

/**
 * The store's linked WhatsApp numbers (owner only). Linking works like WhatsApp Web: give the number a name, scan
 * the code with WhatsApp → Linked devices on that phone, done. Several numbers share the load: a customer always
 * hears from the number they wrote to, new contacts are spread across the numbers that are online.
 */
export function WhatsAppNumbers() {
  const [linking, setLinking] = useState(null); // account id being linked
  const [linkLabel, setLinkLabel] = useState(""); // its name, before the list has refreshed
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const q = useWaAccounts({ fast: Boolean(linking) });
  const accounts = q.data?.accounts ?? [];
  const relink = useWaAction((o, id) => api.waRelinkAccount(o, id));
  const unlink = useWaAction((o, id) => api.waUnlinkAccount(o, id));
  const remove = useWaAction((o, id) => api.waRemoveAccount(o, id));
  const [sharing, setSharing] = useState(false);

  return (
    <>
      <WaHeader subtitle="Link the store's WhatsApp numbers. Customers keep hearing from the number they wrote to." />
      <Card
        title={`${accounts.length} ${accounts.length === 1 ? "number" : "numbers"}`}
        subtitle="Each number is linked like WhatsApp Web — the phone keeps working as usual."
        action={
          <Button onClick={() => setAdding(true)} style={withIcon} disabled={accounts.length >= 10}>
            <Plus size={14} /> Link a number
          </Button>
        }
      >
        {q.isLoading ? <p style={muted}>Loading…</p> : null}
        {q.isSuccess && accounts.length === 0 ? <p style={muted}>No numbers yet. Link the phone your customers already message — or a second one to share the load.</p> : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {accounts.map((a) => {
            const st = STATUS[a.status] ?? STATUS.disconnected;
            return (
              <div key={a.id} style={rowBox}>
                <span style={{ ...icon, background: a.color, color: waTextOn(a.color) }}>
                  <Smartphone size={18} />
                </span>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 15 }}>{a.label}</strong>
                    <Pill tone={st.tone}>{st.label}</Pill>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--color-text-muted)", marginTop: 3 }}>
                    {a.phone ? formatWaPhone(a.phone) : "Not linked yet"}
                    {a.pushName ? ` · ${a.pushName}` : ""}
                    {a.status === "connected" || a.status === "disconnected"
                      ? ` · today: ${a.newToday}/${a.newPerDay} new contacts, ${a.ordersToday}/${a.ordersPerDay} first order updates`
                      : ""}
                  </div>
                  {a.lastError && a.status !== "connected" ? <div style={{ fontSize: 12.5, color: "var(--tone-warning)", marginTop: 3 }}>{a.lastError}</div> : null}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {a.status === "pending" ? (
                    <Button variant="outline" onClick={() => setLinking(a.id)} style={withIcon}>
                      <Link2 size={13} /> Show the QR
                    </Button>
                  ) : null}
                  {a.status === "logged_out" || a.status === "expired" ? (
                    <Button variant="outline" onClick={() => relink.mutate(a.id, { onSuccess: () => setLinking(a.id) })} style={withIcon}>
                      <RefreshCw size={13} /> Link again
                    </Button>
                  ) : null}
                  <Button variant="outline" onClick={() => setRenaming(a)} style={withIcon} aria-label={`Edit ${a.label}`} title="Name and colour">
                    <Pencil size={13} />
                  </Button>
                  {a.status === "connected" || a.status === "disconnected" ? (
                    <Button variant="outline" onClick={() => setConfirm({ kind: "unlink", a })} style={withIcon}>
                      <Unlink size={13} /> Unlink
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => setConfirm({ kind: "remove", a })} style={{ ...withIcon, color: "var(--tone-danger)" }} aria-label={`Remove ${a.label}`}>
                      <Trash2 size={13} />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <StatsCard accounts={accounts} onShare={() => setSharing(true)} />

      <Card title="Keeping your numbers safe" subtitle="These are personal WhatsApp numbers, so the dashboard paces what it sends.">
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7 }}>
          <li>Replies in a conversation the customer started go out within seconds, with “typing…” shown first.</li>
          <li>
            A first message to someone who has never written to you waits {WA_PACING.cold.minGapSec / 60}–{WA_PACING.cold.maxGapSec / 60} minutes after the previous one, at most{" "}
            {WA_PACING.cold.perDay} a day per number, and never between {WA_PACING.cold.quietFrom % 12} pm and {WA_PACING.cold.quietTo} am. Broadcasts follow the same rule.
          </li>
          <li>
            Order updates to a customer who hasn&apos;t chatted with you are spaced {WA_PACING.order.minGapSec}–{WA_PACING.order.maxGapSec} seconds apart, at most {WA_PACING.order.perDay} a day per
            number.
          </li>
          <li>Numbers that aren&apos;t on WhatsApp are never messaged. More numbers means more first contacts a day.</li>
        </ul>
      </Card>

      {adding ? (
        <LabelModal
          title="Link a number"
          hint="A name you'll recognise, like “Counter phone” or “Number 2”."
          cta="Next: scan the code"
          onClose={() => setAdding(false)}
          create
          onCreated={(id, label) => {
            setAdding(false);
            setLinking(id);
            setLinkLabel(label);
          }}
        />
      ) : null}
      {renaming ? <LabelModal title="Edit this number" initial={renaming.label} initialColor={renaming.color} cta="Save" accountId={renaming.id} onClose={() => setRenaming(null)} /> : null}
      {sharing ? <ShareModal accounts={accounts} onClose={() => setSharing(false)} /> : null}
      {linking ? <LinkModal accountId={linking} accounts={accounts} fallbackLabel={linkLabel} onClose={() => setLinking(null)} /> : null}

      {confirm ? (
        <WaConfirm
          title={confirm.kind === "unlink" ? `Unlink “${confirm.a.label}”?` : `Remove “${confirm.a.label}”?`}
          onCancel={() => setConfirm(null)}
          cancelLabel="Keep it"
          busy={unlink.isPending || remove.isPending}
          actions={[{ label: confirm.kind === "unlink" ? "Unlink" : "Remove", tone: "danger", onClick: () => (confirm.kind === "unlink" ? unlink : remove).mutate(confirm.a.id, { onSuccess: () => setConfirm(null) }) }]}
        >
          {confirm.kind === "unlink"
            ? "The dashboard logs out of this number (it disappears from Linked devices on the phone). Its chats stay here; new messages to them will ask you to pick another number."
            : "The number is removed from the dashboard. Its chats stay; anything still waiting to go out from it is cancelled."}
          {unlink.error || remove.error ? <Toast kind="error">{(unlink.error ?? remove.error).message}</Toast> : null}
        </WaConfirm>
      ) : null}
    </>
  );
}

/** Name and colour a new number (then go on to its QR), or edit one. */
function LabelModal({ title, hint, cta, initial = "", initialColor = "", accountId, create, onClose, onCreated }) {
  const [label, setLabel] = useState(initial);
  const [color, setColor] = useState(initialColor);
  const make = useWaAction((o, v) => api.waCreateAccount(o, v.label, v.color));
  const edit = useWaAction((o, v) => api.waUpdateAccount(o, accountId, v));
  const m = create ? make : edit;
  return (
    <Modal onClose={onClose} width={440} ariaLabel={title}>
      <form
        style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate({ label, ...(color ? { color } : {}) }, { onSuccess: (r) => (create ? onCreated(r.account.id, r.account.label) : onClose()) });
        }}
      >
        <h2 style={{ margin: 0, fontSize: 19 }}>{title}</h2>
        <TextInput value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} autoFocus placeholder="e.g. Counter phone" aria-label="Name for this number" />
        {hint ? <p style={{ ...muted, margin: 0 }}>{hint}</p> : null}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Colour</div>
          <div role="radiogroup" aria-label="Colour" style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            {WA_NUMBER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color.toUpperCase() === c}
                aria-label={c}
                onClick={() => setColor(c)}
                style={{ ...swatch, background: c, boxShadow: color.toUpperCase() === c ? `0 0 0 2px var(--color-bg), 0 0 0 4px ${c}` : "none" }}
              />
            ))}
            <label title="Any colour" style={{ ...swatch, display: "grid", placeItems: "center", border: "1px dashed var(--color-border)", background: "var(--color-bg)", cursor: "pointer", position: "relative" }}>
              <Plus size={14} />
              <input type="color" value={color || "#455A64"} onChange={(e) => setColor(e.target.value.toUpperCase())} aria-label="Any colour" style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
            </label>
          </div>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--color-text-muted)" }}>
            In the chat list: <NumberChip color={color || "#455A64"}>via {label || "this number"}</NumberChip>
          </div>
        </div>
        {m.error ? <Toast kind="error">{m.error.message}</Toast> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!label.trim() || m.isPending}>
            {m.isPending ? "…" : cta}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** How the store's chats are spread over its numbers, with the button that evens them out. */
function StatsCard({ accounts, onShare }) {
  const { outlet } = useOutlet();
  const q = useQuery({ queryKey: ["wa-stats", outlet?._id], queryFn: () => api.waStats(outlet), enabled: Boolean(outlet), refetchInterval: 30_000 });
  const st = q.data;
  const max = Math.max(1, ...(st?.numbers ?? []).map((n) => n.chats));
  const linked = accounts.filter((a) => a.status === "connected" || a.status === "disconnected");
  return (
    <Card
      title="Chats by number"
      subtitle={st ? `${st.total} chats in all${st.unassigned ? ` · ${st.unassigned} not on any number yet` : ""}. Messages: the last 7 days.` : "Loading…"}
      action={
        <Button variant="outline" onClick={onShare} disabled={linked.length < 2} style={withIcon} title={linked.length < 2 ? "Link a second number first" : undefined}>
          <Shuffle size={14} /> Share chats out
        </Button>
      }
    >
      {st?.numbers.length ? (
        <div style={{ overflowX: "auto" }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Number</th>
                <th style={{ ...th, width: "34%" }}>Chats</th>
                <th style={thNum}>Wrote to us</th>
                <th style={thNum}>Unread</th>
                <th style={thNum}>Sent</th>
                <th style={thNum}>Received</th>
                <th style={thNum}>Waiting</th>
                <th style={thNum}>Failed</th>
              </tr>
            </thead>
            <tbody>
              {st.numbers.map((n) => (
                <tr key={n.id}>
                  <td style={td}>
                    <NumberChip color={n.color} online={n.online || n.status === "pending"} size="md">
                      {n.label}
                    </NumberChip>
                  </td>
                  <td style={td}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={barTrack} aria-hidden="true">
                        <span style={{ ...barFill, width: `${(n.chats / max) * 100}%`, background: n.color }} />
                      </span>
                      <strong style={{ fontVariantNumeric: "tabular-nums", minWidth: 28, textAlign: "right" }}>{n.chats}</strong>
                    </span>
                  </td>
                  <td style={tdNum}>{n.replied}</td>
                  <td style={tdNum}>{n.unread}</td>
                  <td style={tdNum}>{n.week.sent}</td>
                  <td style={tdNum}>{n.week.received}</td>
                  <td style={tdNum}>{n.week.waiting}</td>
                  <td style={{ ...tdNum, color: n.week.failed ? "var(--tone-danger)" : undefined }}>{n.week.failed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={muted}>{q.isLoading ? "Loading…" : "No numbers yet."}</p>
      )}
    </Card>
  );
}

const MODES = [
  { id: "share", label: "Share — takes an equal part" },
  { id: "give", label: "Give away — all its chats move" },
  { id: "keep", label: "Leave alone" },
];

/**
 * Even out chats over the numbers marked "Share" (and empty the ones marked "Give away" into them). The preview
 * updates as the choices change; nothing moves until "Move chats".
 */
function ShareModal({ accounts, onClose }) {
  const { outlet } = useOutlet();
  const linked = accounts.filter((a) => a.status === "connected" || a.status === "disconnected");
  const [modes, setModes] = useState(() => Object.fromEntries(accounts.map((a) => [a.id, linked.some((l) => l.id === a.id) ? "share" : "keep"])));
  const body = useMemo(
    () => ({ share: accounts.filter((a) => modes[a.id] === "share").map((a) => a.id), giveAway: accounts.filter((a) => modes[a.id] === "give").map((a) => a.id) }),
    [accounts, modes],
  );
  const preview = useQuery({
    queryKey: ["wa-share-preview", outlet?._id, body],
    queryFn: () => api.waDistributePreview(outlet, body),
    enabled: Boolean(outlet) && body.share.length > 0,
    retry: false,
  });
  const apply = useWaAction((o, b) => api.waDistribute(o, b));
  const [done, setDone] = useState(null);
  const p = preview.data;
  const valid = body.share.length > 0 && (body.share.length > 1 || body.giveAway.length > 0);

  if (done) {
    return (
      <Modal onClose={onClose} width={460} ariaLabel="Chats shared out">
        <div style={{ padding: 22 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 19 }}>{done.moving} {done.moving === 1 ? "chat" : "chats"} moved</h2>
          <p style={{ margin: 0, fontSize: 14 }}>{done.numbers.filter((n) => n.before !== n.after).map((n) => `${n.label}: ${n.after}`).join(" · ") || "Everything was already even."}</p>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <WaConfirm
      width={600}
      title="Share chats out between numbers"
      onCancel={onClose}
      busy={apply.isPending}
      actions={[{ label: p?.moving ? `Move ${p.moving} ${p.moving === 1 ? "chat" : "chats"}` : "Move chats", disabled: !valid || !p?.moving, onClick: () => apply.mutate(body, { onSuccess: (r) => setDone(r) }) }]}
    >
      <p style={{ margin: "0 0 12px" }}>Choose what each number does. The numbers that share end up with the same number of chats.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {accounts.map((a) => {
          const row = p?.numbers.find((n) => n.id === a.id);
          const isLinked = linked.some((l) => l.id === a.id);
          return (
            <div key={a.id} style={shareRow}>
              <NumberChip color={a.color} online={a.online || !isLinked} size="md" style={{ minWidth: 0, flex: "0 1 auto" }}>
                {a.label}
              </NumberChip>
              <Select
                value={modes[a.id]}
                onChange={(e) => setModes({ ...modes, [a.id]: e.target.value })}
                aria-label={`What ${a.label} does`}
                style={{ flex: "1 1 200px", maxWidth: 260 }}
              >
                {MODES.filter((m) => isLinked || m.id !== "share").map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </Select>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontVariantNumeric: "tabular-nums", fontSize: 13.5, marginLeft: "auto" }} aria-label={row ? `${row.before} chats now, ${row.after} after` : undefined}>
                {row ? (
                  <>
                    {row.before} <ArrowRight size={13} aria-hidden="true" /> <strong style={{ color: row.after !== row.before ? "var(--color-primary)" : undefined }}>{row.after}</strong>
                  </>
                ) : (
                  "—"
                )}
              </span>
            </div>
          );
        })}
      </div>
      {!valid ? <p style={{ ...muted, margin: "10px 0 0" }}>Pick at least two numbers to share, or one to share and one to give away.</p> : null}
      {p && valid ? (
        <p style={{ ...muted, margin: "12px 0 0", lineHeight: 1.6 }}>
          {p.moving ? `${p.moving} ${p.moving === 1 ? "chat moves" : "chats move"}. ` : "Already even — nothing to move. "}
          People who never wrote to you move first, then the conversations quiet the longest, so active chats stay where they are.
          {p.firstContacts
            ? ` ${p.firstContacts} of the moved customers have written to their old number: the new number's first message to each of them is paced like any first contact, to keep it safe.`
            : ""}{" "}
          If a moved customer writes to their old number again, their chat goes back to it.
        </p>
      ) : null}
      {preview.error ? <Toast kind="error">{preview.error.message}</Toast> : null}
      {apply.error ? <Toast kind="error">{apply.error.message}</Toast> : null}
    </WaConfirm>
  );
}

/** The live QR (it changes every ~20 s) until the phone scans it. */
function LinkModal({ accountId, accounts, fallbackLabel, onClose }) {
  const a = accounts.find((x) => x.id === accountId);
  const [img, setImg] = useState("");
  const qr = a?.qr ?? "";
  useEffect(() => {
    if (!qr) return setImg("");
    let alive = true;
    void QRCode.toDataURL(qr, { margin: 1, width: 280, errorCorrectionLevel: "L" }).then((url) => alive && setImg(url));
    return () => {
      alive = false;
    };
  }, [qr]);
  const relink = useWaAction((o, id) => api.waRelinkAccount(o, id));
  const done = a?.status === "connected";

  return (
    <Modal onClose={onClose} width={520} ariaLabel="Link a WhatsApp number">
      <div style={{ padding: 22 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 19 }}>{done ? `“${a.label}” is linked` : `Link “${a?.label ?? (fallbackLabel || "number")}”`}</h2>
        {done ? (
          <>
            <p style={{ margin: "8px 0 0", fontSize: 14 }}>
              {formatWaPhone(a.phone)} is connected. Customers who message it now appear in Chats.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
              <Button onClick={onClose}>Done</Button>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>
            <div style={qrBox} aria-live="polite">
              {a?.status === "expired" ? (
                <div style={{ textAlign: "center", padding: 16 }}>
                  <p style={{ margin: "0 0 10px", fontSize: 13.5 }}>The code expired.</p>
                  <Button onClick={() => relink.mutate(accountId)} style={withIcon}>
                    <RefreshCw size={13} /> New code
                  </Button>
                </div>
              ) : img ? (
                <img src={img} alt="WhatsApp link code — scan it with the phone" width={240} height={240} />
              ) : (
                <span style={muted}>Getting a code from WhatsApp…</span>
              )}
            </div>
            <ol style={{ flex: "1 1 200px", margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.75 }}>
              <li>Open WhatsApp on the phone with this number.</li>
              <li>
                Tap <strong>⋮</strong> (Android) or <strong>Settings</strong> (iPhone) → <strong>Linked devices</strong> → <strong>Link a device</strong>.
              </li>
              <li>Point the phone at this code.</li>
            </ol>
          </div>
        )}
      </div>
    </Modal>
  );
}

const withIcon = { display: "inline-flex", gap: 6, alignItems: "center" };
const muted = { fontSize: 13, color: "var(--color-text-muted)" };
const rowBox = { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "12px 14px", border: "1px solid var(--color-border)", borderRadius: 12, background: "var(--color-bg)" };
const icon = { width: 38, height: 38, borderRadius: 10, display: "grid", placeItems: "center", background: "color-mix(in srgb, var(--color-primary) 12%, var(--color-bg))", color: "var(--color-primary)", flexShrink: 0 };
const qrBox = { width: 260, height: 260, display: "grid", placeItems: "center", borderRadius: 12, border: "1px solid var(--color-border)", background: "#fff", flexShrink: 0 };
const swatch = { width: 28, height: 28, borderRadius: 999, border: 0, cursor: "pointer", padding: 0 };
const table = { width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 640 };
const th = { textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--color-text-muted)", padding: "6px 8px", borderBottom: "1px solid var(--color-border)" };
const thNum = { ...th, textAlign: "right" };
const td = { padding: "8px", borderBottom: "1px solid var(--color-border)", verticalAlign: "middle" };
const tdNum = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
const barTrack = { flex: 1, height: 8, borderRadius: 999, background: "var(--color-border)", overflow: "hidden" };
const barFill = { display: "block", height: "100%", borderRadius: 999 };
const shareRow = { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 10px", border: "1px solid var(--color-border)", borderRadius: 10, background: "var(--color-bg)" };
