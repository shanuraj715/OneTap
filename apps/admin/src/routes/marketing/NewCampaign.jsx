import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MARKETING_CHANNEL_LABELS, MARKETING_MAX_RECIPIENTS, MARKETING_VARIABLES, WA_PACING } from "@onetap/config-schema";
import { AlertTriangle, CheckCircle2, Plus, Send, Upload, X } from "lucide-react";
import * as api from "../../lib/api";
import { useAuth } from "../../lib/useAuth";
import { useMkAction, useMkChannels, useMkLists, useMkOptions, useMkPreview, useDebounced } from "../../lib/useMarketing";
import { useOutlet } from "../../lib/useOutlet";
import { Button, Card, Checkbox, Field, Modal, Note, Pill, Select, Table, Td, TextInput, Th, Toast } from "../../ui";
import { emptyFilters, FilterBuilder, filtersOn, toFilters } from "./FilterBuilder";
import { MarketingHeader } from "./MarketingNav";
import { useQuery } from "@tanstack/react-query";

const SOURCE_LABELS = { customers: "Customer", whatsapp: "WhatsApp", lists: "List", numbers: "Typed in" };
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");

/**
 * Write one message and send it to the right people over the right channel — in four plain steps.
 */
export function NewCampaign() {
  const { outlet } = useOutlet();
  const { can } = useAuth();
  const canSend = can("marketing:send");
  const channels = useMkChannels();
  const lists = useMkLists();
  const [channel, setChannel] = useState("");
  const [customersOn, setCustomersOn] = useState(true);
  const [filters, setFilters] = useState(emptyFilters());
  const [waChats, setWaChats] = useState(false);
  const [listIds, setListIds] = useState([]);
  const [numbersOn, setNumbersOn] = useState(false);
  const [numbers, setNumbers] = useState("");
  const [message, setMessage] = useState("");
  const [template, setTemplate] = useState({ name: "", language: "en", params: [] });
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(null);
  const fileRef = useRef(null);
  const messageRef = useRef(null);

  const options = useMkOptions(filters.outletIds);
  const audience = useMemo(
    () => ({ customers: { enabled: customersOn, filters: toFilters(filters, options.data?.outlets ?? []) }, waChats, listIds, numbers: numbersOn ? numbers : "" }),
    [customersOn, filters, options.data, waChats, listIds, numbersOn, numbers],
  );
  const anySource = customersOn || waChats || listIds.length > 0 || (numbersOn && numbers.trim());
  const preview = useMkPreview(audience, Boolean(anySource));
  const settledNumbers = useDebounced(numbers, 500);
  const parsed = useQuery({ queryKey: ["mk-parse", outlet?._id, settledNumbers], queryFn: () => api.mkParse(outlet, settledNumbers), enabled: Boolean(outlet && numbersOn && numbers.trim()), placeholderData: (p) => p });

  const send = useMkAction((o, body) => api.mkCreateCampaign(o, body));
  const list = channels.data?.channels ?? [];
  const chosen = list.find((c) => c.id === channel);
  const total = anySource ? (preview.data?.total ?? 0) : 0;
  const isApi = channel === "wa-api";
  const messageOk = isApi ? Boolean(template.name.trim()) : Boolean(message.trim());
  const ready = Boolean(chosen?.ok) && total > 0 && !preview.data?.tooMany && messageOk && canSend;

  const insertWord = (key) => {
    const el = messageRef.current;
    const word = `{{${key}}}`;
    if (!el) return setMessage((m) => m + word);
    const a = el.selectionStart ?? message.length;
    const b = el.selectionEnd ?? message.length;
    setMessage(message.slice(0, a) + word + message.slice(b));
    setTimeout(() => { el.focus(); el.setSelectionRange(a + word.length, a + word.length); }, 0);
  };

  const readFile = async (file) => {
    if (!file) return;
    if (file.size > 2_000_000) return setError("That file is too big — keep it under 2 MB.");
    const text = await file.text();
    setNumbersOn(true);
    setNumbers((n) => (n.trim() ? `${n.trim()}\n${text}` : text));
  };

  const doSend = async () => {
    setError("");
    try {
      const body = {
        name: name.trim() || `Campaign ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`,
        channel,
        message,
        template: isApi ? { name: template.name.trim(), language: template.language.trim() || "en", params: template.params.map((p) => (p.kind === "text" ? `text:${p.text}` : p.kind)) } : null,
        audience,
      };
      const r = await send.mutateAsync(body);
      setSent(r.campaign);
      setConfirming(false);
      setMessage("");
      setName("");
    } catch (e) {
      setError(e.message);
      setConfirming(false);
    }
  };

  const sample = MARKETING_VARIABLES.reduce((acc, v) => ({ ...acc, [v.key]: v.key === "storeName" ? (outlet?.name ?? v.sample) : v.sample }), {});
  const previewText = message.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => sample[k] ?? m);

  return (
    <>
      <MarketingHeader />
      {sent ? (
        <Card>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <CheckCircle2 size={22} color="var(--tone-ok)" />
            <div style={{ flex: 1, minWidth: 220 }}>
              <strong>“{sent.name}” is on its way.</strong>
              <div style={muted}>{sent.total.toLocaleString("en-IN")} {sent.total === 1 ? "person" : "people"} · {sent.channelLabel}. Watch it under Campaigns.</div>
            </div>
            <Link to="/marketing/campaigns" style={linkBtn}>See progress</Link>
            <Button variant="outline" onClick={() => setSent(null)}>Write another</Button>
          </div>
        </Card>
      ) : null}

      <Card title="1 · How do you want to reach them?" subtitle="Only the ways you have set up can be used.">
        <div role="radiogroup" aria-label="Channel" style={grid}>
          {list.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={channel === c.id}
              aria-label={c.label}
              disabled={!c.ok}
              onClick={() => setChannel(c.id)}
              style={{ ...channelBtn, ...(channel === c.id ? channelOn : null), ...(c.ok ? null : channelOff) }}
            >
              <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <strong style={{ fontSize: 15 }}>{c.label}</strong>
                <Pill tone={c.ok ? "ok" : "neutral"}>{c.ok ? "Ready" : "Not available"}</Pill>
              </span>
              <span style={muted}>{c.ok ? c.help : c.reason}</span>
              {!c.ok && c.fix ? <Link to={c.fix} onClick={(e) => e.stopPropagation()} style={{ fontSize: 13, color: "var(--color-primary)" }}>Set it up →</Link> : null}
            </button>
          ))}
        </div>
        {channels.isLoading ? <p style={muted}>Checking…</p> : null}
        {!channels.isLoading && !list.some((c) => c.ok) ? <Toast kind="error">None of the three ways to reach customers is set up yet.</Toast> : null}
      </Card>

      <Card title="2 · Who should get it?" subtitle="Mix as many groups as you like — someone who is in two of them still gets it once. People who replied STOP on WhatsApp are always left out.">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <Checkbox label="My customers" checked={customersOn} onChange={setCustomersOn} />
            {customersOn ? (
              <div style={{ marginTop: 10 }}>
                <p style={{ ...muted, margin: "0 0 8px" }}>{filtersOn(filters) ? `${filtersOn(filters)} filter${filtersOn(filters) === 1 ? "" : "s"} on — people must match all of them.` : "No filters on — every customer with a phone number. Switch some on to narrow it down."}</p>
                <FilterBuilder value={filters} onChange={setFilters} options={options.data} />
              </div>
            ) : null}
          </div>
          <Checkbox label="People who messaged us on WhatsApp" checked={waChats} onChange={setWaChats} />
          <div>
            <Checkbox label="Saved contact lists" checked={listIds.length > 0} onChange={(v) => { if (!v) setListIds([]); else if (lists.data?.lists?.[0]) setListIds([lists.data.lists[0].id]); }} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0 0 24px" }}>
              {(lists.data?.lists ?? []).map((l) => (
                <Checkbox key={l.id} label={`${l.name} (${l.count})`} checked={listIds.includes(l.id)} onChange={(v) => setListIds(v ? [...listIds, l.id] : listIds.filter((x) => x !== l.id))} />
              ))}
              {!(lists.data?.lists ?? []).length ? <span style={muted}>No lists yet — <Link to="/marketing/lists" style={{ color: "var(--color-primary)" }}>make one</Link>.</span> : null}
            </div>
          </div>
          <div>
            <Checkbox label="Numbers I paste or upload" checked={numbersOn} onChange={setNumbersOn} />
            {numbersOn ? (
              <div style={{ margin: "10px 0 0 24px", display: "flex", flexDirection: "column", gap: 8 }}>
                <textarea aria-label="Phone numbers" rows={5} value={numbers} onChange={(e) => setNumbers(e.target.value)} placeholder={"One per line, with a name if you like:\nAsha, 98765 43210\n+91 91234 56789"} style={area} />
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <Button variant="outline" onClick={() => fileRef.current?.click()} style={withIcon}><Upload size={14} /> Upload a CSV or text file</Button>
                  <input ref={fileRef} type="file" accept=".csv,.txt,text/csv,text/plain" hidden onChange={(e) => { void readFile(e.target.files?.[0]); e.target.value = ""; }} />
                  {parsed.data ? <span style={muted}>{parsed.data.valid} usable{parsed.data.invalidCount ? ` · ${parsed.data.invalidCount} can't be used` : ""}{parsed.data.duplicates ? ` · ${parsed.data.duplicates} repeated` : ""}</span> : null}
                </div>
                {parsed.data?.invalid?.length ? <span style={{ ...muted, color: "var(--tone-error)" }}>Not used: {parsed.data.invalid.slice(0, 5).map((i) => `“${i.line}”`).join(", ")}{parsed.data.invalidCount > 5 ? "…" : ""}</span> : null}
              </div>
            ) : null}
          </div>
        </div>

        <div style={previewBox} aria-live="polite">
          {!anySource ? (
            <span style={muted}>Pick at least one group above.</span>
          ) : preview.isError ? (
            <span style={{ color: "var(--tone-error)" }}>{preview.error.message}</span>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <strong data-testid="audience-count" style={{ fontSize: 22 }}>{total.toLocaleString("en-IN")}</strong>
                <span>{total === 1 ? "person" : "people"} will get this</span>
                {preview.isFetching ? <span style={muted}>updating…</span> : null}
              </div>
              {preview.data ? <Breakdown c={preview.data.counts} /> : null}
              {preview.data?.tooMany ? <Toast kind="error">That's more than one campaign may go to ({MARKETING_MAX_RECIPIENTS.toLocaleString("en-IN")}). Narrow it down.</Toast> : null}
              {preview.data?.sample?.length ? (
                <div style={{ marginTop: 10 }}>
                  <Table minWidth={520}>
                    <thead><tr><Th>Name</Th><Th>Phone</Th><Th>From</Th><Th>Age</Th><Th>Orders</Th><Th>Last order</Th></tr></thead>
                    <tbody>
                      {preview.data.sample.map((p) => (
                        <tr key={p.phone}>
                          <Td>{p.name || <span style={muted}>—</span>}</Td>
                          <Td>{p.phone}</Td>
                          <Td>{p.sources.map((s) => SOURCE_LABELS[s] ?? s).join(", ")}</Td>
                          <Td>{p.age ?? "—"}</Td>
                          <Td>{p.orders ?? "—"}</Td>
                          <Td>{fmtDate(p.lastOrderAt)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                  {total > preview.data.sample.length ? <p style={{ ...muted, margin: "6px 0 0" }}>…and {(total - preview.data.sample.length).toLocaleString("en-IN")} more.</p> : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </Card>

      <Card title="3 · What do you want to say?" subtitle={channel ? MARKETING_CHANNEL_LABELS[channel] : "Choose how to reach them first."}>
        {isApi ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Note>Meta only lets a business start a conversation with a template it has already approved. Enter the template exactly as it was approved in Meta Business Manager, then say what fills each {"{{1}}"}, {"{{2}}"}… in it.</Note>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Field label="Template name"><TextInput value={template.name} onChange={(e) => setTemplate({ ...template, name: e.target.value })} placeholder="e.g. weekend_offer" style={{ width: 260 }} /></Field>
              <Field label="Language code"><TextInput value={template.language} onChange={(e) => setTemplate({ ...template, language: e.target.value })} style={{ width: 100 }} /></Field>
            </div>
            {template.params.map((p, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                <Field label={`Fills {{${i + 1}}}`}>
                  <Select value={p.kind} onChange={(e) => setTemplate({ ...template, params: template.params.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)) })}>
                    <option value="customerName">Customer's name</option>
                    <option value="storeName">Store name</option>
                    <option value="text">Fixed words</option>
                  </Select>
                </Field>
                {p.kind === "text" ? <Field label={`Words for {{${i + 1}}}`}><TextInput value={p.text} onChange={(e) => setTemplate({ ...template, params: template.params.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} style={{ width: 240 }} /></Field> : null}
                <Button variant="outline" aria-label={`Remove placeholder ${i + 1}`} onClick={() => setTemplate({ ...template, params: template.params.filter((_, j) => j !== i) })}><X size={14} /></Button>
              </div>
            ))}
            <div><Button variant="outline" onClick={() => setTemplate({ ...template, params: [...template.params, { kind: "customerName", text: "" }] })} style={withIcon}><Plus size={14} /> Add a placeholder</Button></div>
          </div>
        ) : (
          <>
            <textarea ref={messageRef} aria-label="Message" rows={6} maxLength={channel === "sms" ? 1000 : 3000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Hi {{customerName}}, we miss you at {{storeName}}! Show this message for 20% off this week." style={area} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
              {MARKETING_VARIABLES.map((v) => (
                <Button key={v.key} variant="outline" onClick={() => insertWord(v.key)} style={withIcon}><Plus size={13} /> {v.label}</Button>
              ))}
              <span style={{ ...muted, marginLeft: "auto" }}>{message.length} characters{channel === "sms" ? ` · about ${Math.max(1, Math.ceil(message.length / 160))} SMS part${message.length > 160 ? "s" : ""}` : ""}</span>
            </div>
            {message.trim() ? <div style={previewMsg}><div style={{ ...muted, marginBottom: 4 }}>How it looks for “{sample.customerName}”</div><div style={{ whiteSpace: "pre-wrap" }}>{previewText}</div></div> : null}
            {channel === "wa-linked" ? <p style={{ ...muted, margin: "8px 0 0" }}>“Reply STOP to stop offers.” is added at the end of every WhatsApp message.</p> : null}
            {channel === "sms" ? <p style={{ ...muted, margin: "8px 0 0" }}>In India an SMS usually has to match a template registered with your gateway (DLT) — write it the way you registered it.</p> : null}
          </>
        )}
      </Card>

      <Card title="4 · Send it">
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <Field label="Campaign name" hint="Only you see this — it names the campaign in your list."><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekend win-back" style={{ width: 280 }} /></Field>
          <span style={{ flex: 1 }} />
          <Button onClick={() => setConfirming(true)} disabled={!ready} style={withIcon}><Send size={14} /> Review and send</Button>
        </div>
        {!canSend ? <Toast kind="error">Your role can look at marketing but not send.</Toast> : null}
        {error ? <Toast kind="error">{error}</Toast> : null}
      </Card>

      {confirming ? (
        <Modal onClose={() => setConfirming(false)} width={480} ariaLabel="Send campaign">
          <div style={{ padding: 22 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 19 }}>Send to {total.toLocaleString("en-IN")} {total === 1 ? "person" : "people"}?</h2>
            <p style={{ margin: "0 0 10px", fontSize: 14 }}>Over <strong>{MARKETING_CHANNEL_LABELS[channel]}</strong>.</p>
            <div style={previewMsg}>{isApi ? `Template “${template.name}” (${template.language || "en"})` : previewText}</div>
            {channel === "wa-linked" ? (
              <p style={{ ...muted, margin: "10px 0 0", lineHeight: 1.6 }}>
                People you already chat with get it within minutes. People who never wrote to you get it slowly — {WA_PACING.cold.perDay} a day per linked number — so your numbers stay safe. Messages can't be recalled once sent.
              </p>
            ) : (
              <p style={{ ...muted, margin: "10px 0 0", lineHeight: 1.6 }}>Messages go out one after another, a few every second. They can't be recalled once sent, and your provider may charge for each one.</p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <Button variant="outline" onClick={() => setConfirming(false)}>Not now</Button>
              <Button onClick={() => void doSend()} disabled={send.isPending}>{send.isPending ? "Queuing…" : "Send now"}</Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function Breakdown({ c }) {
  const bits = [
    c.customers ? `${c.customers} customer${c.customers === 1 ? "" : "s"}` : "",
    c.waChats ? `${c.waChats} from WhatsApp chats` : "",
    c.lists ? `${c.lists} from lists` : "",
    c.numbers ? `${c.numbers} typed in` : "",
  ].filter(Boolean);
  const left = [
    c.duplicates ? `${c.duplicates} repeated` : "",
    c.optedOut ? `${c.optedOut} said STOP` : "",
    c.noPhone ? `${c.noPhone} customer${c.noPhone === 1 ? "" : "s"} without a phone number` : "",
    c.invalid ? `${c.invalid} number${c.invalid === 1 ? "" : "s"} that can't be used` : "",
  ].filter(Boolean);
  return (
    <div style={muted}>
      {bits.join(" · ")}
      {left.length ? <span style={{ display: "block", marginTop: 2 }}><AlertTriangle size={12} style={{ verticalAlign: "-1px" }} /> Left out: {left.join(", ")}.</span> : null}
    </div>
  );
}

const muted = { fontSize: 13, color: "var(--color-text-muted)" };
const withIcon = { display: "inline-flex", gap: 6, alignItems: "center" };
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 };
const channelBtn = { display: "flex", flexDirection: "column", gap: 8, textAlign: "left", padding: "14px 16px", borderRadius: 12, border: "1.5px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", cursor: "pointer", font: "inherit" };
const channelOn = { borderColor: "var(--color-primary)", boxShadow: "0 0 0 2px color-mix(in srgb, var(--color-primary) 25%, transparent)" };
const channelOff = { opacity: 0.7, cursor: "not-allowed" };
const area = { width: "100%", boxSizing: "border-box", font: "inherit", fontSize: 14, lineHeight: 1.5, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", resize: "vertical" };
const previewBox = { marginTop: 16, padding: "14px 16px", borderRadius: 12, border: "1px solid var(--color-border)", background: "var(--color-surface)" };
const previewMsg = { padding: "10px 12px", borderRadius: 10, background: "var(--color-surface)", border: "1px solid var(--color-border)", fontSize: 14, lineHeight: 1.5 };
const linkBtn = { padding: "7px 14px", borderRadius: 8, background: "var(--color-primary)", color: "var(--color-on-primary)", fontWeight: 600, fontSize: 13.5, textDecoration: "none" };
