#!/usr/bin/env node
// Reads an .xlsx export of the Top Win texts sheet and writes data/source/sheet.json
// with ONLY tab names and cell values (no owner, e-mail or other account metadata).
//
// Get the .xlsx: Google Drive MCP `download_file_content` with
//   fileId 1OfbBN6d6mei4t0iReU_ZNNVelqjQwl3fBxh-aGpzwAY and
//   exportMimeType application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
// (or File > Download > Microsoft Excel in the browser).
//
// Usage: node scripts/extract-sheet.mjs <path-to.xlsx>
// No dependencies: a minimal zip + XML reader built on node:zlib.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = process.argv[2];
if (!src) {
  console.error('Usage: node scripts/extract-sheet.mjs <path-to.xlsx>');
  process.exit(1);
}

// ---- zip ---------------------------------------------------------------------
function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Not a zip/xlsx file');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Bad central directory');
    const method = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const lNameLen = buf.readUInt16LE(local + 26);
    const lExtraLen = buf.readUInt16LE(local + 28);
    const start = local + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(start, start + csize);
    files[name] = method === 0 ? data : zlib.inflateRawSync(data);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

// ---- xml ---------------------------------------------------------------------
const unescapeXml = (s) =>
  s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

// Text of one <si> / <is>: all <t> pieces joined (rich text has several).
function textOf(xml) {
  let out = '';
  for (const m of xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += unescapeXml(m[1]);
  return out;
}

const colIndex = (ref) => {
  let n = 0;
  for (const ch of ref.replace(/\d+/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

const files = readZip(fs.readFileSync(src));
const get = (name) => {
  if (!files[name]) throw new Error('Missing in xlsx: ' + name);
  return files[name].toString('utf8');
};

const shared = files['xl/sharedStrings.xml']
  ? [...get('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]))
  : [];

const wb = get('xl/workbook.xml');
const rels = get('xl/_rels/workbook.xml.rels');
const relTarget = {};
for (const m of rels.matchAll(/<Relationship\s[^>]*>/g)) {
  const id = m[0].match(/Id="([^"]+)"/)?.[1];
  const target = m[0].match(/Target="([^"]+)"/)?.[1];
  if (id && target) relTarget[id] = target.replace(/^\/?(xl\/)?/, 'xl/');
}

const tabs = {};
for (const m of wb.matchAll(/<sheet\s[^>]*>/g)) {
  const name = unescapeXml(m[0].match(/name="([^"]*)"/)[1]);
  const rid = m[0].match(/r:id="([^"]+)"/)[1];
  const xml = get(relTarget[rid]);
  const rows = [];
  for (const r of xml.matchAll(/<row\s[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rowNum = Number(r[0].match(/\sr="(\d+)"/)[1]);
    const cells = [];
    for (const c of (r[1] || '').matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1];
      const ref = attrs.match(/\sr="([A-Z]+\d+)"|^r="([A-Z]+\d+)"/);
      const refStr = ref ? ref[1] || ref[2] : '';
      const type = attrs.match(/\bt="([^"]+)"/)?.[1];
      const body = c[2] || '';
      let val = '';
      if (type === 's') val = shared[Number(body.match(/<v>(\d+)<\/v>/)?.[1])] ?? '';
      else if (type === 'inlineStr') val = textOf(body);
      else val = unescapeXml(body.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? '');
      cells[colIndex(refStr)] = val;
    }
    rows[rowNum - 1] = Array.from(cells, (v) => v ?? '');
  }
  tabs[name] = Array.from(rows, (v) => v ?? []);
}

const outFile = path.join(root, 'data', 'source', 'sheet.json');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify({ tabs }, null, 1) + '\n', 'utf8');
console.log(
  `Wrote ${path.relative(root, outFile)}: ` + Object.entries(tabs).map(([n, r]) => `${n} (${r.length} rows)`).join(', '),
);
