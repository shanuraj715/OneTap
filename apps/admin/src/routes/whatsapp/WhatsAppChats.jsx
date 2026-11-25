import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "../../lib/nav";
import { formatWaPhone, WA_MAX_MEDIA_BYTES, WA_MEDIA_ACCEPT, WA_PACING, WA_REVOKE_HOURS, waTextOn } from "@rasoipulse/config-schema";
import { AlertCircle, ArrowLeft, Ban, Check, CheckCheck, Clock, Download, FileText, MessageCirclePlus, MoreVertical, Paperclip, RotateCcw, Search, Send, Smartphone, Trash2, X } from "lucide-react";
import * as api from "../../lib/api";
import { useMedia } from "../../lib/useMedia";
import { useOutlet } from "../../lib/useOutlet";
import { useWaAction, useWaChats, useWaLevel, useWaMe, useWaMessages } from "../../lib/useWhatsApp";
import { Button, Menu, Modal, TextInput, Toast } from "../../ui";
import { WaHeader } from "./WaNav";
import { NumberChip, WaConfirm } from "./WaConfirm";

/**
 * WhatsApp chats: the store's conversations on the left, the open one on the right (one at a time on a phone).
 * Messages go into a queue the WhatsApp worker sends from — a running conversation at a human pace, a first
 * message to a new number much more slowly (see WA_PACING), which is what keeps a personal number from a ban.
 */
export function WhatsAppChats() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const level = useWaLevel();
  const me = useWaMe();
  const narrow = useMedia("(max-width: 900px)");
  const [q, setQ] = useState("");
  const [view, setView] = useState("all");
  const [account, setAccount] = useState("");
  const [starting, setStarting] = useState(false);
  const chats = useWaChats({ q, view, account });
  const list = chats.data?.chats ?? [];
  const open = list.find((c) => c.id === chatId) ?? null;
  const canSend = level === "send" || level === "manage";
  const accounts = me.data?.accounts ?? [];
  const anyOnline = me.data?.anyOnline;

  const showList = !narrow || !chatId;
  const showChat = !narrow || Boolean(chatId);

  return (
    <>
      {/* with a mouse, a message's delete button appears on hover; on touch screens it stays visible */}
      <style>{`@media (hover: hover) { .wa-msg .wa-msg-del { opacity: 0 !important; } .wa-msg:hover .wa-msg-del, .wa-msg .wa-msg-del:focus-visible { opacity: 0.6 !important; } }`}</style>
      <WaHeader />
      {me.isSuccess && !anyOnline ? (
        <div style={banner} role="status">
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>
            {accounts.length === 0 ? "No WhatsApp number is linked yet." : "None of your WhatsApp numbers is connected right now — messages wait in the queue until one is."}{" "}
            {level === "manage" ? <Link to="/whatsapp/numbers">Go to Numbers</Link> : "Ask the store owner to link one."}
          </span>
        </div>
      ) : null}

      <div style={{ ...shell, gridTemplateColumns: narrow ? "1fr" : "340px 1fr" }}>
        {showList ? (
          <aside style={listCol} aria-label="Chats">
            <div style={{ display: "flex", gap: 8, padding: 12, borderBottom: "1px solid var(--color-border)" }}>
              <label style={searchBox}>
                <Search size={15} aria-hidden="true" style={{ color: "var(--color-text-muted)" }} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or number" aria-label="Search chats" style={searchInput} />
              </label>
              {canSend ? (
                <Button onClick={() => setStarting(true)} aria-label="Start a new chat" title="New chat" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 12px" }}>
                  <MessageCirclePlus size={16} /> {narrow ? null : "New"}
                </Button>
              ) : null}
            </div>
            <div style={filterBar}>
              <div role="group" aria-label="Show" style={chipRow}>
                {VIEWS.map((v) => (
                  <FilterChip key={v.id} active={view === v.id} onClick={() => setView(v.id)} title={v.hint}>
                    {v.label}
                  </FilterChip>
                ))}
              </div>
              {accounts.length > 1 ? (
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--color-text-muted)" }}>
                  <Smartphone size={13} aria-hidden="true" />
                  <select value={account} onChange={(e) => setAccount(e.target.value)} aria-label="Filter by number" style={numberSelect}>
                    <option value="">All numbers</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                        {a.online ? "" : " (offline)"}
                      </option>
                    ))}
                    <option value="none">No number yet</option>
                  </select>
                </label>
              ) : null}
            </div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {chats.isLoading ? <p style={muted}>Loading…</p> : null}
              {chats.isSuccess && list.length === 0 ? (
                q || view !== "all" || account ? (
                  <div style={{ ...muted, padding: 18 }}>
                    No chats match.{" "}
                    <button type="button" onClick={() => { setQ(""); setView("all"); setAccount(""); }} style={linkBtn}>
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <p style={{ ...muted, padding: 18 }}>No chats yet. Customers who message your linked numbers appear here, and you can start one with “New”.</p>
                )
              ) : null}
              {list.map((c) => (
                <ChatRow key={c.id} chat={c} active={c.id === chatId} account={accounts.find((a) => a.id === c.accountId)} onOpen={() => navigate(`/whatsapp/chats/${c.id}`)} />
              ))}
            </div>
          </aside>
        ) : null}

        {showChat ? (
          <section style={chatCol} aria-label="Conversation">
            {chatId ? (
              <Conversation key={chatId} chatId={chatId} fallback={open} canSend={canSend} accounts={accounts} showBack={narrow} onBack={() => navigate("/whatsapp/chats")} />
            ) : (
              <div style={emptyChat}>
                <MessageCirclePlus size={34} aria-hidden="true" />
                <p style={{ margin: 0 }}>Choose a chat{canSend ? ", or start a new one" : ""}.</p>
              </div>
            )}
          </section>
        ) : null}
      </div>

      {starting ? <NewChatModal onClose={() => setStarting(false)} onStarted={(id) => navigate(`/whatsapp/chats/${id}`)} /> : null}
    </>
  );
}

/* ----------------------------------------------------------------- list row */

function ChatRow({ chat, active, account, onOpen }) {
  const title = chat.name || formatWaPhone(chat.phone);
  return (
    <button type="button" onClick={onOpen} style={{ ...row, background: active ? "color-mix(in srgb, var(--color-primary) 9%, var(--color-bg))" : "transparent" }} aria-current={active ? "true" : undefined}>
      <Avatar name={title} />
      <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
          <strong style={ellipsis}>{title}</strong>
          <span style={{ fontSize: 11.5, color: chat.unread ? "var(--color-primary)" : "var(--color-text-muted)", flexShrink: 0 }}>{shortTime(chat.lastMessageAt)}</span>
        </span>
        <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <span style={{ ...ellipsis, fontSize: 13, color: "var(--color-text-muted)" }}>
            {chat.lastDirection === "out" ? "You: " : ""}
            {chat.lastPreview || "No messages yet"}
          </span>
          {chat.unread ? <span style={badge}>{chat.unread}</span> : null}
        </span>
        {chat.accountLabel ? (
          <NumberChip
            color={chat.accountColor}
            online={account ? account.online : true}
            title={account ? `Sent from ${account.label}${account.online ? "" : " — offline right now"}` : "The number this chat used was removed"}
            style={{ alignSelf: "flex-start", marginTop: 2 }}
          >
            via {chat.accountLabel}
          </NumberChip>
        ) : null}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------- conversation */

function Conversation({ chatId, fallback, canSend, accounts, showBack, onBack }) {
  const { outlet } = useOutlet();
  const messages = useWaMessages(chatId);
  const chatQ = useWaChats({ q: "", view: "all", account: "" });
  const chat = chatQ.data?.chats.find((c) => c.id === chatId) ?? fallback;
  const msgs = messages.data?.messages ?? [];
  const scroller = useRef(null);
  const [offline, setOffline] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [deleting, setDeleting] = useState(null); // the message being deleted
  const [renaming, setRenaming] = useState(false);
  const markRead = useWaAction((o) => api.waMarkRead(o, chatId));
  const update = useWaAction((o, body) => api.waUpdateChat(o, chatId, body));
  const clear = useWaAction((o) => api.waClearChat(o, chatId));
  const remove = useWaAction((o) => api.waDeleteChat(o, chatId));
  const retry = useWaAction((o, id) => api.waRetry(o, chatId, id));
  const dropMsg = useWaAction((o, { id, everyone }) => api.waDeleteMessage(o, chatId, id, everyone));

  // read when opened, and as new messages arrive while it's open
  const unread = chat?.unread ?? 0;
  useEffect(() => {
    if (unread > 0) markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread, chatId]);

  // stay at the bottom as messages arrive, unless the reader has scrolled up
  const count = msgs.length;
  const pinned = useRef(true);
  useEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [count]);

  if (!chat) return <div style={emptyChat}>{chatQ.isLoading ? "Loading…" : "This chat no longer exists."}</div>;
  const title = chat.name || formatWaPhone(chat.phone);
  const numberOptions = accounts.map((a) => ({ value: a.id, label: a.label, description: `${a.phone ? formatWaPhone(a.phone) : "not linked yet"} · ${a.online ? "online" : "offline"}` }));

  return (
    <>
      <header style={chatHeader}>
        {showBack ? (
          <button type="button" onClick={onBack} aria-label="Back to chats" style={iconBtn}>
            <ArrowLeft size={18} />
          </button>
        ) : null}
        <Avatar name={title} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...ellipsis, fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", display: "flex", gap: 8, ...ellipsis }}>
            <a href={`tel:+${chat.phone}`} style={{ color: "inherit", whiteSpace: "nowrap" }}>
              {formatWaPhone(chat.phone)}
            </a>
            {chat.optedOut ? <span title="They replied STOP — broadcasts skip them">· no offers</span> : null}
          </div>
        </div>
        {canSend ? (
          <Menu
            align="right"
            width={260}
            header="Send this chat from"
            options={numberOptions}
            selected={chat.accountId ?? undefined}
            onSelect={(id) => update.mutate({ accountId: id })}
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={toggle}
                style={{ ...numberChip, ...filled(chat.accountColor), ...(showBack ? { padding: "8px 10px" } : null) }}
                title={`Sent from: ${chat.accountLabel ?? "no number yet"} — change`}
                aria-label={`Sent from ${chat.accountLabel ?? "no number yet"}. Change the number`}
              >
                <Smartphone size={13} /> {showBack ? null : (chat.accountLabel ?? "Choose a number")}
              </button>
            )}
          />
        ) : chat.accountLabel ? (
          <span style={{ ...numberChip, ...filled(chat.accountColor), cursor: "default" }}>
            <Smartphone size={13} /> {chat.accountLabel}
          </span>
        ) : null}
        {canSend ? (
          <Menu
            align="right"
            width={200}
            options={[
              { value: "rename", label: "Rename" },
              { value: "clear", label: "Clear chat" },
              { value: "delete", label: "Delete chat" },
            ]}
            onSelect={(v) => (v === "rename" ? setRenaming(true) : setConfirm(v))}
            trigger={({ toggle }) => (
              <button type="button" onClick={toggle} aria-label="Chat options" style={iconBtn}>
                <MoreVertical size={18} />
              </button>
            )}
          />
        ) : null}
      </header>

      <div
        ref={scroller}
        style={thread}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {messages.isLoading ? <p style={muted}>Loading…</p> : null}
        {messages.isSuccess && msgs.length === 0 ? <p style={{ ...muted, textAlign: "center" }}>No messages yet.</p> : null}
        {msgs.map((m, i) => {
          const day = dayLabel(m.at);
          const showDay = i === 0 || dayLabel(msgs[i - 1].at) !== day;
          return (
            <div key={m.id}>
              {showDay ? <div style={dayChip}>{day}</div> : null}
              <Bubble m={m} canSend={canSend} onRetry={() => retry.mutate(m.id)} onDelete={() => setDeleting(m)} />
            </div>
          );
        })}
      </div>

      {canSend ? (
        <Composer chat={chat} outlet={outlet} onOffline={setOffline} />
      ) : (
        <p style={{ ...muted, margin: 0, padding: "12px 16px", borderTop: "1px solid var(--color-border)" }}>You can read this chat. Replying needs the store owner to give your role access.</p>
      )}

      {offline ? <OfflineModal info={offline} onClose={() => setOffline(null)} /> : null}

      {renaming ? (
        <RenameModal
          current={chat.name}
          onClose={() => setRenaming(false)}
          onSave={(name) => update.mutate({ name }, { onSuccess: () => setRenaming(false) })}
        />
      ) : null}

      {confirm ? (
        <WaConfirm
          title={confirm === "clear" ? "Clear this chat?" : "Delete this chat?"}
          onCancel={() => setConfirm(null)}
          cancelLabel="Keep it"
          busy={clear.isPending || remove.isPending}
          actions={[
            {
              label: confirm === "clear" ? "Clear chat" : "Delete chat",
              tone: "danger",
              onClick: () =>
                confirm === "clear"
                  ? clear.mutate(undefined, { onSuccess: () => setConfirm(null) })
                  : remove.mutate(undefined, { onSuccess: () => { setConfirm(null); onBack(); } }),
            },
          ]}
        >
          {confirm === "clear"
            ? "Every message in it is removed from the dashboard (and messages still waiting to go out are cancelled). The chat stays in your list."
            : "The chat and all its messages are removed from the dashboard, and messages still waiting are cancelled."}{" "}
          The conversation on the phone itself isn&apos;t touched.
        </WaConfirm>
      ) : null}

      {deleting ? (
        <WaConfirm
          title="Delete this message?"
          onCancel={() => setDeleting(null)}
          busy={dropMsg.isPending}
          actions={[
            ...(deleting.canRevoke
              ? [{ label: "Delete for everyone", tone: "danger", onClick: () => dropMsg.mutate({ id: deleting.id, everyone: true }, { onSuccess: () => setDeleting(null) }) }]
              : []),
            {
              label: deleting.status === "queued" ? "Cancel sending" : "Delete for me",
              tone: "danger",
              onClick: () => dropMsg.mutate({ id: deleting.id, everyone: false }, { onSuccess: () => setDeleting(null) }),
            },
          ]}
        >
          {deleting.canRevoke ? (
            <>
              <strong>Delete for everyone</strong> removes it from {chatTitle(chat)}&apos;s phone too (WhatsApp shows “This message was deleted”). <strong>Delete for me</strong> only removes it from
              the dashboard.
            </>
          ) : deleting.status === "queued" ? (
            "It hasn't gone out yet — it simply won't be sent."
          ) : deleting.direction === "in" ? (
            "It's removed from the dashboard. Only the customer can delete their own message for everyone."
          ) : (
            `It's removed from the dashboard only — WhatsApp lets you delete for everyone only within ${WA_REVOKE_HOURS} hours of sending.`
          )}
          {dropMsg.error ? <Toast kind="error">{dropMsg.error.message}</Toast> : null}
        </WaConfirm>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ bubble */

function Bubble({ m, canSend, onRetry, onDelete }) {
  const out = m.direction === "out";
  const later = m.status === "queued" && m.sendAfter && new Date(m.sendAfter) > new Date(Date.now() + 30_000);
  return (
    <div style={{ display: "flex", justifyContent: out ? "flex-end" : "flex-start", margin: "3px 0" }} className="wa-msg">
      <div style={{ ...bubble, ...(out ? bubbleOut : bubbleIn), ...(m.status === "failed" ? { outline: "1.5px solid var(--tone-danger)" } : null) }}>
        {m.source !== "chat" && !m.deleted ? <div style={sourceTag}>{SOURCE_LABEL[m.source]}</div> : null}
        {m.deleted ? (
          <div style={{ fontStyle: "italic", color: "var(--color-text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <Ban size={13} aria-hidden="true" /> {out ? "You deleted this message" : "This message was deleted"}
          </div>
        ) : (
          <>
            <MediaPart m={m} />
            {m.text ? <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.text}</div> : null}
          </>
        )}
        {m.revoke === "requested" ? <div style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>Deleting for everyone…</div> : null}
        {m.revoke === "failed" ? <div style={{ fontSize: 11.5, color: "var(--tone-danger)" }}>Couldn&apos;t delete for everyone: {m.revokeError || "try again"}</div> : null}
        <div style={meta}>
          {later ? <span title="First contacts go out slowly to keep the number safe">sends {whenText(m.sendAfter)} · </span> : null}
          <span>{clock(m.at)}</span>
          {out && !m.deleted ? <Ticks status={m.status} /> : null}
          {canSend && m.revoke !== "requested" ? (
            <button type="button" onClick={onDelete} aria-label="Delete this message" title={m.canRevoke ? "Delete (for everyone or just here)" : "Delete"} style={msgDel} className="wa-msg-del">
              <Trash2 size={12} />
            </button>
          ) : null}
        </div>
        {m.status === "failed" ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "var(--tone-danger)", marginTop: 4 }}>
            <AlertCircle size={13} /> <span style={{ flex: 1 }}>{m.error || "Not sent"}</span>
            {canSend ? (
              <button type="button" onClick={onRetry} style={retryBtn}>
                <RotateCcw size={12} /> Try again
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const SOURCE_LABEL = { order: "Order update", broadcast: "Broadcast", phone: "Sent from the phone" };

function Ticks({ status }) {
  if (status === "queued" || status === "sending") return <Clock size={13} aria-label="Waiting to send" />;
  if (status === "sent") return <Check size={14} aria-label="Sent" />;
  if (status === "delivered") return <CheckCheck size={14} aria-label="Delivered" />;
  if (status === "read") return <CheckCheck size={14} aria-label="Read" style={{ color: "#3b9de8" }} />;
  if (status === "failed") return <AlertCircle size={13} aria-label="Not sent" style={{ color: "var(--tone-danger)" }} />;
  return null;
}

function MediaPart({ m }) {
  if (!m.media?.url) return m.type !== "text" && !m.text ? <div style={{ ...muted, margin: 0 }}>[{m.type} — not kept]</div> : null;
  const { url, mime, fileName, size } = m.media;
  if (m.type === "image" || m.type === "sticker")
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img src={url} alt={fileName || "Photo"} style={{ display: "block", maxWidth: "100%", maxHeight: 280, borderRadius: 8, marginBottom: 4 }} loading="lazy" />
      </a>
    );
  if (m.type === "video") return <video src={url} controls style={{ display: "block", maxWidth: "100%", maxHeight: 280, borderRadius: 8, marginBottom: 4 }} />;
  if (m.type === "audio") return <audio src={url} controls style={{ display: "block", maxWidth: 260, marginBottom: 4 }} />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" download={fileName || true} style={docLink}>
      <FileText size={20} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ ...ellipsis, display: "block", fontWeight: 600 }}>{fileName || mime}</span>
        <span style={{ fontSize: 11.5, opacity: 0.75 }}>{sizeText(size)}</span>
      </span>
      <Download size={16} />
    </a>
  );
}

/* ---------------------------------------------------------------- composer */

function Composer({ chat, outlet, onOffline }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef(null);
  const send = useWaAction((o, body) => api.waSend(o, chat.id, body));
  const preview = useMemo(() => (file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  const submit = async (accountId) => {
    if (busy || (!text.trim() && !file)) return;
    setBusy(true);
    setError("");
    try {
      const media = file ? (await api.waUpload(outlet, file)).media : null;
      await send.mutateAsync({ text, media, ...(accountId ? { accountId } : {}) });
      setText("");
      setFile(null);
    } catch (e) {
      if (e?.details?.code === "number_offline") onOffline({ ...e.details, message: e.message, retry: (id) => submit(id) });
      else setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const pick = (f) => {
    if (!f) return;
    if (f.size > WA_MAX_MEDIA_BYTES) return setError(`That file is ${sizeText(f.size)} — WhatsApp files can be up to 16 MB.`);
    setError("");
    setFile(f);
  };

  return (
    <div style={{ borderTop: "1px solid var(--color-border)", padding: "10px 12px", background: "var(--color-surface)" }}>
      {!chat.hasReplied ? (
        <p style={{ ...muted, margin: "0 0 8px", fontSize: 12 }}>
          {chat.name || "This number"} hasn&apos;t written to you yet, so your first message goes out at a careful pace — one new number every {WA_PACING.cold.minGapSec / 60}–
          {WA_PACING.cold.maxGapSec / 60} minutes, at most {WA_PACING.cold.perDay} a day per number, never between {WA_PACING.cold.quietFrom % 12} pm and {WA_PACING.cold.quietTo} am.
        </p>
      ) : null}
      {file ? (
        <div style={attachChip}>
          {preview ? <img src={preview} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6 }} /> : <FileText size={20} />}
          <span style={{ ...ellipsis, flex: 1 }}>
            {file.name} · {sizeText(file.size)}
          </span>
          <button type="button" onClick={() => setFile(null)} aria-label="Remove the attachment" style={iconBtn}>
            <X size={15} />
          </button>
        </div>
      ) : null}
      {error ? <Toast kind="error">{error}</Toast> : null}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <button type="button" onClick={() => input.current?.click()} aria-label="Attach a photo, video or file" title="Attach (up to 16 MB)" style={iconBtn} disabled={busy}>
          <Paperclip size={18} />
        </button>
        <input ref={input} type="file" accept={WA_MEDIA_ACCEPT} hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          rows={Math.min(5, Math.max(1, text.split("\n").length))}
          maxLength={4000}
          placeholder={file ? "Add a caption (optional)" : "Type a message"}
          aria-label="Message"
          style={composerInput}
        />
        <Button onClick={() => void submit()} disabled={busy || (!text.trim() && !file)} aria-label="Send" style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 40 }}>
          <Send size={16} /> {busy ? "…" : "Send"}
        </Button>
      </div>
    </div>
  );
}

/** The chat's number is offline: offer the numbers that are online; the one chosen becomes the chat's number. */
function OfflineModal({ info, onClose }) {
  const [choice, setChoice] = useState(info.others?.[0]?.id ?? null);
  return (
    <Modal onClose={onClose} width={440} ariaLabel="Number not connected">
      <div style={{ padding: 22 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 19 }}>{info.message}</h2>
        {info.others?.length ? (
          <>
            <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.6 }}>Send it from another number? That number becomes this chat&apos;s number from now on.</p>
            <div role="radiogroup" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {info.others.map((a) => (
                <label key={a.id} style={{ ...radioRow, borderColor: choice === a.id ? "var(--color-primary)" : "var(--color-border)" }}>
                  <input type="radio" name="wa-number" checked={choice === a.id} onChange={() => setChoice(a.id)} />
                  <span>
                    <strong>{a.label}</strong> <span style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{formatWaPhone(a.phone)}</span>
                  </span>
                </label>
              ))}
            </div>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>No other number is connected right now. Your message is still in the box — send it once a number is back online.</p>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {info.others?.length ? (
            <Button
              disabled={!choice}
              onClick={() => {
                onClose();
                info.retry(choice);
              }}
            >
              Send from this number
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

function NewChatModal({ onClose, onStarted }) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const start = useWaAction((o, body) => api.waStartChat(o, body));
  return (
    <Modal onClose={onClose} width={420} ariaLabel="New chat">
      <form
        style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          start.mutate({ phone, name: name || undefined }, { onSuccess: (r) => { onClose(); onStarted(r.chat.id); } });
        }}
      >
        <h2 style={{ margin: 0, fontSize: 19 }}>New chat</h2>
        <label style={fieldLabel}>
          WhatsApp number
          <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98765 43210 or +44 7700 900123" autoFocus inputMode="tel" />
        </label>
        <label style={fieldLabel}>
          Name (optional)
          <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Riya" />
        </label>
        <p style={{ ...muted, margin: 0, fontSize: 12.5 }}>A 10-digit number is taken as Indian (+91). If they&apos;ve chatted before, you&apos;ll land in that chat.</p>
        {start.error ? <Toast kind="error">{start.error.message}</Toast> : null}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!phone.trim() || start.isPending}>
            {start.isPending ? "Opening…" : "Open chat"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RenameModal({ current, onClose, onSave }) {
  const [name, setName] = useState(current ?? "");
  return (
    <Modal onClose={onClose} width={380} ariaLabel="Rename chat">
      <form style={{ padding: 22, display: "flex", flexDirection: "column", gap: 12 }} onSubmit={(e) => { e.preventDefault(); onSave(name); }}>
        <h2 style={{ margin: 0, fontSize: 19 }}>Name this chat</h2>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus aria-label="Name" />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------------------------------------------ pieces */

function Avatar({ name }) {
  const letter = (String(name).replace(/[^A-Za-z0-9]/g, "")[0] ?? "?").toUpperCase();
  return (
    <span aria-hidden="true" style={avatar}>
      {letter}
    </span>
  );
}

function FilterChip({ active, onClick, title, children }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} title={title} style={{ ...chip, ...(active ? chipOn : null) }}>
      {children}
    </button>
  );
}

const VIEWS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread", hint: "Chats with messages nobody has opened yet" },
  { id: "needs-reply", label: "Needs reply", hint: "The customer wrote last" },
  { id: "new", label: "New", hint: "They have never written to you — your messages to them go out slowly" },
  { id: "opted-out", label: "No offers", hint: "They replied STOP — broadcasts skip them" },
];

const filled = (color) => (color ? { background: color, borderColor: color, color: waTextOn(color) } : null);
const chatTitle = (chat) => chat.name || formatWaPhone(chat.phone);

const pad = (n) => String(n).padStart(2, "0");
function clock(d) {
  const t = new Date(d);
  const h = t.getHours();
  return `${h % 12 || 12}:${pad(t.getMinutes())} ${h < 12 ? "am" : "pm"}`;
}
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function dayLabel(d) {
  const t = new Date(d);
  const now = new Date();
  if (sameDay(t, now)) return "Today";
  if (sameDay(t, new Date(now.getTime() - 86400000))) return "Yesterday";
  if (sameDay(t, new Date(now.getTime() + 86400000))) return "Tomorrow";
  return t.toLocaleDateString(undefined, { day: "numeric", month: "short", year: t.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}
function shortTime(d) {
  if (!d) return "";
  const t = new Date(d);
  return sameDay(t, new Date()) ? clock(t) : dayLabel(t);
}
function whenText(d) {
  const t = new Date(d);
  return sameDay(t, new Date()) ? `at ${clock(t)}` : `${dayLabel(t).toLowerCase()} ${clock(t)}`;
}
function sizeText(n) {
  if (!n) return "";
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const banner = { display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", marginBottom: 12, borderRadius: 10, background: "var(--tone-warning-wash)", color: "var(--tone-warning)", fontSize: 13.5 };
const shell = {
  display: "grid",
  height: "calc(100vh - 210px)",
  minHeight: 460,
  border: "1px solid var(--color-border)",
  borderRadius: 14,
  overflow: "hidden",
  background: "var(--color-bg)",
};
const listCol = { display: "flex", flexDirection: "column", minHeight: 0, borderRight: "1px solid var(--color-border)", background: "var(--color-bg)" };
const chatCol = { display: "flex", flexDirection: "column", minHeight: 0, minWidth: 0, background: "var(--color-surface)" };
const searchBox = { flex: 1, display: "flex", alignItems: "center", gap: 6, padding: "0 10px", border: "1px solid var(--color-border)", borderRadius: 10, background: "var(--color-surface)", minWidth: 0 };
const searchInput = { flex: 1, minWidth: 0, border: 0, outline: "none", background: "transparent", font: "inherit", fontSize: 13.5, padding: "9px 0", color: "var(--color-text)" };
const row = { display: "flex", gap: 10, width: "100%", padding: "10px 12px", border: 0, borderBottom: "1px solid var(--color-border)", textAlign: "left", cursor: "pointer", font: "inherit", color: "var(--color-text)" };
const ellipsis = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 };
const badge = { minWidth: 20, height: 20, padding: "0 6px", borderRadius: 999, background: "var(--color-primary)", color: "var(--color-on-primary)", fontSize: 11.5, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0 };
const muted = { fontSize: 13, color: "var(--color-text-muted)", padding: 12 };
const emptyChat = { flex: 1, display: "grid", placeItems: "center", alignContent: "center", gap: 10, color: "var(--color-text-muted)", textAlign: "center", padding: 24 };
const chatHeader = { display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: "1px solid var(--color-border)", background: "var(--color-bg)" };
const iconBtn = { width: 36, height: 36, display: "grid", placeItems: "center", borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", cursor: "pointer", flexShrink: 0, padding: 0 };
const numberChip = { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, padding: "7px 11px", borderRadius: 999, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)", cursor: "pointer", whiteSpace: "nowrap", maxWidth: 190, overflow: "hidden", textOverflow: "ellipsis" };
const thread = { flex: 1, overflowY: "auto", padding: "12px 16px", minHeight: 0 };
const dayChip = { margin: "12px auto 8px", width: "fit-content", fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: "var(--color-bg)", color: "var(--color-text-muted)", border: "1px solid var(--color-border)" };
const bubble = { maxWidth: "min(520px, 78%)", padding: "7px 10px 5px", borderRadius: 12, fontSize: 14, lineHeight: 1.45, boxShadow: "0 1px 1px rgba(0,0,0,0.06)" };
const bubbleIn = { background: "var(--color-bg)", color: "var(--color-text)", borderTopLeftRadius: 4 };
const bubbleOut = { background: "color-mix(in srgb, var(--color-primary) 14%, var(--color-bg))", color: "var(--color-text)", borderTopRightRadius: 4 };
const meta = { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, fontSize: 11, color: "var(--color-text-muted)", marginTop: 2 };
const msgDel = { border: 0, background: "transparent", color: "inherit", cursor: "pointer", padding: 2, display: "grid", placeItems: "center", opacity: 0.55 };
const retryBtn = { display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid currentColor", borderRadius: 999, background: "transparent", color: "inherit", font: "inherit", fontSize: 11.5, padding: "2px 8px", cursor: "pointer" };
const sourceTag = { fontSize: 10.5, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--color-primary)", marginBottom: 2 };
const docLink = { display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "color-mix(in srgb, var(--color-text) 6%, transparent)", color: "inherit", textDecoration: "none", marginBottom: 4, minWidth: 200 };
const composerInput = { flex: 1, minWidth: 0, resize: "none", font: "inherit", fontSize: 14, lineHeight: 1.4, padding: "9px 12px", borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", maxHeight: 140 };
const attachChip = { display: "flex", alignItems: "center", gap: 10, padding: 8, marginBottom: 8, borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--color-bg)", fontSize: 13 };
const avatar = { width: 38, height: 38, borderRadius: 999, display: "grid", placeItems: "center", flexShrink: 0, fontWeight: 700, background: "color-mix(in srgb, var(--color-primary) 16%, var(--color-bg))", color: "var(--color-primary)" };
const chip = { flexShrink: 0, whiteSpace: "nowrap", font: "inherit", fontSize: 12.5, fontWeight: 600, padding: "4px 12px", borderRadius: 999, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", cursor: "pointer" };
const filterBar = { display: "flex", flexDirection: "column", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--color-border)" };
const chipRow = { display: "flex", gap: 6, flexWrap: "wrap" };
const numberSelect = { flex: 1, minWidth: 0, font: "inherit", fontSize: 12.5, padding: "5px 8px", borderRadius: 8, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)" };
const linkBtn = { border: 0, background: "none", padding: 0, font: "inherit", color: "var(--color-primary)", textDecoration: "underline", cursor: "pointer" };
const chipOn = { background: "var(--color-primary)", borderColor: "var(--color-primary)", color: "var(--color-on-primary)" };
const radioRow = { display: "flex", gap: 10, alignItems: "center", padding: "10px 12px", border: "1.5px solid var(--color-border)", borderRadius: 10, cursor: "pointer" };
const fieldLabel = { display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600 };
