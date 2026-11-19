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
// Day 12 says 75 FS in all four text tabs, the links sheet says 78. Shown 78 provisionally; ask the client: 75 or 78?
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
// Keys the texts sheet does not carry. English = skeleton wording; DE/NL/RO are OUR translation (listed in ISSUES.md).
const OWN = {
  brand: { EN: 'Top Win', DE: 'Top Win', NL: 'Top Win', RO_MD: 'Top Win' },
  login: { EN: 'Log in', DE: 'Anmelden', NL: 'Inloggen', RO_MD: 'Autentificare' },
  register: { EN: 'Register', DE: 'Registrieren', NL: 'Registreren', RO_MD: 'Înregistrare' },
  campaign_dates: {
    EN: '1–26 DECEMBER · 26 GIFTS',
    DE: '1.–26. DEZEMBER · 26 GESCHENKE',
    NL: '1–26 DECEMBER · 26 CADEAUS',
    RO_MD: '1–26 DECEMBRIE · 26 CADOURI',
  },
  campaign_title: { EN: 'Christmas Journey', DE: 'Weihnachtsreise', NL: 'Kerstreis', RO_MD: 'Călătoria de Crăciun' },
  subtitle: {
    EN: 'Follow Father Christmas through a snowy English village. A new gift unlocks every day — open it, claim your bonus.',
    DE: 'Folge dem Weihnachtsmann durch ein verschneites englisches Dorf. Jeden Tag wird ein neues Geschenk freigeschaltet – öffne es und sichere dir deinen Bonus.',
    NL: 'Volg de Kerstman door een besneeuwd Engels dorp. Elke dag wordt een nieuw cadeau ontgrendeld – open het en claim je bonus.',
    RO_MD: 'Urmează-l pe Moș Crăciun printr-un sat englezesc acoperit de zăpadă. În fiecare zi se deblochează un cadou nou – deschide-l și revendică-ți bonusul.',
  },
  today: { EN: 'TODAY', DE: 'HEUTE', NL: 'VANDAAG', RO_MD: 'AZI' },
  '26 DAYS': { EN: '26 DAYS', DE: '26 TAGE', NL: '26 DAGEN', RO_MD: '26 ZILE' },
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
  // Sheet step 3 body says "the gift turns green when the bonus is credited"; there is no credited state, so we keep this.
  step3_body: {
    EN: 'Deposit before 23:59 to claim the day’s bonus.',
    DE: 'Zahle vor 23:59 Uhr ein, um den Tagesbonus zu sichern.',
    NL: 'Stort vóór 23:59 om de bonus van de dag te claimen.',
    RO_MD: 'Depune înainte de 23:59 pentru a revendica bonusul zilei.',
  },
  responsible: {
    EN: '18+ · Play responsibly',
    DE: '18+ · Verantwortungsvoll spielen',
    NL: '18+ · Speel verantwoord',
    RO_MD: '18+ · Joacă responsabil',
  },
  be_gamble_aware: { EN: '', DE: '', NL: '', RO_MD: '' },
  campaign_terms: {
    EN: 'Full campaign terms apply',
    DE: 'Es gelten die vollständigen Aktionsbedingungen',
    NL: 'Volledige actievoorwaarden zijn van toepassing',
    RO_MD: 'Se aplică termenii complecți ai campaniei',
  },
  day_of: { EN: 'Day 7 of 26', DE: 'Tag 7 von 26', NL: 'Dag 7 van 26', RO_MD: 'Ziua 7 din 26' },
  gifts_collected: {
    EN: '4 gifts collected',
    DE: '4 Geschenke gesammelt',
    NL: '4 cadeaus verzameld',
    RO_MD: '4 cadouri colectate',
  },
  next_gift: { EN: 'Next gift in', DE: 'Nächstes Geschenk in', NL: 'Volgend cadeau over', RO_MD: 'Următorul cadou în' },
  gift_timer: { EN: '{time}', DE: '{time}', NL: '{time}', RO_MD: '{time}' },
  campaign_ended: {
    EN: 'The Christmas Journey has ended. Thank you for travelling with us!',
    DE: 'Die Weihnachtsreise ist zu Ende. Danke, dass du mitgereist bist!',
    NL: 'De Kerstreis is afgelopen. Bedankt dat je met ons meereisde!',
    RO_MD: 'Călătoria de Crăciun s-a încheiat. Îți mulțumim că ai călătorit cu noi!',
  },
};
const OWN_EXTRAS = {
  day_7: { EN: 'Day 7', DE: 'Tag 7', NL: 'Dag 7', RO_MD: 'Ziua 7' },
  of_26: { EN: 'of 26', DE: 'von 26', NL: 'van 26', RO_MD: 'din 26' },
  gifts_collected_4: OWN.gifts_collected,
  next_gift_in: OWN.next_gift,
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
      for (const l of [active, credited, expired]) {
        if (l[2].startsWith(`${fsFix.to} `)) continue; // the sheet was already corrected
        if (!l[2].startsWith(`${fsFix.from} `)) throw new Error(`${market.tab} day ${d}: expected ${fsFix.from} free spins, got "${l[2]}"`);
        l[2] = l[2].replace(String(fsFix.from), String(fsFix.to));
      }
      if (market.id === 'DE') {
        issues.push(
          `Day ${d}: the texts sheet says ${fsFix.from} free spins in all four languages, the links sheet says ${fsFix.to}. ` +
            `The page shows ${fsFix.to} for now (numbers follow the links sheet). Ask client: ${fsFix.from} or ${fsFix.to}?`,
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
      if (market.currency === 'MDL' && active.length === minIdx + 2) {
        const eurMin = parseMin(tabs.DE[d][0].split('\n').find((x) => /:\s*\d+\s*EUR$/.test(x)) ?? '');
        const mdl = eurMin && MDL_FOR_EUR[eurMin.value];
        if (!mdl) throw new Error(`Day ${d}: no minimum deposit and no side-table value`);
        const prefix = minLinePrefix ?? tabs.RO[1][0].split('\n').find((x) => x.includes(':') && /MDL$/.test(x)).replace(/:.*$/, '');
        const text = `${prefix}: ${mdl} MDL`;
        minDeposit = { value: mdl, currency: 'MDL', text };
        for (const l of [active, credited, expired]) l.splice(minIdx, 0, text);
        issues.push(
          `RO day ${d}: the texts sheet has no "minimum deposit" line (the MDL cell in the links sheet is empty too). ` +
            `The page shows "${text}" (the links sheet side table says ${eurMin.value} EUR/GBP -> ${mdl} MDL). Please confirm.`,
        );
      } else {
        throw new Error(`${market.tab} day ${d}: cannot find the minimum deposit line in ${JSON.stringify(active)}`);
      }
    }
    // Layout check (after a patch the arrays are one line longer than the sheet's).
    const n = active.length;
    if (n !== (kind === 'fs' ? 7 : 6)) throw new Error(`${market.tab} day ${d}: unexpected active line count ${n}`);
    if (locked.length !== 6) throw new Error(`${market.tab} day ${d}: unexpected locked line count ${locked.length}`);
    if (expired.length !== n || credited.length !== n) throw new Error(`${market.tab} day ${d}: states differ in line count`);

    days.push({
      day: d,
      date: `2026-12-${String(d).padStart(2, '0')}`,
      location: locations[String(d)], // UI ELEMENT, LOCATION table
      type: kind,
      amount,
      game,
      minDeposit,
      wagering: '', // not in the sheet yet: row hidden when empty
      validUntil: '', // not in the sheet yet: row hidden when empty
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
  const row = tabs[market.tab][1];
  const credited = lines(row[1]);
  const locked = d1.locked;
  const strings = {
    ...pick(OWN, lang),
    ...sheetUi,
    bonus_credited: credited[credited.length - 2],
    gift_expired: d1.expired[d1.expired.length - 2],
    locked: locked[4].split(' · ')[0],
    full_terms: d1.active.at(-1),
    surprise_gift: locked[1],
    opens_dec8: locked[2].replace(/:.*$/, '') + ' {date}',
    come_back_tomorrow: locked[3],
  };
  strings.step3_body = OWN.step3_body[lang];
  // Everything from OWN is our wording (English = skeleton text, other languages = our translation): list it for the client.
  for (const k of Object.keys(OWN)) {
    if (!['brand', 'be_gamble_aware', 'gift_timer'].includes(k)) selfTranslated.push({ lang, key: k, value: OWN[k][lang] });
  }

  const extras = {
    cta_primary: sheetUi.cta_primary,
    cta_processing: sheetUi.processing,
    cta_terms: sheetUi.terms_conditions,
    ...pick(OWN_EXTRAS, lang),
  };
  const locations = readLocations(market);
  return { lang, strings, extras, locations };
}

function pick(table, lang) {
  return Object.fromEntries(Object.entries(table).map(([k, v]) => [k, v[lang]]));
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
