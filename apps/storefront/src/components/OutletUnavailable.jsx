import { ThemeStyle } from "@/components/ThemeStyle";

/**
 * Shown in place of an outlet the platform has blocked (its store is over the
 * plan's outlet limit). The outlet still resolves — in its own colours and
 * fonts — but nothing about its menu or ordering is offered; the API refuses
 * orders and table sessions for it as well.
 *
 * Without an outlet (every outlet of the store is blocked) it renders on the
 * default theme.
 */
export function OutletUnavailable({ outlet }) {
  const config = outlet?.config;
  const name = config?.identity.name || outlet?.name || "This restaurant";
  return (
    <>
      {config ? <ThemeStyle theme={config.theme} typography={config.typography} effect={config.effect} /> : null}
      <main style={{ maxWidth: 460, margin: "120px auto", padding: 24, textAlign: "center" }}>
        <h1 style={{ fontSize: 22, marginBottom: 8, fontFamily: "var(--font-heading)" }}>{name}</h1>
        <p style={{ color: "var(--color-text-muted)", margin: 0 }}>
          This outlet is temporarily unavailable. Please check back soon.
        </p>
      </main>
    </>
  );
}
