// Optional pointer polish, fine pointers only: a 16px decorative ring that
// follows the native cursor (never replaces it) and bounded magnetism on the
// primary buttons. Only the label artwork moves (≤ 6px); the hit target and
// focus ring stay put. Off for touch, coarse pointers, reduced motion, Pause
// motion and keyboard use; every loop stops once settled.

import { addTask, removeTask, wake } from './scheduler.js';
import { motionMode, onMotionChange, createSpring } from './motion.js';

export function initCursor(cfg) {
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const M = cfg.motion.magnet;
  const S = cfg.motion.spring;
  let enabled = false;
  let ring = null;
  const pointer = { x: -100, y: -100, seen: false };
  const rx = createSpring(S, -100), ry = createSpring(S, -100);
  const magnets = [...document.querySelectorAll('.button--primary')].map((button) => {
    const inner = document.createElement('span');
    inner.className = 'magnet-art';
    while (button.firstChild) inner.appendChild(button.firstChild);
    button.appendChild(inner);
    return { button, inner, sx: createSpring(S, 0), sy: createSpring(S, 0), rect: null };
  });

  const allowed = () => fine.matches && !motionMode().reduced && !motionMode().paused;

  function measure() { for (const m of magnets) m.rect = m.button.getBoundingClientRect(); }

  function tick(_, dt) {
    let busy = false;
    if (ring) {
      rx.target = pointer.x; ry.target = pointer.y;
      const a = rx.step(dt), b = ry.step(dt);
      ring.style.transform = `translate(${rx.value.toFixed(1)}px, ${ry.value.toFixed(1)}px)`;
      busy ||= !(a && b);
    }
    for (const m of magnets) {
      let tx = 0, ty = 0;
      if (pointer.seen && m.rect && !m.button.matches(':focus-visible')) {
        const cx = m.rect.left + m.rect.width / 2, cy = m.rect.top + m.rect.height / 2;
        const dx = pointer.x - cx, dy = pointer.y - cy;
        const reach = Math.max(m.rect.width, m.rect.height) / 2 + M.radius;
        if (Math.hypot(dx, dy) < reach) {
          tx = Math.max(-M.maxShift, Math.min(M.maxShift, dx * M.strength));
          ty = Math.max(-M.maxShift, Math.min(M.maxShift, dy * M.strength));
        }
      }
      m.sx.target = tx; m.sy.target = ty;
      const a = m.sx.step(dt), b = m.sy.step(dt);
      // The spring may overshoot its target; the label never passes the bound.
      const x = Math.max(-M.maxShift, Math.min(M.maxShift, m.sx.value));
      const y = Math.max(-M.maxShift, Math.min(M.maxShift, m.sy.value));
      m.inner.style.transform = x || y ? `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)` : '';
      busy ||= !(a && b);
    }
    return busy;
  }

  const onMove = (e) => {
    if (e.pointerType !== 'mouse') return;
    if (!pointer.seen) { rx.value = rx.target = e.clientX; ry.value = ry.target = e.clientY; }
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.seen = true;
    if (ring) ring.classList.toggle('is-crosshair', !!e.target.closest?.('[data-nfc-view]'));
    wake();
  };
  const onLeave = () => { pointer.seen = false; ring?.classList.add('is-hidden'); wake(); };
  const onEnter = () => { ring?.classList.remove('is-hidden'); };
  const onScroll = () => { measure(); };
  const settleNow = () => {
    for (const m of magnets) { m.sx.value = m.sx.target = 0; m.sy.value = m.sy.target = 0; m.inner.style.transform = ''; }
  };
  const onKey = () => { pointer.seen = false; settleNow(); };

  function enable() {
    if (enabled) return;
    enabled = true;
    ring = document.createElement('div');
    ring.className = 'cursor-ring';
    ring.setAttribute('aria-hidden', 'true');
    document.body.appendChild(ring);
    measure();
    addTask('cursor', tick);
    document.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    document.documentElement.addEventListener('pointerenter', onEnter);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onKey);
  }
  function disable() {
    if (!enabled) return;
    enabled = false;
    removeTask('cursor');
    ring?.remove();
    ring = null;
    settleNow();
    pointer.seen = false;
    document.removeEventListener('pointermove', onMove);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    document.documentElement.removeEventListener('pointerenter', onEnter);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
    window.removeEventListener('keydown', onKey);
    document.removeEventListener('visibilitychange', onKey);
  }
  const sync = () => (allowed() ? enable() : disable());
  fine.addEventListener('change', sync);
  const off = onMotionChange(sync);
  sync();

  return {
    destroy() {
      disable();
      off();
      fine.removeEventListener('change', sync);
      for (const m of magnets) { while (m.inner.firstChild) m.button.insertBefore(m.inner.firstChild, m.inner); m.inner.remove(); }
    },
  };
}
