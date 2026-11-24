import { effectPreset, googleFontsUrl, themeCss, typographyCss } from "@rasoipulse/config-schema";
import { loadEffectCss } from "@rasoipulse/ui/effects";

/**
 * Everything that makes the storefront look like *this* restaurant, emitted
 * server-side as one inline <style>: palette, typography, and the active
 * visual effect.
 *
 * Inline rather than a linked stylesheet: no extra render-blocking request on
 * a first visit (better FCP/LCP), nothing to flash in after paint. Only the
 * active effect's CSS is loaded — the other effects never leave the server.
 */
export async function ThemeStyle({ theme, typography, effect, branding }) {
  const fonts = googleFontsUrl(typography);
  const style = effect?.style ?? "none";
  const effectCss = await loadEffectCss(style);

  // the store's own browser-tab icon (blank when the plan doesn't include it — see applyEntitlements)
  const favicon = branding?.faviconUrl;

  return (
    <>
      {favicon ? <link rel="icon" href={favicon} /> : null}
      {fonts ? (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link rel="stylesheet" href={fonts} />
        </>
      ) : null}
      <style
        data-effect={style}
        dangerouslySetInnerHTML={{
          __html: [
            themeCss(theme, { forceDark: effectPreset(style).forcesDark }),
            typographyCss(typography),
            "body { font-family: var(--font-body); font-size: var(--font-size-base); line-height: var(--line-height-body); }",
            "h1,h2,h3,h4 { font-family: var(--font-heading); font-weight: var(--font-weight-heading); letter-spacing: var(--letter-spacing-heading); text-transform: var(--text-transform-heading); }",
            effectCss,
          ].join("\n"),
        }}
      />
    </>
  );
}
