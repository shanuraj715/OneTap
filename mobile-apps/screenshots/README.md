# App screenshots (tablet) for the website

Takes the screenshots shown on the apps' pages of the website (`/apps/oma`, `/apps/kda`, `/apps/rda`) **from the real apps**, running on an
Android emulator set to a tablet-sized screen (2560 × 1600 px at 320 dpi = 1280 × 800 dp, landscape), talking to a **throwaway copy of the
real API** filled with a made-up restaurant ("Saffron Table"). Nothing real is involved: not the live server, not a real database, not your
release APKs or signing key.

```
node mobile-apps/screenshots/capture.mjs                 everything (builds the apps first if they are not built yet)
node mobile-apps/screenshots/capture.mjs --build         build the three apps again first (after the app's code changed)
node mobile-apps/screenshots/capture.mjs --only kda      just one app (oma, kda, rda; comma separated)
node mobile-apps/screenshots/capture.mjs --look oma --steps "tap:tab-orders;sleep:1000;look;shot:try"
                                                         explore: sign in, run the steps, print what is on screen, save raw/look-try.png
node mobile-apps/screenshots/serve.mjs                   only the made-up restaurant's server (127.0.0.1:3098), to look at it yourself
```

**You need:** the Android SDK with an emulator and one virtual device (default `Pixel_8_API34`, change with `--avd`), Java 17, Node. If no
emulator is running it starts one headless and stops it again when it is done.

## What happens
1. `serve.mjs` starts the real API (same code, an in-memory database) on `127.0.0.1:3098` and seeds the restaurant: a 25-dish menu with photos, 10
   tables with guests seated, kitchen tickets of different ages, and a rider with deliveries in different states. Sign-ins: OMA `asha@saffrontable.test`,
   KDA `meena@saffrontable.test` (both `Staff123!`), RDA phone `9876543210` PIN `4821` — all on the throwaway server only.
2. `build.mjs` builds a **screenshot copy** of each app (release-type, so there is no developer overlay) pointed at `http://localhost:3098` and signed with
   Android's shared debug key. They go to `mobile-apps/screenshots/.build/` — **never** to an app's `build-output/` — and no release key is passed in, so one
   of these can't be mistaken for, or uploaded as, a real release. (It regenerates each app's `android/` folder, as every normal build does; your own APKs in
   `build-output/` are not touched.)
3. `capture.mjs` makes the emulator a tablet (`wm size` / `wm density`, a clean status bar, animations off), reaches the server with `adb reverse`, installs an
   app, signs in, runs each scenario from `scenarios.mjs`, takes the picture, **crops the empty status-bar band off the top** (its height is read from Android, so
   the result is exactly 16:10), and writes:
   - `mobile-apps/screenshots/raw/*.png` — full-size pictures (not committed)
   - `apps/website/public/app-screens/<app>-<name>.webp` — 1600 px wide, what the website serves
   - `apps/website/src/lib/app-shots.json` — the list (title, caption, description, size) the page reads
4. It puts the emulator's screen and status bar back, removes `adb reverse`, stops the server, and stops the emulator if it started it.

## Changing what is shown
- **A different screen or caption:** edit `scenarios.mjs` (each entry: `name`, `title`, `caption`, `alt`, `run`, optional `rank`). Use `--look` to find the
  ids of what can be tapped.
- **Different data** (names, dishes, orders): edit `serve.mjs`. The restaurant is fictional on purpose: keep real customers' names and numbers out.
- **A different tablet:** `--size 2560x1600 --density 320` (the layout switches to two panels from 840 dp wide).
- After a retake, commit the new `apps/website/public/app-screens/*.webp` and `app-shots.json`, and redeploy the website.

Test **t107** checks the pictures (real WebP, 16:10, not blank, small enough), the list, that this tooling can't touch anything real, and the gallery on each
page (tabs by mouse and keyboard, no script needed, phone width, dark mode, reduced motion).
