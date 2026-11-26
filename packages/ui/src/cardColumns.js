/**
 * How many cards go in a row of the menu.
 *
 * Every card style has a natural ("actual") width. A card may be drawn between 70% and 120% of it, depending on how wide
 * the screen is; when the row cannot hold a whole number of cards inside that window, the NUMBER of cards in the row
 * changes instead (a card is never squeezed below 70%, and is not stretched past 120% while another card would still fit).
 * A store that picks "N cards a row" by hand sets the most there may be — a narrower screen holds fewer, never more.
 *
 * Pure (no DOM), so the page and the tests use the very same rule.
 */

export const CARD_SHRINK = 0.7; // the smallest a card is drawn, as a share of its natural width
export const CARD_GROW = 1.2; // the largest, while one more card in the row would still fit
export const CARD_GAP = 12; // px between cards
const MOST_AUTO = 8; // the most cards in a row when the store hasn't chosen a number

/** A card style's natural width: a little more than the narrowest it was designed for (`minWidth`). */
export const cardBaseWidth = (variant) => Math.round((variant?.minWidth || 280) * 1.15);

/**
 * @param {number} width     the room for one row of cards, in px
 * @param {number} base      the card's natural width
 * @param {number} [maxCols] the most cards the store allows in a row (omit for "as many as fit")
 * @param {number} [gap]
 * @returns {number} how many cards to put in the row (at least 1)
 */
export function pickColumns(width, base, maxCols, gap = CARD_GAP) {
  if (!(width > 0) || !(base > 0)) return 1;
  const widthOf = (n) => (width - (n - 1) * gap) / n; // one card's width when the row holds n
  // the most cards that still keep every card at 70% or more
  const fit = Math.max(1, Math.floor((width + gap) / (base * CARD_SHRINK + gap)));
  const most = Math.max(1, Math.min(fit, maxCols ? Math.floor(maxCols) : MOST_AUTO));
  let best = 1;
  let bestScore = Infinity;
  for (let n = 1; n <= most; n += 1) {
    const w = widthOf(n);
    // closest to the natural size wins; a card past 120% is only taken when nothing inside the window exists
    const score = Math.abs(Math.log(w / base)) + (w > base * CARD_GROW ? 1 : 0);
    if (score < bestScore - 1e-9) {
      best = n;
      bestScore = score;
    }
  }
  return best;
}
