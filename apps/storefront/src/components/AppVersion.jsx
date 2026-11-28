/** The version of Rasoi Pulse this page is running (small, at the very bottom of the footer). It comes from version.json at the build. */
export function AppVersion() {
  return (
    <div data-testid="app-version" style={{ textAlign: "center", padding: "8px 16px 14px", fontSize: 11.5, color: "var(--color-text-muted, #6b7280)", background: "var(--color-surface, transparent)", letterSpacing: "0.02em" }}>
      Rasoi Pulse · {process.env.NEXT_PUBLIC_APP_VERSION || "dev"}
    </div>
  );
}
