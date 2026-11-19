import { esc, escNb } from './util.js';

// "1–26 DECEMBER · 26 GIFTS" -> date pill + gold "26 GIFTS" (Figma "Eyebrow v2"). Without a " · " the whole text is the pill.
function eyebrow(text) {
  const [dates, ...rest] = String(text ?? '').split(/\s+·\s+/);
  const gifts = rest.join(' · ');
  return `<span class="intro__dates">${escNb(dates)}</span>${gifts ? `<span class="intro__gifts">${escNb(gifts)}</span>` : ''}`;
}

// "Christmas Journey" -> "Christmas" in white, the last word in the orange gradient (Figma "Title v2"); one word stays white
function title(text) {
  const words = String(text ?? '').trim().split(/\s+/);
  if (words.length < 2) return `<span class="intro__title-a">${esc(text)}</span>`;
  const last = words.pop();
  return `<span class="intro__title-a">${esc(words.join(' '))}</span><span class="intro__title-b">${esc(last)}</span>`;
}

export function renderIntro({ ui }) {
  return `
  <div class="intro">
    <p class="intro__eyebrow">${eyebrow(ui.campaign_dates)}</p>
    <h1 class="intro__title" aria-label="${esc(ui.campaign_title)}">${title(ui.campaign_title)}</h1>
    <p class="intro__sub">${escNb(ui.subtitle)}</p>
  </div>`;
}
