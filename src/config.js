import dayLinks from '../data/links.json';
import { campaignDay, parseNow } from './date.js';

// Campaign settings and every outgoing link in one place.
// Links come from data/links.json (client links sheet, tab "TW EUROPE"): one deposit link per day, same for every market.
// Per-market overrides go in linksByMarket (market id from data/markets.json, e.g. DE, EN_GBP).
export const CAMPAIGN = {
  year: 2026,
  month: 12, // December
  days: 26, // 1-26 December
};

// Link names that all point to the deposit link of the current campaign day:
// LOG IN and REGISTER. "Full terms & conditions" does NOT use it: it is the one bonus-policy URL below (owner 2026-11-24).
const TODAY_LINKS = ['login', 'register'];

export const links = {
  deposit: '#', // last-resort fallback only
  terms: 'https://top-win-uk.top/en/bonus-policy', // "Full terms & conditions" on the card: same URL on every market and day, opens in a new tab
  campaignTerms: 'https://top-win-uk.top/en/bonus-policy', // shown nowhere (no footer link), kept equal to terms
};

// Optional per-market overrides, e.g. { DE: { deposit: 'https://...', terms: 'https://...' } }
export const linksByMarket = {};

/** Campaign day used for today's link: before day 1 -> 1, after day 26 -> 26. Honours ?date= like the page does. */
export function linkDay(now = parseNow(typeof window === 'undefined' ? '' : window.location.search)) {
  return Math.min(Math.max(campaignDay(now), 1), CAMPAIGN.days);
}

// Deposit link of one campaign day. A per-market override in linksByMarket wins, '#' is the last fallback.
export function depositLinkFor(day, marketId) {
  return linksByMarket[marketId]?.deposit ?? dayLinks.find((l) => l.day === day)?.deposit ?? links.deposit;
}

export function linkFor(name, marketId, day = linkDay()) {
  if (linksByMarket[marketId]?.[name]) return linksByMarket[marketId][name];
  if (name === 'deposit' || TODAY_LINKS.includes(name)) return depositLinkFor(day, marketId);
  return links[name] ?? '#';
}
