// Bonus card for a day. Wording comes from the raw localized lines in data/cards (exactly the sheet's text);
// the parsed fields only decide the layout (is there a game line?).
import { depositLinkFor, linkFor } from '../config.js';
import { dayDate, dayState } from '../date.js';
import { fill, longDate } from '../i18n.js';
import { CLOSE_SVG, asset, esc, escNb } from './util.js';

/** "Min. deposit: 35 GBP" -> ["Min. deposit", "35 GBP"]; also handles French "Dépôt min. : 35 CAD". */
function splitTerm(line) {
  const m = String(line).match(/^(.*?)\s*:\s+(.*)$/);
  return m ? [m[1], m[2]] : [line, ''];
}

/** "DAY 8 · 8 DEC" -> "DAY 8": the pill shows only the day, on every card state (owner 2026-11-26). Data stays as imported. */
function dayOnly(line) {
  return String(line).split(/\s+·\s+/)[0];
}

/** "Opens: 8 DEC" -> "Opens: 8 December" / "Verfügbar ab: 8. Dezember": long month, not in caps; day and month never split
 * across lines (no-break space). Owner 2026-11-26. Data stays as imported. */
function opensLong(line, day, uiLang) {
  const m = String(line).match(/^(.*?:)\s*/);
  if (!m || !uiLang) return line;
  return `${m[1]} ${longDate(dayDate(day), uiLang).replace(/\s/g, '\u00a0')}`;
}

/** Locked card line under the title. Tomorrow: the sheet's "Come back tomorrow to unlock this gift". Two or more days away:
 * ui.come_back_on ("Come back on 9 December to unlock this gift", our wording in DE/NL/RO), owner 2026-11-26. */
function comeBack(line, day, today, ui, uiLang) {
  if (day - today < 2 || !ui.come_back_on || !uiLang) return line;
  return fill(ui.come_back_on, { date: longDate(dayDate(day), uiLang).replace(/\s/g, '\u00a0') });
}

function art(kind, chip) {
  let body;
  if (kind === 'active') {
    body = `<img class="card__illu" src="${asset('card-illustration@2x.webp')}" alt="">`;
  } else {
    const img = kind === 'expired' ? 'card-gift-expired.svg' : 'card-gift-locked.svg';
    body = `<span class="card__hatch"></span><img class="card__silhouette" src="${asset(img)}" alt="">`;
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
 * @param ctx { card, day, today, ui, marketId, uiLang }
 * @returns {{ html: string, kind: 'active'|'expired'|'locked' }}
 */
export function renderCard({ card, day, today, ui, marketId, uiLang }) {
  const state = dayState(day, today);
  const kind = state === 'active' ? 'active' : state === 'missed' ? 'expired' : 'locked';
  const lines = card.raw[kind];
  const n = lines.length;
  const termsLink = `<a class="card__terms" href="${esc(linkFor('terms', marketId))}" target="_blank" rel="noopener" data-track="terms_click" data-day="${day}">${escNb(lines[n - 1])}</a>`;

  let body;
  if (kind === 'locked') {
    // [day, SURPRISE GIFT, Opens: N DEC, Come back..., Locked · N Dec, terms]. The title shows the long month (opensLong).
    // The disabled button shows only the word (ui.locked from data/ui): the date is already in the title (lines[2]),
    // so lines[4] ("Locked · N Dec") is not used here. data/cards stays as imported.
    body = `
      <p class="card__type">${escNb(lines[1])}</p>
      <div class="card__offer"><h2 class="card__opens" id="card-title">${escNb(opensLong(lines[2], day, uiLang))}</h2><p class="card__game">${escNb(comeBack(lines[3], day, today, ui, uiLang))}</p></div>
      <button type="button" class="btn-primary" disabled>${escNb(ui.locked)}</button>
      ${termsLink}`;
  } else {
    const hasGame = Boolean(card.game);
    // Term rows sit between the amount (+ game line) and the CTA line. Top Win cards have only "Min. deposit".
    // A row without a value is not drawn.
    const rows = lines.slice(hasGame ? 4 : 3, n - 2).map(splitTerm).filter(([k, v]) => k.trim() && v.trim());
    body = `
      <p class="card__type">${escNb(lines[1])}</p>
      <div class="card__offer">
        <h2 class="card__amount" id="card-title"><span class="card__amount-text">${escNb(lines[2])}</span></h2>
        ${hasGame ? `<p class="card__game">${escNb(lines[3])}</p>` : ''}
      </div>
      ${
        rows.length
          ? `<dl class="card__terms-list">
        ${rows.map(([k, v]) => `<div class="term"><dt>${escNb(k)}</dt><dd>${escNb(v)}</dd></div>`).join('')}
      </dl>`
          : ''
      }
      ${
        kind === 'active'
          ? `<a class="btn-primary" href="${esc(depositLinkFor(day, marketId))}" data-track="deposit_click" data-day="${day}">${escNb(lines[n - 2])}</a>`
          : `<button type="button" class="btn-primary" disabled>${escNb(lines[n - 2])}</button>`
      }
      ${termsLink}`;
  }

  const html = `
  <div class="card card--${kind}" role="dialog" aria-modal="true" aria-labelledby="card-title">
    ${art(kind, dayOnly(lines[0]))}
    <div class="card__body">${body}</div>
    ${kind === 'active' ? `<img class="card__cap" src="${asset('card-snow-cap.svg')}" alt=""><img class="card__holly" src="${asset('card-holly.svg')}" alt=""><i class="card__accent"></i>` : ''}
  </div>`;
  return { html, kind };
}
