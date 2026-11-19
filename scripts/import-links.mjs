// Imports the client's links sheet (tab "JP"), see data/source/links-sheet.txt.
//   node scripts/import-links.mjs
// Writes:
//   data/links.json              per-day deposit link + promo code (used by the card button)
//   data/source/links-parsed.json  amounts per currency as parsed from the sheet
//   data/source/links-diff.md    every amount the page shows vs the sheet (all markets, all days)
// And applies the client's corrected MDL amounts to data/cards/RO_MDL.json (the only data change).
// Any other difference is only listed, never applied: the owner decides.
// The dump is the sheet read through the gviz html view (rows flattened to one line each).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const readJson = (rel) => JSON.parse(rd(rel));
const writeJson = (rel, o) => fs.writeFileSync(path.join(root, rel), JSON.stringify(o, null, 2) + '\n', 'utf8');

const CURRENCIES = ['MDL', 'GBP', 'USD', 'CAD', 'AUD', 'NOK', 'SEK', 'DKK', 'TRY'];
const DAYS = 26;

// "20.000" / "1,100" / "5000" -> number. Only used on whole amounts (no decimals in this sheet).
const num = (s) => Number(String(s).replace(/[.,\s](?=\d{3}\b)/g, ''));

// ---- parse the dump --------------------------------------------------------
const lines = rd('data/source/links-sheet.txt').split(/\r?\n/).filter((l) => /^\d+ December /.test(l));
if (lines.length !== DAYS) throw new Error(`links sheet: ${lines.length} rows, expected ${DAYS}`);

/** "70% up to 7000 MDL min dep 500 MDL" or "82 FS min dep 350 MDL" */
function parseCell(cell, cur) {
  let m = cell.match(new RegExp(`^(\\d+)% up to ([\\d.,]+) ${cur} min dep ([\\d.,]+) ${cur}$`));
  if (m) return { percent: Number(m[1]), max: num(m[2]), min: num(m[3]) };
  m = cell.match(new RegExp(`^(\\d+) FS min dep ([\\d.,]+) ${cur}$`));
  if (m) return { spins: Number(m[1]), min: num(m[2]) };
  throw new Error(`cannot parse ${cur} cell: "${cell}"`);
}

const sheet = [];
for (const line of lines) {
  const m = line.match(/^(\d+) December \w+ Bonus Day \d+ Dec \S+ (\S+) (https:\/\/track\.jack-pot\.io\/\S*promocode=\s*\S+) (.*) x(\d+)$/);
  if (!m) throw new Error('cannot parse row: ' + line.slice(0, 120));
  const day = Number(m[1]);
  const promo = m[2];
  const link = m[3].replace(/\s+/g, ''); // strip ALL whitespace (Dec 1 has a break before the code)
  const wager = Number(m[5]);
  let rest = m[4];
  // EUR part: "<bonus> [game] [bet] <minEUR> EUR" up to the MDL cell
  const iMdl = rest.search(/\d+% up to [\d.,]+ MDL min dep |\d+ FS min dep [\d.,]+ MDL/);
  if (iMdl < 0) throw new Error(`day ${day}: MDL cell not found`);
  const eurPart = rest.slice(0, iMdl).trim();
  const tail = rest.slice(iMdl);
  const cells = {};
  // split the tail into one cell per currency, in the fixed column order
  let t = tail;
  CURRENCIES.forEach((cur, i) => {
    const next = CURRENCIES[i + 1];
    const re = new RegExp(`^(.*?min dep [\\d.,]+ ${cur})(?: |$)`);
    const mm = t.match(re);
    if (!mm) throw new Error(`day ${day}: ${cur} cell not found in "${t.slice(0, 80)}"`);
    cells[cur] = parseCell(mm[1], cur);
    t = t.slice(mm[0].length);
    void next;
  });
  if (t.trim()) throw new Error(`day ${day}: leftover "${t}"`);
  const mp = eurPart.match(/^(\d+)% up to ([\d.,]+) EUR ([\d.,]+) EUR$/);
  const mf = eurPart.match(/^(\d+) FS (.*) ([\d.,]+) EUR$/);
  let eur;
  let game = null;
  if (mp) eur = { percent: Number(mp[1]), max: num(mp[2]), min: num(mp[3]) };
  else if (mf) {
    eur = { spins: Number(mf[1]), min: num(mf[3]) };
    game = mf[2];
  } else throw new Error(`day ${day}: EUR cell "${eurPart}"`);
  sheet.push({ day, promo, link, wager, game, amounts: { EUR: eur, ...cells } });
}
sheet.sort((a, b) => a.day - b.day);

// ---- links: assert and write -----------------------------------------------
const bad = sheet.filter((r) => !r.link.endsWith('promocode=' + r.promo) || /\s/.test(r.link));
if (bad.length) throw new Error('deposit link does not end with its promo code on day(s): ' + bad.map((r) => r.day).join(', '));
if (sheet.some((r, i) => r.day !== i + 1)) throw new Error('days are not 1..26');
writeJson('data/links.json', sheet.map((r) => ({
  day: r.day,
  date: `2026-12-${String(r.day).padStart(2, '0')}`,
  promo: r.promo,
  deposit: r.link,
})));
writeJson('data/source/links-parsed.json', sheet.map(({ day, promo, wager, game, amounts }) => ({ day, promo, wager, game, amounts })));
console.log(`links: ${sheet.length}/${DAYS} ok (each ends with promocode=<its promo code>)`);

// ---- MDL: apply the client's corrected amounts to RO_MDL cards -------------
const roPath = 'data/cards/RO_MDL.json';
const ro = readJson(roPath);
let mdlChanges = 0;
for (const d of ro.days) {
  const s = sheet[d.day - 1].amounts.MDL;
  const setNum = (line, from, to) => line.replace(new RegExp(`\\b${from}(?= MDL$)`), String(to));
  if (d.type === 'bonus' && d.amount.max !== s.max) {
    for (const k of ['active', 'expired']) d.raw[k] = d.raw[k].map((l) => (l === d.amount.text ? setNum(l, d.amount.max, s.max) : l));
    d.amount.text = setNum(d.amount.text, d.amount.max, s.max);
    d.amount.max = s.max;
    mdlChanges++;
  }
  if (d.minDeposit.value !== s.min) {
    for (const k of ['active', 'expired']) d.raw[k] = d.raw[k].map((l) => (l === d.minDeposit.text ? setNum(l, d.minDeposit.value, s.min) : l));
    d.minDeposit.text = setNum(d.minDeposit.text, d.minDeposit.value, s.min);
    d.minDeposit.value = s.min;
    mdlChanges++;
  }
}
writeJson(roPath, ro);
console.log(`MDL: ${mdlChanges} value(s) updated in ${roPath}`);

// ---- diff: every amount the page shows vs the sheet ------------------------
const markets = readJson('data/markets.json');
const rows = [];
let compared = 0;
for (const mk of markets) {
  const cards = readJson(`data/cards/${mk.id}.json`).days;
  for (const c of cards) {
    const s = sheet[c.day - 1];
    const a = s.amounts[mk.currency];
    const chk = (what, page, sheetVal) => {
      compared++;
      if (page !== sheetVal) rows.push({ market: mk.id, day: c.day, what, page, sheet: sheetVal, cur: mk.currency });
    };
    if (c.type === 'bonus') {
      chk('percent', c.amount.percent, a.percent ?? '(FS in sheet)');
      chk('max bonus', c.amount.max, a.max ?? '(FS in sheet)');
    } else {
      chk('free spins', c.amount.spins, a.spins ?? '(bonus in sheet)');
    }
    chk('min deposit', c.minDeposit.value, a.min);
    chk('wagering', c.wagering.multiplier, s.wager);
    if (c.game && s.game && !s.game.toLowerCase().includes(c.game.toLowerCase())) {
      compared++;
      rows.push({ market: mk.id, day: c.day, what: 'game', page: c.game, sheet: s.game, cur: mk.currency });
    } else if (c.game || s.game) compared++;
    if (!!c.game !== !!s.game) rows.push({ market: mk.id, day: c.day, what: 'game present', page: c.game ?? '-', sheet: s.game ?? '-', cur: mk.currency });
  }
}
const byWhat = {};
for (const r of rows) byWhat[r.what] = (byWhat[r.what] || 0) + 1;
const md = [];
md.push('# Page vs client links sheet (tab "JP")');
md.push('');
md.push('Generated by `scripts/import-links.mjs`. Compares what the page shows (data/cards/*.json) with the client links sheet, for 15 markets x 26 days.');
md.push('Markets use the sheet column of their currency (DE, BG, NL, IT, RU use EUR; FR_CA uses CAD).');
md.push('MDL was applied from the sheet (client corrected it); every other difference is only listed here and was NOT changed.');
md.push('');
md.push(`Values compared: ${compared}. Differences: **${rows.length}**.${rows.length ? ' By type: ' + Object.entries(byWhat).map(([k, v]) => `${k} ${v}`).join(', ') + '.' : ''}`);
md.push('');
if (rows.length) {
  md.push('| Market | Day | What | Page shows | Sheet says |');
  md.push('|---|---|---|---|---|');
  for (const r of rows) md.push(`| ${r.market} | ${r.day} | ${r.what} | ${r.page} | ${r.sheet} |`);
} else md.push('No differences.');
md.push('');
fs.writeFileSync(path.join(root, 'data/source/links-diff.md'), md.join('\n'), 'utf8');
console.log(`diff: ${rows.length} difference(s) in ${compared} values -> data/source/links-diff.md`);
