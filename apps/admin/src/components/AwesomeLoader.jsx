import { UtensilsCrossed } from "lucide-react";

export function AwesomeLoader({
  label = "Loading…",
  subtext,
  icon: Icon = UtensilsCrossed,
  fullScreen = false,
  compact = false,
  size = compact ? 40 : 64,
}) {
  const iconSize = compact ? 16 : 24;

  const content = (
    <div
      className="ot-awesome-loader"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: compact ? 8 : 16,
        padding: compact ? "16px 12px" : "48px 24px",
        animation: "ot-fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {/* Outer wrapper with glow and spinning rings */}
      <div
        style={{
          position: "relative",
          width: size,
          height: size,
          display: "grid",
          placeItems: "center",
        }}
      >
        {/* Soft background pulsing halo */}
        <div
          style={{
            position: "absolute",
            inset: -8,
            borderRadius: "50%",
            background: "radial-gradient(circle, color-mix(in srgb, var(--color-primary) 22%, transparent) 0%, transparent 70%)",
            animation: "ot-pulse-halo 2.4s ease-in-out infinite",
            pointerEvents: "none",
          }}
        />

        {/* Outer counter-spinning subtle dashed ring */}
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{
            position: "absolute",
            inset: 0,
            animation: "ot-spin-counter 3s linear infinite",
          }}
        >
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="3"
            strokeDasharray="8 6"
            opacity="0.8"
          />
        </svg>

        {/* Primary gradient fast orbital spinner */}
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          style={{
            position: "absolute",
            inset: 0,
            animation: "ot-spin-clockwise 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite",
          }}
        >
          <defs>
            <linearGradient id="ot-spinner-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="1" />
              <stop offset="60%" stopColor="var(--color-primary)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="url(#ot-spinner-grad)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray="140 160"
          />
        </svg>

        {/* Central badge with breathing icon */}
        <div
          style={{
            width: size * 0.58,
            height: size * 0.58,
            borderRadius: "50%",
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.06)",
            display: "grid",
            placeItems: "center",
            color: "var(--color-primary)",
            zIndex: 1,
            animation: "ot-breathe 2s ease-in-out infinite",
          }}
        >
          <Icon size={iconSize} strokeWidth={2.2} />
        </div>
      </div>

      {/* Label and bouncing dots */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: compact ? 12.5 : 14.5,
            fontWeight: 600,
            fontFamily: "var(--font-heading)",
            color: "var(--color-text)",
            display: "inline-flex",
            alignItems: "center",
            gap: 2,
            letterSpacing: "-0.01em",
          }}
        >
          <span>{label}</span>
          <span style={{ display: "inline-flex", gap: 2.5, marginLeft: 2, alignItems: "center" }}>
            <span
              style={{
                width: 3.5,
                height: 3.5,
                borderRadius: "50%",
                background: "var(--color-primary)",
                display: "inline-block",
                animation: "ot-dot-bounce 1.2s infinite ease-in-out",
                animationDelay: "0ms",
              }}
            />
            <span
              style={{
                width: 3.5,
                height: 3.5,
                borderRadius: "50%",
                background: "var(--color-primary)",
                display: "inline-block",
                animation: "ot-dot-bounce 1.2s infinite ease-in-out",
                animationDelay: "200ms",
              }}
            />
            <span
              style={{
                width: 3.5,
                height: 3.5,
                borderRadius: "50%",
                background: "var(--color-primary)",
                display: "inline-block",
                animation: "ot-dot-bounce 1.2s infinite ease-in-out",
                animationDelay: "400ms",
              }}
            />
          </span>
        </div>
        {subtext && !compact ? (
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-body)",
            }}
          >
            {subtext}
          </p>
        ) : null}
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--color-bg)",
          display: "grid",
          placeItems: "center",
          zIndex: 9999,
        }}
      >
        {content}
      </div>
    );
  }

  return content;
}
