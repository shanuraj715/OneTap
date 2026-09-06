"use client";

import { useState, useMemo, useEffect, useRef } from "react";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAYS_OF_WEEK = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Format a Date object to YYYY-MM-DD string
 */
export function formatDate(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Parse YYYY-MM-DD or Date object safely
 */
export function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === "string") {
    const parts = val.split("-").map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
  }
  return null;
}

/**
 * Standalone DatePicker Card / Dialog component
 * Matches the reference design with circular date ring, month/year navigation,
 * theme color customization, and Cancel/OK buttons.
 */
export function DatePicker({
  value,
  onChange,
  onOk,
  onCancel,
  themeColor,
  variant = "ring", // "ring" (exact screenshot) | "filled"
  minDate,
  maxDate,
  style = {},
  className = "",
  showActions = true,
}) {
  const parsedValue = useMemo(() => parseDate(value) ?? new Date(), [value]);
  const [selectedDate, setSelectedDate] = useState(parsedValue);

  // Month and year being browsed
  const [viewYear, setViewYear] = useState(parsedValue.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsedValue.getMonth());
  const [showPickerMode, setShowPickerMode] = useState("calendar"); // "calendar" | "months"

  useEffect(() => {
    if (value) {
      const d = parseDate(value);
      if (d) {
        setSelectedDate(d);
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  const min = useMemo(() => parseDate(minDate), [minDate]);
  const max = useMemo(() => parseDate(maxDate), [maxDate]);

  const isDateDisabled = (year, month, day) => {
    const d = new Date(year, month, day);
    if (min && d < new Date(min.getFullYear(), min.getMonth(), min.getDate())) return true;
    if (max && d > new Date(max.getFullYear(), max.getMonth(), max.getDate())) return true;
    return false;
  };

  // Compute days in the current view month
  const { days, blankDaysBefore } = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sun
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
    return {
      days: Array.from({ length: totalDays }, (_, i) => i + 1),
      blankDaysBefore: firstDayIndex,
    };
  }, [viewYear, viewMonth]);

  const handlePrevMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day) => {
    if (isDateDisabled(viewYear, viewMonth, day)) return;
    const newDate = new Date(viewYear, viewMonth, day);
    setSelectedDate(newDate);
    if (onChange) {
      onChange(formatDate(newDate), newDate);
    }
  };

  const handleOk = () => {
    const formatted = formatDate(selectedDate);
    if (onOk) onOk(formatted, selectedDate);
    else if (onChange) onChange(formatted, selectedDate);
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
  };

  const isSelected = (day) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getFullYear() === viewYear &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getDate() === day
    );
  };

  const isToday = (day) => {
    const today = new Date();
    return (
      today.getFullYear() === viewYear &&
      today.getMonth() === viewMonth &&
      today.getDate() === day
    );
  };

  // Custom CSS theme property injection
  const themeVars = themeColor
    ? {
        "--date-picker-primary": themeColor,
        "--date-picker-tint": `${themeColor}18`,
        "--date-picker-tint-hover": `${themeColor}24`,
      }
    : {
        "--date-picker-primary": "var(--color-primary, #2563EB)",
        "--date-picker-tint": "color-mix(in srgb, var(--color-primary, #2563EB) 10%, transparent)",
        "--date-picker-tint-hover": "color-mix(in srgb, var(--color-primary, #2563EB) 16%, transparent)",
      };

  return (
    <div
      className={`onetap-datepicker ${className}`}
      style={{
        ...themeVars,
        width: 320,
        maxWidth: "100%",
        background: "var(--color-surface, #ffffff)",
        color: "var(--color-text, #0f172a)",
        border: "1px solid var(--color-border, #e2e8f0)",
        borderRadius: 16,
        padding: "20px 20px 16px",
        boxShadow: "0 10px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04)",
        fontFamily: "var(--font-body, system-ui, -apple-system, sans-serif)",
        userSelect: "none",
        boxSizing: "border-box",
        ...style,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
        }}
      >
        {/* Month & Year Dropdown Trigger */}
        <button
          type="button"
          onClick={() =>
            setShowPickerMode((m) => (m === "calendar" ? "months" : "calendar"))
          }
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            border: "none",
            background: "transparent",
            padding: "4px 8px",
            margin: "-4px -8px",
            borderRadius: 8,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 16.5,
            fontWeight: 600,
            color: "var(--color-text, #0f172a)",
            transition: "background-color 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--date-picker-tint)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
          title="Click to choose month"
        >
          <span>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <svg
            width="10"
            height="6"
            viewBox="0 0 10 6"
            fill="none"
            style={{
              color: "var(--date-picker-primary)",
              transform: showPickerMode !== "calendar" ? "rotate(180deg)" : "none",
              transition: "transform 0.2s ease",
            }}
          >
            <path
              d="M1 1L5 5L9 1"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Navigation Arrows */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Previous month"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              border: "none",
              background: "transparent",
              borderRadius: "50%",
              cursor: "pointer",
              color: "var(--date-picker-primary)",
              transition: "background-color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--date-picker-tint)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
              <path
                d="M6 1L1 6L6 11"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Next month"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              border: "none",
              background: "transparent",
              borderRadius: "50%",
              cursor: "pointer",
              color: "var(--date-picker-primary)",
              transition: "background-color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--date-picker-tint)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
              <path
                d="M1 1L6 6L1 11"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Calendar Grid View */}
      {showPickerMode === "calendar" ? (
        <>
          {/* Day of Week Headers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            {DAYS_OF_WEEK.map((day, idx) => (
              <div
                key={idx}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--color-text-muted, #64748b)",
                  padding: "4px 0",
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Month Days Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gap: "4px 2px",
              minHeight: 216,
            }}
          >
            {/* Blank offset days */}
            {Array.from({ length: blankDaysBefore }).map((_, i) => (
              <div key={`blank-${i}`} style={{ height: 36 }} />
            ))}

            {/* Active days */}
            {days.map((day) => {
              const selected = isSelected(day);
              const today = isToday(day);
              const disabled = isDateDisabled(viewYear, viewMonth, day);

              return (
                <div
                  key={day}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 36,
                  }}
                >
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleSelectDay(day)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: selected
                        ? variant === "filled"
                          ? "none"
                          : "1.5px solid var(--date-picker-primary)"
                        : "none",
                      backgroundColor: selected
                        ? variant === "filled"
                          ? "var(--date-picker-primary)"
                          : "transparent"
                        : "transparent",
                      color: selected
                        ? variant === "filled"
                          ? "#ffffff"
                          : "var(--color-text, #0f172a)"
                        : disabled
                        ? "var(--color-text-muted, #94a3b8)"
                        : "var(--color-text, #0f172a)",
                      fontSize: 13.5,
                      fontWeight: selected || today ? 600 : 400,
                      cursor: disabled ? "not-allowed" : "pointer",
                      opacity: disabled ? 0.35 : 1,
                      transition: "all 0.12s ease",
                      padding: 0,
                      position: "relative",
                    }}
                    onMouseEnter={(e) => {
                      if (!selected && !disabled) {
                        e.currentTarget.style.backgroundColor = "var(--date-picker-tint)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!selected && !disabled) {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }
                    }}
                  >
                    {day}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      ) : showPickerMode === "months" ? (
        /* Quick Month Selector */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
            padding: "12px 0",
            minHeight: 254,
            alignContent: "center",
          }}
        >
          {MONTH_NAMES.map((m, idx) => {
            const active = idx === viewMonth;
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setViewMonth(idx);
                  setShowPickerMode("calendar");
                }}
                style={{
                  padding: "10px 4px",
                  borderRadius: 10,
                  border: active ? "1.5px solid var(--date-picker-primary)" : "1px solid var(--color-border, #e2e8f0)",
                  background: active ? "var(--date-picker-tint)" : "transparent",
                  color: active ? "var(--date-picker-primary)" : "var(--color-text)",
                  fontWeight: active ? 700 : 500,
                  fontSize: 13,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {m.slice(0, 3)}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Action Footer (Cancel / OK) */}
      {showActions ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 14,
            paddingTop: 8,
          }}
        >
          <button
            type="button"
            onClick={handleCancel}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--date-picker-primary)",
              fontWeight: 600,
              fontSize: 14,
              padding: "7px 14px",
              borderRadius: 8,
              cursor: "pointer",
              transition: "background-color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--date-picker-tint)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleOk}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--date-picker-primary)",
              fontWeight: 600,
              fontSize: 14,
              padding: "7px 14px",
              borderRadius: 8,
              cursor: "pointer",
              transition: "background-color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--date-picker-tint)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            OK
          </button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * An Input trigger with Calendar Icon that pops open the DatePicker dialog
 */
export function DatePickerInput({
  value,
  onChange,
  themeColor,
  placeholder = "Select date…",
  label,
  disabled = false,
  variant = "ring",
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const displayString = useMemo(() => {
    const d = parseDate(value);
    if (!d) return "";
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
  }, [value]);

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      {label ? (
        <label
          style={{
            display: "block",
            fontSize: 12.5,
            fontWeight: 600,
            marginBottom: 6,
            color: "var(--color-text)",
          }}
        >
          {label}
        </label>
      ) : null}

      <div
        onClick={() => !disabled && setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "9px 12px",
          borderRadius: 9,
          border: "1px solid var(--color-border, #cbd5e1)",
          background: "var(--color-bg, #ffffff)",
          color: displayString ? "var(--color-text)" : "var(--color-text-muted, #94a3b8)",
          fontSize: 14,
          cursor: disabled ? "not-allowed" : "pointer",
          minWidth: 190,
          boxSizing: "border-box",
          transition: "border-color 0.15s ease",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: themeColor || "var(--color-primary, #2563EB)", flexShrink: 0 }}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span style={{ flex: 1, whiteSpace: "nowrap" }}>
          {displayString || placeholder}
        </span>
      </div>

      {open ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 100,
            animation: "ot-pop-in 0.15s ease-out",
          }}
        >
          <DatePicker
            value={value}
            themeColor={themeColor}
            variant={variant}
            onOk={(str) => {
              if (onChange) onChange(str);
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
            onChange={(str) => {
              if (onChange) onChange(str);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
