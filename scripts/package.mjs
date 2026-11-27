// Builds the zip for IT (they put the landing on the domain): TopWin-ChristmasJourney.zip in the repo root.
// Ported from Jackpot scripts/package.mjs (owner 2026-11-27, option 1). Same layout as the Jackpot zip:
// Why: the client's platform takes a zip in the layout of JacPot_TEMPLATE.zip (owner 2026-11-23): files directly at the
// zip root (no wrapping folder): index.html + asset folders, status.json = { "available": "true" } and image.jpg = a
// 1920x930 JPEG desktop screenshot of the landing (not referenced by index.html; a preview image for the platform).
//
// What it does:
//   1. `VITE_CLIENT=1 npm run build` -> dist/ (vite base './', so every asset URL is relative; checked below). VITE_CLIENT=1
//      compiles the QA override `?date=` out of main.js: on the client's domain a visitor cannot open a future day.
//   2. Serves dist/ on a local static server and takes image.jpg: market EN_GBP, campaign day 5 Dec 2026
//      (?market=EN_GBP, the clock faked to 5 Dec 2026 12:00 with Playwright page.clock), viewport 1920x930, JPEG quality 85, after fonts, images and the network
//      are idle plus ~1 s so Santa and the pulse are settled.
//      Then proves the client build ignores `?date=`: /?market=EN_GBP&date=2026-12-24 must still show day 5 as active.
//   3. Writes status.json.
//   4. Zips dist/* + status.json + image.jpg into TopWin-ChristmasJourney.zip (bsdtar, everything at the zip root).
// Top Win has no link obfuscation (Jackpot hides deposit links and promo codes; owner 2026-11-27 did not ask for it), so the
// plaintext check of Jackpot is not here. The build must not ship a market that is off (RO_MDL): checked below.
//
// Run:  node scripts/package.mjs
// Playwright is not a project dependency: PLAYWRIGHT_MODULE / CHROME as in scripts/check-pulse.mjs.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const DIST = path.join(ROOT, 'dist');
const STAGE = path.join(ROOT, 'dist-package');
const ZIP = path.join(ROOT, 'TopWin-ChristmasJourney.zip');
const URL_PARAMS = '?market=EN_GBP';
const FAKE_NOW = new Date(2026, 11, 5, 12, 0, 0);
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

// 1. build
execFileSync('npm run build', { cwd: ROOT, stdio: 'inherit', shell: true, env: { ...process.env, VITE_CLIENT: '1' } });
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
// the client bundle must not contain any reader of ?date= (owner 2026-11-23)
const DATE_READ = /(?:get|has)(s*[`"']date[`"']s*)|["'`]date=/;
for (const f of fs.readdirSync(path.join(DIST, 'assets')).filter((n) => n.endsWith('.js'))) {
  const hit = fs.readFileSync(path.join(DIST, 'assets', f), 'utf8').match(DATE_READ);
  if (hit) throw new Error(`client bundle assets/${f} still reads ?date= (${hit[0]})`);
}
// only shipped asset types may be in the client zip (internal notes in public/ once leaked as assets/README.md)
const ALLOWED = new Set(['.html', '.js', '.css', '.svg', '.webp', '.png', '.jpg', '.woff2', '.json', '.ico']);
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
for (const f of walk(DIST)) {
  const ext = path.extname(f).toLowerCase();
  const ok = ALLOWED.has(ext) || (ext === '.txt' && /^LICENSE/i.test(path.basename(f)));
  if (!ok) throw new Error(`unexpected file in the client build: ${path.relative(DIST, f)}`);
}
// a market that is off ("enabled": false) must leave no files in the build (vite.config.js drops its flag, src/i18n.js its data)
const off = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/markets.json'), 'utf8')).filter((m) => m.enabled === false);
for (const m of off) {
  const left = walk(DIST).filter((f) => path.basename(f) === `${m.flag}.svg` || path.basename(f).startsWith(`${m.id}-`) || path.basename(f).startsWith(`${m.uiLang}-`));
  if (left.length) throw new Error(`market ${m.id} is off but in the build: ${left.map((f) => path.relative(DIST, f)).join(', ')}`);
}
const absolute = [...html.matchAll(/(?:src|href)="(\/[^"]*)"/g)].map((m) => m[1]);
if (absolute.length) throw new Error(`dist/index.html has root-absolute URLs: ${absolute.join(', ')}`);

// 2. screenshot from a static server over dist/
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(DIST, rel === '/' ? 'index.html' : rel);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

fs.rmSync(STAGE, { recursive: true, force: true });
fs.cpSync(DIST, STAGE, { recursive: true });
const browser = await chromium.launch({ executablePath: CHROME, args: ['--hide-scrollbars'] });
try {
  const page = await (await browser.newContext({ viewport: { width: 1920, height: 930 }, deviceScaleFactor: 1 })).newPage();
  if (!page.clock) throw new Error('this Playwright has no page.clock; upgrade Playwright');
  await page.clock.setFixedTime(FAKE_NOW);
  await page.goto(`http://127.0.0.1:${port}/${URL_PARAMS}`, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => (i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(STAGE, 'image.jpg'), type: 'jpeg', quality: 85 });

  // the client build must ignore ?date= (day 5 stays active, day 24 is not)
  await page.goto(`http://127.0.0.1:${port}/${URL_PARAMS}&date=2026-12-24`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.gift--active');
  const active = await page.$$eval('.gift--active', (els) => els.map((e) => e.dataset.open));
  if (active.join() !== '5') throw new Error(`client build honours ?date=: active day(s) ${active.join()} instead of 5`);
  console.log('check ok: ?date=2026-12-24 ignored in the client build (active day 5)');
} finally {
  await browser.close();
  server.close();
}

// 3. status.json (same bytes as the template)
fs.writeFileSync(path.join(STAGE, 'status.json'), '{ "available": "true" }');

// 4. zip, everything at the zip root
fs.rmSync(ZIP, { force: true });
// Windows bsdtar (Git's GNU tar cannot write zip); entries listed so the zip has no './' prefix.
const TAR = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:/Windows', 'System32/tar.exe') : 'tar';
execFileSync(TAR, ['-a', '-c', '-f', ZIP, '-C', STAGE, ...fs.readdirSync(STAGE)], { stdio: 'inherit' });
fs.rmSync(STAGE, { recursive: true, force: true });
console.log(`wrote ${ZIP} (${fs.statSync(ZIP).size} bytes)`);
