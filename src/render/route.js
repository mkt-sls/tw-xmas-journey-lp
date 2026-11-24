// The route map: a fixed window of days (5 on desktop, 3 on mobile) on a fixed coordinate stage.
// Positions come from the Figma Main frames (desktop 1920 / mobile 390). The state styling follows the
// DAY (missed / active / locked); the position follows the SLOT.
import { CAMPAIGN } from '../config.js';
import { dayDate, dayState, formatCountdown, nextUnlock, relativeKey, secondsUntil, visibleDays } from '../date.js';
import { fill, longDate, shortDate } from '../i18n.js';
import { ARROW_SVG, asset, esc, escNb, nb } from './util.js';

const DESKTOP = {
  size: 5,
  width: 1920,
  height: 735,
  x: [220, 590, 960, 1330, 1700],
  py: [454, 375, 447, 375, 454], // centre of each pedestal
  kActive: 1.85,
  kNear: 1,
  kFar: 0.9,
};
const MOBILE = {
  size: 3,
  width: 390,
  height: 559,
  x: [90.2, 262, 100.2],
  py: [108.6, 294, 462.6],
  kActive: 1.05,
  kOther: 0.72,
  // vertical middle of each gift's opaque art relative to the pedestal centre py, stage units: gift + podium, and for today's gift
  // also the present drawn on top (.gift__front); never the TODAY pill. Measured on the TW art by scripts/check-label-centre.mjs
  // (giftMidRel: active -13.692..-13.696, missed / locked -10.427..-10.438 at 320/360/390/430). The labels centre on it (see stopHtml).
  giftMid: { active: -13.69, missed: -10.44, locked: -10.44 },
  // PAST labels of slots 0 and 2 are anchored by their BOTTOM edge, stage px below the pedestal centre py: Santa rides right under
  // them (slot 0: between yesterday's and today's stop; slot 2: after the campaign, below the last stop), so their bottom must stay
  // clear of him whatever the line count, and a 2-line name grows UPWARDS (translateY -100%, keyed on the label's own rendered height).
  // Slot 0: Jackpot centred this label and raised it 4 stage px (owner 2026-11-20); for a 1-line label that put its bottom at 15.21.
  // Slot 2: Jackpot kept it top-pinned at dy -57.6; for a 1-line label that put its bottom at 1.7. Both bottoms are set a little
  // higher so his PAINTED pixels stay >= 1 px away at every phone width 320-430 (measured, scripts/check-label-centre.mjs).
  pastBottom: { 0: 13.7, 2: -1.3 },
  // today's label is wider than the others: when it sits right of the gift (slots 0 and 2: Dec 1, Dec 26) it moves this far further
  // out so it does not cover the podium or the TODAY pill
  activeShiftRight: 16,
  // label anchors per slot: [left edge offset, top offset from pedestal centre (only used by the top-pinned past label of slot 1, see
  // mobileLabelPlacement), grow to the left?]; the other labels get their vertical position from their gift's middle (giftMid) or,
  // past labels of slots 0 / 2, from pastBottom
  label: [
    { dx: 39, dy: -44.6, left: false },
    { dx: -84, dy: -67, left: true },
    { dx: 39, dy: -57.6, left: false },
  ],
};

export const stageSpec = (layout) => (layout === 'desktop' ? DESKTOP : MOBILE);

/**
 * Mobile: where a route label sits vertically, by its state (active / missed / locked) and slot (0-2, top to bottom).
 * Returns { mode, bottom }:
 * - 'centre': the label's vertical middle sits on the middle of its own gift art (giftMid), whatever its line count;
 * - 'top': top-pinned at the Figma offset MOBILE.label[slot].dy;
 * - 'bottom': its bottom edge sits `bottom` stage px below the pedestal centre and extra lines grow upwards.
 * The exceptions are Santa clearance for PAST labels (Jackpot owner decisions 2026-11-20, kept for TW 2026-11-23, measured on TW):
 * - the past label of slot 1 (today in slot 2, Dec 26) stays top-pinned (centred: 7.9-10.6 px inside his art);
 * - the past labels of slot 0 (yesterday, Dec 2-26) and slot 2 (campaign over) are bottom-anchored (MOBILE.pastBottom): centred they
 *   would be 2.8-3.7 / 14.5-19.4 px inside his art, and Jackpot's raise / top-pin still left 2-line names under him (DE "Palast des
 *   Weihnachtsmanns" after the campaign, DE Dec 17 / RO_MDL Dec 20, Dec 22 seen the next day; owner 2026-11-23: move the label).
 * Today's label is exactly centred, like Jackpot, and Santa stays where he is: on Dec 1 (all markets), Dec 26 (all markets: the holly; DE also the box) and Dec 2-25 for
 * some long names (320-360) his board touches its top corner (holly / snow cap). Accepted, owner 2026-11-23 ("like JP, keep it
 * simple"; Jackpot has the same on Dec 2-25 for long names). scripts/check-label-centre.mjs and check-santa.mjs report it as accepted.
 * scripts/check-label-centre.mjs reads this function to know what to expect.
 */
export function mobileLabelPlacement(state, slot) {
  if (state === 'missed' && slot === 1) return { mode: 'top' };
  if (state === 'missed') return { mode: 'bottom', bottom: MOBILE.pastBottom[slot] };
  return { mode: 'centre' };
}

// Top Win: Santa is shown at SANTA_SC (0.8 of the Figma hero size) and stands at t=0.44 of the segment before today's stop (0.48 for slot 4);
// larger sizes failed scripts/check-santa.mjs (board off the line / silhouette over a gift). ART = silhouette reach incl. board tilt, measured on screen.
// Santa's snowboard must always touch the dotted route, and he must never cover today's gift or its TODAY pill.
// The route is a cubic-bezier path (the same "d" as public/assets/route-*.svg, moved to stage coordinates). BOARD is where the
// board sits relative to the Santa centre. Every position below is a POINT OF THAT PATH (board centre), chosen so that his
// art ends before the active gift's image box (x +-85*k around the stop, k = gift scale) starts.
// Mobile: the middle of the board's UNDERSIDE, measured on hero-santa-mobile@2x.webp (pixel 144,213 of 326x242; the art is
// shown 140px wide in a 150px box and pre-tilted 20.96deg in CSS) = (-21.75, +33.98) from the box centre. It is also the CSS
// transform-origin, so rotation, the 0.72 scale and the mirror all keep that point fixed on the line.
// scripts/check-santa.mjs measures the result on screen against the dotted line the SVG really draws.
// Desktop: the point of the board's underside right below the old (0, 91) anchor, measured on hero-santa-desktop@2x.webp
// (underside 96,256 -> 300,321 of 440x327, shown 265px wide at -27,17.5 in a 220px box) = (1.2, 87.3).
const BOARD = { desktop: { x: 1.2, y: 87.3 }, mobile: { x: -21.75, y: 33.98 } };
// Angle (deg, clockwise on screen) of the board in the art as it is drawn: the desktop art is shown as is, the mobile art is
// pre-tilted 20.96deg in CSS. Measured on the images: mobile underside 72,190 -> 216,237 = 18.07deg; desktop ~18.7deg.
export const BOARD_ANGLE = { desktop: 17.67, mobile: 18.07 + 20.96 };

// The dotted route as cubic bezier segments in stage coordinates: [P0, C1, C2, P1] per segment (the same "d" as
// public/assets/route-*.svg, moved by the svg's position on the stage). Segment i runs from anchor i to anchor i+1; the
// stops sit on anchors 1.. (anchor 0 is the start of the line, the last anchor its end).
function bezierSegments(d, dx, dy) {
  const n = d.match(/-?\d+(?:\.\d+)?/g).map(Number);
  const pt = (i) => ({ x: n[i] + dx, y: n[i + 1] + dy });
  const segs = [];
  for (let i = 2; i + 5 < n.length + 0; i += 6) segs.push([i === 2 ? pt(0) : segs[segs.length - 1][3], pt(i), pt(i + 2), pt(i + 4)]);
  return segs;
}
const PATH = {
  desktop: bezierSegments('M15 125C165 125 165 95 315 95C500 95 500 15 685 15C870 15 870 75 1055 75C1240 75 1240 15 1425 15C1610 15 1610 95 1795 95C1945 95 1945 125 2095 125', -95, 346),
  mobile: bezierSegments('M120.5 10.5C120.5 70.5 10.5 70.5 10.5 130.5C10.5 220.5 170.5 220.5 170.5 310.5C170.5 397.5 20.5 397.5 20.5 484.5C20.5 552 150.5 552 150.5 619.5', 80, -31),
};

// Where on the line he stands: always BETWEEN two stops (yesterday's and today's), his board on the line.
// [segment, t] of PATH. Slot s (today) uses the segment that ends at its stop (segment s; for slot 0 that is the lead-in
// before day 1). 'before' = lead-in before day 1; 'end' = segment after the last stop of the window.
const SANTA_SPOT = {
  desktop: { before: [0, 0.28], end: [5, 0.42], today: [[0, 0.28], [1, 0.44], [2, 0.44], [3, 0.44], [4, 0.48]] },
  mobile: { before: [0, 0.32], end: [3, 0.62], today: [[0, 0.28], [1, 0.53], [2, 0.53]] },
};

const bez = (s, t) => {
  const u = 1 - t;
  const f = (a, b, c, d) => u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
  return {
    x: f(s[0].x, s[1].x, s[2].x, s[3].x),
    y: f(s[0].y, s[1].y, s[2].y, s[3].y),
    // derivative (tangent direction)
    tx: 3 * (u * u * (s[1].x - s[0].x) + 2 * u * t * (s[2].x - s[1].x) + t * t * (s[3].x - s[2].x)),
    ty: 3 * (u * u * (s[1].y - s[0].y) + 2 * u * t * (s[2].y - s[1].y) + t * t * (s[3].y - s[2].y)),
  };
};

function spot(layout, slot, mode) {
  const S = SANTA_SPOT[layout];
  const [seg, t] = mode === 'end' ? S.end : mode === 'before' ? S.before : S.today[slot];
  return bez(PATH[layout][seg], t);
}

/**
 * Centre of Santa (before the desktop --f squeeze). His BOARD centre is a point of the route.
 * mode 'day' (default): today is in `slot`; 'before': campaign not started; 'end': campaign over.
 */
export function santaPos(layout, slot, mode = 'day') {
  const b = BOARD[layout];
  const p = spot(layout, slot, mode);
  // a mirrored Santa (mobile) is mirrored about the board point itself (CSS transform-origin), so his centre does not change
  return { x: p.x - b.x, y: p.y - b.y };
}

/**
 * Santa always rides towards today's stop (yesterday -> today along the route). On the mobile zigzag the route runs
 * right-to-left on some segments: there his art is mirrored so he still faces the way he travels. Desktop runs left to right only.
 */
export function santaFlipped(layout, slot, mode = 'day') {
  return spot(layout, slot, mode).tx < 0;
}

// Desktop: the board is ~100px long (at full size) and the route is a curve, so a board laid along the TANGENT at its middle
// leaves its two ends up to 4.7px off the line (Dec 2, 1920: the limit is 4). Laying it along the CHORD of the line over
// +-BOARD_HALF px of screen x instead keeps every board point within ~2.4px (measured with scripts/check-santa.mjs).
const BOARD_HALF = 60;
function chordAngle(slot, mode, f, tangentDeg) {
  const S = SANTA_SPOT.desktop;
  const [seg, t0] = mode === 'end' ? S.end : mode === 'before' ? S.before : S.today[slot];
  const c = bez(PATH.desktop[seg], t0);
  const end = (sign) => {
    let lo = 0;
    let hi = 0.3;
    for (let i = 0; i < 30; i++) {
      const m = (lo + hi) / 2;
      const q = bez(PATH.desktop[seg], Math.max(0, Math.min(1, t0 + sign * m)));
      if (Math.abs(q.x - c.x) * f < BOARD_HALF) lo = m;
      else hi = m;
    }
    return bez(PATH.desktop[seg], Math.max(0, Math.min(1, t0 + sign * lo)));
  };
  const a = end(-1);
  const b = end(1);
  if (b.x === a.x) return tangentDeg;
  return (Math.atan2(b.y - a.y, (b.x - a.x) * f) * 180) / Math.PI;
}

/**
 * Rotation (deg) that makes his board parallel to the route at his point. `f` is the desktop horizontal squeeze of the
 * route (the line gets steeper when it is squeezed). Rotation is about the board centre, so the board stays on the line.
 */
export function santaAngle(layout, slot, mode = 'day', f = 1) {
  const p = spot(layout, slot, mode);
  let a = (Math.atan2(p.ty, p.tx * f) * 180) / Math.PI; // direction of the line on screen
  if (layout === 'desktop') a = chordAngle(slot, mode, f, a);
  if (a > 90) a -= 180; // he faces right: the board's nose is the right end
  if (a <= -90) a += 180;
  // mirrored: his nose points left, so the board's angle against the (undirected) line is mirrored too
  const nose = santaFlipped(layout, slot, mode) ? -BOARD_ANGLE[layout] : BOARD_ANGLE[layout];
  return Math.round((a - nose) * 100) / 100;
}

const r = (n) => Math.round(n * 100) / 100;

/** Page zoom on desktop: 1 up to the 1920 design width, then the page grows with the viewport (4K = 2) so no empty band is left below. */
export function deskZoom(width) {
  return Math.max(1, width / 1920);
}

/** Page zoom on mobile: 1 up to the 390 design width, then the whole page grows with the viewport (768 = 1.97) so no side bands are left. Below 390 the stage shrinks through --s instead. */
export function mobileZoom(width) {
  return Math.max(1, width / 390);
}

/**
 * Desktop fit for a viewport width: stage scale `s` (the 1920 stage shrinks to 0.72, never further, to keep text legible)
 * and `f`, how far the five stops are pulled towards the centre once the viewport is narrower than the stage
 * (below ~1380px the outer stops would be cut off). Stop x = 960 + (x - 960) * f; the route line is squeezed the same way.
 */
export function desktopFit(width) {
  const s = Math.max(0.72, Math.min(1, width / 1920));
  const visible = width / s; // stage units visible across the viewport
  const f = Math.max(0.6, Math.min(1, (visible - 330) / 1480));
  return { s, f };
}
const mid = DESKTOP.width / 2;

// Santa's opaque art around his board point at the full desktop size (--sc 0.62), in stage units, measured with
// scripts/check-santa.mjs: it reaches ART.left to the left of the board point and ART.right to the right of it.
const SANTA_SC = 0.8;
const ART = { left: 190 * SANTA_SC, right: 90 * SANTA_SC };
const LABEL_HALF = 115; // half the width of a far (locked / missed) label, stage units
const EDGE = 8; // gap to the viewport edge

/**
 * Santa's scale for a route squeezed by f. The stops come closer (370 * f apart) but his art does not shrink with the
 * squeeze, so below SQUEEZE_FULL he shrinks with it, or he would touch the gifts on both sides of his segment.
 */
const SQUEEZE_FULL = 0.97;
const SQUEEZE_TESTED = 0.738; // lowest f the Santa checks covered before the fit used the width without the scrollbar
export function santaScale(f) {
  if (f >= SQUEEZE_FULL) return SANTA_SC;
  const k = Math.max(0.55, 1 - (SQUEEZE_FULL - f) * 3);
  // below f 0.738 (a 1024 window: the fit now works from the 1009px page without the scrollbar) the floor shrinks with f, or he touches a gift
  return SANTA_SC * (f < SQUEEZE_TESTED ? k * (f / SQUEEZE_TESTED) ** 4 : k);
}

/**
 * Desktop fit including Santa: { s, f, dx, sc }. Starts from desktopFit and only changes it where Santa would not fit:
 * - Dec 1 / before the campaign he rides the lead-in LEFT of the first stop. The stage shifts right by dx so his art is
 *   inside the viewport, but the last stop and its label must stay inside on the right. When both cannot hold (narrow
 *   desktops, e.g. 1280: only ~1778 stage units are visible), the route is squeezed further (smaller f), which makes room on
 *   both sides at once.
 * - After the campaign he stands right of the last stop: the same, mirrored (stage shifts left, the first label stays in).
 * Before T5h this was only done for Dec 1 with a fixed squeeze, so 1024-1344 cut him off at the left edge.
 */
export function desktopSantaFit(width, slot, mode = 'day') {
  const { s, f: f0 } = desktopFit(width);
  const half = width / s / 2; // stage units from the centre to each viewport edge
  let f = f0;
  let sc = santaScale(f);
  let dx = 0;
  const reach = (side) => (ART[side] * sc) / SANTA_SC;
  if (slot === 0 && mode !== 'end') {
    const bx = spot('desktop', 0, mode).x; // board point, left of the first stop
    // need: dx >= (960 - bx) f + left - half + EDGE; room: dx <= half - 740 f - LABEL_HALF - EDGE
    for (let i = 0; i < 4; i++) {
      f = Math.min(f0, (2 * half - 2 * EDGE - LABEL_HALF - reach('left')) / (mid - bx + 740));
      sc = santaScale(f);
    }
    const need = (mid - bx) * f + reach('left') - half + EDGE;
    const room = half - 740 * f - LABEL_HALF - EDGE;
    dx = Math.max(0, Math.min(Math.max(need, 90), room)); // at least 90 when there is room: more of the lead-in shows
  } else if (mode === 'end') {
    const bx = spot('desktop', slot, 'end').x; // board point, right of the last stop
    for (let i = 0; i < 4; i++) {
      f = Math.min(f0, (2 * half - 2 * EDGE - LABEL_HALF - reach('right')) / (bx - mid + 740));
      sc = santaScale(f);
    }
    const need = half - EDGE - (bx - mid) * f - reach('right'); // dx must be <= need (negative: shift left)
    const room = half - 740 * f - LABEL_HALF - EDGE; // dx >= -room
    dx = Math.min(0, Math.max(need, -room));
  }
  return { s, f, dx, sc };
}

function giftScale(layout, state, slot) {
  if (layout === 'desktop') return state === 'active' ? DESKTOP.kActive : Math.abs(slot - 2) === 1 ? DESKTOP.kNear : DESKTOP.kFar;
  return state === 'active' ? MOBILE.kActive : MOBILE.kOther;
}

/** Text for the tag above a location name: "TODAY’S STOP · DEC 7". */
export function dayTag(ui, uiLang, day, today) {
  const key = relativeKey(day, today);
  const date = shortDate(dayDate(day), uiLang);
  if (key === 'locked') return `${ui.locked.toLocaleUpperCase()} · ${date}`;
  const map = { missed: 'missed', yesterday: 'yesterday', today: 'todays_stop', tomorrow: 'tomorrow', in_two_days: 'in_two_days' };
  return fill(ui[map[key]], { date });
}

function ariaLabel(ui, uiLang, card, day, state, today) {
  const dayLabel = card.raw.locked[0];
  const where = card.location;
  let status;
  if (state === 'active') status = dayTag(ui, uiLang, day, today);
  else if (state === 'missed') status = ui.gift_expired;
  else status = `${ui.locked}: ${longDate(dayDate(day), uiLang)}`;
  return [dayLabel, where, status].filter(Boolean).join(', '); // location can be empty
}

function stopHtml({ layout, spec, slot, day, today, ui, uiLang, card, chipDay, countdown, marketId }) {
  const state = dayState(day, today);
  const k = giftScale(layout, state, slot);
  const cx = spec.x[slot];
  const py = spec.py[slot];
  const tag = dayTag(ui, uiLang, day, today);
  const label = ariaLabel(ui, uiLang, card, day, state, today);
  const img = state === 'active' ? 'gift-today@2x.webp' : state === 'missed' ? 'gift-expired@2x.webp' : 'gift-locked@2x.webp';

  const gift = `
    <button type="button" class="gift gift--${state}" data-open="${day}" aria-label="${esc(label)}"
      style="left:${layout === 'desktop' ? `calc(${r(mid - 60 * k)}px + var(--f) * ${cx - mid}px + var(--dx, 0px))` : `${r(cx - 60 * k)}px`};top:${r(py - 80 * k)}px;--k:${k}">
      <img class="gift__img" src="${asset(img)}" alt="" draggable="false">
      ${state === 'active' ? `<img class="gift__front" src="${asset('gift-today-present@2x.webp')}" alt="" aria-hidden="true" draggable="false">` : ''}
      ${state === 'active' ? `<span class="today-pill" aria-hidden="true">${esc(ui.today)}</span>` : ''}
    </button>`;

  // label position. The label is pulled into place with `transform: translateX(...)` (mobile: `translate(x, -50%)`), while today's label breathes with the
  // independent `scale` property (anim.css). `scale` grows about the transform-origin of the box BEFORE that translate, so the
  // origin must be the label's visual centre in those un-translated coordinates: x 0 when pulled left by half its width,
  // x -50% when pulled left by its full width. Otherwise the card grows from an edge and drifts sideways
  // (scripts/check-pulse.mjs, anchor drift).
  let pos;
  if (layout === 'desktop') {
    const dy = state === 'active' ? 53 : Math.abs(slot - 2) === 1 ? 56 : 51;
    pos = `left:calc(${mid}px + var(--f) * ${cx - mid}px + var(--dx, 0px));top:${r(py + dy)}px;transform:translateX(-50%);transform-origin:0 50%`;
  } else {
    const a = MOBILE.label[slot];
    const dx = a.dx + (state === 'active' && !a.left ? MOBILE.activeShiftRight : 0);
    const place = mobileLabelPlacement(state, slot);
    if (place.mode === 'centre') {
      // the label's vertical MIDDLE sits on the middle of its gift art (translateY -50%), whatever its line count or the countdown chip.
      // The un-translated box's top edge is then the visual centre, so today's breathing `scale` grows about y 0 (x as before).
      pos = `left:${r(cx + dx)}px;top:${r(py + MOBILE.giftMid[state])}px;transform:translate(${a.left ? '-100%' : '0'},-50%);transform-origin:${a.left ? '-50%' : '50%'} 0`;
    } else if (place.mode === 'bottom') {
      // the label's BOTTOM edge sits at py + bottom (translateY -100%): a taller label (2-line name) grows upwards, away from Santa
      pos = `left:${r(cx + dx)}px;top:${r(py + place.bottom)}px;transform:translate(${a.left ? '-100%' : '0'},-100%);transform-origin:${a.left ? '-50%' : '50%'} -50%`;
    } else {
      pos = `left:${r(cx + dx)}px;top:${r(py + a.dy)}px;${a.left ? 'transform:translateX(-100%);transform-origin:-50% 50%' : ''}`;
    }
  }
  const near = layout === 'desktop' ? Math.abs(slot - 2) === 1 : true;
  const name = esc(card.location);
  let inner;
  if (state === 'active') {
    inner = `
      <span class="label__tag">${escNb(tag)}</span>
      <span class="label__name">${name}</span>
      <button type="button" class="open-btn" data-open="${day}"><span>${esc(ui.open_gift)}</span>${ARROW_SVG}</button>
      <span class="garland" data-garland aria-hidden="true"></span>
      <img class="label__cap" src="${asset('snow-cap.svg')}" alt="" aria-hidden="true">
      <img class="label__holly" src="${asset('holly.svg')}" alt="" aria-hidden="true">`;
  } else if (state === 'missed') {
    inner = `
      <span class="label__tag">${escNb(tag)}</span>
      <span class="label__name">${name}</span>
      <img class="label__cap" src="${asset('snow-cap-sm.svg')}" alt="" aria-hidden="true">
      <img class="label__holly" src="${asset('holly.svg')}" alt="" aria-hidden="true">`;
  } else {
    inner = `
      <span class="label__tag">${escNb(tag)}</span>
      <span class="label__name">${name}</span>
      ${day === chipDay ? `<span class="chip" data-countdown>${escNb(fill(ui.unlocks_in, { time: countdown }))}</span>` : ''}`;
  }
  const lab = `<div class="label label--${state}${near ? ' label--near' : ' label--far'}" data-open="${day}" style="${pos}">${inner}</div>`;
  void marketId;
  return gift + lab;
}

/**
 * @param ctx { layout, ui, uiLang, cards, today, now, marketId }
 */
export function renderRoute(ctx) {
  const { layout, ui, uiLang, cards, today, now } = ctx;
  const spec = stageSpec(layout);
  const { days, todayIndex } = visibleDays(today, spec.size, CAMPAIGN.days);
  const total = formatCountdown(secondsUntil(now, nextUnlock(now)));
  const chipDay = today < 1 ? 1 : today + 1;

  // Santa waits at the left before the campaign, stands at the end after it
  const santaSlot = todayIndex >= 0 ? todayIndex : today < 1 ? 0 : spec.size - 1;
  const santaMode = today < 1 ? 'before' : today > CAMPAIGN.days ? 'end' : 'day';

  // gold (travelled) part of the route ends at the Santa slot; nothing before the campaign
  let travelled = 0;
  if (today >= 1) travelled = today > CAMPAIGN.days ? 1 : 0.5;
  const goldEnd = layout === 'desktop' ? spec.x[santaSlot] + 95 : spec.py[santaSlot] + 31;
  const goldSize = travelled === 0 ? 0 : today > CAMPAIGN.days ? 99999 : goldEnd;

  const stops = days
    .map((day, slot) =>
      stopHtml({ layout, spec, slot, day, today, ui, uiLang, card: cards.days[day - 1], chipDay, countdown: total, marketId: ctx.marketId }),
    )
    .join('');

  let scenery;
  if (layout === 'desktop') {
    // Santa rides just before today's pedestal; in slot 0 there is no room on the left, so he hovers up-left
    const { x: sx, y: sy } = santaPos('desktop', santaSlot, santaMode);
    const sxCss = `calc(${mid}px + var(--f) * ${sx - mid}px + var(--dx, 0px))`;
    scenery = `
      <img class="landscape" src="${asset('landscape-desktop@2x.webp')}" alt="" aria-hidden="true">
      <div class="fade fade--top"></div><div class="fade fade--bottom"></div><div class="fade fade--left"></div><div class="fade fade--right"></div>
      <div class="route-group">
        <img class="route route--base" src="${asset('route-desktop.svg')}" alt="" aria-hidden="true">
        <div class="route route--gold" style="width:${goldSize}px"><img src="${asset('route-desktop-gold.svg')}" alt="" aria-hidden="true"></div>
      </div>
      <div class="santa" data-santa-slot="${santaSlot}" data-santa-mode="${santaMode}" style="left:${sxCss};top:${sy}px;--rot:${santaAngle('desktop', santaSlot, santaMode)}deg">
        <span class="santa__glow"></span>
        <img class="santa__art" src="${asset('hero-santa-desktop@2x.webp')}" alt="" aria-hidden="true">
        <img class="santa__sparkles" src="${asset('hero-sparkles-desktop.svg')}" alt="" aria-hidden="true">
      </div>`;
  } else {
    const { x: sx, y: sy } = santaPos('mobile', santaSlot, santaMode);
    scenery = `
      <img class="route route--base" src="${asset('route-mobile.svg')}" alt="" aria-hidden="true">
      <div class="route route--gold" style="height:${goldSize}px"><img src="${asset('route-mobile-gold.svg')}" alt="" aria-hidden="true"></div>
      <div class="santa" data-santa-slot="${santaSlot}" data-santa-mode="${santaMode}"${santaFlipped('mobile', santaSlot, santaMode) ? ' data-flip="1"' : ''} style="left:${r(sx)}px;top:${r(sy)}px;--rot:${santaAngle('mobile', santaSlot, santaMode)}deg">
        <span class="santa__glow"></span>
        <img class="santa__art" src="${asset('hero-santa-mobile@2x.webp')}" alt="" aria-hidden="true">
        <img class="santa__sparkles" src="${asset('hero-sparkles-mobile.svg')}" alt="" aria-hidden="true">
      </div>`;
  }

  return `
  <section class="route-wrap"${santaSlot === 0 ? ' data-santa-first' : ''}${today > CAMPAIGN.days ? ' data-santa-end' : ''} aria-label="${esc(ui.campaign_title)}">
    <div class="route-stage" style="width:${spec.width}px;height:${spec.height}px">
      ${scenery}
      ${stops}
    </div>
  </section>`;
}

/** Updates every countdown chip; returns the formatted time. */
export function tickCountdown(root, ui, now) {
  const time = formatCountdown(secondsUntil(now, nextUnlock(now)));
  root.querySelectorAll('[data-countdown]').forEach((el) => {
    el.textContent = nb(fill(ui.unlocks_in, { time }));
  });
  return time;
}

const BULBS = ['#FF4D5E', '#FFD66B', '#4ADE80', '#5EC4FF'];

/** Draws the light garland (red-gold-green-blue bulbs, one every ~18px on desktop / ~12.5px on mobile) round today's label card. */
export function drawGarlands(root) {
  root.querySelectorAll('[data-garland]').forEach((el) => {
    const card = el.parentElement;
    const mobile = Boolean(card.closest('[data-layout=mobile]'));
    const pad = mobile ? 4 : 5;
    const w = card.offsetWidth + pad * 2;
    const h = card.offsetHeight + pad * 2;
    const rad = 20;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', `M${rad + 1} 1H${w - rad - 1}A${rad} ${rad} 0 0 1 ${w - 1} ${rad + 1}V${h - rad - 1}A${rad} ${rad} 0 0 1 ${w - rad - 1} ${h - 1}H${rad + 1}A${rad} ${rad} 0 0 1 1 ${h - rad - 1}V${rad + 1}A${rad} ${rad} 0 0 1 ${rad + 1} 1Z`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#14301F');
    path.setAttribute('stroke-width', '1.5');
    svg.appendChild(path);
    const len = path.getTotalLength();
    const count = Math.round(len / (mobile ? 12.5 : 18));
    for (let i = 0; i < count; i++) {
      const p = path.getPointAtLength((len / count) * i);
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', p.x);
      c.setAttribute('cy', p.y);
      c.setAttribute('r', mobile ? 2.6 : 3.2);
      c.setAttribute('fill', BULBS[i % 4]);
      c.setAttribute('stroke', 'rgba(255,255,255,0.6)');
      c.setAttribute('stroke-width', '1');
      c.setAttribute('class', 'bulb');
      c.style.setProperty('--i', i);
      svg.appendChild(c);
    }
    el.style.setProperty('--gp', `${pad}px`);
    el.replaceChildren(svg);
  });
}

/** Pulls one label back inside the viewport margin with the independent `translate` property. Returns the viewport-space box incl. garland / holly / breathing. */
function nudgeLabel(el, margin, vw) {
  el.style.translate = '';
  const box = el.getBoundingClientRect();
  const k = box.width / el.offsetWidth || 1; // stage scale
  // what must stay on screen is the label plus its garland and holly (they stick out of the box), and the active label
  // breathes up to 3.5% bigger about its centre (anim.css): the margin is kept at the biggest size
  let left = box.left;
  let right = box.right;
  el.querySelectorAll('.garland svg, .label__holly, .label__cap').forEach((part) => {
    const p = part.getBoundingClientRect();
    left = Math.min(left, p.left);
    right = Math.max(right, p.right);
  });
  // the breathing scale works about the label centre, so garland / holly / cap that stick out of the box grow outwards by 3.5 % of THEIR distance
  // from the centre, not of the box half-width (that left 7.6-8.0px at 320px instead of 8)
  const grow = el.classList.contains('label--active') ? (box.width * 0.035) / 2 : 0;
  if (grow) {
    const cx = (box.left + box.right) / 2;
    left = cx - (cx - left) * 1.035;
    right = cx + (right - cx) * 1.035;
  }
  // today's one-line label may have been moved away from its gift by fitTodayButton (dataset.giftShift, in label px); keep that move
  const pre = (Number(el.dataset.giftShift) || 0) * k;
  left += pre;
  right += pre;
  let dx = pre;
  if (left < margin) dx += margin + 0.1 - left; // +0.1: the translate is rounded to 0.01 and the breathing frame is not exactly the measured one
  else if (right > vw - margin) dx += vw - margin - right;
  if (dx) el.style.translate = `${r(dx / k)}px 0`;
  return { left: left + dx, right: right + dx, box: { left: box.left + dx - grow, right: box.right + dx + grow, top: box.top, bottom: box.bottom } };
}

/**
 * Mobile: today's "open gift" text ("GESCHENK ÖFFNEN", "DESCHIDE CADOUL") on ONE line where it fits. The label widens (and, if needed, the text steps
 * 15 -> 14 -> 13 -> 12px) as long as the label stays >= margin from both screen edges and does not cover the gift (middle 60% of its image box) or the TODAY pill;
 * otherwise it stays on the two-line layout of the CSS. Run before the general nudge pass in fitLabels.
 */
function fitTodayButton(root, margin, vw) {
  const lab = root.querySelector('.label--active');
  const btn = lab?.querySelector('.open-btn');
  if (!btn || !lab.closest('[data-layout="mobile"]')) return;
  lab.classList.remove('label--oneline');
  lab.style.removeProperty('--open-fs');
  lab.style.removeProperty('--open-w');
  delete lab.dataset.giftShift;
  const id = lab.dataset.open;
  const gift = root.querySelector(`.gift[data-open="${id}"] .gift__img`);
  const pill = root.querySelector(`.gift[data-open="${id}"] .today-pill`);
  const hit = (a, b, tol) => a.left < b.right - tol && b.left < a.right - tol && a.top < b.bottom - tol && b.top < a.bottom - tol;
  // The label may grow only as far as the gift allows: a long place name ("Unterirdisches Labyrinth") must wrap inside that width
  // instead of stretching the label over the gift, which used to push the whole button back onto two lines.
  const room = () => {
    if (!gift) return 190;
    const g = gift.getBoundingClientRect();
    const sh = g.width * 0.2;
    const b = lab.getBoundingClientRect();
    let over = 0; // garland / holly sticking out of the label box
    lab.querySelectorAll('.garland svg, .label__holly, .label__cap').forEach((part) => {
      const p = part.getBoundingClientRect();
      over = Math.max(over, b.left - p.left, p.right - b.right);
    });
    const toLeft = b.left + b.width / 2 < g.left + g.width / 2;
    const free = toLeft ? g.left + sh + 2 - margin : vw - margin - (g.right - sh - 2);
    return Math.floor((free - 2 * over) / 1.035 / (b.width / lab.offsetWidth || 1));
  };
  for (const fs of [15, 14, 13, 12]) {
    lab.classList.add('label--oneline');
    lab.style.removeProperty('--open-w');
    lab.style.setProperty('--open-fs', `${fs}px`);
    lab.style.setProperty('--open-w', `${room()}px`);
    drawGarlands(root); // the garland follows the label's new size (it is only drawn at render time otherwise: stale after a resize)
    delete lab.dataset.giftShift;
    let n = nudgeLabel(lab, margin, vw);
    if (gift) {
      // growing the label about its centre pushes it over the gift: slide it away from the gift (the margin test below then decides if it still fits)
      const g = gift.getBoundingClientRect();
      const sh = g.width * 0.2;
      const gl = g.left + sh;
      const gr = g.right - sh;
      if (n.box.top < g.bottom && g.top < n.box.bottom && n.box.left < gr - 2 && gl + 2 < n.box.right) {
        const k = lab.getBoundingClientRect().width / lab.offsetWidth || 1;
        const toLeft = (n.box.left + n.box.right) / 2 < (g.left + g.right) / 2;
        lab.dataset.giftShift = String(r((toLeft ? gl + 1.5 - n.box.right : gr - 1.5 - n.box.left) / k));
        n = nudgeLabel(lab, margin, vw);
      }
    }
    let ok = n.left >= margin - 0.01 && n.right <= vw - margin + 0.01;
    if (ok && gift) {
      const g = gift.getBoundingClientRect();
      const sh = g.width * 0.2;
      ok = !hit(n.box, { left: g.left + sh, right: g.right - sh, top: g.top, bottom: g.bottom }, 2);
    }
    if (ok && pill) ok = !hit(n.box, pill.getBoundingClientRect(), 0.5);
    // the button (its text cannot wrap) must stay inside the label: with the capped width a long text would stick out at both sides
    if (ok) {
      const lb = lab.getBoundingClientRect();
      const bb = btn.getBoundingClientRect();
      ok = bb.left >= lb.left - 0.5 && bb.right <= lb.right + 0.5;
    }
    // text really on one line (the 2-line CSS is the fallback)
    if (ok) {
      const rng = document.createRange();
      rng.selectNodeContents(btn.querySelector('span'));
      ok = rng.getClientRects().length === 1;
    }
    if (ok) return;
  }
  lab.classList.remove('label--oneline');
  lab.style.removeProperty('--open-fs');
  lab.style.removeProperty('--open-w');
  delete lab.dataset.giftShift;
  drawGarlands(root);
}

/**
 * The ONE width every layout fit works from: the width the page really has, without the classic scrollbar. html reserves the scrollbar
 * gutter (base.css) and #app is a full-width block inside it, so on a desktop with a classic scrollbar this is 15px less than
 * window.innerWidth / documentElement.clientWidth (which read the full window width, also while the card overlay hides the scrollbar).
 */
export function layoutWidth() {
  return document.getElementById('app')?.clientWidth || document.documentElement.clientWidth;
}

/**
 * Keeps every label inside the viewport: a label that sticks out (long German/Russian names, narrow phones)
 * is nudged back with the independent `translate` property (transform and scale stay free for the animations).
 */
export function fitLabels(root, margin = 8) {
  const vw = layoutWidth();
  const labels = [...root.querySelectorAll('.label')];
  labels.forEach((el) => {
    el.style.translate = '';
  });
  // Today's label "breathes" (scale 1 -> 1.035, anim.css). Every measurement below must see it at scale 1, otherwise the result depends on the
  // moment of the call: a fresh load measures at phase 0, a resize at any phase, and a label near a limit (gift, margin) flips between one and two lines.
  // The animation is switched off for the measuring and put back at the same point of its cycle.
  const active = root.querySelector('.label--active');
  const phase = active ? active.getAnimations().map((a) => [a.animationName, a.currentTime]) : [];
  const was = active ? { animation: active.style.animation, scale: active.style.scale } : null;
  if (active) {
    active.style.animation = 'none';
    active.style.scale = '1'; // also when something (a check script) left an inline scale on it
  }
  try {
    fitLabelsMeasured(root, margin, vw, labels);
  } finally {
    if (active) {
      active.style.animation = was.animation;
      active.style.scale = was.scale;
      active.getAnimations().forEach((a) => {
        const p = phase.find(([name]) => name === a.animationName);
        if (p) a.currentTime = p[1];
      });
    }
  }
}

function fitLabelsMeasured(root, margin, vw, labels) {
  fitTodayButton(root, margin, vw);
  drawGarlands(root); // desktop too: the garland is drawn at render time only, so after a resize it would keep the old size and the nudge below would measure it
  labels.forEach((el) => nudgeLabel(el, margin, vw));
  // neighbours pushed into each other (a wide active label nudged away from the edge): move the right one on
  const sorted = [...labels].sort((p, q) => p.getBoundingClientRect().left - q.getBoundingClientRect().left);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].getBoundingClientRect();
    const cur = sorted[i].getBoundingClientRect();
    const sameRow = cur.top < prev.bottom && prev.top < cur.bottom;
    if (sameRow && cur.left < prev.right + 6) {
      const k = cur.width / sorted[i].offsetWidth || 1;
      const have = Number.parseFloat(sorted[i].style.translate) || 0;
      sorted[i].style.translate = `${r(have + (prev.right + 6 - cur.left) / k)}px 0`;
    }
  }
}
