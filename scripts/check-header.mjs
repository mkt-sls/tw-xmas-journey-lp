// Numeric check of the MOBILE header and the today label (Step 6).
//
//   node scripts/check-header.mjs                      header: every market x widths 320/360/375/390/414/430
//   node scripts/check-header.mjs --labels             also: today label on every day 1-26 (margin, clipping, overlaps)
//   node scripts/check-header.mjs --shots <outDir>     also: screenshots (header crops, mobile 390, desktop 1920; ?date=2026-12-07)
//   node scripts/check-header.mjs --resize            ONLY the resize test (see below); --days=5,16,17 to narrow it
//   --widths=320,360  --markets=DE,NL  to narrow the run
//
// EVERY measured width is a FRESH page load at that width (viewport set first, then page.goto). The page's today-button fit
// (fitTodayButton in src/render/route.js) does not refit reliably after a resize, so a page loaded at 430 and then shrunk
// reports "2 lines" where a phone that opens the page at 390 gets one line (task A2, 2026-11-20). Do not go back to
// one goto + several setViewportSize calls for the header / label checks.
// RESIZE TEST (--resize, separate on purpose): load at 430, shrink to 390/375/360/320, wait 400 ms, and compare the active label's
// today button (line count, box) and label box with a fresh load at the same width. Any difference is a FAIL
// "resize differs from fresh load". It is a real page bug (the resize path), not a false alarm; it is expected to fail until the page is fixed.
//
// HEADER (logo + market selector only, no LOG IN / REGISTER; owner 2026-11-24), per market x width (fresh load per market and width):
// - no .btn-outline / .btn-register in the header; logo and selector inside the viewport with >= 8px to each edge and inside the header side padding;
// - >= 8px between logo and selector; selector >= 31px high, 44x44 tap area; logo centre = header centre within 0.5px on every width;
//   no horizontal page scroll.
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
const RESIZE = args.includes('--resize');
const RESIZE_WIDTHS = [320, 360, 375, 390];
const DAYS = (opt('days') || '').split(',').filter(Boolean).map(Number);
const SHOTS = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const EDGE = 8;
const MIN_H = 31; // selector button: 80% size like Jackpot (visible box 31px mobile, 33px desktop; tap area 44px, see the tap probe)
const TAP = 44;
const MIN_LOGO_GAP = 8;

/** In the page: boxes and text facts of the header. */
function measureHeader() {
  const vw = document.documentElement.clientWidth;
  const q = (s) => document.querySelector(s);
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: r.width, h: r.height };
  };
  const inner = q('.header__inner');
  const ics = getComputedStyle(inner);
  const ir = inner.getBoundingClientRect();
  const hdr = q('.header').getBoundingClientRect();
  const out = { vw, scrollW: document.documentElement.scrollWidth, items: {}, padL: ir.left + Number.parseFloat(ics.paddingLeft), padR: ir.right - Number.parseFloat(ics.paddingRight), hdrCentre: (hdr.left + hdr.right) / 2, texts: [...document.querySelectorAll('.header .btn-outline, .header .btn-register')].length };
  const tap = q('.market__btn');
  const tb = tap.getBoundingClientRect();
  // the hit area is the ::after box (44px high): probe the 4 corners of a 44x44 area around the button centre
  out.tap = (() => { const cx = (tb.left + tb.right) / 2; const cy = (tb.top + tb.bottom) / 2; return [[-21, -21], [21, -21], [-21, 21], [21, 21]].every(([dx, dy]) => { const e = document.elementFromPoint(cx + dx, cy + dy); return e && (e === tap || tap.contains(e)); }); })();
  const defs = { logo: '.header__logo img', flag: '.market__btn' };
  for (const [k, sel] of Object.entries(defs)) {
    const el = q(sel);
    const b = box(el);
    const cs = getComputedStyle(el);
    const item = { ...b, font: Number.parseFloat(cs.fontSize) };
    out.items[k] = item;
  }
  return out;
}

function headerProblems(m) {
  const p = [];
  const it = m.items;
  if (m.texts) p.push(`${m.texts} LOG IN / REGISTER button(s) still in the header`);
  for (const k of ['logo', 'flag']) {
    const b = it[k];
    if (b.left < EDGE - 0.01) p.push(`${k} ${b.left.toFixed(1)}px from the left edge (< ${EDGE})`);
    if (m.vw - b.right < EDGE - 0.01) p.push(`${k} ${(m.vw - b.right).toFixed(1)}px from the right edge (< ${EDGE})`);
    if (k !== 'logo' && b.h < MIN_H - 0.01) p.push(`${k} ${b.h.toFixed(1)}px high (< ${MIN_H})`);
  }
  // selector inside the header side padding
  if (it.flag.right > m.padR + 0.5) p.push(`selector ${(it.flag.right - m.padR).toFixed(1)}px outside the right padding`);
  if (it.logo.left < m.padL - 0.5) p.push(`logo ${(m.padL - it.logo.left).toFixed(1)}px outside the left padding`);
  if (it.flag.left < it.logo.right + MIN_LOGO_GAP - 0.01) p.push(`logo / selector gap ${(it.flag.left - it.logo.right).toFixed(1)}px (< ${MIN_LOGO_GAP})`);
  // logo centred on the full header width on every layout (owner 2026-11-24)
  const lc = (it.logo.left + it.logo.right) / 2;
  if (Math.abs(lc - m.hdrCentre) > 0.5) p.push(`logo centre ${lc.toFixed(2)} vs header centre ${m.hdrCentre.toFixed(2)} (> 0.5px apart)`);
  if (!m.tap) p.push(`selector tap area smaller than ${TAP}x${TAP}px`);
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

/** Fresh page load at a given width: viewport first, then goto, then fonts and two frames settled. */
async function openFresh(page, url, w, h) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  await page.waitForTimeout(100);
}

async function main() {
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5198, strictPort: false, fs: { strict: false } } });
  await server.listen();
  const base = server.resolvedUrls.local[0].replace(/\/$/, '');
  const browser = await chromium.launch({ executablePath: CHROME });
  let fails = 0;
  let rows = 0;
  const wraps = new Map(); // "MARKET width" -> day numbers whose today button wraps to 2+ lines (info, not a failure)
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    for (const market of MARKETS) {
      for (const w of RESIZE ? [] : WIDTHS) {
        await openFresh(page, `${base}/?date=2026-12-07&market=${market}`, w, 844);
        const m = await page.evaluate(measureHeader);
        const p = headerProblems(m);
        rows++;
        const it = m.items;
        const info = `logo ${it.logo.w.toFixed(0)} L${it.logo.left.toFixed(0)} centre ${((it.logo.left + it.logo.right) / 2).toFixed(1)}/${m.hdrCentre.toFixed(1)} selector ${it.flag.w.toFixed(0)}x${it.flag.h.toFixed(0)} R${(m.vw - it.flag.right).toFixed(0)} gap ${(it.flag.left - it.logo.right).toFixed(0)}`;
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
    if (LABELS && !RESIZE) {
      for (const market of MARKETS) {
        for (let day = 1; day <= 26; day++) {
          const date = `2026-12-${String(day).padStart(2, '0')}`;
          for (const w of WIDTHS) {
            await openFresh(page, `${base}/?date=${date}&market=${market}`, w, 844);
            const m = await page.evaluate(measureLabels);
            const p = labelProblems(m);
            rows++;
            const act = m.labels.find((l) => l.cls.includes('label--active'));
            if (act?.btn && act.btn.lines > 1) { const k = `${market} ${w}`; wraps.set(k, [...(wraps.get(k) || []), day]); }
            if (p.length) {
              fails++;
              console.log(`FAIL label ${market} day ${day} ${w}: ${[...new Set(p)].join('; ')}`);
            }
          }
        }
        console.log(`done labels ${market}`);
      }
    }
    if (RESIZE) {
      const days = DAYS.length ? DAYS : Array.from({ length: 26 }, (_, i) => i + 1);
      const key = (a) => (a ? { lines: a.btn?.lines, btn: a.btn, box: a.box } : null);
      const near = (a, b) => ['left', 'right', 'top', 'bottom'].every((k) => Math.abs(a[k] - b[k]) <= 1);
      for (const market of MARKETS) {
        let diffs = 0;
        for (const day of days) {
          const url = `${base}/?date=2026-12-${String(day).padStart(2, '0')}&market=${market}`;
          // fresh results first (one load per width), then one load at 430 that is shrunk step by step
          const fresh = {};
          for (const w of RESIZE_WIDTHS) {
            await openFresh(page, url, w, 844);
            fresh[w] = key((await page.evaluate(measureLabels)).labels.find((l) => l.cls.includes('label--active')));
          }
          await openFresh(page, url, 430, 844);
          for (const w of RESIZE_WIDTHS.slice().reverse()) {
            await page.setViewportSize({ width: w, height: 844 });
            await page.waitForTimeout(400);
            const res = key((await page.evaluate(measureLabels)).labels.find((l) => l.cls.includes('label--active')));
            const f = fresh[w];
            rows++;
            const p = [];
            if (!f || !res) p.push('no active label');
            else {
              if (f.lines !== res.lines) p.push(`today button lines fresh ${f.lines} vs resized ${res.lines}`);
              if (f.btn && res.btn && !near(f.btn, res.btn)) p.push(`button box fresh L${f.btn.left.toFixed(1)} R${f.btn.right.toFixed(1)} T${f.btn.top.toFixed(1)} B${f.btn.bottom.toFixed(1)} vs resized L${res.btn.left.toFixed(1)} R${res.btn.right.toFixed(1)} T${res.btn.top.toFixed(1)} B${res.btn.bottom.toFixed(1)}`);
              if (!near(f.box, res.box)) p.push(`label box fresh L${f.box.left.toFixed(1)} R${f.box.right.toFixed(1)} vs resized L${res.box.left.toFixed(1)} R${res.box.right.toFixed(1)}`);
            }
            if (p.length) {
              fails++;
              diffs++;
              console.log(`FAIL resize differs from fresh load: ${market} day ${day} 430->${w}: ${p.join('; ')}`);
            }
          }
        }
        console.log(`done resize ${market}: ${diffs} differences`);
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
  if (LABELS && !RESIZE) console.log(wraps.size ? `TODAY BUTTON still on 2 lines (days): ${[...wraps].map(([k, v]) => `${k}: day ${v.join("/")}`).join(', ')}` : 'TODAY BUTTON on ONE line everywhere');
  console.log(fails ? `\n${fails} FAILED of ${rows}` : `\nALL PASS (${rows} rows)`);
  process.exit(fails ? 1 : 0);
}
main();
