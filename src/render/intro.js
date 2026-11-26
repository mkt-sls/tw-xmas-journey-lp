import { esc, escNb, hasMarks } from './util.js';

// "1–26 DECEMBER · 26 GIFTS" -> date pill + gold "26 GIFTS" (Figma "Eyebrow v2"). Without a " · " the whole text is the pill.
function eyebrow(text) {
  const [dates, ...rest] = String(text ?? '').split(/\s+·\s+/);
  const gifts = rest.join(' · ');
  return `<span class="intro__dates">${escNb(dates)}</span>${gifts ? `<span class="intro__gifts">${escNb(gifts)}</span>` : ''}`;
}

// Title in two parts from the data (title_a white, title_b orange gradient; Figma "Title v2"). Each language chooses its own split;
// title_join = "1": the parts read as one word on desktop (no gap). Without title_a/title_b the last word of campaign_title is the gradient part.
function title(ui) {
  let a = ui.title_a;
  let b = ui.title_b;
  if (!a || !b) {
    const words = String(ui.campaign_title ?? '').trim().split(/\s+/);
    b = words.length > 1 ? words.pop() : '';
    a = words.join(' ');
  }
  return `<span class="intro__title-a">${esc(a)}</span>${b ? `<span class="intro__title-b">${esc(b)}</span>` : ''}`;
}

// Mobile title fit (owner 2026-11-26, item B): when the first part wraps on its own ("CĂLĂTORIA DE" on RO at 320-366 px), the title
// goes down 0.5 px at a time until that part is one line again (RO 320: 46 -> 39.5 px, 2 lines instead of 3, the route moves up).
// Titles whose parts already fit keep the CSS size, so EN / DE / NL and RO at 375+ are untouched. A single word never wraps, so it
// never triggers the fit. Desktop: no fit (nowrap row). Line count from layout numbers (offsetHeight), so transforms do not disturb it.
export const TITLE_MIN = 30;
const TITLE_LINE_HEIGHT = 0.95; // .intro__title line-height

export function fitTitle(root, layout) {
  const h = root.querySelector('.intro__title');
  const a = h?.querySelector('.intro__title-a');
  if (!a) return null;
  h.style.fontSize = '';
  if (layout !== 'mobile' || !a.offsetWidth) return null;
  const lines = () => Math.round(a.offsetHeight / (parseFloat(getComputedStyle(a).fontSize) * TITLE_LINE_HEIGHT));
  let size = parseFloat(getComputedStyle(h).fontSize);
  while (lines() > 1 && size > TITLE_MIN) {
    size -= 0.5;
    h.style.fontSize = `${size}px`;
  }
  return size;
}

export function renderIntro({ ui }) {
  return `
  <div class="intro">
    <p class="intro__eyebrow">${eyebrow(ui.campaign_dates)}</p>
    <h1 class="intro__title"${ui.title_join ? ' data-join' : ''}${hasMarks(`${ui.title_a ?? ''}${ui.title_b ?? ''}${ui.campaign_title ?? ''}`) ? ' data-accent' : ''} aria-label="${esc(ui.campaign_title)}">${title(ui)}</h1>
    <p class="intro__sub">${escNb(ui.subtitle)}</p>
  </div>`;
}
