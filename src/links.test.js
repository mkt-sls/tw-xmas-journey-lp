import { describe, expect, it } from 'vitest';
import links from '../data/links.json';
import { depositLinkFor } from './config.js';

describe('per-day deposit links', () => {
  it('has 26 days', () => {
    expect(links).toHaveLength(26);
    expect(links.map((l) => l.day)).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
  });
  it('each link ends with promocode=<that day promo code>, no whitespace', () => {
    for (const l of links) {
      expect(l.promo).toMatch(/^[A-Z0-9]+$/);
      expect(l.deposit.endsWith('promocode=' + l.promo), `day ${l.day}`).toBe(true);
      expect(l.deposit).not.toMatch(/\s/);
      expect(l.deposit.startsWith('https://tw-de.icu/casino?modal=deposit&promocode=')).toBe(true);
    }
  });
  it('promo codes are unique and depositLinkFor returns the day link for every market', () => {
    // step 2 replaces the TBD placeholders with unique day codes
    if (links.some((l) => l.promo !== 'TBD')) expect(new Set(links.map((l) => l.promo)).size).toBe(26);
    expect(depositLinkFor(1, 'DE')).toBe(links[0].deposit);
    expect(depositLinkFor(1, 'RO_MDL')).toBe(depositLinkFor(1, 'EN_GBP'));
    expect(depositLinkFor(1, 'DE').endsWith('promocode=TBD')).toBe(true);
  });
});
