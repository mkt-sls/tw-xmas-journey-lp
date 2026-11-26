#!/usr/bin/env node
// Turns data/source/sheet.json (the Top Win texts sheet, see extract-sheet.mjs) into the JSON the page uses:
//   data/cards/<MARKET>.json  26 daily cards per market
//   data/ui/<lang>.json       UI strings per language
// Also writes the sheet-derived part of data/ISSUES.md (scripts/import-links.mjs adds the links part).
// Re-run: node scripts/extract-sheet.mjs <texts.xlsx> && node scripts/import-sheet.mjs && node scripts/import-links.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data');
const tabs = JSON.parse(fs.readFileSync(path.join(dataDir, 'source', 'sheet.json'), 'utf8')).tabs;

const DAYS = 26;

// Market -> sheet tab, UI language file, currency. (markets.json and browser-map.json are kept by hand.)
// uiCol = column of the language in the UI ELEMENT UI block (A1:D19); locCol = column in the LOCATION table (rows 27-52):
// that table is ordered day | RU | RO | EN | DE | NL (RU is not used).
const MARKETS = [
  { id: 'DE', tab: 'DE', uiLang: 'DE', currency: 'EUR', uiCol: 1, locCol: 4 },
  { id: 'NL', tab: 'NL', uiLang: 'NL', currency: 'EUR', uiCol: 2, locCol: 5 },
  { id: 'EN_GBP', tab: 'EN', uiLang: 'EN', currency: 'GBP', uiCol: 0, locCol: 3 },
  { id: 'RO_MDL', tab: 'RO', uiLang: 'RO_MD', currency: 'MDL', uiCol: 3, locCol: 2 },
];

// ---- explicit overrides of the sheets (owner decisions 2026-11-19). Each one is also listed in data/ISSUES.md. ------------
// Free-spin counts: numbers follow the links sheet (tab TW EUROPE).
// Day 12 = 78 FS: confirmed by owner 2026-11-19 (links sheet says 78, texts sheet says 75 in all four tabs). The client should correct the texts sheet.
const FS_OVERRIDES = { 12: { from: 75, to: 78 } };
// "How it works" step 1 says "1-25 December" in every language; the campaign runs 1-26 December. Only the number changes.
const STEP1_OVERRIDES = {
  EN: ['1–25 December', '1–26 December'],
  DE: ['1. bis 25. Dezember', '1. bis 26. Dezember'],
  NL: ['1 t/m 25 december', '1 t/m 26 december'],
  RO_MD: ['între 1 și 25 decembrie', 'între 1 și 26 decembrie'],
};
// Day 21 RO has no minimum-deposit line anywhere: see MDL_FOR_EUR below (22 -> 300 MDL).

// Place names: UI ELEMENT, LOCATION title in A24, header in row 26, days 1-26 in rows 27-52.
function readLocations(market) {
  const ui = tabs['UI ELEMENT'];
  if (!/LOCATION/i.test(ui[23]?.[0] ?? '')) throw new Error('UI ELEMENT A24 is not the LOCATION title');
  const out = {};
  for (let d = 1; d <= DAYS; d++) {
    const row = ui[25 + d];
    if (Number(row?.[0]) !== d) throw new Error(`UI ELEMENT row ${26 + d}: expected day ${d}, got "${row?.[0]}"`);
    const name = String(row[market.locCol] ?? '').trim();
    if (!name) throw new Error(`UI ELEMENT row ${26 + d}: empty place name for ${market.uiLang}`);
    out[String(d)] = name;
  }
  return out;
}

const issues = []; // sheet findings for the client, plain English
const selfTranslated = []; // { lang, key, value }

// ---- self-translated / skeleton UI strings -------------------------------------------------
// Keys the texts sheet does not carry. English = text from Figma file s2CqwGqe0O0FcALhBNlTRe (canvas 58:332, nodes 58:511 / 58:808 / 58:875 / 58:672); DE/NL/RO are OUR translation (listed in ISSUES.md).
const OWN = {
  brand: { EN: 'Top Win', DE: 'Top Win', NL: 'Top Win', RO_MD: 'Top Win' },
  login: { EN: 'Log in', DE: 'Anmelden', NL: 'Inloggen', RO_MD: 'Autentificare' },
  register: { EN: 'Register', DE: 'Registrieren', NL: 'Registreren', RO_MD: 'Înregistrare' },
  campaign_dates: {
    EN: '1–26 December · 26 gifts',
    DE: '1.–26. Dezember · 26 Geschenke',
    NL: '1–26 december · 26 cadeaus',
    RO_MD: '1–26 decembrie · 26 cadouri',
  },
  campaign_title: { EN: 'Christmas Journey', DE: 'Weihnachtsreise', NL: 'Kerstreis', RO_MD: 'Călătoria de Crăciun' },
  // title in two parts so each language picks its own break: part A white, part B orange gradient. title_join = '1': no gap between the parts on desktop (one word).
  title_a: { EN: 'Christmas', DE: 'Weihnachts', NL: 'Kerst', RO_MD: 'Călătoria de' },
  title_b: { EN: 'Journey', DE: 'reise', NL: 'reis', RO_MD: 'Crăciun' },
  title_join: { EN: undefined, DE: '1', NL: '1', RO_MD: undefined },
  subtitle: {
    EN: 'Follow Father Christmas through a snowy English village. A new gift unlocks every day — open it, claim your bonus.',
    DE: 'Folge dem Weihnachtsmann durch ein verschneites englisches Dorf. Jeden Tag wird ein neues Geschenk freigeschaltet – öffne es und sichere dir deinen Bonus.',
    NL: 'Volg de Kerstman door een besneeuwd Engels dorp. Elke dag wordt een nieuw cadeau ontgrendeld – open het en claim je bonus.',
    RO_MD: 'Urmează-l pe Moș Crăciun printr-un sat englezesc acoperit de zăpadă. În fiecare zi se deblochează un cadou nou – deschide-l și revendică-ți bonusul.',
  },
  today: { EN: 'TODAY', DE: 'HEUTE', NL: 'VANDAAG', RO_MD: 'AZI' },
  yesterday: { EN: 'YESTERDAY · {date}', DE: 'GESTERN · {date}', NL: 'GISTEREN · {date}', RO_MD: 'IERI · {date}' },
  todays_stop: {
    EN: 'TODAY’S STOP · {date}',
    DE: 'HEUTIGER HALT · {date}',
    NL: 'STOP VAN VANDAAG · {date}',
    RO_MD: 'OPRIREA DE AZI · {date}',
  },
  tomorrow: { EN: 'TOMORROW · {date}', DE: 'MORGEN · {date}', NL: 'MORGEN · {date}', RO_MD: 'MÂINE · {date}' },
  in_two_days: { EN: 'IN 2 DAYS · {date}', DE: 'IN 2 TAGEN · {date}', NL: 'OVER 2 DAGEN · {date}', RO_MD: 'PESTE 2 ZILE · {date}' },
  missed: { EN: 'MISSED · {date}', DE: 'VERPASST · {date}', NL: 'GEMIST · {date}', RO_MD: 'PIERDUT · {date}' },
  open_gift: { EN: 'OPEN GIFT', DE: 'GESCHENK ÖFFNEN', NL: 'CADEAU OPENEN', RO_MD: 'DESCHIDE CADOUL' },
  unlocks_in: {
    EN: 'Unlocks in {time}',
    DE: 'Wird freigeschaltet in {time}',
    NL: 'Wordt ontgrendeld over {time}',
    RO_MD: 'Se deblochează în {time}',
  },
  responsible: {
    EN: '18+ · Play responsibly',
    DE: '18+ · Verantwortungsvoll spielen',
    NL: '18+ · Speel verantwoord',
    RO_MD: '18+ · Joacă responsabil',
  },
  legend_available: { EN: 'Available today', DE: 'Heute verfügbar', NL: 'Vandaag beschikbaar', RO_MD: 'Disponibil azi' },
  legend_missed: { EN: 'Missed', DE: 'Verpasst', NL: 'Gemist', RO_MD: 'Pierdut' },
};

// ---- helpers -------------------------------------------------------------------------------
const lines = (cell) => String(cell ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
const NUM = '(\\d[\\d.]*)';

function parseAmount(line, currency) {
  const pct = line.match(new RegExp(`^(\\d+)%.*?${NUM}\\s+([A-Z]{3})$`));
  if (pct) {
    return { kind: 'bonus', amount: { percent: Number(pct[1]), max: Number(pct[2].replace(/\./g, '')), currency: pct[3], text: line } };
  }
  const fs = line.match(/^(\d+)\s+\S/);
  if (fs) return { kind: 'fs', amount: { freeSpins: Number(fs[1]), text: line } };
  throw new Error(`Cannot read amount line "${line}"`);
}

function parseMin(line) {
  const m = line.match(new RegExp(`:\\s*${NUM}\\s+([A-Z]{3})$`));
  return m ? { value: Number(m[1].replace(/\./g, '')), currency: m[2], text: line } : null;
}

// Minimum deposit of the "side table" in the links sheet (EUR/GBP -> MDL); used when a MDL cell is empty.
const MDL_FOR_EUR = { 22: 300, 25: 350, 28: 400, 30: 450, 35: 500 };

// ---- cards ---------------------------------------------------------------------------------
function buildCards(market) {
  const rows = tabs[market.tab];
  if (!rows || rows.length < DAYS + 1) throw new Error(`Tab ${market.tab}: expected ${DAYS + 1} rows, got ${rows?.length}`);
  const locations = readLocations(market);
  const days = [];
  let minLinePrefix = null;
  for (let d = 1; d <= DAYS; d++) {
    const row = rows[d];
    const [active, credited, expired, locked] = [0, 1, 2, 3].map((i) => lines(row[i]));
    // Override: free-spin count follows the links sheet (see FS_OVERRIDES). The amount is line 3 (index 2) of every card state.
    const fsFix = FS_OVERRIDES[d];
    if (fsFix) {
      let fixed = false;
      for (const l of [active, credited, expired]) {
        if (l[2].startsWith(`${fsFix.to} `)) continue; // the sheet was already corrected (texts sheet 2026-11-26: 78)
        if (!l[2].startsWith(`${fsFix.from} `)) throw new Error(`${market.tab} day ${d}: expected ${fsFix.from} free spins, got "${l[2]}"`);
        l[2] = l[2].replace(String(fsFix.from), String(fsFix.to));
        fixed = true;
      }
      if (fixed && market.id === 'DE') {
        issues.push(
          `Day ${d}: the texts sheet says ${fsFix.from} free spins in all four languages, the links sheet says ${fsFix.to}. ` +
            `Confirmed by the owner (2026-11-19): the page shows ${fsFix.to}. Not a question: please correct the texts sheet to ${fsFix.to}.`,
        );
      }
    }
    // The first line of every state carries the same "DAY n · date" label.
    for (const [name, l] of [['credited', credited], ['expired', expired], ['locked', locked]]) {
      if (l[0] !== active[0]) issues.push(`${market.tab} day ${d}: the "${name}" text starts with a different day label than the "deposit & claim" text.`);
    }
    if (!new RegExp(`\\b${d}\\b`).test(active[0])) issues.push(`${market.tab} row ${d + 1}: day label "${active[0]}" does not contain day number ${d}.`);

    const { kind, amount } = parseAmount(active[2], market.currency);
    const game = kind === 'fs' ? active[3].replace(/^\S+\s+/, '') : null;
    const minIdx = kind === 'fs' ? 4 : 3;
    let minDeposit = parseMin(active[minIdx] ?? '');

    if (minDeposit) minLinePrefix = minLinePrefix ?? active[minIdx].replace(/:.*$/, '');
    if (!minDeposit) {
      // Day 21 RO: the sheet has no "minimum deposit" line. Use the side table of the links sheet (22 -> 300 MDL) and flag it.
      // Card without the min line: [.., amount, (game), wagering, valid until, CTA, terms] (texts sheet since 2026-11-26).
      if (market.currency === 'MDL' && active.length === minIdx + 4) {
        const eurMin = parseMin(tabs.DE[d][0].split('\n').find((x) => /:\s*\d+\s*EUR$/.test(x)) ?? '');
        const mdl = eurMin && MDL_FOR_EUR[eurMin.value];
        if (!mdl) throw new Error(`Day ${d}: no minimum deposit and no side-table value`);
        const prefix = minLinePrefix ?? tabs.RO[1][0].split('\n').find((x) => x.includes(':') && /MDL$/.test(x)).replace(/:.*$/, '');
        const text = `${prefix}: ${mdl} MDL`;
        minDeposit = { value: mdl, currency: 'MDL', text };
        for (const l of [active, credited, expired]) l.splice(minIdx, 0, text);
        issues.push(
          `RO day ${d}: the texts sheet has no "minimum deposit" line (the MDL cell in the links sheet is empty too). ` +
            `The page shows "${text}" (the links sheet side table says ${eurMin.value} EUR/GBP -> ${mdl} MDL). Confirmed by the owner (2026-11-26): not a question, listed for the record.`,
        );
      } else {
        throw new Error(`${market.tab} day ${d}: cannot find the minimum deposit line in ${JSON.stringify(active)}`);
      }
    }
    // Layout check (after a patch the arrays are one line longer than the sheet's).
    const n = active.length;
    if (n !== (kind === 'fs' ? 9 : 8)) throw new Error(`${market.tab} day ${d}: unexpected active line count ${n}`);
    if (locked.length !== 6) throw new Error(`${market.tab} day ${d}: unexpected locked line count ${locked.length}`);
    if (expired.length !== n || credited.length !== n) throw new Error(`${market.tab} day ${d}: states differ in line count`);
    // Wagering and valid-until rows follow the min deposit (texts sheet 2026-11-26): "Wagering: x20", "Valid until: 23:59, 1 Dec".
    // The card draws every row between the min deposit and the CTA from raw (card.js), so these fields only check the layout.
    const wagering = active[minIdx + 1];
    const validUntil = active[minIdx + 2];
    if (!/:\s*x\d+$/.test(wagering)) throw new Error(`${market.tab} day ${d}: expected a wagering row, got "${wagering}"`);
    if (!/:\s*\d{1,2}:\d{2},\s/.test(validUntil)) throw new Error(`${market.tab} day ${d}: expected a valid-until row, got "${validUntil}"`);
    if (!new RegExp(`\\b${d}\\b`).test(validUntil.replace(/^.*?:\s*\d{1,2}:\d{2},/, ''))) throw new Error(`${market.tab} day ${d}: valid-until row is for another day: "${validUntil}"`);

    days.push({
      day: d,
      date: `2026-12-${String(d).padStart(2, '0')}`,
      location: locations[String(d)], // UI ELEMENT, LOCATION table
      type: kind,
      amount,
      game,
      minDeposit,
      wagering,
      validUntil,
      raw: { active, expired, locked },
    });
  }
  return { market: market.id, uiLang: market.uiLang, currency: market.currency, days };
}

// ---- UI strings ----------------------------------------------------------------------------
function buildUi(market, cards) {
  const lang = market.uiLang;
  const ui = tabs['UI ELEMENT'];
  const col = market.uiCol;
  const sheetUi = {
    cta_primary: ui[1][col],
    processing: ui[2][col],
    terms_conditions: ui[3][col],
    how_it_works: ui[11][col],
    step1_title: ui[12][col],
    step1_body: ui[13][col],
    step2_title: ui[14][col],
    step2_body: ui[15][col],
    step3_title: ui[16][col],
  };
  for (const [k, v] of Object.entries(sheetUi)) if (!v) throw new Error(`UI ELEMENT: missing ${k} for ${lang}`);

  // Step 1 body in the sheet says "1–25 December"; the campaign runs 1–26 (see STEP1_OVERRIDES). Everything else stays as in the sheet.
  const [from, to] = STEP1_OVERRIDES[lang];
  if (!sheetUi.step1_body.includes(to)) {
    if (!sheetUi.step1_body.includes(from)) throw new Error(`UI ELEMENT step1_body for ${lang} has neither "${from}" nor "${to}": ${sheetUi.step1_body}`);
    sheetUi.step1_body = sheetUi.step1_body.replace(from, to);
  }
  // No other "25" day range may be left in the UI texts.
  for (const [k, v] of Object.entries(sheetUi)) if (/\b25\b/.test(v)) throw new Error(`UI ELEMENT ${k} for ${lang} still has a "25": ${v}`);

  // Card-state words come from the card texts themselves, so page and card always agree.
  const d1 = cards.days[0].raw;
  const locked = d1.locked;
  const strings = {
    ...pick(OWN, lang),
    ...sheetUi,
    gift_expired: d1.expired[d1.expired.length - 2],
    locked: locked[4].split(' · ')[0],
    full_terms: d1.active.at(-1),
    surprise_gift: locked[1],
    opens_dec8: locked[2].replace(/:.*$/, '') + ' {date}',
    come_back_tomorrow: locked[3],
    legend_locked: locked[4].split(' · ')[0],
  };
  // No tracking system exists (owner 2026-11-19): step 3 of "How it works" has only its title (no step3_body key); the sheet's body
  // ("the gift turns green when the bonus is credited") is dropped on purpose.
  // Everything from OWN is our wording (English = skeleton text, other languages = our translation): list it for the client.
  for (const k of Object.keys(OWN)) {
    if (k !== 'brand' && !k.startsWith('title_') && !NOT_SHOWN.has(k)) selfTranslated.push({ lang, key: k, value: OWN[k][lang] });
  }

  const locations = readLocations(market);
  return { lang, strings, locations };
}

// Kept in data/ui like Jackpot, but the page does not render them (header without LOG IN / REGISTER since 2026-11-24, route legend
// removed 2026-11-23): not listed for the client to check.
const NOT_SHOWN = new Set(['login', 'register', 'legend_available', 'legend_missed']);

function pick(table, lang) {
  return Object.fromEntries(Object.entries(table).filter(([, v]) => v[lang] !== undefined).map(([k, v]) => [k, v[lang]]));
}

// ---- run -----------------------------------------------------------------------------------
fs.mkdirSync(path.join(dataDir, 'cards'), { recursive: true });
fs.mkdirSync(path.join(dataDir, 'ui'), { recursive: true });
const written = new Set();
for (const market of MARKETS) {
  const cards = buildCards(market);
  fs.writeFileSync(path.join(dataDir, 'cards', `${market.id}.json`), JSON.stringify(cards, null, 2) + '\n', 'utf8');
  if (!written.has(market.uiLang)) {
    written.add(market.uiLang);
    fs.writeFileSync(path.join(dataDir, 'ui', `${market.uiLang}.json`), JSON.stringify(buildUi(market, cards), null, 2) + '\n', 'utf8');
  }
  console.log(`Wrote cards/${market.id}.json and ui/${market.uiLang}.json`);
}

// Findings for ISSUES.md: handed to import-links.mjs, which writes the whole file.
fs.writeFileSync(
  path.join(dataDir, 'source', 'sheet-findings.json'),
  JSON.stringify({ issues, selfTranslated }, null, 2) + '\n',
  'utf8',
);
console.log(`${issues.length} sheet findings, ${selfTranslated.length} self-translated strings (data/source/sheet-findings.json)`);
