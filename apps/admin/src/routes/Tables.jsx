import { useState } from "react";
                                           
import { useMutation } from "@tanstack/react-query";
import { formatINR, TABLE_STATUS_LABELS,                              } from "@onetap/config-schema";
import { getTableQr, rotateTableQr,                    } from "../lib/api";
import { useAuth } from "../lib/useAuth";
import { useOutlet } from "../lib/useOutlet";
import {
  useActiveSessions,
  useCloseSession,
  useCreateTable,
  useDeleteTable,
  useMoveSession,
  useTables,
} from "../lib/useTables";
import { Button, Card, Field, PageHeader, TextInput, Toast } from "../ui";

export function Tables() {
  const { outlet } = useOutlet();
  const { can } = useAuth();
  const canRead = can("table:read");
  const canManage = can("table:manage");

  const tables = useTables(outlet, canRead);
  const sessions = useActiveSessions(outlet, canRead);
  const create = useCreateTable(outlet);
  const remove = useDeleteTable(outlet);
  const [form, setForm] = useState({ number: "", zone: "", seats: "4" });
  const [qrFor, setQrFor] = useState              (null);

  if (!canRead) {
    return (
      <>
        <PageHeader title="Tables" />
        <Card>Your role can&apos;t view tables.</Card>
      </>
    );
  }

  const list = tables.data?.tables ?? [];
  const open = sessions.data?.sessions ?? [];
  const zones = [...new Set(list.map((t) => t.zone || "Main"))];

  return (
    <>
      <PageHeader title="Tables" subtitle="Floor plan, QR codes, and who's seated where." />

      {open.length > 0 ? (
        <Card title={`Seated now — ${open.length}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {open.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                tables={list}
                canManage={canManage}
                outletTables={list}
              />
            ))}
          </div>
        </Card>
      ) : null}

      {zones.map((zone) => (
        <Card key={zone} title={zone}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))", gap: 10 }}>
            {list
              .filter((t) => (t.zone || "Main") === zone)
              .map((t) => (
                <button key={t.id} type="button" className="ot-press" onClick={() => setQrFor(t)} style={{ ...tile, ...tone(t.status) }}>
                  <span style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-heading)" }}>{t.number}</span>
                  <span style={{ fontSize: 11.5, opacity: 0.85 }}>{TABLE_STATUS_LABELS[t.status]}</span>
                  <span style={{ fontSize: 11, opacity: 0.7 }}>{t.seats} seats</span>
                </button>
              ))}
          </div>
        </Card>
      ))}

      {canManage ? (
        <Card title="Add a table">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate(
                { number: form.number.trim(), zone: form.zone.trim() || undefined, seats: Number(form.seats) || 4 },
                { onSuccess: () => setForm({ number: "", zone: "", seats: "4" }) },
              );
            }}
            style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}
          >
            <Field label="Number" info="The number printed on the table itself. It appears on the QR sticker and on every kitchen ticket, so staff carrying food know where it goes — match your floor exactly."><TextInput value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} required style={{ width: 100 }} /></Field>
            <Field label="Zone" info="Groups tables on this screen — Ground, Terrace, AC Hall. Purely for finding a table quickly during service; diners never see it."><TextInput value={form.zone} placeholder="Ground" onChange={(e) => setForm({ ...form, zone: e.target.value })} style={{ width: 140 }} /></Field>
            <Field label="Seats" info="How many people the table takes. Used when deciding where to move a party, so a group of six is not offered a two-seater."><TextInput type="number" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} style={{ width: 80 }} /></Field>
            <div style={{ marginBottom: 14 }}>
              <Button type="submit" disabled={create.isPending}>{create.isPending ? "Adding…" : "Add table"}</Button>
            </div>
          </form>
          {create.error ? <Toast kind="error">{(create.error         ).message}</Toast> : null}
        </Card>
      ) : null}

      {qrFor ? (
        <QrPanel
          table={qrFor}
          canManage={canManage}
          onClose={() => setQrFor(null)}
          onDelete={() => {
            remove.mutate(qrFor.id, { onSuccess: () => setQrFor(null) });
          }}
          deleteError={(remove.error                )?.message}
        />
      ) : null}
    </>
  );
}

/* --------------------------------------------------------------- session row */

function SessionRow({
  session,
  tables,
  canManage,
}   
                         
                  
                     
                        
 ) {
  const { outlet } = useOutlet();
  const move = useMoveSession(outlet);
  const close = useCloseSession(outlet);
  const [to, setTo] = useState("");

  const free = tables.filter((t) => t.id !== session.tableId && !t.activeSessionId && t.isActive);
  const since = new Date(session.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div style={sessionRow}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>
          Table {session.tableNumber}
          {session.tableHistory.length > 1 ? (
            <span style={{ fontSize: 11.5, color: "var(--color-text-muted)", marginLeft: 8 }}>
              moved: {session.tableHistory.map((h) => h.number).join(" → ")}
            </span>
          ) : null}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
          since {since} · {session.orderCount} order{session.orderCount === 1 ? "" : "s"} · tab {formatINR(session.tab)}
        </div>
      </div>

      {canManage ? (
        <>
          <select value={to} onChange={(e) => setTo(e.target.value)} style={select} aria-label="Move to table">
            <option value="">Move to…</option>
            {free.map((t) => (
              <option key={t.id} value={t.id}>Table {t.number}</option>
            ))}
          </select>
          <Button
            variant="outline"
            disabled={!to || move.isPending}
            onClick={() => move.mutate({ sessionId: session.id, toTableId: to }, { onSuccess: () => setTo("") })}
            style={{ fontSize: 13, padding: "7px 13px" }}
          >
            Move
          </Button>
          <Button
            disabled={close.isPending}
            onClick={() => window.confirm(`Close table ${session.tableNumber}? Tab ${formatINR(session.tab)}.`) && close.mutate(session.id)}
            style={{ fontSize: 13, padding: "7px 13px" }}
          >
            Close
          </Button>
        </>
      ) : null}
      {move.error ? <Toast kind="error">{(move.error         ).message}</Toast> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ QR panel */

function QrPanel({
  table,
  canManage,
  onClose,
  onDelete,
  deleteError,
}   
               
                     
                      
                       
                       
 ) {
  const { outlet } = useOutlet();
  const [qr, setQr] = useState                                         (null);
  const load = useMutation({ mutationFn: () => getTableQr(outlet , table.id), onSuccess: setQr });
  const rotate = useMutation({ mutationFn: () => rotateTableQr(outlet , table.id), onSuccess: setQr });

  if (!qr && !load.isPending && !load.isError) load.mutate();

  return (
    <div style={overlay} onClick={onClose} role="presentation">
      <div className="ot-anim-pop" style={panel} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Table ${table.number}`}>
        <h3 style={{ margin: "0 0 4px", fontFamily: "var(--font-heading)", fontSize: 20 }}>Table {table.number}</h3>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--color-text-muted)" }}>
          {table.zone || "Main"} · {table.seats} seats · {TABLE_STATUS_LABELS[table.status]}
        </p>

        {qr ? (
          <>
            <img src={qr.dataUrl} alt={`QR code for table ${table.number}`} style={{ width: 220, height: 220, display: "block", margin: "0 auto", borderRadius: 10, background: "#fff" }} />
            <p style={{ fontSize: 11, wordBreak: "break-all", color: "var(--color-text-muted)", textAlign: "center", margin: "12px 0" }}>{qr.url}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <a href={qr.dataUrl} download={`table-${table.number}-qr.png`} style={downloadLink}>Download PNG</a>
              {canManage ? (
                <Button
                  variant="outline"
                  disabled={rotate.isPending}
                  onClick={() => window.confirm("Rotating invalidates every code already printed for this table. Continue?") && rotate.mutate()}
                >
                  {rotate.isPending ? "Rotating…" : "Rotate code"}
                </Button>
              ) : null}
            </div>
          </>
        ) : (
          <p style={{ textAlign: "center", color: "var(--color-text-muted)" }}>
            {load.isError ? `⚠ ${(load.error         ).message}` : "Generating…"}
          </p>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 20, paddingTop: 14, borderTop: "1px solid var(--color-border)" }}>
          {canManage ? (
            <Button variant="outline" onClick={onDelete} style={{ fontSize: 13 }}>Remove table</Button>
          ) : <span />}
          <Button onClick={onClose} style={{ fontSize: 13 }}>Done</Button>
        </div>
        {deleteError ? <Toast kind="error">{deleteError}</Toast> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- styles */

function tone(status             )                {
  if (status === "seated") return { background: "var(--color-primary)", color: "var(--color-on-primary)", borderColor: "var(--color-primary)" };
  if (status === "bill-requested") return { background: "var(--tone-warning-wash)", color: "var(--tone-warning)", borderColor: "var(--tone-warning)" };
  if (status === "needs-cleaning") return { background: "var(--tone-info-wash)", color: "var(--tone-info)" };
  if (status === "reserved") return { background: "var(--color-surface)", color: "var(--color-text-muted)" };
  return { background: "var(--color-bg)", color: "var(--color-text)" };
}

const tile                = {
  font: "inherit",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 2,
  padding: "14px 16px",
  minHeight: 86,
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  cursor: "pointer",
  textAlign: "left",
};
const sessionRow                = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  padding: "12px 14px",
  border: "1px solid var(--color-border)",
  borderRadius: 9,
  background: "var(--color-bg)",
};
const select                = {
  font: "inherit",
  fontSize: 13,
  padding: "7px 9px",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
};
const overlay                = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "grid",
  placeItems: "center",
  padding: 16,
  zIndex: 60,
};
const panel                = {
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: 14,
  padding: 24,
  width: "100%",
  maxWidth: 340,
  maxHeight: "88vh",
  overflowY: "auto",
};
const downloadLink                = {
  fontSize: 13,
  fontWeight: 600,
  padding: "9px 16px",
  borderRadius: "var(--radius-card)",
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  textDecoration: "none",
};
