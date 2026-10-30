// The scroll story. One value, p = .62 × clamp((scrollY − startY) / travel, 0, 1),
// drives a pure evaluateStory(p, viewport) whose output the render adapters draw:
// the WebGL card (board.js) on every tier that supports WebGL2, and the
// projected SVG board otherwise. On top of the pure state, an optional hero layer
// (pointer tilt and a slow idle float) applies only while the hero is in view and
// motion is allowed. No résumé strings live here.

import { trackGeometry, progressAt, scrollYFor, boardFraming, evaluateStory } from './story-state.js';
import { boardGeometry, BOARD } from './art.js';
import { createSvgBoard } from './board-svg.js';
import { makeCamera, rotation, projectPoint, layerZ } from './projection.js';
import { addTask, removeTask, wake } from './scheduler.js';
import { setScroller, refreshNav } from './nav.js';
import { motionMode, onMotionChange, createSpring } from './motion.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const RAD = Math.PI / 180;
export { trackGeometry, progressAt, scrollYFor, boardFraming, evaluateStory };

function el(name, attrs = {}, parent) {
  const n = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent?.appendChild(n);
  return n;
}

export async function createStory({ cfg, tier, report }) {
  const root = document.documentElement;
  const J = cfg.journey;
  const stage = document.getElementById('stage');
  const journey = document.getElementById('journey');
  const hero = document.querySelector('.hero');
  const heroVisual = hero.querySelector('.hero-visual');
  const heroStill = hero.querySelector('.hero-card');
  const beats = [...journey.querySelectorAll('.beat')];
  const captionEls = beats.map((b) => b.querySelector('.beat-caption'));
  const beatCfg = cfg.illustrations.beats;
  const board = boardGeometry();
  const cleanups = [];
  const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); cleanups.push(() => target.removeEventListener(type, fn, opts)); };

  // ---- Stage DOM: SVG fallback board, layer leaders, LED glow, labels ----
  stage.replaceChildren();
  const svg = el('svg', { class: 'stage-svg', 'aria-hidden': 'true', focusable: 'false' }, stage);
  const defs = el('defs', {}, svg);
  const grad = el('radialGradient', { id: 'led-glow-grad' }, defs);
  // Stop colours go through CSS so the theme token applies (attributes can't use var()).
  for (const [offset, alpha] of [['0', '0.9'], ['0.18', '0.55'], ['0.5', '0.16'], ['1', '0']]) {
    const stop = el('stop', { offset }, grad);
    stop.style.stopColor = 'var(--led)';
    stop.style.stopOpacity = alpha;
  }
  const svgBoard = createSvgBoard(svg);
  const gLeaders = el('g', { class: 'art stage-leaders' }, svg);
  const leaders = [0, 1, 2, 3].map(() => el('path', { class: 'stage-leader' }, gLeaders));
  const glow = el('circle', { class: 'led-glow', r: '0', fill: 'url(#led-glow-grad)' }, svg);
  const labelBox = document.createElement('div');
  labelBox.className = 'stage-labels';
  const labels = cfg.illustrations.layers.map(({ skill }) => {
    const s = document.createElement('span');
    s.className = 'stage-label';
    s.textContent = skill;
    labelBox.appendChild(s);
    return s;
  });
  stage.appendChild(labelBox);

  // ---- Lenis smooth scrolling (one scheduler owns its frames) ----
  let lenis = null;
  try {
    const { default: Lenis } = await import('lenis');
    lenis = new Lenis({ autoRaf: false, lerp: 0.09, wheelMultiplier: 1, syncTouch: false });
    setScroller({
      y: () => window.scrollY,
      scrollTo: (y, { immediate = false } = {}) => { lenis.scrollTo(y, { immediate, force: true }); wake(); },
    });
  } catch (err) {
    report('smooth scrolling', err);
  }

  // ---- The photoreal card (narrow screens get lighter textures) ----
  // Its textures and shaders cost main-thread time, so it starts on the
  // visitor's first scroll, pointer move, touch or key (or once the page is
  // idle). Until it is ready the hero shows the identical still and the story
  // draws the SVG card.
  let gl = null;
  let vc = null;
  let dirty = true;
  let destroyed = false;
  let glStart = null;
  function startGl() {
    if (glStart || destroyed) return glStart;
    glStart = (async () => {
      try {
        const mod = await import('./board.js');
        const view = await mod.createBoardView({
          stage,
          quality: tier === 'full' ? 'hi' : 'lo',
          onUpdate: () => { dirty = true; wake(); },
          onLost: () => { gl = null; if (vc) vc.webgl = false; root.removeAttribute('data-card'); dirty = true; wake(); },
        });
        await view.ready;
        if (destroyed) { view.dispose(); return; }
        gl = view;
        if (vc) { vc.webgl = true; gl.resize(vc.vw, vc.vh, vc.framing.ppu); }
        // The still steps aside only once the live card is drawing.
        root.setAttribute('data-card', 'live');
        dirty = true;
        wake();
      } catch (err) {
        report('3D card', err);
      }
    })();
    return glStart;
  }
  for (const type of ['pointermove', 'wheel', 'touchstart', 'keydown', 'scroll']) on(window, type, startGl, { passive: true, once: true });
  const idleStart = setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(startGl, { timeout: 2000 }) : startGl()), 2500);

  // ---- Measurement ----
  let geo = null;
  let lastW = 0, lastH = 0;
  let headerH = 0;
  let stableVh = window.innerHeight;

  function measure() {
    const vw = document.documentElement.clientWidth;
    const ih = window.innerHeight;
    // Mobile browser chrome changes innerHeight as it shows/hides; only accept a
    // new height when the width changes or the jump is large (rotation, split view).
    if (vw !== lastW || Math.abs(ih - stableVh) > 140) stableVh = ih;
    lastW = vw; lastH = stableVh;
    headerH = document.getElementById('site-header')?.offsetHeight ?? 0;
    const vh = stableVh;
    const y0 = window.scrollY;
    const startY = hero.getBoundingClientRect().top + y0;
    geo = trackGeometry({ vw, vh, startY, tier: tier === 'full' ? 'full' : 'compact', journeyCfg: J });
    journey.style.setProperty('--journey-h', `${Math.max(vh, geo.trackH - hero.offsetHeight)}px`);
    const journeyTop = journey.getBoundingClientRect().top + y0;
    beats.forEach((b, i) => {
      const y = Math.max(scrollYFor(beatCfg[i].p, geo), journeyTop);
      b.style.setProperty('--beat-y', `${y - journeyTop}px`);
    });

    // Where the card sits in the hero at p = 0: exactly over its still image
    // (screen = document at the top).
    const r = heroStill.getBoundingClientRect();
    const framing = boardFraming(vw, vh, tier === 'full' ? 'full' : 'compact');
    vc = {
      vw, vh, travel: geo.travel, end: geo.end, ranges: J.ranges,
      yawDeg: J.pose.yawDeg, pitchDeg: J.pose.pitchDeg,
      framing, webgl: !!gl, explodeDistance: tier === 'full' ? 150 : 110, captionWindows: J.captionWindows,
      hero: { cx: r.left + r.width / 2, cy: r.top + y0 - startY + r.height / 2, w: r.width * J.hero.widthRatio },
      heroCfg: J.hero,
    };
    svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    gl?.resize(vw, vh, framing.ppu);
    lastP = -1;
    dirty = true;
  }

  // ---- Optional hero layer: pointer tilt and a slow idle float ----
  const tiltYaw = createSpring(cfg.motion.spring, 0);
  const tiltPitch = createSpring(cfg.motion.spring, 0);
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  // Touch screens keep a still hero card (it still moves with the scroll).
  const heroAllowed = () => finePointer.matches && !motionMode().reduced && !motionMode().paused;
  on(window, 'pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !finePointer.matches || !vc) return;
    tiltYaw.target = (e.clientX / vc.vw - 0.5) * 16;
    tiltPitch.target = (e.clientY / vc.vh - 0.5) * 10;
    wake();
  }, { passive: true });

  function livePose(s, time) {
    const w = s.heroLive;
    if (w <= 0.001 || !heroAllowed()) return s;
    return {
      ...s,
      pose: {
        ...s.pose,
        yaw: s.pose.yaw + w * tiltYaw.value * RAD,
        pitch: s.pose.pitch + w * tiltPitch.value * RAD,
        roll: s.pose.roll + w * Math.sin(time / 2300) * 0.7 * RAD,
        ty: s.pose.ty + w * Math.sin(time / 1900) * 9,
      },
    };
  }

  // ---- Rendering ----
  let lastP = -1;
  let parked = false;
  let state = null;
  const R0 = [0, 0, 0];

  function renderSvg(s) {
    const cam = makeCamera(vc.vw, vc.vh, vc.framing.ppu);
    svgBoard.setVisible(s.svgOpacity > 0);
    if (s.svgOpacity > 0) {
      svgBoard.setOpacity(s.svgOpacity);
      svgBoard.render(s.pose, s.explode, cam);
    }
    renderOverlay(s, cam);
  }

  // Layer labels with leader lines, and the LED glow (every tier).
  function renderOverlay(s, cam) {
    const R = rotation(s.pose.yaw, s.pose.pitch, s.pose.roll);
    const showLabels = s.labels > 0.001;
    labelBox.style.display = showLabels ? '' : 'none';
    gLeaders.style.display = showLabels ? '' : 'none';
    if (showLabels) {
      if (vc.vw < 860) {
        // A row above the board: each label points straight down to its layer's
        // back edge at a different x, so leaders never cross.
        const anchors = [0, 1, 2, 3].map((i) => projectPoint(BOARD.W * (0.13 + 0.25 * i), 0, layerZ(i, s.explode), s.pose, cam, R, [0, 0, 0]));
        const top = Math.min(...anchors.map((a) => a[1]));
        // One row when every label fits over its own layer; otherwise alternate
        // rows, and a label that still touches its row neighbour moves right.
        const place = (rows) => {
          const rowRight = Array(rows).fill(-Infinity);
          let shifted = false;
          const placed = anchors.map(([ax, ay], i) => {
            const w = labels[i].offsetWidth || 90;
            const row = i % rows;
            const want = Math.min(vc.vw - w - 8, Math.max(8, ax - w / 2));
            const lx = Math.min(vc.vw - w - 8, Math.max(want, rowRight[row] + 6));
            if (lx !== want) shifted = true;
            rowRight[row] = lx + w;
            return { ax, ay, lx, ly: top - 44 - row * 34 };
          });
          return { placed, shifted };
        };
        let { placed, shifted } = place(1);
        if (shifted) placed = place(2).placed;
        // On short screens the rows would slide under the header; the caption
        // already pairs each layer with its skill, so the labels step aside.
        const fits = Math.min(...placed.map((q) => q.ly)) >= headerH + 4;
        placed.forEach(({ ax, ay, lx, ly }, i) => {
          labels[i].style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px)`;
          labels[i].style.opacity = fits ? s.labels : 0;
          leaders[i].setAttribute('d', `M${ax.toFixed(1)} ${ay.toFixed(1)}L${ax.toFixed(1)} ${(ly + 30).toFixed(1)}`);
          leaders[i].style.opacity = fits ? s.labels : 0;
        });
      } else {
        const anchors = [0, 1, 2, 3].map((i) => projectPoint(BOARD.W - 24, BOARD.H * 0.5, layerZ(i, s.explode), s.pose, cam, R, [0, 0, 0]).slice(0, 2));
        const maxX = Math.max(...[0, 3].map((i) => projectPoint(BOARD.W, 0, layerZ(i, s.explode), s.pose, cam, R)[0]), ...anchors.map((a) => a[0]));
        let prevY = -Infinity;
        anchors.forEach(([ax, ay], i) => {
          const w = labels[i].offsetWidth || 120;
          // Stay clear of the chapter dots column on the right edge.
          const lx = Math.min(vc.vw - w - 76, maxX + 36);
          const ly = Math.max(ay - 14, prevY + 36);
          prevY = ly;
          labels[i].style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px)`;
          labels[i].style.opacity = s.labels;
          leaders[i].setAttribute('d', `M${ax.toFixed(1)} ${ay.toFixed(1)}L${(lx - 6).toFixed(1)} ${(ly + 14).toFixed(1)}`);
          leaders[i].style.opacity = s.labels;
        });
      }
    }
    if (s.led > 0.001) {
      const q = projectPoint(board.led.x, board.led.y, layerZ(1, s.explode) + 6, s.pose, cam, R, R0);
      glow.setAttribute('cx', q[0].toFixed(1));
      glow.setAttribute('cy', q[1].toFixed(1));
      glow.setAttribute('r', (cam.ppu * 70 * (0.55 + 0.45 * s.led)).toFixed(1));
      glow.style.opacity = (0.9 * s.led).toFixed(3);
    } else {
      glow.setAttribute('r', '0');
    }
  }

  // Returns true while the hero layer still needs frames.
  function render(time, dt) {
    const y = window.scrollY;
    const p = progressAt(y, geo);
    const offTrack = y > geo.endY + vc.vh * 0.6;
    if (offTrack !== parked) {
      parked = offTrack;
      stage.classList.toggle('is-parked', parked);
      if (parked) gl?.park(); else gl?.unpark();
      dirty = true;
    }
    if (parked) return false;
    const changed = dirty || Math.abs(p - lastP) >= 1e-7;
    if (changed) {
      lastP = p;
      dirty = false;
      state = evaluateStory(p, vc);
      stage.dataset.p = p.toFixed(4);
      captionEls.forEach((c, i) => {
        const o = state.captions[i] ?? 0;
        c.style.opacity = o.toFixed(3);
        c.style.visibility = o > 0.001 ? 'visible' : 'hidden';
      });
      // Optional ambient motion only once the story has handed off (CSS-driven,
      // paused by Pause motion; the story's own channels stay frozen).
      stage.classList.toggle('is-ambient', p >= J.end - 1e-6 && !motionMode().paused);
      stage.style.setProperty('--stage-o', state.stageOpacity.toFixed(4));
      stage.style.transform = state.stageScale === 1 ? '' : `scale(${state.stageScale.toFixed(4)})`;
      renderSvg(state);
    }
    const live = !!gl && state.heroLive > 0.001 && heroAllowed();
    if (live) {
      tiltYaw.step(dt); tiltPitch.step(dt);
      // The panels behind the card drift the other way, for depth.
      heroVisual.style.setProperty('--px', (tiltYaw.value / 8).toFixed(3));
      heroVisual.style.setProperty('--py', (tiltPitch.value / 5).toFixed(3));
    }
    if (gl && (changed || live)) gl.render(live ? livePose(state, time) : state);
    return live;
  }

  // ---- Frame task: Lenis first, then the story ----
  addTask('story', (time, dt) => {
    lenis?.raf(time);
    const live = render(time, dt);
    return !!lenis?.isScrolling || live;
  });
  for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown']) on(window, type, wake, { passive: true });
  on(window, 'scroll', wake, { passive: true });

  // ---- Resize: re-measure, keeping the visitor's place inside the track ----
  let pointerDown = false;
  on(window, 'pointerdown', () => { pointerDown = true; }, { passive: true });
  on(window, 'pointerup', () => { pointerDown = false; }, { passive: true });
  let resizeTimer = 0;
  function remeasure() {
    intro?.cancel();
    const pBefore = geo ? progressAt(window.scrollY, geo) : 0;
    const inside = geo && window.scrollY >= geo.startY && window.scrollY < geo.endY;
    measure();
    lenis?.resize();
    if (inside && !pointerDown && pBefore > 0 && pBefore < J.end) {
      window.scrollTo(0, scrollYFor(pBefore, geo));
      lenis?.scrollTo(scrollYFor(pBefore, geo), { immediate: true, force: true });
    }
    refreshNav();
    wake();
  }
  const onResize = () => {
    const vw = document.documentElement.clientWidth;
    if (vw === lastW && Math.abs(window.innerHeight - lastH) <= 140) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(remeasure, 150);
  };
  on(window, 'resize', onResize, { passive: true });
  on(window, 'orientationchange', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(remeasure, 250); });

  measure();
  render(performance.now(), 16.7);

  const offTheme = (await import('./theme.js')).onThemeChange(() => { gl?.recolor(); dirty = true; wake(); });
  cleanups.push(offTheme);
  cleanups.push(onMotionChange(() => { dirty = true; wake(); }));
  cleanups.push(() => stage.classList.remove('is-ambient'));

  // ---- Scroll hint and intro (first view only; skipped mid-page or by hash) ----
  const hint = document.createElementNS(SVGNS, 'svg');
  hint.setAttribute('class', 'scroll-hint');
  hint.setAttribute('viewBox', '0 0 20 44');
  hint.setAttribute('aria-hidden', 'true');
  hint.setAttribute('focusable', 'false');
  hint.innerHTML = '<path d="M10 2v34M4 30l6 6 6-6" fill="none" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';
  hero.appendChild(hint);
  cleanups.push(() => hint.remove());

  let intro = null;
  if (root.classList.contains('intro-pending') && window.scrollY < 4 && !location.hash && !motionMode().reduced) {
    try {
      const mod = await import('./intro.js');
      intro = mod.runIntro({ cfg, name: document.getElementById('hero-name'), report });
    } catch (err) {
      report('intro', err);
    }
  }
  if (!intro) {
    root.classList.remove('intro-pending');
    root.classList.add('intro-header', 'intro-chapters', 'intro-hint');
  }

  return {
    tier,
    remeasure,
    get state() { return state; },
    get geometry() { return { ...geo }; },
    destroy() {
      destroyed = true;
      clearTimeout(idleStart);
      intro?.cancel();
      removeTask('story');
      cleanups.forEach((fn) => fn());
      clearTimeout(resizeTimer);
      lenis?.destroy();
      setScroller(null);
      gl?.dispose();
      stage.replaceChildren();
      stage.removeAttribute('style');
      delete stage.dataset.p;
      stage.classList.remove('is-parked');
      journey.style.removeProperty('--journey-h');
      beats.forEach((b) => b.style.removeProperty('--beat-y'));
      captionEls.forEach((c) => { c.style.opacity = ''; c.style.visibility = ''; });
      root.removeAttribute('data-tier');
      root.removeAttribute('data-card');
      heroVisual.style.removeProperty('--px');
      heroVisual.style.removeProperty('--py');
    },
  };
}
