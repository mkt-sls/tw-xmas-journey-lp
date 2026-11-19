#!/usr/bin/env node
// Reads the Google Drive "get_file_metadata" dump of the translation sheet
// and writes data/source/sheet.json with ONLY tab names and cell values.
// No owner, e-mail, id, permission or other account metadata is copied.
//
// Usage: node scripts/extract-sheet.mjs <path-to-dump.txt>

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dumpPath = process.argv[2];
if (!dumpPath) {
  console.error('Usage: node scripts/extract-sheet.mjs <path-to-dump.txt>');
  process.exit(1);
}

const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
const snippet = dump.contentSnippet;
if (typeof snippet !== 'string') {
  console.error('Dump has no contentSnippet text.');
  process.exit(1);
}

const problems = [];
const BACKSLASH = String.fromCharCode(92);

// The dump flattens every tab to unquoted CSV. Cells with line breaks are NOT
// quoted, so a plain CSV parser would fail. Two rules recover the cells:
//  - market tabs: a card (cell) always ends with the same "full terms" line;
//  - UI tab: one row per line, cells separated by a comma NOT followed by a space
//    (commas inside sentences are always followed by a space).
const CELL_SPLIT = /,(?! )/;

const tabsOut = {};
const sections = snippet.split(/^# /m).slice(1);

for (const section of sections) {
  const firstNl = section.indexOf('\n');
  const name = section.slice(0, firstNl).split(BACKSLASH).join('').trim();
  const fence = section.match(/```[^\n]*\n([\s\S]*?)\n```/);
  if (!fence) {
    problems.push(`Tab ${name}: no code block found`);
    continue;
  }
  const lines = fence[1].split('\n');
  const headerLine = lines.shift();

  if (name === 'UI ELEMENT') {
    tabsOut[name] = parseUiTab(headerLine, lines);
  } else {
    tabsOut[name] = parseMarketTab(name, headerLine, lines);
  }
}

function parseMarketTab(name, headerLine, lines) {
  const columns = headerLine.split(CELL_SPLIT);
  // Find the closing line of the first card: "<terms line>,<header of next card>"
  const prefix = lines[0].slice(0, 3);
  let terms = null;
  for (let i = 1; i < lines.length && terms === null; i++) {
    const l = lines[i];
    for (let k = 1; k < l.length; k++) {
      if (l[k] === ',' && l.slice(k + 1).startsWith(prefix)) {
        terms = l.slice(0, k);
        break;
      }
    }
  }
  if (terms === null) {
    problems.push(`Tab ${name}: cannot find the card terminator line`);
    return { columns, rows: [] };
  }
  const cards = [];
  let cur = [];
  for (const l of lines) {
    if (l === terms) {
      cards.push(cur.concat(l).join('\n'));
      cur = [];
    } else if (l.startsWith(terms + ',')) {
      cards.push(cur.concat(terms).join('\n'));
      cur = [l.slice(terms.length + 1)];
    } else {
      cur.push(l);
    }
  }
  if (cur.some((x) => x.trim() !== '')) {
    problems.push(`Tab ${name}: ${cur.length} leftover lines after last card`);
  }
  if (cards.length !== 104) {
    problems.push(`Tab ${name}: expected 104 cards (26 days x 4), got ${cards.length}`);
  }
  const rows = [];
  for (let i = 0; i + 3 < cards.length; i += 4) rows.push(cards.slice(i, i + 4));
  return { columns, rows };
}

function parseUiTab(headerLine, lines) {
  const out = {
    main: { columns: headerLine.split(CELL_SPLIT), rows: [] },
    cta: { columns: [], rows: [] },
    extra: { columns: [], rows: [] },
  };
  let block = 'main';
  for (const l of lines) {
    if (l.trim() === '') continue;
    if (l.startsWith('UI element,')) {
      block = 'cta';
      out.cta.columns = l.split(CELL_SPLIT);
      continue;
    }
    if (l.startsWith('English source,')) {
      block = 'extra';
      out.extra.columns = l.split(CELL_SPLIT);
      continue;
    }
    const cells = l.split(CELL_SPLIT);
    const expected = { main: 15, cta: 14, extra: 13 }[block];
    if (cells.length !== expected && cells.length !== 1) {
      problems.push(`UI ELEMENT (${block}): row "${cells.slice(0, 2).join(' | ')}" has ${cells.length} cells, expected ${expected}`);
    }
    out[block].rows.push(cells);
  }
  return out;
}

if (problems.length) {
  console.error('Problems while extracting:');
  for (const p of problems) console.error(' - ' + p);
  process.exit(2);
}

const outFile = path.join(root, 'data', 'source', 'sheet.json');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify({ tabs: tabsOut }, null, 1) + '\n', 'utf8');
const names = Object.keys(tabsOut);
console.log(`Wrote ${path.relative(root, outFile)}: ${names.length} tabs (${names.join(', ')})`);
