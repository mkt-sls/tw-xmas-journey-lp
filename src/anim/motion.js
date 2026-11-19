// Shared motion helpers.
const query = '(prefers-reduced-motion: reduce)';

/** True when the visitor asked for less motion. Re-read on every call (the setting can change live). */
export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.(query).matches === true;

/** Runs a WAAPI animation; resolves when it ends or is cancelled. Falls back to resolving at once. */
export function play(el, keyframes, options) {
  if (!el?.animate) return Promise.resolve();
  const a = el.animate(keyframes, { fill: 'both', ...options });
  return a.finished.then(() => a, () => a);
}
