// Numeric check (mobile): the vertical MIDDLE of every route label equals the vertical MIDDLE of its gift (owner 2026-11-19, ported
// from Jackpot commits 38af0f5 / 5ec1c40, TW owner decision 2026-11-23).
//
//   node scripts/check-label-centre.mjs --mobile [--widths=320,360,390,430] [--markets=DE,NL] [--dates=before,1-26,ended]
//                                       [--ended] [--active-only] [--out=FILE.json] [--shots=DIR]
//
// --widths: one or more mobile widths (default 320,360,390,430), each a FRESH page load per market x date (no resize).
// --dates:  comma list of "before" (2026-11-25, campaign not started: every label locked), a day or day range of December
//           ("1-26", "8"), and "ended" (2026-12-28, campaign over: every label past). Default: before,1-26,ended (all 28 dates).
// --ended:  the campaign-ended page only, same as --dates=ended (Jackpot b25df2a; check-texts --ended uses the same date).
// --mobile: phone emulation (touch, overlay scrollbars => the stage gets the full viewport width like a real phone, DPR 3).
// For every width x market x date it opens ?date=...&market=XX (mobile layout), pauses every animation (finite ones such as the
// day's unlock at their end, today's endless label breathing at t = 0 = scale 1) and measures:
//   label middle  = middle of the label box (getBoundingClientRect: stage scale and zoom included)
//   gift middle   = middle of the OPAQUE art of the gift (alpha > 128 in the gift image's own pixels; today's gift: the art plus the
//                   present drawn on top of it, .gift__front), mapped to the screen through the <img> box. The TODAY pill is a
//                   separate element and is NOT part of it.
//   delta         = label middle - gift middle (positive = label sits lower than the gift)
//   giftMidRel    = gift middle in STAGE units from the pedestal centre py (gift box top + 80 k): the number src/render/route.js
//                   keeps in MOBILE.giftMid per state. Printed as min / max per state so it can be set from a run.
// What each label should do comes from src/render/route.js itself (mobileLabelPlacement(state, slot), loaded through Vite):
//   centred                     -> |delta| <= TOL
//   centred + raised            -> delta = lower x stage scale (within TOL; lower < 0: the slot-0 past label, raised pastSlot0Raise)
//   top-pinned                  -> not centred on purpose (Santa clearance), reported as "expected", not a failure
// Overlaps of every label (part of the exit code, see below): opaque art of ANY gift under the label box, the TODAY pill (pixel truth
// for today's label: screenshot with the label hidden / shown; rectangles for the others), Santa's OPAQUE silhouette (his PNG pixels
// pushed through the browser's own transforms, as in check-santa.mjs) inside the label box, and other labels.
// SANTA CLEARANCE is printed per state x slot x Santa mode: the smallest gap (px, negative = his silhouette reaches that far INTO
// the label box) between his opaque art and the label box. It is the measurement behind the top-pinned / raised exceptions.
// Exit code 1 when a label that should be centred (or raised) is not, or on any overlap: gift art, TODAY pill, another label, Santa
// inside a PAST / FUTURE label box. TODAY's label touching Santa (Dec 1 all markets, Dec 26 all markets (the holly; DE also the box), some long names on Dec 2-25 at
// 320-360) is listed as "accepted (owner 2026-11-23, like JP)": the label stays exactly centred and Santa stays where he is, as on
// Jackpot, where his board touches today's label on long names too. Playwright is not a project dependency: PLAYWRIGHT_MODULE /
// CHROME as in check-santa.mjs.
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
const WIDTHS = (arg('widths') || arg('width') || '320,360,390,430').split(',').map(Number);
const ONLY = arg('markets')?.split(',');
const ACTIVE_ONLY = args.includes('--active-only');
const OUT = arg('out');
const SHOTS = arg('shots');
const TOL = 1; // px
const MOBILE_EMU = args.includes('--mobile');
const DATES = (args.includes('--ended') ? 'ended' : arg('dates') || 'before,1-26,ended').split(',').flatMap((p) => {
  if (p === 'before') return [{ key: 'before', date: '2026-11-25' }];
  if (p === 'ended') return [{ key: 'ended', date: '2026-12-28' }];
  const [a, b = a] = p.split('-').map(Number);
  return Array.from({ length: b - a + 1 }, (_, i) => ({ key: `d${a + i}`, date: `2026-12-${String(a + i).padStart(2, '0')}` }));
});
const MARKETS = fs
  .readdirSync(path.join(ROOT, 'data', 'cards'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace('.json', ''))
  .filter((m) => !ONLY || ONLY.includes(m));

/** In the page: every label with its gift, Santa's silhouette and what each label covers. */
async function measure() {
  // finite animations (the day's unlock: Santa slides in from yesterday's spot, fade-ins) at their END, the endless ones (today's
  // label breathing) at t = 0 = scale 1. Pausing the unlock at t = 0 would measure Santa at yesterday's spot.
  document.getAnimations().forEach((a) => {
    const t = a.effect.getComputedTiming();
    a.pause();
    a.currentTime = Number.isFinite(t.endTime) ? t.endTime : 0;
  });
  const maskCache = new Map();
  const maskOf = async (img) => {
    const src = img.currentSrc || img.src;
    if (maskCache.has(src)) return maskCache.get(src);
    await img.decode().catch(() => 0);
    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const c = new OffscreenCanvas(W, H);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, W, H).data;
    let x0 = W;
    let y0 = H;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (d[(y * W + x) * 4 + 3] > 128) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    const m = { W, H, d, x0, y0, x1, y1 };
    maskCache.set(src, m);
    return m;
  };
  const R = (el) => {
    const r = el.getBoundingClientRect();
    return { l: r.left, t: r.top, r: r.right, b: r.bottom };
  };
  const inter = (a, b) => {
    const w = Math.min(a.r, b.r) - Math.max(a.l, b.l);
    const h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
    return w > 0 && h > 0 ? { w, h, a: w * h } : null;
  };
  // opaque art box of one <img> on screen
  const artOf = async (img) => {
    const m = await maskOf(img);
    const ib = img.getBoundingClientRect();
    const sx = ib.width / m.W;
    const sy = ib.height / m.H;
    return { m, ib, sx, sy, box: { l: ib.left + m.x0 * sx, r: ib.left + (m.x1 + 1) * sx, t: ib.top + m.y0 * sy, b: ib.top + (m.y1 + 1) * sy } };
  };
  const labels = [...document.querySelectorAll('.label')];
  const extOf = (lab) => {
    const e = R(lab);
    for (const d of lab.querySelectorAll('*')) {
      const q = R(d);
      if (q.r - q.l <= 0 || q.b - q.t <= 0) continue;
      e.l = Math.min(e.l, q.l);
      e.t = Math.min(e.t, q.t);
      e.r = Math.max(e.r, q.r);
      e.b = Math.max(e.b, q.b);
    }
    return e;
  };
  const gifts = [];
  for (const g of document.querySelectorAll('.gift')) {
    for (const im of g.querySelectorAll('.gift__img, .gift__front')) {
      const a = await artOf(im);
      gifts.push({ day: Number(g.dataset.open), m: a.m, ib: a.ib, sx: a.sx, sy: a.sy });
    }
  }

  // Santa's opaque silhouette on screen (grid every 3 px of his PNG), through the browser's own transforms (rotation, mirror, scale, zoom)
  const santaEl = document.querySelector('.santa');
  const sil = [];
  if (santaEl) {
    const img = santaEl.querySelector('.santa__art');
    await img.decode().catch(() => 0);
    const cs = getComputedStyle(img);
    const box = document.createElement('div');
    box.style.cssText = `position:absolute;left:${cs.left};top:${cs.top};width:${img.offsetWidth}px;height:${img.offsetHeight}px;transform:${cs.transform};transform-origin:${cs.transformOrigin};margin:${cs.margin};pointer-events:none`;
    santaEl.appendChild(box);
    const kx = img.offsetWidth / img.naturalWidth;
    const ky = img.offsetHeight / img.naturalHeight;
    const c = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const marks = [];
    for (let y = 0; y < c.height; y += 3)
      for (let x = 0; x < c.width; x += 3)
        if (d[(y * c.width + x) * 4 + 3] > 160) {
          const m = document.createElement('i');
          m.style.cssText = `position:absolute;left:${x * kx}px;top:${y * ky}px;width:0;height:0`;
          box.appendChild(m);
          marks.push(m);
        }
    for (const m of marks) {
      const r = m.getBoundingClientRect();
      sil.push({ x: r.left, y: r.top });
    }
    box.remove();
  }
  const santaMode = santaEl?.dataset.santaMode || '';

  const out = [];
  let slot = -1;
  for (const lab of labels) {
    slot++;
    const day = Number(lab.dataset.open);
    const gift = document.querySelector(`.gift[data-open="${day}"]`);
    const state = lab.classList.contains('label--active') ? 'active' : lab.classList.contains('label--missed') ? 'missed' : 'locked';
    // gift art = union of the opaque boxes of the art and (today) the present drawn over it
    let art = null;
    for (const im of gift.querySelectorAll('.gift__img, .gift__front')) {
      const a = (await artOf(im)).box;
      art = art ? { l: Math.min(art.l, a.l), t: Math.min(art.t, a.t), r: Math.max(art.r, a.r), b: Math.max(art.b, a.b) } : a;
    }
    const lb = R(lab);
    const rec = { day, slot, state, santaMode, labelMid: (lb.t + lb.b) / 2, giftMid: (art.t + art.b) / 2, labelH: lb.b - lb.t, labelBox: lb, art };
    rec.delta = rec.labelMid - rec.giftMid;
    {
      const k = Number(gift.style.getPropertyValue('--k'));
      const gb = gift.getBoundingClientRect();
      const st = gb.width / (120 * k);
      rec.giftMidRel = (rec.giftMid - gb.top) / st - 80 * k;
      rec.st = st; // CSS px per stage px
    }
    {
      const ext = extOf(lab);
      rec.extBox = ext;
      let px = 0;
      const perGift = [];
      for (const g of gifts) {
        let n = 0;
        const gm = g.m;
        const gb = g.ib;
        if (inter(lb, { l: gb.left, t: gb.top, r: gb.right, b: gb.bottom })) {
          const L = Math.max(lb.l, gb.left);
          const T = Math.max(lb.t, gb.top);
          for (let y = T; y < Math.min(lb.b, gb.bottom); y += 0.5)
            for (let x = L; x < Math.min(lb.r, gb.right); x += 0.5) {
              const ux = Math.floor((x - gb.left) / g.sx);
              const uy = Math.floor((y - gb.top) / g.sy);
              if (ux >= 0 && uy >= 0 && ux < gm.W && uy < gm.H && gm.d[(uy * gm.W + ux) * 4 + 3] > 128) n += 0.25;
            }
        }
        if (n > 0) perGift.push({ day: g.day, px: n });
        px += n;
      }
      rec.cover = { giftArtPx: px, giftArt: perGift };
      const pill = document.querySelector('.gift--active .today-pill');
      const pi = pill ? inter(ext, R(pill)) : null;
      rec.cover.pill = pi ? pi.a : 0;
      rec.pillBox = pill ? R(pill) : null;
      rec.cover.other = labels
        .filter((o) => o !== lab)
        .map((o) => ({ day: Number(o.dataset.open), a: inter(ext, extOf(o))?.a || 0 }))
        .filter((o) => o.a > 0);
      // Santa: silhouette points inside the label box (and how deep), or the smallest gap to it
      let inside = 0;
      let depth = 0;
      let gap = Infinity;
      for (const p of sil) {
        const dx = Math.max(lb.l - p.x, 0, p.x - lb.r);
        const dy = Math.max(lb.t - p.y, 0, p.y - lb.b);
        if (dx === 0 && dy === 0) {
          inside++;
          depth = Math.max(depth, Math.min(p.x - lb.l, lb.r - p.x, p.y - lb.t, lb.b - p.y));
        } else gap = Math.min(gap, Math.hypot(dx, dy));
      }
      rec.cover.santa = { inside, depth, gap: inside ? -depth : gap };
    }
    out.push(rec);
  }
  return out;
}

/**
 * Pixel truth, Santa vs TODAY's label with everything it paints (box, holly, snow cap, garland bulbs): two screenshots of the area
 * around both on a transparent page, one with only Santa's art visible, one with only today's label, CSS filters off (his glow and
 * the label's drop shadow are not counted). Painted = alpha > 128. Returns the smallest distance between a Santa pixel and a label pixel (CSS px; 0 = touching or
 * overlapping) and how many device pixels both paint. Animations stay paused as measure() left them.
 */
async function santaLabelPixels(page) {
  const area = await page.evaluate(() => {
    const u = (els) => {
      const e = { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity };
      for (const el of els) {
        const q = el.getBoundingClientRect();
        if (!q.width || !q.height) continue;
        e.l = Math.min(e.l, q.left);
        e.t = Math.min(e.t, q.top);
        e.r = Math.max(e.r, q.right);
        e.b = Math.max(e.b, q.bottom);
      }
      return e;
    };
    const lab = document.querySelector('.label--active');
    const santa = document.querySelector('.santa__art');
    if (!lab || !santa) return null;
    const a = u([lab, ...lab.querySelectorAll('*')]);
    const s = u([santa]);
    const i = { l: Math.max(a.l, s.l) - 20, t: Math.max(a.t, s.t) - 20, r: Math.min(a.r, s.r) + 20, b: Math.min(a.b, s.b) + 20 };
    if (i.r <= i.l || i.b <= i.t) return { far: true };
    const W = document.documentElement.clientWidth;
    return { x: Math.max(0, i.l), y: Math.max(0, i.t), width: Math.min(W, i.r) - Math.max(0, i.l), height: i.b - Math.max(0, i.t) };
  });
  if (!area) return null;
  if (area.far) return { gap: 20, both: 0 }; // more than 20 px apart in x or y
  // keep the page scroll where it is: clip is in page coordinates = viewport coordinates at scroll 0
  const scroll = await page.evaluate(() => window.scrollY);
  const clip = { ...area, y: area.y + scroll };
  const only = async (sel) => {
    // filters off: Santa's soft glow (drop-shadow up to alpha 0.55) and the label's drop shadow are not the art itself
    const tag = await page.addStyleTag({ content: `html,body{background:transparent!important}body *{visibility:hidden!important}${sel}{visibility:visible!important;filter:none!important}` });
    const png = await page.screenshot({ clip, omitBackground: true });
    await tag.evaluate((el) => el.remove());
    return png.toString('base64');
  };
  const s = await only('.santa__art');
  const l = await only('.label--active,.label--active *');
  return page.evaluate(async ([a, b, cssW]) => {
    const ld = async (src) => {
      const i = new Image();
      i.src = 'data:image/png;base64,' + src;
      await i.decode();
      const c = new OffscreenCanvas(i.width, i.height);
      const g = c.getContext('2d');
      g.drawImage(i, 0, 0);
      return { w: i.width, h: i.height, d: g.getImageData(0, 0, i.width, i.height).data };
    };
    const [S, L] = await Promise.all([ld(a), ld(b)]);
    const { w, h } = S;
    const dpr = w / cssW;
    // distance (device px, chamfer 3-4) from every Santa pixel, then the smallest value under a label pixel
    const INF = 1e9;
    const dist = new Float64Array(w * h).fill(INF);
    for (let i = 0; i < w * h; i++) if (S.d[i * 4 + 3] > 128) dist[i] = 0;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (x > 0) dist[i] = Math.min(dist[i], dist[i - 1] + 1);
        if (y > 0) dist[i] = Math.min(dist[i], dist[i - w] + 1);
        if (x > 0 && y > 0) dist[i] = Math.min(dist[i], dist[i - w - 1] + Math.SQRT2);
        if (x < w - 1 && y > 0) dist[i] = Math.min(dist[i], dist[i - w + 1] + Math.SQRT2);
      }
    for (let y = h - 1; y >= 0; y--)
      for (let x = w - 1; x >= 0; x--) {
        const i = y * w + x;
        if (x < w - 1) dist[i] = Math.min(dist[i], dist[i + 1] + 1);
        if (y < h - 1) dist[i] = Math.min(dist[i], dist[i + w] + 1);
        if (x < w - 1 && y < h - 1) dist[i] = Math.min(dist[i], dist[i + w + 1] + Math.SQRT2);
        if (x > 0 && y < h - 1) dist[i] = Math.min(dist[i], dist[i + w - 1] + Math.SQRT2);
      }
    let gap = INF;
    let both = 0;
    for (let i = 0; i < w * h; i++)
      if (L.d[i * 4 + 3] > 128) {
        if (dist[i] === 0) both++;
        gap = Math.min(gap, dist[i]);
      }
    // gap between the two pixel edges: centre distance minus one pixel
    return { gap: gap >= INF ? Infinity : Math.max(0, gap - 1) / dpr, both };
  }, [s, l, area.width]);
}

async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => (i.complete ? 0 : i.decode().catch(() => 0))));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
}

async function main() {
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5197, strictPort: false } });
  await server.listen();
  const base = server.resolvedUrls.local[0].replace(/\/$/, '');
  // what each label should do, from the page code itself
  const route = await server.ssrLoadModule('/src/render/route.js');
  const placement = route.mobileLabelPlacement;
  if (!placement) console.log('note: src/render/route.js has no mobileLabelPlacement(): raw deltas only, nothing is judged');
  const browser = await chromium.launch({ executablePath: CHROME });
  const rows = [];
  try {
    for (const width of WIDTHS) {
      const ctx = await browser.newContext({
        viewport: { width, height: 844 },
        deviceScaleFactor: SHOTS ? 2 : MOBILE_EMU ? 3 : 1,
        ...(MOBILE_EMU ? { isMobile: true, hasTouch: true } : {}),
      });
      const page = await ctx.newPage();
      for (const market of MARKETS)
        for (const { key, date } of DATES) {
          await page.goto(`${base}/?date=${date}&market=${market}`, { waitUntil: 'networkidle' });
          await page.waitForSelector('.label');
          await settle(page);
          const layout = await page.$eval('.page', (p) => p.dataset.layout);
          if (layout !== 'mobile') throw new Error(`${market} ${date} ${width}: layout ${layout}`);
          if (SHOTS) {
            // finished entrance animations (fade-ins at their end), the breathing label at its rest size
            await page.evaluate(() =>
              document.getAnimations().forEach((a) => {
                const t = a.effect.getComputedTiming();
                a.pause();
                a.currentTime = Number.isFinite(t.endTime) ? t.endTime : 0;
              }),
            );
            fs.mkdirSync(SHOTS, { recursive: true });
            await page.locator('.route-wrap').screenshot({ path: path.join(SHOTS, `${market}_${key}_${width}.png`) });
          }
          const res = await page.evaluate(measure);
          // pixel truth for the pill: the label box is a rounded rectangle and the pill a capsule, so a rectangle touch can be empty.
          const act = res.find((r) => r.state === 'active');
          if (act) act.cover.santaPx = await santaLabelPixels(page); // before the pill test: that one hides the label for good
          if (act && act.cover.pill > 0) {
            const pb = act.pillBox;
            const clip = { x: Math.max(0, pb.l), y: Math.max(0, pb.t), width: pb.r - pb.l, height: pb.b - pb.t };
            await page.addStyleTag({ content: '.snow{display:none!important}.label--active{box-shadow:none!important;filter:none!important}' });
            const shotA = await page.screenshot({ clip });
            await page.addStyleTag({ content: '.label--active{visibility:hidden!important}' });
            const shotB = await page.screenshot({ clip });
            act.cover.pillPx = await page.evaluate(async ([a, b]) => {
              const ld = async (s) => {
                const i = new Image();
                i.src = 'data:image/png;base64,' + s;
                await i.decode();
                const c = new OffscreenCanvas(i.width, i.height);
                const g = c.getContext('2d');
                g.drawImage(i, 0, 0);
                return g.getImageData(0, 0, i.width, i.height).data;
              };
              const [p, q] = await Promise.all([ld(a), ld(b)]);
              let n = 0;
              for (let i = 0; i < p.length; i += 4) if (Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]) > 60) n++;
              return n;
            }, [shotA.toString('base64'), shotB.toString('base64')]);
          } else if (act) act.cover.pillPx = 0;
          for (const r of res) if (!ACTIVE_ONLY || r.state === 'active') rows.push({ width, market, date: key, ...r });
        }
      await ctx.close();
      console.log(`width ${width}: done`);
    }
  } finally {
    await browser.close();
    await server.close();
  }
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ widths: WIDTHS, rows }));
  const f = (v) => (Number.isFinite(v) ? v.toFixed(2) : String(v));
  console.log(`${rows.length} labels measured (${WIDTHS.join('/')} x ${MARKETS.length} markets x ${DATES.length} dates)`);

  // gift art middles (stage units from the pedestal centre), per state: the values MOBILE.giftMid should hold
  for (const st of ['active', 'missed', 'locked']) {
    const v = rows.filter((r) => r.state === st).map((r) => r.giftMidRel);
    if (v.length) console.log(`giftMidRel ${st.padEnd(6)} n=${String(v.length).padEnd(5)} min ${v.reduce((a, b) => Math.min(a, b)).toFixed(3)} max ${v.reduce((a, b) => Math.max(a, b)).toFixed(3)} mean ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(3)}`);
  }

  // centring verdict, per label, from mobileLabelPlacement(state, slot) in route.js
  let fails = 0;
  const groups = new Map();
  for (const r of rows) {
    const p = placement ? placement(r.state, r.slot) : null;
    let kind = 'raw';
    let want = 0;
    if (p && !p.centred) kind = 'top-pinned (expected, not centred)';
    else if (p && p.lower) {
      kind = p.lower > 0 ? `lowered ${p.lower}` : `raised ${-p.lower}`;
      want = p.lower * r.st;
    } else if (p) kind = 'centred';
    r.want = want;
    r.err = r.delta - want;
    r.kind = kind;
    if (p && p.centred && Math.abs(r.err) > TOL) {
      fails++;
      if (fails <= 40) console.log(`  FAIL ${r.width} ${r.market} ${r.date} ${r.state} slot ${r.slot}: delta ${f(r.delta)} px, want ${f(want)}`);
    }
    const k = `${String(r.width).padEnd(4)} ${r.state.padEnd(6)} slot ${r.slot} [${kind}]`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  console.log('\nCENTRING (err = label middle - gift middle - wanted offset, px)');
  for (const [k, v] of [...groups].sort()) {
    const e = v.map((r) => Math.abs(r.err));
    console.log(`  ${k.padEnd(56)} n=${String(v.length).padEnd(4)} max |err| ${f(Math.max(...e))}  mean ${f(e.reduce((a, b) => a + b, 0) / e.length)}  (delta ${f(Math.min(...v.map((r) => r.delta)))}..${f(Math.max(...v.map((r) => r.delta)))})`);
  }

  // Santa clearance: smallest gap between his opaque art and each label box, by label state x slot x his mode
  console.log('\nSANTA CLEARANCE (min gap px from his opaque art to the label box; negative = that deep inside the box)');
  const sg = new Map();
  for (const r of rows) {
    const k = `${String(r.width).padEnd(4)} santa ${r.santaMode.padEnd(6)} ${r.state.padEnd(6)} slot ${r.slot}`;
    const cur = sg.get(k);
    if (!cur || r.cover.santa.gap < cur.gap) sg.set(k, { gap: r.cover.santa.gap, at: `${r.market} ${r.date}`, n: (cur?.n || 0) + 1 });
    else cur.n++;
  }
  for (const [k, v] of [...sg].sort()) if (v.gap < 12) console.log(`  ${k.padEnd(40)} min gap ${f(v.gap).padStart(7)} (${v.at})${v.gap < 0 ? '  <-- INSIDE' : ''}`);
  console.log('  (pairs with every gap >= 12 px not listed)');
  // pixel truth: Santa's painted pixels vs everything today's label paints (box, holly, snow cap, garland bulbs)
  console.log("\nSANTA vs TODAY'S LABEL, PIXELS (box + holly + snow cap + garland; smallest gap between painted pixels, CSS px; 0 = touching)");
  for (const w of WIDTHS)
    for (const s of [0, 1, 2]) {
      const v = rows.filter((r) => r.width === w && r.state === 'active' && r.slot === s && r.cover.santaPx);
      if (!v.length) continue;
      const m = v.reduce((a, b) => (b.cover.santaPx.gap < a.cover.santaPx.gap ? b : a));
      const g = m.cover.santaPx.gap;
      const under1 = v.filter((r) => r.cover.santaPx.gap < 1).length;
      console.log(`  ${w} slot ${s}: min ${g >= 20 ? '>= 20' : f(g)} px (${m.market} ${m.date}), < 1 px in ${under1}/${v.length}, overlapping pixels max ${Math.max(...v.map((r) => r.cover.santaPx.both))}`);
    }

  // today's label touching Santa: accepted (owner 2026-11-23, like Jackpot), listed, not counted
  const accepted = rows.filter((r) => r.state === 'active' && (r.cover.santa.inside > 0 || (r.cover.santaPx && r.cover.santaPx.gap < 1)));
  console.log(`\nTODAY'S LABEL TOUCHING SANTA: ${accepted.length} - accepted (owner 2026-11-23, like JP: label exactly centred, Santa unchanged)`);
  for (const r of accepted.slice(0, 40))
    console.log(`  accepted ${r.width} ${r.market} ${r.date} slot ${r.slot}: box ${r.cover.santa.inside ? `${f(r.cover.santa.depth)} px inside his art` : `${f(r.cover.santa.gap)} px away`}, painted gap ${f(r.cover.santaPx.gap)} px, overlapping device px ${r.cover.santaPx.both}`);
  // every other overlap is a failure: opaque art of any gift under a label, the TODAY pill, Santa inside a past / future label box, another label
  const bad = rows.filter(
    (r) => r.cover.giftArtPx > 0.5 || (r.state === 'active' ? (r.cover.pillPx ?? 0) > 0 : r.cover.pill > 0) || (r.state !== 'active' && r.cover.santa.inside > 0) || r.cover.other.length,
  );
  console.log(`\nOVERLAPS, FAIL (gift art px>0.5 | TODAY pill | Santa silhouette in a past / future label box | other label): ${bad.length} (active ${bad.filter((r) => r.state === 'active').length}, missed ${bad.filter((r) => r.state === 'missed').length}, locked ${bad.filter((r) => r.state === 'locked').length})`);
  for (const r of bad.slice(0, 80))
    console.log(`  ${r.width} ${r.market} ${r.date} ${r.state} slot ${r.slot} (label day ${r.day}): art ${f(r.cover.giftArtPx)}px2 ${JSON.stringify(r.cover.giftArt)}, pill ${f(r.state === 'active' ? r.cover.pillPx : r.cover.pill)}, santa in ${r.cover.santa.inside} pts depth ${f(r.cover.santa.depth)}, other ${JSON.stringify(r.cover.other)}`);
  console.log(`\nCENTRING FAILS: ${fails}   OVERLAP FAILS: ${bad.length}   accepted today-label touches: ${accepted.length}`);
  process.exitCode = fails || bad.length ? 1 : 0;
}

await main();
