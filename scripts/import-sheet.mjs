#!/usr/bin/env node
// Turns data/source/sheet.json into the JSON the page uses:
//   data/ui/<lang>.json       UI strings + 26 location names per language
//   data/cards/<MARKET>.json  26 daily cards per market (FR_CA is our own translation of EN_CAD)
//   data/markets.json         list of markets
//   data/browser-map.json     browser language -> market rules
//   data/ISSUES.md            plain-English list of fixes and open questions for the client
// Re-run it whenever the sheet changes: node scripts/extract-sheet.mjs <dump> && node scripts/import-sheet.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data');
const sheet = JSON.parse(fs.readFileSync(path.join(dataDir, 'source', 'sheet.json'), 'utf8')).tabs;

const DAYS = 26;
const NBSP = ' ';
const PLACEHOLDER_ENDED = 'The Christmas Journey has ended. Thank you for travelling with us!';
const UI_LANGS = ['EN', 'RU', 'FR_CA', 'DE', 'BG', 'NL', 'RO_MD', 'TR', 'NO', 'IT', 'DA', 'SV'];

// ---- market table ------------------------------------------------------------
// flag = lowercase ISO country code (also used for the flag image name); flagEmoji for text-only use.
const MARKETS = [
  { id: 'DE', uiLang: 'DE', currency: 'EUR', flag: 'de', flagEmoji: '🇩🇪', label: 'Deutsch' },
  { id: 'BG', uiLang: 'BG', currency: 'EUR', flag: 'bg', flagEmoji: '🇧🇬', label: 'Български' },
  { id: 'NL', uiLang: 'NL', currency: 'EUR', flag: 'nl', flagEmoji: '🇳🇱', label: 'Nederlands' },
  { id: 'IT', uiLang: 'IT', currency: 'EUR', flag: 'it', flagEmoji: '🇮🇹', label: 'Italiano' },
  { id: 'RU', uiLang: 'RU', currency: 'EUR', flag: 'ru', flagEmoji: '🇷🇺', label: 'Русский' },
  { id: 'TR', uiLang: 'TR', currency: 'TRY', flag: 'tr', flagEmoji: '🇹🇷', label: 'Türkçe' },
  { id: 'DA', uiLang: 'DA', currency: 'DKK', flag: 'dk', flagEmoji: '🇩🇰', label: 'Dansk' },
  { id: 'SV', uiLang: 'SV', currency: 'SEK', flag: 'se', flagEmoji: '🇸🇪', label: 'Svenska' },
  { id: 'NO', uiLang: 'NO', currency: 'NOK', flag: 'no', flagEmoji: '🇳🇴', label: 'Norsk' },
  { id: 'EN_AUD', uiLang: 'EN', currency: 'AUD', flag: 'au', flagEmoji: '🇦🇺', label: 'English (Australia)' },
  { id: 'EN_GBP', uiLang: 'EN', currency: 'GBP', flag: 'gb', flagEmoji: '🇬🇧', label: 'English (UK)' },
  { id: 'EN_USD', uiLang: 'EN', currency: 'USD', flag: 'us', flagEmoji: '🇺🇸', label: 'English (US)' },
  { id: 'EN_CAD', uiLang: 'EN', currency: 'CAD', flag: 'ca', flagEmoji: '🇨🇦', label: 'English (Canada)' },
  { id: 'FR_CA', uiLang: 'FR_CA', currency: 'CAD', flag: 'ca', flagEmoji: '🇨🇦', label: 'Français (Canada)' },
  { id: 'RO_MDL', uiLang: 'RO_MD', currency: 'MDL', flag: 'md', flagEmoji: '🇲🇩', label: 'Română (Moldova)' },
].map((m) => ({ ...m, cardsFile: `data/cards/${m.id}.json` }));

const BROWSER_MAP = {
  note: 'Match the full tag first (case-insensitive, e.g. "en-AU"), then the primary language ("de"), then fallback.',
  exact: { 'en-AU': 'EN_AUD', 'en-CA': 'EN_CAD', 'en-US': 'EN_USD', 'fr-CA': 'FR_CA' },
  language: {
    en: 'EN_GBP', de: 'DE', bg: 'BG', nl: 'NL', it: 'IT', ru: 'RU', tr: 'TR',
    da: 'DA', sv: 'SV', nb: 'NO', no: 'NO', nn: 'NO', ro: 'RO_MDL',
  },
  fallback: 'EN_GBP',
};

// ---- logs --------------------------------------------------------------------
const fixes = []; // applied fixes
const issues = []; // { title, lines[] } numbered open points for the client
const notes = []; // informational, not counted
const unparsed = []; // cells that did not parse
const log = (msg) => console.log('[fix] ' + msg);

function addFix(msg) {
  fixes.push(msg);
  log(msg);
}

// ---- UI strings --------------------------------------------------------------
function buildUi() {
  const ui = sheet['UI ELEMENT'];
  const mainCols = ui.main.columns; // GROUP, KEY / DAY, EN SOURCE, EN, RU, ...
  const langIdx = {};
  UI_LANGS.forEach((l) => {
    const i = mainCols.indexOf(l);
    if (i < 0) throw new Error('UI column missing: ' + l);
    langIdx[l] = i;
  });
  const out = {};
  for (const l of UI_LANGS) out[l] = { lang: l, strings: {}, extras: {}, locations: {} };

  const seenKeys = new Map();
  for (const row of ui.main.rows) {
    const [group, key] = row;
    if (group === 'UI') {
      if (seenKeys.has(key)) issueDupKey(key);
      seenKeys.set(key, true);
      for (const l of UI_LANGS) out[l].strings[key] = row[langIdx[l]];
    } else if (group === 'LOCATION') {
      for (const l of UI_LANGS) out[l].locations[key] = row[langIdx[l]];
    } else {
      unparsed.push(`UI ELEMENT row with unknown group "${group}"`);
    }
    if (row[2] !== row[3]) {
      unparsed.push(`UI key "${key}": "EN SOURCE" column differs from "EN" column ("${row[2]}" vs "${row[3]}")`);
    }
  }

  // Extra blocks below the main table.
  const ctaCols = ui.cta.columns; // UI element, EN SOURCE, EN, RU, FR_CA, ...
  const ctaKeys = { 'CTA 1': 'cta_primary', 'CTA 2': 'cta_processing', 'CTA 3': 'cta_terms' };
  for (const row of ui.cta.rows) {
    const k = Object.keys(ctaKeys).find((p) => row[0].startsWith(p));
    if (!k) {
      unparsed.push(`UI extra row not recognised: ${row[0]}`);
      continue;
    }
    for (const l of UI_LANGS) out[l].extras[ctaKeys[k]] = row[ctaCols.indexOf(l)];
  }
  // Second block: columns are EN SOURCE, EN, RU, FR_CA, DE, BG, NL, RO_MD, TR, NO, IT, DA, SV.
  const extraLangs = ['EN', 'RU', 'FR_CA', 'DE', 'BG', 'NL', 'RO_MD', 'TR', 'NO', 'IT', 'DA', 'SV'];
  const extraKeys = {
    'Day 7': 'day_7',
    'of 26': 'of_26',
    '4 gifts collected': 'gifts_collected_4',
    'Next gift in': 'next_gift_in',
  };
  let timerRowSeen = false;
  for (const row of ui.extra.rows) {
    if (row.length === 1) {
      if (row[0] === 'Timer') timerRowSeen = true;
      continue;
    }
    const key = extraKeys[row[0]];
    if (!key) {
      unparsed.push(`UI extra row not recognised: ${row[0]}`);
      continue;
    }
    extraLangs.forEach((l, i) => {
      out[l].extras[key] = row[1 + i];
    });
  }
  return { out, timerRowSeen };
}

const dupKeyHits = [];
function issueDupKey(key) {
  dupKeyHits.push(key);
}

// ---- number / line parsing ---------------------------------------------------
// Numbers with thousand separators: "1,000" "1 000" "20.000" "2 600"
const NUM_RE = /\d{1,3}(?:[   .,]\d{3})+(?!\d)|\d+/g;
const toInt = (s) => parseInt(s.replace(/[   .,]/g, ''), 10);
const numbersIn = (s) => (s.match(NUM_RE) || []).map(toInt);
const CURRENCY_TOKENS = ['EUR', '€', 'GBP', 'USD', 'CAD', 'AUD', 'TRY', 'DKK', 'SEK', 'NOK', 'MDL', '£', '$', '₺'];

function currencyIn(s) {
  const found = CURRENCY_TOKENS.filter((t) => s.includes(t));
  if (found.length === 0) return null;
  const norm = { '€': 'EUR', '£': 'GBP', '$': 'USD', '₺': 'TRY' };
  return found.map((t) => norm[t] || t);
}

function dayNumbersIn(line) {
  // remove clock times first so "23:59" / "23 h 59" are not read as days
  const noTime = line.replace(/\b\d{1,2}\s*[:h]\s*\d{2}\b/g, ' ');
  return (noTime.match(/\d{1,2}/g) || []).map(Number);
}

/** Parses one non-locked card (lines[]) into fields. Returns { fields, problems[] }. */
function parseOpenCard(lines, market, day) {
  const problems = [];
  const n = lines.length;
  if (n !== 8 && n !== 9) {
    return { fields: null, problems: [`unexpected number of lines (${n})`] };
  }
  const isFs = n === 9;
  const header = lines[0];
  const typeLine = lines[1];
  const amountLine = lines[2];
  const gameLine = isFs ? lines[3] : null;
  const [minLine, wagLine, validLine, ctaLine] = lines.slice(isFs ? 4 : 3, isFs ? 8 : 7);

  const hd = dayNumbersIn(header);
  if (!hd.includes(day)) problems.push(`header "${header}" does not contain day ${day}`);

  const fields = { type: isFs ? 'freespins' : 'bonus', typeLabel: typeLine };

  const nums = numbersIn(amountLine);
  if (isFs) {
    if (nums.length < 1) problems.push(`no spin count in "${amountLine}"`);
    fields.amount = { spins: nums[0] ?? null, text: amountLine };
  } else {
    const pm = amountLine.match(/(\d+)\s*%|%\s*(\d+)/);
    const percent = pm ? parseInt(pm[1] ?? pm[2], 10) : null;
    const rest = amountLine.replace(/(\d+)\s*%|%\s*(\d+)/, ' ');
    const maxNums = numbersIn(rest);
    if (percent === null || maxNums.length < 1) problems.push(`cannot read percent/max in "${amountLine}"`);
    fields.amount = { percent, max: maxNums[0] ?? null, currency: market.currency, text: amountLine };
    const cur = currencyIn(amountLine);
    if (cur && !cur.includes(market.currency)) problems.push(`currency ${cur.join('/')} in "${amountLine}" (market is ${market.currency})`);
  }

  if (isFs) {
    const stripped = gameLine.replace(/^\S+\s+/, '');
    fields.game = stripped;
    fields.gameLine = gameLine;
  } else {
    fields.game = null;
  }

  const minAfter = minLine.includes(':') ? minLine.slice(minLine.indexOf(':') + 1) : minLine;
  const minNums = numbersIn(minAfter);
  if (minNums.length < 1) problems.push(`no min deposit in "${minLine}"`);
  fields.minDeposit = { value: minNums[0] ?? null, currency: market.currency, text: minLine };
  const curMin = currencyIn(minAfter);
  if (curMin && !curMin.includes(market.currency)) problems.push(`currency ${curMin.join('/')} in "${minLine}" (market is ${market.currency})`);

  const wm = wagLine.match(/x\s*(\d+)/i);
  if (!wm) problems.push(`no wagering multiplier in "${wagLine}"`);
  fields.wagering = { multiplier: wm ? parseInt(wm[1], 10) : null, text: wagLine };

  const tm = validLine.match(/(\d{1,2})\s*[:h]\s*(\d{2})/);
  if (!tm) problems.push(`no valid-until time in "${validLine}"`);
  const vd = dayNumbersIn(validLine);
  if (!vd.includes(day)) problems.push(`valid-until "${validLine}" does not mention day ${day}`);
  fields.validUntil = { time: tm ? `${tm[1].padStart(2, '0')}:${tm[2]}` : null, text: validLine };

  fields.stateLine = ctaLine;
  return { fields, problems };
}

function parseLockedCard(lines, day) {
  const problems = [];
  if (lines.length !== 6) return { problems: [`locked card has ${lines.length} lines, expected 6`] };
  const hd = dayNumbersIn(lines[0]);
  if (!hd.includes(day)) problems.push(`locked header "${lines[0]}" does not contain day ${day}`);
  const od = dayNumbersIn(lines[2]);
  const ld = dayNumbersIn(lines[4]);
  if (!od.includes(day)) problems.push(`locked line "${lines[2]}" does not mention day ${day}`);
  if (!ld.includes(day)) problems.push(`locked line "${lines[4]}" does not mention day ${day}`);
  return { problems };
}

// ---- build card files --------------------------------------------------------
const cardIssues = []; // strings
const STATES = [['active', 0], ['expired', 2], ['locked', 3]]; // columns in sheet.json rows (1 = credited, unused)

function buildMarketCards(market, uiByLang) {
  const tab = sheet[market.id];
  if (!tab) throw new Error('Missing tab for market ' + market.id);
  if (tab.rows.length !== DAYS) throw new Error(`${market.id}: ${tab.rows.length} rows, expected ${DAYS}`);
  const days = [];
  for (let d = 1; d <= DAYS; d++) {
    const row = tab.rows[d - 1];
    const raw = {
      active: row[0].split('\n'),
      expired: row[2].split('\n'),
      locked: row[3].split('\n'),
    };
    days.push({ day: d, raw });
  }
  return days;
}

/** Applies explicit known fixes to raw lines before parsing. */
function applyCardFixes(market, days) {
  if (market.id === 'RO_MDL') {
    const day4 = days[3];
    let count = 0;

    for (const state of ['active', 'expired', 'locked']) {
      day4.raw[state] = day4.raw[state].map((l) => {
        if (/\bGBP\b/.test(l)) {
          count++;
          return l.replace(/\bGBP\b/g, 'MDL');
        }
        return l;
      });
    }
    // The "Bonus credited" column is not imported at all.
    if (count === 0) {
      notes.push('Expected "22 GBP" on RO_MDL day 4 was not found any more (maybe already fixed in the sheet).');
    } else {
      addFix(`RO_MDL day 4: "GBP" replaced by "MDL" in ${count} line(s) (min deposit is now "22 MDL" in the active and expired cards; the locked card has no amount).`);
    }
  }
}

function finishMarket(market, days, ui) {
  const gbpDays = market.id === 'EN_GBP' ? null : gbpReference;
  const out = [];
  for (const entry of days) {
    const { day, raw } = entry;
    const parsedActive = parseOpenCard(raw.active, market, day);
    const parsedExpired = parseOpenCard(raw.expired, market, day);
    const parsedLocked = parseLockedCard(raw.locked, day);
    for (const [label, p] of [['active', parsedActive], ['expired', parsedExpired], ['locked', parsedLocked]]) {
      for (const msg of p.problems) unparsed.push(`${market.id} day ${day} (${label} card): ${msg}`);
    }
    const f = parsedActive.fields;
    if (!f) continue;
    // the expired card must show the same offer as the active card
    const fe = parsedExpired.fields;
    if (fe) {
      const same =
        JSON.stringify([fe.type, fe.amount, fe.game, fe.minDeposit, fe.wagering]) ===
        JSON.stringify([f.type, f.amount, f.game, f.minDeposit, f.wagering]);
      if (!same) unparsed.push(`${market.id} day ${day}: the "Gift expired" card shows a different offer than the "Deposit & Claim" card`);
    }
    // compare with the GBP tab for structure that must be identical in every market
    if (gbpDays) {
      const g = gbpDays[day - 1];
      const diffs = [];
      if (g.type !== f.type) diffs.push(`offer type (${f.type} vs ${g.type})`);
      if (g.type === f.type) {
        if (f.type === 'bonus' && g.amount.percent !== f.amount.percent) diffs.push(`percent (${f.amount.percent}% vs ${g.amount.percent}%)`);
        if (f.type === 'freespins' && g.amount.spins !== f.amount.spins) diffs.push(`spin count (${f.amount.spins} vs ${g.amount.spins})`);
        if (f.type === 'freespins' && g.game && f.game && g.game.toLowerCase() !== f.game.toLowerCase()) diffs.push(`game ("${f.game}" vs "${g.game}")`);
      }
      if (g.wagering.multiplier !== f.wagering.multiplier) diffs.push(`wagering (x${f.wagering.multiplier} vs x${g.wagering.multiplier})`);
      if (diffs.length) crossDiffs.push(`${market.id} day ${day}: differs from the EN_GBP tab in ${diffs.join(', ')}`);
    }
    out.push({
      day,
      date: `2026-12-${String(day).padStart(2, '0')}`,
      location: ui.locations[String(day)] ?? null,
      type: f.type,
      amount: f.amount,
      game: f.game,
      minDeposit: f.minDeposit,
      wagering: f.wagering,
      validUntil: f.validUntil,
      raw,
    });
  }
  return out;
}

const crossDiffs = [];
let gbpReference = null;

// ---- FR_CA cards: our translation of EN_CAD ----------------------------------
function frDayLabel(n) {
  return n === 1 ? '1er' : String(n);
}
function frNumber(n) {
  return n >= 1000 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP) : String(n);
}

function buildFrCa(enCadDays, uiFr) {
  const s = uiFr.strings;
  const x = uiFr.extras;
  const opensTemplate = s.opens_dec8; // "S’ouvre le 8 décembre"
  const days = [];
  for (const d of enCadDays) {
    const dl = frDayLabel(d.day);
    const header = `JOUR ${d.day} · ${dl.toUpperCase()} DÉCEMBRE`;
    const typeLine = d.type === 'bonus' ? 'BONUS DE NOËL' : 'TOURS GRATUITS DE NOËL';
    const amountLine =
      d.type === 'bonus'
        ? `${d.amount.percent} % JUSQU’À ${frNumber(d.amount.max)} CAD`
        : `${d.amount.spins} TOURS GRATUITS`;
    const gameLine = d.type === 'freespins' ? `sur ${d.game}` : null;
    const minLine = `Dépôt min. : ${frNumber(d.minDeposit.value)} CAD`;
    const wagLine = `Exigence de mise : x${d.wagering.multiplier}`;
    const validLine = `Valable jusqu’au ${dl} déc., ${d.validUntil.time.replace(':', ' h ')}`;
    const common = [header, typeLine, amountLine, ...(gameLine ? [gameLine] : []), minLine, wagLine, validLine];
    const terms = s.full_terms;
    const active = [...common, x.cta_primary, terms];
    const expired = [...common, s.gift_expired, terms];
    const lockedHeader = header;
    const opens = opensTemplate.replace(/8 décembre/, `${dl} décembre`);
    const locked = [lockedHeader, s.surprise_gift, opens, s.come_back_tomorrow, `${s.locked} · ${dl} déc.`, terms];
    days.push({ day: d.day, raw: { active, expired, locked } });
  }
  return days;
}

// ---- main --------------------------------------------------------------------
const { out: uiAll, timerRowSeen } = buildUi();

// Known fix 2 + 3 on UI strings
{
  const de = uiAll.DE.strings;
  if (de.step1_body && de.step1_body.includes('1. bis 25.')) {
    de.step1_body = de.step1_body.replace('1. bis 25.', '1. bis 26.');
    addFix('DE step1_body: "1. bis 25." changed to "1. bis 26." (the campaign has 26 days).');
  } else {
    notes.push('Expected "1. bis 25." in DE step1_body was not found any more (maybe already fixed in the sheet).');
  }
  let n = 0;
  const langsFixed = [];
  for (const l of UI_LANGS) {
    const v = uiAll[l].strings.day_of;
    if (typeof v === 'string' && /\b25\b/.test(v)) {
      uiAll[l].strings.day_of = v.replace(/\b25\b/, '26');
      n++;
      langsFixed.push(l);
    }
  }
  if (n) addFix(`"Day 7 of 25" type text (key day_of): 25 changed to 26 in ${n} language(s): ${langsFixed.join(', ')}.`);
  else notes.push('No "of 25" found in key day_of any more.');

  // Report other places where a lone 25 appears in UI text (not changed)
  const other25 = [];
  for (const l of UI_LANGS) {
    for (const [k, v] of Object.entries(uiAll[l].strings)) {
      if (/\b25\b/.test(v)) other25.push(`${l}.${k}: "${v}"`);
    }
  }
  if (other25.length) notes.push('Other UI strings still containing "25" (checked, not changed): ' + other25.join('; '));
}

// Step 3 body: explicit owner override (task 4). The sheet text describes a green "credited" gift that
// does not exist on the page. These 12 strings are agency-made; the client must verify them.
const STEP3_BODY = {
  EN: 'Deposit before 23:59 to claim the day’s bonus.',
  RU: 'Пополни счёт до 23:59, чтобы забрать бонус дня.',
  FR_CA: 'Dépose avant 23 h 59 pour réclamer le bonus du jour.',
  DE: 'Zahle bis 23:59 Uhr ein, um den Tagesbonus zu sichern.',
  BG: 'Депозирай до 23:59 ч., за да вземеш бонуса за деня.',
  NL: 'Stort vóór 23:59 uur om de bonus van de dag te claimen.',
  RO_MD: 'Depune până la 23:59 pentru a revendica bonusul zilei.',
  TR: 'Günün bonusunu almak için 23:59’a kadar yatırım yap.',
  NO: 'Sett inn før kl. 23:59 for å hente dagens bonus.',
  IT: 'Deposita entro le 23:59 per riscuotere il bonus del giorno.',
  DA: 'Indbetal inden kl. 23:59 for at hente dagens bonus.',
  SV: 'Sätt in före kl. 23:59 för att hämta dagens bonus.',
};
for (const l of UI_LANGS) {
  if (!STEP3_BODY[l]) throw new Error('STEP3_BODY missing for ' + l);
  uiAll[l].strings.step3_body = STEP3_BODY[l];
}
log('OVERRIDE step3_body replaced in ' + UI_LANGS.length + ' languages (owner decision, agency translations).');

// campaign_ended placeholder
for (const l of UI_LANGS) uiAll[l].strings.campaign_ended = PLACEHOLDER_ENDED;

// Cards: parse EN_GBP first (reference), then everything else
const rawByMarket = {};
for (const m of MARKETS) {
  if (m.id === 'FR_CA') continue;
  const days = buildMarketCards(m, uiAll);
  applyCardFixes(m, days);
  rawByMarket[m.id] = days;
}

// Pre-parse GBP as the structural reference
{
  const gbp = MARKETS.find((m) => m.id === 'EN_GBP');
  gbpReference = rawByMarket.EN_GBP.map((e) => ({
    ...parseOpenCard(e.raw.active, gbp, e.day).fields,
    day: e.day,
  }));
}

const cardsOut = {};
for (const m of MARKETS) {
  if (m.id === 'FR_CA') continue;
  const uiLang = uiAll[m.uiLang];
  cardsOut[m.id] = finishMarket(m, rawByMarket[m.id], uiLang);
}

// FR_CA from EN_CAD
{
  const m = MARKETS.find((x) => x.id === 'FR_CA');
  const frRaw = buildFrCa(cardsOut.EN_CAD, uiAll.FR_CA);
  cardsOut.FR_CA = finishMarket(m, frRaw, uiAll.FR_CA);
}

// Game spelling: collect variants per day
const gameVariants = new Map(); // day -> Map(spelling -> [markets])
for (const m of MARKETS) {
  for (const d of cardsOut[m.id]) {
    if (!d.game) continue;
    if (!gameVariants.has(d.day)) gameVariants.set(d.day, new Map());
    const mm = gameVariants.get(d.day);
    if (!mm.has(d.game)) mm.set(d.game, []);
    mm.get(d.game).push(m.id);
  }
}

// ---- turn sample dates / time in UI strings into templates --------------------
// The sheet hardcodes the Dec-7 sample ("TODAY’S STOP · DEC 7", "Opens 8 December", "Unlocks in 14:32:08").
// The page needs {date} / {time} placeholders. Every language is checked; a sample that cannot be found is
// kept as raw text and listed in ISSUES.md.
{
  const unresolved = [];
  const tagKeys = ['yesterday', 'todays_stop', 'tomorrow', 'in_two_days', 'missed'];
  for (const l of UI_LANGS) {
    const s = uiAll[l].strings;
    for (const k of tagKeys) {
      const v = s[k];
      // every sample is "<WORD> · <date>"; the date is whatever follows the last " · "
      const i = typeof v === 'string' ? v.lastIndexOf(' · ') : -1;
      if (i > 0 && /\d/.test(v.slice(i + 3))) s[k] = v.slice(0, i) + ' · {date}';
      else unresolved.push(`${l}.${k}: "${v}"`);
    }
    // countdown sample 14:32:08 (in "Unlocks in 14:32:08" and in the bare gift_timer)
    if (typeof s.unlocks_in === 'string' && s.unlocks_in.includes('14:32:08')) s.unlocks_in = s.unlocks_in.replace('14:32:08', '{time}');
    else unresolved.push(`${l}.unlocks_in: "${s.unlocks_in}"`);
    if (s.gift_timer === '14:32:08') s.gift_timer = '{time}';
    // "Opens 8 December": day 8 + month word (a Turkish suffix after the month, e.g. "8 Aralık’ta", stays outside {date})
    if (typeof s.opens_dec8 === 'string' && /\b8\.?\s+[^\s’]+/.test(s.opens_dec8)) s.opens_dec8 = s.opens_dec8.replace(/\b8\.?\s+[^\s’]+/, '{date}');
    else unresolved.push(`${l}.opens_dec8: "${s.opens_dec8}"`);
  }
  if (unresolved.length) notes.push('Sample dates/time not turned into templates (kept as sheet text): ' + unresolved.join('; '));
  notes.push('IT opens_dec8 template is "Si apre l’{date}": Italian writes "l’8 / l’11" but "il 12", so the elided article is only right for some days. The page does not use this key for the locked card (it shows the sheet’s own card line).');
}

// ---- write JSON --------------------------------------------------------------
function writeJson(rel, obj) {
  const f = path.join(root, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

for (const l of UI_LANGS) writeJson(`data/ui/${l}.json`, uiAll[l]);
for (const m of MARKETS) {
  const body = {
    market: m.id,
    uiLang: m.uiLang,
    currency: m.currency,
    days: cardsOut[m.id],
  };
  if (m.id === 'FR_CA') {
    body.translatedBy = 'agency, client to verify';
    body.sourceMarket = 'EN_CAD';
  }
  writeJson(`data/cards/${m.id}.json`, body);
}
writeJson('data/markets.json', MARKETS);
writeJson('data/browser-map.json', BROWSER_MAP);

// ---- ISSUES.md ---------------------------------------------------------------
// 1. RO_MDL suspicious amounts
const gbpNums = cardsOut.EN_GBP;
const roLines = [];
for (const d of cardsOut.RO_MDL) {
  const g = gbpNums[d.day - 1];
  const reasons = [];
  if (d.type === 'bonus') {
    if (d.minDeposit.value >= d.amount.max) reasons.push(`the minimum deposit (${d.minDeposit.value} MDL) is equal to or higher than the maximum bonus (${d.amount.max} MDL)`);
    if (d.amount.max === g.amount.max && d.minDeposit.value === g.minDeposit.value) reasons.push(`both numbers are identical to the GBP tab (max ${g.amount.max}, min ${g.minDeposit.value})`);
    else if (d.amount.max === g.amount.max) reasons.push(`the maximum bonus is identical to the GBP tab (${g.amount.max})`);
    else if (d.minDeposit.value === g.minDeposit.value) reasons.push(`the minimum deposit is identical to the GBP tab (${g.minDeposit.value})`);
  } else if (d.minDeposit.value === g.minDeposit.value) {
    reasons.push(`the minimum deposit is identical to the GBP tab (${g.minDeposit.value})`);
  }
  if (reasons.length) {
    const what = d.type === 'bonus' ? `${d.amount.percent}% up to ${d.amount.max} MDL, min deposit ${d.minDeposit.value} MDL` : `${d.amount.spins} free spins, min deposit ${d.minDeposit.value} MDL`;
    roLines.push(`Day ${d.day} (${what}): ${reasons.join('; ')}.`);
  }
}

let n = 0;
const sections = [];
function section(title, intro, items) {
  if (!items || items.length === 0) return;
  n += items.length;
  sections.push({ title, intro, items });
}

// RO_MDL amounts: resolved. The client corrected the MDL column in the links sheet; scripts/import-links.mjs applies it (runs at the end of this script).

// Game spelling
const spellItems = [];
for (const [day, mm] of gameVariants) {
  const lowerSet = new Set([...mm.keys()].map((k) => k.toLowerCase()));
  if (mm.size > 1 && lowerSet.size === 1) {
    const parts = [...mm.entries()].map(([sp, ms]) => `"${sp}" in ${ms.join(', ')}`);
    spellItems.push(`Day ${day}: the same game is spelled in two ways - ${parts.join(' and ')}. Please tell us the correct spelling (it is shown as written in each market for now).`);
  } else if (mm.size > 1) {
    const parts = [...mm.entries()].map(([sp, ms]) => `"${sp}" in ${ms.join(', ')}`);
    spellItems.push(`Day ${day}: different game names across markets - ${parts.join(' and ')}.`);
  }
}
section('Game name spelling differs between markets ("Sweet Bonanza XMas" vs "Xmas")', '', spellItems);

// Duplicate keys with different translations
const dupItems = [];
{
  const pairs = [
    ['processing', 'cta_processing', 'Processing...'],
    ['terms_conditions', 'cta_terms', 'Terms & Conditions'],
    ['step3_title', 'cta_primary', 'Deposit & Claim'],
    ['gifts_collected', 'gifts_collected_4', '4 gifts collected'],
    ['next_gift', 'next_gift_in', 'Next gift in'],
  ];
  for (const [a, b, label] of pairs) {
    const diffs = [];
    for (const l of UI_LANGS) {
      const va = uiAll[l].strings[a];
      const vb = uiAll[l].extras[b];
      if (va === undefined || vb === undefined) continue;
      if (va.trim().toLowerCase() !== vb.trim().toLowerCase()) diffs.push(`${l}: "${va}" vs "${vb}"`);
    }
    if (diffs.length) dupItems.push(`"${label}" appears twice in the UI ELEMENT tab with different translations (${diffs.length} language${diffs.length > 1 ? 's' : ''}): ${diffs.join('; ')}. The page uses the main table value ("${a}") unless told otherwise.`);
  }
}
for (const k of new Set(dupKeyHits)) dupItems.push(`The key "${k}" appears more than once in the main UI table; the last row wins.`);
section('Same text translated differently in two places of the UI ELEMENT tab', '', dupItems);

// Missing pieces
const missing = [];
if (timerRowSeen) missing.push('The last row of the UI ELEMENT tab is called "Timer" but has no text or translations. We use the countdown format 14:32:08 (HH:MM:SS) from the "gift_timer" row and the "Unlocks in" text; please confirm that is all that is needed.');
else missing.push('The "Timer" row was not found in the UI ELEMENT tab.');
missing.push(`There is no "campaign ended" message in the sheet. After 26 December the page needs one, so we added the English placeholder "${PLACEHOLDER_ENDED}" under the key campaign_ended, in all 12 UI languages. Please send the translations.`);
missing.push('Login link and Terms & Conditions links (card "Full terms & conditions" and the legal line "Full campaign terms apply") are not in the links sheet and not confirmed. src/config.js still has "#" placeholders for login, terms and campaignTerms. Please send the final URLs. (Deposit links per day come from the links sheet via scripts/import-links.mjs.)');
section('Missing in the sheet', '', missing);

section(
  'Step 3 text replaced - all 12 translations are agency-made, please verify',
  'The sheet text of step 3 (key step3_body, EN "The gift turns green when the bonus is credited.") described a green "credited" gift. The page has no such state (only missed / active / locked) and no tracking, so the owner replaced it with "Deposit before 23:59 to claim the day’s bonus." The script applies this override on every import, the sheet is untouched. The heading ("Deposit & claim") stays as in the sheet. These strings were written by the agency, not taken from the sheet:',
  UI_LANGS.map((l) => `${l}: "${STEP3_BODY[l]}"`),
);

section(
  'FR_CA (French Canada) cards are our translation',
  '',
  ['The sheet has a French (Canada) interface column but no French (Canada) card tab. We translated the cards from EN_CAD: same amounts in CAD, game names left unchanged, and the words already used in the FR_CA UI column reused where they exist (Cadeau expiré, Cadeau surprise, Déposer et réclamer, ...). Offer wording such as "Bonus de Noël", "Tours gratuits de Noël", "Dépôt min.", "Exigence de mise" and "Valable jusqu’au ... 23 h 59" is ours. Marked in data/cards/FR_CA.json as translatedBy "agency, client to verify". Please have it checked.'],
);

section('Cells that could not be read cleanly', 'The import kept the raw sheet text for these, but the structured values (amount, min deposit, ...) may be missing or wrong:', unparsed.filter((u) => !/EN SOURCE/.test(u)));
section('Other differences between markets', 'These values should normally be the same in every market:', crossDiffs);
section('EN SOURCE column does not match the EN column', '', unparsed.filter((u) => /EN SOURCE/.test(u)));

const md = [];
md.push('# Christmas Journey - open points from the sheet import');
md.push('');
md.push('Generated by `scripts/import-sheet.mjs` from the Google Sheet "Перевод Лендинга JP". Re-run the script after the sheet changes and this file is rewritten.');
md.push('');
md.push(`**Open points for the client: ${n}**`);
md.push('');
md.push('## Fixes applied automatically');
md.push('');
md.push('These were obvious sheet errors. The script corrects them on every import; the sheet itself is untouched.');
md.push('');
if (fixes.length === 0) md.push('- (none)');
for (const f of fixes) md.push(`- ${f}`);
md.push('');
let sn = 0;
for (const s of sections) {
  sn++;
  md.push(`## ${sn}. ${s.title}`);
  md.push('');
  if (s.intro) {
    md.push(s.intro);
    md.push('');
  }
  for (const it of s.items) md.push(`- ${it}`);
  md.push('');
}
md.push('## Good to know');
md.push('');
md.push('- The "Bonus credited" column of the market tabs is not used. The page has only three states: missed (Gift expired), active (Deposit & Claim) and locked (Surprise gift).');
md.push('- Some UI texts contain sample values that the page replaces with live ones: dates ("YESTERDAY · DEC 6", "TODAY’S STOP · DEC 7", "Opens 8 December", ...) and the countdown "14:32:08".');
for (const nt of notes) md.push(`- ${nt}`);
md.push('');
fs.writeFileSync(path.join(dataDir, 'ISSUES.md'), md.join('\n'), 'utf8');

console.log(`Wrote ${UI_LANGS.length} ui files, ${MARKETS.length} cards files, markets.json, browser-map.json, ISSUES.md`);
console.log(`Fixes applied: ${fixes.length}; open points listed: ${n} (sections: ${sections.length})`);

// ---- links sheet: per-day deposit links, MDL amounts, diff report ----------------
import { execFileSync } from 'node:child_process';
execFileSync(process.execPath, [path.join(root, 'scripts/import-links.mjs')], { stdio: 'inherit' });
