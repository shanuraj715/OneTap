import { Link } from "react-router-dom";
import { AlertTriangle, Building2, LayoutDashboard, ReceiptText, Store, Users } from "lucide-react";
import { usePlatformOverview } from "../../lib/usePlatform";
import { Card, PageHeader } from "../../ui";
import { muted, planLabel, row, StatusPill, usageText } from "./shared";

/** The platform super admin's home: totals across every store, and what needs attention. */
export function PlatformOverview() {
  const q = usePlatformOverview();
  const data = q.data;

  return (
    <>
      <PageHeader title="Platform overview" icon={<LayoutDashboard size={23} />} subtitle="Every store on TablePe at a glance." />

      <div style={tiles}>
        <Tile icon={<Store size={18} />} label="Stores" value={data?.totals.stores} />
        <Tile icon={<Building2 size={18} />} label="Outlets" value={data?.totals.outlets} />
        <Tile icon={<Users size={18} />} label="People" value={data?.totals.people} />
        <Tile icon={<ReceiptText size={18} />} label="Orders today" value={data?.totals.ordersToday} />
      </div>

      <Card title="Needs attention" icon={<AlertTriangle size={16} />} subtitle="Stores over a plan limit — in their grace period, or past it.">
        {!data ? (
          <p style={muted}>{q.isError ? q.error.message : "Loading…"}</p>
        ) : data.attention.length === 0 ? (
          <p style={muted}>Every store is within its plan.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {data.attention.map((s) => (
              <Link key={s.id} to={`/platform/stores/${s.id}`} style={{ ...row, textDecoration: "none", color: "inherit" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{s.name}</div>
                  <div style={muted}>
                    {planLabel(s.plan)} · people {usageText(s.usage.users, s.max.users)} · outlets {usageText(s.usage.outlets, s.max.outlets)}
                  </div>
                </div>
                <StatusPill store={s} />
              </Link>
            ))}
          </div>
        )}
      </Card>

      {data ? (
        <Card title="Stores by plan">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {Object.entries(data.byPlan).map(([name, n]) => (
              <div key={name} style={{ ...row, flex: "0 1 auto" }}>
                <strong style={{ fontSize: 18 }}>{n}</strong>
                <span style={muted}>{name}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </>
  );
}

function Tile({ icon, label, value }) {
  return (
    <div style={tile}>
      <span style={{ color: "var(--color-primary)", display: "inline-flex" }}>{icon}</span>
      <div style={{ fontSize: 26, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{value ?? "—"}</div>
      <div style={muted}>{label}</div>
    </div>
  );
}

const tiles = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 16 };
const tile = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: 16,
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  background: "var(--color-bg)",
};
