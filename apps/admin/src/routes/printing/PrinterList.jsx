import { useState } from "react";
                                           
import { useMutation } from "@tanstack/react-query";
import {
  DOC_HINTS,
  DOC_LABELS,
  ORDER_CHANNELS,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  PAPER,
  PAPER_WIDTHS,
  PRINT_DOCS,
  PRINT_STATIONS,
  PRINT_TARGETS,
  STATION_DEFAULT_DOC,
  STATION_HINTS,
  STATION_LABELS,
  TARGETS,
                   
                  
                    
                    
                   
                     
} from "@onetap/config-schema";
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Copy,
  Cpu,
  Globe,
  KeyRound,
  Monitor,
  Plus,
  Printer as PrinterIcon,
  TestTube2,
  Trash2,
} from "lucide-react";
import { getAgentToken,                                                   } from "../../lib/api";
import { useCreatePrinter, useDeletePrinter, useTestPrint, useUpdatePrinter } from "../../lib/usePrinting";
import { Button, Card, Checkbox, Empty, Field, InfoHint, Note, Pill, Select, TextInput, Toast } from "../../ui";

const TARGET_ICON                                      = {
  browser: Monitor,
  "epos-lan": Globe,
  cloud: Cloud,
  agent: Cpu,
};

/* --------------------------------------------------------------- printers */

export function PrinterList({
  outlet,
  printers,
  templates,
  canManage,
}   
                 
                           
                             
                     
 ) {
  const [editing, setEditing] = useState                             (null);
  const test = useTestPrint(outlet);
  const remove = useDeletePrinter(outlet);

  const byStation = PRINT_STATIONS.map((s) => ({
    station: s,
    list: printers.filter((p) => p.station === s),
  })).filter((g) => g.list.length);

  return (
    <>
      <Note icon={<PrinterIcon size={15} />}>
        A printer here is one physical machine plus the rule for when it fires. Point the kitchen one at
        <strong> Accepted</strong> and the counter one at the same status, and both slips appear the moment staff
        take an order — nobody presses print.
      </Note>

      {!printers.length ? (
        <Card>
          <Empty icon={<PrinterIcon size={30} />} title="No printers yet">
            Add the counter printer first, then the kitchen one.
          </Empty>
        </Card>
      ) : null}

      {byStation.map((group) => (
        <Card
          key={group.station}
          title={STATION_LABELS[group.station]}
          subtitle={STATION_HINTS[group.station]}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {group.list.map((p) => (
              <PrinterRow
                key={p.id}
                printer={p}
                canManage={canManage}
                onEdit={() => setEditing(p)}
                onTest={() => test.mutate(p.id)}
                onDelete={() =>
                  window.confirm(`Remove "${p.name}"? Any waiting jobs on it are cancelled.`) && remove.mutate(p.id)
                }
                testing={test.isPending && test.variables === p.id}
              />
            ))}
          </div>
        </Card>
      ))}

      {test.isSuccess ? <Toast kind="ok">Test slip queued. Watch the Queue tab for the result.</Toast> : null}
      {test.error ? <Toast kind="error">{(test.error         ).message}</Toast> : null}
      {remove.error ? <Toast kind="error">{(remove.error         ).message}</Toast> : null}

      {canManage ? (
        <Button onClick={() => setEditing("new")} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <Plus size={15} /> Add a printer
        </Button>
      ) : null}

      {editing ? (
        <PrinterEditor
          outlet={outlet}
          printer={editing === "new" ? null : editing}
          templates={templates}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}

function PrinterRow({
  printer,
  canManage,
  onEdit,
  onTest,
  onDelete,
  testing,
}   
                        
                     
                     
                     
                       
                   
 ) {
  const Icon = TARGET_ICON[printer.target];
  const health = printer.configError
    ? { tone: "warn"         , text: printer.configError }
    : printer.lastError
      ? { tone: "error"         , text: printer.lastError }
      : printer.lastOkAt
        ? { tone: "ok"         , text: `Last printed ${new Date(printer.lastOkAt).toLocaleString()}` }
        : { tone: "neutral"         , text: "Not used yet" };

  return (
    <div style={row}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
          <Icon size={15} aria-hidden style={{ color: "var(--color-text-muted)" }} />
          <strong style={{ fontSize: 14 }}>{printer.name}</strong>
          {!printer.isActive ? <Pill>Paused</Pill> : null}
          <Pill tone="info">{DOC_LABELS[printer.docType]}</Pill>
          <Pill>{PAPER[printer.paperWidth].label}</Pill>
        </div>

        <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginBottom: 6 }}>
          {TARGETS[printer.target].label}
          {printer.connection.host ? ` · ${printer.connection.host}:${printer.connection.port}` : ""}
          {printer.connection.agentId ? ` · agent "${printer.connection.agentId}"` : ""}
          {printer.copies > 1 ? ` · ${printer.copies} copies` : ""}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {printer.autoPrintOn.length ? (
            printer.autoPrintOn.map((s) => (
              <Pill key={s} tone="info">
                auto @ {ORDER_STATUS_LABELS[s               ] ?? s}
              </Pill>
            ))
          ) : (
            <Pill>Manual only</Pill>
          )}
          <Pill tone={health.tone} icon={health.tone === "ok" ? <CheckCircle2 size={11} /> : health.tone === "neutral" ? undefined : <AlertTriangle size={11} />}>
            {health.text.length > 60 ? `${health.text.slice(0, 60)}…` : health.text}
          </Pill>
        </div>
      </div>

      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", alignItems: "flex-start" }}>
        <Button variant="outline" onClick={onTest} disabled={testing} style={smallBtn}>
          <TestTube2 size={13} /> {testing ? "Queuing…" : "Test"}
        </Button>
        {canManage ? (
          <>
            <Button variant="outline" onClick={onEdit} style={smallBtn}>
              Edit
            </Button>
            <Button variant="outline" onClick={onDelete} style={smallBtn} aria-label={`Remove ${printer.name}`}>
              <Trash2 size={13} />
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- editor */

const EMPTY                        = {
  name: "",
  station: "counter",
  docType: "receipt",
  target: "browser",
  paperWidth: "80mm",
  templateId: null,
  connection: { host: "", port: 80, useTls: false, deviceId: "local_printer", cloudPrinterId: "", cloudApiKey: "", agentId: "", queueName: "" },
  autoPrintOn: ["accepted"],
  channels: [],
  copies: 1,
  cutAfter: true,
  openDrawer: false,
  isActive: true,
};

function PrinterEditor({
  outlet,
  printer,
  templates,
  onClose,
}   
                 
                               
                             
                      
 ) {
  const [form, setForm] = useState                       (() =>
    printer
      ? {
          name: printer.name,
          station: printer.station,
          docType: printer.docType,
          target: printer.target,
          paperWidth: printer.paperWidth,
          templateId: printer.templateId,
          // The stored cloud key comes back masked; blank means "leave it alone".
          connection: { ...printer.connection, cloudApiKey: "" },
          autoPrintOn: printer.autoPrintOn,
          channels: printer.channels,
          copies: printer.copies,
          cutAfter: printer.cutAfter,
          openDrawer: printer.openDrawer,
          isActive: printer.isActive,
        }
      : EMPTY,
  );

  const create = useCreatePrinter(outlet);
  const update = useUpdatePrinter(outlet);
  const busy = create.isPending || update.isPending;
  const error = (create.error ?? update.error)                ;

  const set = (patch                       ) => setForm((f) => ({ ...f, ...patch }));
  const setConn = (patch                                     ) =>
    setForm((f) => ({ ...f, connection: { ...f.connection, ...patch } }));

  const target = (form.target ?? "browser")               ;
  const meta = TARGETS[target];
  const thermal = PAPER[(form.paperWidth ?? "80mm")              ].continuous;
  const usable = templates.filter((t) => t.docType === form.docType);

  const submit = (e                 ) => {
    e.preventDefault();
    // An empty key field means "keep the saved one", so drop it rather than
    // sending a blank that would look like a deliberate clear.
    const { cloudApiKey, ...conn } = form.connection ?? {};
    const body                        = {
      ...form,
      connection: cloudApiKey ? { ...conn, cloudApiKey } : conn,
    };

    if (printer) update.mutate({ id: printer.id, patch: body }, { onSuccess: onClose });
    else create.mutate(body, { onSuccess: onClose });
  };

  return (
    <div style={overlay} onClick={onClose} role="presentation">
      <form
        className="ot-anim-pop"
        style={panel}
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        aria-label={printer ? `Edit ${printer.name}` : "Add a printer"}
      >
        <h3 style={{ margin: "0 0 18px", fontFamily: "var(--font-heading)", fontSize: 19 }}>
          {printer ? `Edit ${printer.name}` : "Add a printer"}
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
          <Field
            label="Name"
            info="What staff will call this printer in the queue and on the order screen. Use where it physically is — 'Kitchen Epson', 'Counter roll' — so the right person knows which machine to check when a job fails."
            style={{ maxWidth: "none" }}
          >
            <TextInput value={form.name ?? ""} onChange={(e) => set({ name: e.target.value })} required placeholder="Kitchen Epson" />
          </Field>

          <Field
            label="Station"
            info="Where this printer sits. It decides what gets sent here — the kitchen station prints tickets with no prices, the counter prints the customer's receipt."
            hint={STATION_HINTS[(form.station ?? "counter")                ]}
            style={{ maxWidth: "none" }}
          >
            <Select
              value={form.station}
              onChange={(e) => {
                const station = e.target.value                ;
                set({ station, docType: STATION_DEFAULT_DOC[station] });
              }}
            >
              {PRINT_STATIONS.map((s) => (
                <option key={s} value={s}>{STATION_LABELS[s]}</option>
              ))}
            </Select>
          </Field>

          <Field
            label="Document"
            info="Which slip this printer produces. A kitchen ticket deliberately omits prices and tax so cooks read item names fast; a receipt carries the money and the legal numbers."
            hint={DOC_HINTS[(form.docType ?? "receipt")                ]}
            style={{ maxWidth: "none" }}
          >
            <Select value={form.docType} onChange={(e) => set({ docType: e.target.value                , templateId: null })}>
              {PRINT_DOCS.map((d) => (
                <option key={d} value={d}>{DOC_LABELS[d]}</option>
              ))}
            </Select>
          </Field>

          <Field
            label="Paper size"
            info="The roll or sheet loaded in this printer. It sets how many characters fit on a line, so getting it wrong makes item names wrap in the wrong place."
            hint={PAPER[(form.paperWidth ?? "80mm")              ].hint}
            style={{ maxWidth: "none" }}
          >
            <Select value={form.paperWidth} onChange={(e) => set({ paperWidth: e.target.value               })}>
              {PAPER_WIDTHS.map((w) => (
                <option key={w} value={w}>{PAPER[w].label}</option>
              ))}
            </Select>
          </Field>

          <Field
            label="Template"
            info="The layout this printer uses. Leave it on the default unless you have made a second version — for example a bigger-type kitchen ticket for a noisy kitchen."
            style={{ maxWidth: "none" }}
          >
            <Select value={form.templateId ?? ""} onChange={(e) => set({ templateId: e.target.value || null })}>
              <option value="">Default for this document</option>
              {usable.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </Field>
        </div>

        {/* ------------------------------------------------------ connection */}

        <Field
          label="How it connects"
          info="How the job reaches the printer. A web page cannot open a raw connection to a printer by itself, so every silent option needs something on site — this is that choice."
          hint={meta.hint}
        >
          <Select value={target} onChange={(e) => set({ target: e.target.value                })}>
            {PRINT_TARGETS.map((t) => (
              <option key={t} value={t}>{TARGETS[t].label}</option>
            ))}
          </Select>
        </Field>

        <div style={caveat}>
          <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{meta.caveat}</span>
        </div>

        {target === "epos-lan" ? (
          <>
            <Field
              label="Printer IP address"
              info="The address the printer shows on its self-test page — hold the feed button while switching it on. It must be on the same network as this computer."
            >
              <TextInput value={form.connection?.host ?? ""} onChange={(e) => setConn({ host: e.target.value })} placeholder="192.168.1.50" />
            </Field>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Field label="Port" info="Almost always 80. Change it only if you configured the printer differently." style={{ maxWidth: 120 }}>
                <TextInput type="number" value={form.connection?.port ?? 80} onChange={(e) => setConn({ port: Number(e.target.value) || 80 })} />
              </Field>
              <Field
                label="Device id"
                info="EPSON's name for the print head inside the printer. On every TM model this is local_printer — change it only if EPSON's own tool shows something else."
                style={{ maxWidth: 200 }}
              >
                <TextInput value={form.connection?.deviceId ?? ""} onChange={(e) => setConn({ deviceId: e.target.value })} placeholder="local_printer" />
              </Field>
            </div>
            <Checkbox
              checked={Boolean(form.connection?.useTls)}
              onChange={(v) => setConn({ useTls: v })}
              label="Printer uses https"
              info="Turn this on only if you installed a certificate on the printer. It matters because a browser on an https page refuses to talk to a plain http printer — that block is the most common reason ePOS printing fails."
            />
          </>
        ) : null}

        {target === "cloud" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <Field
              label="Cloud printer id"
              info="The id your cloud print account gives this printer. In PrintNode it is the number shown beside the printer in their dashboard."
              style={{ maxWidth: "none" }}
            >
              <TextInput value={form.connection?.cloudPrinterId ?? ""} onChange={(e) => setConn({ cloudPrinterId: e.target.value })} placeholder="70123456" />
            </Field>
            <Field
              label="API key"
              info="The secret for your cloud print account. It is encrypted before it is stored and never sent back to this screen — leave it blank to keep the key already saved."
              hint={printer?.cloudApiKeySet ? "A key is already saved. Type a new one only to replace it." : "Required before this printer can print."}
              style={{ maxWidth: "none" }}
            >
              <TextInput
                type="password"
                autoComplete="off"
                value={form.connection?.cloudApiKey ?? ""}
                onChange={(e) => setConn({ cloudApiKey: e.target.value })}
                placeholder={printer?.cloudApiKeySet ? "•••••••• saved" : ""}
              />
            </Field>
            </div>
          </>
        ) : null}

        {target === "agent" ? <AgentFields outlet={outlet} printer={printer} form={form} setConn={setConn} /> : null}

        {/* ------------------------------------------------------ automation */}

        <fieldset style={fieldset}>
          <legend style={legend}>
            When should this print automatically?
            <InfoHint
              title="Automatic printing"
              text="Tick the points in an order's life where this printer should fire on its own. Accepted is the usual choice: the moment staff take the order, the kitchen ticket and the counter receipt both appear. Tick nothing to keep this printer manual."
            />
          </legend>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {ORDER_STATUSES.filter((s) => s !== "cancelled").map((s) => (
              <Checkbox
                key={s}
                checked={(form.autoPrintOn ?? []).includes(s)}
                onChange={(v) =>
                  set({
                    autoPrintOn: v
                      ? [...(form.autoPrintOn ?? []), s]
                      : (form.autoPrintOn ?? []).filter((x) => x !== s),
                  })
                }
                label={ORDER_STATUS_LABELS[s]}
              />
            ))}
          </div>
        </fieldset>

        <fieldset style={fieldset}>
          <legend style={legend}>
            Only for these order types
            <InfoHint
              title="Order types"
              text="Leave all of these unticked and the printer takes every order. Tick some to narrow it — for example a packing printer that should only fire for takeaway and delivery, never for a table."
            />
          </legend>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {ORDER_CHANNELS.map((c) => (
              <Checkbox
                key={c}
                checked={(form.channels ?? []).includes(c)}
                onChange={(v) =>
                  set({ channels: v ? [...(form.channels ?? []), c] : (form.channels ?? []).filter((x) => x !== c) })
                }
                label={c}
              />
            ))}
          </div>
        </fieldset>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Field
            label="Copies"
            info="How many identical slips to print each time. Two is common at the counter — one for the customer and one that stays in the drawer for the day's reconciliation."
            style={{ maxWidth: 110 }}
          >
            <TextInput type="number" min={1} max={5} value={form.copies ?? 1} onChange={(e) => set({ copies: Number(e.target.value) || 1 })} />
          </Field>
        </div>

        {thermal && target !== "browser" ? (
          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 14 }}>
            <Checkbox
              checked={Boolean(form.cutAfter)}
              onChange={(v) => set({ cutAfter: v })}
              label="Cut the paper"
              info="Tells the printer to cut the roll after each slip. Turn it off only for a printer with no cutter, where staff tear the paper by hand."
            />
            <Checkbox
              checked={Boolean(form.openDrawer)}
              onChange={(v) => set({ openDrawer: v })}
              label="Open the cash drawer"
              info="Sends the pulse that pops a cash drawer wired into the back of this printer. Only useful at the counter, and only if a drawer is actually plugged in."
            />
          </div>
        ) : null}

        <Checkbox
          checked={Boolean(form.isActive)}
          onChange={(v) => set({ isActive: v })}
          label="Printer is in use"
          info="Untick to stop this printer receiving jobs without deleting it — useful while a machine is away being repaired."
        />

        {error ? <Toast kind="error">{error.message}</Toast> : null}

        <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--color-border)" }}>
          <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : printer ? "Save changes" : "Add printer"}</Button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------ agent fields */

function AgentFields({
  outlet,
  printer,
  form,
  setConn,
}   
                 
                               
                              
                                                            
 ) {
  const [token, setToken] = useState               (null);
  const fetchToken = useMutation({
    mutationFn: () => getAgentToken(outlet, printer .id),
    onSuccess: (r) => setToken(r.token),
  });

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <Field
          label="Agent id"
          info="A name you choose for the computer that will do the printing — 'counter-pc', 'kitchen-pi'. You type the same name when installing the agent, and it is how this printer's jobs find that machine."
          style={{ maxWidth: "none" }}
        >
          <TextInput value={form.connection?.agentId ?? ""} onChange={(e) => setConn({ agentId: e.target.value })} placeholder="counter-pc" />
        </Field>

        <Field
          label="Printer queue name"
          info="The name this printer has in the operating system of that computer — exactly as it appears in Windows' Printers list or macOS' Printers & Scanners."
          style={{ maxWidth: "none" }}
        >
          <TextInput value={form.connection?.queueName ?? ""} onChange={(e) => setConn({ queueName: e.target.value })} placeholder="EPSON TM-T82" />
        </Field>
      </div>

      {printer ? (
        <div style={{ marginBottom: 14 }}>
          <Button variant="outline" type="button" onClick={() => fetchToken.mutate()} disabled={fetchToken.isPending} style={smallBtn}>
            <KeyRound size={13} /> {fetchToken.isPending ? "Generating…" : "Show agent token"}
          </Button>
          {token ? (
            <div style={{ marginTop: 9 }}>
              <div style={tokenBox}>
                <code style={{ fontSize: 11.5, wordBreak: "break-all" }}>{token}</code>
                <button type="button" onClick={() => void navigator.clipboard?.writeText(token)} style={copyBtn} aria-label="Copy token">
                  <Copy size={13} />
                </button>
              </div>
              <p style={{ fontSize: 11.5, color: "var(--color-text-muted)", margin: "6px 0 0" }}>
                Paste this into the agent when you install it. Treat it like a password.
              </p>
            </div>
          ) : null}
          {fetchToken.error ? <Toast kind="error">{(fetchToken.error         ).message}</Toast> : null}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: -4, marginBottom: 14 }}>
          Save the printer first, then reopen it to get the agent&apos;s token.
        </p>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ styles */

const row                = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "flex-start",
  padding: "13px 14px",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  background: "var(--color-bg)",
};
const smallBtn                = { fontSize: 12.5, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 };
const overlay                = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "grid",
  placeItems: "center",
  padding: 16,
  zIndex: 60,
  overflowY: "auto",
};
const panel                = {
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: 14,
  padding: 24,
  width: "100%",
  maxWidth: 520,
  maxHeight: "90vh",
  overflowY: "auto",
};
const fieldset                = {
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  padding: "12px 14px 14px",
  marginBottom: 14,
};
const legend                = { fontSize: 12.5, fontWeight: 600, padding: "0 6px", display: "inline-flex", alignItems: "center", gap: 6 };
const caveat                = {
  display: "flex",
  gap: 8,
  padding: "9px 11px",
  borderRadius: 8,
  background: "var(--tone-warning-wash)",
  color: "var(--tone-warning)",
  fontSize: 12,
  lineHeight: 1.45,
  marginBottom: 14,
};
const tokenBox                = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 11px",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
};
const copyBtn                = {
  font: "inherit",
  flexShrink: 0,
  display: "grid",
  placeItems: "center",
  width: 26,
  height: 26,
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  background: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
};
