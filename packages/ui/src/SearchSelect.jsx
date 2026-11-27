"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { triggerBase, useAnchoredPopover } from "./popover";

/**
 * A dropdown you can search: a box showing the chosen option that, when pressed, opens a panel with a search field above the list.
 * Typing narrows the list; ↑ ↓ move through it, Enter chooses, Escape closes. For lists too long to scan — an event, a city, a dish.
 *
 *   <SearchSelect value={event} onChange={(value, option) => …} options={[{ value: "birthday", label: "Birthday" }, …]} />
 *
 * Options are `{ value, label, hint? }`; `hint` is a small line under the label. The search looks at the label and the hint, ignoring capitals.
 */

const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, color: "var(--color-text-muted, #64748b)" }}>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const Chevron = () => (
  <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, color: "var(--color-text-muted, #64748b)" }}>
    <polyline points="1 1.5 6 6.5 11 1.5" />
  </svg>
);
const Tick = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "Nothing matches",
  label,
  disabled = false,
  fullWidth = true,
  id,
  ariaLabel,
  testId,
  themeColor,
  icon,
  triggerClassName,
  triggerStyle,
}) {
  const { open, setOpen, anchorRef, popRef, panelStyle, placed } = useAnchoredPopover({ minWidth: 260 });
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const autoId = useId();
  const fieldId = id ?? autoId;
  const listId = `${fieldId}-list`;
  const accent = themeColor || "var(--color-primary, #2563EB)";
  const chosen = options.find((o) => o.value === value);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q));
  }, [options, query]);

  // opening starts a fresh search with the chosen option highlighted
  useEffect(() => {
    if (!open) return;
    setQuery("");
    const at = options.findIndex((o) => o.value === value);
    setActive(Math.max(0, at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // …and the search field takes focus as soon as the panel is on screen (before that it is invisible, and an invisible field can't be focused)
  useEffect(() => {
    if (open && placed) searchRef.current?.focus();
  }, [open, placed]);

  // typing narrows the list: the first match is the one Enter takes
  useEffect(() => setActive(0), [query]);

  // keep the highlighted option in view
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [active, open]);

  const choose = (o) => {
    if (!o || o.disabled) return;
    onChange?.(o.value, o);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(shown.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(shown[active]);
    }
  };

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
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-label={ariaLabel}
          data-testid={testId}
          data-value={value ?? ""}
          className={triggerClassName}
          onClick={() => setOpen((o) => !o)}
          style={{ ...triggerBase, color: chosen ? "var(--color-text, #0f172a)" : "var(--color-text-muted, #94a3b8)", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1, ...triggerStyle }}
        >
          {icon ? <span style={{ color: accent, display: "inline-flex", flexShrink: 0 }}>{icon}</span> : null}
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chosen?.label ?? placeholder}</span>
          <Chevron />
        </button>
      </div>
      {open
        ? createPortal(
            <div
              ref={popRef}
              data-testid={testId ? `${testId}-panel` : undefined}
              style={{
                ...panelStyle,
                borderRadius: 14,
                background: "var(--color-surface, #fff)",
                color: "var(--color-text, #0f172a)",
                border: "1px solid var(--color-border, #e2e8f0)",
                boxShadow: "0 10px 25px -5px rgba(0,0,0,0.12), 0 8px 10px -6px rgba(0,0,0,0.06)",
                fontFamily: "var(--font-body, system-ui, -apple-system, sans-serif)",
                animation: "ot-pop-in 0.15s ease-out",
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid var(--color-border, #e2e8f0)" }}>
                <SearchIcon />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  aria-controls={listId}
                  aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
                  data-testid={testId ? `${testId}-search` : undefined}
                  autoComplete="off"
                  style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", font: "inherit", fontSize: 14.5, color: "inherit" }}
                />
              </div>
              <div ref={listRef} id={listId} role="listbox" style={{ maxHeight: "min(280px, calc(100vh - 120px))", overflowY: "auto", padding: 6 }}>
                {shown.length ? (
                  shown.map((o, i) => {
                    const on = o.value === value;
                    return (
                      <div
                        key={String(o.value)}
                        id={`${listId}-${i}`}
                        role="option"
                        aria-selected={on}
                        aria-disabled={o.disabled || undefined}
                        data-index={i}
                        data-option={String(o.value)}
                        onMouseEnter={() => setActive(i)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => choose(o)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "9px 10px",
                          borderRadius: 9,
                          cursor: o.disabled ? "not-allowed" : "pointer",
                          opacity: o.disabled ? 0.45 : 1,
                          background: i === active ? `color-mix(in srgb, ${accent} 10%, transparent)` : "transparent",
                          fontWeight: on ? 700 : 500,
                          fontSize: 14.5,
                        }}
                      >
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: "block", overflowWrap: "anywhere" }}>{o.label}</span>
                          {o.hint ? <span style={{ display: "block", fontSize: 12, fontWeight: 400, color: "var(--color-text-muted, #64748b)" }}>{o.hint}</span> : null}
                        </span>
                        {on ? (
                          <span style={{ color: accent, display: "inline-flex" }}>
                            <Tick />
                          </span>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <p style={{ margin: 0, padding: "14px 10px", fontSize: 13.5, color: "var(--color-text-muted, #64748b)" }}>{emptyText}</p>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
