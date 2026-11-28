# App screenshots for the website

Takes the screenshots shown on the apps' pages of the website (`/apps/oma`, `/apps/kda`, `/apps/rda`, `/apps/business`) **from the real apps**, running on an
Android emulator set to three different screens — a **tablet held sideways** (2560 × 1600 px at 320 dpi = 1280 × 800 dp), a **tablet held upright**
(1600 × 2560) and a **phone** the shape of a Galaxy S-Ultra (1440 × 3120 px at 560 dpi = 411 × 891 dp, 19.5 : 9) — each in **light** and in **dark**
(the phone's own dark mode), talking to a **throwaway copy of the real API** filled with a made-up restaurant ("Saffron Table"). Nothing real is
involved: not the live server, not a real database, not your release APKs or signing key.

```
node mobile-apps/screenshots/capture.mjs                 everything: 4 apps (OMA, KDA, RDA, Business) × 3 devices × light + dark (builds the apps first if they are not built yet)
node mobile-apps/screenshots/capture.mjs --build         build the three apps again first (after the app's code changed)
node mobile-apps/screenshots/capture.mjs --only kda      just one app (oma, kda, rda, business; comma separated)
node mobile-apps/screenshots/capture.mjs --device phone --theme dark       just one device (tablet-landscape, tablet-portrait, phone) and / or one look
node mobile-apps/screenshots/capture.mjs --shots tables,orders             just these screens (names in scenarios.mjs)
node mobile-apps/screenshots/capture.mjs --look oma --device phone --steps "tap:tab-orders;sleep:1000;look;shot:try"
                                                         explore: sign in, run the steps, print what is on screen, save raw/look-try.png
node mobile-apps/screenshots/serve.mjs                   only the made-up restaurant's server (127.0.0.1:3098), to look at it yourself
```

**You need:** the Android SDK with an emulator and one virtual device (default `Pixel_8_API34`, change with `--avd`), Java 17, Node. If no
emulator is running it starts one headless and stops it again when it is done. A full run takes about an hour (the tablets are slow to read).

## What happens
1. `serve.mjs` starts the real API (same code, an in-memory database) on `127.0.0.1:3098` and seeds the restaurant: a 25-dish menu with photos, 10
   tables with guests seated, kitchen tickets of different ages, and a rider with deliveries in different states. Sign-ins: OMA `asha@saffrontable.test`,
   KDA `meena@saffrontable.test` (both `Staff123!`), RDA phone `9876543210` PIN `4821` — all on the throwaway server only.
2. `build.mjs` builds a **screenshot copy** of each app (release-type, so there is no developer overlay) pointed at `http://localhost:3098` and signed with
   Android's shared debug key. They go to `mobile-apps/screenshots/.build/` — **never** to an app's `build-output/` — and no release key is passed in, so one
   of these can't be mistaken for, or uploaded as, a real release. (It regenerates each app's `android/` folder, as every normal build does; your own APKs in
   `build-output/` are not touched.)
3. `capture.mjs`, for each app, device and look: sets the emulator's screen (`wm size` / `wm density`) and look (`cmd uimode night`), a clean status bar (demo
   mode), **installs the app fresh** (so an order half built by an earlier picture can't show), signs in, runs each scenario from `scenarios.mjs`, takes the
   picture and writes:
   - `mobile-apps/screenshots/raw/*.png` — full-size pictures (not committed)
   - `apps/api/assets/app-screens/<app>-<screen>.<device>.<look>.webp` — 1600 / 1040 / 720 px wide: SOURCE files; the API copies them into the platform's storage (R2) the first time an app's screenshots are read, so nothing is served from a disk
   - `apps/api/src/modules/app-releases/app-shots-builtin.js` — the list (title, caption, description, the pictures) the platform copies into its database the
     first time an app's screenshots are read; after that the console (App Management → Screenshots) owns the list
4. It puts the emulator's screen, look and status bar back, removes `adb reverse`, stops the server, and stops the emulator if it started it.

**The cropping:** a tablet's picture is of the app alone, so the empty band at the top (status bar / camera cut-out, read from Android) **and** the
**taskbar** Android draws along the bottom of any screen 600 dp or wider (its height read from Android too) are cut off, leaving exactly 2560 × 1600 or
1600 × 2560; the website's frame rounds the picture's corners, which hides the app window's own. A phone keeps its status bar (the frame's punch-hole camera
sits in it) and its gesture bar.

## Changing what is shown
- **A different screen or caption:** edit `scenarios.mjs` (each entry: `name`, `title`, `caption`, `alt` — what is on the screen, with no device or look in it, the
  website adds those —, `run`, optional `rank` and `devices`). A scenario runs on every device, so use `c.twoPanel` (the screen is wide enough for the apps'
  two-panel layout, 840 dp) and `c.swipeBy(fx1, fy1, fx2, fy2)` (fractions of the picture) instead of fixed coordinates. Use `--look` to find the ids of what can be tapped.
- **Different data** (names, dishes, orders): edit `serve.mjs`. The restaurant is fictional on purpose: keep real customers' names and numbers out.
- **A different phone or tablet:** the `DEVICES` table at the top of `capture.mjs` (size, dpi, whether the status band is cropped, the website copy's width).
  The website's frames (`SCREENSHOT_DEVICE_INFO` in `packages/config-schema/src/app-screenshots.js`) are drawn for those shapes.
- After a retake, commit the new `apps/api/assets/app-screens/*.webp` and `app-shots-builtin.js`, and redeploy the API (then `npm run seed:screenshots` in
  `apps/api` on the server copies new pictures into R2). An app that is already in the platform's database keeps the list it has: to change one of its pictures use the console (Replace).

Test **t107** checks the pictures (real WebP, the right shape per device, not blank, small, the dark one darker than the light one), the list, and that this
tooling can't touch anything real. The gallery itself is tested by t147 and the console's manager by t148.

## Gotchas
- Don't press BACK to hide a keyboard on this emulator: it leaves the app.
- Don't disable the home app to get rid of the taskbar: SystemUI crashes ("System UI keeps stopping") and only a reboot clears it. The taskbar is cropped instead.
- The API joins `UPLOADS_DIR` to the working directory: use a relative name.
