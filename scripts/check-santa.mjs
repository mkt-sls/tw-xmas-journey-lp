// Numeric check: Santa's snowboard rests ON the dotted route that is actually visible on screen.
//
//   node scripts/check-santa.mjs            (all 28 dates x 390, 768, 1366, 1920; writes the QA sheets)
//   node scripts/check-santa.mjs --widths 390 --dates 2026-12-26
//   node scripts/check-santa.mjs --sweep --fails-only   (desktop 1024-3840 every 32px + 1280/1440/1536/1600/1680, mobile
//                                                        360-1023 every 32px + 1023; one load per date and layout, then the
//                                                        viewport is resized; prints the failing rows and a summary)
//
// Starts its own Vite dev server, opens every date with ?date=, and measures in the rendered page:
// - the LINE from the route SVG file itself (its <path> d, its gradient opacity), placed with the <img>'s on-screen box.
//   Only the part that is visible counts: gradient opacity >= VISIBLE_ALPHA and inside the route area / viewport.
// - the BOARD: 5 points on the underside of the snowboard, in the Santa PNG's own pixels (measured once, BOARD_PX), pushed
//   through the browser's real transforms (a copy of the <img>'s computed box/transform, appended next to it, with 0x0 marker
//   children; their getBoundingClientRect is where the browser draws that pixel: rotation, mirror, scale, page zoom included).
// Pass = every board point within MAX_DIST (CSS px at zoom 1) of the visible line, board direction within MAX_ANGLE of the
// line tangent, nose pointing along the route towards today's stop (after the campaign: forwards), and no part of Santa's
// opaque silhouette over a gift, the TODAY pill, a label card or the intro text; on Dec 1 his centre is left of the Dec 1 stop
// (he rides the lead-in line BEFORE it).
// Information only (owner decision, T5h): whether the BOUNDING BOX of his opaque silhouette touches the box of a gift/pedestal,
// TODAY pill or label. His pose is diagonal, so the rectangles often touch while no pixel does (mobile: his raised hand above
// the TODAY pill). Shown in the "bbox clear" column and counted in the summary, not part of pass/fail.
// Playwright is not a project dependency: set PLAYWRIGHT_MODULE (path to playwright/index.mjs) and CHROME (browser exe)
// if the defaults below do not exist on this machine.
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

const MAX_DIST = 4; // CSS px at zoom 1
const MAX_ANGLE = 10; // deg
const VISIBLE_ALPHA = 0.35; // the dots are drawn at 0.7: half of that still reads as line, below it is fading out

// Underside of the board in the Santa PNGs (natural pixels, tail -> nose). Measured with an alpha scan of the PNG: the lowest
// opaque pixel (alpha > 128) of each column across the board (scripts/check-santa.mjs --measure prints the scan again).
const BOARD_PX = {
  'hero-santa-mobile@2x.webp': [[72, 190], [108, 200], [144, 213], [180, 226], [216, 237]],
  'hero-santa-desktop@2x.webp': [[96, 256], [150, 272], [198, 289], [252, 309], [300, 321]],
};

const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const ALL_DATES = ['2026-11-25', ...Array.from({ length: 26 }, (_, i) => `2026-12-${String(i + 1).padStart(2, '0')}`), '2026-12-28'];
const DATES = arg('--dates', ALL_DATES.join(',')).split(',');
const SWEEP = args.includes('--sweep');
const FAILS_ONLY = args.includes('--fails-only');
const range = (a, b, step) => Array.from({ length: Math.floor((b - a) / step) + 1 }, (_, i) => a + i * step);
const SWEEP_WIDTHS = [...new Set([...range(1024, 3840, 32), 1280, 1440, 1536, 1600, 1680, ...range(360, 1023, 32), 1023])].sort((a, b) => a - b);
const WIDTHS = SWEEP ? SWEEP_WIDTHS : arg('--widths', '390,768,1366,1920').split(',').map(Number);
const SHEETS = (arg('--sheets', SWEEP ? '' : '390,1366') || '').split(',').filter(Boolean).map(Number);
const HEIGHT = { 390: 844, 768: 1024, 1366: 768, 1920: 1080 };

// ---------------------------------------------------------------- in-page measurement
async function measure(page, boardPx) {
  return page.evaluate(
    async ({ boardPx, VISIBLE_ALPHA }) => {
      const santa = document.querySelector('.santa');
      const img = santa.querySelector('img');
      const route = document.querySelector('.route--base');
      const wrap = document.querySelector('.route-wrap');
      const z = Number(getComputedStyle(document.querySelector('.page')).getPropertyValue('--z')) || 1;

      // --- the line, from the SVG files the page shows: the base route and the gold (travelled) copy drawn over it,
      // clipped by its container. A point of the line is visible when either copy shows it.
      async function readSvg(src) {
        const doc = new DOMParser().parseFromString(await (await fetch(src)).text(), 'image/svg+xml');
        const vb = doc.documentElement.getAttribute('viewBox').split(/[\s,]+/).map(Number);
        const pathEl = doc.querySelector('path');
        const stroke = pathEl.getAttribute('stroke');
        let alphaAt = () => Number(pathEl.getAttribute('stroke-opacity') ?? 1);
        const grad = stroke && stroke.startsWith('url(') ? doc.getElementById(stroke.slice(5, -1)) : null;
        if (grad) {
          const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((k) => Number(grad.getAttribute(k)));
          const stops = [...grad.querySelectorAll('stop')].map((st) => ({
            o: Number(st.getAttribute('offset') ?? 0),
            a: Number(st.getAttribute('stop-opacity') ?? 1),
          }));
          // SVG: offsets are clamped to [0,1] and made non-decreasing
          let prev = 0;
          stops.forEach((st) => {
            st.o = Math.max(prev, Math.min(1, Math.max(0, st.o)));
            prev = st.o;
          });
          const L2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
          alphaAt = (x, y) => {
            const t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / L2;
            if (t <= stops[0].o) return stops[0].a;
            for (let i = 1; i < stops.length; i++) {
              if (t <= stops[i].o) {
                const p = stops[i - 1];
                const q = stops[i];
                return q.o === p.o ? q.a : p.a + ((q.a - p.a) * (t - p.o)) / (q.o - p.o);
              }
            }
            return stops[stops.length - 1].a;
          };
        }
        return { vb, d: pathEl.getAttribute('d'), alphaAt };
      }
      const W = document.documentElement.clientWidth;
      const clip = wrap.getBoundingClientRect();
      const inRect = (x, y, r) => x >= Math.max(0, r.left) && x <= Math.min(W, r.right) && y >= r.top && y <= r.bottom;
      const copies = [{ img: route, clip }];
      const goldBox = document.querySelector('.route--gold');
      const goldImg = goldBox && (goldBox.tagName === 'IMG' ? goldBox : goldBox.querySelector('img'));
      if (goldImg) {
        const g = goldBox.getBoundingClientRect();
        const r = { left: Math.max(g.left, clip.left), right: Math.min(g.right, clip.right), top: Math.max(g.top, clip.top), bottom: Math.min(g.bottom, clip.bottom) };
        if (r.right > r.left && r.bottom > r.top) copies.push({ img: goldImg, clip: r });
      }
      for (const c of copies) {
        Object.assign(c, await readSvg(c.img.src));
        c.rr = c.img.getBoundingClientRect(); // includes stage scale, the desktop squeeze and the page zoom
      }
      if (copies.some((c) => c.d !== copies[0].d)) throw new Error('base and gold route paths differ');
      const live = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      live.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden';
      const lp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      lp.setAttribute('d', copies[0].d);
      live.appendChild(lp);
      document.body.appendChild(live);
      const len = lp.getTotalLength();
      const line = [];
      for (let s = 0; s <= len; s += 0.5) {
        const p = lp.getPointAtLength(s);
        let pt = null;
        for (const c of copies) {
          const x = c.rr.left + ((p.x - c.vb[0]) / c.vb[2]) * c.rr.width;
          const y = c.rr.top + ((p.y - c.vb[1]) / c.vb[3]) * c.rr.height;
          const a = c.alphaAt(p.x, p.y);
          const vis = inRect(x, y, c.clip) && a >= VISIBLE_ALPHA;
          if (!pt) pt = { s, x, y, a, vis };
          else if (vis) pt = { s, x, y, a: Math.max(a, pt.a), vis };
        }
        line.push(pt);
      }
      live.remove();

      // --- map image pixels to the screen through the browser's own transforms
      const cs = getComputedStyle(img);
      const box = document.createElement('div');
      box.style.cssText = `position:absolute;left:${cs.left};top:${cs.top};width:${img.offsetWidth}px;height:${img.offsetHeight}px;transform:${cs.transform};transform-origin:${cs.transformOrigin};margin:${cs.margin};pointer-events:none`;
      santa.appendChild(box);
      const kx = img.offsetWidth / img.naturalWidth;
      const ky = img.offsetHeight / img.naturalHeight;
      const mapPx = (pts) => {
        const els = pts.map(([px, py]) => {
          const m = document.createElement('i');
          m.style.cssText = `position:absolute;left:${px * kx}px;top:${py * ky}px;width:0;height:0`;
          box.appendChild(m);
          return m;
        });
        const out = els.map((m) => {
          const r = m.getBoundingClientRect();
          return { x: r.left, y: r.top };
        });
        els.forEach((m) => m.remove());
        return out;
      };
      const board = mapPx(boardPx);

      // opaque silhouette of the art (grid every 6 px of the PNG)
      const c = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const opaque = [];
      for (let y = 0; y < c.height; y += 6) for (let x = 0; x < c.width; x += 6) if (d[(y * c.width + x) * 4 + 3] > 160) opaque.push([x, y]);
      const sil = mapPx(opaque);
      box.remove();

      // --- obstacles
      const obstacles = [];
      const add = (sel, kind) =>
        document.querySelectorAll(sel).forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width && r.height) obstacles.push({ kind, l: r.left, t: r.top, r: r.right, b: r.bottom });
        });
      // gifts and pedestals: the opaque part of the gift image (the PNG has transparent margins)
      for (const gi of document.querySelectorAll('.gift__img')) {
        const r = gi.getBoundingClientRect();
        if (!r.width) continue;
        const gc = new OffscreenCanvas(gi.naturalWidth, gi.naturalHeight);
        const gg = gc.getContext('2d');
        gg.drawImage(gi, 0, 0);
        const gd = gg.getImageData(0, 0, gc.width, gc.height).data;
        let x0 = gc.width;
        let y0 = gc.height;
        let x1 = 0;
        let y1 = 0;
        for (let y = 0; y < gc.height; y += 2)
          for (let x = 0; x < gc.width; x += 2)
            if (gd[(y * gc.width + x) * 4 + 3] > 160) {
              x0 = Math.min(x0, x);
              y0 = Math.min(y0, y);
              x1 = Math.max(x1, x);
              y1 = Math.max(y1, y);
            }
        const sx = r.width / gc.width;
        const sy = r.height / gc.height;
        obstacles.push({ kind: 'gift', l: r.left + x0 * sx, t: r.top + y0 * sy, r: r.left + x1 * sx, b: r.top + y1 * sy });
      }
      add('.today-pill', 'pill');
      add('.label', 'label');
      // intro text: the line boxes of the text itself, not the full-width paragraph
      document.querySelectorAll('.intro__eyebrow, .intro__title, .intro__sub, .intro__ended, .how__title').forEach((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        for (const r of range.getClientRects()) if (r.width && r.height) obstacles.push({ kind: 'intro', l: r.left, t: r.top, r: r.right, b: r.bottom });
      });

      const mode = santa.dataset.santaMode;
      const activeGift = document.querySelector('.gift--active') || document.querySelector('.gift[data-open="1"]');
      const gr = (activeGift || santa).getBoundingClientRect();
      return {
        z,
        mode,
        flip: santa.hasAttribute('data-flip'),
        rot: santa.style.getPropertyValue('--rot'),
        line,
        board,
        sil,
        obstacles,
        stop: { x: gr.left + gr.width / 2, y: gr.bottom - gr.height * 0.25 }, // the gift's pedestal sits on the route
        santaBox: santa.querySelector('img').getBoundingClientRect().toJSON(),
        W,
        wrap: [wrap.getBoundingClientRect().top, wrap.getBoundingClientRect().bottom].map(Math.round),
      };
    },
    { boardPx, VISIBLE_ALPHA },
  );
}

// ---------------------------------------------------------------- geometry
function nearest(line, p, visibleOnly) {
  let best = null;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i];
    const b = line[i + 1];
    if (visibleOnly && !(a.vis && b.vis)) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const L = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L));
    const qx = a.x + t * dx;
    const qy = a.y + t * dy;
    const dist = Math.hypot(p.x - qx, p.y - qy);
    if (!best || dist < best.dist) best = { dist, i, s: a.s + t * (b.s - a.s), tx: dx, ty: dy };
  }
  return best || { dist: Infinity, i: 0, s: 0, tx: 1, ty: 0 };
}

function evaluate(m, date) {
  const z = m.z;
  const near = m.board.map((p) => nearest(m.line, p, true));
  const maxDist = Math.max(...near.map((n) => n.dist)) / z;
  const mid = near[2];
  // tangent around the board centre (smoothed over +-10 samples)
  const i0 = Math.max(0, mid.i - 10);
  const i1 = Math.min(m.line.length - 1, mid.i + 10);
  const T = { x: m.line[i1].x - m.line[i0].x, y: m.line[i1].y - m.line[i0].y };
  const N = { x: m.board[4].x - m.board[0].x, y: m.board[4].y - m.board[0].y }; // tail -> nose, as drawn (mirror included)
  const ang = (v) => (Math.atan2(v.y, v.x) * 180) / Math.PI;
  let diff = Math.abs(ang(N) - ang(T)) % 180;
  if (diff > 90) diff = 180 - diff;
  // facing: nose along the route towards today's stop; after the campaign: forwards along the route
  const along = N.x * T.x + N.y * T.y; // > 0: nose points forwards (increasing arc length)
  let wantForward = true;
  if (m.mode !== 'end') wantForward = nearest(m.line, m.stop, false).s > mid.s;
  const facingOk = wantForward ? along > 0 : along < 0;
  // overlap
  const hits = [];
  for (const o of m.obstacles) {
    if (m.sil.some((p) => p.x > o.l + 1 && p.x < o.r - 1 && p.y > o.t + 1 && p.y < o.b - 1)) hits.push(o.kind);
  }
  // cut off: any opaque part of Santa outside the route area (overflow hidden) or the viewport
  if (m.sil.some((p) => p.x < 0 || p.x > m.W || p.y < m.wrap[0] || p.y > m.wrap[1])) hits.push("clipped");
  const overlapOk = hits.length === 0;
  // bounding box of the opaque silhouette against the boxes of gifts/pedestals, the TODAY pill and the labels
  const xs = m.sil.map((p) => p.x);
  const ys = m.sil.map((p) => p.y);
  const sb = { l: Math.min(...xs), t: Math.min(...ys), r: Math.max(...xs), b: Math.max(...ys) };
  const boxHits = m.obstacles
    .filter((o) => o.kind !== 'intro' && sb.l < o.r - 1 && sb.r > o.l + 1 && sb.t < o.b - 1 && sb.b > o.t + 1)
    .map((o) => o.kind);
  const bboxOk = boxHits.length === 0;
  // Dec 1: he rides the lead-in BEFORE the first stop
  const santaCx = (sb.l + sb.r) / 2;
  const dec1Ok = date !== '2026-12-01' || santaCx < m.stop.x;
  const pass = maxDist <= MAX_DIST && diff <= MAX_ANGLE && facingOk && overlapOk && dec1Ok;
  return { maxDist, diff, facingOk, overlapOk, hits: [...new Set(hits)], bboxOk, boxHits: [...new Set(boxHits)], dec1Ok, santaCx, stopX: m.stop.x, pass };
}

// ---------------------------------------------------------------- run
async function main() {
  if (args.includes('--measure')) return measurePng();
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5199, strictPort: false } });
  await server.listen();
  const base = server.resolvedUrls.local[0].replace(/\/$/, '');
  const browser = await chromium.launch({ executablePath: CHROME });
  const rows = [];
  const crops = {};
  try {
    const settle = (page) =>
      page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((i) => (i.complete ? 0 : i.decode().catch(() => 0))));
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      });
    const heightOf = (w) => HEIGHT[w] || (w >= 1024 ? 900 : 844);
    // default: a fresh context and page load per width; --sweep: one load per date and layout, then resize (fitStage runs on resize)
    const groups = SWEEP ? [WIDTHS.filter((w) => w < 1024), WIDTHS.filter((w) => w >= 1024)].filter((g) => g.length) : WIDTHS.map((w) => [w]);
    for (const group of groups) {
      const ctx = await browser.newContext({ viewport: { width: group[0], height: heightOf(group[0]) }, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      for (const date of DATES) {
        for (const width of group) {
          await page.setViewportSize({ width, height: heightOf(width) });
          if (width === group[0]) {
            await page.goto(`${base}/?date=${date}`, { waitUntil: 'networkidle' });
            await page.waitForSelector('.santa img');
          }
          await settle(page);
          const art = (await page.$eval('.santa img', (i) => i.getAttribute('src'))).split('/').pop();
          const m = await measure(page, BOARD_PX[art]);
          const e = evaluate(m, date);
          if (process.env.DEBUG) {
            const sx = m.sil.map((p) => p.x);
            const sy = m.sil.map((p) => p.y);
            const v = m.line.filter((p) => p.vis);
            console.log(date, width, "santa", [Math.min(...sx), Math.min(...sy), Math.max(...sx), Math.max(...sy)].map(Math.round), "board", m.board.map((p) => [Math.round(p.x), Math.round(p.y)]), "firstVis", v[0] && [Math.round(v[0].x), Math.round(v[0].y)], "lastVis", v.length && [Math.round(v.at(-1).x), Math.round(v.at(-1).y)], "wrap", m.wrap);
            m.obstacles.forEach((o) => console.log("  ", o.kind, [o.l, o.t, o.r, o.b].map(Math.round)));
          }
          rows.push({ date, width, ...e, mode: m.mode, flip: m.flip });
          if (SHEETS.includes(width)) crops[`${width}|${date}`] = { png: await crop(page, m), e };
        }
      }
      await ctx.close();
    }
    // table
    const pad = (s, n) => String(s).padEnd(n);
    console.log(`${pad('date', 11)}| ${pad('width', 6)}| ${pad('max dist px', 12)}| ${pad('angle diff', 11)}| ${pad('facing ok', 10)}| ${pad('overlap ok', 11)}| ${pad('bbox clear', 16)}| ${pad('Dec 1 left', 22)}| result`);
    for (const r of rows) {
      if (FAILS_ONLY && r.pass) continue;
      console.log(
        `${pad(r.date, 11)}| ${pad(r.width, 6)}| ${pad(r.maxDist.toFixed(2), 12)}| ${pad(r.diff.toFixed(1) + 'deg', 11)}| ${pad(r.facingOk ? 'yes' : 'NO', 10)}| ${pad(r.overlapOk ? 'yes' : 'NO ' + r.hits.join('+'), 11)}| ${pad(r.bboxOk ? 'yes' : 'NO ' + r.boxHits.join('+'), 16)}| ${pad(r.date === '2026-12-01' ? `${r.dec1Ok ? 'yes' : 'NO'} ${r.santaCx.toFixed(0)}<${r.stopX.toFixed(0)}` : '-', 22)}| ${r.pass ? 'PASS' : 'FAIL'}`,
      );
    }
    const fails = rows.filter((r) => !r.pass).length;
    const nW = new Set(rows.map((r) => r.width)).size;
    console.log(`\n${rows.length - fails}/${rows.length} pass${fails ? `, ${fails} FAIL` : ''} (${nW} widths x ${DATES.length} dates)`);
    const boxTouch = rows.filter((r) => !r.bboxOk).length;
    console.log(`info: bounding box touches a gift/pill/label box (no pixel overlap needed) in ${boxTouch}/${rows.length} rows`);
    if (fails) console.log(`failing widths: ${[...new Set(rows.filter((r) => !r.pass).map((r) => r.width))].join(',')}`);
    for (const w of SHEETS) if (Object.keys(crops).some((k) => k.startsWith(`${w}|`))) await sheet(browser, w, crops);
    process.exitCode = fails ? 1 : 0;
  } finally {
    await browser.close();
    await server.close();
  }
}

// crop around Santa with the measured visible line (red) and the board points (cyan) drawn on top
async function crop(page, m) {
  const pts = m.line.filter((p) => p.vis);
  const b = m.santaBox;
  const padX = 45 * m.z;
  const padY = 35 * m.z;
  const clip = {
    x: Math.max(0, b.left - padX),
    y: Math.max(0, b.top - padY),
    width: Math.min(m.W, b.right + padX) - Math.max(0, b.left - padX),
    height: b.height + 2 * padY,
  };
  await page.evaluate(
    ({ pts, board }) => {
      const ns = 'http://www.w3.org/2000/svg';
      const s = document.createElementNS(ns, 'svg');
      s.id = '__qa';
      s.style.cssText = `position:absolute;left:0;top:0;width:${document.documentElement.scrollWidth}px;height:${document.documentElement.scrollHeight}px;pointer-events:none;z-index:99999;overflow:visible`;
      const dot = (p, r, fill) => {
        const c = document.createElementNS(ns, 'circle');
        c.setAttribute('cx', p.x + scrollX);
        c.setAttribute('cy', p.y + scrollY);
        c.setAttribute('r', r);
        c.setAttribute('fill', fill);
        s.appendChild(c);
      };
      pts.forEach((p, i) => i % 6 === 0 && dot(p, 0.9, 'rgba(255,40,40,0.9)'));
      board.forEach((p) => dot(p, 2.2, '#00e5ff'));
      document.body.appendChild(s);
    },
    { pts, board: m.board },
  );
  const png = await page.screenshot({ clip, fullPage: true });
  await page.evaluate(() => document.getElementById('__qa')?.remove());
  return png.toString('base64');
}

async function sheet(browser, width, crops) {
  const cells = DATES.map((d) => ({ d, c: crops[`${width}|${d}`] })).filter((x) => x.c);
  const html = `<!doctype html><body style="margin:0;background:#111;font:600 13px system-ui;color:#fff">
    <div style="display:grid;grid-template-columns:repeat(6,300px);gap:6px;padding:6px">
    ${cells
      .map(
        ({ d, c }) => `<div style="background:#000;border:2px solid ${c.e.pass ? '#2a2' : '#e22'}">
        <div style="padding:3px 6px;background:${c.e.pass ? '#143' : '#511'}">${d} · ${c.e.maxDist.toFixed(1)}px · ${c.e.diff.toFixed(1)}° · ${c.e.pass ? 'PASS' : 'FAIL'}${c.e.facingOk ? '' : ' facing'}${c.e.overlapOk ? '' : ' over:' + c.e.hits.join('+')}</div>
        <img src="data:image/png;base64,${c.png}" style="display:block;width:300px;height:280px;object-fit:contain"></div>`,
      )
      .join('')}
    </div><div style="padding:4px 8px;font-weight:400">width ${width} · red = visible dotted line read from the route SVG · cyan = board underside points through the real transforms · limit ${MAX_DIST}px / ${MAX_ANGLE}°</div></body>`;
  const ctx = await browser.newContext({ viewport: { width: 6 * 306 + 6, height: 400 } });
  const p = await ctx.newPage();
  await p.setContent(html);
  await p.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
  const out = path.join(ROOT, 'qa', `santa_steep_sheet_${width}.png`);
  await p.screenshot({ path: out, fullPage: true });
  await ctx.close();
  console.log(`sheet: ${out}`);
}

// prints the board underside scan of both Santa PNGs (lowest opaque pixel per column)
async function measurePng() {
  const browser = await chromium.launch({ executablePath: CHROME });
  const p = await browser.newPage();
  for (const f of Object.keys(BOARD_PX)) {
    const src = `data:image/webp;base64,${fs.readFileSync(path.join(ROOT, 'public/assets', f)).toString('base64')}`;
    const cols = await p.evaluate(async (src) => {
      const im = new Image();
      im.src = src;
      await im.decode();
      const c = new OffscreenCanvas(im.naturalWidth, im.naturalHeight);
      const g = c.getContext('2d');
      g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const out = [];
      for (let x = 0; x < c.width; x += 6) {
        for (let y = c.height - 1; y >= 0; y--)
          if (d[(y * c.width + x) * 4 + 3] > 128) {
            out.push(`${x}:${y}`);
            break;
          }
      }
      return out.join(' ');
    }, src);
    console.log(f, cols);
  }
  await browser.close();
}

await main();
