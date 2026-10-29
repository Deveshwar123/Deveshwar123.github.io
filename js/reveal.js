// After-content motion (outside the deterministic journey): snapshot count-ups,
// the experience trace scrubbed by local scroll, once-only line reveals and the
// closing jali. Every fact stays in the DOM and readable throughout; focus or an
// anchor jump reveals its target at once. Not started under reduced motion.

import { addTask, removeTask, wake } from './scheduler.js';
import { easeOut, clamp } from './motion.js';

const SVGNS = 'http://www.w3.org/2000/svg';

export function initReveals(cfg) {
  const root = document.documentElement;
  const R = cfg.motion.reveal;
  const cleanups = [];
  const io = new IntersectionObserver(onIntersect, { threshold: R.threshold });
  cleanups.push(() => io.disconnect());
  const handlers = new Map();
  function observe(el, fn) { handlers.set(el, fn); io.observe(el); }
  function onIntersect(entries) {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const fn = handlers.get(e.target);
      if (fn) { handlers.delete(e.target); io.unobserve(e.target); fn(); }
    }
  }

  // ---- Line reveals: split text into visual lines (never characters) --------
  function splitLines(el) {
    if (el.dataset.split) return;
    const text = el.textContent;
    const words = text.trim().split(/\s+/);
    el.textContent = '';
    const spans = words.map((w, i) => {
      const s = document.createElement('span');
      s.textContent = w + (i < words.length - 1 ? ' ' : '');
      el.appendChild(s);
      return s;
    });
    const lines = [];
    let top = null;
    for (const s of spans) {
      if (top === null || Math.abs(s.offsetTop - top) > 2) { lines.push([]); top = s.offsetTop; }
      lines[lines.length - 1].push(s.textContent);
    }
    el.textContent = '';
    lines.forEach((words, i) => {
      const outer = document.createElement('span');
      outer.className = 'reveal-line';
      const inner = document.createElement('span');
      inner.textContent = words.join('');
      inner.style.setProperty('--i', i);
      outer.appendChild(inner);
      el.appendChild(outer);
    });
    el.dataset.split = text;
  }
  function unsplit(el) {
    if (!el.dataset.split) return;
    el.textContent = el.dataset.split;
    delete el.dataset.split;
  }

  const lineTargets = [...document.querySelectorAll('.after .section-title, .skills-intro, .contact-title')];
  const unitGroups = [...document.querySelectorAll('.after .bullets, .activities, .interests, .stats')];
  const containers = new Set();

  function reveal(container) {
    if (container.classList.contains('is-revealed')) return;
    container.classList.add('is-revealed');
    // Restore plain text once the transition has run, so later resizes reflow naturally.
    setTimeout(() => {
      unsplit(container);
      container.querySelectorAll('[data-split]').forEach(unsplit);
    }, cfg.motion.durations.reveal + 600);
  }

  for (const el of lineTargets) {
    splitLines(el);
    el.setAttribute('data-reveal', '');
    containers.add(el);
    observe(el, () => reveal(el));
  }
  for (const group of unitGroups) {
    const stagger = group.closest('.role-card') ? R.timelineStagger : R.stagger;
    [...group.children].forEach((li, i) => {
      li.classList.add('reveal-unit');
      li.style.setProperty('--d', `${i * stagger}ms`);
    });
    group.setAttribute('data-reveal', '');
    containers.add(group);
    if (!group.closest('.role-card')) observe(group, () => reveal(group));
  }

  // Focus or an in-page jump never leaves content hidden.
  const revealAround = (node) => {
    for (const c of containers) if (c.contains(node) || node.contains?.(c)) reveal(c);
  };
  const onFocus = (e) => revealAround(e.target);
  document.addEventListener('focusin', onFocus);
  cleanups.push(() => document.removeEventListener('focusin', onFocus));
  const onNavigate = (e) => {
    const target = document.getElementById(e.detail.hash.slice(1));
    if (!target) return;
    // Everything above the destination is revealed too, so scrolling back up
    // never meets hidden text.
    const y = target.getBoundingClientRect().top + window.scrollY + window.innerHeight;
    for (const c of containers) if (c.getBoundingClientRect().top + window.scrollY <= y) reveal(c);
  };
  document.addEventListener('portfolio:navigate', onNavigate);
  cleanups.push(() => document.removeEventListener('portfolio:navigate', onNavigate));

  // ---- Snapshot count-ups ----------------------------------------------------
  const counters = [];
  for (const el of document.querySelectorAll('.stat-value')) {
    const m = /^(\d+)(?:\.(\d+))?(.*)$/.exec(el.dataset.value || '');
    if (!m) continue;
    const target = parseFloat(`${m[1]}.${m[2] || 0}`);
    const decimals = (m[2] || '').length;
    const suffix = m[3];
    el.classList.add('has-count');
    const overlay = document.createElement('span');
    overlay.className = 'stat-count';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.textContent = (0).toFixed(decimals) + suffix;
    el.appendChild(overlay);
    const c = { el, overlay, target, decimals, suffix, start: 0, done: false };
    counters.push(c);
    observe(el, () => { c.start = -1; addTask('counters', tickCounters); });
  }
  function tickCounters(time) {
    let running = false;
    for (const c of counters) {
      if (c.done || c.start === 0) continue;
      if (c.start < 0) c.start = time;
      const t = clamp((time - c.start) / cfg.motion.durations.countUp);
      c.overlay.textContent = (c.target * easeOut(t)).toFixed(c.decimals) + c.suffix;
      if (t >= 1) { c.done = true; c.overlay.remove(); c.el.classList.remove('has-count'); }
      else running = true;
    }
    if (!running) removeTask('counters');
    return running;
  }
  cleanups.push(() => { removeTask('counters'); for (const c of counters) { c.overlay.remove(); c.el.classList.remove('has-count'); } });

  // ---- Experience trace, scrubbed by the timeline's own scroll position ------
  const timeline = document.querySelector('.timeline');
  if (timeline) {
    const roles = [...timeline.querySelectorAll('.role')];
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'timeline-trace');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const base = document.createElementNS(SVGNS, 'path');
    base.setAttribute('class', 'trace-base');
    const live = document.createElementNS(SVGNS, 'path');
    svg.append(base, live);
    timeline.prepend(svg);
    root.classList.add('has-timeline');
    let length = 0, pads = [], height = 0;
    const measure = () => {
      const t = timeline.getBoundingClientRect();
      height = t.height;
      pads = roles.map((r) => {
        const p = r.querySelector('.role-pad').getBoundingClientRect();
        return p.top + p.height / 2 - t.top;
      });
      // A copper route: straight down between pads with a 45° jog after each one.
      let d = `M1 ${pads[0].toFixed(1)}`;
      pads.forEach((y, i) => {
        const next = pads[i + 1];
        if (next === undefined) return;
        const jog = Math.min(10, (next - y) / 6);
        d += `L1 ${(y + 24).toFixed(1)}L${(1 + jog).toFixed(1)} ${(y + 24 + jog).toFixed(1)}L${(1 + jog).toFixed(1)} ${(next - 24 - jog).toFixed(1)}L1 ${(next - 24).toFixed(1)}L1 ${next.toFixed(1)}`;
      });
      svg.setAttribute('viewBox', `0 0 2 ${height.toFixed(1)}`);
      svg.style.height = `${height}px`;
      base.setAttribute('d', d);
      live.setAttribute('d', d);
      length = live.getTotalLength();
      live.style.strokeDasharray = `${length} ${length}`;
    };
    measure();
    const revealedCards = new Set();
    const update = () => {
      const t = timeline.getBoundingClientRect();
      const vh = window.innerHeight;
      // The trace's tip follows a line 70% down the viewport.
      const tip = vh * 0.7 - t.top;
      const progress = clamp((tip - pads[0]) / Math.max(1, pads[pads.length - 1] - pads[0]));
      live.style.strokeDashoffset = (length * (1 - progress)).toFixed(1);
      roles.forEach((r, i) => {
        const reached = tip >= pads[i] - 1;
        r.classList.toggle('is-reached', reached);
        const bullets = r.querySelector('.bullets');
        if (reached && !revealedCards.has(r)) { revealedCards.add(r); reveal(bullets); }
      });
      return false;
    };
    addTask('timeline', update);
    const onResize = () => { measure(); update(); };
    window.addEventListener('resize', onResize, { passive: true });
    document.fonts?.ready.then(onResize);
    cleanups.push(() => { removeTask('timeline'); window.removeEventListener('resize', onResize); svg.remove(); root.classList.remove('has-timeline'); roles.forEach((r) => r.classList.remove('is-reached')); });
  }

  // ---- Closing jali: redraws once, in reverse, when the contact enters --------
  const closing = document.querySelector('.closing-art');
  if (closing) {
    const paths = [...closing.querySelectorAll('path')];
    for (const p of paths) { p.setAttribute('pathLength', '1'); p.style.strokeDasharray = '1'; p.style.strokeDashoffset = '-1'; }
    closing.classList.add('is-armed');
    observe(closing, () => {
      closing.classList.add('is-drawn');
      setTimeout(() => paths.forEach((p) => { p.removeAttribute('pathLength'); p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; }), cfg.motion.durations.reveal + 200);
    });
    cleanups.push(() => paths.forEach((p) => { p.removeAttribute('pathLength'); p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; }));
  }

  root.classList.add('has-reveals');
  wake();
  return {
    destroy() {
      root.classList.remove('has-reveals');
      for (const c of containers) { c.classList.add('is-revealed'); unsplit(c); c.querySelectorAll('[data-split]').forEach(unsplit); }
      cleanups.forEach((fn) => fn());
    },
  };
}
