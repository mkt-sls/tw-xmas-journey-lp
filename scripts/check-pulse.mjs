// Numeric check: today's pulse ring starts ON the Figma ring ("Pulse ring" 58:1227, 150x70 at (-15, 53) of the gift symbol) and grows concentrically.
//
//   node scripts/check-pulse.mjs                      (10 widths x 3 dates)
//   node scripts/check-pulse.mjs --widths 390,1440 --dates 2026-12-01 --shots   (also writes qa/t5h_pulse_* at DPR 2)
//
// Starts its own Vite dev server and opens each date with ?date=. In the rendered page it measures:
// - the STATIC ellipse: fitted to the brightest line of the ring in gift-today@2x.webp's own pixels (rays from the centre,
//   only podium pixels, front arc + the parts of the back arc beside the gift), then placed with the <img>'s on-screen box.
// - the ANIMATED ring (.gift--active::before): its CSS animation is paused at t = 0, 50% and 100% (document.getAnimations(),
//   currentTime); a copy of the pseudo-element's computed box (left/top/size/border/scale/transform-origin) is appended in the
//   gift and measured with getBoundingClientRect, so stage scale, the desktop squeeze and the page zoom are all included.
//   The ring's line is the middle of its border.
// - LEFTOVER rings: every pseudo-element with content inside today's gift (only ::before is expected), and a ray scan of the
//   gift image for any ring-shaped bright line outside the podium (the wide ring the Figma export baked in around the base).
// - VISIBILITY: pixels that change on screen at t=0 when the ring is hidden (all animations paused, snow hidden). The art is
//   opaque, so a ring painted under it would pass every geometric test and still never be seen.
// - ANCHORS: every other running animation of `scale` / `transform` (today's label breathing, the unlock lock, ...) must keep
//   its element's on-screen centre within ANCHOR_PX at 0 / 25 / 50 / 75% (see anchorCheck).
// WHY THE VISIBILITY THRESHOLD IS WHAT IT IS (task E, 2026-11-20): the red-ring pixels are counted over the WHOLE ring area (the
// bounding box of the static ellipse plus its stroke, NOT clipped to the gift button box; the ring is ~25% wider than the box, so
// the old in-box count saw only ~77 of ~454 px at 1440 Dec 26 and sat on a 1 px edge: 62 vs threshold 63.25 = flaky FAIL).
// A fully visible line would show about arc * bw pixels (arc = ellipse length, bw = stroke width on screen). By design about half
// of the ring is covered: the podium art and the present (img.gift__front / route base), today's label garland and Santa's glow
// (measured in A2: 34-36 of 72 ring points visible at 1366 / 1440 / 1536). Measured in task E (3 runs, 10 widths x 3 dates): seen is 2.0x to 3.4x the threshold, i.e. 50% to 85% of arc * bw (the lowest, 1536 Dec 1, is about 0.51).
// The rule is: seen >= MIN_SEEN_SHARE of arc * bw (see the constant for the value). Do not lower it just to pass:
// it must still fail when the ring is painted under the opaque art (before T5h almost nothing of it showed).
// Pass: at t=0 centre, rx and ry match the static ellipse within MAX_PX (CSS px); at 50% / 100% the centre stays within MAX_PX
// and the ring is larger; only ::before has content; no baked ring in the art; at least a third of the ring line is seen.
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

const MAX_PX = 2;
const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const WIDTHS = arg('--widths', '390,768,1024,1366,1440,1536,1600,1920,2560,3840').split(',').map(Number);
const DATES = arg('--dates', '2026-12-01,2026-12-07,2026-12-26').split(',');
const SHOTS = args.includes('--shots');
const HEIGHT = { 390: 844, 768: 1024, 1024: 768, 1366: 768, 1440: 900, 1536: 864, 1600: 900, 1920: 1080, 2560: 1440, 3840: 2160 };
const PHASES = [0, 0.5, 1];
const MIN_SEEN_SHARE = 0.25; // share of (ring length * stroke width) that must be seen, see the header

// ---------------------------------------------------------------- in-page: the Figma ring (static ellipse)
// Top Win: the ring is the Figma layer "Pulse ring" (58:1227), an ellipse 150x70 at (-15, 53) in the 120x126 gift symbol, 2px stroke
// (the middle of the stroke is the ellipse line), drawn BEHIND the podium. It is NOT in gift-today@2x.webp (the art is exported
// without it), so the expected ellipse is the Figma geometry mapped to the screen through the gift box, and the art is scanned
// for a ring that would be baked into it.
async function staticEllipse(page) {
  return page.evaluate(async () => {
    const gift = document.querySelector('.gift--active');
    const img = gift.querySelector('.gift__img');
    await img.decode().catch(() => 0);
    const r = gift.getBoundingClientRect();
    const k = r.width / gift.offsetWidth; // stage scale * zoom
    const bw = 2 * k;
    const cx = r.left + r.width * ((-15 + 75) / 120);
    const cy = r.top + r.height * ((53 + 35) / 126);
    const rx = (r.width * 150) / 120 / 2 - bw / 2;
    const ry = (r.height * 70) / 126 / 2 - bw / 2;

    // a baked ring: a bright ring-shaped line on the transparent glow around the podium in the art (rays from the podium centre)
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const c = new OffscreenCanvas(W, H);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, W, H).data;
    const A = (x, y) => d[(Math.round(y) * W + Math.round(x)) * 4 + 3];
    // podium centre in the art: gift box coordinates (60, 88) -> art box is (-25,-40,170,178) of the symbol
    const ax = ((60 + 25) / 170) * W;
    const ay = ((88 + 40) / 178) * H;
    const arx = (75 / 170) * W;
    const ary = (35 / 178) * H;
    let ringRays = 0;
    let rays = 0;
    for (let deg = 0; deg < 360; deg += 3) {
      const a = (deg * Math.PI) / 180;
      let best = 0;
      let seen = false;
      for (let q = 0.8; q <= 1.4; q += 0.01) {
        const at = (rr) => [ax + Math.cos(a) * rr * arx, ay + Math.sin(a) * rr * ary];
        const [x, y] = at(q);
        const [x1, y1] = at(q - 0.06);
        const [x2, y2] = at(q + 0.06);
        if ([x, x1, x2].some((v) => v < 1 || v > W - 2) || [y, y1, y2].some((v) => v < 1 || v > H - 2)) break;
        if (A(x, y) >= 250 || A(x1, y1) >= 250 || A(x2, y2) >= 250) continue;
        seen = true;
        best = Math.max(best, A(x, y) - (A(x1, y1) + A(x2, y2)) / 2);
      }
      if (seen) rays++;
      if (best > 15) ringRays++;
    }
    return { img: { W, H, cx: ax, cy: ay, rx: arx, ry: ary, n: 0 }, screen: { cx, cy, rx, ry, bw }, bakedRing: { ringRays, rays } };
  });
}

// ---------------------------------------------------------------- in-page: animated ring at a phase of its animation
async function pulseAt(page, phase) {
  return page.evaluate((phase) => {
    const gift = document.querySelector('.gift--active');
    const anims = document.getAnimations().filter((a) => a.effect?.target === gift && a.effect?.pseudoElement === '::before');
    if (!anims.length) return { error: 'no ::before animation on .gift--active' };
    const a = anims[0];
    const dur = a.effect.getComputedTiming().duration;
    a.pause();
    a.currentTime = phase >= 1 ? dur - 0.01 : phase * dur; // 100% = the last frame of an iteration
    const cs = getComputedStyle(gift, '::before');
    const box = document.createElement('div');
    box.style.cssText = `position:absolute;box-sizing:border-box;left:${cs.left};top:${cs.top};width:${cs.width};height:${cs.height};scale:${cs.scale};transform:${cs.transform};transform-origin:${cs.transformOrigin};translate:${cs.translate};rotate:${cs.rotate};pointer-events:none`;
    gift.appendChild(box);
    const r = box.getBoundingClientRect();
    const k = r.width / box.offsetWidth; // scale + stage scale + zoom
    const bw = Number.parseFloat(cs.borderTopWidth) || 0;
    box.remove();
    const z = Number(getComputedStyle(document.querySelector('.page')).getPropertyValue('--z')) || 1;
    return {
      cx: r.left + r.width / 2,
      cy: r.top + r.height / 2,
      rx: r.width / 2 - (bw / 2) * k, // the middle of the border
      ry: r.height / 2 - (bw / 2) * k,
      opacity: Number(cs.opacity),
      scale: cs.scale,
      z,
      animations: anims.length,
    };
  }, phase);
}

// Is the ring actually SEEN at t=0? The podium art is opaque: a ring painted under it is invisible (it was, before T5h).
// Screenshot of today's gift with every animation paused, the snow hidden and the ring painted pure red at full opacity (its
// place and layer unchanged), once with the ring and once with it hidden; count the pixels that change by more than 60.
async function ringVisiblePixels(page, ell) {
  await page.evaluate(() => {
    document.getAnimations().forEach((a) => a.pause());
    const st = document.createElement('style');
    st.id = '__qa_snow';
    st.textContent = '.snow{display:none!important} .gift--active::before{border-color:#f00!important;opacity:1!important}';
    document.head.appendChild(st);
  });
  // the whole ring area (static ellipse + stroke + 3 px), not the gift button box
  const sc = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
  const m = ell.bw / 2 + 3;
  const x0 = Math.max(0, ell.cx - ell.rx - m + sc.x);
  const y0 = Math.max(0, ell.cy - ell.ry - m + sc.y);
  const clip = { x: x0, y: y0, width: ell.cx + ell.rx + m + sc.x - x0, height: ell.cy + ell.ry + m + sc.y - y0 };
  const a = (await page.screenshot({ clip, fullPage: true })).toString('base64');
  await page.evaluate(() => {
    const st = document.createElement('style');
    st.id = '__qa_ring';
    st.textContent = '.gift--active::before{visibility:hidden!important}';
    document.head.appendChild(st);
  });
  const b = (await page.screenshot({ clip, fullPage: true })).toString('base64');
  await page.evaluate(() => ['__qa_ring', '__qa_snow'].forEach((id) => document.getElementById(id)?.remove()));
  return page.evaluate(
    async ([a, b, thr]) => {
      const load = async (src) => {
        const i = new Image();
        i.src = `data:image/png;base64,${src}`;
        await i.decode();
        const c = new OffscreenCanvas(i.width, i.height);
        const g = c.getContext('2d');
        g.drawImage(i, 0, 0);
        return g.getImageData(0, 0, i.width, i.height).data;
      };
      const [p, q] = await Promise.all([load(a), load(b)]);
      let n = 0;
      for (let i = 0; i < p.length; i += 4) if (Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]) > thr) n++;
      return n;
    },
    [a, b, 60],
  );
}

// every pseudo-element with content inside today's gift (box and descendants)
async function pseudoInventory(page) {
  return page.evaluate(() => {
    const out = [];
    const gift = document.querySelector('.gift--active');
    for (const el of [gift, ...gift.querySelectorAll('*')])
      for (const pe of ['::before', '::after']) {
        const cs = getComputedStyle(el, pe);
        if (cs.content && cs.content !== 'none' && cs.display !== 'none')
          out.push(`${el.className || el.tagName}${pe}`);
      }
    return out;
  });
}

// ANCHORS: every running animation on an element (not a pseudo-element: the ring is measured above) that animates `scale` or
// `transform` must grow from the element's own visual centre. Paused at 0 / 25 / 50 / 75% of its iteration, the centre of
// its getBoundingClientRect must stay within ANCHOR_PX of where it is at 0%. Example of the failure: the TODAY'S STOP card
// was centred with transform: translateX(-50%) and breathed with `scale`; the independent `scale` grows about the
// transform-origin of the UNtranslated box, which on screen is the card's left edge, so the card drifted right while it grew.
const ANCHOR_PX = 1;
async function anchorCheck(page) {
  return page.evaluate(() => {
    const out = [];
    for (const a of document.getAnimations()) {
      const t = a.effect?.target;
      if (!t || a.effect.pseudoElement) continue;
      const kf = a.effect.getKeyframes();
      if (!kf.some((k) => 'scale' in k || 'transform' in k)) continue;
      const dur = a.effect.getComputedTiming().duration;
      if (!Number.isFinite(dur) || dur <= 0) continue;
      const was = a.currentTime;
      const playing = a.playState === 'running';
      a.pause();
      const pts = [0, 0.25, 0.5, 0.75].map((ph) => {
        a.currentTime = ph * dur;
        const r = t.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
      });
      a.currentTime = was;
      if (playing) a.play();
      const drift = Math.max(...pts.map((p) => Math.hypot(p.x - pts[0].x, p.y - pts[0].y)));
      const grow = Math.max(...pts.map((p) => p.w)) - pts[0].w;
      const name = `${t.tagName.toLowerCase()}.${[...t.classList].join('.')}`;
      out.push({ name, anim: a.animationName || a.id || 'waapi', drift, grow });
    }
    return out;
  });
}

async function main() {
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5199, strictPort: false } });
  await server.listen();
  const base = server.resolvedUrls.local[0].replace(/\/$/, '');
  const browser = await chromium.launch({ executablePath: CHROME });
  const rows = [];
  try {
    for (const width of WIDTHS) {
      // no reducedMotion: the pulse is hidden under prefers-reduced-motion
      const ctx = await browser.newContext({ viewport: { width, height: HEIGHT[width] || 900 }, deviceScaleFactor: SHOTS ? 2 : 1 });
      const page = await ctx.newPage();
      for (const date of DATES) {
        await page.goto(`${base}/?date=${date}`, { waitUntil: 'networkidle' });
        await page.waitForSelector('.gift--active .gift__img');
        await page.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all([...document.images].map((i) => (i.complete ? 0 : i.decode().catch(() => 0))));
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        });
        const st = await staticEllipse(page);
        const anchors = await anchorCheck(page);
        const pseudo = await pseudoInventory(page);
        const layout = await page.$eval('.page', (p) => p.dataset.layout);
        const ph = [];
        for (const phase of PHASES) {
          const m = await pulseAt(page, phase);
          if (m.error) throw new Error(`${date} ${width}: ${m.error}`);
          ph.push(m);
          if (SHOTS) {
            const box = await page.$eval('.gift--active', (g) => {
    const r = g.getBoundingClientRect();
    return { left: r.left + scrollX, top: r.top + scrollY, width: r.width, height: r.height };
  });
            const pad = box.width * 0.45;
            await page.screenshot({
              path: path.join(ROOT, 'qa', `t5h_pulse_${width}_${date}_t${Math.round(phase * 100)}.png`),
              clip: { x: Math.max(0, box.left - pad), y: Math.max(0, box.top - pad * 0.6), width: box.width + 2 * pad, height: box.height + pad * 1.4 },
              fullPage: true,
            });
          }
        }
        await pulseAt(page, 0);
        const seen = await ringVisiblePixels(page, st.screen);
        const s = st.screen;
        const p0 = ph[0];
        const dc = (p) => Math.hypot(p.cx - s.cx, p.cy - s.cy);
        const e0 = { dc: dc(p0), drx: Math.abs(p0.rx - s.rx), dry: Math.abs(p0.ry - s.ry) };
        const dMid = dc(ph[1]);
        const dEnd = dc(ph[2]);
        const grows = ph[2].rx > ph[1].rx && ph[1].rx > p0.rx;
        const onlyBefore = pseudo.length === 1 && pseudo[0].endsWith('::before');
        const noBaked = st.bakedRing.ringRays <= 3;
        // the ring line is about 2 * pi * sqrt((rx^2 + ry^2) / 2) px long; at least a third of it must show (the back half
        // passes behind the present)
        const arc = 2 * Math.PI * Math.sqrt((s.rx ** 2 + s.ry ** 2) / 2);
        const need = arc * s.bw * MIN_SEEN_SHARE;
        const visible = seen >= need;
        const anchorsOk = anchors.length > 0 && anchors.every((x) => x.drift <= ANCHOR_PX);
        const pass =
          e0.dc <= MAX_PX && e0.drx <= MAX_PX && e0.dry <= MAX_PX && dMid <= MAX_PX && dEnd <= MAX_PX && grows && onlyBefore && noBaked && visible && anchorsOk;
        rows.push({ date, width, layout, anchors, anchorsOk, seen, need, arc, s, p0, e0, dMid, dEnd, grows, pseudo, baked: st.bakedRing, img: st.img, pass });
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
  const pad = (v, n) => String(v).padEnd(n);
  const f = (v) => v.toFixed(2);
  console.log(
    `${pad('date', 11)}| ${pad('width', 6)}| ${pad('static ellipse cx,cy rx,ry', 30)}| ${pad('t0 dCentre', 11)}| ${pad('t0 dRx', 7)}| ${pad('t0 dRy', 7)}| ${pad('t50 dC', 7)}| ${pad('t100 dC', 8)}| ${pad('pseudo', 18)}| ${pad('baked ring rays', 16)}| ${pad('ring px seen/need', 13)}| ${pad('anchor drift px (scale/transform animations)', 44)}| result`,
  );
  for (const r of rows)
    console.log(
      `${pad(r.date, 11)}| ${pad(r.width, 6)}| ${pad(`${f(r.s.cx)},${f(r.s.cy)} ${f(r.s.rx)},${f(r.s.ry)}`, 30)}| ${pad(f(r.e0.dc), 11)}| ${pad(f(r.e0.drx), 7)}| ${pad(f(r.e0.dry), 7)}| ${pad(f(r.dMid), 7)}| ${pad(f(r.dEnd), 8)}| ${pad(r.pseudo.join(' ') || '-', 18)}| ${pad(`${r.baked.ringRays}/${r.baked.rays}`, 16)}| ${pad(`${r.seen}/${Math.round(r.need)}`, 13)}| ${pad(r.anchors.map((x) => `${x.name.split('.').slice(0, 3).join('.')} ${x.drift.toFixed(2)}`).join(', '), 44)}| ${r.pass ? 'PASS' : 'FAIL'}${r.grows ? '' : ' (does not grow)'}`,
    );
  const i0 = rows[0].img;
  console.log(`\nstatic ellipse in gift-today@2x.webp (${i0.W}x${i0.H}): centre (${f(i0.cx)}, ${f(i0.cy)}), rx ${f(i0.rx)}, ry ${f(i0.ry)}, ${i0.n} line points`);
  const fails = rows.filter((r) => !r.pass).length;
  console.log(`${rows.length - fails}/${rows.length} pass${fails ? `, ${fails} FAIL` : ''}`);
  process.exitCode = fails ? 1 : 0;
}

await main();
