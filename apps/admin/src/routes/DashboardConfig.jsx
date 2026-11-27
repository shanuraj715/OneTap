import { useEffect, useState } from "react";
import {
  DASHBOARD_PERMISSION_LABELS,
  DASHBOARD_ROLES,
  DASHBOARD_WIDGET_CATALOG,
  FEATURES,
  recommendedDashboardWidgets,
  resolveDashboardWidgets,
  ROLE_LABELS,
  widgetAvailability,
} from "@rasoipulse/config-schema";
import { Check, ChevronDown, ChevronUp, LayoutGrid, Lock, RotateCcw, Save } from "lucide-react";
import { tint } from "../charts";
import { FALLBACK_LOOK, WIDGET_LOOK } from "../lib/dashboardLook";
import { useAuth } from "../lib/useAuth";
import { useMedia } from "../lib/useMedia";
import { useOutlet, usePatchConfig } from "../lib/useOutlet";
import { useStorePlan } from "../lib/useStorePlan";
import { Button, Card, Modal, PageHeader, Toast } from "../ui";
import { SettingsNav } from "../components/SubNav";

/** The roles an owner chooses for. (The platform's own super admin is not one of them: they see every widget that is switched on.) */
const ROLE_COLUMNS = DASHBOARD_ROLES.filter((r) => r !== "super_admin");
const CATEGORY_LABEL = { stat: "Number", chart: "Chart", list: "List" };
const featureLabel = (key) => FEATURES.find((f) => f.key === key)?.label ?? key;

/** Why this role can't be given this widget, in plain words; null when it can. */
function lockReason(id, role, features) {
  const a = widgetAvailability(id, role, features);
  if (a.ok) return null;
  if (a.reason === "plan") return `Not in your plan (${featureLabel(a.need)})`;
  return `${ROLE_LABELS[role]} can't open ${DASHBOARD_PERMISSION_LABELS[a.need] ?? a.need}, so its numbers are not for them`;
}

/** A widget is only ever ticked for roles that may read its numbers — a tick left over from before a permission changed is dropped. */
const clean = (list) => list.map((w) => ({ ...w, roles: w.roles.filter((r) => r === "super_admin" || widgetAvailability(w.id, r).ok) }));

export function DashboardConfig() {
  const { outlet } = useOutlet();
  const { can } = useAuth();
  const patch = usePatchConfig();
  const planInfo = useStorePlan();
  const narrow = useMedia("(max-width: 800px)");
  const [widgets, setWidgets] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // Re-syncs whenever the selected outlet actually changes, not just once — switching in the sidebar doesn't unmount this page. Keyed on
  // outlet?._id (not the outlet object, which gets a new reference on every background refetch) so an in-progress edit is never stomped.
  useEffect(() => {
    if (outlet) setWidgets(clean(resolveDashboardWidgets(outlet.config.dashboard)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlet?._id]);

  if (!can("dashboard:configure")) {
    return (
      <>
        <PageHeader title="Configure dashboard" />
        <SettingsNav />
        <Card>Your role can&apos;t configure the dashboard.</Card>
      </>
    );
  }
  if (!outlet || !widgets) {
    return (
      <>
        <PageHeader title="Configure dashboard" />
        <SettingsNav />
        <Card>Seed an outlet from the Dashboard first.</Card>
      </>
    );
  }

  const features = planInfo.plan ? planInfo.plan.entitlements.features : undefined;
  const stored = clean(resolveDashboardWidgets(outlet.config.dashboard));
  const dirty = JSON.stringify(widgets) !== JSON.stringify(stored);
  const onCount = widgets.filter((w) => w.enabled).length;

  const save = () => patch.mutate({ outlet, patch: { dashboard: { widgets } } }, { onSuccess: () => undefined });
  const move = (index, dir) => {
    const next = [...widgets];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setWidgets(next);
  };
  const setWidget = (index, patchValue) => setWidgets(widgets.map((w, i) => (i === index ? { ...w, ...patchValue } : w)));
  const toggleRole = (index, role) => {
    const w = widgets[index];
    setWidget(index, { roles: w.roles.includes(role) ? w.roles.filter((r) => r !== role) : [...w.roles, role] });
  };
  /** every widget this role may be given: ticked for all of them, or (when it already is) cleared from all of them */
  const eligible = (role) => widgets.map((w, i) => ({ w, i })).filter(({ w }) => !lockReason(w.id, role, features));
  const columnFull = (role) => eligible(role).length > 0 && eligible(role).every(({ w }) => w.roles.includes(role));
  const toggleColumn = (role) => {
    const full = columnFull(role);
    const ids = new Set(eligible(role).map(({ w }) => w.id));
    setWidgets(widgets.map((w) => (ids.has(w.id) ? { ...w, roles: full ? w.roles.filter((r) => r !== role) : [...new Set([...w.roles, role])] } : w)));
  };

  return (
    <>
      <PageHeader
        title="Configure dashboard"
        icon={<LayoutGrid size={23} />}
        subtitle="Choose what each person sees on their own dashboard."
        action={
          <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="outline" onClick={() => setConfirmReset(true)} data-testid="dash-reset" style={{ display: "inline-flex", gap: 7, alignItems: "center" }}>
              <RotateCcw size={14} /> Recommended
            </Button>
            <Button onClick={save} disabled={!dirty || patch.isPending} data-testid="dash-save" style={{ display: "inline-flex", gap: 7, alignItems: "center" }}>
              <Save size={14} />
              {patch.isPending ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </Button>
          </span>
        }
      />

      <SettingsNav />

      <Card>
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.55, maxWidth: 640 }}>
            A person sees a widget when it is <strong>on</strong> and their role is <strong>ticked</strong>. A <Lock size={11} style={{ verticalAlign: "-1px" }} /> means that role can&apos;t open the page behind
            those numbers (revenue needs Reports, for example), so it can&apos;t be shown to them. Use the arrows to change the order everyone sees.
          </p>
          <span data-testid="dash-count" style={{ fontSize: 12.5, fontWeight: 650, color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>
            {onCount} of {widgets.length} widgets on
          </span>
        </div>

        {narrow ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {widgets.map((w, i) => (
              <StackedRow key={w.id} w={w} i={i} last={i === widgets.length - 1} features={features} move={move} setWidget={setWidget} toggleRole={toggleRole} />
            ))}
          </div>
        ) : (
          <div style={{ overflowX: "auto", margin: "0 -4px", padding: "0 4px" }}>
            <div role="table" aria-label="Who sees which widget" style={{ minWidth: 780 }}>
              <div role="row" style={{ ...cols, ...headRow }}>
                <div role="columnheader" style={{ paddingLeft: 4 }}>Widget</div>
                <div role="columnheader" style={{ textAlign: "center" }}>On</div>
                {ROLE_COLUMNS.map((role) => (
                  <div role="columnheader" key={role} style={{ textAlign: "center", lineHeight: 1.25 }}>
                    <div>{ROLE_LABELS[role]}</div>
                    <button
                      type="button"
                      onClick={() => toggleColumn(role)}
                      data-testid={`dash-col-${role}`}
                      aria-label={columnFull(role) ? `Hide every widget from ${ROLE_LABELS[role]}` : `Show every widget they can read to ${ROLE_LABELS[role]}`}
                      style={linkBtn}
                    >
                      {columnFull(role) ? "none" : "all"}
                    </button>
                  </div>
                ))}
              </div>
              {widgets.map((w, i) => (
                <Row key={w.id} w={w} i={i} last={i === widgets.length - 1} features={features} move={move} setWidget={setWidget} toggleRole={toggleRole} />
              ))}
            </div>
          </div>
        )}

        {patch.isSuccess && !dirty ? <Toast kind="ok">Dashboard configuration saved.</Toast> : null}
        {patch.error ? <Toast kind="error">{patch.error.message}</Toast> : null}
      </Card>

      {confirmReset ? (
        <Modal onClose={() => setConfirmReset(false)} width={440} ariaLabel="Back to the recommended dashboard">
          <div style={{ padding: 22 }}>
            <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Use the recommended dashboard?</h2>
            <p style={{ margin: "0 0 16px", fontSize: 13.5, color: "var(--color-text-muted)", lineHeight: 1.55 }}>
              Every widget is switched on, in the usual order, and shown to the roles it was designed for. Nothing is saved until you press <strong>Save changes</strong>.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="outline" onClick={() => setConfirmReset(false)}>Cancel</Button>
              <Button
                data-testid="dash-reset-confirm"
                onClick={() => {
                  setWidgets(clean(recommendedDashboardWidgets()));
                  setConfirmReset(false);
                }}
              >
                Use recommended
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

/* --------------------------------------------------------------------- rows */

function Name({ w }) {
  const meta = DASHBOARD_WIDGET_CATALOG[w.id];
  const look = WIDGET_LOOK[w.id] ?? FALLBACK_LOOK;
  const planFeature = meta.requires.feature;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
      <span aria-hidden="true" style={{ width: 32, height: 32, borderRadius: 10, display: "grid", placeItems: "center", flexShrink: 0, background: tint(look.tone, 14), color: look.tone }}>
        <look.icon size={16} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", fontWeight: 650, fontSize: 13.5 }}>
          {meta.label}
          <span style={categoryTag}>{CATEGORY_LABEL[meta.category]}</span>
          {planFeature ? <span style={{ ...categoryTag, color: "var(--color-text-muted)" }}>needs {featureLabel(planFeature)}</span> : null}
        </div>
        <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 2, lineHeight: 1.4 }}>{meta.description}</div>
      </div>
    </div>
  );
}

function Row({ w, i, last, features, move, setWidget, toggleRole }) {
  const meta = DASHBOARD_WIDGET_CATALOG[w.id];
  const planLocked = Boolean(features && meta.requires.feature && !features.includes(meta.requires.feature));
  return (
    <div role="row" data-testid={`dash-row-${w.id}`} style={{ ...cols, ...bodyRow, opacity: w.enabled && !planLocked ? 1 : 0.55 }}>
      <div role="cell" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <Arrows i={i} last={last} move={move} />
        <Name w={w} />
      </div>
      <div role="cell" style={{ display: "grid", placeItems: "center" }}>
        <Switch on={w.enabled && !planLocked} disabled={planLocked} onChange={() => setWidget(i, { enabled: !w.enabled })} label={`${w.enabled ? "Disable" : "Enable"} ${meta.label}`} testId={`dash-on-${w.id}`} />
      </div>
      {ROLE_COLUMNS.map((role) => {
        const why = lockReason(w.id, role, features);
        return (
          <div role="cell" key={role} style={{ display: "grid", placeItems: "center" }}>
            {why ? (
              <span title={why} aria-label={why} data-testid={`dash-role-${w.id}-${role}`} data-locked="yes" style={lockedCell}>
                <Lock size={13} />
              </span>
            ) : (
              <Tick checked={w.roles.includes(role)} onChange={() => toggleRole(i, role)} label={`${ROLE_LABELS[role]} sees ${meta.label}`} testId={`dash-role-${w.id}-${role}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The phone's version of a row: the same controls stacked, with the roles as chips. */
function StackedRow({ w, i, last, features, move, setWidget, toggleRole }) {
  const meta = DASHBOARD_WIDGET_CATALOG[w.id];
  const planLocked = Boolean(features && meta.requires.feature && !features.includes(meta.requires.feature));
  return (
    <div data-testid={`dash-row-${w.id}`} style={{ ...stackedCard, opacity: w.enabled && !planLocked ? 1 : 0.6 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Name w={w} />
        </div>
        <Switch on={w.enabled && !planLocked} disabled={planLocked} onChange={() => setWidget(i, { enabled: !w.enabled })} label={`${w.enabled ? "Disable" : "Enable"} ${meta.label}`} testId={`dash-on-${w.id}`} />
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10, alignItems: "center" }}>
        {ROLE_COLUMNS.map((role) => {
          const why = lockReason(w.id, role, features);
          const on = w.roles.includes(role);
          return why ? (
            <span key={role} title={why} data-locked="yes" style={{ ...roleChip, opacity: 0.5, cursor: "not-allowed", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Lock size={10} /> {ROLE_LABELS[role]}
            </span>
          ) : (
            <button key={role} type="button" role="checkbox" aria-checked={on} onClick={() => toggleRole(i, role)} style={{ ...roleChip, ...(on ? roleChipActive : {}) }}>
              {ROLE_LABELS[role]}
            </button>
          );
        })}
        <span style={{ marginLeft: "auto" }}>
          <Arrows i={i} last={last} move={move} horizontal />
        </span>
      </div>
    </div>
  );
}

function Arrows({ i, last, move, horizontal = false }) {
  return (
    <div style={{ display: "flex", flexDirection: horizontal ? "row" : "column", gap: 2, flexShrink: 0 }}>
      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={{ ...arrowBtn, opacity: i === 0 ? 0.35 : 1 }} aria-label="Move up">
        <ChevronUp size={13} />
      </button>
      <button type="button" onClick={() => move(i, 1)} disabled={last} style={{ ...arrowBtn, opacity: last ? 0.35 : 1 }} aria-label="Move down">
        <ChevronDown size={13} />
      </button>
    </div>
  );
}

/** An on/off switch. */
function Switch({ on, onChange, label, disabled, testId }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      data-testid={testId}
      disabled={disabled}
      onClick={onChange}
      style={{ width: 38, height: 22, borderRadius: 999, border: 0, padding: 2, cursor: disabled ? "not-allowed" : "pointer", background: on ? "var(--color-primary)" : "var(--color-border)", display: "flex", alignItems: "center", justifyContent: on ? "flex-end" : "flex-start", transition: "background 120ms", flexShrink: 0 }}
    >
      <span style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
    </button>
  );
}

/** A tick box for one role on one widget. */
function Tick({ checked, onChange, label, testId }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      data-testid={testId}
      onClick={onChange}
      className="ot-press"
      style={{ width: 24, height: 24, borderRadius: 7, display: "grid", placeItems: "center", cursor: "pointer", padding: 0, border: `1.5px solid ${checked ? "var(--color-primary)" : "var(--color-border)"}`, background: checked ? "var(--color-primary)" : "var(--color-bg)", color: "var(--color-on-primary)" }}
    >
      {checked ? <Check size={14} strokeWidth={3} /> : null}
    </button>
  );
}

/* ------------------------------------------------------------------- styles */

const cols = { display: "grid", gridTemplateColumns: `minmax(300px, 1fr) 54px repeat(${ROLE_COLUMNS.length}, 100px)`, alignItems: "center", columnGap: 6 };
const headRow = { padding: "0 8px 8px", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--color-text-muted)", borderBottom: "1px solid var(--color-border)", position: "sticky", top: 0, background: "var(--color-surface)", zIndex: 1 };
const bodyRow = { padding: "11px 8px", borderBottom: "1px solid var(--color-border)" };
const stackedCard = { padding: "12px 12px", border: "1px solid var(--color-border)", borderRadius: 12, background: "var(--color-bg)" };
const linkBtn = { font: "inherit", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.02em", textTransform: "none", color: "var(--color-primary)", background: "none", border: 0, padding: "1px 4px", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 };
const arrowBtn = { font: "inherit", display: "grid", placeItems: "center", width: 22, height: 18, border: "1px solid var(--color-border)", borderRadius: 5, background: "var(--color-surface)", color: "var(--color-text)", cursor: "pointer", padding: 0 };
const categoryTag = { fontSize: 10, fontWeight: 700, letterSpacing: "0.03em", textTransform: "uppercase", color: "var(--color-text-muted)", border: "1px solid var(--color-border)", borderRadius: 5, padding: "0 6px", lineHeight: "16px" };
const lockedCell = { width: 24, height: 24, borderRadius: 7, display: "grid", placeItems: "center", color: "var(--color-text-muted)", opacity: 0.55, cursor: "not-allowed" };
const roleChip = { font: "inherit", fontSize: 11.5, fontWeight: 600, padding: "5px 10px", borderRadius: 999, border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-text-muted)", cursor: "pointer", userSelect: "none" };
const roleChipActive = { borderColor: "var(--color-primary)", background: "color-mix(in srgb, var(--color-primary) 14%, var(--color-surface))", color: "var(--color-primary)" };
