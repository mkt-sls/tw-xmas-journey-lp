import { describe, expect, it } from 'vitest';
import markets from '../data/markets.json';

const cardFiles = import.meta.glob('../data/cards/*.json', { eager: true, import: 'default' });
const uiFiles = import.meta.glob('../data/ui/*.json', { eager: true, import: 'default' });

describe('card data', () => {
  for (const m of markets) {
    const cards = cardFiles[`../data/cards/${m.id}.json`];
    it(`${m.id}: 26 days, consistent lines, currency ${m.currency}`, () => {
      expect(cards.days).toHaveLength(26);
      cards.days.forEach((d, i) => {
        expect(d.day).toBe(i + 1);
        expect(d.date).toBe(`2026-12-${String(i + 1).padStart(2, '0')}`);
        expect(d.location).toBe('');
        expect(d.wagering).toBe('');
        expect(d.validUntil).toBe('');
        expect(d.minDeposit.currency).toBe(m.currency);
        expect(d.minDeposit.value).toBeGreaterThan(0);
        const expectLines = d.type === 'fs' ? 7 : 6;
        expect(d.raw.active).toHaveLength(expectLines);
        expect(d.raw.expired).toHaveLength(expectLines);
        expect(d.raw.locked).toHaveLength(6);
        expect(d.raw.active.some((l) => l.includes(d.minDeposit.text))).toBe(true);
        expect(Boolean(d.game)).toBe(d.type === 'fs');
        if (d.type === 'bonus') expect(d.amount.currency).toBe(m.currency);
      });
    });
  }
  it('all markets agree on type, percent / free spins per day', () => {
    const base = cardFiles['../data/cards/EN_GBP.json'].days;
    for (const m of markets) {
      cardFiles[`../data/cards/${m.id}.json`].days.forEach((d, i) => {
        expect(d.type).toBe(base[i].type);
        expect(d.amount.percent).toBe(base[i].amount.percent);
        expect(d.amount.freeSpins).toBe(base[i].amount.freeSpins);
        expect(d.game).toBe(base[i].game);
      });
    }
  });
});

describe('ui data', () => {
  for (const m of markets) {
    it(`${m.uiLang}: no empty strings except be_gamble_aware`, () => {
      const ui = uiFiles[`../data/ui/${m.uiLang}.json`];
      for (const [k, v] of Object.entries(ui.strings)) {
        if (k !== 'be_gamble_aware') expect(v, `${m.uiLang}.${k}`).not.toBe('');
      }
      expect(ui.strings.responsible).toContain('18+');
      expect(ui.strings.step1_body).toContain('26');
    });
  }
});
