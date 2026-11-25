import { useEffect, useState } from "react";
import { fontById, googleFontsUrl, themeTokensSchema, tokensToCssVars, TONES_LIGHT } from "@rasoipulse/config-schema";

/**
 * Dressing real storefront components in a store's own look inside the admin:
 * its colours, corner radius and fonts as CSS custom properties on a wrapper,
 * and its visual effect's CSS scoped to that wrapper — so nothing leaks into
 * the admin around it. Used by the Theme editor and the Appearance page.
 */

/** The effect's stylesheet, scoped to `[data-fx-preview]`. Empty for "none". */
export function useEffectCss(effect) {
  const [css, setCss] = useState("");
  useEffect(() => {
    let live = true;
    if (!effect || effect === "none") {
      setCss("");
      return undefined;
    }
    import("@rasoipulse/ui/effects")
      .then(({ loadEffectCss }) => loadEffectCss(effect, { scope: "[data-fx-preview]", page: "[data-fx-preview]" }))
      .then((c) => live && setCss(c))
      .catch(() => live && setCss(""));
    return () => {
      live = false;
    };
  }, [effect]);
  return css;
}

/** Load the store's Google fonts once, so previews use the faces the storefront does. */
export function useStoreFonts(typography) {
  const url = typography ? googleFontsUrl(typography) : null;
  useEffect(() => {
    if (!url || document.querySelector(`link[data-store-fonts="${url}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = url;
    link.dataset.storeFonts = url;
    document.head.appendChild(link);
  }, [url]);
}

/** The store's light-mode tokens + fonts as CSS variables. */
export function storePreviewVars(config) {
  const tokens = themeTokensSchema.parse(config?.theme?.light ?? {});
  const vars = { ...tokensToCssVars(tokens), ...TONES_LIGHT };
  if (config?.typography) {
    vars["--font-heading"] = fontById(config.typography.headingFont).stack;
    vars["--font-body"] = fontById(config.typography.bodyFont).stack;
  }
  return { vars, tokens };
}

/**
 * A box that renders its children exactly as the storefront would. `flush`
 * drops the inner padding for edge-to-edge pieces like headers and footers.
 */
export function StorePreviewFrame({ config, flush, children, maxHeight = 520 }) {
  const { vars, tokens } = storePreviewVars(config);
  const effect = config?.effect?.style ?? "none";
  const effectCss = useEffectCss(effect);
  useStoreFonts(config?.typography);
  return (
    <>
      {effectCss ? <style>{effectCss}</style> : null}
      <div data-fx-preview="" data-theme="light" style={{ ...vars, ...frame, background: tokens.colorBg, color: tokens.colorText }}>
        <div style={{ padding: flush ? 0 : 18, maxHeight, overflow: "auto" }}>{children}</div>
      </div>
    </>
  );
}

const frame = {
  position: "relative",
  // makes this box the containing block for anything fixed inside (an effect's
  // background layer, a modal) so it stays in the preview instead of the page
  transform: "translateZ(0)",
  overflow: "hidden",
  border: "1px solid var(--color-border)",
  borderRadius: 12,
  fontFamily: "var(--font-body)",
};
