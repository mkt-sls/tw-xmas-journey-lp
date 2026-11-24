import dayLinks from '../data/links.json';

// Campaign settings and every outgoing link in one place.
// Links come from data/links.json (client links sheet, tab "TW EUROPE"): one deposit link per day, same for every market.
// Per-market overrides go in linksByMarket (market id from data/markets.json, e.g. DE, EN_GBP).
export const CAMPAIGN = {
  year: 2026,
  month: 12, // December
  days: 26, // 1-26 December
};

export const links = {
  logo: 'https://top-win.global', // header logo: same URL on every market, opens in a new tab
  deposit: '#', // last-resort fallback only
  terms: 'https://top-win-uk.top/en/bonus-policy', // "Full terms & conditions" on the card: same URL on every market and day, opens in a new tab
  campaignTerms: 'https://top-win-uk.top/en/bonus-policy', // shown nowhere (no footer link), kept equal to terms
};

// Optional per-market overrides, e.g. { DE: { deposit: 'https://...', terms: 'https://...' } }
export const linksByMarket = {};

// Deposit link of one campaign day. A per-market override in linksByMarket wins, '#' is the last fallback.
export function depositLinkFor(day, marketId) {
  return linksByMarket[marketId]?.deposit ?? dayLinks.find((l) => l.day === day)?.deposit ?? links.deposit;
}

export function linkFor(name, marketId) {
  return linksByMarket[marketId]?.[name] ?? links[name] ?? '#';
}
