import {
  googleFontsUrl,
  themeCss,
  typographyCss,
  type Theme,
  type Typography,
} from "@onetap/config-schema";

/**
 * Emits the outlet's theme + typography as CSS custom properties, and pulls in
 * whichever web fonts it uses. Zero client JS — every component reads the tokens.
 */
export function ThemeStyle({ theme, typography }: { theme: Theme; typography: Typography }) {
  const fonts = googleFontsUrl(typography);
  return (
    <>
      {fonts ? (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
          <link rel="stylesheet" href={fonts} />
        </>
      ) : null}
      <style
        dangerouslySetInnerHTML={{
          __html: [
            themeCss(theme),
            typographyCss(typography),
            "body { font-family: var(--font-body); font-size: var(--font-size-base); line-height: var(--line-height-body); }",
            "h1,h2,h3,h4 { font-family: var(--font-heading); font-weight: var(--font-weight-heading); letter-spacing: var(--letter-spacing-heading); text-transform: var(--text-transform-heading); }",
          ].join("\n"),
        }}
      />
    </>
  );
}
