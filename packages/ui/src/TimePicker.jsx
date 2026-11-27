"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { triggerBase, useAnchoredPopover } from "./popover";

/**
 * A time picker: a box that shows the chosen time and, when pressed, opens a panel of times to choose from — the same idea as the date
 * picker's popover (DP03), for a time of day.
 *
 *   <TimePickerInput value="18:30" onChange={(value) => …} step={30} min="11:00" max="23:00" />
 *
 * The times are either made from `step` / `min` / `max` (values are "HH:MM", 24-hour; `max` may be "24:00" or later to run past midnight),
 * or handed in as `options` — `[{ value, label, disabled?, hint? }]` — when a screen knows better which times can be picked (a restaurant's
 * free tables, say). A disabled time is shown but can't be chosen, so people see WHY a time is missing instead of wondering. The value is
 * whatever the chosen option's `value` is (an ISO date-time works as well as "18:30").
 */

const pad = (n) => String(n).padStart(2, "0");

/** "18:30" → "6:30 PM" */
export function formatTimeLabel(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? ""));
  if (!m) return "";
  const h24 = Number(m[1]) % 24;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m[2]} ${h24 < 12 ? "AM" : "PM"}`;
}

const toMinutes = (hhmm, fallback) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm ?? ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : fallback;
};

/** Times from `min` to `max` every `step` minutes, as options ({ value: "HH:MM", label: "6:30 PM" }). */
export function timeOptions({ step = 30, min = "00:00", max = "23:30" } = {}) {
  const from = toMinutes(min, 0);
  const to = toMinutes(max, 23 * 60 + 30);
  const out = [];
  for (let m = from; m <= to; m += Math.max(5, step)) {
    const value = `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
    out.push({ value, label: formatTimeLabel(value) });
  }
  return out;
}

/** Part of the day a "HH:MM" belongs to, for the group headings. */
const PERIODS = [
  [0, "Late night"],
  [5 * 60, "Morning"],
  [12 * 60, "Afternoon"],
  [17 * 60, "Evening"],
  [21 * 60, "Night"],
];

/** The panel of times on its own (no box, no popover) — for putting a time list inline on a page. */
export function TimePicker({ value, onChange, options, step = 30, min, max, emptyText = "No times available", groupByPeriod = false, themeColor, style }) {
  const list = useMemo(() => options ?? timeOptions({ step, min, max }), [options, step, min, max]);
  const selectedRef = useRef(null);
  const accent = themeColor || "var(--color-primary, #2563EB)";
  const id = useId();

  // bring the chosen time into view when the list first shows
  useEffect(() => {
    selectedRef.current?.scrollIntoView?.({ block: "center" });
  }, []);

  if (!list.length) return <p style={{ margin: 0, padding: 14, fontSize: 13.5, color: "var(--color-text-muted, #64748b)" }}>{emptyText}</p>;

  const periodOf = (o) => {
    const minutes = toMinutes(o.value, null);
    if (minutes === null) return "";
    const h = minutes % 1440;
    let name = PERIODS[0][1];
    for (const [from, label] of PERIODS) if (h >= from) name = label;
    return name;
  };

  const cells = [];
  let lastPeriod = null;
  list.forEach((o, i) => {
    if (groupByPeriod) {
      const p = periodOf(o);
      if (p && p !== lastPeriod) {
        cells.push(
          <div key={`${id}-p${i}`} role="presentation" style={{ gridColumn: "1 / -1", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--color-text-muted, #64748b)", padding: "8px 2px 2px" }}>
            {p}
          </div>,
        );
        lastPeriod = p;
      }
    }
    const on = o.value === value;
    cells.push(
      <button
        key={String(o.value)}
        ref={on ? selectedRef : undefined}
        type="button"
        role="option"
        aria-selected={on}
        disabled={o.disabled}
        title={o.disabled ? o.hint || "Not available" : o.hint}
        data-time={o.value}
        data-active={on ? "true" : "false"}
        onClick={() => !o.disabled && onChange?.(o.value, o)}
        style={{
          font: "inherit",
          fontSize: 13.5,
          fontWeight: on ? 700 : 600,
          fontVariantNumeric: "tabular-nums",
          padding: "9px 6px",
          borderRadius: 9,
          border: `1.5px solid ${on ? accent : "var(--color-border, #e2e8f0)"}`,
          background: on ? `color-mix(in srgb, ${accent} 14%, var(--color-bg, #fff))` : "var(--color-bg, #fff)",
          color: on ? accent : "var(--color-text, #0f172a)",
          cursor: o.disabled ? "not-allowed" : "pointer",
          opacity: o.disabled ? 0.38 : 1,
          textDecoration: o.disabled ? "line-through" : "none",
          whiteSpace: "nowrap",
        }}
      >
        {o.label}
      </button>,
    );
  });

  return (
    <div role="listbox" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6, ...style }}>
      {cells}
    </div>
  );
}

const ClockIcon = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color, flexShrink: 0 }} aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 14" />
  </svg>
);

/** The box + popover: shows the chosen time (or the placeholder) and opens the panel of times on press. */
export function TimePickerInput({
  value,
  onChange,
  options,
  step = 30,
  min,
  max,
  placeholder = "Select time…",
  label,
  disabled = false,
  fullWidth = true,
  id,
  ariaLabel,
  testId,
  emptyText,
  groupByPeriod = false,
  themeColor,
  triggerClassName,
  triggerStyle,
}) {
  const { open, setOpen, anchorRef, popRef, panelStyle } = useAnchoredPopover({ minWidth: 300 });
  const list = useMemo(() => options ?? timeOptions({ step, min, max }), [options, step, min, max]);
  const chosen = list.find((o) => o.value === value);
  const autoId = useId();
  const fieldId = id ?? autoId;
  const accent = themeColor || "var(--color-primary, #2563EB)";

  return (
    <div style={{ position: "relative", display: fullWidth ? "block" : "inline-block", width: fullWidth ? "100%" : undefined }}>
      {label ? (
        <label htmlFor={fieldId} style={{ display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: "var(--color-text, #0f172a)" }}>
          {label}
        </label>
      ) : null}
      <div ref={anchorRef}>
        <button
          id={fieldId}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          data-testid={testId}
          data-value={value ?? ""}
          className={triggerClassName}
          onClick={() => setOpen((o) => !o)}
          style={{ ...triggerBase, color: chosen ? "var(--color-text, #0f172a)" : "var(--color-text-muted, #94a3b8)", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, ...triggerStyle }}
        >
          <ClockIcon color={accent} />
          <span style={{ flex: 1, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{chosen?.label ?? placeholder}</span>
        </button>
      </div>
      {open
        ? createPortal(
            <div
              ref={popRef}
              data-testid={testId ? `${testId}-panel` : undefined}
              style={{
                ...panelStyle,
                maxHeight: "min(340px, calc(100vh - 16px))",
                overflowY: "auto",
                padding: 10,
                borderRadius: 14,
                background: "var(--color-surface, #fff)",
                color: "var(--color-text, #0f172a)",
                border: "1px solid var(--color-border, #e2e8f0)",
                boxShadow: "0 10px 25px -5px rgba(0,0,0,0.12), 0 8px 10px -6px rgba(0,0,0,0.06)",
                fontFamily: "var(--font-body, system-ui, -apple-system, sans-serif)",
                animation: "ot-pop-in 0.15s ease-out",
              }}
            >
              <TimePicker
                value={value}
                options={list}
                emptyText={emptyText}
                groupByPeriod={groupByPeriod}
                themeColor={themeColor}
                onChange={(v, o) => {
                  onChange?.(v, o);
                  setOpen(false);
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
