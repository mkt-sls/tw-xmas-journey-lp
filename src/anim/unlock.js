// New day unlock: Santa travels from the previous stop to today's, the gold route follows and the lock dissolves.
// Triggered by main.js when tw-cj:lastSeenDay < today (see lastSeen.js). 1.2s ease-in-out.
import { santaPos, stageSpec } from '../render/route.js';
import { asset } from '../render/util.js';
import { play, reducedMotion } from './motion.js';

export const UNLOCK_MS = 1200;

/**
 * @param {HTMLElement} root the app root
 * @param {{ layout: 'desktop'|'mobile', todayIndex: number }} info slot of today in the visible window
 */
export function playUnlock(root, { layout, todayIndex }) {
  const gift = root.querySelector('.gift--active');
  if (!gift) return Promise.resolve();
  const reduced = reducedMotion();
  const jobs = [];

  // the lock dissolves: the locked pedestal sits on top of today's gift and fades away
  {
    const lock = document.createElement('img');
    lock.className = 'gift__lock';
    lock.alt = '';
    lock.setAttribute('aria-hidden', 'true');
    lock.src = asset('gift-locked@2x.webp');
    gift.appendChild(lock);
    const frames = reduced ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.18)' }];
    jobs.push(play(lock, frames, { duration: UNLOCK_MS, easing: 'ease-in-out' }).then(() => lock.remove()));
  }

  if (!reduced && todayIndex > 0) {
    // Santa: from the previous slot to the current one (`translate` is separate from the CSS centring transform)
    const from = santaPos(layout, todayIndex - 1);
    const to = santaPos(layout, todayIndex);
    const squeeze = layout === 'desktop' ? Number.parseFloat(getComputedStyle(gift.closest('.page')).getPropertyValue('--f')) || 1 : 1;
    const santa = root.querySelector('.santa');
    if (santa) jobs.push(play(santa, [{ translate: `${(from.x - to.x) * squeeze}px ${from.y - to.y}px` }, { translate: '0 0' }], { duration: UNLOCK_MS, easing: 'ease-in-out' }));

    // gold route: revealed from the previous stop to the new one
    const gold = root.querySelector('.route--gold');
    if (gold) {
      const spec = stageSpec(layout);
      const delta = layout === 'desktop' ? spec.x[todayIndex] - spec.x[todayIndex - 1] : spec.py[todayIndex] - spec.py[todayIndex - 1];
      const hidden = layout === 'desktop' ? `inset(0 ${delta}px 0 0)` : `inset(0 0 ${delta}px 0)`;
      jobs.push(play(gold, [{ clipPath: hidden }, { clipPath: 'inset(0 0 0 0)' }], { duration: UNLOCK_MS, easing: 'ease-in-out' }));
    }
  }
  return Promise.all(jobs);
}
