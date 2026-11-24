import { describe, expect, it } from 'vitest';
import links from '../data/links.json';
import markets from '../data/markets.json';
import { CAMPAIGN, depositLinkFor, linkFor, links as cfgLinks } from './config.js';

describe('per-day deposit links', () => {
  it('has 26 days in order with December 2026 dates', () => {
    expect(links).toHaveLength(26);
    expect(links.map((l) => l.day)).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
    links.forEach((l) => expect(l.date).toBe(`2026-12-${String(l.day).padStart(2, '0')}`));
  });
  it('every link is on tw-de.icu and its promocode param equals the day promo code', () => {
    for (const l of links) {
      const u = new URL(l.deposit);
      expect(u.hostname, `day ${l.day}`).toBe('tw-de.icu');
      expect(u.pathname).toBe('/casino');
      expect(u.searchParams.get('modal')).toBe('deposit');
      expect(u.searchParams.get('promocode'), `day ${l.day}`).toBe(l.promo);
      expect(l.promo).toMatch(/^[A-Z0-9]+$/);
      expect(l.deposit).not.toMatch(/\s/);
    }
  });
  it('promo codes and links are unique, no placeholder left', () => {
    expect(new Set(links.map((l) => l.promo)).size).toBe(26);
    expect(new Set(links.map((l) => l.deposit)).size).toBe(26);
    expect(links.some((l) => l.promo === 'TBD')).toBe(false);
  });
  it('depositLinkFor returns the same day link for every market', () => {
    for (const l of links) for (const m of markets) expect(depositLinkFor(l.day, m.id)).toBe(l.deposit);
  });
});

describe('T&C link', () => {
  const TC = 'https://top-win-uk.top/en/bonus-policy';
  it('is the bonus-policy URL on every market and every day, not the day link', () => {
    for (const m of markets) for (let d = 1; d <= CAMPAIGN.days; d++) expect(linkFor('terms', m.id, d)).toBe(TC);
  });
  it('campaignTerms equals terms', () => {
    expect(cfgLinks.campaignTerms).toBe(TC);
  });
});
