// Numeric check: today's pulse ring starts ON the thin yellow ellipse drawn on the podium's top face and grows concentrically.
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

// ---------------------------------------------------------------- in-page: static ellipse from the image pixels
async function staticEllipse(page) {
  return page.evaluate(async () => {
    const img = document.querySelector('.gift--active .gift__img');
    await img.decode().catch(() => 0);
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const c = new OffscreenCanvas(W, H);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, W, H).data;
    const px = (x, y) => {
      const i = (Math.round(y) * W + Math.round(x)) * 4;
      return [d[i], d[i + 1], d[i + 2], d[i + 3]];
    };
    const lum = (x, y) => {
      const q = px(x, y);
      return q[0] + q[1] + q[2];
    };
    const podium = (x, y) => {
      const q = px(x, y);
      return q[3] >= 250 && q[0] > 150 && q[1] > 110 && q[2] < 200; // gold / cream, not the red gift
    };
    const fit = (pts) => {
      // least squares, axis-aligned: x^2 + B y^2 + C x + D y + E = 0
      const M = Array.from({ length: 4 }, () => Array(5).fill(0));
      for (const q of pts) {
        const r = [q.y * q.y, q.x, q.y, 1, -q.x * q.x];
        for (let i = 0; i < 4; i++) {
          for (let j = 0; j < 4; j++) M[i][j] += r[i] * r[j];
          M[i][4] += r[i] * r[4];
        }
      }
      for (let i = 0; i < 4; i++) {
        const pv = M[i][i];
        for (let j = i; j < 5; j++) M[i][j] /= pv;
        for (let k = 0; k < 4; k++)
          if (k !== i) {
            const f = M[k][i];
            for (let j = i; j < 5; j++) M[k][j] -= f * M[i][j];
          }
      }
      const [B, C, D, E] = M.map((r) => r[4]);
      const cx = -C / 2;
      const cy = -D / (2 * B);
      const F = cx * cx + B * cy * cy - E;
      return { cx, cy, rx: Math.sqrt(F), ry: Math.sqrt(F / B), n: pts.length };
    };
    // seed: middle of the podium's top face (fractions of the image), refined by the fit
    const E0 = { cx: W * 0.5, cy: H * 0.597, rx: W * 0.212, ry: H * 0.102 };
    const pts = [];
    for (let deg = 0; deg < 360; deg++) {
      const a = (deg * Math.PI) / 180;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      const k = 6 / Math.hypot(ux * E0.rx, uy * E0.ry);
      let best = null;
      for (let r = 0.85; r <= 1.15; r += 0.002) {
        const at = (rr) => [E0.cx + ux * rr * E0.rx, E0.cy + uy * rr * E0.ry];
        const [x, y] = at(r);
        const [x1, y1] = at(r - k);
        const [x2, y2] = at(r + k);
        if (!podium(x, y) || !podium(x1, y1) || !podium(x2, y2)) continue;
        const ex = lum(x, y) - (lum(x1, y1) + lum(x2, y2)) / 2;
        if (!best || ex > best.ex) best = { ex, x, y };
      }
      if (best && best.ex > 40) pts.push(best);
    }
    const e = fit(pts);

    // leftover ring baked into the art: a bright ring-shaped line on the transparent glow outside the podium
    const A = (x, y) => px(x, y)[3];
    let ringRays = 0;
    let rays = 0;
    for (let deg = 0; deg < 360; deg += 3) {
      const a = (deg * Math.PI) / 180;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      let best = 0;
      let seen = false;
      for (let r = 1.3; r <= 4; r += 0.01) {
        const x = e.cx + ux * r * e.rx;
        const y = e.cy + uy * r * e.ry;
        const x1 = e.cx + ux * (r - 0.06) * e.rx;
        const y1 = e.cy + uy * (r - 0.06) * e.ry;
        const x2 = e.cx + ux * (r + 0.06) * e.rx;
        const y2 = e.cy + uy * (r + 0.06) * e.ry;
        if ([x, x1, x2].some((v) => v < 1 || v > W - 2) || [y, y1, y2].some((v) => v < 1 || v > H - 2)) break;
        if (A(x, y) >= 250 || A(x1, y1) >= 250 || A(x2, y2) >= 250) continue;
        seen = true;
        best = Math.max(best, A(x, y) - (A(x1, y1) + A(x2, y2)) / 2);
      }
      if (seen) rays++;
      if (best > 15) ringRays++;
    }

    const r = img.getBoundingClientRect();
    const sx = r.width / W;
    const sy = r.height / H;
    return {
      img: { W, H, ...e },
      screen: { cx: r.left + e.cx * sx, cy: r.top + e.cy * sy, rx: e.rx * sx, ry: e.ry * sy },
      bakedRing: { ringRays, rays },
    };
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
async function ringVisiblePixels(page) {
  await page.evaluate(() => {
    document.getAnimations().forEach((a) => a.pause());
    const st = document.createElement('style');
    st.id = '__qa_snow';
    st.textContent = '.snow{display:none!important} .gift--active::before{border-color:#f00!important;opacity:1!important}';
    document.head.appendChild(st);
  });
  const box = await page.$eval('.gift--active', (g) => {
    const r = g.getBoundingClientRect();
    return { left: r.left + scrollX, top: r.top + scrollY, width: r.width, height: r.height };
  });
  const clip = { x: Math.max(0, box.left), y: Math.max(0, box.top), width: box.width, height: box.height };
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
        const seen = await ringVisiblePixels(page);
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
        const visible = seen >= arc / 3;
        const anchorsOk = anchors.length > 0 && anchors.every((x) => x.drift <= ANCHOR_PX);
        const pass =
          e0.dc <= MAX_PX && e0.drx <= MAX_PX && e0.dry <= MAX_PX && dMid <= MAX_PX && dEnd <= MAX_PX && grows && onlyBefore && noBaked && visible && anchorsOk;
        rows.push({ date, width, layout, anchors, anchorsOk, seen, arc, s, p0, e0, dMid, dEnd, grows, pseudo, baked: st.bakedRing, img: st.img, pass });
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
    `${pad('date', 11)}| ${pad('width', 6)}| ${pad('static ellipse cx,cy rx,ry', 30)}| ${pad('t0 dCentre', 11)}| ${pad('t0 dRx', 7)}| ${pad('t0 dRy', 7)}| ${pad('t50 dC', 7)}| ${pad('t100 dC', 8)}| ${pad('pseudo', 18)}| ${pad('baked ring rays', 16)}| ${pad('ring px seen', 13)}| ${pad('anchor drift px (scale/transform animations)', 44)}| result`,
  );
  for (const r of rows)
    console.log(
      `${pad(r.date, 11)}| ${pad(r.width, 6)}| ${pad(`${f(r.s.cx)},${f(r.s.cy)} ${f(r.s.rx)},${f(r.s.ry)}`, 30)}| ${pad(f(r.e0.dc), 11)}| ${pad(f(r.e0.drx), 7)}| ${pad(f(r.e0.dry), 7)}| ${pad(f(r.dMid), 7)}| ${pad(f(r.dEnd), 8)}| ${pad(r.pseudo.join(' ') || '-', 18)}| ${pad(`${r.baked.ringRays}/${r.baked.rays}`, 16)}| ${pad(`${r.seen}/${Math.round(r.arc)}`, 13)}| ${pad(r.anchors.map((x) => `${x.name.split('.').slice(0, 3).join('.')} ${x.drift.toFixed(2)}`).join(', '), 44)}| ${r.pass ? 'PASS' : 'FAIL'}${r.grows ? '' : ' (does not grow)'}`,
    );
  const i0 = rows[0].img;
  console.log(`\nstatic ellipse in gift-today@2x.webp (${i0.W}x${i0.H}): centre (${f(i0.cx)}, ${f(i0.cy)}), rx ${f(i0.rx)}, ry ${f(i0.ry)}, ${i0.n} line points`);
  const fails = rows.filter((r) => !r.pass).length;
  console.log(`${rows.length - fails}/${rows.length} pass${fails ? `, ${fails} FAIL` : ''}`);
  process.exitCode = fails ? 1 : 0;
}

await main();
