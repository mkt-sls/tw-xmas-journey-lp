// Tap -> opening for TODAY's gift: wobble (300ms), then a gold flash with sparks while the gift pops (500ms).
// The card enters right after (overlay, 250-350ms). Missed and locked cards skip this and only play card-in.
import { play, reducedMotion } from './motion.js';

export const WOBBLE_MS = 300;
export const BURST_MS = 500;
/** The overlay opens this long before the burst ends, so the dim and card-in overlap its tail (800ms in total). */
export const OVERLAP_MS = 120;

let busy = false;

function burst(gift) {
  const box = gift.getBoundingClientRect();
  const layer = document.createElement('div');
  layer.className = 'burst';
  layer.setAttribute('aria-hidden', 'true');
  layer.style.left = `${box.left + box.width / 2}px`;
  layer.style.top = `${box.top + box.height * 0.2}px`;
  const flash = document.createElement('i');
  flash.className = 'burst__flash';
  layer.appendChild(flash);
  const sparks = [];
  const n = 10;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    s.className = 'burst__spark';
    layer.appendChild(s);
    const ang = -Math.PI * (0.1 + 0.8 * (i / (n - 1))) + (Math.random() - 0.5) * 0.25; // fan upwards
    const dist = 70 + Math.random() * 70;
    sparks.push([s, Math.cos(ang) * dist, Math.sin(ang) * dist]);
  }
  document.body.appendChild(layer);
  const anims = [
    play(
      flash,
      [
        { opacity: 0, transform: 'translate(-50%,-50%) scale(0.3)' },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.3 },
        { opacity: 0, transform: 'translate(-50%,-50%) scale(1.6)' },
      ],
      { duration: BURST_MS, easing: 'ease-out' },
    ),
    ...sparks.map(([s, dx, dy], i) =>
      play(
        s,
        [
          { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' },
          { opacity: 0, transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.2)` },
        ],
        { duration: BURST_MS, delay: i * 8, easing: 'cubic-bezier(.2,.7,.3,1)' },
      ),
    ),
  ];
  return Promise.all(anims).then(() => layer.remove());
}

/**
 * Plays the gift opening and resolves when the overlay should open.
 * Reduced motion resolves at once (the card then only fades in).
 * @param {HTMLElement|null} gift the .gift button of today
 * @returns {Promise<void>}
 */
export async function playOpening(gift) {
  // the art and its present-only copy drawn above the pulse ring (.gift__front) move as one
  const imgs = gift ? [...gift.querySelectorAll('.gift__img, .gift__front')] : [];
  if (!imgs.length || reducedMotion() || busy) return;
  const playAll = (keyframes, options) => Promise.all(imgs.map((el) => play(el, keyframes, options)));
  busy = true;
  try {
    // 1) wobble 300ms
    await playAll(
      [
        { transform: 'rotate(0) scale(1)' },
        { transform: 'rotate(-6deg) scale(1.04)', offset: 0.25 },
        { transform: 'rotate(5deg) scale(1.06)', offset: 0.55 },
        { transform: 'rotate(-3deg) scale(1.04)', offset: 0.8 },
        { transform: 'rotate(0) scale(1.05)' },
      ],
      { duration: WOBBLE_MS, easing: 'ease-in-out' },
    );
    // 2) flash + sparks 500ms; the gift pops and settles back
    const pop = playAll([{ transform: 'scale(1.05)' }, { transform: 'scale(1.16)', offset: 0.3 }, { transform: 'scale(1)' }], {
      duration: BURST_MS,
      easing: 'ease-out',
    });
    Promise.all([burst(gift), pop]).then(() => imgs.forEach((el) => el.getAnimations().forEach((a) => a.cancel())));
    await new Promise((r) => setTimeout(r, BURST_MS - OVERLAP_MS));
  } finally {
    busy = false;
  }
}
