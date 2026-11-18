import { useState } from "react";
import { DatePickerInput, formatDate } from "@onetap/ui";
import { addDays, dayKey, EXPORT_FORMATS, EXPORT_SECTIONS, presetRange } from "@onetap/config-schema";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import * as api from "../../lib/api";
import { useOutlet } from "../../lib/useOutlet";
import { useAn, useAnFilters, useAnOptions, useFinanceProfile } from "../../lib/useAnalytics";
import { Button, Card, Checkbox, Field, Note, Select, Toast } from "../../ui";
import { Figure } from "../platform/viz/charts";
import { count, rupees } from "../platform/viz/format";
import { AnalyticsShell } from "./AnalyticsShell";

const PERIODS = [
  { group: "Weekly", items: [["thisWeek", "This week (Mon–Sun)"], ["lastWeek", "Last week"], ["last7", "Last 7 days"]] },
  { group: "Monthly", items: [["thisMonth", "This month"], ["lastMonth", "Last month"], ["last30", "Last 30 days"]] },
  { group: "Yearly", items: [["thisYear", "This year"], ["lastYear", "Last year"]] },
  { group: "Other", items: [["custom", "Custom dates…"]] },
];
const ICON = { xlsx: FileSpreadsheet, csv: FileText, pdf: FileText, json: FileText };

export function Reports() {
  const filters = useAnFilters();
  const opts = useAnOptions();
  const fin = useFinanceProfile(true);
  const { outlet } = useOutlet();
  const outlets = opts.data?.outlets ?? [];
  const canFinance = opts.data?.canFinance ?? false;
  const canExport = opts.data?.canExport ?? false;

  const [format, setFormat] = useState("xlsx");
  const [period, setPeriod] = useState("lastMonth");
  const [custom, setCustom] = useState({ from: addDays(dayKey(new Date()), -29), to: dayKey(new Date()) });
  const [outletId, setOutletId] = useState("all");
  const [picked, setPicked] = useState(["summary", "daily", "items", "channels", "payments", "outlets", "gst", "customers"]);
  const [csvSection, setCsvSection] = useState("daily");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");

  const range = period === "custom" ? custom : presetRange(period);
  const sections = EXPORT_SECTIONS.filter((s) => (canFinance || (!s.finance && s.id !== "gst")) && (s.id !== "outlets" || outlets.length > 1));
  const hasExpenses = Object.values(fin.state.scopes).some((l) => l.some((x) => x.monthly > 0));
  const asKey = (v) => (typeof v === "string" ? v : formatDate(v));

  const download = async () => {
    setBusy(true);
    setError("");
    setDone("");
    try {
      const wantsPnl = (format === "csv" ? csvSection === "pnl" : picked.includes("pnl"));
      const shared = Object.values(fin.state.scopes);
      // a single outlet gets its own bills plus the shared ones; the whole store gets every bill
      const lines = outletId === "all" ? shared.flat() : [...(fin.state.scopes[outletId] ?? []), ...(fin.state.scopes.store ?? [])];
      const pnl = wantsPnl ? { foodCostPct: fin.state.foodCostPct, expenses: lines.map((l) => ({ label: l.label, monthly: l.monthly })).filter((l) => l.monthly > 0) } : null;
      const { blob, filename } = await api.anExport(outlet, {
        format, from: range.from, to: range.to, outletIds: outletId === "all" ? [] : [outletId], sections: format === "csv" ? [] : picked, section: csvSection, pnl,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setDone(filename);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnalyticsShell needs={["analytics:export", "analytics:finance"]} subtitle="Reports to download, your GST, and the till.">
      {canExport ? (
        <Card title="Download a report" icon={<Download size={16} />} subtitle="Choose a file type, a period and what goes in it.">
          <div role="radiogroup" aria-label="File type" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginBottom: 16 }}>
            {EXPORT_FORMATS.map((f) => {
              const I = ICON[f.id];
              return (
                <button key={f.id} type="button" role="radio" aria-checked={format === f.id} aria-label={f.label} onClick={() => setFormat(f.id)} style={{ ...fmtBtn, ...(format === f.id ? fmtOn : null) }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}><I size={16} /><strong>{f.label}</strong></span>
                  <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>{f.help}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
            <Field label="Period">
              <Select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Report period">
                {PERIODS.map((g) => <optgroup key={g.group} label={g.group}>{g.items.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</optgroup>)}
              </Select>
            </Field>
            {period === "custom" ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={cap}>From</span><DatePickerInput value={custom.from} onChange={(v) => setCustom({ ...custom, from: asKey(v), to: custom.to < asKey(v) ? asKey(v) : custom.to })} placeholder="Start date" /></div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={cap}>To</span><DatePickerInput value={custom.to} onChange={(v) => setCustom({ ...custom, to: asKey(v), from: custom.from > asKey(v) ? asKey(v) : custom.from })} placeholder="End date" /></div>
              </>
            ) : null}
            {outlets.length > 1 ? (
              <Field label="Which outlets">
                <Select value={outletId} onChange={(e) => setOutletId(e.target.value)} aria-label="Report outlets">
                  <option value="all">Whole store</option>
                  {outlets.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
                </Select>
              </Field>
            ) : null}
          </div>
          <p style={{ margin: "10px 0 14px", fontSize: 13, color: "var(--color-text-muted)" }} data-report-range>{range.from} to {range.to}</p>

          {format === "csv" ? (
            <Field label="Which table" hint="A CSV holds one table. Pick Excel to get every section in one file.">
              <Select value={csvSection} onChange={(e) => setCsvSection(e.target.value)} aria-label="CSV table">
                {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </Field>
          ) : (
            <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
              <legend style={cap}>What to include</legend>
              <div style={{ display: "flex", gap: "6px 20px", flexWrap: "wrap", marginTop: 6 }}>
                {sections.map((s) => <Checkbox key={s.id} label={s.label} checked={picked.includes(s.id)} onChange={(v) => setPicked(v ? [...picked, s.id] : picked.filter((x) => x !== s.id))} />)}
              </div>
            </fieldset>
          )}
          {(format === "csv" ? csvSection === "pnl" : picked.includes("pnl")) && !hasExpenses ? <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--tone-warning, #b45309)" }}>No expenses have been entered yet (Profit &amp; loss tab), so the profit &amp; loss part will only show the food cost.</p> : null}

          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
            <Button onClick={() => void download()} disabled={busy || (format !== "csv" && !picked.length)} style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><Download size={14} /> {busy ? "Preparing…" : `Download ${EXPORT_FORMATS.find((f) => f.id === format).label}`}</Button>
            {done ? <span style={{ fontSize: 13, color: "var(--tone-ok, #1a7f45)" }} data-downloaded>Downloaded {done}</span> : null}
          </div>
          {error ? <Toast kind="error">{error}</Toast> : null}
        </Card>
      ) : <Note>Your role can look at the figures below but can't download reports.</Note>}

      {canFinance ? <Gst filters={filters} /> : null}
      {canFinance ? <CashClose filters={filters} /> : null}
    </AnalyticsShell>
  );
}

function Gst({ filters }) {
  const q = useAn("gst", filters);
  const d = q.data;
  return (
    <Figure title="GST" subtitle="Taxable value and tax collected on paid orders, day by day — for your accountant" busy={q.isFetching}>
      {!d ? <p style={muted}>{q.isError ? q.error.message : "Loading…"}</p> : (
        <div className="viz-tablewrap" style={{ maxHeight: 340 }}>
          <table className="viz-table viz" aria-label="GST by day">
            <thead><tr><th>Day</th><th className="r">Orders</th><th className="r">Taxable value</th><th className="r">CGST</th><th className="r">SGST</th><th className="r">Total GST</th><th className="r">Invoice total</th></tr></thead>
            <tbody>
              {d.days.map((r) => <tr key={r.day}><td>{r.day}</td><td className="r">{count(r.orders)}</td><td className="r">{rupees(r.taxable)}</td><td className="r">{rupees(r.cgst)}</td><td className="r">{rupees(r.sgst)}</td><td className="r">{rupees(r.tax)}</td><td className="r">{rupees(r.total)}</td></tr>)}
              <tr style={{ fontWeight: 700 }} data-gst-total><td>Total</td><td className="r">{count(d.totals.orders)}</td><td className="r">{rupees(d.totals.taxable)}</td><td className="r">{rupees(d.totals.cgst)}</td><td className="r">{rupees(d.totals.sgst)}</td><td className="r">{rupees(d.totals.tax)}</td><td className="r">{rupees(d.totals.total)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </Figure>
  );
}

function CashClose({ filters }) {
  const [day, setDay] = useState(dayKey(new Date()));
  const q = useAn("cash", { ...filters, range: { from: day, to: day } });
  const d = q.data;
  return (
    <Figure
      title="Daily cash close"
      subtitle="What came in, how, on one day — to match against the till and the bank"
      busy={q.isFetching}
      actions={<DatePickerInput value={day} onChange={(v) => setDay(typeof v === "string" ? v : formatDate(v))} placeholder="Pick a day" />}
    >
      {!d ? <p style={muted}>{q.isError ? q.error.message : "Loading…"}</p> : (
        <div className="viz-tablewrap"><table className="viz-table viz" aria-label="Daily cash close"><thead><tr><th>Paid by</th><th className="r">Orders</th><th className="r">Amount</th></tr></thead>
          <tbody>
            {d.rows.map((r) => <tr key={r.id}><td>{r.label}</td><td className="r">{count(r.orders)}</td><td className="r">{rupees(r.amount)}</td></tr>)}
            {!d.rows.length ? <tr><td colSpan={3} style={{ color: "var(--viz-ink-muted, #777)" }}>Nothing was paid on {day}.</td></tr> : null}
            <tr style={{ fontWeight: 700 }}><td>Collected</td><td className="r">{count(d.rows.reduce((a, r) => a + r.orders, 0))}</td><td className="r" data-collected>{rupees(d.collected)}</td></tr>
            <tr><td>Still unpaid (placed, not paid yet)</td><td className="r">{count(d.pending.orders)}</td><td className="r">{rupees(d.pending.amount)}</td></tr>
            <tr><td>Cancelled</td><td className="r">{count(d.cancelled.orders)}</td><td className="r">{rupees(d.cancelled.amount)}</td></tr>
          </tbody></table></div>
      )}
    </Figure>
  );
}
const muted = { margin: 0, fontSize: 13, color: "var(--color-text-muted)" };
const cap = { fontSize: 11.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-text-muted)" };
const fmtBtn = { display: "flex", flexDirection: "column", gap: 6, textAlign: "left", padding: "12px 14px", borderRadius: 12, border: "1.5px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", cursor: "pointer", font: "inherit" };
const fmtOn = { borderColor: "var(--color-primary)", boxShadow: "0 0 0 2px color-mix(in srgb, var(--color-primary) 25%, transparent)" };
