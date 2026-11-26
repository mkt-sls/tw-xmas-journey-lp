import { describe, expect, it } from 'vitest';
import markets from '../data/markets.json';
import { renderCard } from './render/card.js';

const uiFiles = import.meta.glob('../data/ui/*.json', { eager: true, import: 'default' });
const cardFiles = import.meta.glob('../data/cards/*.json', { eager: true, import: 'default' });

const text = (html, re) => {
  const m = html.match(re);
  return m ? m[1].replace(/<[^>]*>/g, '').replace(/[  ]/g, ' ').trim() : null;
};

describe('locked card button', () => {
  for (const m of markets) {
    it(`${m.id}: button shows only ui.locked (no date), title keeps the date`, () => {
      const ui = uiFiles[`../data/ui/${m.uiLang}.json`].strings;
      const cards = cardFiles[`../data/cards/${m.id}.json`];
      for (const day of [2, 8, 16, 26]) {
        const card = cards.days[day - 1];
        const { html, kind } = renderCard({ card, day, today: 1, ui, marketId: m.id });
        expect(kind).toBe('locked');
        const btn = text(html, /<button type="button" class="btn-primary" disabled>([\s\S]*?)<\/button>/);
        expect(btn, `${m.id} day ${day} button`).toBe(ui.locked);
        expect(btn).not.toMatch(/\d/);
        const title = text(html, /id="card-title">([\s\S]*?)<\/h2>/);
        expect(title, `${m.id} day ${day} title`).toMatch(/\d/);
      }
    });
  }
});

// Owner 2026-11-26 (item A): the pill shows only the day on every card state; the locked title has the long month, not in caps,
// with day and month joined by a no-break space.
describe('card dates', () => {
  const LONG = { EN: 'Opens: 8 December', DE: 'Verfügbar ab: 8. Dezember', NL: 'Beschikbaar vanaf: 8 december', RO_MD: 'Disponibil din: 8 decembrie', PL: 'Otwiera się 8 grudnia' };
  const chip = (html) => html.match(/<span class="card__chip">([\s\S]*?)<\/span>/)[1];
  for (const m of markets) {
    it(`${m.id}: pill = day only (active, missed, locked), locked title = long month`, () => {
      const ui = uiFiles[`../data/ui/${m.uiLang}.json`].strings;
      const cards = cardFiles[`../data/cards/${m.id}.json`];
      for (const day of [1, 8, 26]) {
        const card = cards.days[day - 1];
        for (const today of [day - 1, day, day + 1]) {
          const { html } = renderCard({ card, day, today, ui, marketId: m.id, uiLang: m.uiLang });
          const c = chip(html);
          expect(c, `${m.id} day ${day} today ${today}`).toBe(card.raw.active[0].split(' · ')[0]);
          expect(c).not.toMatch(/·/);
        }
      }
      const { html } = renderCard({ card: cards.days[7], day: 8, today: 7, ui, marketId: m.id, uiLang: m.uiLang });
      const raw = html.match(/id="card-title">([\s\S]*?)<\/h2>/)[1];
      expect(raw.replace(/\u00a0/g, ' ')).toBe(LONG[m.uiLang]);
      // day and month stay together
      expect(raw).toMatch(/\d\.?\u00a0[A-Za-z]+$/);
    });
  }
});

// Owner 2026-11-26: the locked card says "Come back tomorrow" only for tomorrow's gift; further gifts name their day.
describe('locked card come-back line', () => {
  const FAR = { EN: 'Come back on 9 December to unlock this gift', DE: 'Komm am 9. Dezember wieder und schalte dieses Geschenk frei', NL: 'Kom op 9 december terug om dit cadeau te ontgrendelen', RO_MD: 'Revino pe 9 decembrie pentru a debloca acest cadou', PL: 'Wróć 9 grudnia, aby odblokować ten prezent' };
  const line = (html) => text(html, /<\/h2><p class="card__game">([\s\S]*?)<\/p>/);
  for (const m of markets) {
    it(`${m.id}: tomorrow keeps the sheet line, 2+ days away names the day`, () => {
      const ui = uiFiles[`../data/ui/${m.uiLang}.json`].strings;
      const cards = cardFiles[`../data/cards/${m.id}.json`];
      const r = (day, today) => renderCard({ card: cards.days[day - 1], day, today, ui, marketId: m.id, uiLang: m.uiLang }).html;
      expect(line(r(8, 7))).toBe(cards.days[7].raw.locked[3]);
      expect(line(r(9, 7))).toBe(FAR[m.uiLang]);
      expect(r(9, 7)).toMatch(/9\.?\u00a0/); // day and month never split (DE "9. Dezember")
    });
  }
});
