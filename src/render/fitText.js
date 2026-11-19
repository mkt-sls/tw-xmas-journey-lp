// Card headline fit: at most 2 balanced lines.
//  1. CSS does the balancing (text-wrap: balance, see .card__amount). Amount + currency units are already unbreakable (nb()).
//  2. If the headline still needs more than 2 lines (or a unit is wider than the box and a word would be cut) at the design size, the font size of THAT headline only goes down
//     one pixel at a time to HEADLINE_MIN. Short headlines ("82 FS") are one line at the design size and are never touched.
//  3. Browsers without text-wrap: balance get the same result from a width search (narrowest width that keeps the line count).
// Measured with layout numbers (offsetHeight / line height), so the opening animation's transform does not disturb it.

export const HEADLINE_MAX = 40; // design size (px), same as .card__amount in components.css
export const HEADLINE_MIN = 28; // 70 % of the design size

const CAN_BALANCE = typeof CSS !== 'undefined' && CSS.supports?.('text-wrap', 'balance');

function lineCount(el) {
  const fs = parseFloat(getComputedStyle(el).fontSize);
  return Math.max(1, Math.round(el.offsetHeight / (fs * 1.05)));
}

/** true when a no-break unit is wider than the box: overflow-wrap:anywhere would then cut a word in the middle ('ФРИСПИНО / В') */
function cutsWord(el) {
  const keep = el.style.overflowWrap;
  el.style.overflowWrap = 'normal';
  // the grid cell grows with an unbreakable unit, so compare with the container, not with the headline box itself
  const over = el.scrollWidth > el.parentElement.clientWidth + 0.5;
  el.style.overflowWrap = keep;
  return over;
}

/** Reset and re-fit one headline element (.card__amount). Returns the chosen size in px. */
export function fitHeadline(el) {
  if (!el || !el.offsetWidth) return null;
  el.style.fontSize = '';
  el.style.maxWidth = '';
  let size = HEADLINE_MAX;
  while ((lineCount(el) > 2 || cutsWord(el)) && size > HEADLINE_MIN) {
    size -= 1;
    el.style.fontSize = `${size}px`;
  }
  if (!CAN_BALANCE && lineCount(el) === 2) {
    // narrowest width that still gives 2 lines = balanced lines
    let lo = 0;
    let hi = el.offsetWidth;
    while (hi - lo > 2) {
      const mid = (lo + hi) / 2;
      el.style.maxWidth = `${mid}px`;
      if (lineCount(el) <= 2) hi = mid;
      else lo = mid;
    }
    el.style.maxWidth = `${Math.ceil(hi)}px`;
  }
  return size;
}

/** Fit now (before first paint), again once the fonts are loaded and whenever the card width changes (resize, zoom, rotate). */
export function fitCard(card) {
  const el = card?.querySelector('.card__amount');
  if (!el) return;
  const run = () => fitHeadline(el);
  run();
  document.fonts?.ready.then(run);
  if (typeof ResizeObserver !== 'undefined') {
    let w = card.clientWidth;
    new ResizeObserver(() => {
      if (card.clientWidth !== w) {
        w = card.clientWidth;
        run();
      }
    }).observe(card);
  }
}
