// UI strings, card data loading and date formatting per UI language.
// Files of a market that is off ("enabled": false in data/markets.json) are excluded here, so they are
// not in the build. Glob patterns must be literals: keep this list in step with markets.json
// (src/market.test.js checks it). RO_MDL off since 2026-11-26; its UI language RO_MD has no other market.
const uiFiles = import.meta.glob(['../data/ui/*.json', '!../data/ui/RO_MD.json']);
const cardFiles = import.meta.glob(['../data/cards/*.json', '!../data/cards/RO_MDL.json']);
export const BUNDLED_FILES = [...Object.keys(uiFiles), ...Object.keys(cardFiles)];

// Locale used to format dates, per UI language (keys of data/ui/<lang>.json).
// EN uses en-US on purpose: the sheet's English tags read "DEC 7" for every English market.
const DATE_LOCALE = {
  EN: 'en-US', RU: 'ru-RU', FR_CA: 'fr-CA', DE: 'de-DE', BG: 'bg-BG', NL: 'nl-NL',
  RO_MD: 'ro-MD', PL: 'pl-PL', TR: 'tr-TR', NO: 'nb-NO', IT: 'it-IT', DA: 'da-DK', SV: 'sv-SE',
};
// Locale for the long "8 December" form (EN follows the sheet's "Opens 8 December").
const LONG_LOCALE = { ...DATE_LOCALE, EN: 'en-GB' };

export async function loadMarketData(market) {
  const [uiMod, cardMod] = await Promise.all([
    uiFiles[`../data/ui/${market.uiLang}.json`](),
    cardFiles[`../data/cards/${market.id}.json`](),
  ]);
  return { ui: uiMod.default, cards: cardMod.default };
}

/** Replace {date} / {time} style placeholders. */
export function fill(template, values = {}) {
  return String(template ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in values ? values[k] : m));
}

/** "DEC 7", "7. DEZ.", "7 ДЕК." : short date, uppercase, with the trailing dot the sheet uses. */
export function shortDate(date, uiLang) {
  const locale = DATE_LOCALE[uiLang] ?? 'en-US';
  let s = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(date);
  if (uiLang === 'BG') {
    // bg-BG short month is numeric ("7.12."); the sheet uses "7 ДЕК.", so abbreviate the long month name
    const month = new Intl.DateTimeFormat(locale, { month: 'long' }).format(date);
    s = `${date.getDate()} ${month.slice(0, 3)}`;
  }
  s = s.toLocaleUpperCase(locale);
  // PL: no dot, like tab PL ("1 gru").
  if (uiLang !== 'EN' && uiLang !== 'PL' && !s.endsWith('.')) s += '.';
  return s;
}

/** "8 December" / "8. Dezember" : long date for aria labels and prose. */
export function longDate(date, uiLang) {
  const locale = LONG_LOCALE[uiLang] ?? 'en-GB';
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(date);
}
