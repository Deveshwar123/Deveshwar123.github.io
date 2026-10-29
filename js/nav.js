// Navigation: header glass state, the small-screen menu, in-page links (smooth
// scroll, real hash history, focus on the destination heading) and passive
// chapter tracking. Passive scrolling never moves focus or writes history.

import { addTask, wake } from './scheduler.js';
import { motionMode } from './motion.js';

const nativeScroller = {
  y: () => window.scrollY,
  scrollTo(y, { immediate = false } = {}) {
    window.scrollTo({ top: y, behavior: immediate || motionMode().reduced ? 'auto' : 'smooth' });
  },
};

let scroller = nativeScroller;
let headerH = 64;
let threshold = 40;
let chapters = [];
let currentChapter = null;
const header = document.getElementById('site-header');

export function setScroller(s) { scroller = s || nativeScroller; }
export const getScroller = () => scroller;

function measure() {
  headerH = header ? header.getBoundingClientRect().height : 64;
  const y = window.scrollY;
  chapters = [...document.querySelectorAll('.chapter-link')].map((a) => {
    const el = document.getElementById(a.hash.slice(1));
    return { a, el, top: el ? el.getBoundingClientRect().top + y : Infinity };
  });
}

// Document Y that places el just below the fixed header.
export function targetY(el) {
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || headerH + 16;
  return Math.max(0, el.getBoundingClientRect().top + window.scrollY - margin);
}

function focusDestination(el) {
  const t = el.matches('h1, h2, h3') ? el : el.querySelector('h1, h2, h3') || el;
  if (!t.hasAttribute('tabindex')) {
    t.setAttribute('tabindex', '-1');
    t.addEventListener('blur', () => t.removeAttribute('tabindex'), { once: true });
  }
  t.focus({ preventScroll: true });
}

export function goTo(hash, { focus = true, history: push = true, immediate = false } = {}) {
  const el = document.getElementById(hash.replace(/^#/, ''));
  if (!el) return false;
  document.dispatchEvent(new CustomEvent('portfolio:navigate', { detail: { hash } }));
  scroller.scrollTo(targetY(el), { immediate });
  if (push && location.hash !== hash) history.pushState(null, '', hash);
  if (focus) focusDestination(el);
  return true;
}

function onClick(e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.getAttribute('href') === '#') return;
  const hash = a.getAttribute('href');
  if (!document.getElementById(hash.slice(1))) return;
  e.preventDefault();
  closeMenu();
  goTo(hash);
}

function update() {
  const y = scroller.y();
  header?.classList.toggle('is-scrolled', y > threshold);
  const probe = y + headerH + window.innerHeight * 0.3;
  let next = null;
  for (const c of chapters) if (c.top <= probe) next = c;
  if (next !== currentChapter) {
    currentChapter?.a.removeAttribute('aria-current');
    next?.a.setAttribute('aria-current', 'location');
    currentChapter = next;
  }
  return false;
}

// ---- Small-screen menu ------------------------------------------------------
let menu = null;
function closeMenu() {
  if (!menu?.nav.classList.contains('is-open')) return;
  menu.nav.classList.remove('is-open');
  menu.button.setAttribute('aria-expanded', 'false');
}
function initMenu() {
  const nav = document.querySelector('.primary-nav');
  const button = nav?.querySelector('.menu-toggle');
  if (!nav || !button) return;
  menu = { nav, button };
  const mq = matchMedia('(max-width: 599px)');
  const setMode = () => {
    nav.classList.toggle('is-collapsible', mq.matches);
    button.hidden = !mq.matches;
    if (!mq.matches) closeMenu();
  };
  button.addEventListener('click', () => {
    const open = !nav.classList.contains('is-open');
    nav.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { closeMenu(); button.focus(); }
  });
  nav.addEventListener('focusout', (e) => { if (!nav.contains(e.relatedTarget)) closeMenu(); });
  mq.addEventListener('change', setMode);
  setMode();
}

// Re-apply an initial or restored hash once layout (fonts, track height) settles.
export function restoreHash() {
  if (location.hash.length > 1 && document.getElementById(location.hash.slice(1))) {
    goTo(location.hash, { focus: false, history: false, immediate: true });
  }
}

export function refreshNav() { measure(); update(); }

export function initNav(cfg) {
  threshold = cfg.motion.headerGlassAt;
  measure();
  document.addEventListener('click', onClick);
  window.addEventListener('scroll', wake, { passive: true });
  window.addEventListener('resize', () => { measure(); wake(); }, { passive: true });
  window.addEventListener('popstate', () => { measure(); });
  addTask('nav', update);
  initMenu();
  update();
}
