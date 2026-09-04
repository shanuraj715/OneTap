"use client";

import type { CSSProperties } from "react";
import type { ButtonVariantProps } from "./types";

const base: CSSProperties = {
  font: "inherit",
  fontWeight: 600,
  fontSize: "var(--text-sm)",
  lineHeight: 1.2,
  padding: "11px 20px",
  cursor: "pointer",
  border: "1px solid transparent",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
};

const make = (style: CSSProperties) =>
  function Btn({ children, disabled, onClick }: ButtonVariantProps) {
    return (
      <button
        type="button"
        className="ot-press"
        disabled={disabled}
        onClick={onClick}
        style={{ ...base, ...style, opacity: disabled ? 0.55 : 1 }}
      >
        {children}
      </button>
    );
  };

/** 01 filled with the brand colour */
export const ButtonSolid = make({
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  borderRadius: "var(--radius-card)",
});

/** 02 outline */
export const ButtonOutline = make({
  background: "transparent",
  color: "var(--color-primary)",
  borderColor: "var(--color-primary)",
  borderRadius: "var(--radius-card)",
});

/** 03 soft tinted fill */
export const ButtonSoft = make({
  background: "color-mix(in srgb, var(--color-primary) 14%, transparent)",
  color: "var(--color-primary)",
  borderRadius: "var(--radius-card)",
});

/** 04 pill */
export const ButtonPill = make({
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  borderRadius: 999,
  padding: "11px 26px",
});

/** 05 square, no radius */
export const ButtonSquare = make({
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  borderRadius: 0,
});

/** 06 ghost — text only until hovered */
export const ButtonGhost = make({
  background: "transparent",
  color: "var(--color-text)",
  borderRadius: "var(--radius-card)",
  padding: "11px 14px",
});

/** 07 link */
export const ButtonLink = make({
  background: "transparent",
  color: "var(--color-primary)",
  padding: "4px 2px",
  textDecoration: "underline",
  textUnderlineOffset: 3,
});

/** 08 elevated with a shadow */
export const ButtonElevated = make({
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  borderRadius: "var(--radius-card)",
  boxShadow: "0 6px 16px color-mix(in srgb, var(--color-primary) 40%, transparent)",
});

/** 09 hard offset shadow */
export const ButtonOffset = make({
  background: "var(--color-primary)",
  color: "var(--color-on-primary)",
  borderRadius: "var(--radius-card)",
  borderColor: "var(--color-text)",
  boxShadow: "3px 3px 0 var(--color-text)",
});

/** 10 uppercase, wide tracking */
export const ButtonUppercase = make({
  background: "var(--color-text)",
  color: "var(--color-bg)",
  borderRadius: 2,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  fontSize: "0.72rem",
  padding: "12px 22px",
});
