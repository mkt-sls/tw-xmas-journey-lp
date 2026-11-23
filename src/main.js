import '@fontsource-variable/inter';
import '@fontsource-variable/outfit';
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/anim.css';

import { CAMPAIGN } from './config.js';
import { campaignDay, parseNow } from './date.js';
import { loadMarketData } from './i18n.js';
import { getMarket, htmlLangFor, resolveMarket, saveMarket } from './market.js';
import { renderCard } from './render/card.js';
import { bindMarketMenu, fitHeader, renderHeader } from './render/header.js';
import { renderHowItWorks } from './render/howItWorks.js';
import { renderIntro } from './render/intro.js';
import { renderLegend } from './render/legend.js';
import { renderLegal } from './render/legal.js';
import { closeOverlay, openOverlay } from './render/overlay.js';
import { deskZoom, desktopSantaFit, drawGarlands, fitLabels, layoutWidth, mobileZoom, renderRoute, santaAngle, stageSpec, tickCountdown } from './render/route.js';
import { track } from './track.js';
import { initAmbient } from './anim/ambient.js';
import { checkNewDay } from './anim/lastSeen.js';
import { playOpening } from './anim/open.js';
import { playUnlock } from './anim/unlock.js';
import { dayState, visibleDays } from './date.js';

const app = document.getElementById('app');
const search = window.location.search;
const mq = window.matchMedia('(min-width: 1024px)');

// QA clock: ?date= replaces "now" but keeps ticking, so the midnight rollover can be watched.
const base = parseNow(search);
const clockOffset = base.getTime() - Date.now();
const hasOverride = new URLSearchParams(search).has('date') && base.getTime() !== Date.now();
const now = () => new Date(hasOverride ? Date.now() + clockOffset : Date.now());

const state = { market: null, ui: null, cards: null, today: null };

const MOBILE_FIRST_PAD = 85; // room above the first gift for Santa on the lead-in (Dec 1, before the campaign)
const MOBILE_END_PAD = 45; // room below the last pedestal for Santa after the campaign
const layout = () => (mq.matches ? 'desktop' : 'mobile');

async function setMarket(id, { persist = true } = {}) {
  const market = getMarket(id);
  const data = await loadMarketData(market);
  state.market = market;
  state.ui = data.ui.strings;
  state.cards = data.cards;
  state.uiLang = market.uiLang;
  if (persist) saveMarket(id);
  document.documentElement.lang = htmlLangFor(market);
  render();
}

function fitStage() {
  const page = app.querySelector('.page');
  if (!page) return;
  const l = layout();
  const spec = stageSpec(l);
  // desktop: see desktopFit; mobile: the 390px stage shrinks on narrower phones (360 -> 0.92) so nothing is cut off
  // desktop wider than the 1920 design: the whole page is CSS-zoomed by z so it fills the viewport; everything inside works in
  // "design" pixels, so the usable width is layoutWidth() / z (= 1920 above 1920, the real width below)
  const z = l === 'desktop' ? deskZoom(layoutWidth()) : mobileZoom(layoutWidth());
  const vw = layoutWidth() / z;
  const santa = page.querySelector('.santa');
  const slot = santa ? Number(santa.dataset.santaSlot) : 2;
  const mode = santa ? santa.dataset.santaMode : 'day';
  // desktop: the squeeze f, the stage shift dx and Santa's scale come from desktopSantaFit (route.js), so he is never cut off
  // at an edge or squeezed onto a gift at any width (scripts/check-santa.mjs --sweep)
  const { s, f, dx, sc } = l === 'desktop' ? desktopSantaFit(vw, slot, mode) : { s: Math.min(1, layoutWidth() / 390), f: 1, dx: 0, sc: null };
  page.style.setProperty('--z', z);
  page.style.setProperty('--s', s);
  page.style.setProperty('--f', f);
  // mobile, Santa in slot 0 (Dec 1, before the campaign): room above the first gift so he is not cut off by the stage
  page.style.setProperty('--stage-pad', l === 'mobile' && page.querySelector('[data-santa-first]') ? `${MOBILE_FIRST_PAD * s}px` : '0px');
  page.style.setProperty('--stage-pad-b', l === 'mobile' && page.querySelector('[data-santa-end]') ? `${MOBILE_END_PAD * s}px` : '0px');
  page.style.setProperty('--stage-h', `${spec.height * s}px`);
  if (l === 'desktop' && santa) santa.style.setProperty('--sc', sc < 0.995 ? sc.toFixed(3) : '');
  page.style.setProperty('--dx', `${dx}px`);
  // the desktop route line is squeezed by f, so Santa's board angle follows the squeezed line
  if (santa) santa.style.setProperty('--rot', `${santaAngle(l, Number(santa.dataset.santaSlot), santa.dataset.santaMode, f)}deg`);
  fitHeader(app, l);
  fitLabels(app);
}

function render() {
  const l = layout();
  const n = now();
  state.today = campaignDay(n);
  const ctx = {
    layout: l,
    ui: state.ui,
    uiLang: state.uiLang,
    market: state.market,
    marketId: state.market.id,
    cards: state.cards,
    today: state.today,
    now: n,
  };
  app.innerHTML = `
  <div class="page" data-layout="${l}">
    ${renderHeader(ctx)}
    <main>
      <div class="hero">
        ${renderIntro(ctx)}
        ${renderRoute(ctx)}
      </div>
      ${renderLegend(ctx)}
      ${renderHowItWorks(ctx)}
    </main>
    ${renderLegal(ctx)}
  </div>`;
  fitStage();
  drawGarlands(app);
  // the web font changes text widths once loaded: redraw the garlands and re-fit the labels
  document.fonts?.ready.then(() => {
    drawGarlands(app);
    fitHeader(app, layout());
    fitLabels(app);
  });
  maybePlayUnlock(l);
  bindMarketMenu(app, (id) => {
    if (id === state.market.id) return;
    const from = state.market.id;
    track('market_change', { from, to: id });
    const url = new URL(window.location.href);
    if (url.searchParams.has('market')) {
      url.searchParams.set('market', id);
      window.history.replaceState(null, '', url);
    }
    setMarket(id).then(() => app.querySelector('.market__btn')?.focus({ preventScroll: true }));
  });
}

// New day: first render after tw-cj:lastSeenDay < today. Never on the very first visit, only inside the campaign.
function maybePlayUnlock(l) {
  if (!checkNewDay(state.today, undefined, CAMPAIGN.days)) return;
  const { todayIndex } = visibleDays(state.today, stageSpec(l).size, CAMPAIGN.days);
  playUnlock(app, { layout: l, todayIndex });
}

let opening = false;
async function openCard(day) {
  if (opening) return;
  const l = layout();
  const card = state.cards.days[day - 1];
  if (!card) return;
  const { html, kind } = renderCard({ card, day, today: state.today, ui: state.ui, marketId: state.market.id });
  track('open_gift', { day, state: kind, market: state.market.id });
  // only today's gift plays the opening; missed and locked cards just play the card-in
  if (dayState(day, state.today) === 'active') {
    opening = true;
    try {
      await playOpening(app.querySelector(`.gift[data-open="${day}"]`));
    } finally {
      opening = false;
    }
  }
  openOverlay({
    html,
    layout: l,
    returnFocus: () => app.querySelector(`.gift[data-open="${day}"]`),
  });
}

app.addEventListener('click', (e) => {
  const t = e.target.closest('[data-open]');
  if (t) {
    e.preventDefault();
    openCard(Number(t.dataset.open));
  }
});

// Card links live in the overlay (outside #app)
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-track]');
  if (!a) return;
  const data = { day: Number(a.dataset.day), market: state.market?.id };
  if (a.dataset.track === 'deposit_click') track('deposit_click', data);
  if (a.dataset.track === 'terms_click') track('terms_click', data);
});

initAmbient();
window.addEventListener('resize', fitStage);
mq.addEventListener('change', () => {
  closeOverlay(false);
  render();
});

// every second: tick the countdown; at local midnight the whole page re-renders for the new day
setInterval(() => {
  if (!state.market) return;
  const n = now();
  if (campaignDay(n) !== state.today) {
    render();
    return;
  }
  tickCountdown(app, state.ui, n);
}, 1000);

const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
setMarket(resolveMarket({ search, languages }), { persist: false });
