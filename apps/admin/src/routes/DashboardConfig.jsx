import { useEffect, useState } from "react";
                                           
import {
  DASHBOARD_WIDGET_CATALOG,
  resolveDashboardWidgets,
  ROLE_LABELS,
  ROLES,
                               
            
} from "@onetap/config-schema";
import { BarChart3, ChevronDown, ChevronUp, LayoutGrid, ListTree, Save } from "lucide-react";
import { useAuth } from "../lib/useAuth";
import { useOutlet, usePatchConfig } from "../lib/useOutlet";
import { Button, Card, InfoHint, PageHeader, Toast } from "../ui";

const CATEGORY_LABEL = { stat: "Stat card", chart: "Chart", list: "List" }         ;
const CATEGORY_ICON = { stat: LayoutGrid, chart: BarChart3, list: ListTree }         ;

export function DashboardConfig() {
  const { outlet } = useOutlet();
  const { can } = useAuth();
  const patch = usePatchConfig();
  const [widgets, setWidgets] = useState                                  (null);

  useEffect(() => {
    if (outlet && !widgets) setWidgets(resolveDashboardWidgets(outlet.config.dashboard));
  }, [outlet, widgets]);

  if (!can("dashboard:configure")) {
    return (
      <>
        <PageHeader title="Configure dashboard" />
        <Card>Your role can&apos;t configure the dashboard.</Card>
      </>
    );
  }
  if (!outlet || !widgets) {
    return (
      <>
        <PageHeader title="Configure dashboard" />
        <Card>Seed an outlet from the Dashboard first.</Card>
      </>
    );
  }

  const stored = resolveDashboardWidgets(outlet.config.dashboard);
  const dirty = JSON.stringify(widgets) !== JSON.stringify(stored);

  const save = () => patch.mutate({ outlet, patch: { dashboard: { widgets } } }, { onSuccess: () => undefined });

  const move = (index        , dir        ) => {
    const next = [...widgets];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j] , next[index] ];
    setWidgets(next);
  };
  const setWidget = (index        , patchValue                                  ) => {
    const next = [...widgets];
    next[index] = { ...next[index] , ...patchValue };
    setWidgets(next);
  };
  const toggleRole = (index        , role      ) => {
    const w = widgets[index] ;
    const roles = w.roles.includes(role) ? w.roles.filter((r) => r !== role) : [...w.roles, role];
    setWidget(index, { roles });
  };

  return (
    <>
      <PageHeader
        title="Configure dashboard"
        icon={<LayoutGrid size={23} />}
        subtitle="Turn widgets on or off, and choose which roles see each one on their own dashboard."
        action={
          <Button onClick={save} disabled={!dirty || patch.isPending} style={{ display: "inline-flex", gap: 7, alignItems: "center" }}>
            <Save size={14} />
            {patch.isPending ? "Saving…" : dirty ? "Save changes" : "Saved"}
          </Button>
        }
      />

      <Card>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.6 }}>
          Every widget is computed from this outlet&apos;s real data — there&apos;s nothing to configure per widget
          beyond whether it shows, to whom, and where in the order. A role sees a widget on its dashboard only when
          it&apos;s <strong>on</strong> and that role is <strong>ticked</strong> below, including your own — untick
          every role from a widget and nobody sees it, yourself included.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {widgets.map((w, i) => {
            const meta = DASHBOARD_WIDGET_CATALOG[w.id];
            const CategoryIcon = CATEGORY_ICON[meta.category];
            return (
              <div key={w.id} style={{ ...row, opacity: w.enabled ? 1 : 0.55 }}>
                <div style={reorderCol}>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={reorderBtn} aria-label="Move up">
                    <ChevronUp size={13} />
                  </button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === widgets.length - 1} style={reorderBtn} aria-label="Move down">
                    <ChevronDown size={13} />
                  </button>
                </div>

                <label style={{ display: "inline-flex", alignItems: "center", marginTop: 2 }}>
                  <input
                    type="checkbox"
                    checked={w.enabled}
                    onChange={(e) => setWidget(i, { enabled: e.target.checked })}
                    style={{ width: 16, height: 16, accentColor: "var(--color-primary)" }}
                    aria-label={`${w.enabled ? "Disable" : "Enable"} ${meta.label}`}
                  />
                </label>

                <div style={{ flex: "1 1 240px", minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 600, fontSize: 13.5 }}>
                    {meta.label}
                    <span style={categoryTag} title={CATEGORY_LABEL[meta.category]}>
                      <CategoryIcon size={10} /> {CATEGORY_LABEL[meta.category]}
                    </span>
                    <InfoHint title={meta.label} text={meta.description} />
                  </div>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--color-text-muted)" }}>{meta.description}</p>
                </div>

                <div style={roleGrid}>
                  {ROLES.map((role) => (
                    <label key={role} style={{ ...roleChip, ...(w.roles.includes(role) ? roleChipActive : {}) }}>
                      <input
                        type="checkbox"
                        checked={w.roles.includes(role)}
                        onChange={() => toggleRole(i, role)}
                        style={{ display: "none" }}
                      />
                      {ROLE_LABELS[role]}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {patch.isSuccess && !dirty ? <Toast kind="ok">Dashboard configuration saved.</Toast> : null}
        {patch.error ? <Toast kind="error">{(patch.error         ).message}</Toast> : null}
      </Card>

    </>
  );
}

const row                = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: "12px 14px",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  background: "var(--color-bg)",
  flexWrap: "wrap",
};
const reorderCol                = { display: "flex", flexDirection: "column", gap: 2 };
const reorderBtn                = {
  font: "inherit",
  display: "grid",
  placeItems: "center",
  width: 22,
  height: 18,
  border: "1px solid var(--color-border)",
  borderRadius: 5,
  background: "var(--color-surface)",
  color: "var(--color-text)",
  cursor: "pointer",
};
const categoryTag                = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.03em",
  textTransform: "uppercase",
  color: "var(--color-text-muted)",
  border: "1px solid var(--color-border)",
  borderRadius: 5,
  padding: "1px 6px",
};
const roleGrid                = { display: "flex", flexWrap: "wrap", gap: 6, flex: "1 1 260px" };
const roleChip                = {
  fontSize: 11.5,
  fontWeight: 600,
  padding: "5px 10px",
  borderRadius: 999,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text-muted)",
  cursor: "pointer",
  userSelect: "none",
};
const roleChipActive                = {
  borderColor: "var(--color-primary)",
  background: "color-mix(in srgb, var(--color-primary) 14%, var(--color-surface))",
  color: "var(--color-primary)",
};
