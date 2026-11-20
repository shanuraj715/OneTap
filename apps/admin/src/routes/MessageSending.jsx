import { useEffect, useRef, useState } from "react";
import {
  CODE_METHODS,
  CODE_MESSAGE_VARIABLES,
  codeMappingSchema,
  DEFAULT_WA_CODE_TEMPLATE,
  MESSAGE_METHOD_LABELS,
  renderCodeMessage,
  sampleCodeValues,
} from "@onetap/config-schema";
import { AlertTriangle, Braces, CheckCircle2, EyeOff, KeyRound, Lock, MessageCircle, MessagesSquare, Route, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";
import { SettingsNav } from "../components/SubNav";
import { useAuth } from "../lib/useAuth";
import { useMessaging, useSaveMessaging } from "../lib/useNotify";
import { useOutlet } from "../lib/useOutlet";
import { Button, Card, Checkbox, Field, InfoHint, Modal, Note, PageHeader, TextInput, Toast } from "../ui";

/**
 * Settings → Message sending. The owner chooses which of the store's ways of sending a message each KIND of message
 * goes out on. Today that is the verification code a customer types to sign up or sign in (and the code staff ask
 * for before spending a customer's coins).
 */

/** what is wrong with a linked-WhatsApp message (a variable that doesn't exist, no {{code}}…), or null */
const messageProblem = (text) => codeMappingSchema.safeParse({ method: "linked", linkedMessage: text }).error?.issues[0]?.message ?? null;

/** the four things a code can be mapped to, in the order they're offered */
const OPTIONS = [
  {
    method: "linked",
    icon: <Smartphone size={18} />,
    title: "Your linked WhatsApp number",
    blurb: "Sent from the WhatsApp number you scanned in — free, and it arrives as a normal chat message.",
  },
  {
    method: "whatsapp",
    icon: <MessageCircle size={18} />,
    title: "WhatsApp Business (Meta)",
    blurb: "Sent through your WhatsApp Business account, using a template Meta has approved.",
  },
  {
    method: "sms",
    icon: <MessagesSquare size={18} />,
    title: "SMS",
    blurb: "Sent through your own SMS gateway.",
  },
  {
    method: "screen",
    icon: <EyeOff size={18} />,
    title: "Don't send",
    blurb: "Nothing is sent. The code is shown on the sign-in screen, so use this only while you are testing.",
  },
];

export function MessageSending() {
  const { outlet } = useOutlet();
  const { can } = useAuth();
  const canManage = can("notification-config:manage");
  const query = useMessaging(outlet, can("notification-config:read"));
  const save = useSaveMessaging(outlet);
  const [draft, setDraft] = useState(null);
  const [saved, setSaved] = useState(false);

  const data = query.data;
  useEffect(() => {
    if (data) setDraft({ method: data.codes.method, linkedMessage: data.codes.linkedMessage, whatsappTemplate: data.codes.whatsappTemplate });
  }, [data]);

  const header = (
    <>
      <PageHeader title="Message sending" icon={<Route size={23} />} subtitle="Choose how each kind of message goes out to your customers." />
      <SettingsNav />
    </>
  );

  if (!can("notification-config:read")) {
    return (
      <>
        {header}
        <Card>Your role can&apos;t view message settings.</Card>
      </>
    );
  }
  if (query.isError) {
    return (
      <>
        {header}
        <Card>{query.error.message}</Card>
      </>
    );
  }
  if (!data || !draft) return header;

  const current = data.codes;
  const dirty =
    draft.method !== current.method ||
    draft.linkedMessage !== current.linkedMessage ||
    draft.whatsappTemplate.name !== current.whatsappTemplate.name ||
    draft.whatsappTemplate.language !== current.whatsappTemplate.language ||
    draft.whatsappTemplate.copyButton !== current.whatsappTemplate.copyButton;

  const change = (patch) => {
    setSaved(false);
    setDraft({ ...draft, ...patch });
  };

  const onSave = () =>
    save.mutate(
      { codes: { method: draft.method, linkedMessage: draft.linkedMessage, whatsappTemplate: draft.whatsappTemplate } },
      { onSuccess: () => setSaved(true) },
    );

  return (
    <>
      {header}

      <Card
        title="Verification codes"
        icon={<KeyRound size={17} />}
        subtitle="The 6-digit code a customer types to sign up or sign in on your website — and the code your staff ask for before spending a customer's coins."
      >
        {!current.explicit && current.method === "screen" ? (
          <Note icon={<AlertTriangle size={16} />}>
            Codes are not being sent yet — your customers are shown the code on screen. Choose a way to send them below.
          </Note>
        ) : null}

        <div role="radiogroup" aria-label="How verification codes are sent" style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
          {OPTIONS.filter((o) => CODE_METHODS.includes(o.method)).map((o) => {
            const status = o.method === "screen" ? { ok: true } : data.ready[o.method];
            const selected = draft.method === o.method;
            const selectable = canManage && (status.ok || selected);
            return (
              <div key={o.method} style={{ ...option, ...(selected ? optionOn : {}), ...(!status.ok && !selected ? { opacity: 0.85 } : {}) }} data-method={o.method}>
                <label style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: selectable ? "pointer" : "not-allowed" }}>
                  <input
                    type="radio"
                    name="code-method"
                    value={o.method}
                    checked={selected}
                    disabled={!canManage || (!status.ok && !selected)}
                    onChange={() => change({ method: o.method })}
                    aria-label={MESSAGE_METHOD_LABELS[o.method]}
                    style={{ marginTop: 3 }}
                  />
                  <span style={{ color: selected ? "var(--color-primary)" : "var(--color-text-muted)", marginTop: 1 }}>{o.icon}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 650, fontSize: 14.5 }}>{o.title}</span>
                    <span style={hint}>{o.blurb}</span>
                    {!status.ok ? <span style={{ display: "block", marginTop: 4, fontSize: 12.5, color: "var(--tone-warning)" }}>{status.reason}</span> : null}
                  </span>
                  {o.method !== "screen" ? <Readiness status={status} /> : null}
                </label>

                {selected ? (
                  <div style={{ marginTop: 12, paddingLeft: 30 }}>
                    {o.method === "linked" ? <LinkedDetails draft={draft} data={data} change={change} canManage={canManage} outletName={outlet?.name} /> : null}
                    {o.method === "whatsapp" ? <BusinessDetails draft={draft} change={change} canManage={canManage} /> : null}
                    {o.method === "sms" ? <SmsDetails data={data} outletName={outlet?.name} /> : null}
                    {o.method === "screen" ? (
                      <Note icon={<AlertTriangle size={16} />}>
                        Anyone can sign in as any phone number: the code appears on the screen, and <strong>123456</strong> is always accepted. Switch to a real way of sending before you go live.
                      </Note>
                    ) : null}
                    {!status.ok ? (
                      <Note icon={<AlertTriangle size={16} />}>
                        Until this can send, customers who try to sign in are asked to try again later.
                      </Note>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {canManage ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16 }}>
            <Button onClick={onSave} disabled={!dirty || save.isPending || Boolean(draft.method === "linked" && messageProblem(draft.linkedMessage))}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
            {dirty ? <span style={hint}>Unsaved changes</span> : null}
          </div>
        ) : (
          <p style={{ ...hint, marginTop: 14 }}>Only the owner can change this.</p>
        )}
        {save.error ? <Toast kind="error">{save.error.message}</Toast> : null}
        {saved && !dirty ? <Toast kind="ok">Saved. New sign-in codes now go out this way.</Toast> : null}
      </Card>

      <Card title="Other messages" subtitle="These already let you choose where they are set up.">
        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8, fontSize: 13.5 }}>
          <li>
            <strong>Order updates</strong> — each way has its own switch and wording under <Link to="/notifications">Notifications</Link>.
          </li>
          <li>
            <strong>Marketing</strong> — you pick the way for each campaign, on <Link to="/marketing/new">Marketing</Link>.
          </li>
          <li>
            <strong>Chat and broadcasts</strong> — always sent from your linked numbers, under <Link to="/whatsapp/chats">WhatsApp</Link>.
          </li>
        </ul>
      </Card>
    </>
  );
}

/* ------------------------------------------------------------------ pieces */

function Readiness({ status }) {
  if (status.ok) {
    return (
      <span style={{ ...chip, color: "var(--tone-success)", background: "var(--tone-success-wash)" }}>
        <CheckCircle2 size={13} /> Ready
      </span>
    );
  }
  return status.planLocked ? (
    <span style={{ ...chip, color: "var(--color-text-muted)", background: "var(--color-bg)", border: "1px solid var(--color-border)" }}>
      <Lock size={13} /> Not in your plan
    </span>
  ) : (
    <span style={{ ...chip, color: "var(--tone-warning, #92600a)", background: "var(--tone-warning-wash, #fdf3dc)" }}>
      <AlertTriangle size={13} /> Needs setting up
    </span>
  );
}

function LinkedDetails({ draft, data, change, canManage, outletName }) {
  const text = draft.linkedMessage;
  const areaRef = useRef(null);
  // where the cursor was when the box last lost focus — the Variables pop-up inserts there
  const caret = useRef({ start: text.length, end: text.length });
  const [showVariables, setShowVariables] = useState(false);
  const problem = messageProblem(text);
  const remember = (e) => {
    caret.current = { start: e.target.selectionStart, end: e.target.selectionEnd };
  };
  const insert = (key) => {
    const start = Math.min(caret.current.start, text.length);
    const end = Math.min(caret.current.end, text.length);
    const token = `{{${key}}}`;
    change({ linkedMessage: text.slice(0, start) + token + text.slice(end) });
    const at = start + token.length;
    caret.current = { start: at, end: at };
    requestAnimationFrame(() => areaRef.current?.setSelectionRange(at, at));
  };
  const sample = sampleCodeValues({ store: data.storeName, outlet: outletName });

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <label htmlFor="code-message" style={{ fontSize: 13.5, fontWeight: 650, display: "inline-flex", alignItems: "center", gap: 6 }}>
          What the message says
          <InfoHint
            title="What the message says"
            text="Sent as a normal WhatsApp message from your number. Write it over as many lines as you like — line breaks are sent as you type them. It must contain {{code}}; that is where the 6 digits go."
          />
        </label>
        <Button type="button" variant="outline" onClick={() => setShowVariables(true)} aria-haspopup="dialog" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Braces size={14} /> Variables
        </Button>
      </div>
      <textarea
        id="code-message"
        ref={areaRef}
        value={text}
        disabled={!canManage}
        rows={6}
        maxLength={1000}
        onChange={(e) => {
          remember(e);
          change({ linkedMessage: e.target.value });
        }}
        onSelect={remember}
        onBlur={remember}
        placeholder={data.defaults.linkedMessage}
        aria-label="Message sent with the code"
        style={textarea}
      />
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
        <span style={hint}>Press Enter for a new line. Leave it empty for the standard wording. Use Variables to add the code, the customer&apos;s name and more.</span>
        <span style={{ ...hint, whiteSpace: "nowrap" }}>{text.length}/1000</span>
      </div>
      {problem ? (
        <div style={{ marginTop: 8 }} data-testid="message-problem">
          <Note icon={<AlertTriangle size={16} />}>{problem}</Note>
        </div>
      ) : null}
      <div style={preview} data-testid="code-preview">
        <span style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>Preview:</span>
        <div style={bubble} data-testid="code-preview-text">
          {renderCodeMessage(text, sample, DEFAULT_WA_CODE_TEMPLATE)}
        </div>
      </div>
      {showVariables ? <VariablesModal onClose={() => setShowVariables(false)} onInsert={canManage ? insert : null} sample={sample} /> : null}

      <div style={{ marginTop: 12, fontSize: 13 }}>
        <div style={{ fontWeight: 650, marginBottom: 6 }}>Your numbers</div>
        {data.numbers.length === 0 ? (
          <span style={hint}>
            None linked yet. <Link to="/whatsapp/numbers">Link a number →</Link>
          </span>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
            {data.numbers.map((n) => (
              <li key={n.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span aria-hidden style={{ width: 8, height: 8, borderRadius: 99, background: n.online ? "var(--tone-success)" : "var(--color-border)" }} />
                {n.label}
                {n.phone ? <span style={hint}>+{n.phone}</span> : null}
                <span style={hint}>{n.online ? "online" : "not connected"}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p style={{ ...hint, margin: "12px 0 0" }}>
        Codes go out first, within seconds, from one of your connected numbers — picked at random, so no single number carries every sign-in. The code is wiped from your chat history the moment it is sent, and the customer
        doesn&apos;t appear in your WhatsApp inbox until they write to you. If every number is offline, customers are asked to try again.
      </p>
    </>
  );
}

function BusinessDetails({ draft, change, canManage }) {
  const t = draft.whatsappTemplate;
  const set = (patch) => change({ whatsappTemplate: { ...t, ...patch } });
  return (
    <>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Field
          label="Template name"
          info="The exact name of the template Meta has approved for codes. Create it as an Authentication template; its first placeholder {{1}} is filled with the code."
          style={{ flex: "1 1 240px" }}
        >
          <TextInput value={t.name} disabled={!canManage} placeholder="login_code" onChange={(e) => set({ name: e.target.value })} aria-label="Template name" />
        </Field>
        <Field label="Language code" info="The template's approved language, e.g. en or en_US." style={{ width: 140 }}>
          <TextInput value={t.language} disabled={!canManage} onChange={(e) => set({ language: e.target.value })} aria-label="Language code" />
        </Field>
      </div>
      <Checkbox
        checked={t.copyButton}
        disabled={!canManage}
        onChange={(v) => set({ copyButton: v })}
        label="My template has a “Copy code” button"
        info="Meta's Authentication templates usually have one. When it does, the code must be sent to that button as well — switch this on, or Meta will reject the message."
      />
      <p style={{ ...hint, margin: "10px 0 0" }}>
        Connection details (phone number ID and token) are under <Link to="/notifications">Notifications → WhatsApp</Link>.
      </p>
    </>
  );
}

function SmsDetails({ data, outletName }) {
  const [showVariables, setShowVariables] = useState(false);
  const sample = sampleCodeValues({ store: data.storeName, outlet: outletName });
  return (
    <>
      <div style={preview}>
        <span style={{ fontWeight: 700, display: "block", marginBottom: 6 }}>Preview:</span>
        <div style={bubble}>{renderCodeMessage(data.codes.smsMessage, sample, data.defaults.smsMessage)}</div>
      </div>
      <p style={{ ...hint, margin: "10px 0 0" }}>
        Sent through the gateway and the “Code message” you set under <Link to="/notifications">Notifications → SMS</Link> (Indian gateways only deliver messages that match a DLT-registered template). That message can use the same{" "}
        <button type="button" onClick={() => setShowVariables(true)} style={linkButton}>
          variables
        </button>
        .
      </p>
      {showVariables ? <VariablesModal onClose={() => setShowVariables(false)} onInsert={null} sample={sample} /> : null}
    </>
  );
}

/**
 * Every {{variable}} a code message can use, with what it stands for and an example. Where the message is being
 * edited, "Insert" puts the variable at the cursor and the list stays open for the next one.
 */
function VariablesModal({ onClose, onInsert, sample }) {
  const [added, setAdded] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const add = (key) => {
    onInsert(key);
    setAdded(key);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(null), 1400);
  };
  return (
    <Modal onClose={onClose} width={640} ariaLabel="Message variables">
      <div style={{ padding: 22 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 19 }}>Variables</h2>
        <p style={{ ...hint, margin: "0 0 14px" }}>
          Put a variable in your message and it is replaced for each customer.{" "}
          {onInsert ? "Click Insert to add one where your cursor was in the message." : "Write them exactly as shown, with the double curly brackets."}
        </p>
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8, maxHeight: "55vh", overflowY: "auto" }} aria-label="Available variables">
          {CODE_MESSAGE_VARIABLES.map((v) => (
            <li key={v.key} style={variableRow} data-variable={v.key}>
              <code style={variableChip}>{`{{${v.key}}}`}</code>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 650, fontSize: 13.5 }}>
                  {v.label}
                  {v.required ? <span style={{ ...hint, marginLeft: 8, color: "var(--tone-warning)" }}>required</span> : null}
                </div>
                <div style={hint}>{v.description}</div>
                <div style={{ ...hint, marginTop: 2 }}>
                  Example: <strong style={{ color: "var(--color-text)" }}>{sample[v.key] || "(empty)"}</strong>
                </div>
              </div>
              {onInsert ? (
                <Button type="button" variant="outline" onClick={() => add(v.key)} aria-label={`Insert {{${v.key}}}`}>
                  {added === v.key ? "Inserted ✓" : "Insert"}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ styles */

const hint = { fontSize: 12.5, color: "var(--color-text-muted)" };
const option = {
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  padding: "12px 14px",
  background: "var(--color-bg)",
};
const optionOn = {
  borderColor: "var(--color-primary)",
  background: "color-mix(in srgb, var(--color-primary) 6%, var(--color-bg))",
};
const chip = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontSize: 12,
  fontWeight: 650,
  padding: "3px 9px",
  borderRadius: 999,
  whiteSpace: "nowrap",
  flexShrink: 0,
};
const textarea = {
  width: "100%",
  boxSizing: "border-box",
  font: "inherit",
  fontSize: 13.5,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  resize: "vertical",
  minHeight: 120,
  lineHeight: 1.5,
  whiteSpace: "pre-wrap", // a line break typed here stays a line break
};
const preview = {
  marginTop: 10,
  fontSize: 12.5,
  padding: "8px 10px",
  borderRadius: 8,
  background: "var(--color-surface)",
  border: "1px dashed var(--color-border)",
  color: "var(--color-text-muted)",
};
// the message as the customer will read it: line breaks kept, long words wrapped
const bubble = {
  maxWidth: 420,
  padding: "8px 11px",
  borderRadius: "10px 10px 10px 2px",
  background: "color-mix(in srgb, #25d366 16%, var(--color-bg))",
  border: "1px solid color-mix(in srgb, #25d366 30%, var(--color-border))",
  color: "var(--color-text)",
  fontSize: 13.5,
  lineHeight: 1.5,
  whiteSpace: "pre-wrap",
  overflowWrap: "anywhere",
};
const variableRow = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
  padding: "10px 12px",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  background: "var(--color-bg)",
};
const variableChip = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: 12.5,
  padding: "3px 8px",
  borderRadius: 6,
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  color: "var(--color-primary)",
  whiteSpace: "nowrap",
  minWidth: 110,
  textAlign: "center",
};
const linkButton = { background: "none", border: 0, padding: 0, color: "var(--color-primary)", textDecoration: "underline", cursor: "pointer", font: "inherit" };
