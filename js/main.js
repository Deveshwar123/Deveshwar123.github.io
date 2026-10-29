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

let story = null;
async function startStory() {
  const tier = chooseTier();
  if (story) { attempt('journey teardown', () => story.destroy()); story = null; }
  root.removeAttribute('data-tier');
  if (tier === 'static') { refreshNav(); return; }
  await fontsSettled;
  const mod = await attemptAsync('journey module', () => import('./journey.js'));
  if (!mod) return;
  story = await attemptAsync('journey', () => mod.createStory({ cfg, tier, report }));
  if (story) root.setAttribute('data-tier', story.tier);
  refreshNav();
}

async function boot() {
  await startStory();
  await fontsSettled;
  refreshNav();
  restoreHash();
}
boot();

// Reduced motion switched on or off while the page is open: rebuild the tier.
let lastReduced = motionMode().reduced;
onMotionChange((m) => {
  if (m.reduced !== lastReduced) { lastReduced = m.reduced; startStory(); }
});

// Returning from the back-forward cache: re-measure without replaying the intro.
addEventListener('pageshow', (e) => { if (e.persisted) { story?.remeasure?.(); refreshNav(); } });

export { cfg, report, attempt, attemptAsync };
