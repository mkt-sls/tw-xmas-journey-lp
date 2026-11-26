// Market choice: ?market= (QA) > saved choice > browser language > fallback.
import browserMap from '../data/browser-map.json';
import markets from '../data/markets.json';

// A market with "enabled": false in data/markets.json is off: not in the selector, not picked from the
// browser language, ?market= and a saved choice ignore it. Its data stays in the repo; src/i18n.js and
// vite.config.js keep its cards, texts and flag out of the build (owner 2026-11-26: RO_MDL off).
export const ALL_MARKETS = markets;
export const MARKETS = markets.filter((m) => m.enabled !== false);
const STORAGE_KEY = 'tw-cj-market';

export function getMarket(id) {
  return MARKETS.find((m) => m.id === id) ?? null;
}

/**
 * Pick a market from a list of browser languages (navigator.languages order).
 * Per language: exact tag first (en-AU), then primary language (de). A language with no market
 * (e.g. "fr"), or whose market is off, is skipped and the next preference is tried. Nothing found -> fallback.
 */
export function marketFromLanguages(languages, map = browserMap) {
  const exact = Object.fromEntries(Object.entries(map.exact).map(([k, v]) => [k.toLowerCase(), v]));
  for (const raw of languages ?? []) {
    const tag = String(raw).trim().replace(/_/g, '-').toLowerCase();
    if (!tag) continue;
    if (getMarket(exact[tag])) return exact[tag];
    const primary = tag.split('-')[0];
    if (getMarket(map.language[primary])) return map.language[primary];
  }
  return map.fallback;
}

function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Accepts "DE", "de", "en_gbp", "EN-GBP". Returns a market id or null. */
export function normaliseMarketId(value) {
  if (!value) return null;
  const id = String(value).trim().toUpperCase().replace(/-/g, '_');
  return getMarket(id) ? id : null;
}

export function resolveMarket({ search = '', languages = [], storage = safeStorage() } = {}) {
  const fromUrl = normaliseMarketId(new URLSearchParams(search).get('market'));
  if (fromUrl) return fromUrl;
  const saved = normaliseMarketId(storage?.getItem(STORAGE_KEY));
  if (saved) return saved;
  return marketFromLanguages(languages);
}

export function saveMarket(id, storage = safeStorage()) {
  try {
    storage?.setItem(STORAGE_KEY, id);
  } catch {
    /* private mode: choice lasts for this visit only */
  }
}

/** Short code shown in the header: UI language (EN, DE, FR...) */
export function marketCode(market) {
  return market.uiLang.split('_')[0];
}

const HTML_LANG = { EN_GBP: 'en-GB', EN_AUD: 'en-AU', EN_USD: 'en-US', EN_CAD: 'en-CA', FR_CA: 'fr-CA', RO_MDL: 'ro-MD', NO: 'nb', DA: 'da', SV: 'sv' };

/** Value for <html lang>. */
export function htmlLangFor(market) {
  return HTML_LANG[market.id] ?? market.id.toLowerCase();
}
