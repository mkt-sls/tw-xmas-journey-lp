// Step 8 check: opening / closing the gift card must not move the page behind it.
//
//   node scripts/check-modal-jump.mjs                    full matrix (widths 1024/1280/1440/1920 desktop + 390 mobile,
//                                                        EN_GBP + RO_MDL, ?date=2026-12-07 + 2026-12-01, scroll top + mid)
//   node scripts/check-modal-jump.mjs --widths=1440 --markets=EN_GBP --dates=2026-12-07   to narrow the run
//   node scripts/check-modal-jump.mjs --shots <outDir>   also: closed/open screenshots at 1440 (EN_GBP, 2026-12-07, locked day, top)
//
// For each config the page is loaded once. For each gift kind present (locked / today / missed) and each close way (X, backdrop, Esc):
// record -> open the card -> record -> close -> record. "record" = bounding box of the title, every gift, every label, Santa, plus
// window.scrollY. Pass = every box edge and scrollY differ by <= 0.5px between closed / open / closed-again.
//
// Scrollbar: Playwright's headless Chromium launches with --hide-scrollbars, which would hide the very thing that causes the jump,
// so that default arg is dropped (ignoreDefaultArgs) and the check asserts innerWidth - clientWidth > 0 on every desktop config
// (a classic, space-taking scrollbar like real Chrome on Windows). Mobile 390 runs with isMobile (overlay scrollbars, as on phones).
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
const WIDTHS = (opt('widths') || '1024,1280,1440,1920,390').split(',').map(Number);
const MARKETS = (opt('markets') || 'EN_GBP,RO_MDL').split(',');
const DATES = (opt('dates') || '2026-12-07,2026-12-01').split(',');
const SHOTS = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const TOL = 0.5;
const H_DESKTOP = 720; // a laptop viewport: the page is ~880px tall at 1440, so only a viewport below that has the scrollbar
const H_MOBILE = 844;
const CLOSERS = ['x', 'backdrop', 'esc'];

/** In the page: every box that must stay put + scrollY + scrollbar width. */
function record() {
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return [r.left, r.top, r.right, r.bottom];
  };
  const out = { scrollY: [window.scrollY], bar: [window.innerWidth - document.documentElement.clientWidth] };
  const t = document.querySelector('.intro__title');
  if (t) out.title = box(t);
  const s = document.querySelector('.santa');
  if (s) out.santa = box(s);
  document.querySelectorAll('.gift').forEach((g) => {
    out[`gift${g.dataset.open}`] = box(g);
  });
  document.querySelectorAll('.label').forEach((l, i) => {
    out[`label${i}`] = box(l);
  });
  return out;
}

/** Differences between two records > TOL: [{key, d}] ('bar' is information, not a movement). */
function diff(a, b) {
  const bad = [];
  for (const k of Object.keys(a)) {
    if (k === 'bar') continue;
    if (!b[k]) {
      bad.push({ key: k, d: Infinity });
      continue;
    }
    const d = Math.max(...a[k].map((v, i) => Math.abs(v - b[k][i])));
    if (d > TOL) bad.push({ key: k, d });
  }
  return bad;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openCard(page, day) {
  await page.evaluate((d) => document.querySelector(`.gift[data-open="${d}"]`).click(), day);
  await page.waitForSelector('.overlay.is-open', { timeout: 8000 });
  await sleep(900);
}

async function closeCard(page, how) {
  if (how === 'x') await page.evaluate(() => document.querySelector('.card__close').click());
  else if (how === 'backdrop') await page.evaluate(() => document.querySelector('.overlay__backdrop').click());
  else await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.overlay'), null, { timeout: 8000 });
  await sleep(900);
}

async function main() {
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5197, strictPort: false, fs: { strict: false } } });
  await server.listen();
  const base = `http://localhost:${server.config.server.port}`;
  const browser = await chromium.launch({ executablePath: CHROME, ignoreDefaultArgs: ['--hide-scrollbars'] });
  let cycles = 0;
  let jumpCycles = 0;
  const worst = [];
  const noBar = [];
  try {
    for (const width of WIDTHS) {
      const mobile = width < 600;
      for (const market of MARKETS) {
        for (const date of DATES) {
          const ctx = await browser.newContext({
            viewport: { width, height: mobile ? H_MOBILE : H_DESKTOP },
            ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
          });
          const page = await ctx.newPage();
          await page.goto(`${base}/?date=${date}&market=${market}`, { waitUntil: 'networkidle' });
          await sleep(2500); // intro animation
          // the active label 'breathes' (idle scale animation, +-1.5px by design): freeze it so only real layout moves are measured
          await page.addStyleTag({ content: '.label, .label * { animation: none !important; }' });
          const kinds = await page.evaluate(() => {
            const pick = (c) => document.querySelector(`.gift.gift--${c}`)?.dataset.open;
            return { locked: pick('locked'), today: pick('active'), missed: pick('missed') };
          });
          for (const scroll of ['top', 'mid']) {
            for (const [kind, day] of Object.entries(kinds)) {
              if (!day) continue;
              for (const how of CLOSERS) {
                await page.evaluate((s) => {
                  const max = document.documentElement.scrollHeight - window.innerHeight;
                  window.scrollTo(0, s === 'top' ? 0 : Math.round(max / 2));
                }, scroll);
                await sleep(500);
                const before = await page.evaluate(record);
                if (!mobile && before.bar[0] <= 0) noBar.push(`${width} ${market} ${date}`);
                if (SHOTS && width === 1440 && market === 'EN_GBP' && date === '2026-12-07' && scroll === 'top' && kind === 'locked' && how === 'x') {
                  fs.mkdirSync(SHOTS, { recursive: true });
                  await page.screenshot({ path: path.join(SHOTS, 'closed.png') });
                }
                await openCard(page, day);
                const open = await page.evaluate(record);
                if (SHOTS && width === 1440 && market === 'EN_GBP' && date === '2026-12-07' && scroll === 'top' && kind === 'locked' && how === 'x') {
                  await page.screenshot({ path: path.join(SHOTS, 'open.png') });
                }
                await closeCard(page, how);
                const after = await page.evaluate(record);
                const dOpen = diff(before, open);
                const dClose = diff(before, after);
                cycles++;
                if (dOpen.length || dClose.length) {
                  jumpCycles++;
                  const wo = Math.max(0, ...dOpen.map((x) => x.d));
                  const wc = Math.max(0, ...dClose.map((x) => x.d));
                  worst.push({
                    cfg: `${width} ${market} ${date} ${scroll} ${kind} ${how}`,
                    open: dOpen.length,
                    close: dClose.length,
                    maxOpen: wo,
                    maxClose: wc,
                    bar: before.bar[0],
                    dScrollOpen: open.scrollY[0] - before.scrollY[0],
                    dScrollClose: after.scrollY[0] - before.scrollY[0],
                    sample: [...dOpen, ...dClose].slice(0, 3).map((x) => `${x.key}:${x.d.toFixed ? x.d.toFixed(1) : x.d}`).join(' '),
                  });
                }
              }
            }
          }
          await ctx.close();
        }
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
  worst.sort((a, b) => Math.max(b.maxOpen, b.maxClose) - Math.max(a.maxOpen, a.maxClose));
  for (const w of worst.slice(0, 25)) {
    console.log(
      `JUMP ${w.cfg}: open ${w.open} boxes (max ${w.maxOpen.toFixed(1)}px), close ${w.close} boxes (max ${w.maxClose.toFixed(1)}px), scrollbar ${w.bar}px, dScrollY open ${w.dScrollOpen} close ${w.dScrollClose} [${w.sample}]`,
    );
  }
  if (worst.length > 25) console.log(`... and ${worst.length - 25} more`);
  if (noBar.length) console.log(`WARN no classic scrollbar on ${noBar.length} desktop runs (test not meaningful there): ${[...new Set(noBar)].join('; ')}`);
  console.log(`\n${cycles} open/close cycles, ${jumpCycles} with a jump > ${TOL}px, ${cycles - jumpCycles} clean`);
  process.exit(jumpCycles ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
