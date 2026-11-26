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
        expect(d.location.trim(), `${m.id} day ${d.day} location`).not.toBe('');
        // texts sheet 2026-11-26: "Wagering: x20" and "Valid until: 23:59, <day> Dec" right after the min deposit, in every active card
        expect(d.wagering).toMatch(/:\s*x20$/);
        expect(d.validUntil).toMatch(new RegExp(`:\\s*23:59,\\s*${d.day}\\b`));
        expect(d.raw.active.indexOf(d.wagering)).toBe(d.raw.active.indexOf(d.minDeposit.text) + 1);
        expect(d.raw.active.indexOf(d.validUntil)).toBe(d.raw.active.indexOf(d.minDeposit.text) + 2);
        expect(d.minDeposit.currency).toBe(m.currency);
        expect(d.minDeposit.value).toBeGreaterThan(0);
        const expectLines = d.type === 'fs' ? 9 : 8;
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

describe('sheet overrides', () => {
  it('day 12 is 78 free spins in every market (numbers follow the links sheet)', () => {
    for (const m of markets) {
      const d = cardFiles[`../data/cards/${m.id}.json`].days[11];
      expect(d.amount.freeSpins, m.id).toBe(78);
      for (const state of ['active', 'expired']) {
        expect(d.raw[state][2], `${m.id} ${state}`).toMatch(/^78 /);
        expect(d.raw[state].join('\n'), `${m.id} ${state}`).not.toMatch(/\b75\b/);
      }
    }
  });
  it('place names are filled in the cards and in the ui locations, and agree', () => {
    for (const m of markets) {
      const ui = uiFiles[`../data/ui/${m.uiLang}.json`];
      cardFiles[`../data/cards/${m.id}.json`].days.forEach((d) => {
        expect(ui.locations[String(d.day)], `${m.uiLang} day ${d.day}`).toBe(d.location);
      });
    }
    expect(cardFiles['../data/cards/EN_GBP.json'].days[0].location).toBe('Fairytale Village');
  });
  it('no "25 December" campaign range is left in any UI text', () => {
    for (const m of markets) {
      const ui = uiFiles[`../data/ui/${m.uiLang}.json`];
      for (const [k, v] of Object.entries(ui.strings)) {
        expect(v, `${m.uiLang}.${k}`).not.toMatch(/1\s*(–|-|bis|t\/m|și)\s*25|25\.?\s*(December|Dezember|december|decembrie|DECEMBER|DEZEMBER|DECEMBRIE)|25 (gifts|Geschenke|cadeaus|cadouri)/i);
      }
    }
    expect(uiFiles['../data/ui/EN.json'].strings.step1_body).toBe('A new location unlocks each day, 1–26 December.');
    expect(uiFiles['../data/ui/DE.json'].strings.step1_body).toBe('Vom 1. bis 26. Dezember wird jeden Tag ein neuer Ort freigeschaltet.');
    expect(uiFiles['../data/ui/NL.json'].strings.step1_body).toBe('Van 1 t/m 26 december wordt elke dag een nieuwe locatie ontgrendeld.');
    expect(uiFiles['../data/ui/RO_MD.json'].strings.step1_body).toBe('În fiecare zi, între 1 și 26 decembrie, se deblochează o nouă locație.');
  });
  it('day 21 RO minimum deposit is 300 MDL', () => {
    expect(cardFiles['../data/cards/RO_MDL.json'].days[20].minDeposit.value).toBe(300);
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
