// The only time-based part of the page's opening: a finite entrance on first
// view. A soft glow converges on the name while the live card fades in over its
// still. The real heading, links and navigation are present
// and usable from the first frame; scrolling, keyboard input, a hash jump or a
// reduced-motion change completes it at once.

import { gsap } from 'gsap';
import { easeUI, onMotionChange } from './motion.js';

const LATE_MS = 2600; // initialisation finished too late: skip, never replay later

export function runIntro({ cfg, name }) {
  const root = document.documentElement;
  const M = cfg.motion.intro;
  const finishAll = () => {
    root.classList.remove('intro-pending', 'intro-running');
    root.classList.add('intro-header', 'intro-chapters', 'intro-hint');
  };
  if (performance.now() > LATE_MS) { finishAll(); return { cancel() {} }; }

  root.classList.add('intro-running');
  root.classList.remove('intro-pending');

  // Decorative bloom: a text-free glow layer behind the real name. Being
  // non-text it can never become the Largest Contentful Paint, so the heading
  // itself (visible from the first frame) stays the LCP element.
  const bloom = document.createElement('span');
  bloom.className = 'name-bloom';
  bloom.setAttribute('aria-hidden', 'true');
  name.appendChild(bloom);

  const tl = gsap.timeline({ onComplete: done });
  tl.fromTo(bloom,
    { opacity: 0.85, scale: M.bloomScale, filter: `blur(${M.bloomBlur}px) brightness(${M.bloomBrightness})` },
    { opacity: 0, scale: 1, filter: 'blur(0px) brightness(1)', duration: 1.05, ease: easeUI }, 0.12);
  tl.call(() => root.classList.add('intro-header'), null, M.headerAt / 1000);
  tl.call(() => root.classList.add('intro-chapters'), null, M.chaptersAt / 1000);
  tl.call(() => root.classList.add('intro-hint'), null, M.hintAt / 1000);
  tl.set({}, {}, M.hintAt / 1000);

  let finished = false;
  function done() {
    if (finished) return;
    finished = true;
    bloom.remove();
    finishAll();
    off();
  }
  function cancel() {
    if (finished) return;
    tl.progress(1);
    tl.kill();
    done();
  }

  const stopOnScroll = () => { if (window.scrollY > 2) cancel(); };
  const events = [['wheel', cancel], ['touchmove', cancel], ['keydown', cancel], ['scroll', stopOnScroll]];
  for (const [t, fn] of events) window.addEventListener(t, fn, { passive: true });
  document.addEventListener('portfolio:navigate', cancel);
  const offMotion = onMotionChange((m) => { if (m.reduced) cancel(); });
  function off() {
    for (const [t, fn] of events) window.removeEventListener(t, fn);
    document.removeEventListener('portfolio:navigate', cancel);
    offMotion();
  }
  return { cancel };
}
