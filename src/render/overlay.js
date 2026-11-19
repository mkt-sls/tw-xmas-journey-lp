import { fitCard } from './fitText.js';

// Modal (desktop) / bottom sheet (mobile) host: overlay, burst glow, focus trap, Esc, outside click, focus return.
const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

let current = null;

export function isOpen() {
  return current !== null;
}

/**
 * @param {{ html: string, layout: 'desktop'|'mobile', returnFocus?: HTMLElement|(() => HTMLElement|null)|null, onClose?: Function }} opts
 */
export function openOverlay({ html, layout, returnFocus = document.activeElement, onClose }) {
  closeOverlay(false);
  const app = document.getElementById('app');
  const el = document.createElement('div');
  el.className = `overlay overlay--${layout}`;
  el.innerHTML = `
    <div class="overlay__backdrop" data-close></div>
    <div class="overlay__glow" aria-hidden="true"></div>
    <div class="overlay__panel">
      ${layout === 'mobile' ? '<div class="overlay__grabber" aria-hidden="true"></div>' : ''}
      ${html}
    </div>`;
  document.body.appendChild(el);
  document.body.classList.add('has-overlay');
  app.setAttribute('aria-hidden', 'true');
  app.inert = true;

  const panel = el.querySelector('.card');
  fitCard(panel); // headline <= 2 balanced lines, before the first paint of the card
  const focusables = () => [...panel.querySelectorAll(FOCUSABLE)];

  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeOverlay();
    } else if (e.key === 'Tab') {
      const f = focusables();
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  document.addEventListener('keydown', onKey, true);
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) closeOverlay();
  });

  current = { el, onKey, returnFocus, onClose, app };
  requestAnimationFrame(() => {
    el.classList.add('is-open');
    (panel.querySelector('.btn-primary:not([disabled])') ?? panel.querySelector('[data-close]'))?.focus();
  });
  return el;
}

export function closeOverlay(restoreFocus = true) {
  if (!current) return;
  const { el, onKey, returnFocus, onClose, app } = current;
  current = null;
  document.removeEventListener('keydown', onKey, true);
  el.remove();
  document.body.classList.remove('has-overlay');
  app.removeAttribute('aria-hidden');
  app.inert = false;
  const target = typeof returnFocus === 'function' ? returnFocus() : returnFocus;
  if (restoreFocus && target && document.contains(target)) target.focus();
  onClose?.();
}
