import { useMemo } from "react";
import { DatePickerInput, formatDate } from "@onetap/ui";
import { daysBetween, RANGE_PRESETS } from "@onetap/config-schema";
import { BarChart3, Calculator, Clock, FileDown, Lock, Package, Scale, TrendingUp, Users as UsersIcon } from "lucide-react";
import { NotFoundSection } from "../../components/NotFoundSection";
import { SubNav } from "../../components/SubNav";
import { useAnFilters, useAnOptions } from "../../lib/useAnalytics";
import { useAuth } from "../../lib/useAuth";
import { useStorePlan } from "../../lib/useStorePlan";
import { Card, Empty, PageHeader, Select } from "../../ui";
import "../platform/viz/viz.css";

const longDay = (key) => new Date(`${key}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/**
 * Every Analytics page sits in this: the plan must include Analytics (otherwise a notice), the person must have
 * analytics:read (otherwise the page doesn't exist for them), then the title, the tabs, and the date range + outlet
 * choice that all the tabs share. `needs` = an extra permission for the page ("analytics:finance" / "analytics:export"),
 * or a list of them when any one of them is enough.
 */
export function AnalyticsShell({ children, needs, subtitle = "How the store is doing — and what to do about it.", bar = true }) {
  const { plan, loading, hasFeature } = useStorePlan();
  const { can } = useAuth();
  const filters = useAnFilters();
  const opts = useAnOptions();
  if (loading) return null;
  if (plan && !hasFeature("analytics")) {
    return (
      <>
        <PageHeader title="Analytics" icon={<BarChart3 size={23} />} subtitle={subtitle} />
        <Card>
          <Empty icon={<Lock size={26} />} title="Analytics isn't in your plan">
            Ask TablePe to add it to your plan and this page will open — your sales data is already being collected.
          </Empty>
        </Card>
      </>
    );
  }
  if (!can("analytics:read") || (needs && ![].concat(needs).some((p) => can(p)))) return <NotFoundSection />;

  const canFinance = can("analytics:finance");
  const canExport = can("analytics:export");
  const many = (opts.data?.outlets?.length ?? 0) > 1;
  const q = filters.search;
  const tabs = [
    { to: `/analytics/overview${q}`, label: "Overview", icon: <BarChart3 size={14} /> },
    { to: `/analytics/sales${q}`, label: "Sales", icon: <TrendingUp size={14} /> },
    { to: `/analytics/items${q}`, label: "Items & stock", icon: <Package size={14} /> },
    { to: `/analytics/customers${q}`, label: "Customers", icon: <UsersIcon size={14} /> },
    ...(many ? [{ to: `/analytics/compare${q}`, label: "Compare outlets", icon: <Scale size={14} /> }] : []),
    { to: `/analytics/operations${q}`, label: "Operations", icon: <Clock size={14} /> },
    ...(canFinance ? [{ to: `/analytics/profit${q}`, label: "Profit & loss", icon: <Calculator size={14} /> }] : []),
    ...(canExport || canFinance ? [{ to: `/analytics/reports${q}`, label: "Reports", icon: <FileDown size={14} /> }] : []),
  ];

  return (
    <>
      <PageHeader title="Analytics" icon={<BarChart3 size={23} />} subtitle={subtitle} />
      <SubNav items={tabs} />
      {bar ? <FilterBar filters={filters} outlets={opts.data?.outlets ?? []} /> : null}
      <div className="dash viz" style={{ marginTop: 14 }}>{children}</div>
    </>
  );
}

/** The range and the outlet — what every number on the page is about. */
export function FilterBar({ filters, outlets, hideOutlet = false }) {
  const { preset, range, outlets: chosen, set } = filters;
  const asKey = (v) => (typeof v === "string" ? v : formatDate(v));
  const n = daysBetween(range.from, range.to);
  return (
    <div style={bar} role="group" aria-label="Date range and outlet">
      <label style={field}>
        <span style={cap}>Period</span>
        <Select value={preset} onChange={(e) => set(e.target.value === "custom" ? { range: "custom", from: range.from, to: range.to } : { range: e.target.value, from: null, to: null })} aria-label="Period">
          {RANGE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          <option value="custom">Custom dates…</option>
        </Select>
      </label>
      {preset === "custom" ? (
        <>
          <div style={field}><span style={cap}>From</span><DatePickerInput value={range.from} onChange={(v) => set({ range: "custom", from: asKey(v), to: range.to < asKey(v) ? asKey(v) : range.to })} placeholder="Start date" /></div>
          <div style={field}><span style={cap}>To</span><DatePickerInput value={range.to} onChange={(v) => set({ range: "custom", to: asKey(v), from: range.from > asKey(v) ? asKey(v) : range.from })} placeholder="End date" /></div>
        </>
      ) : null}
      {!hideOutlet && outlets.length > 1 ? (
        <label style={field}>
          <span style={cap}>Outlet</span>
          <Select value={chosen.length === 1 ? chosen[0] : "all"} onChange={(e) => set({ outlets: e.target.value === "all" ? null : e.target.value })} aria-label="Outlet">
            <option value="all">Whole store</option>
            {outlets.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </Select>
        </label>
      ) : null}
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 13, color: "var(--color-text-muted)" }} data-range-text>{longDay(range.from)} – {longDay(range.to)} · {n} day{n === 1 ? "" : "s"}</span>
    </div>
  );
}

const bar = { display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end", padding: "12px 14px", marginTop: 12, border: "1px solid var(--color-border)", borderRadius: 12, background: "var(--color-bg)" };
const field = { display: "flex", flexDirection: "column", gap: 4 };
const cap = { fontSize: 11.5, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-text-muted)" };
void useMemo;
