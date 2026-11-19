// Step 7 owner screenshots (?date=2026-12-07): title crops (390 + 1920), header crops (320/360/375/390), today label crops (360/390).
//
//   node scripts/shots-step7.mjs <outDir> [--markets=DE,NL,EN_GBP,RO_MDL] [--only=title,header,today]
//
// Files: title-<MARKET>-<width>.png, header-<MARKET>-<width>.png, today-<MARKET>-<width>.png (DPR 2).
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
const OUT = args.find((a) => !a.startsWith('--'));
if (!OUT) throw new Error('usage: node scripts/shots-step7.mjs <outDir>');
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const MARKETS = opt('markets', 'DE,NL,EN_GBP,RO_MDL').split(',');
const ONLY = opt('only', 'title,header,today').split(',');
fs.mkdirSync(OUT, { recursive: true });

async function main() {
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5196, strictPort: false, fs: { strict: false } } });
  await server.listen();
  const base = server.resolvedUrls.local[0].replace(/\/$/, '');
  const browser = await chromium.launch({ executablePath: CHROME });
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const open = async (market, width, height = 900) => {
      await page.setViewportSize({ width, height });
      await page.goto(`${base}/?date=2026-12-07&market=${market}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(900);
    };
    const shot = async (name, box) => {
      const vp = page.viewportSize();
      const x = Math.max(0, box.x);
      const y = Math.max(0, box.y);
      const clip = { x, y, width: Math.min(vp.width - x, box.width), height: box.height };
      await page.screenshot({ path: path.join(OUT, name), clip, fullPage: true });
    };
    for (const market of MARKETS) {
      if (ONLY.includes('title')) {
        for (const w of [390, 1920]) {
          await open(market, w, w === 390 ? 900 : 1080);
          const b = await page.evaluate(() => {
            const r = document.querySelector('.intro').getBoundingClientRect();
            const h = document.querySelector('.header').getBoundingClientRect();
            return { x: 0, y: window.scrollY + h.bottom, width: innerWidth, height: r.bottom - h.bottom + 120 };
          });
          await shot(`title-${market}-${w}.png`, w === 390 ? b : { ...b, x: 360, width: 1200 });
        }
      }
      if (ONLY.includes('header')) {
        for (const w of [320, 360, 375, 390]) {
          await open(market, w);
          await shot(`header-${market}-${w}.png`, { x: 0, y: 0, width: w, height: 64 });
        }
      }
      if (ONLY.includes('today')) {
        for (const w of [360, 390]) {
          await open(market, w);
          const b = await page.evaluate(() => {
            const el = document.querySelector('.label--active');
            el.style.animation = 'none';
            const r = el.getBoundingClientRect();
            const g = document.querySelector('.gift--active').getBoundingClientRect();
            const x0 = Math.min(r.left, g.left) - 12;
            const x1 = Math.max(r.right, g.right) + 12;
            return { x: x0, y: window.scrollY + r.top - 40, width: x1 - x0, height: r.height + 80 };
          });
          await shot(`today-${market}-${w}.png`, b);
        }
      }
    }
    console.log(`screenshots in ${OUT}`);
  } finally {
    await browser.close();
    await server.close();
  }
}
main();
