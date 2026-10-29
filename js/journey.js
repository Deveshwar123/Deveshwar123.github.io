// The scroll story. One value, p = .62 × clamp((scrollY − startY) / travel, 0, 1),
// drives a pure evaluateStory(p, viewport) whose output the render adapters draw:
// the SVG adapter (morph + projected board, every tier) and the WebGL adapter
// (full tier, via board.js). No résumé strings live here.

import { trackGeometry, progressAt, scrollYFor, boardFraming, evaluateStory } from './story-state.js';
import { jaliGeometry, boardGeometry, pathFromPoints, BOARD } from './art.js';
import { buildMorph, interpolate, arrayToPath } from './morph.js';
import { createSvgBoard } from './board-svg.js';
import { makeCamera, rotation, projectPoint, layerZ } from './projection.js';
import { addTask, removeTask, wake } from './scheduler.js';
import { setScroller, refreshNav } from './nav.js';
import { motionMode, onMotionChange } from './motion.js';

const SVGNS = 'http://www.w3.org/2000/svg';
export { trackGeometry, progressAt, scrollYFor, boardFraming, evaluateStory };

// ---------------------------------------------------------------------------
// DOM story
// ---------------------------------------------------------------------------

function el(name, attrs = {}, parent) {
  const n = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent?.appendChild(n);
  return n;
}

const multiPath = (lines) => lines.map((l) => pathFromPoints(l)).join('');

export async function createStory({ cfg, tier, report }) {
  const root = document.documentElement;
  const J = cfg.journey;
  const stage = document.getElementById('stage');
  const journey = document.getElementById('journey');
  const hero = document.querySelector('.hero');
  const crest = hero.querySelector('.hero-crest');
  const archBox = hero.querySelector('[data-arch-box]');
  const beats = [...journey.querySelectorAll('.beat')];
  const beatCfg = cfg.illustrations.beats;
  const board = boardGeometry();
  const cleanups = [];
  const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); cleanups.push(() => target.removeEventListener(type, fn, opts)); };

  // ---- Stage DOM ----
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

  const gMorph = el('g', { class: 'art stage-morph' }, svg);
  const gOrn = el('g', { class: 'art art-ornament' }, svg);
  const ornPath = el('path', {}, gOrn);
  const gFace = el('g', { class: 'art stage-face' }, svg);
  const face = {
    fill: el('path', { class: 'art-board-fill' }, gFace),
    silk: el('path', { class: 'art-silk' }, gFace),
    extra: el('path', { class: 'art-copper-extra' }, gFace),
    unpaired: el('path', { class: 'art-traces' }, gFace),
    vias: el('path', { class: 'art-vias' }, gFace),
  };
  const svgBoard = createSvgBoard(svg);
  const gLeaders = el('g', { class: 'art stage-leaders' }, svg);
  const leaders = [0, 1, 2, 3].map(() => el('path', { class: 'stage-leader' }, gLeaders));
  const glow = el('circle', { class: 'led-glow', r: '0', fill: 'url(#led-glow-grad)' }, svg);
  const labelBox = document.createElement('div');
  labelBox.className = 'stage-labels';
  const labels = cfg.illustrations.layerLabels.map((text) => {
    const s = document.createElement('span');
    s.className = 'stage-label';
    s.textContent = text;
    labelBox.appendChild(s);
    return s;
  });
  stage.appendChild(labelBox);

  // Static board strings (board units) for the face-on transform.
  const tc = board.topCopper;
  face.fill.setAttribute('d', pathFromPoints(board.outline) + 'Z');
  face.silk.setAttribute('d', multiPath(board.silkscreen));
  face.extra.setAttribute('d', multiPath([...tc.feeds, ...tc.pinStubs, ...tc.ledPads, ...tc.ledTraces, ...board.pads.map(([x, y]) => [[x - 12, y - 10], [x + 12, y - 10], [x + 12, y + 10], [x - 12, y + 10], [x - 12, y - 10]])]));
  face.vias.setAttribute('d', board.vias.map(([x, y]) => `M${x + 8} ${y}A8 8 0 1 1 ${x - 8} ${y}A8 8 0 1 1 ${x + 8} ${y}`).join(''));
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

  // ---- WebGL board (full tier) ----
  let gl = null;
  if (tier === 'full') {
    try {
      const mod = await import('./board.js');
      gl = await mod.createBoardView({ stage, onLost: () => { gl = null; if (vc) vc.webgl = false; dirty = true; wake(); } });
    } catch (err) {
      report('3D board', err);
      gl = null;
    }
  }
  const effectiveTier = tier === 'full' && !gl ? 'compact-wide' : tier;

  // ---- Measurement ----
  let vc = null;
  let geo = null;
  let morph = null;
  let jali = null;
  let lastW = 0, lastH = 0;
  let stableVh = window.innerHeight;
  let originals = [];

  function measure() {
    const vw = document.documentElement.clientWidth;
    const ih = window.innerHeight;
    // Mobile browser chrome changes innerHeight as it shows/hides; only accept a
    // new height when the width changes or the jump is large (rotation, split view).
    if (vw !== lastW || Math.abs(ih - stableVh) > 140) stableVh = ih;
    lastW = vw; lastH = stableVh;
    const vh = stableVh;
    const y0 = window.scrollY;
    const startY = hero.getBoundingClientRect().top + y0;
    geo = trackGeometry({ vw, vh, startY, tier: tier === 'full' ? 'full' : 'compact', journeyCfg: J });
    journey.style.setProperty('--journey-h', `${Math.max(vh, geo.trackH - hero.offsetHeight)}px`);
    const journeyTop = journey.getBoundingClientRect().top + y0;
    beats.forEach((b, i) => {
      const bc = beatCfg[i];
      // A beat never starts above the journey: the hero itself is the intro, and a
      // box placed over it would count as a layout shift when the tier switches.
      const y = Math.max(scrollYFor(bc.p, geo), journeyTop);
      const next = i + 1 < beatCfg.length ? scrollYFor(beatCfg[i + 1].p, geo) : geo.endY - vh * 0.6;
      b.style.setProperty('--beat-y', `${y - journeyTop}px`);
      // Each caption leaves before the next arrives, so only one is ever pinned.
      b.style.setProperty('--beat-h', `${Math.max(vh * 0.6, next - y - vh * 0.62)}px`);
      const capP = i === 0 ? J.ranges.ornamentFade[0] - 0.02 : bc.p;
      const capOffset = Math.max(0, scrollYFor(capP, geo) - y);
      // Wide screens pin captions beside the board; narrow screens let them scroll
      // through below it, entering from the bottom at their beat.
      b.querySelector('.beat-caption').style.marginTop = tier === 'full' ? (capOffset ? `${capOffset}px` : '') : `${capOffset + vh * 0.62}px`;
    });

    const framing = boardFraming(vw, vh, tier === 'full' ? 'full' : 'compact');
    vc = {
      vw, vh, travel: geo.travel, end: geo.end, ranges: J.ranges,
      yawDeg: J.pose.yawDeg, pitchDeg: J.pose.pitchDeg,
      framing, webgl: !!gl, explodeDistance: tier === 'full' ? 92 : 64,
    };

    // Jali geometry around the measured crest text (document coordinates).
    const cr = crest.getBoundingClientRect();
    const br = archBox.getBoundingClientRect();
    const frame = { x: cr.left, y: cr.top + y0, w: cr.width, h: cr.height };
    const box = { x: br.left, y: br.top + y0, w: br.width, h: br.height };
    jali = jaliGeometry(frame, box, { maxPairs: vw >= 860 ? 3 : 1 });
    morph = buildMorph(jali, board);

    gMorph.replaceChildren();
    originals = morph.pairs.map((pair) => {
      const cls = pair.id === 'frame' ? 'art-frame' : pair.id.startsWith('arch') ? 'art-arches' : 'art-waves';
      const path = el('path', { class: cls, 'data-pair': pair.id }, gMorph);
      return { path, fromD: pathFromPoints(pair.fromPts), toD: pathFromPoints(pair.toPts) };
    });
    ornPath.setAttribute('d', multiPath(jali.ornament));
    face.unpaired.setAttribute('d', multiPath(morph.unpaired));
    svg.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    gl?.resize(vw, vh, framing.ppu);
    lastP = -1;
    dirty = true;
  }

  // ---- Rendering ----
  let lastP = -1;
  let dirty = true;
  let parked = false;
  let state = null;
  const R0 = [0, 0, 0];

  function setTransform(g, m) { g.setAttribute('transform', m ? `matrix(${m.map((v) => +v.toFixed(4)).join(' ')})` : ''); }

  function renderSvg(s) {
    const cam = makeCamera(vc.vw, vc.vh, vc.framing.ppu);
    const face0 = [cam.ppu, 0, 0, cam.ppu, vc.vw / 2 + s.pose.tx * cam.ppu - BOARD.CX * cam.ppu, vc.vh / 2 - s.pose.ty * cam.ppu - BOARD.CY * cam.ppu];
    const morphing = s.phase === 'morph';
    gMorph.style.display = morphing ? '' : 'none';
    gOrn.style.display = s.ornament > 0 ? '' : 'none';
    gFace.style.display = morphing ? '' : 'none';
    svgBoard.setVisible(!morphing && s.svgOpacity > 0);
    if (morphing) {
      if (s.morphT === 0) {
        setTransform(gMorph, [1, 0, 0, 1, 0, -s.lift]);
        originals.forEach((o) => o.path.setAttribute('d', o.fromD));
      } else {
        setTransform(gMorph, null);
        morph.pairs.forEach((pair, i) => originals[i].path.setAttribute('d', arrayToPath(interpolate(pair, s.morphT, s.lift, face0), pair.n)));
      }
      setTransform(gOrn, [1, 0, 0, 1, 0, -s.lift]);
      gOrn.style.opacity = s.ornament;
      setTransform(gFace, face0);
      gFace.style.opacity = '1';
      face.fill.style.opacity = s.boardFill * 0.9;
      for (const k of ['silk', 'extra', 'unpaired', 'vias']) face[k].style.opacity = s.vias;
    } else if (s.svgOpacity > 0) {
      svgBoard.setOpacity(s.svgOpacity);
      if (s.rot === 0 && s.explode === 0) svgBoard.renderFaceOn(face0);
      else svgBoard.render(s.pose, s.explode, cam);
    }
    renderOverlay(s, cam);
  }

  // Layer labels with leader lines, and the LED glow (both tiers).
  function renderOverlay(s, cam) {
    const R = rotation(s.pose.yaw, s.pose.pitch);
    const showLabels = s.labels > 0.001;
    labelBox.style.display = showLabels ? '' : 'none';
    gLeaders.style.display = showLabels ? '' : 'none';
    if (showLabels) {
      const compact = vc.vw < 860;
      if (compact) {
        // A row above the board: each label points straight down to its layer's
        // back edge at a different x, so leaders never cross.
        const anchors = [0, 1, 2, 3].map((i) => projectPoint(BOARD.W * (0.13 + 0.25 * i), 0, layerZ(i, s.explode), s.pose, cam, R, [0, 0, 0]));
        const top = Math.min(...anchors.map((a) => a[1]));
        let prevRight = -Infinity;
        anchors.forEach(([ax, ay], i) => {
          const w = labels[i].offsetWidth || 90;
          let lx = Math.min(vc.vw - w - 8, Math.max(8, ax - w / 2));
          const row = lx < prevRight + 6 ? 1 : 0;
          const ly = top - 44 - row * 34;
          if (!row) prevRight = lx + w;
          labels[i].style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px)`;
          labels[i].style.opacity = s.labels;
          leaders[i].setAttribute('d', `M${ax.toFixed(1)} ${ay.toFixed(1)}L${ax.toFixed(1)} ${(ly + 30).toFixed(1)}`);
          leaders[i].style.opacity = s.labels;
        });
      } else {
        const anchors = [0, 1, 2, 3].map((i) => projectPoint(BOARD.W - 24, BOARD.H * 0.5, layerZ(i, s.explode), s.pose, cam, R, [0, 0, 0]).slice(0, 2));
        const maxX = Math.max(...[0, 3].map((i) => projectPoint(BOARD.W, 0, layerZ(i, s.explode), s.pose, cam, R)[0]), ...anchors.map((a) => a[0]));
        let prevY = -Infinity;
        anchors.forEach(([ax, ay], i) => {
          const w = labels[i].offsetWidth || 120;
          const lx = Math.min(vc.vw - w - 24, maxX + 36);
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
      const q = projectPoint(board.led.x, board.led.y, layerZ(1, s.explode) + 6, s.pose, cam, R);
      glow.setAttribute('cx', q[0].toFixed(1));
      glow.setAttribute('cy', q[1].toFixed(1));
      glow.setAttribute('r', (cam.ppu * 70 * (0.55 + 0.45 * s.led)).toFixed(1));
      glow.style.opacity = (0.9 * s.led).toFixed(3);
    } else {
      glow.setAttribute('r', '0');
    }
  }

  function render() {
    const y = window.scrollY;
    const p = progressAt(y, geo);
    const offTrack = y > geo.endY + vc.vh * 0.6;
    if (offTrack !== parked) {
      parked = offTrack;
      stage.classList.toggle('is-parked', parked);
      if (parked) gl?.park(); else gl?.unpark();
      dirty = true;
    }
    if (parked || (!dirty && Math.abs(p - lastP) < 1e-7)) return;
    lastP = p;
    dirty = false;
    state = evaluateStory(p, vc);
    stage.dataset.p = p.toFixed(4);
    stage.style.opacity = state.stageOpacity;
    stage.style.transform = state.stageScale === 1 ? '' : `scale(${state.stageScale.toFixed(4)})`;
    renderSvg(state);
    if (gl) gl.render(state, vc);
  }

  // ---- Frame task: Lenis first, then the story ----
  addTask('story', (time) => {
    lenis?.raf(time);
    render();
    return !!lenis?.isScrolling;
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
  render();

  // Theme changes recolour the WebGL materials (SVG follows CSS on its own).
  const offTheme = (await import('./theme.js')).onThemeChange(() => { gl?.recolor(); dirty = true; wake(); });
  cleanups.push(offTheme);

  // Pause motion stops Lenis' inertia from being the only thing moving; nothing in
  // the story itself is autonomous, so there is nothing else to pause here.
  cleanups.push(onMotionChange(() => { dirty = true; wake(); }));

  // ---- Intro (first view only, skipped when arriving mid-page or by hash) ----
  // The data-tier attribute (which hides the static hero art) is set by main.js
  // after this returns, so the stage art takes over without a visible gap.
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
      intro = mod.runIntro({ cfg, paths: originals.map((o) => o.path), ornament: gOrn, name: document.getElementById('hero-name'), report });
    } catch (err) {
      report('intro', err);
    }
  }
  if (!intro) {
    root.classList.remove('intro-pending');
    root.classList.add('intro-header', 'intro-chapters', 'intro-hint');
  }

  return {
    tier: effectiveTier === 'compact-wide' ? 'compact' : tier,
    remeasure,
    get state() { return state; },
    get geometry() { return { ...geo }; },
    destroy() {
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
      beats.forEach((b) => { b.style.removeProperty('--beat-y'); b.style.removeProperty('--beat-h'); b.querySelector('.beat-caption').style.marginTop = ''; });
      root.removeAttribute('data-tier');
    },
  };
}
