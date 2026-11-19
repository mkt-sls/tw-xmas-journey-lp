// Numeric check of the card headline (.card__amount): gradient text must not clip accents and must repeat per line.
//
//   node scripts/check-headline.mjs [--shots]     (writes qa/t6c_* at DPR 2 with --shots)
//
// For every market x date it opens today's card and measures in the page:
// - FRAGMENTS: the gradient span's getClientRects() count (one per wrapped line) and that box-decoration-break is clone,
//   so every line gets its own full gradient (same colour at the top of each line's box).
// - INK vs PAINT: with canvas measureText (same font) the real glyph ink top/bottom of every line is computed from the
//   fragment's baseline; it must lie inside the fragment's painted box (background-clip:text only paints there).
//   Also the pixels: the gradient's top colour is sampled at each line's first row of ink in a screenshot.
// - ANCESTORS: no ancestor that clips (overflow != visible / clip-path / contain: paint) may cut the ink box.
//
// NUMBERS (every market x all 26 days x widths 360/390/768/1366/1920; --skip-ink / --numbers-only to run only this part):
// every token that contains a digit ("6 000 SEK", "60 %", "x25", "23 h 59", "26 Dec") must sit on ONE line:
// the check walks each text node of the open card (+ route tags / chip / intro / how-it-works at that width), splits it on plain
// whitespace (the only places the browser may break) and compares the client-rect top of every character of a token.
// It also fails when a plain space is left inside a digit group or between a number and its currency/percent/word.
// The route shows a 5-day window, so 6 dates (Dec 3,8,13,18,23,26) bring all 26 days on screen; every visible gift is opened
// (missed, active and locked cards are all covered).
//
// FIT (T6e, --fit; widths 360/390/430/768/1024/1366/1920 unless --widths=; run ONE width per process on a small machine):
// every market x all 26 days x width, mobile and desktop card. Per card: headline <= 2 lines, balance (shortest/longest line >= 60 %
// when 2 lines), font size >= HEADLINE_MIN, ink not clipped, button label on 1 line, day pill on 1 line and clear of the close
// button, "type" label on 1 line, every text inside the card, rows: label and value do not overlap (and a wrapped row is listed).
// A headline that needs > 2 lines even at the minimum size is listed as CANNOT FIT (texts are never shortened here).
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
const SHOTS = args.includes('--shots');
const MARKETS = ['RO_MDL', 'DE', 'TR', 'RU', 'SV', 'FR_CA', 'EN_GBP'];
const DATES = ['2026-12-26', '2026-12-02'];
const WIDTHS = [390, 1366];
const NUM_WIDTHS = (args.find((a) => a.startsWith('--widths='))?.slice(9).split(',').map(Number)) || (args.includes('--fit') ? [360, 390, 430, 768, 1024, 1366, 1920] : [360, 390, 768, 1366, 1920]);
const ONLY = args.find((a) => a.startsWith('--markets='))?.slice(10).split(',');
const ALL_MARKETS = fs.readdirSync(path.join(ROOT, 'data', 'cards')).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '')).filter((m) => !ONLY || ONLY.includes(m));
const FIT = args.includes('--fit');
const HEADLINE_MIN = 28; // keep equal to src/render/fitText.js
const NUMBERS_ONLY = FIT || args.includes('--numbers-only') || args.includes('--skip-ink');

function inkProblems(m) {
  const problems = [];
  if (m.error) problems.push(m.error);
  else {
    if (!m.clone) problems.push('box-decoration-break is not clone');
    if (m.fragments !== m.lineCount) problems.push(`fragments ${m.fragments} != lines ${m.lineCount}`);
    for (const l of m.lines) {
      if (l.inkTop < l.paintTop - 0.01) problems.push(`"${l.text}" ink top ${(l.paintTop - l.inkTop).toFixed(1)}px above paint box`);
      if (l.inkBottom > l.paintBottom + 0.01) problems.push(`"${l.text}" ink bottom ${(l.inkBottom - l.paintBottom).toFixed(1)}px below paint box`);
    }
    for (const c of m.clips) if (c.cutTop || c.cutBottom || c.cutX) problems.push(`ancestor .${c.el} clips ink (top ${c.cutTop}, bottom ${c.cutBottom}, x ${c.cutX})`);
  }
  return problems;
}

/** In the page, on the open card: layout facts for the T6e rules. Returns data only; the verdict is made in node. */
function measureFit() {
  const card = document.querySelector('.card');
  const cr = card.getBoundingClientRect();
  const rng = document.createRange();
  const rectsOf = (el) => { rng.selectNodeContents(el); return [...rng.getClientRects()].filter((r) => r.width > 0.5); };
  // line boxes of an element: group the glyph rects of its text by top
  const linesOf = (el) => {
    const out = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      for (let i = 0; i < n.length; i++) {
        if (/\s/.test(n.data[i]) && n.data[i] !== ' ') continue; // plain breaking space: no ink, may trail the line
        rng.setStart(n, i); rng.setEnd(n, i + 1);
        const b = rng.getBoundingClientRect();
        if (!b.width) continue;
        let ln = out.find((l) => Math.abs(l.top - b.top) < 4);
        if (!ln) out.push((ln = { top: b.top, left: b.left, right: b.right, text: '' }));
        ln.left = Math.min(ln.left, b.left); ln.right = Math.max(ln.right, b.right); ln.text += n.data[i];
      }
    }
    return out.sort((a, b) => a.top - b.top);
  };
  const info = (el) => {
    if (!el) return null;
    const ls = linesOf(el);
    return { lines: ls.length, widths: ls.map((l) => l.right - l.left), texts: ls.map((l) => l.text), left: Math.min(...ls.map((l) => l.left)), right: Math.max(...ls.map((l) => l.right)) };
  };
  const amount = document.querySelector('.card__amount');
  const head = info(amount);
  if (head) head.full = amount.textContent;
  if (head) head.fontSize = parseFloat(getComputedStyle(amount).fontSize);
  const outside = [];
  for (const el of card.querySelectorAll('.card__type,.card__amount,.card__game,.card__opens,dt,dd,.btn-primary,.card__terms,.card__chip')) {
    const i = info(el);
    if (i && (i.left < cr.left - 0.5 || i.right > cr.right + 0.5)) outside.push(el.className || el.tagName);
  }
  const chip = document.querySelector('.card__chip');
  const close = document.querySelector('.card__close span');
  const chipR = chip.getBoundingClientRect();
  const closeR = close.getBoundingClientRect();
  const rows = [...card.querySelectorAll('.term')].map((t) => {
    const dt = t.querySelector('dt'), dd = t.querySelector('dd');
    const a = rectsOf(dt), b = rectsOf(dd);
    let overlap = false;
    for (const x of a) for (const y of b) if (x.left < y.right - 0.5 && y.left < x.right - 0.5 && x.top < y.bottom - 0.5 && y.top < x.bottom - 0.5) overlap = true;
    return { dt: info(dt), dd: info(dd), overlap, label: dt.textContent, value: dd.textContent };
  });
  const btn = card.querySelector('.btn-primary');
  return {
    layout: card.closest('.overlay').classList.contains('overlay--mobile') ? 'mobile' : 'desktop',
    cardWidth: cr.width,
    head,
    type: info(card.querySelector('.card__type')),
    game: info(card.querySelector('.card__game')),
    opens: info(card.querySelector('.card__opens')),
    button: info(btn),
    terms: info(card.querySelector('.card__terms')),
    chip: { lines: info(chip).lines, right: chipR.right, closeLeft: closeR.left, closeTop: closeR.top, closeBottom: closeR.bottom, top: chipR.top, bottom: chipR.bottom },
    rows,
    outside,
  };
}

async function measure(page) {
  return page.evaluate(() => {
    const span = document.querySelector('.card__amount-text');
    if (!span) return { error: 'no .card__amount-text' };
    const cs = getComputedStyle(span);
    const rects = [...span.getClientRects()];
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = font;
    const pad = parseFloat(cs.paddingTop);
    // text of each line: walk the text node with a Range, split by client rect top
    const tn = span.firstChild;
    const lines = [];
    const r = document.createRange();
    let cur = null;
    for (let i = 0; i < tn.length; i++) {
      r.setStart(tn, i);
      r.setEnd(tn, i + 1);
      const b = r.getBoundingClientRect();
      if (!b.width) continue;
      if (!cur || Math.abs(b.top - cur.top) > 4) {
        cur = { top: b.top, text: '' };
        lines.push(cur);
      }
      cur.text += tn.data[i];
    }
    const out = lines.map((ln, i) => {
      const rc = rects[i] || rects[rects.length - 1];
      const m = ctx.measureText(ln.text.trim());
      const baseline = rc.top + pad + m.fontBoundingBoxAscent;
      return {
        text: ln.text.trim(),
        paintTop: rc.top,
        paintBottom: rc.bottom,
        inkTop: baseline - m.actualBoundingBoxAscent,
        inkBottom: baseline + m.actualBoundingBoxDescent,
        left: rc.left,
        right: rc.right,
      };
    });
    // ancestors that clip
    const clips = [];
    for (let el = span.parentElement; el && el !== document.documentElement; el = el.parentElement) {
      const c = getComputedStyle(el);
      const clipsBox = ['hidden', 'clip', 'auto', 'scroll'].includes(c.overflowX) || ['hidden', 'clip', 'auto', 'scroll'].includes(c.overflowY) || c.clipPath !== 'none' || /paint|strict|content/.test(c.contain);
      if (clipsBox) {
        const b = el.getBoundingClientRect();
        const cutTop = out.some((l) => l.inkTop < b.top - 0.01);
        const cutBottom = out.some((l) => l.inkBottom > b.bottom + 0.01);
        const cutX = out.some((l) => l.left < b.left - 0.01 || l.right > b.right + 0.01);
        clips.push({ el: el.className || el.tagName, cutTop, cutBottom, cutX });
      }
    }
    return {
      fragments: rects.length,
      lineCount: lines.length,
      clone: cs.getPropertyValue('box-decoration-break') === 'clone',
      clip: cs.backgroundClip,
      lines: out,
      clips,
      fontSize: cs.fontSize,
    };
  });
}

/** In the page: every digit-bearing token of the given roots must be on one line, and none may hold a breakable space inside. */
function checkNumbers([roots, breakCurrency]) {
  const out = { tokens: 0, broken: [], unprotected: [] };
  const rng = document.createRange();
  const bad = /\d (?=\d{3}(?!\d))|\d (?=[%€$£₽]|\p{L})/u;
  // TR headline only (owner 2026-11-19): the plain space between the amount and a 3-letter currency code is allowed there
  const badHead = /\d (?=\d{3}(?!\d))|\d (?=[%€$£₽]|(?![A-Z]{3}(?:[’']|\P{L}|$))\p{L})/u;
  for (const sel of roots) {
    for (const root of document.querySelectorAll(sel)) {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const t = n.data;
        if (!t.trim() || !n.parentElement.getClientRects().length || getComputedStyle(n.parentElement).visibility === 'hidden') continue;
        const m = t.match(breakCurrency && n.parentElement.closest('.card__amount') ? badHead : bad);
        if (m) out.unprotected.push(t.trim());
        for (const tok of t.matchAll(/\S+/g)) {
          if (!/\d/.test(tok[0])) continue;
          out.tokens++;
          const tops = new Set();
          for (let i = tok.index; i < tok.index + tok[0].length; i++) {
            rng.setStart(n, i); rng.setEnd(n, i + 1);
            const r = rng.getClientRects()[0];
            if (r && r.width) tops.add(Math.round(r.top));
          }
          // glyphs of one line differ by < 3px at most (superscript-free text); two lines differ by a full line height
          const arr = [...tops].sort((a, b) => a - b);
          if (arr.length > 1 && arr[arr.length - 1] - arr[0] > 6) out.broken.push(tok[0].replace(/ /g, '~') + '  in  "' + t.trim().replace(/ /g, '~') + '"');
        }
      }
    }
  }
  return out;
}

/** Verdict for one card from measureFit() data + ink problems. Returns { problems, info } */
function fitVerdict(r, ink) {
  const problems = [...ink];
  const info = {};
  const h = r.head;
  if (h) {
    if (h.lines > 2) info.cannotFit = true; // listed in the CANNOT FIT summary, not a rule failure: the texts are not ours to shorten
    if (h.fontSize < HEADLINE_MIN - 0.01) problems.push(`headline font ${h.fontSize}px < min ${HEADLINE_MIN}`);
    // a line break must fall on a plain space: anything else cuts a word or a no-break unit
    for (let i = 0, cut = 0; i < h.texts.length - 1; i++) {
      cut += h.texts[i].length;
      let seen = 0, j = 0;
      for (; j < h.full.length && seen < cut; j++) if (h.full[j] !== ' ') seen++;
      if (h.full[j] !== ' ') problems.push(`word cut at line break: "${h.texts.join(' / ')}"`);
    }
    if (h.lines === 2) {
      const ratio = Math.min(...h.widths) / Math.max(...h.widths);
      info.ratio = ratio;
      if (ratio < 0.6 && !/ .* /.test(h.texts.join(' ').replace(/ /g, '~'))) info.inherent = true; // one legal break point only
      else if (ratio < 0.6) problems.push(`unbalanced ${(ratio * 100).toFixed(0)} %: "${h.texts.join(' / ')}"`);
    }
  }
  if (r.button.lines !== 1) problems.push(`button label ${r.button.lines} lines: "${r.button.texts.join(' / ')}"`);
  if (r.type && r.type.lines !== 1) problems.push(`type label ${r.type.lines} lines: "${r.type.texts.join(' / ')}"`);
  if (r.chip.lines !== 1) problems.push(`day pill ${r.chip.lines} lines`);
  if (r.chip.right > r.chip.closeLeft - 2 && r.chip.bottom > r.chip.closeTop && r.chip.top < r.chip.closeBottom) problems.push(`day pill touches close button (${(r.chip.right - r.chip.closeLeft).toFixed(1)}px)`);
  if (r.terms && r.terms.lines > 2) problems.push(`T&C link ${r.terms.lines} lines`);
  for (const k of ['game', 'opens']) if (r[k] && r[k].lines > 3) problems.push(`${k} ${r[k].lines} lines`);
  for (const o of r.outside) problems.push(`text outside card: .${o}`);
  for (const row of r.rows) {
    if (row.overlap) problems.push(`row overlap: "${row.label}" / "${row.value}"`);
    else if (row.dt.lines > 1 || row.dd.lines > 1) problems.push(`row wraps: "${row.label}" (${row.dt.lines}) / "${row.value}" (${row.dd.lines})`);
  }
  return { problems, info };
}

async function numbersRun(browser, base) {
  const fit = { cards: 0, failing: 0, one: 0, two: 0, ratioMin: 9, ratioMinCase: '', cannot: new Map(), sizes: new Map(), other: new Map() };
  let fails = 0, cards = 0, tokens = 0;
  const CARD_ROOTS = ['.card'];
  const PAGE_ROOTS = ['.label', '.intro', '.how'];
  for (const width of NUM_WIDTHS) {
    for (const market of ALL_MARKETS) {
      const ctx = await browser.newContext({ viewport: { width, height: width <= 768 ? 844 : 900 }, deviceScaleFactor: 1 });
      const page = await ctx.newPage(); // one fresh page per market: 36 opened cards in one page crashed the renderer
      // the route shows a window of a few days around today: step today through December until all 26 days have been on screen (missed, active or locked)
      const seen = new Set();
      let d = 1;
      for (let guard = 0; guard < 30 && seen.size < 26; guard++) {
        const date = `2026-12-${String(d).padStart(2, '0')}`;
        await page.goto(`${base}/?date=${date}&market=${market}`, { waitUntil: 'networkidle' });
        await page.waitForSelector('.gift--active[data-open]');
        await page.evaluate(() => document.fonts.ready);
        const pageRes = await page.evaluate(checkNumbers, [PAGE_ROOTS, false]);
        tokens += pageRes.tokens;
        const probs = [...pageRes.broken.map((b) => 'page: ' + b), ...pageRes.unprotected.map((u) => 'page plain space: ' + u)];
        const days = await page.evaluate(() => [...document.querySelectorAll(".gift[data-open]")].map((g) => +g.dataset.open));
        const fresh = days.filter((x) => !seen.has(x));
        days.forEach((x) => seen.add(x));
        d = Math.min(26, Math.max(...seen) + Math.floor(days.length / 2) + 1);
        for (const day of fresh) {
          await page.evaluate((d) => document.querySelector(`.gift[data-open="${d}"]`).click(), day);
          await page.waitForSelector('.card', { timeout: 8000 });
          await page.waitForTimeout(250);
          const r = await page.evaluate(checkNumbers, [CARD_ROOTS, market === 'TR']);
          cards++; tokens += r.tokens;
          for (const b of r.broken) probs.push(`day ${day}: ${b}`);
          for (const u of r.unprotected) probs.push(`day ${day} plain space: ${u}`);
          if (FIT) {
            await page.waitForFunction(() => !document.getAnimations().some((a) => a.effect?.getComputedTiming().iterations !== Infinity && a.playState === 'running'), null, { timeout: 5000 }).catch(() => {});
            const fr = await page.evaluate(measureFit);
            const m0 = await measure(page);
            const ink = m0.error ? [] : inkProblems(m0); // locked cards have no amount headline
            const { problems, info } = fitVerdict(fr, ink);
            fit.cards++;
            if (fr.head) { if (fr.head.lines === 1) fit.one++; else if (fr.head.lines === 2) fit.two++; }
            if (info.ratio !== undefined && info.ratio < fit.ratioMin) { fit.ratioMin = info.ratio; fit.ratioMinCase = `${market} day ${day} ${width}px "${fr.head.texts.join(' / ')}"`; }
            if (fr.head) fit.sizes.set(fr.head.fontSize, (fit.sizes.get(fr.head.fontSize) || 0) + 1);
            if (info.cannotFit) fit.cannot.set(`${market} day ${day} ${fr.layout}-card ${Math.round(fr.cardWidth)}px: "${fr.head.texts.join(' / ')}"`, fr.head.lines);
            if (problems.length) { fit.failing++; for (const p of problems) probs.push(`day ${day} ${fr.layout}: ${p}`); }
          }
          await page.evaluate(() => document.querySelector('.card [data-close]')?.click());
          await page.waitForSelector('.card', { state: 'detached', timeout: 8000 });
        }
        if (probs.length) {
          fails++;
          console.log(`FAIL ${width}px ${market} ${date}: ${[...new Set(probs)].slice(0, 6).join(' | ')}`);
        }
      }
      if (seen.size < 26) { fails++; console.log(`FAIL ${width}px ${market}: only ${seen.size}/26 days reached`); }
      await ctx.close();
    }
    console.log(`numbers ${width}px done (cumulative: ${cards} cards, ${tokens} number tokens, ${fails} failing market/date runs)`);
  }
  if (FIT) {
    console.log(`FIT: ${fit.cards} cards (${fit.failing} with problems); headline 1 line: ${fit.one}, 2 lines: ${fit.two}, >2 lines: ${fit.cannot.size}`);
    console.log(`FIT: font sizes used: ${[...fit.sizes].sort((a, b) => a[0] - b[0]).map(([k, v]) => k + 'px x' + v).join(', ')}`);
    console.log(`FIT: worst balance ${fit.ratioMin === 9 ? 'n/a' : (fit.ratioMin * 100).toFixed(0) + ' % at ' + fit.ratioMinCase}`);
    if (fit.cannot.size) { console.log('CANNOT FIT 2 lines even at the minimum size:'); for (const k of fit.cannot.keys()) console.log('  ' + k); }
  }
  console.log(`NUMBERS: ${cards} cards + page labels checked, ${tokens} number tokens, ${fails ? fails + ' FAILED market/date runs' : 'none broken across lines'}`);
  return fails;
}

async function main() {
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5199, strictPort: false } });
  await server.listen();
  const base = server.resolvedUrls.local[0].replace(/\/$/, '');
  const browser = await chromium.launch({ executablePath: CHROME });
  let fails = 0;
  try {
    for (const width of NUMBERS_ONLY ? [] : WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 768 }, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      for (const market of MARKETS) {
        for (const date of DATES) {
          await page.goto(`${base}/?date=${date}&market=${market}`, { waitUntil: 'networkidle' });
          await page.waitForSelector('.gift--active[data-open]');
          await page.evaluate(() => document.fonts.ready);
          await page.click('.gift--active[data-open]');
          await page.waitForSelector('.card__amount-text', { timeout: 8000 });
          await page.waitForTimeout(1200);
          const m = await measure(page);
          const problems = inkProblems(m);
          const tag = `${width}px ${market} ${date}`;
          console.log(`${problems.length ? 'FAIL' : 'ok  '} ${tag}: ${m.lineCount ?? '?'} line(s) ${m.lines ? m.lines.map((l) => `"${l.text}"`).join(' / ') : ''}${problems.length ? ' -> ' + problems.join('; ') : ''}`);
          if (problems.length) fails++;
          if (SHOTS) {
            const el = await page.$('.card');
            await el.screenshot({ path: path.join(ROOT, 'qa', `t6c_${width}_${market}_${date}.png`) });
          }
        }
      }
      await ctx.close();
    }
    fails += await numbersRun(browser, base);
  } finally {
    await browser.close();
    await server.close();
  }
  console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
  process.exit(fails ? 1 : 0);
}
main();
