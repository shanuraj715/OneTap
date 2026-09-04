import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import { Button as BaseButton, type ButtonProps } from "@onetap/ui";
import { Check, ChevronDown, Info, X } from "lucide-react";

/**
 * The admin panel's own `Button` — every screen here is a dense operator
 * console, not a marketing page, so admin defaults to the small size. Any
 * call site that needs otherwise still can (`size="md"` overrides this).
 * Import `Button` from here, not `@onetap/ui`, everywhere under `routes/`.
 */
export function Button(props: ButtonProps) {
  return <BaseButton size="sm" {...props} />;
}

/** Freezes the page underneath while something (a modal, a dialog) is open. */
function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

/**
 * The one modal shell every dialog in the admin should be built on — a
 * portal so it always sits above the page regardless of where it's rendered
 * from, an overlay that closes on click-outside, `Escape` to close, and the
 * page underneath frozen for as long as it's open (scrolling the modal's own
 * content still works; the page behind it no longer moves).
 */
export function Modal({
  onClose,
  children,
  width = 640,
  ariaLabel,
}: {
  onClose: () => void;
  children: ReactNode;
  width?: number;
  ariaLabel?: string;
}) {
  useLockBodyScroll(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div style={modalOverlay} onClick={onClose} role="presentation">
      <div
        className="ot-anim-pop"
        style={{ ...modalPanel, maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Card({
  title,
  subtitle,
  icon,
  action,
  children,
}: {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section style={card}>
      {(title || action) && (
        <div style={cardHead}>
          <div>
            <h2 style={cardTitle}>
              {icon ? <span style={{ display: "inline-flex", verticalAlign: "-3px", marginRight: 7 }}>{icon}</span> : null}
              {title}
            </h2>
            {subtitle ? <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--color-text-muted)" }}>{subtitle}</p> : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/* --------------------------------------------------------------- info hint */

const TIP_WIDTH = 260;
const TIP_GAP = 7;
const TIP_MARGIN = 10;

interface TipPos {
  left: number;
  /** viewport-fixed coordinates — only one of these is set, matching `placement` */
  top?: number;
  bottom?: number;
  placement: "above" | "below";
}

/**
 * Center the tooltip on its trigger, then clamp so it can never hang off
 * either edge of the viewport — the failure this fixes is a `(i)` in the
 * rightmost column of a grid opening a tooltip whose right half renders past
 * the screen edge (or gets silently clipped by a scrolling ancestor, since
 * this is a fixed-position portal rather than a plain absolutely-positioned
 * child). Same idea as `useAnchor` below, just centered instead of edge-aligned.
 */
function useTipAnchor(open: boolean, triggerRef: RefObject<HTMLElement | null>) {
  const [pos, setPos] = useState<TipPos | null>(null);

  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const above = r.top - TIP_GAP - TIP_MARGIN;
    const below = window.innerHeight - r.bottom - TIP_GAP - TIP_MARGIN;
    const placement: TipPos["placement"] = below < 90 && above > below ? "above" : "below";

    let left = r.left + r.width / 2 - TIP_WIDTH / 2;
    left = Math.max(TIP_MARGIN, Math.min(left, window.innerWidth - TIP_WIDTH - TIP_MARGIN));

    setPos({
      left,
      top: placement === "below" ? r.bottom + TIP_GAP : undefined,
      bottom: placement === "above" ? window.innerHeight - r.top + TIP_GAP : undefined,
      placement,
    });
  }, [triggerRef]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    measure();
    // Scrolling any ancestor (a Card in a scrolled dashboard grid, a table) moves
    // the trigger relative to the viewport, so re-measure on capture.
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, measure]);

  return pos;
}

/**
 * The little (i) beside a label. Every setting in this admin should be able to
 * explain itself — what it does and why it matters — without anyone leaving the
 * page to look it up.
 *
 * Opens on hover for mouse users and on click for touch and keyboard, so it is
 * reachable however you got here. The tooltip itself is portaled to
 * `document.body` and positioned in viewport coordinates (see `useTipAnchor`)
 * rather than plain CSS `position: absolute` — a trigger near the right edge
 * of the screen (the last column of a grid, a narrow sidebar) would otherwise
 * open a tooltip that's clipped by a scrolling ancestor or hangs off-screen.
 */
export function InfoHint({ text, title }: { text: string; title?: string }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const visible = open || pinned;
  const anchor = useTipAnchor(visible, btnRef);

  useEffect(() => {
    if (!pinned) return;
    const onDown = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) {
        setPinned(false);
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPinned(false);
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pinned]);

  return (
    <span ref={wrap} style={{ position: "relative", display: "inline-flex", verticalAlign: "middle" }}>
      <button
        ref={btnRef}
        type="button"
        aria-label={title ? `About ${title}` : "What is this?"}
        aria-expanded={visible}
        aria-describedby={visible ? id : undefined}
        onClick={() => {
          setPinned((p) => !p);
          setOpen(true);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => !pinned && setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => !pinned && setOpen(false)}
        style={infoBtn}
      >
        <Info size={13} strokeWidth={2.25} aria-hidden />
      </button>

      {visible && anchor
        ? createPortal(
            <span
              id={id}
              role="tooltip"
              className="ot-anim-pop"
              style={{ ...tip, left: anchor.left, top: anchor.top, bottom: anchor.bottom }}
            >
              {title ? <strong style={{ display: "block", marginBottom: 3 }}>{title}</strong> : null}
              {text}
              {pinned ? (
                <button type="button" onClick={() => { setPinned(false); setOpen(false); }} style={tipClose} aria-label="Close">
                  <X size={11} aria-hidden />
                </button>
              ) : null}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

/* ------------------------------------------------------------------- field */

export function Field({
  label,
  hint,
  info,
  children,
  style,
}: {
  label: string;
  /** short text under the control */
  hint?: string;
  /** the longer "what and why", behind the (i) */
  info?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <label style={{ ...field, ...style }}>
      <span style={fieldLabel}>
        {label}
        {info ? <InfoHint text={info} title={label} /> : null}
      </span>
      {children}
      {hint ? <span style={fieldHint}>{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...input, ...props.style }} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...input, ...props.style }} />;
}

export function Checkbox({
  checked,
  onChange,
  label,
  info,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  info?: string;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13.5 }}>
      <label style={{ display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: "var(--color-primary)", width: 15, height: 15 }} />
        {label}
      </label>
      {info ? <InfoHint text={info} title={label} /> : null}
    </span>
  );
}

export function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 44, height: 34, padding: 0, border: "1px solid var(--color-border)", borderRadius: 8, background: "none" }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...input, width: 110, fontFamily: "monospace" }}
      />
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div style={pageHeaderSticky}>
      <div>
        <h1 style={{ fontFamily: "var(--font-heading)", fontSize: 26, margin: 0, display: "flex", alignItems: "center", gap: 9 }}>
          {icon}
          {title}
        </h1>
        {subtitle ? <p style={{ color: "var(--color-text-muted)", margin: "6px 0 0" }}>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

/**
 * How tall the sticky `PageHeader` renders (title + one subtitle line, its
 * own top/bottom padding) — every OTHER sticky element sharing this same
 * scroll container (a floating save bar, a sticky preview pane) must start
 * at or past this offset, or it sticks to `top: 0` right along with the
 * header and the two end up drawn on top of each other. `top: STICKY_HEADER_CLEARANCE`
 * on that element is the fix, not picking a smaller number by trial and error.
 */
export const STICKY_HEADER_CLEARANCE = 108;

/**
 * The content area (`main` in App.tsx) is the one scrolling container and has
 * no top padding of its own — this supplies that spacing itself so it stays
 * part of the sticky box instead of scrolling away before the header pins.
 *
 * The gap below is `paddingBottom`, not a margin — a margin isn't part of a
 * sticky element's own painted box, so once stuck it scrolls out from
 * underneath the header and scrolled content ends up touching it. Padding is
 * inside the box, so it stays pinned along with everything else.
 */
const pageHeaderSticky: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 5,
  background: "var(--color-bg)",
  paddingTop: 28,
  paddingBottom: 20,
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
};

export function Toast({ kind, children }: { kind: "ok" | "error" | "info"; children: ReactNode }) {
  const tone =
    kind === "ok"
      ? { bg: "var(--tone-success-wash)", fg: "var(--tone-success)" }
      : kind === "error"
        ? { bg: "var(--tone-danger-wash)", fg: "var(--tone-danger)" }
        : { bg: "var(--tone-info-wash)", fg: "var(--tone-info)" };

  return (
    <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: 8, fontSize: 13, background: tone.bg, color: tone.fg }}>
      {children}
    </div>
  );
}

/** Small status pill — printed / failed / waiting, and anything like it. */
export type PillTone = "neutral" | "ok" | "warn" | "error" | "info";

/** Shared with IconChip so a status reads the same colour everywhere. */
const TONE_COLORS: Record<PillTone, { bg: string; fg: string; bd: string }> = {
  neutral: { bg: "var(--color-bg)", fg: "var(--color-text-muted)", bd: "var(--color-border)" },
  ok: { bg: "var(--tone-success-wash)", fg: "var(--tone-success)", bd: "transparent" },
  warn: { bg: "var(--tone-warning-wash)", fg: "var(--tone-warning)", bd: "transparent" },
  error: { bg: "var(--tone-danger-wash)", fg: "var(--tone-danger)", bd: "transparent" },
  info: { bg: "var(--tone-info-wash)", fg: "var(--tone-info)", bd: "transparent" },
};

export function Pill({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: PillTone;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const map = TONE_COLORS[tone];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 11.5,
        fontWeight: 600,
        padding: "3px 9px",
        borderRadius: 999,
        background: map.bg,
        color: map.fg,
        border: `1px solid ${map.bd}`,
        whiteSpace: "nowrap",
      }}
    >
      {icon}
      {children}
    </span>
  );
}

/**
 * A status as a small coloured icon badge, no label — for a table column where
 * width matters more than a spelled-out word. Always pass `label`: it becomes
 * the hover tooltip and the accessible name, so the meaning isn't lost, just
 * the on-screen text.
 */
export function IconChip({
  tone = "neutral",
  icon,
  label,
}: {
  tone?: PillTone;
  icon: ReactNode;
  label: string;
}) {
  const map = TONE_COLORS[tone];
  return (
    <span
      title={label}
      aria-label={label}
      role="img"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 24,
        height: 24,
        borderRadius: 7,
        background: map.bg,
        color: map.fg,
        border: `1px solid ${map.bd}`,
        flexShrink: 0,
      }}
    >
      {icon}
    </span>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { id: T; label: string; icon?: ReactNode; count?: number }[];
}) {
  return (
    <div role="tablist" style={tabBar}>
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className="ot-press"
            style={{
              ...tab,
              background: active ? "var(--color-primary)" : "transparent",
              color: active ? "var(--color-on-primary)" : "var(--color-text)",
              borderColor: active ? "var(--color-primary)" : "var(--color-border)",
            }}
          >
            {t.icon}
            {t.label}
            {typeof t.count === "number" && t.count > 0 ? (
              <span style={{ ...tabCount, background: active ? "rgba(255,255,255,0.25)" : "var(--color-border)" }}>
                {t.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- popover */

interface AnchorPos {
  top: number;
  left: number;
  placement: "below" | "above";
  maxHeight: number;
}

const GAP = 6;
const VIEWPORT_MARGIN = 10;

/**
 * Position a floating panel against its trigger, in viewport coordinates.
 *
 * Flips above the trigger when there isn't room below — the row at the bottom of
 * a long table is exactly where a menu is most likely to be opened and least
 * likely to fit.
 */
function useAnchor(open: boolean, triggerRef: RefObject<HTMLElement | null>, width: number, align: "left" | "right") {
  const [pos, setPos] = useState<AnchorPos | null>(null);

  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - GAP - VIEWPORT_MARGIN;
    const above = r.top - GAP - VIEWPORT_MARGIN;
    // Flip only when below is genuinely cramped and above is roomier.
    const placement: AnchorPos["placement"] = below < 200 && above > below ? "above" : "below";

    let left = align === "right" ? r.right - width : r.left;
    // Never let the panel hang off either edge of the screen.
    left = Math.max(VIEWPORT_MARGIN, Math.min(left, window.innerWidth - width - VIEWPORT_MARGIN));

    setPos({
      top: placement === "below" ? r.bottom + GAP : r.top - GAP,
      left,
      placement,
      maxHeight: Math.max(140, placement === "below" ? below : above),
    });
  }, [triggerRef, width, align]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    measure();
    // Scrolling any ancestor moves the trigger, so re-measure on capture.
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [open, measure]);

  return pos;
}

/**
 * The floating panel itself, rendered into `document.body`.
 *
 * A portal is what makes this work inside the orders table: that table scrolls
 * horizontally, and any `overflow` other than `visible` clips an absolutely
 * positioned child. Escaping to the body sidesteps the clipping entirely.
 */
function FloatingPanel({
  anchor,
  width,
  children,
  panelRef,
}: {
  anchor: AnchorPos | null;
  width: number;
  children: ReactNode;
  panelRef?: RefObject<HTMLDivElement | null>;
}) {
  if (!anchor) return null;

  return createPortal(
    <div
      ref={panelRef}
      className="ot-anim-drop"
      role="menu"
      style={{
        ...menuPanel,
        position: "fixed",
        top: anchor.placement === "below" ? anchor.top : undefined,
        bottom: anchor.placement === "above" ? window.innerHeight - anchor.top : undefined,
        left: anchor.left,
        width,
        maxHeight: anchor.maxHeight,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

/* -------------------------------------------------------------------- menu */

export interface MenuOption<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
}

/**
 * A trigger with a popup list. Closes on outside click and on Escape, because a
 * menu you have to click again to dismiss is the single most irritating thing in
 * an admin panel.
 */
export function Menu<T extends string>({
  trigger,
  options,
  onSelect,
  selected,
  align = "right",
  header,
  width = 230,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  options: MenuOption<T>[];
  onSelect: (value: T) => void;
  selected?: T;
  align?: "left" | "right";
  header?: string;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const anchor = useAnchor(open, triggerRef, width, align);

  // The panel lives in a portal, so "outside" has to mean outside *both* it and
  // the trigger — otherwise clicking an item would dismiss before it fires.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={triggerRef} style={{ display: "inline-flex" }}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      <FloatingPanel anchor={anchor} width={width} panelRef={panelRef}>
        {header ? <span style={menuHeader}>{header}</span> : null}
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="menuitem"
            disabled={o.disabled}
            onClick={() => {
              onSelect(o.value);
              setOpen(false);
            }}
            style={{
              ...menuItem,
              opacity: o.disabled ? 0.45 : 1,
              cursor: o.disabled ? "not-allowed" : "pointer",
              color: o.danger ? "var(--tone-danger)" : "var(--color-text)",
              background: o.value === selected ? "var(--color-bg)" : "transparent",
            }}
          >
            {o.icon ? <span style={{ display: "inline-flex", flexShrink: 0, marginTop: 1 }}>{o.icon}</span> : null}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: o.value === selected ? 700 : 600, fontSize: 13 }}>{o.label}</span>
              {o.description ? (
                <span style={{ display: "block", fontSize: 11.5, color: "var(--color-text-muted)", marginTop: 1 }}>
                  {o.description}
                </span>
              ) : null}
            </span>
            {o.value === selected ? <Check size={13} style={{ flexShrink: 0 }} /> : null}
          </button>
        ))}
      </FloatingPanel>
    </span>
  );
}

/** A checkbox list in a popup — one filter that takes several values at once. */
export function MultiFilter<T extends string>({
  label,
  icon,
  options,
  value,
  onChange,
}: {
  label: string;
  icon?: ReactNode;
  options: { value: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const anchor = useAnchor(open, triggerRef, 210, "left");
  const active = value.length > 0;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={triggerRef} style={{ display: "inline-flex" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="ot-press"
        style={{
          ...filterBtn,
          borderColor: active ? "var(--color-primary)" : "var(--color-border)",
          background: active ? "color-mix(in srgb, var(--color-primary) 10%, var(--color-bg))" : "var(--color-bg)",
          color: active ? "var(--color-primary)" : "var(--color-text)",
        }}
      >
        {icon}
        {label}
        {active ? <span style={filterCount}>{value.length}</span> : null}
        <ChevronDown size={13} style={{ opacity: 0.6 }} />
      </button>

      <FloatingPanel anchor={anchor} width={210} panelRef={panelRef}>
        {options.map((o) => {
          const on = value.includes(o.value);
          return (
            <label key={o.value} style={{ ...menuItem, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={on}
                onChange={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
                style={{ accentColor: "var(--color-primary)", width: 14, height: 14, flexShrink: 0 }}
              />
              <span style={{ fontSize: 13, fontWeight: 500 }}>{o.label}</span>
            </label>
          );
        })}
        {active ? (
          <button
            type="button"
            onClick={() => onChange([])}
            style={{ ...menuItem, color: "var(--color-text-muted)", fontSize: 12, cursor: "pointer", borderTop: "1px solid var(--color-border)", marginTop: 4, paddingTop: 8 }}
          >
            Clear
          </button>
        ) : null}
      </FloatingPanel>
    </span>
  );
}

/* ------------------------------------------------------------------- table */

/** Full-width data table with a horizontal scroll container of its own. */
export function Table({ children, minWidth = 900 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div style={tableScroll}>
      <table style={{ ...tableEl, minWidth }}>{children}</table>
    </div>
  );
}

export function Th({
  children,
  align = "left",
  width,
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  width?: number | string;
}) {
  return <th style={{ ...th, textAlign: align, width }}>{children}</th>;
}

export function Td({
  children,
  align = "left",
  nowrap,
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  nowrap?: boolean;
}) {
  return <td style={{ ...td, textAlign: align, whiteSpace: nowrap ? "nowrap" : undefined }}>{children}</td>;
}

/** A short explanatory panel — the "why does this section exist" note. */
export function Note({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div style={note}>
      {icon ? <span style={{ flexShrink: 0, marginTop: 1, color: "var(--tone-info)" }}>{icon}</span> : null}
      <div>{children}</div>
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div style={{ textAlign: "center", padding: "30px 16px", color: "var(--color-text-muted)" }}>
      {icon ? <div style={{ marginBottom: 10, opacity: 0.55 }}>{icon}</div> : null}
      <div style={{ fontWeight: 600, color: "var(--color-text)", marginBottom: 4 }}>{title}</div>
      {children ? <div style={{ fontSize: 13 }}>{children}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ styles */

const modalOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.55)",
  display: "grid",
  placeItems: "center",
  padding: 16,
  zIndex: 80,
};
const modalPanel: CSSProperties = {
  background: "var(--color-bg)",
  border: "1px solid var(--color-border)",
  borderRadius: 15,
  width: "100%",
  maxHeight: "90vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};
const card: CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-card)",
  padding: 20,
  marginBottom: 18,
};
const cardHead: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, marginBottom: 14 };
const cardTitle: CSSProperties = { fontFamily: "var(--font-heading)", fontSize: 16, margin: 0 };
const field: CSSProperties = { display: "flex", flexDirection: "column", gap: 6, marginBottom: 14, maxWidth: 460 };
const fieldLabel: CSSProperties = { fontSize: 13, fontWeight: 600, color: "var(--color-text)", display: "inline-flex", alignItems: "center", gap: 6 };
const fieldHint: CSSProperties = { fontSize: 12, color: "var(--color-text-muted)" };
const input: CSSProperties = {
  font: "inherit",
  fontSize: 14,
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text)",
};
const infoBtn: CSSProperties = {
  display: "inline-grid",
  placeItems: "center",
  width: 17,
  height: 17,
  padding: 0,
  borderRadius: 999,
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  color: "var(--color-text-muted)",
  cursor: "help",
  flexShrink: 0,
};
const tip: CSSProperties = {
  position: "fixed",
  zIndex: 80,
  width: TIP_WIDTH,
  padding: "9px 11px",
  borderRadius: 9,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-text)",
  boxShadow: "0 6px 22px rgba(0,0,0,0.18)",
  fontSize: 12.5,
  fontWeight: 400,
  lineHeight: 1.45,
  whiteSpace: "normal",
  textAlign: "left",
};
const tipClose: CSSProperties = {
  position: "absolute",
  top: 4,
  right: 4,
  display: "grid",
  placeItems: "center",
  width: 16,
  height: 16,
  padding: 0,
  border: 0,
  borderRadius: 4,
  background: "transparent",
  color: "var(--color-text-muted)",
  cursor: "pointer",
};
const tabBar: CSSProperties = { display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 };
const tab: CSSProperties = {
  font: "inherit",
  fontSize: 13.5,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid var(--color-border)",
  cursor: "pointer",
};
const tabCount: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: "1px 6px",
  borderRadius: 999,
  minWidth: 18,
  textAlign: "center",
};
const note: CSSProperties = {
  display: "flex",
  gap: 9,
  padding: "11px 13px",
  borderRadius: 9,
  background: "var(--tone-info-wash)",
  color: "var(--color-text)",
  fontSize: 12.5,
  lineHeight: 1.5,
  marginBottom: 14,
};
const menuPanel: CSSProperties = {
  zIndex: 200,
  display: "flex",
  flexDirection: "column",
  padding: 5,
  borderRadius: 10,
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
  maxHeight: 340,
  overflowY: "auto",
};
const menuHeader: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-text-muted)",
  padding: "6px 10px 4px",
};
const menuItem: CSSProperties = {
  font: "inherit",
  display: "flex",
  alignItems: "flex-start",
  gap: 9,
  width: "100%",
  padding: "8px 10px",
  border: 0,
  borderRadius: 7,
  background: "transparent",
  color: "var(--color-text)",
  textAlign: "left",
};
const filterBtn: CSSProperties = {
  font: "inherit",
  fontSize: 12.5,
  fontWeight: 600,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 12px",
  borderRadius: 8,
  border: "1px solid var(--color-border)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};
const filterCount: CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  minWidth: 16,
  textAlign: "center",
  padding: "1px 5px",
  borderRadius: 999,
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
};
const tableScroll: CSSProperties = {
  width: "100%",
  overflowX: "auto",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-card)",
  background: "var(--color-surface)",
};
const tableEl: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13.5,
};
const th: CSSProperties = {
  padding: "11px 14px",
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "var(--color-text-muted)",
  borderBottom: "1px solid var(--color-border)",
  whiteSpace: "nowrap",
  position: "sticky",
  top: 0,
  background: "var(--color-surface)",
  zIndex: 1,
};
const td: CSSProperties = {
  padding: "11px 14px",
  borderBottom: "1px solid var(--color-border)",
  verticalAlign: "middle",
};
