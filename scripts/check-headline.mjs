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
const NUM_WIDTHS = (args.find((a) => a.startsWith('--widths='))?.slice(9).split(',').map(Number)) || [360, 390, 768, 1366, 1920];
const ALL_MARKETS = fs.readdirSync(path.join(ROOT, 'data', 'cards')).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
const NUMBERS_ONLY = args.includes('--numbers-only') || args.includes('--skip-ink');

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
function checkNumbers(roots) {
  const out = { tokens: 0, broken: [], unprotected: [] };
  const rng = document.createRange();
  const bad = /\d (?=\d{3}(?!\d))|\d (?=[%€$£₽]|\p{L})/u;
  for (const sel of roots) {
    for (const root of document.querySelectorAll(sel)) {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        const t = n.data;
        if (!t.trim() || !n.parentElement.getClientRects().length || getComputedStyle(n.parentElement).visibility === 'hidden') continue;
        const m = t.match(bad);
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

async function numbersRun(browser, base) {
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
        const pageRes = await page.evaluate(checkNumbers, PAGE_ROOTS);
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
          const r = await page.evaluate(checkNumbers, CARD_ROOTS);
          cards++; tokens += r.tokens;
          for (const b of r.broken) probs.push(`day ${day}: ${b}`);
          for (const u of r.unprotected) probs.push(`day ${day} plain space: ${u}`);
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
          const tag = `${width}px ${market} ${date}`;
          console.log(`${problems.length ? 'FAIL' : 'ok  '} ${tag}: ${m.lineCount ?? '?'} line(s) ${m.lines ? m.lines.map((l) => `"${l.text}"`).join(' / ') : ''}${problems.length ? ' -> ' + problems.join('; ') : ''}`);
          if (problems.length) fails++;
          if (SHOTS) {
            const el = await page.$('.card');
            await el.screenshot({ path: path.join(ROOT, 'qa', `t6c_${width}_${market}_${date}.png`) });
          }
        }
      }
      if (seen.size < 26) { fails++; console.log(`FAIL ${width}px ${market}: only ${seen.size}/26 days reached`); }
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
