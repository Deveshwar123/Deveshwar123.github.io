// Progressive boot. The generated HTML is complete before this runs; each
// enhancement initialises in isolation, and a failure is reported once and
// leaves the static page (content, links and static art) untouched.

import { initTheme } from './theme.js';
import { initMotion, motionMode, onMotionChange } from './motion.js';
import { initNav, refreshNav, restoreHash } from './nav.js';
import { initContact } from './contact.js';

const root = document.documentElement;
const cfg = JSON.parse(document.getElementById('site-config').textContent);
const reported = new Set();

function report(name, err) {
  if (reported.has(name)) return;
  reported.add(name);
  console.warn(`[portfolio] ${name} unavailable; the static page remains.`, err);
}
function attempt(name, fn) {
  try { return fn(); } catch (err) { report(name, err); return undefined; }
}
async function attemptAsync(name, fn) {
  try { return await fn(); } catch (err) { report(name, err); return undefined; }
}

// --- Essentials first: theme, motion mode, navigation -------------------------
attempt('theme', () => initTheme(cfg));
attempt('motion', () => initMotion(cfg));
attempt('nav', () => initNav(cfg));
attempt('contact', () => initContact(cfg));
document.querySelector('.footer-controls')?.removeAttribute('hidden');
root.classList.add('is-enhanced');

// --- Capability tier ------------------------------------------------------------
// full: SVG + WebGL story; compact: SVG-only story (narrow screens, no WebGL2,
// coarse pointers); static: three still frames (reduced motion or any failure).
function hasWebGL2() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    const ok = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return ok;
  } catch { return false; }
}
export function chooseTier() {
  if (motionMode().reduced) return 'static';
  if (innerWidth < cfg.journey.compactBreakpoint) return 'compact';
  return hasWebGL2() ? 'full' : 'compact';
}

const fontsSettled = Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]);

// Optional modules start loading only after the first contentful paint, so the
// readable page always wins the network and main thread.
const firstPaint = new Promise((resolve) => {
  if (performance.getEntriesByType('paint').some((e) => e.name === 'first-contentful-paint')) { resolve(); return; }
  try {
    new PerformanceObserver((list, obs) => {
      if (list.getEntries().some((e) => e.name === 'first-contentful-paint')) { obs.disconnect(); resolve(); }
    }).observe({ type: 'paint', buffered: true });
  } catch { resolve(); }
  setTimeout(resolve, 1200);
}).then(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))));

let story = null;
async function startStory() {
  const tier = chooseTier();
  if (story) { attempt('journey teardown', () => story.destroy()); story = null; }
  root.removeAttribute('data-tier');
  if (tier === 'static') { root.classList.remove('intro-pending'); refreshNav(); return; }
  await Promise.all([fontsSettled, firstPaint]);
  const mod = await attemptAsync('journey module', () => import('./journey.js'));
  if (!mod) { root.classList.remove('intro-pending'); return; }
  story = await attemptAsync('journey', () => mod.createStory({ cfg, tier, report }));
  if (story) root.setAttribute('data-tier', story.tier);
  else root.classList.remove('intro-pending');
  refreshNav();
}

// After-content motion (count-ups, timeline trace, line reveals): not under
// reduced motion, and torn down if reduced motion switches on.
let reveals = null;
async function startReveals() {
  if (reveals) { attempt('reveals teardown', () => reveals.destroy()); reveals = null; }
  if (motionMode().reduced) return;
  await fontsSettled;
  const mod = await attemptAsync('reveals module', () => import('./reveal.js'));
  reveals = mod ? attempt('reveals', () => mod.initReveals(cfg)) : null;
}

// Project mini-worlds run in every tier (the NFC card stays interactive with
// stepped poses under reduced motion); WebGL only in the full tier.
let projects = null;
async function startProjects() {
  if (projects) { attempt('projects teardown', () => projects.destroy()); projects = null; }
  const mod = await attemptAsync('projects module', () => import('./projects.js'));
  if (mod) projects = await attemptAsync('projects', () => mod.initProjects({ cfg, tier: story?.tier ?? 'static', report }));
}

async function boot() {
  await startStory();
  await fontsSettled;
  refreshNav();
  restoreHash();
  await startReveals();
  await startProjects();
  const skills = await attemptAsync('skills module', () => import('./skills-board.js'));
  if (skills) attempt('skills', () => skills.initSkills(cfg));
  // Final, optional polish: a failure here never affects navigation or content.
  const cursor = await attemptAsync('cursor module', () => import('./cursor.js'));
  if (cursor) attempt('cursor', () => cursor.initCursor(cfg));
}
boot();

// Reduced motion switched on or off while the page is open: rebuild the tier.
let lastReduced = motionMode().reduced;
onMotionChange((m) => {
  if (m.reduced !== lastReduced) { lastReduced = m.reduced; startStory().then(startProjects); startReveals(); }
});

// Returning from the back-forward cache: re-measure without replaying the intro.
addEventListener('pageshow', (e) => { if (e.persisted) { story?.remeasure?.(); refreshNav(); } });

export { cfg, report, attempt, attemptAsync };
