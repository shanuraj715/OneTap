# Rasoi Pulse — logo, web favicon and the app icons (OMA, KDA, RDA)

Open **`preview.png`** to see everything on one sheet.

## The artwork
**Your two images, used as they are.** `source/` holds the originals you sent (`rasoi-pulse-original-dark.png`,
`rasoi-pulse-original-light.png`). I traced them into true vector outlines (`artwork.json`: the hat with its three pleat slits,
the heartbeat with its notch cut into the hat, and the dot), so every variant below is sharp at any size and the shapes are
exactly yours. Colours are yours too: navy `#10111B`, cream `#FCF3E2`, orange `#FF9008`, mint `#79F9BB` (dark) and maroon
`#6D0A19`, red `#BE112D`, wine `#901E30` (light).

## The family rule
Every Rasoi Pulse product uses this same artwork; what tells them apart:

| | the artwork | the label |
|---|---|---|
| **Brand / website** | alone, big | none |
| **OMA app icon** (staff app) | a little smaller and higher | **OMA** under it, on an **indigo** tile `#404DB6` (letters drawn with the same thick round stroke as the heartbeat) |
| **KDA app icon** (kitchen app) | the same | **KDA** under it, on a **teal** tile `#0D7F6B`: the colour is what tells the apps apart on a home screen |
| **RDA app icon** (rider app) | the same | **RDA** under it, on a **violet** tile `#764ED1` |

**One colour per app, everywhere.** An app's tile colour is also its PRIMARY colour inside the app (`mobile-apps/<app>/src/ui/theme.ts`: buttons, tabs, links; light and dark, with the page, cards and lines tinted toward it) and the accent of its page on the website (`apps/website/src/lib/app-art.js`, a brighter shade for glows). Change it in `APPS` in `build.mjs`, `theme.ts` and `app.config.ts` together — tests (`config.test.ts`, `theme.test.ts` in each app) fail if the icon and the in-app colour drift apart.
| the next app | same | its own 3-letter code and tile colour (add them in `build.mjs`, `APPS`; new letters in `GLYPHS`) |

## Folders
- **`logo/`** — the Rasoi Pulse artwork alone.
  - `svg/tile`, `png/tile` — on a tile (`rounded` — your dark image's corner radius — `square`, `circle`) in 7 colour styles: `multi-dark` (**= your dark image**), `multi-red`, `duo-navy`, `duo-red` (two colours), `mono-black`, `mono-white`, `mono-red` (one colour: the artwork is **cut out** of the tile, so it is transparent).
  - `svg/mark`, `png/mark` — transparent background: `multi-light` (**= your light image**), `multi-dark` (for dark backgrounds), `duo-light`, `duo-dark`, `mono-black`, `mono-white`, `mono-red`.
- **`favicon/`** — `favicon.svg`, `favicon.ico` (16, 32, 48), `favicon-16/32/48/64.png`, `apple-touch-icon-180.png`, `web-app-192/512.png`, `web-app-maskable-512.png`. At 16 and 32 px the drawing is simplified (no pleat slits or dot, a thicker heartbeat) because fine details disappear; 48 px and up use the full artwork. `variants/` has the favicon in all 7 colour styles.
- **`oma-app-icon/`**, **`kda-app-icon/`** and **`rda-app-icon/`** — the artwork + **OMA** / **KDA** / **RDA** (the same structure in all three; the tile and Android background are the app's own colour: indigo, teal, violet):
  - `svg/app-icon`, `png/app-icon` — the 7 colour styles × `rounded`, `square`, `circle` (PNG 1024 … 32).
  - `svg/no-tile`, `png/no-tile` — the artwork + OMA on a transparent background (7 styles).
  - `android-adaptive/` — Android icons are two layers the phone stacks and crops: `LAYER-background-no-icon` (the plain tile colour, on purpose), `LAYER-foreground-icon`, `LAYER-monochrome-for-themed-icons`; `PREVIEW-…` shows them stacked, which is what a phone displays.
  - `expo-drop-in/` — the same six file names and sizes as `mobile-apps/<app>/assets/` (`mobile-apps/kda/assets/` and `mobile-apps/rda/assets/` already have theirs). Copy them over the old ones to use the icon in the app (`favicon.png` there is the brand favicon; `splash-icon.png` is the light-colour artwork + OMA for a light splash screen). Nothing in the app was changed.

HTML for the website:
```html
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon-180.png">
```

## Making them again
`node brand/rasoi-pulse/build.mjs` draws everything from `artwork.json` (edit the top of the file for colours, the code or the layout).
If the artwork itself changes, `artwork.json` must be traced again from the new image (a small one-off script; ask for it).
