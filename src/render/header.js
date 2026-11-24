import { MARKETS, marketCode } from '../market.js';
import { CHEVRON_SVG, asset, esc, flagUrl } from './util.js';

export function renderHeader({ ui, market }) {
  const code = marketCode(market);
  return `
  <header class="header">
    <div class="header__inner">
      <a class="header__logo" href="./" aria-label="${esc(ui.brand)}"><img src="${asset('logo-topwin.svg')}" alt="" width="151" height="30"></a>
      <div class="header__actions">
        <div class="market" data-market-root>
          <button type="button" class="market__btn" id="market-btn" aria-haspopup="listbox" aria-expanded="false" aria-controls="market-list" aria-label="${esc(market.label)} · ${esc(market.currency)}">
            <img src="${flagUrl(market.flag)}" alt="" width="22" height="16" class="flag">
            <span class="market__code">${esc(code)}</span>
            <span class="market__chev">${CHEVRON_SVG}</span>
          </button>
          <ul class="market__list" id="market-list" role="listbox" aria-labelledby="market-btn" tabindex="-1" hidden>
            ${MARKETS.map(
              (m) => `
            <li role="option" id="market-opt-${m.id}" data-market="${m.id}" aria-selected="${m.id === market.id}" class="market__opt${m.id === market.id ? ' is-selected' : ''}">
              <img src="${flagUrl(m.flag)}" alt="" width="24" height="18" class="flag">
              <span class="market__label">${esc(m.label)}</span>
              <span class="market__cur">${esc(m.currency)}</span>
            </li>`,
            ).join('')}
          </ul>
        </div>
      </div>
    </div>
  </header>`;
}

/** Wires the dropdown: click, keyboard (arrows, Home/End, Enter/Space, Esc), outside click. */
export function bindMarketMenu(root, onSelect) {
  const wrap = root.querySelector('[data-market-root]');
  const btn = wrap.querySelector('.market__btn');
  const list = wrap.querySelector('.market__list');
  const opts = [...list.querySelectorAll('[role=option]')];
  let active = -1;

  const setActive = (i) => {
    active = (i + opts.length) % opts.length;
    opts.forEach((o, n) => o.classList.toggle('is-active', n === active));
    list.setAttribute('aria-activedescendant', opts[active].id);
    opts[active].scrollIntoView({ block: 'nearest' });
  };
  // presentation only: tells CSS which edge fades to show
  const updateFades = () => {
    const more = [];
    if (list.scrollTop > 2) more.push('up');
    if (list.scrollTop + list.clientHeight < list.scrollHeight - 2) more.push('down');
    list.dataset.more = more.join(' ');
  };
  list.addEventListener('scroll', updateFades, { passive: true });
  const open = () => {
    list.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    // keep the panel inside the viewport (short buttons like "RO" left-shift it off-screen)
    list.style.transform = '';
    const left = list.getBoundingClientRect().left;
    if (left < 12) list.style.transform = `translateX(${Math.round((12 - left) / (list.getBoundingClientRect().width / list.offsetWidth || 1))}px)`; // local px: the page may be zoomed
    list.focus({ preventScroll: true });
    setActive(Math.max(0, opts.findIndex((o) => o.classList.contains('is-selected'))));
    // centre the current language in the visible window
    const cur = opts[active];
    list.scrollTop = cur.offsetTop - (list.clientHeight - cur.offsetHeight) / 2;
    updateFades();
    document.addEventListener('pointerdown', outside, true);
  };
  const close = (focusBtn = true) => {
    list.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outside, true);
    if (focusBtn) btn.focus({ preventScroll: true });
  };
  const outside = (e) => {
    if (!wrap.contains(e.target)) close(false);
  };
  const choose = (i) => {
    const id = opts[i].dataset.market;
    close();
    onSelect(id);
  };

  btn.addEventListener('click', () => (list.hidden ? open() : close()));
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (list.hidden) open();
    }
  });
  list.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setActive(active + 1); break;
      case 'ArrowUp': e.preventDefault(); setActive(active - 1); break;
      case 'Home': e.preventDefault(); setActive(0); break;
      case 'End': e.preventDefault(); setActive(opts.length - 1); break;
      case 'Enter':
      case ' ': e.preventDefault(); choose(active); break;
      case 'Escape': e.preventDefault(); e.stopPropagation(); close(); break;
      case 'Tab': close(false); break;
      default:
    }
  });
  opts.forEach((o, i) => {
    o.addEventListener('click', () => choose(i));
    o.addEventListener('pointermove', () => active !== i && setActive(i));
  });
}
