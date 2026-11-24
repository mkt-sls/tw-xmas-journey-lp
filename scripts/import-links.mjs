#!/usr/bin/env node
// Reads data/source/links-sheet.txt (dump of tab "TW EUROPE" of the client links sheet; tab "JP" is Jackpot, never use it)
// and writes:
//   data/links.json              26 days: { day, date, promo, deposit }  (one deposit link per day, same for every market)
//   data/source/links-diff.md    page amounts / minimum deposits vs the links sheet, all 4 markets
//   data/ISSUES.md               plain-English list for the client (sheet findings from import-sheet.mjs + links findings)
// Run after import-sheet.mjs: node scripts/import-links.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data');
const DAYS = 26;
const DOMAIN = 'tw-de.icu';
const LINKS_SHEET = '1qpxJhrKTPyaUyGmJRrwPQNbh4T8s7458HJCCi2QwiTo';

const raw = fs.readFileSync(path.join(dataDir, 'source', 'links-sheet.txt'), 'utf8').split(/\r?\n/);
const rowLines = raw.filter((l) => /^\d+ December /.test(l));
if (rowLines.length !== DAYS) throw new Error(`Expected ${DAYS} day rows, found ${rowLines.length}`);

const markets = JSON.parse(fs.readFileSync(path.join(dataDir, 'markets.json'), 'utf8'));
const findings = JSON.parse(fs.readFileSync(path.join(dataDir, 'source', 'sheet-findings.json'), 'utf8'));
const issues = [...findings.issues]; // plain strings
const clientIssues = []; // { title, body }

const NUM = '(\\d[\\d.]*)';
const toInt = (s) => Number(s.replace(/\./g, ''));

// One currency block: "73% up to 450 GBP min dep 35 GBP" or "83 FS min dep 25 GBP" (or MDL).
function parseBlock(text, cur) {
  // EUR rows write "min dep 35 35 EUR" / "min dep 25 bet 0.10 <game> 25 EUR": only the number right after "min dep" is used.
  let m = text.match(new RegExp(`(\\d+)% up to ${NUM} ${cur} min dep ${NUM}`));
  if (m) return { type: 'bonus', percent: Number(m[1]), max: toInt(m[2]), min: toInt(m[3]) };
  m = text.match(new RegExp(`(\\d+) FS min dep ${NUM}`));
  if (m) return { type: 'fs', fs: Number(m[1]), min: toInt(m[2]) };
  return null;
}

const links = [];
const sheetRows = [];
for (const line of rowLines) {
  const m = line.match(/^(\d+) December (\w+) (.+?) ([A-Z0-9]+) (https:\/\/\S+) (.*)$/);
  if (!m) throw new Error('Cannot parse links row: ' + line);
  const [, dayStr, , name, code, url, rest] = m;
  const day = Number(dayStr);
  const u = new URL(url);
  if (u.hostname !== DOMAIN) throw new Error(`Day ${day}: link is not on ${DOMAIN}: ${url}`);
  if (u.searchParams.get('promocode') !== code) throw new Error(`Day ${day}: promo code ${code} does not match link ${url}`);
  if (u.searchParams.get('modal') !== 'deposit') throw new Error(`Day ${day}: link has no modal=deposit: ${url}`);
  const nameDay = Number(name.match(/Bonus Day (\d+) Dec/)?.[1]);
  if (nameDay !== day) {
    clientIssues.push({
      title: `Links sheet, day ${day}: the "Bonus Name" says "${name}" (day ${nameDay || '?'}), expected "Bonus Day ${day} Dec".`,
      body: 'Looks like a copy-paste slip. The link and promo code on that row are used as they are.',
    });
  }

  // rest = "<EUR block> <GBP block> <MDL block>"; split at the GBP block start.
  const gbpAt = rest.search(/\d+% up to [\d.]+ GBP|\d+ FS min dep \d+ GBP/);
  const mdlAt = rest.search(/\d+% up to [\d.]+ MDL|\d+ FS min dep \d+ MDL/);
  const eurText = rest.slice(0, gbpAt);
  const eur = parseBlock(eurText, 'EUR');
  const gbp = parseBlock(rest.slice(gbpAt, mdlAt < 0 ? undefined : mdlAt), 'GBP');
  const mdl = mdlAt < 0 ? null : parseBlock(rest.slice(mdlAt), 'MDL');
  const game = eurText.match(/bet [\d.]+ (.+?) \d+ EUR\s*$/)?.[1] ?? null;
  if (!eur || !gbp) throw new Error(`Day ${day}: cannot read EUR/GBP blocks from "${rest}"`);

  links.push({ day, date: `2026-12-${String(day).padStart(2, '0')}`, promo: code, deposit: url });
  sheetRows.push({ day, EUR: eur, GBP: gbp, MDL: mdl, game });
}
links.sort((a, b) => a.day - b.day);
if (links.some((l, i) => l.day !== i + 1)) throw new Error('Days are not 1..26 in order');
fs.writeFileSync(path.join(dataDir, 'links.json'), JSON.stringify(links, null, 2) + '\n', 'utf8');

// ---- diff: page (data/cards) vs links sheet -----------------------------------------------
const diffs = []; // real differences
const known = []; // known gaps
const checks = []; // number of compared values
for (const market of markets) {
  const cards = JSON.parse(fs.readFileSync(path.join(dataDir, 'cards', `${market.id}.json`), 'utf8')).days;
  for (const c of cards) {
    const s = sheetRows[c.day - 1];
    const b = s[market.currency];
    const tag = `${market.id} day ${c.day}`;
    if (!b) {
      known.push(`${tag}: links sheet has no ${market.currency} block (page: min deposit ${c.minDeposit.value} ${market.currency}). Known gap.`);
      continue;
    }
    const cmp = (what, page, sheet) => {
      checks.push(1);
      if (page !== sheet) diffs.push(`${tag}: ${what}: page ${page}, links sheet ${sheet}`);
    };
    cmp('type', c.type, b.type);
    if (c.type === 'bonus') {
      cmp('percent', c.amount.percent, b.percent);
      cmp('max', c.amount.max, b.max);
    } else {
      cmp('free spins', c.amount.freeSpins, b.fs);
    }
    cmp('min deposit', c.minDeposit.value, b.min);
    if (c.type === 'fs') cmp('game', c.game, s.game);
  }
}

const md = [];
md.push('# Page vs links sheet');
md.push('');
md.push(`Compared: card text (data/cards/*.json, from the texts sheet) vs tab "TW EUROPE" of links sheet ${LINKS_SHEET}.`);
md.push(`Markets: ${markets.map((m) => m.id).join(', ')}. Days 1-${DAYS}. Values compared: ${checks.length}.`);
md.push('');
md.push(`## Differences: ${diffs.length}`);
md.push('');
md.push(diffs.length ? diffs.map((d) => '- ' + d).join('\n') : 'None.');
md.push('');
md.push(`## Known gaps: ${known.length}`);
md.push('');
md.push(known.length ? known.map((d) => '- ' + d).join('\n') : 'None.');
md.push('');
md.push('Other links-sheet findings (not amount differences): ' + (clientIssues.length ? '' : 'none'));
for (const i of clientIssues) md.push('- ' + i.title);
md.push('');
fs.writeFileSync(path.join(dataDir, 'source', 'links-diff.md'), md.join('\n'), 'utf8');

// ---- ISSUES.md -----------------------------------------------------------------------------
const out = [];
out.push('# Open points for the client');
out.push('');
out.push('Plain list, generated by `scripts/import-links.mjs` (do not edit by hand; edit the scripts). The last item lists the wording we wrote ourselves.');
out.push('');
let n = 0;
const item = (title, body) => {
  n += 1;
  out.push(`${n}. **${title}**`);
  if (body) out.push(`   ${body}`);
  out.push('');
};
const roGap = issues.find((i) => i.startsWith('RO day 21'));
item(
  'Day 21, Romanian (MDL): minimum deposit missing',
  roGap
    ? roGap.replace(/^RO day 21: /, '')
    : 'The sheets have no MDL minimum deposit for day 21; check the data.',
);
for (const c of clientIssues) item(c.title.replace(/^Links sheet, /, 'Links sheet: '), c.body);
// Texts sheet vs links sheet mismatches (same day, same value in all markets -> one item per day and field).
const diffGroups = new Map();
for (const d of diffs) {
  const m = d.match(/^\S+ day (\d+): (.+?): page (.+), links sheet (.+)$/);
  const key = `${m[1]}|${m[2]}|${m[3]}|${m[4]}`;
  diffGroups.set(key, [...(diffGroups.get(key) ?? []), d.split(' ')[0]]);
}
for (const [key, mk] of diffGroups) {
  const [day, what, page, sheet] = key.split('|');
  item(
    `Day ${day}: ${what} differ between the texts sheet and the links sheet`,
    `Texts sheet (shown on the page): ${page}. Links sheet: ${sheet}. Markets: ${mk.join(', ')}. Which one is right?`,
  );
}
for (const i of issues) if (i !== roGap) item(i, '');
item(
  'No wagering requirement and no "valid until" in the texts',
  'The cards show only the minimum deposit. We did not invent values. The rows are hidden until the client sends the corrected texts sheet with wagering and valid-until.',
);
item(
  'Locked card always says "Come back tomorrow"',
  'Also for gifts that are days away (day 20 seen on 1 December still says "Come back tomorrow to unlock this gift"). Suggest a text like "Opens on 20 December" for far-away days, or confirm it stays.',
);
item(
  'Texts sheet, step 1 of "How it works" says "1-25 December"',
  'The campaign runs 1-26 December. We show "1-26" in all four languages (only the number was changed from the sheet text). Please correct the sheet.',
);
item(
  'Texts sheet, step 3 of "How it works" says "The gift turns green when the bonus is credited"',
  'There is no tracking system, so there is no credited state. We dropped the body text of step 3; the step shows only its title "Deposit & claim".',
);
item(
  'Header: no LOG IN / REGISTER',
  `The header has only the logo and the market selector: LOG IN and REGISTER were removed (owner 2026-11-24). The deposit link of the day stays on the card. "Full terms & conditions" on the card opens https://top-win-uk.top/en/bonus-policy on every market and day (owner 2026-11-24). Please confirm.`,
);
item(
  'Translated by us — please check',
  'Strings the texts sheet does not have. English is the text from the Figma design; German / Dutch / Romanian are our own translation. The table is below.',
);
out.push('### Translated by us — please check');
out.push('');
out.push('| key | EN (Figma) | DE | NL | RO |');
out.push('| --- | --- | --- | --- | --- |');
const cell = (x) => String(x ?? '').replace(/\|/g, '\\|');
for (const key of [...new Set(findings.selfTranslated.map((x) => x.key))]) {
  const v = (lang) => findings.selfTranslated.find((x) => x.lang === lang && x.key === key)?.value;
  out.push(`| \`${key}\` | ${cell(v('EN'))} | ${cell(v('DE'))} | ${cell(v('NL'))} | ${cell(v('RO_MD'))} |`);
}
out.push('');
fs.writeFileSync(path.join(dataDir, 'ISSUES.md'), out.join('\n'), 'utf8');

console.log(`Wrote data/links.json (${links.length} days), data/source/links-diff.md (${diffs.length} differences, ${known.length} known gaps, ${checks.length} values compared), data/ISSUES.md (${n} items)`);
if (diffs.length) for (const d of diffs) console.log(' - ' + d);
