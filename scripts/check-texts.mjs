// Numeric check of EVERY visible text of the page (T6e addition, owner 2026-11-19). Nothing is hand-listed: the texts are discovered from the DOM.
//
//   node scripts/check-texts.mjs --widths=390 [--markets=TR,RU] [--out=DIR]
//
// Run ONE width per process on a small machine (about 6 minutes per width for 15 markets x 26 days).
// For every market x day 1-26 x width it collects, from the rendered page and from the opened card (and the market menu):
//   every element that owns visible text (header, intro, route labels / chips / countdown, how-it-works steps, footer,
//   card: day pill, type, headline, game line, term rows, CTA button, T&C link, market menu rows ...)
// and checks, per element, by numbers:
//   overflow-x          scrollWidth > clientWidth (block-level box that is not meant to scroll)
//   outside-container   text box sticks out of its own box, or out of the card / the viewport
//   ink-clipped         glyph ink (canvas measureText ascent/descent from the baseline) is cut by a clipping ancestor
//                       (overflow hidden/clip, clip-path, contain: paint) or lies outside the gradient paint box (background-clip:text)
//   word-cut            a line break inside a word with no space / hyphen at the break
//   number-split        a token with a digit ("6 000 SEK", "60 %", "23 h 59", "1-26") on two lines
//   number-unprotected  a plain (breakable) space inside a digit group or between a number and its unit
//                       (exception: the Turkish card headline amount / 3-letter currency code, owner decision 2026-11-19)
//   overlap-text        two text lines of different elements overlap
//   overlap-button      a text line overlaps a button / link box it is not inside of
// Output: a summary table (element type x market -> fail count) and texts-failures-w<width>.json (one entry per failure:
// market, day, width, scope, selector, text, rule, measured values). Playwright is not a project dependency: PLAYWRIGHT_MODULE / CHROME as in check-headline.mjs.
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
const arg = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const WIDTHS = (arg('widths') || '360,390,430,768,1024,1366,1920').split(',').map(Number);
const ONLY = arg('markets')?.split(',');
const OUT = arg('out') || process.cwd();
const ALL_MARKETS = fs
  .readdirSync(path.join(ROOT, 'data', 'cards'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace('.json', ''))
  .filter((m) => !ONLY || ONLY.includes(m));

/** Runs in the page. scope: CSS selector of the root to walk; exclude: selector of subtrees to skip. */
function collectTexts({ scope, exclude, market }) {
  const root = document.querySelector(scope);
  if (!root) return { error: `no ${scope}`, count: 0, fails: [] };
  const vw = document.documentElement.clientWidth;
  const rng = document.createRange();
  const ctx = document.createElement('canvas').getContext('2d');
  const fails = [];
  const owners = []; // { el, lines: [{l,t,r,b}], sel, type }
  const CLIPS = ['hidden', 'clip'];

  const selOf = (el) => {
    const part = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + ([...e.classList].slice(0, 2).map((c) => '.' + c).join(''));
    const chain = [];
    for (let e = el, i = 0; e && e !== document.body && i < 3; e = e.parentElement, i++) chain.unshift(part(e));
    return chain.join(' > ');
  };
  const typeOf = (el) => (el.classList[0] ? '.' + el.classList[0] : el.tagName.toLowerCase());
  const hiddenEl = (el) => {
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const c = getComputedStyle(e);
      if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0 || e.hasAttribute('hidden')) return true;
      if (/rect\(0(px)?,? 0(px)?,? 0(px)?,? 0(px)?\)/.test(c.clip) || (c.clipPath === 'inset(50%)')) return true; // visually-hidden (sr-only) text
    }
    return false;
  };
  const add = (o, rule, text, values) => fails.push({ selector: o.sel, type: o.type, text: text.replace(/\u00a0/g, '~').replace(/\u2060/g, '').slice(0, 120), rule, values });

  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const byOwner = new Map();
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (!n.data.trim()) continue;
    const el = n.parentElement;
    if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TITLE'].includes(el.tagName)) continue;
    if (exclude && el.closest(exclude)) continue;
    if (!el.getClientRects().length || hiddenEl(el)) continue;
    if (!byOwner.has(el)) byOwner.set(el, []);
    byOwner.get(el).push(n);
  }

  const container = root.closest('.card') || null;
  const cr = container ? container.getBoundingClientRect() : null;
  const scroller = (el) => {
    for (let e = el.parentElement; e && e !== document.documentElement; e = e.parentElement) {
      const c = getComputedStyle(e);
      if (['auto', 'scroll'].includes(c.overflowX)) return e;
    }
    return null;
  };

  for (const [el, nodes] of byOwner) {
    const cs = getComputedStyle(el);
    const o = { el, sel: selOf(el), type: typeOf(el), lines: [] };
    const inHeadline = !!el.closest('.card__amount');
    const unprotectedRe = market === 'TR' && inHeadline
      ? /\d (?=\d{3}(?!\d))|\d (?=[%€$£₽]|(?![A-Z]{3}(?:[’']|\P{L}|$))\p{L})/u
      : /\d (?=\d{3}(?!\d))|\d (?=[%€$£₽]|\p{L})/u;
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const tx = (s) => (cs.textTransform === 'uppercase' ? s.toUpperCase() : cs.textTransform === 'lowercase' ? s.toLowerCase() : s);
    const paintClip = (cs.webkitBackgroundClip || cs.backgroundClip) === 'text';
    const own = el.getBoundingClientRect();
    // scrolled out of its own scroll area (a long list scrolled to the selected row): not visible by design
    let scrolledOut = false;
    for (let q = el.parentElement; q && q !== document.documentElement; q = q.parentElement) {
      if (!['auto', 'scroll'].includes(getComputedStyle(q).overflowY)) continue;
      const qb = q.getBoundingClientRect();
      if (own.bottom <= qb.top + 0.5 || own.top >= qb.bottom - 0.5) scrolledOut = true;
    }
    if (scrolledOut) continue;
    let minL = 1e9, maxR = -1e9;

    for (const n of nodes) {
      const t = n.data;
      // per character rects (only chars with ink / width); group by line
      const chars = [];
      for (let i = 0; i < t.length; i++) {
        rng.setStart(n, i); rng.setEnd(n, i + 1);
        const b = rng.getBoundingClientRect();
        if (!b.width) continue;
        chars.push({ i, l: b.left, r: b.right, t: b.top, b: b.bottom });
      }
      if (!chars.length) continue;
      const lines = [];
      for (const c of chars) {
        let ln = lines.find((x) => Math.abs(x.t - c.t) < 4);
        if (!ln) lines.push((ln = { t: c.t, b: c.b, l: c.l, r: c.r, from: c.i, to: c.i, first: c.i }));
        ln.l = Math.min(ln.l, c.l); ln.r = Math.max(ln.r, c.r); ln.b = Math.max(ln.b, c.b); ln.to = Math.max(ln.to, c.i); ln.from = Math.min(ln.from, c.i);
      }
      lines.sort((a, b) => a.t - b.t);
      // paint fragments of the element (inline gradient text) for the ink-vs-paint rule
      const frags = [...el.getClientRects()];
      lines.forEach((ln, k) => {
        const text = t.slice(ln.from, ln.to + 1).trim();
        o.lines.push({ l: ln.l, t: ln.t, r: ln.r, b: ln.b });
        minL = Math.min(minL, ln.l); maxR = Math.max(maxR, ln.r);
        // ink box: baseline from the font ascent, extent from the measured glyphs of THIS line
        const m = ctx.measureText(tx(text));
        const baseline = ln.t + (ln.b - ln.t - (m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)) / 2 + m.fontBoundingBoxAscent;
        const ink = { top: baseline - m.actualBoundingBoxAscent, bottom: baseline + m.actualBoundingBoxDescent, left: ln.l, right: ln.r };
        if (paintClip && frags.length) {
          const f = frags[Math.min(k, frags.length - 1)];
          if (ink.top < f.top - 0.01 || ink.bottom > f.bottom + 0.01) add(o, 'ink-clipped', text, { by: 'gradient paint box', inkTop: +ink.top.toFixed(1), inkBottom: +ink.bottom.toFixed(1), paintTop: +f.top.toFixed(1), paintBottom: +f.bottom.toFixed(1) });
        }
        for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
          const c = getComputedStyle(a);
          const clips = CLIPS.includes(c.overflowX) || CLIPS.includes(c.overflowY) || c.clipPath !== 'none' || /paint|strict|content/.test(c.contain);
          if (!clips) continue;
          const bb = a.getBoundingClientRect();
          if (ink.bottom < bb.top || ink.top > bb.bottom || ink.right < bb.left || ink.left > bb.right) continue; // fully outside: not visible by design, not a cut
          const cutTop = bb.top - ink.top, cutBottom = ink.bottom - bb.bottom, cutL = bb.left - ink.left, cutR = ink.right - bb.right;
          if (cutTop > 0.5 || cutBottom > 0.5 || cutL > 0.5 || cutR > 0.5)
            add(o, 'ink-clipped', text, { by: selOf(a), cutTop: +cutTop.toFixed(1), cutBottom: +cutBottom.toFixed(1), cutLeft: +cutL.toFixed(1), cutRight: +cutR.toFixed(1) });
        }
      });

      // word cut: a break between two lines must sit on whitespace or after a hyphen
      if (lines.length > 1 && cs.hyphens !== 'auto') {
        for (let k = 0; k < lines.length - 1; k++) {
          const a = lines[k].to, b = lines[k + 1].from;
          const gap = t.slice(a + 1, b + 0);
          const ok = /[ \t\n]/.test(gap) || /[-\u2010\u00ad]/.test(t[a]) || /[ \t\n]/.test(t[a]);
          if (!ok) add(o, 'word-cut', t.trim(), { break: `${t.slice(Math.max(0, a - 6), a + 1)} | ${t.slice(b, b + 6)}` });
        }
      }
      // numbers + units: a token with a digit on two lines, or a plain space left inside it
      const um = t.match(unprotectedRe);
      if (um) add(o, 'number-unprotected', t.trim(), { at: t.slice(Math.max(0, um.index - 4), um.index + 8) });
      if (lines.length > 1) {
        for (const tok of t.matchAll(/[^\s]+/g)) {
          if (!/\d/.test(tok[0])) continue;
          const tops = new Set();
          for (const c of chars) if (c.i >= tok.index && c.i < tok.index + tok[0].length) tops.add(Math.round(c.t));
          const arr = [...tops].sort((x, y) => x - y);
          if (arr.length > 1 && arr[arr.length - 1] - arr[0] > 6) add(o, 'number-split', tok[0], { in: t.trim().slice(0, 60) });
        }
      }
    }
    if (!o.lines.length) continue;

    // overflow-x of the owner box and of its text box
    const block = !['inline', 'contents'].includes(cs.display);
    if (block && !['auto', 'scroll'].includes(cs.overflowX) && el.scrollWidth > el.clientWidth + 1) add(o, 'overflow-x', el.textContent.trim(), { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth });
    if (block && (minL < own.left - 1 || maxR > own.right + 1)) add(o, 'outside-container', el.textContent.trim(), { by: 'own box', textLeft: +minL.toFixed(1), textRight: +maxR.toFixed(1), boxLeft: +own.left.toFixed(1), boxRight: +own.right.toFixed(1) });
    if (cr && (minL < cr.left - 0.5 || maxR > cr.right + 0.5)) add(o, 'outside-container', el.textContent.trim(), { by: 'card', textLeft: +minL.toFixed(1), textRight: +maxR.toFixed(1), cardLeft: +cr.left.toFixed(1), cardRight: +cr.right.toFixed(1) });
    if (!scroller(el) && (minL < -0.5 || maxR > vw + 0.5)) add(o, 'outside-container', el.textContent.trim(), { by: 'viewport', textLeft: +minL.toFixed(1), textRight: +maxR.toFixed(1), viewport: vw });
    owners.push(o);
  }

  // overlaps: text line vs text line of another element; text line vs button / link box it is not inside of
  const boxes = [...root.querySelectorAll('button, a[href], [role="button"]')].filter((b) => b.getClientRects().length && !hiddenEl(b) && !(exclude && b.closest(exclude)));
  const hit = (a, b) => Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 1;
  const fmt = (r) => `${r.l.toFixed(0)},${r.t.toFixed(0)}-${r.r.toFixed(0)},${r.b.toFixed(0)}`;
  for (let i = 0; i < owners.length; i++) {
    const a = owners[i];
    for (let j = i + 1; j < owners.length; j++) {
      const b = owners[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      for (const la of a.lines) for (const lb of b.lines) if (hit(la, lb)) add(a, 'overlap-text', a.el.textContent.trim(), { with: b.sel, withText: b.el.textContent.trim().slice(0, 40), a: fmt(la), b: fmt(lb) });
    }
    for (const bx of boxes) {
      if (bx.contains(a.el) || a.el.contains(bx)) continue; // a link inside the paragraph that owns the text is part of that text
      // one box per line fragment: an inline link that wraps is not one big rectangle
      for (const r of bx.getClientRects()) {
        const rr = { l: r.left, t: r.top, r: r.right, b: r.bottom };
        for (const la of a.lines) if (hit(la, rr)) add(a, 'overlap-button', a.el.textContent.trim(), { with: selOf(bx), a: fmt(la), button: fmt(rr) });
      }
    }
  }
  return { count: owners.length, fails };
}

const failures = []; // { market, day, width, scope, selector, type, text, rule, values }
const seenKey = new Set();
const counts = new Map(); // `${type}|${market}` -> fail count
const owned = new Map(); // market -> checked element count
let checked = 0;

function record(market, day, width, scope, res) {
  if (res.error) { failures.push({ market, day, width, scope, selector: scope, type: 'scope', text: '', rule: 'no-scope', values: { error: res.error } }); return; }
  checked += res.count;
  owned.set(market, (owned.get(market) || 0) + res.count);
  for (const f of res.fails) {
    const key = [market, width, scope, f.selector, f.text, f.rule, scope === 'page' ? '' : day].join('|');
    if (seenKey.has(key)) continue; // page-level texts repeat on every date step: count once
    seenKey.add(key);
    failures.push({ market, day, width, scope, ...f });
    counts.set(`${f.type}|${market}`, (counts.get(`${f.type}|${market}`) || 0) + 1);
  }
}

async function main() {
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5197, strictPort: false } });
  await server.listen();
  const base = server.resolvedUrls.local[0].replace(/\/$/, '');
  const browser = await chromium.launch({ executablePath: CHROME });
  try {
    for (const width of WIDTHS) {
      const before = failures.length;
      for (const market of ALL_MARKETS) {
        const ctx = await browser.newContext({ viewport: { width, height: width <= 768 ? 844 : 900 }, deviceScaleFactor: 1 });
        const page = await ctx.newPage();
        const seen = new Set();
        let d = 1, first = true;
        for (let guard = 0; guard < 30 && seen.size < 26; guard++) {
          const date = `2026-12-${String(d).padStart(2, '0')}`;
          await page.goto(`${base}/?date=${date}&market=${market}`, { waitUntil: 'networkidle' });
          await page.waitForSelector('.gift--active[data-open]');
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(300);
          record(market, d, width, 'page', await page.evaluate(collectTexts, { scope: 'body', exclude: '.overlay, [hidden]', market }));
          if (first) {
            first = false;
            await page.click('#market-btn');
            await page.waitForTimeout(250);
            await page.waitForFunction(() => !document.getAnimations().some((a) => a.effect?.getComputedTiming().iterations !== Infinity && a.playState === 'running'), null, { timeout: 5000 }).catch(() => {});
            record(market, d, width, 'market-menu', await page.evaluate(collectTexts, { scope: '.market__list', exclude: null, market }));
            await page.keyboard.press('Escape');
            await page.waitForTimeout(150);
          }
          const days = await page.evaluate(() => [...document.querySelectorAll('.gift[data-open]')].map((g) => +g.dataset.open));
          const fresh = days.filter((x) => !seen.has(x));
          days.forEach((x) => seen.add(x));
          d = Math.min(26, Math.max(...seen) + Math.floor(days.length / 2) + 1);
          for (const day of fresh) {
            await page.evaluate((x) => document.querySelector(`.gift[data-open="${x}"]`).click(), day);
            await page.waitForSelector('.card', { timeout: 8000 });
            await page.waitForTimeout(250);
            await page.waitForFunction(() => !document.getAnimations().some((a) => a.effect?.getComputedTiming().iterations !== Infinity && a.playState === 'running'), null, { timeout: 5000 }).catch(() => {});
            record(market, day, width, 'card', await page.evaluate(collectTexts, { scope: '.card', exclude: null, market }));
            await page.evaluate(() => document.querySelector('.card [data-close]')?.click());
            await page.waitForSelector('.card', { state: 'detached', timeout: 8000 });
          }
        }
        if (seen.size < 26) failures.push({ market, day: null, width, scope: 'run', selector: '', type: 'run', text: '', rule: 'days-missing', values: { reached: seen.size } });
        await ctx.close();
      }
      console.log(`width ${width}px done: ${failures.length - before} failures, ${checked} text elements checked so far`);
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, `texts-failures-w${width}.json`), JSON.stringify(failures.filter((f) => f.width === width), null, 1));
    }
  } finally {
    await browser.close();
    await server.close();
  }
  // summary: element type x market -> fails
  const types = [...new Set([...counts.keys()].map((k) => k.split('|')[0]))].sort();
  console.log(`\nSUMMARY (${checked} text elements checked, ${failures.length} failures, widths ${WIDTHS.join('/')}; rows = element type, columns = market)`);
  console.log(['type'.padEnd(28), ...ALL_MARKETS.map((m) => m.slice(0, 6).padStart(6))].join(' '));
  for (const t of types) console.log([t.padEnd(28), ...ALL_MARKETS.map((m) => String(counts.get(`${t}|${m}`) || '.').padStart(6))].join(' '));
  const byRule = new Map();
  for (const f of failures) byRule.set(f.rule, (byRule.get(f.rule) || 0) + 1);
  console.log('by rule: ' + ([...byRule].map(([k, v]) => `${k} ${v}`).join(', ') || 'none'));
  process.exit(failures.length ? 1 : 0);
}
main();
