// Ambient motion: slow snow on a small canvas and a gentle landscape parallax. Both are skipped for reduced motion.
// The garland twinkle is pure CSS (.bulb). The snow loop stops while the tab is hidden.
import { reducedMotion } from './motion.js';

const COUNT = 10; // 8-12 flakes on screen

let canvas = null;
let ctx = null;
let flakes = [];
let raf = 0;
let last = 0;
let w = 0;
let h = 0;

function seed() {
  flakes = Array.from({ length: COUNT }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: 1.4 + Math.random() * 2.2,
    vy: 12 + Math.random() * 14, // px / s, slow
    sway: 8 + Math.random() * 14,
    phase: Math.random() * Math.PI * 2,
    a: 0.35 + Math.random() * 0.45,
  }));
}

function resize() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  w = window.innerWidth;
  h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  seed();
}

function frame(t) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min((t - (last || t)) / 1000, 0.1);
  last = t;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  for (const f of flakes) {
    f.y += f.vy * dt;
    f.phase += dt * 0.6;
    if (f.y - f.r > h) {
      f.y = -f.r;
      f.x = Math.random() * w;
    }
    ctx.globalAlpha = f.a;
    ctx.beginPath();
    ctx.arc(f.x + Math.sin(f.phase) * f.sway, f.y, f.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function start() {
  if (raf || !canvas || document.hidden) return;
  last = 0;
  raf = requestAnimationFrame(frame);
}

function stop() {
  cancelAnimationFrame(raf);
  raf = 0;
}

export function stopSnow() {
  stop();
  canvas?.remove();
  canvas = null;
  ctx = null;
}

export function startSnow() {
  if (reducedMotion() || canvas) return;
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  if (!g) return;
  canvas = c;
  ctx = g;
  canvas.className = 'snow';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  resize();
  start();
}

// Parallax: the desktop landscape drifts down at 5% of the scroll speed (max 12px). transform only.
let ticking = false;
function parallaxFrame() {
  ticking = false;
  const el = document.querySelector('.landscape');
  if (!el) return;
  const y = reducedMotion() ? 0 : Math.min(window.scrollY * 0.05, 12);
  el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
}
function onScroll() {
  if (!ticking) {
    ticking = true;
    requestAnimationFrame(parallaxFrame);
  }
}

let bound = false;
/** Call once; safe to call again. */
export function initAmbient() {
  if (bound) return;
  bound = true;
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const sync = () => {
    if (mq.matches) {
      stopSnow();
      parallaxFrame();
    } else startSnow();
  };
  mq.addEventListener?.('change', sync);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  window.addEventListener('resize', resize);
  window.addEventListener('scroll', onScroll, { passive: true });
  sync();
}
