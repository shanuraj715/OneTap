import { Lock, Minus, Plus } from "lucide-react";
import { Button, InfoHint } from "../../../ui";

/** Small things every section of the onboarding form shares. */

/** Set a value deep inside the form by a path like "business.storeName" (returns a new object, the old one is untouched). */
export const setIn = (obj, path, value) => {
  const [key, ...rest] = path.split(".");
  return { ...obj, [key]: rest.length ? setIn(obj?.[key] ?? {}, rest.join("."), value) : value };
};

export const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 };
export const area = {
  width: "100%",
  minHeight: 76,
  padding: "9px 11px",
  fontSize: 14,
  fontFamily: "inherit",
  border: "1px solid var(--color-border)",
  borderRadius: 8,
  background: "var(--color-bg)",
  color: "var(--color-text)",
  resize: "vertical",
  boxSizing: "border-box",
};
export const subtle = { margin: 0, fontSize: 12.5, color: "var(--color-text-muted)" };

/** A coloured line under a control that asks for something the plan doesn't include. */
export function Alert({ children, tone = "error" }) {
  const c = tone === "error" ? ["var(--tone-danger-wash)", "var(--tone-danger)"] : ["var(--tone-warning-wash)", "var(--tone-warning)"];
  return (
    <div role="alert" data-plan-alert={tone} style={{ marginTop: 8, padding: "7px 11px", borderRadius: 8, fontSize: 12.5, background: c[0], color: c[1] }}>
      {children}
    </div>
  );
}

const rs = (n) => `₹${new Intl.NumberFormat("en-IN").format(Math.round(n))}`;
const checkbox = { width: 16, height: 16, accentColor: "var(--color-primary)", flexShrink: 0, margin: 0 };

/**
 * One choice the client may want, in one of three states — so the representative always sees at a glance what they can do:
 *
 *   in the plan        a plain tick box.
 *   NOT in the plan    a lock, "Not in the <plan> plan", and ONE box: "Add for this client" (with what it costs a month).
 *   added anyway       the tick box again, an amber "Added for this client" tag, and "Take away" to undo it.
 *
 *   outside  the plan lacks it           added  it has been added for this client anyway
 *   onAdd(on) add it for this client / take it away again          price  what adding it costs a month (₹), if known
 */
export function FeatureRow({ label, info, note, checked, onChange, outside, planName, added, onAdd, price, disabled, state }) {
  const status = outside ? (added ? "added" : "locked") : "included";
  return (
    <div
      data-feature-row
      data-state={status}
      data-wanted={checked ? "yes" : "no"}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", padding: "9px 4px", borderBottom: "1px solid var(--color-border)", minHeight: 40 }}
    >
      {status === "locked" ? (
        <>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--color-text-muted)", fontSize: 14 }}>
            <Lock size={14} aria-hidden="true" /> {label}
            {info ? <InfoHint text={info} title={label} /> : null}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "var(--tone-danger)" }}>Not in the {planName} plan</span>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, cursor: disabled ? "not-allowed" : "pointer" }}>
              <input type="checkbox" checked={false} disabled={disabled} onChange={() => onAdd(true)} aria-label={`Add ${label} for this client`} style={checkbox} />
              Add for this client{price ? <span style={{ color: "var(--color-text-muted)" }}> · +{rs(price)} a month</span> : null}
            </label>
          </span>
        </>
      ) : (
        <>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, cursor: disabled ? "not-allowed" : "pointer" }}>
            <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} style={checkbox} />
            {label}
            {note ? <span style={{ color: "var(--color-text-muted)", fontSize: 12.5 }}>{note}</span> : null}
          </label>
          {info ? <InfoHint text={info} title={label} /> : null}
          {status === "added" ? (
            <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, color: "var(--tone-warning)", background: "var(--tone-warning-wash)", padding: "2px 9px", borderRadius: 999 }}>
                Added for this client{price ? ` · +${rs(price)} a month` : ""}
              </span>
              <button type="button" disabled={disabled} onClick={() => onAdd(false)} aria-label={`Take ${label} away`} style={{ font: "inherit", fontSize: 12.5, border: 0, background: "transparent", color: "var(--color-text-muted)", textDecoration: "underline", cursor: disabled ? "not-allowed" : "pointer", padding: 2 }}>
                Take away
              </button>
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}

/** A − and + around a number: for "how many". The number can still be typed. */
export function Stepper({ value, onChange, min = 1, max = 100, label, plural, disabled }) {
  const clamp = (n) => Math.max(min, Math.min(max, Math.round(n) || min));
  const btn = { width: 36, height: 36, display: "grid", placeItems: "center", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: "var(--color-text)", borderRadius: 8, cursor: "pointer", padding: 0 };
  return (
    <span data-stepper style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <button type="button" onClick={() => onChange(clamp(value - 1))} disabled={disabled || value <= min} aria-label={`One fewer ${label}`} style={{ ...btn, opacity: disabled || value <= min ? 0.45 : 1 }}><Minus size={15} /></button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        aria-label={`Total ${plural ?? label}`}
        disabled={disabled}
        className="no-spin"
        style={{ width: 64, height: 36, textAlign: "center", font: "inherit", fontSize: 15, fontWeight: 600, border: "1px solid var(--color-border)", borderRadius: 8, background: "var(--color-bg)", color: "var(--color-text)", MozAppearance: "textfield" }}
      />
      <button type="button" onClick={() => onChange(clamp(value + 1))} disabled={disabled || value >= max} aria-label={`One more ${label}`} style={{ ...btn, opacity: disabled || value >= max ? 0.45 : 1 }}><Plus size={15} /></button>
    </span>
  );
}
void Button;
