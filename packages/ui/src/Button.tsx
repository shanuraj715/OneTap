import type { ButtonHTMLAttributes, CSSProperties } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline";
  /** @default "md" */
  size?: "sm" | "md" | "lg";
}

const SIZES: Record<NonNullable<ButtonProps["size"]>, CSSProperties> = {
  sm: { padding: "6px 12px", fontSize: 12.5, borderRadius: "calc(var(--radius-card) - 2px)" },
  md: { padding: "10px 18px", fontSize: "1rem" },
  lg: { padding: "13px 24px", fontSize: "1.0625rem" },
};

/**
 * Minimal themed button — proves the token contract: colours come only from
 * CSS custom properties, so it follows whatever theme the outlet has applied.
 */
export function Button({ variant = "primary", size = "md", style, ...rest }: ButtonProps) {
  const base: CSSProperties = {
    font: "inherit",
    fontWeight: 600,
    lineHeight: 1.2,
    borderRadius: "var(--radius-card)",
    border: "1px solid var(--color-primary)",
    cursor: "pointer",
  };
  const skin: CSSProperties =
    variant === "primary"
      ? { background: "var(--color-primary)", color: "var(--color-on-primary)" }
      : { background: "transparent", color: "var(--color-primary)" };

  return <button type="button" {...rest} style={{ ...base, ...SIZES[size], ...skin, ...style }} />;
}
