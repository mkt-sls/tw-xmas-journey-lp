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
