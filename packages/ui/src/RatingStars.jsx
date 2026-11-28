"use client";

import { useId, useState } from "react";

/**
 * Rating stars in the store's own colour — never the stock yellow. Each star is a soft, rounded shape with a gentle gradient (a lighter top, the
 * theme colour below) and a small shine; an empty one is a faint tint of the same colour with a thin edge. The colour is `--color-primary` (the
 * store's theme on the storefront, the page's accent in the admin panel) unless a `color` is given.
 *
 *   <RatingStars value={4.3} />                      read only, a partly filled fifth star for the .3
 *   <RatingStars value={stars} onChange={setStars} size={32} />   five buttons the customer taps (a radio group, arrow keys work)
 *
 * Touching a star pops it; a star under the finger / pointer lights the stars up to it. Reduced motion: no pop.
 */

// a five-point star with rounded corners: the points are drawn, then a round-joined stroke of the same colour softens them
const STAR = "M12 3.1l2.55 5.35 5.85.78-4.27 4.06 1.07 5.8L12 16.2 6.8 19.1l1.07-5.8L3.6 9.23l5.85-.78z";
const SHINE = "M12 5.6l1.5 3.15 3.45.46-1.6 1.5";

export const RATING_LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/** One star, filled from 0 to 1 (a fraction fills it from the left). */
export function StarShape({ fill = 1, size = 20, color, uid }) {
  const f = Math.max(0, Math.min(1, fill));
  const gid = `rs-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={`${gid}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style={{ stopColor: `color-mix(in srgb, ${color} 72%, white)` }} />
          <stop offset="100%" style={{ stopColor: color }} />
        </linearGradient>
        <clipPath id={`${gid}-c`}><rect x="0" y="0" width={24 * f} height="24" /></clipPath>
      </defs>
      {/* the empty star: a faint tint of the colour and a thin edge */}
      <path d={STAR} fill={`color-mix(in srgb, ${color} 13%, transparent)`} stroke={`color-mix(in srgb, ${color} 38%, transparent)`} strokeWidth="1.4" strokeLinejoin="round" />
      {f > 0 ? (
        <g clipPath={`url(#${gid}-c)`} data-filled={f}>
          <path d={STAR} fill={`url(#${gid}-g)`} stroke={`url(#${gid}-g)`} strokeWidth="1.6" strokeLinejoin="round" />
          <path d={SHINE} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ) : null}
    </svg>
  );
}

export function RatingStars({ value = 0, onChange, size = 18, gap, color, label, showValue = false, readOnly, testId = "star", className = "", style = {} }) {
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState(0);
  const tint = color || "var(--color-primary, #6d5dfc)";
  const interactive = typeof onChange === "function" && !readOnly;
  const shown = interactive && hover ? hover : value;
  const space = gap ?? Math.max(2, Math.round(size * 0.14));
  const text = label ?? `${Math.round((Number(value) || 0) * 10) / 10} out of 5 stars`;

  if (!interactive) {
    return (
      <span className={`rasoipulse-stars ${className}`} role="img" aria-label={text} data-value={value} style={{ display: "inline-flex", alignItems: "center", gap: space, ...style }}>
        {[1, 2, 3, 4, 5].map((n) => <StarShape key={n} fill={Math.max(0, Math.min(1, (Number(value) || 0) - (n - 1)))} size={size} color={tint} uid={`${uid}${n}`} />)}
        {showValue ? <span style={{ marginLeft: 4, fontWeight: 700, fontSize: Math.max(12, size * 0.7), fontVariantNumeric: "tabular-nums" }}>{(Math.round((Number(value) || 0) * 10) / 10).toFixed(1)}</span> : null}
      </span>
    );
  }

  const pick = (n) => onChange(n);
  const onKey = (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); pick(Math.min(5, (value || 0) + 1)); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); pick(Math.max(1, (value || 1) - 1)); }
  };
  return (
    <span className={`rasoipulse-stars ${className}`} role="radiogroup" aria-label={label || "Stars"} onKeyDown={onKey} onMouseLeave={() => setHover(0)} style={{ display: "inline-flex", alignItems: "center", gap: space, ...style }}>
      <style>{`.rasoipulse-star-btn{transition:transform .16s cubic-bezier(.3,1.6,.5,1)}.rasoipulse-star-btn:active{transform:scale(.88)}.rasoipulse-star-btn[data-on="1"]{transform:scale(1.08)}.rasoipulse-star-btn:focus-visible{outline:2px solid ${tint};outline-offset:2px;border-radius:8px}@media (prefers-reduced-motion:reduce){.rasoipulse-star-btn{transition:none}}`}</style>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"} — ${RATING_LABELS[n]}`}
          tabIndex={value === n || (!value && n === 1) ? 0 : -1}
          className="rasoipulse-star-btn"
          data-testid={`${testId}-${n}`}
          data-on={n <= shown ? "1" : "0"}
          onClick={() => pick(n)}
          onMouseEnter={() => setHover(n)}
          onFocus={() => setHover(0)}
          style={{ border: "none", background: "none", padding: Math.max(2, Math.round(size * 0.1)), cursor: "pointer", lineHeight: 0, WebkitTapHighlightColor: "transparent" }}
        >
          <StarShape fill={n <= shown ? 1 : 0} size={size} color={tint} uid={`${uid}${n}`} />
        </button>
      ))}
      {showValue && value ? <span style={{ marginLeft: 6, fontWeight: 700, fontSize: Math.max(12, size * 0.5) }}>{RATING_LABELS[value]}</span> : null}
    </span>
  );
}

/** A small pill: the stars' average as a number with one star and how many ratings it comes from — "4.3 ★ · 12". */
export function RatingBadge({ value, count, color, size = 13 }) {
  const uid = useId().replace(/:/g, "");
  const tint = color || "var(--color-primary, #6d5dfc)";
  return (
    <span data-testid="rating-badge" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px 3px 6px", borderRadius: 999, background: `color-mix(in srgb, ${tint} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${tint} 30%, transparent)`, fontSize: size, fontWeight: 700, fontVariantNumeric: "tabular-nums", lineHeight: 1.2 }}>
      <StarShape fill={1} size={size + 1} color={tint} uid={uid} />
      {count ? (Math.round(value * 10) / 10).toFixed(1) : "—"}
      {typeof count === "number" ? <span style={{ fontWeight: 500, opacity: 0.7 }}>· {count}</span> : null}
    </span>
  );
}
