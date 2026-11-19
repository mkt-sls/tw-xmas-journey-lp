// Numeric check of the MOBILE header and the today label (Step 6).
//
//   node scripts/check-header.mjs                      header: every market x widths 320/360/375/390/414/430
//   node scripts/check-header.mjs --labels             also: today label on every day 1-26 (margin, clipping, overlaps)
//   node scripts/check-header.mjs --shots <outDir>     also: screenshots (header crops, mobile 390, desktop 1920; ?date=2026-12-07)
//   --widths=320,360  --markets=DE,NL  to narrow the run
//
// HEADER, per market x width (the page is loaded once per market, then the viewport is resized):
// - logo, flag button, LOG IN, REGISTER all inside the viewport with >= 8px to each edge, no two boxes overlap, gap >= 2px;
// - button text not clipped (scrollWidth <= clientWidth) and on one line; button font >= 11px; every box >= 36px high;
// - no horizontal page scroll.
// LABELS (--labels): the label of today's gift (.label--active) for each day 1-26 and, on top of the header rules, every label:
// - label box >= 8px from both screen edges and the "open gift" button text not clipped and inside its label;
// - the active label does not overlap its own gift, the TODAY pill or the other labels.
// TITLE (--title): pixel check of the orange title part at 1024/1366/1920 (RO "CRĂCIUN" has the accent above the cap height): the lowest and highest
// orange pixel of a screenshot must lie inside the part's paint box (background-clip:text paints only there), and the ink must not touch an edge.
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
const opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const WIDTHS = (opt('widths') || '320,360,375,390,414,430').split(',').map(Number);
const MARKETS = (opt('markets') || 'DE,NL,EN_GBP,RO_MDL').split(',');
const LABELS = args.includes('--labels');
const TITLE = args.includes('--title');
const SHOTS = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const EDGE = 8;
const MIN_FONT = 11;
const MIN_H = 36;

/** In the page: boxes and text facts of the header. */
function measureHeader() {
  const vw = document.documentElement.clientWidth;
  const q = (s) => document.querySelector(s);
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, h: r.height };
  };
  const out = { vw, scrollW: document.documentElement.scrollWidth, items: {} };
  const defs = { logo: '.header__logo img', flag: '.market__btn', login: '.btn-outline', register: '.btn-register' };
  for (const [k, sel] of Object.entries(defs)) {
    const el = q(sel);
    const b = box(el);
    const cs = getComputedStyle(el);
    const item = { ...b, font: Number.parseFloat(cs.fontSize) };
    if (k === 'login' || k === 'register') {
      // the text itself: its range must fit inside the content box of the button
      const rng = document.createRange();
      rng.selectNodeContents(el);
      const t = rng.getBoundingClientRect();
      item.textLeft = t.left;
      item.textRight = t.right;
      item.clipped = el.scrollWidth > el.clientWidth + 0.5 || t.left < b.left || t.right > b.right;
      item.lines = rng.getClientRects().length;
      item.text = el.textContent;
      item.padL = Number.parseFloat(cs.paddingLeft);
    }
    out.items[k] = item;
  }
  return out;
}

function headerProblems(m) {
  const p = [];
  const it = m.items;
  const order = ['logo', 'flag', 'login', 'register'];
  for (const k of order) {
    const b = it[k];
    if (b.left < EDGE - 0.01) p.push(`${k} ${b.left.toFixed(1)}px from the left edge (< ${EDGE})`);
    if (m.vw - b.right < EDGE - 0.01) p.push(`${k} ${(m.vw - b.right).toFixed(1)}px from the right edge (< ${EDGE})`);
    if (k !== 'logo' && b.h < MIN_H - 0.01) p.push(`${k} ${b.h.toFixed(1)}px high (< ${MIN_H})`);
  }
  for (let i = 1; i < order.length; i++) {
    const a = it[order[i - 1]];
    const b = it[order[i]];
    if (b.left < a.right + 2 - 0.01) p.push(`${order[i - 1]} / ${order[i]} gap ${(b.left - a.right).toFixed(1)}px (< 2)`);
  }
  for (const k of ['login', 'register']) {
    if (it[k].clipped) p.push(`${k} "${it[k].text}" text clipped`);
    if (it[k].lines > 1) p.push(`${k} "${it[k].text}" wraps to ${it[k].lines} lines`);
    if (it[k].font < MIN_FONT) p.push(`${k} font ${it[k].font}px (< ${MIN_FONT})`);
  }
  if (m.scrollW > m.vw + 0.5) p.push(`page scrolls sideways (${m.scrollW} > ${m.vw})`);
  return p;
}

/** In the page: labels of the route. */
function measureLabels() {
  // the active label breathes 1 -> 1.035: measure at the biggest size
  document.querySelectorAll('.label--active').forEach((el) => {
    el.style.animation = 'none';
    el.style.scale = '1.035';
  });
  const vw = document.documentElement.clientWidth;
  const r = (el) => {
    const b = el.getBoundingClientRect();
    return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
  };
  const labels = [...document.querySelectorAll('.label')].map((el) => {
    const o = { cls: el.className, ...r(el) };
    const btn = el.querySelector('.open-btn');
    if (btn) {
      const span = btn.querySelector('span');
      const rng = document.createRange();
      rng.selectNodeContents(span);
      const t = rng.getBoundingClientRect();
      const b = r(btn);
      o.btn = { ...b, textClipped: t.left < b.left - 0.5 || t.right > b.right + 0.5 || btn.scrollWidth > btn.clientWidth + 0.5, lines: rng.getClientRects().length };
    }
    // garland / holly / cap stick out of the label box: they must stay on screen too
    for (const part of el.querySelectorAll('.garland svg, .label__holly, .label__cap')) {
      const b = r(part);
      o.left = Math.min(o.left, b.left);
      o.right = Math.max(o.right, b.right);
    }
    const gift = document.querySelector(`.gift[data-open="${el.dataset.open}"] .gift__img`);
    const pill = document.querySelector(`.gift[data-open="${el.dataset.open}"] .today-pill`);
    if (gift) {
      // the image box includes the glow: use the middle 60% (podium + present)
      const g = r(gift);
      const sh = (g.right - g.left) * 0.2;
      o.gift = { ...g, left: g.left + sh, right: g.right - sh };
    }
    if (pill) o.pill = r(pill);
    o.box = r(el);
    return o;
  });
  return { vw, labels };
}

const ov = (a, b, tol = 0.5) => a.left < b.right - tol && b.left < a.right - tol && a.top < b.bottom - tol && b.top < a.bottom - tol;

function labelProblems(m) {
  const p = [];
  m.labels.forEach((l, i) => {
    const name = l.cls.replace('label ', '');
    if (l.left < EDGE - 0.01) p.push(`${name} ${l.left.toFixed(1)}px from the left edge (< ${EDGE})`);
    if (m.vw - l.right < EDGE - 0.01) p.push(`${name} ${(m.vw - l.right).toFixed(1)}px from the right edge (< ${EDGE})`);
    if (l.btn?.textClipped) p.push(`${name} button text clipped`);
    if (l.btn && (l.btn.left < l.left - 0.5 || l.btn.right > l.right + 0.5)) p.push(`${name} button sticks out of its label`);
    if (l.cls.includes('label--active')) {
      if (l.pill && ov(l.box, l.pill)) p.push('active label covers the TODAY pill');
      if (l.gift && ov(l.box, l.gift, 2)) p.push('active label covers its gift');
    }
    m.labels.forEach((o, j) => {
      if (j > i && ov(l.box, o.box, 1)) p.push(`${name} overlaps ${o.cls.replace('label ', '')}`);
    });
  });
  return p;
}

async function main() {
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5198, strictPort: false } });
  await server.listen();
  const base = server.resolvedUrls.local[0].replace(/\/$/, '');
  const browser = await chromium.launch({ executablePath: CHROME });
  let fails = 0;
  let rows = 0;
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    for (const market of MARKETS) {
      await page.goto(`${base}/?date=2026-12-07&market=${market}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: 844 });
        await page.waitForTimeout(120);
        const m = await page.evaluate(measureHeader);
        const p = headerProblems(m);
        rows++;
        const it = m.items;
        const info = `logo ${it.logo.w.toFixed(0)} flag ${it.flag.w.toFixed(0)} login ${it.login.w.toFixed(0)} reg ${it.register.w.toFixed(0)} font ${it.login.font} pad ${it.login.padL} edge L${it.logo.left.toFixed(0)}/R${(m.vw - it.register.right).toFixed(0)}`;
        console.log(`${p.length ? 'FAIL' : 'ok  '} header ${market} ${w}: ${info}${p.length ? ' -> ' + p.join('; ') : ''}`);
        if (p.length) fails++;
      }
    }
    if (TITLE) {
      for (const market of MARKETS) {
        for (const w of [1024, 1366, 1920]) {
          await page.setViewportSize({ width: w, height: 900 });
          await page.goto(`${base}/?date=2026-12-07&market=${market}`, { waitUntil: 'networkidle' });
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(500);
          const bb = await page.evaluate(() => {
            // only the title part may be orange in the crop: hide the gold eyebrow, the subtitle and Santa's stage
            for (const s of ['.intro__eyebrow', '.intro__sub', '.route-wrap', '.header']) document.querySelector(s).style.visibility = 'hidden';
            const r = document.querySelector('.intro__title-b').getBoundingClientRect();
            return { x: r.left, y: r.top, w: r.width, h: r.height };
          });
          const pad = 40;
          const clip = { x: Math.max(0, bb.x - 10), y: Math.max(0, bb.y - pad), width: bb.w + 20, height: bb.h + pad * 2 };
          const png = (await page.screenshot({ clip })).toString('base64');
          const res = await page.evaluate(async ({ png, clip, bb }) => {
            const img = new Image();
            img.src = 'data:image/png;base64,' + png;
            await img.decode();
            const c = document.createElement('canvas');
            c.width = img.width;
            c.height = img.height;
            const g = c.getContext('2d');
            g.drawImage(img, 0, 0);
            const d = g.getImageData(0, 0, c.width, c.height).data;
            let top = -1, bottom = -1;
            for (let y = 0; y < c.height; y++) {
              for (let x = 0; x < c.width; x++) {
                const i = (y * c.width + x) * 4;
                // title gradient: strong red + some green, little blue (orange/yellow), bright enough
                if (d[i] > 200 && d[i + 1] > 60 && d[i + 2] < 90) { if (top < 0) top = y; bottom = y; }
              }
            }
            return { inkTop: clip.y + top, inkBottom: clip.y + bottom + 1, boxTop: bb.y, boxBottom: bb.y + bb.h };
          }, { png, clip, bb });
          const probs = [];
          if (res.inkTop < res.boxTop) probs.push(`ink ${(res.boxTop - res.inkTop).toFixed(1)}px above the paint box`);
          if (res.inkBottom > res.boxBottom) probs.push(`ink ${(res.inkBottom - res.boxBottom).toFixed(1)}px below the paint box`);
          rows++;
          console.log(`${probs.length ? 'FAIL' : 'ok  '} title ${market} ${w}: ink ${res.inkTop.toFixed(0)}..${res.inkBottom.toFixed(0)} box ${res.boxTop.toFixed(0)}..${res.boxBottom.toFixed(0)}${probs.length ? ' -> ' + probs.join('; ') : ''}`);
          if (probs.length) fails++;
        }
      }
    }
    if (LABELS) {
      for (const market of MARKETS) {
        for (let day = 1; day <= 26; day++) {
          const date = `2026-12-${String(day).padStart(2, '0')}`;
          await page.goto(`${base}/?date=${date}&market=${market}`, { waitUntil: 'networkidle' });
          await page.evaluate(() => document.fonts.ready);
          for (const w of WIDTHS) {
            await page.setViewportSize({ width: w, height: 844 });
            await page.waitForTimeout(150);
            const m = await page.evaluate(measureLabels);
            const p = labelProblems(m);
            rows++;
            if (p.length) {
              fails++;
              console.log(`FAIL label ${market} day ${day} ${w}: ${[...new Set(p)].join('; ')}`);
            }
          }
        }
        console.log(`done labels ${market}`);
      }
    }
    if (SHOTS) {
      fs.mkdirSync(SHOTS, { recursive: true });
      const save = async (name, opts) => {
        const file = path.join(SHOTS, name);
        await page.screenshot({ path: file, ...opts });
      };
      for (const market of ['DE', 'NL', 'EN_GBP', 'RO_MDL']) {
        for (const w of [320, 360, 375, 390]) {
          await page.setViewportSize({ width: w, height: 844 });
          await page.goto(`${base}/?date=2026-12-07&market=${market}`, { waitUntil: 'networkidle' });
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(600);
          await save(`header-${market}-${w}.png`, { clip: { x: 0, y: 0, width: w, height: 80 } });
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`${base}/?date=2026-12-07&market=${market}`, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(900);
        await save(`mobile-${market}-390.png`, { fullPage: true });
        if (market === 'DE' || market === 'RO_MDL') {
          await page.setViewportSize({ width: 1920, height: 1080 });
          await page.goto(`${base}/?date=2026-12-07&market=${market}`, { waitUntil: 'networkidle' });
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(900);
          await save(`desktop-${market}-1920.png`, { fullPage: true });
        }
      }
      console.log(`screenshots in ${SHOTS}`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
  console.log(fails ? `\n${fails} FAILED of ${rows}` : `\nALL PASS (${rows} rows)`);
  process.exit(fails ? 1 : 0);
}
main();
