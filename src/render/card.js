// Bonus card for a day. Wording comes from the raw localized lines in data/cards (exactly the sheet's text);
// the parsed fields only decide the layout (is there a game line?).
import { depositLinkFor, linkFor } from '../config.js';
import { dayState } from '../date.js';
import { CLOSE_SVG, asset, esc, escNb } from './util.js';

const STARS = [
  [92, 67, 14], [324, 57, 11], [291, 137, 9], [125, 143, 8], [358, 105, 7], [50, 114, 6],
];

/** "Min. deposit: 35 GBP" -> ["Min. deposit", "35 GBP"]; also handles French "Dépôt min. : 35 CAD". */
function splitTerm(line) {
  const m = String(line).match(/^(.*?)\s*:\s+(.*)$/);
  return m ? [m[1], m[2]] : [line, ''];
}

function art(kind, chip) {
  const stars = STARS.map(([x, y, s]) => `<i class="star" style="left:${x}px;top:${y}px;width:${s}px;height:${s}px"></i>`).join('');
  let body;
  if (kind === 'active') {
    body = `<span class="card__rays"></span>${stars}<img class="card__illu" src="${asset('card-illustration@2x.webp')}" alt="">`;
  } else {
    const img = kind === 'expired' ? 'gift-expired@2x.webp' : 'gift-locked@2x.webp';
    body = `<img class="card__silhouette" src="${asset(img)}" alt="">`;
  }
  return `
  <div class="card__art">
    ${body}
    <span class="card__artfade card__artfade--top"></span><span class="card__artfade card__artfade--bottom"></span>
    <span class="card__chip">${escNb(chip)}</span>
    <button type="button" class="card__close" data-close aria-label="✕"><span>${CLOSE_SVG}</span></button>
  </div>`;
}

/**
 * @param ctx { card, day, today, ui, marketId }
 * @returns {{ html: string, kind: 'active'|'expired'|'locked' }}
 */
export function renderCard({ card, day, today, ui, marketId }) {
  const state = dayState(day, today);
  const kind = state === 'active' ? 'active' : state === 'missed' ? 'expired' : 'locked';
  const lines = card.raw[kind];
  const n = lines.length;
  const termsLink = `<a class="card__terms" href="${esc(linkFor('terms', marketId))}" data-track="terms_click" data-day="${day}">${escNb(lines[n - 1])}</a>`;

  let body;
  if (kind === 'locked') {
    // [day, SURPRISE GIFT, Opens N December, Come back..., Locked · N Dec, terms]
    body = `
      <p class="card__type">${escNb(lines[1])}</p>
      <div class="card__offer"><h2 class="card__opens" id="card-title">${escNb(lines[2])}</h2><p class="card__game">${escNb(lines[3])}</p></div>
      <button type="button" class="btn-primary" disabled>${escNb(lines[4])}</button>
      ${termsLink}`;
  } else {
    const hasGame = Boolean(card.game);
    const rows = lines.slice(n - 5, n - 2).map(splitTerm);
    body = `
      <p class="card__type">${escNb(lines[1])}</p>
      <div class="card__offer">
        <h2 class="card__amount" id="card-title"><span class="card__amount-text">${escNb(lines[2])}</span></h2>
        ${hasGame ? `<p class="card__game">${escNb(lines[3])}</p>` : ''}
      </div>
      <dl class="card__terms-list">
        ${rows.map(([k, v]) => `<div class="term"><dt>${escNb(k)}</dt><dd>${escNb(v)}</dd></div>`).join('')}
      </dl>
      ${
        kind === 'active'
          ? `<a class="btn-primary" href="${esc(depositLinkFor(day, marketId))}" data-track="deposit_click" data-day="${day}">${escNb(lines[n - 2])}</a>`
          : `<button type="button" class="btn-primary" disabled>${escNb(lines[n - 2])}</button>`
      }
      ${termsLink}`;
  }

  const html = `
  <div class="card card--${kind}" role="dialog" aria-modal="true" aria-labelledby="card-title">
    ${art(kind, lines[0])}
    <div class="card__body">${body}</div>
    ${kind === 'active' ? `<img class="card__cap" src="${asset('snow-cap.svg')}" alt=""><img class="card__holly" src="${asset('holly.svg')}" alt="">` : ''}
  </div>`;
  return { html, kind };
}
