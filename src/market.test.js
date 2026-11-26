import { describe, expect, it } from 'vitest';
import { BUNDLED_FILES } from './i18n.js';
import { ALL_MARKETS, MARKETS, normaliseMarketId, resolveMarket } from './market.js';

const off = ALL_MARKETS.filter((m) => m.enabled === false);
const memory = (value) => ({ getItem: () => value, setItem: () => {} });

describe('markets that are off', () => {
  it('RO_MDL is off (owner 2026-11-26)', () => {
    expect(off.map((m) => m.id)).toEqual(['RO_MDL']);
    expect(MARKETS.map((m) => m.id)).toEqual(['DE', 'NL', 'EN_GBP']);
  });

  it('are not reached by ?market=, a saved choice or the browser language', () => {
    for (const m of off) {
      expect(normaliseMarketId(m.id)).toBeNull();
      expect(resolveMarket({ search: `?market=${m.id}`, storage: memory(null) })).toBe('EN_GBP');
      expect(resolveMarket({ storage: memory(m.id) })).toBe('EN_GBP');
      expect(resolveMarket({ languages: ['ro-MD', 'ro'], storage: memory(null) })).toBe('EN_GBP');
    }
  });

  it('keep their cards and UI texts out of the build (the glob list in i18n.js)', () => {
    const onLangs = new Set(MARKETS.map((m) => m.uiLang));
    for (const m of off) {
      expect(BUNDLED_FILES).not.toContain(`../data/cards/${m.id}.json`);
      if (!onLangs.has(m.uiLang)) expect(BUNDLED_FILES).not.toContain(`../data/ui/${m.uiLang}.json`);
    }
    for (const m of MARKETS) {
      expect(BUNDLED_FILES).toContain(`../data/cards/${m.id}.json`);
      expect(BUNDLED_FILES).toContain(`../data/ui/${m.uiLang}.json`);
    }
  });
});
