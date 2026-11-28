# T103 — Website → header keeps to Product / Pricing / Apps / FAQ (About + Contact in the footer); homepage has a short animated 'We have apps too' note (no cards); hero backdrop fades out; livelier Features and moments; motion that stops under reduce-motion; no text selection or text cursor

**Area:** website · **Last result:** ✅ PASSED (61 passed, 0 failed · 2026-11-28 14:16 · headless · 8.9 s)

**Run it alone:** `node run.mjs --only t103` (add `--visible` to watch it)

## What this test does

Runs suites/website-home-apps-motion.mjs in Chrome against the bench API and the marketing website on :3173 (built from the current code into .bench/website — never touching apps/website/.next). The bench has no website pages, so the suite publishes its own (home with hero, product tabs, stats, features and moments; pricing, faq, about, contact) and removes them afterwards. Header: Pricing, Apps, FAQ after the Product dropdown plus the Talk to us button, no About/Contact (also in the phone menu); footer has About, Contact and Apps. Home: an 'apps' section right after the product tabs — 'We have apps too', a few words, one 'See the apps' link, an animated picture of an order ticket travelling OMA → KDA → RDA (ticket slides, dashed line marches, apps bob and ring when the ticket arrives), and NO app cards or download buttons. The hero's coloured backdrop stays inside the hero, is masked to fade out, and at the hero's bottom edge (1360 px and 390 px) the pixel colour equals the page colour (no hard line, the bug the user reported). The dark stats band has no border. Features: 56 px tinted tiles in different colours, a faint big icon per card, a drifting colour behind (masked), and a light that follows the pointer (--mx/--my, bright edge + wash, lift). Moments: small WHEN label + capitalised rest, a title without 'When' left as written, pulsing dot, two columns. Scroll-reveal: a far card starts faded and is visible once scrolled to, nothing at the top is left invisible. With reduce-motion every animation is off and everything is fully visible (the ticket rests between the first two apps). Text can't be selected (triple-click, drag, Select All select nothing) and the pointer is an arrow over text and a hand over links/buttons; typing fields and the checksum box still allow selection. /apps still shows its three cards. A 390 px screen has no sideways overflow.

## Steps

- _(set-up)_
1. Header: Product, Pricing, Apps, FAQ and Talk to us — About and Contact are in the footer
2. The homepage's apps note: a few words and an animated picture — no cards, no downloads
3. …and it moves
4. The hero's coloured backdrop fades out — it must not end in a line
5. The stats band has no thin outline
6. Features: coloured icon tiles, a faint big icon in each card, a light that follows the pointer
7. 'The moments…': cards with a small WHEN label, a tinted round icon and a live dot
8. Scroll-reveal: blocks rise into place as they come into view, and nothing stays hidden
9. 'Reduce motion': everything stands still and is fully visible
10. Text can't be selected and the pointer is never the text I-beam
11. The apps page still shows its cards (the homepage note shares nothing with them but the icons)
12. A phone: nothing sticks out sideways

## What to expect (these must happen)

- Header = Product dropdown, Pricing, Apps, FAQ, Talk to us; footer has About, Contact, Apps.
- The homepage's apps section sits after the product tabs, is short, links to /apps and its picture moves.
- At the hero's bottom edge the colour is the page colour on wide and phone screens.
- With reduce-motion nothing animates and everything is visible.
- Selecting text selects nothing; the pointer is an arrow or a hand, never the I-beam (except inside typing fields).

## What must NOT happen

- The homepage must NOT show app cards or download buttons.
- About and Contact must NOT be in the header.
- The hero colour must NOT end in a hard line; the stats band must NOT have a thin outline.
- No errors in the browser; nothing off the edge on a phone.

## Result of the last run

### ❌ Failed (0)

_Nothing failed._

### ✅ Passed (61)

**Set-up — Setup**

- the suite's five website pages were created — _5/5_

**Step 1 — Header: Product, Pricing, Apps, FAQ and Talk to us — About and Contact are in the footer**

- the header's links are Pricing, Apps, FAQ (in that order) — _Pricing \| Apps \| FAQ_
- …after the Product dropdown
- Apps goes to /apps
- the Talk to us button is still there
- no About and no Contact in the header
- the footer has About and Contact
- …and Apps
- the phone menu lists Apps, Pricing and FAQ — _QR \| Kitchen \| Pricing \| Apps \| FAQ \| Talk to us_
- …and no About or Contact

**Step 2 — The homepage's apps note: a few words and an animated picture — no cards, no downloads**

- the homepage has an apps section
- it says 'We have apps too'
- …in a few words, not a long description — _290 characters_
- it sits right after the product tabs, before the stats band
- no app cards on the homepage
- no download buttons on the homepage
- one link to the apps page: 'See the apps'
- the picture shows the three apps in order of an order's journey — _Take the order \| Cook it \| Deliver it_
- each with its own icon
- the picture has a text description for screen readers

**Step 3 — …and it moves**

- the order ticket slides along the line — _0px → 62px_
- the dashed line marches, each app bobs and lights up when the ticket arrives — _{"ticket":"apps-ticket","line":"apps-march","ring":"apps-node-ping","bob":"apps-bob"}_

**Step 4 — The hero's coloured backdrop fades out — it must not end in a line**

- 1360px: the backdrop is held inside the hero (not spilling over the next section)
- 1360px: it fades out towards the bottom (a mask, not a hard edge) — _linear-gradient(rgb(0, 0, 0), rgb(0, 0,_
- 1360px: the colour has faded to the page colour right at the hero's bottom edge — _245,244,240 vs page 245,244,240_
- 390px: the backdrop is held inside the hero (not spilling over the next section)
- 390px: it fades out towards the bottom (a mask, not a hard edge) — _linear-gradient(rgb(0, 0, 0), rgb(0, 0,_
- 390px: the colour has faded to the page colour right at the hero's bottom edge — _245,244,240 vs page 245,244,240_

**Step 5 — The stats band has no thin outline**

- the dark 'Built for the rush' band has no border line — _{"top":"0px","left":"0px"}_

**Step 6 — Features: coloured icon tiles, a faint big icon in each card, a light that follows the pointer**

- every feature card has its icon, and a faint big copy of it
- the icon tile is 56 px — _{"w":56,"h":56}_
- neighbouring cards take different colours — _#C8372D #12a58a #8b5cf6 #e08a00_
- a soft drifting colour sits behind the features and the moments
- …and fades out top and bottom, so it never ends in a line
- hovering records where the pointer is inside the card — _124px, 158px_
- the card's edge and wash light up under the pointer
- the card lifts — _matrix(1, 0, 0, 1, 0, -4)_

**Step 7 — 'The moments…': cards with a small WHEN label, a tinted round icon and a live dot**

- all moments are shown
- the three that start with 'When' get the small label — _3_
- …and the rest of the sentence starts with a capital — _When The queue is out the door_
- a title without 'When' is shown exactly as written — _Waiters who never sleep_
- each icon carries a small pulsing dot — _rp-beat_
- two columns on a wide screen

**Step 8 — Scroll-reveal: blocks rise into place as they come into view, and nothing stays hidden**

- a card far down the page starts faded and is fully visible once scrolled into view — _0.00 → 1_
- what is on screen at load is never left invisible
- the hero's emphasised word gets a highlighter line that draws itself in — _{"img":"linear-gradient(rgb(200, 55, 4","anim":"rp-underline"}_
- feature icons breathe gently — _rp-bob_

**Step 9 — 'Reduce motion': everything stands still and is fully visible**

- no animation runs anywhere on the page
- the cards and the apps picture are fully visible without scrolling
- the order ticket rests visibly between the first two apps — _25%_

**Step 10 — Text can't be selected and the pointer is never the text I-beam**

- body text, headings, paragraphs and cards are user-select: none — _{"sel":"none","cursor":"default"}_
- over text the pointer is the ordinary arrow — _{"sel":"none","cursor":"default"}_
- over links and buttons it is the hand
- a triple-click, a drag across the heading and Select All select nothing — _["","",""]_
- typing fields still allow selecting what you typed — _{"picked":"hello world","userSelect":"text","cursor":"text"}_

**Step 11 — The apps page still shows its cards (the homepage note shares nothing with them but the icons)**

- /apps still has one card per app — _3_
- each card still links to its own page
- an app page's file checksum can still be selected and copied — _{"sel":"text","cursor":"text"}_

**Step 12 — A phone: nothing sticks out sideways**

- the homepage fits a 390 px screen — _0px over; span.stamp:459_
- …including the animated apps picture
- no errors in the browser

## History (latest 10 runs)

| When | Result | Passed | Failed | Mode | Time |
|---|---|---|---|---|---|
| 2026-11-28 14:16 | pass | 61 | 0 | headless | 8.9 s |
| 2026-11-28 14:15 | fail | 56 | 5 | headless | 8.8 s |
| 2026-11-28 14:01 | pass | 61 | 0 | headless | 9.2 s |
| 2026-11-27 16:56 | pass | 61 | 0 | headless | 9.8 s |
| 2026-11-27 10:50 | pass | 61 | 0 | headless | 9.7 s |

---
_Generated by `tests/e2e/run.mjs` — edit the test file (`tests/t103-website-home-apps-motion.mjs`), not this page._
