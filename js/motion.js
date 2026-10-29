// Motion tokens, numeric easing helpers and the visitor's motion mode.
// The helpers are pure and defined numerically so tests can pin their values.

export const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;

// Progress of p through [a, b], clamped to 0–1.
export const u = (a, b, p) => clamp((p - a) / (b - a));

// easeOut = 1 − (1 − t)³ and smoothstep = t²(3 − 2t), both on clamped t.
export const easeOut = (t) => { t = clamp(t); return 1 - (1 - t) * (1 - t) * (1 - t); };
export const smoothstep = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };

// Rises on a–b, holds on b–c, falls on c–d. Computed from progress alone, so it
// reverses exactly and never depends on crossing events.
export function bell(a, b, c, d, p) {
  if (p <= a || p >= d) return 0;
  if (p < b) return smoothstep((p - a) / (b - a));
  if (p <= c) return 1;
  return 1 - smoothstep((p - c) / (d - c));
}

// CSS-style cubic-bezier(x1, y1, x2, y2) as a function of t in 0–1.
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    x = clamp(x);
    if (x === 0 || x === 1) return x;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x;
      if (Math.abs(err) < 1e-7) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 40; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-7) break;
      if (v < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

export const easeUI = cubicBezier(0.2, 0.7, 0.2, 1);
export const easeScene = cubicBezier(0.65, 0, 0.35, 1);

// Damped spring (mass 1, stiffness 170, damping 18 by default) integrated with a
// bounded time step. step() returns true once it has settled.
export function createSpring({ mass = 1, stiffness = 170, damping = 18 } = {}, initial = 0) {
  const s = { value: initial, velocity: 0, target: initial };
  s.step = (dtMs) => {
    let dt = Math.min(Math.max(dtMs, 0), 64) / 1000;
    while (dt > 0) {
      const h = Math.min(dt, 1 / 120);
      const force = -stiffness * (s.value - s.target) - damping * s.velocity;
      s.velocity += (force / mass) * h;
      s.value += s.velocity * h;
      dt -= h;
    }
    const settled = Math.abs(s.value - s.target) < 0.01 && Math.abs(s.velocity) < 0.01;
    if (settled) { s.value = s.target; s.velocity = 0; }
    return settled;
  };
  return s;
}

// ---------------------------------------------------------------------------
// Motion mode: the OS setting wins at startup and is followed live; the footer
// override can force reduced motion; "Pause motion" halts autonomous effects.
// ---------------------------------------------------------------------------

const listeners = new Set();
const state = { osReduced: false, override: 'system', paused: false };
let storageKey = 'dv-motion';

export function motionMode() {
  return { reduced: state.osReduced || state.override === 'reduced', paused: state.paused, override: state.override };
}
export function onMotionChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() {
  const m = motionMode();
  const root = document.documentElement;
  root.toggleAttribute('data-motion-paused', m.paused);
  if (state.override === 'reduced') root.setAttribute('data-motion', 'reduced');
  else root.removeAttribute('data-motion');
  for (const fn of listeners) fn(m);
}

export function setMotionOverride(value) {
  state.override = value === 'reduced' ? 'reduced' : 'system';
  try {
    if (state.override === 'reduced') localStorage.setItem(storageKey, 'reduced');
    else localStorage.removeItem(storageKey);
  } catch { /* storage unavailable: the choice lasts for this page view */ }
  emit();
}
export function setPaused(paused) { state.paused = !!paused; emit(); }

export function initMotion(cfg) {
  storageKey = cfg.theme.motionStorageKey;
  const mql = matchMedia('(prefers-reduced-motion: reduce)');
  state.osReduced = mql.matches;
  state.override = document.documentElement.getAttribute('data-motion') === 'reduced' ? 'reduced' : 'system';
  mql.addEventListener('change', (e) => { state.osReduced = e.matches; emit(); });

  const control = document.querySelector('[data-motion-control]');
  if (control) {
    const sync = () => { for (const r of control.querySelectorAll('input')) r.checked = r.value === state.override; };
    sync();
    control.addEventListener('change', (e) => { if (e.target.name === 'motion') setMotionOverride(e.target.value); });
    onMotionChange(sync);
  }

  const pause = document.querySelector('.pause-toggle');
  if (pause) {
    const label = pause.querySelector('.pause-label');
    const use = pause.querySelector('use');
    const sync = () => {
      pause.setAttribute('aria-pressed', String(state.paused));
      label.textContent = cfg.labels.pauseMotion;
      use?.setAttribute('href', state.paused ? '#glyph-play' : '#glyph-pause');
    };
    pause.addEventListener('click', () => setPaused(!state.paused));
    onMotionChange(sync);
    sync();
    pause.hidden = false;
  }
}
