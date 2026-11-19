import { esc, escNb } from './util.js';

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

export function renderIntro({ ui }) {
  return `
  <div class="intro">
    <p class="intro__eyebrow">${eyebrow(ui.campaign_dates)}</p>
    <h1 class="intro__title"${ui.title_join ? ' data-join' : ''} aria-label="${esc(ui.campaign_title)}">${title(ui)}</h1>
    <p class="intro__sub">${escNb(ui.subtitle)}</p>
  </div>`;
}
