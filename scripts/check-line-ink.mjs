// Line-ink check (Step 7): the ink of line N+1 must never touch the ink of line N.
//
//   node scripts/check-line-ink.mjs [--widths=320,360,...] [--markets=DE,NL,EN_GBP,PL,RO_MDL] [--min-gap=3] [--all-dates] [--page-only] [--quiet]
//
// Why: scripts/check-headline.mjs only compares the ink of a line with its OWN paint box. Tight line spacing (Figma: the mobile "JOURNEY"
// box starts 4px above the bottom of the "CHRISTMAS" box) is fine for English capitals, but an accent over a capital ("Ă" in RO "CRĂCIUN",
// "Ä Ö Ü" in DE, "Â Î Ș Ț") reaches up into the line above.
//
// What it does, per market x width x page state (the page itself with today = several dates, and every opened gift card of all 26 days:
// active / expired / locked):
// 1. every visible text node of the page (or of the open card) is split into LINES with a Range per character (client-rect top);
// 2. per line, with canvas measureText of the line's text (text-transform applied, the element's font): ink top / ink bottom relative to the
//    baseline (fontBoundingBoxAscent of the glyphs' font puts the baseline inside the line's client rect; zoom/transform scale is read from the rect height);
// 3. every pair of lines that sit directly above one another (x ranges overlap, next baseline within 2.5 line heights) must have
//    inkTop(N+1) - inkBottom(N) >= --min-gap (default 3px at 1x).
// A pair is "wrap" when both lines belong to the same element or sibling spans of one block (same headline wrapping / the 2 title parts), "stack" otherwise
// (label tag over the place name ...). Both fail the check.
//
// Playwright is not a project dependency: PLAYWRIGHT_MODULE / CHROME as in scripts/check-santa.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const PW =
  process.env.PLAYWRIGHT_MODULE ||
  path.join(process.env.LOCALAPPDATA || '', 'npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright/index.mjs');
const CHROME =
  process.env.CHROME ||
  [
    path.join(process.env.LOCALAPPDATA || '', 'ms-playwright/chromium-1248/chrome-win64/chrome.exe'),
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ].find((p) => fs.existsSync(p));
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  ({ chromium } = await import(pathToFileURL(PW).href));
}

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const WIDTHS = opt('widths', '320,360,375,390,414,1024,1440,1920').split(',').map(Number);
const MARKETS = opt('markets', 'DE,NL,EN_GBP,PL,RO_MDL').split(',');
const MIN_GAP = Number(opt('min-gap', '3'));
const ALL_DATES = args.includes('--all-dates');
const PAGE_ONLY = args.includes('--page-only');
const QUIET = args.includes('--quiet');

/** In the page: all text lines (with ink boxes) of `rootSel` (or the whole page minus the open card), then the pairs below MIN_GAP. */
function measureLines([rootSel, minGap]) {
  const cv = document.createElement('canvas').getContext('2d');
  const root = rootSel ? document.querySelector(rootSel) : document.body;
  const skipCard = !rootSel;
  if (!root) return { lines: 0, pairs: 0, wrapBlocks: 0, bad: [], missing: true };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const lines = [];
  const rng = document.createRange();
  const label = (el) => {
    const parts = [];
    for (let e = el, n = 0; e && e !== document.body && n < 3; e = e.parentElement, n++) parts.push(e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : ''));
    return parts.join('<');
  };
  let nodeId = 0;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!n.data.trim() || !el) continue;
    if (skipCard && el.closest('.card, .overlay')) continue;
    if (el.closest('script, style, noscript, [hidden]') || !el.getClientRects().length) continue;
    let hid = false;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const c = getComputedStyle(e);
      if (c.visibility === 'hidden' || c.display === 'none' || Number(c.opacity) === 0) { hid = true; break; }
      if (c.overflow !== 'visible' && e.getBoundingClientRect().width <= 2) { hid = true; break; } // visually hidden (sr-only) text
    }
    if (hid) continue;
    const cs = getComputedStyle(el);
    const size = Number.parseFloat(cs.fontSize);
    cv.font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`;
    const upper = cs.textTransform === 'uppercase';
    // lines of this text node
    const nodeLines = [];
    let cur = null;
    for (let i = 0; i < n.length; i++) {
      rng.setStart(n, i);
      rng.setEnd(n, i + 1);
      const b = rng.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      if (!cur || Math.abs(b.top - cur.top) > size * 0.5) {
        cur = { top: b.top, bottom: b.bottom, left: b.left, right: b.right, text: '' };
        nodeLines.push(cur);
      }
      cur.left = Math.min(cur.left, b.left);
      cur.right = Math.max(cur.right, b.right);
      cur.text += n.data[i];
    }
    const id = nodeId++;
    nodeLines.forEach((ln, idx) => {
      let t = ln.text.trim();
      if (!t) return;
      if (upper) t = t.toUpperCase();
      const m = cv.measureText(t);
      const asc = m.fontBoundingBoxAscent;
      const desc = m.fontBoundingBoxDescent;
      const s = (ln.bottom - ln.top) / (asc + desc || 1); // screen scale (transforms / page zoom)
      const base = ln.top + asc * s;
      lines.push({
        id,
        idx,
        el: label(el),
        elNode: null,
        text: t,
        left: ln.left,
        right: ln.right,
        base,
        size: size * s,
        inkTop: base - m.actualBoundingBoxAscent * s,
        inkBottom: base + m.actualBoundingBoxDescent * s,
        block: (() => { let e = el; while (e.parentElement && getComputedStyle(e).display === 'inline') e = e.parentElement; return e; })(),
      });
    });
  }
  const sameBlock = (a, b) => a.block === b.block || a.block.parentElement === b.block.parentElement && /^H[1-6]$/.test(a.block.parentElement.tagName) || a.block.parentElement === b.block || b.block.parentElement === a.block;
  const bad = [];
  let pairs = 0;
  let multi = 0;
  const wrapNodes = new Set();
  for (const a of lines) {
    for (const b of lines) {
      if (a === b || b.base <= a.base + 0.5) continue;
      const overlap = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      if (overlap < 1) continue;
      if (b.base - a.base > 2.5 * Math.max(a.size, b.size)) continue;
      // only the NEXT line below: skip when a third line sits between them
      if (lines.some((c) => c !== a && c !== b && c.base > a.base + 0.5 && c.base < b.base - 0.5 && Math.min(a.right, c.right) - Math.max(a.left, c.left) > 1 && Math.min(b.right, c.right) - Math.max(b.left, c.left) > 1)) continue;
      pairs++;
      const kind = sameBlock(a, b) ? 'wrap' : 'stack';
      if (kind === 'wrap') wrapNodes.add(a.block);
      const gap = b.inkTop - a.inkBottom;
      if (gap < minGap - 0.001) bad.push({ kind, gap: Math.round(gap * 10) / 10, a: a.text, b: b.text, ea: a.el, eb: b.el, sizeA: Math.round(a.size * 10) / 10 });
    }
  }
  return { lines: lines.length, pairs, wrapBlocks: wrapNodes.size, bad };
}

const stats = { configs: 0, lines: 0, pairs: 0, wrapBlocks: 0, bad: 0 };
const agg = new Map(); // key -> { n, minGap, first }
function record(tag, res) {
  if (res.missing) { console.log(`WARN ${tag}: root not found`); stats.missing = (stats.missing || 0) + 1; return; }
  stats.configs++;
  stats.lines += res.lines;
  stats.pairs += res.pairs;
  stats.wrapBlocks += res.wrapBlocks;
  for (const b of res.bad) {
    stats.bad++;
    const key = `${b.kind} ${b.ea} / ${b.eb}: "${b.a}" / "${b.b}"`;
    const e = agg.get(key) ?? { n: 0, minGap: 99, first: tag };
    e.n++;
    e.minGap = Math.min(e.minGap, b.gap);
    agg.set(key, e);
  }
  if (res.bad.length && !QUIET) console.log(`FAIL ${tag}: ${res.bad.slice(0, 3).map((b) => `${b.kind} "${b.a}"/"${b.b}" gap ${b.gap}`).join(' | ')}${res.bad.length > 3 ? ` (+${res.bad.length - 3})` : ''}`);
}

async function main() {
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5197, strictPort: false, fs: { strict: false } } });
  await server.listen();
  const base = server.resolvedUrls.local[0].replace(/\/$/, '');
  const browser = await chromium.launch({ executablePath: CHROME });
  try {
    for (const width of WIDTHS) {
      for (const market of MARKETS) {
        const ctx = await browser.newContext({ viewport: { width, height: width <= 768 ? 844 : 900 }, deviceScaleFactor: 1 });
        const page = await ctx.newPage();
        const seen = new Set();
        const dates = ALL_DATES ? Array.from({ length: 26 }, (_, i) => i + 1) : null;
        let d = 1;
        for (let guard = 0; guard < 40; guard++) {
          if (dates) { if (!dates.length) break; d = dates.shift(); } else if (seen.size >= 26) break;
          const date = `2026-12-${String(d).padStart(2, '0')}`;
          await page.goto(`${base}/?date=${date}&market=${market}`, { waitUntil: 'networkidle' });
          await page.waitForSelector('.gift--active[data-open]');
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(150);
          record(`page ${market} ${width}px ${date}`, await page.evaluate(measureLines, [null, MIN_GAP]));
          const days = await page.evaluate(() => [...document.querySelectorAll('.gift[data-open]')].map((g) => +g.dataset.open));
          const fresh = days.filter((x) => !seen.has(x));
          days.forEach((x) => seen.add(x));
          if (!dates) d = Math.min(26, Math.max(...seen) + Math.floor(days.length / 2) + 1);
          if (PAGE_ONLY) continue;
          for (const day of fresh) {
            await page.evaluate((x) => document.querySelector(`.gift[data-open="${x}"]`).click(), day);
            await page.waitForSelector('.card', { timeout: 8000 });
            await page.waitForTimeout(250);
            await page.waitForFunction(() => !document.getAnimations().some((a) => a.effect?.getComputedTiming().iterations !== Infinity && a.playState === 'running'), null, { timeout: 5000 }).catch(() => {});
            record(`card ${market} ${width}px day ${day} (today ${date})`, await page.evaluate(measureLines, ['.card', MIN_GAP]));
            await page.evaluate(() => document.querySelector('.card [data-close]')?.click());
            await page.waitForSelector('.card', { state: 'detached', timeout: 8000 });
          }
        }
        await ctx.close();
      }
      console.log(`width ${width} done: ${stats.configs} states, ${stats.bad} touching pairs so far`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
  console.log(`\nLINE-INK: ${stats.configs} states (page + cards), ${stats.lines} text lines, ${stats.pairs} line pairs (${stats.wrapBlocks} multi-line blocks counted per state), min gap ${MIN_GAP}px`);
  console.log(`LINE-INK: ${stats.bad} FAILING pairs in ${agg.size} distinct places`);
  for (const [k, v] of [...agg].sort((a, b) => a[1].minGap - b[1].minGap)) console.log(`  gap ${v.minGap}px x${v.n}  ${k}  (first: ${v.first})`);
  console.log(stats.bad ? '\nFAIL' : '\nALL PASS');
  process.exit(stats.bad ? 1 : 0);
}
main();
