// Project mini-worlds: TideCast's globe and mode-labelled pipeline (driven by
// the panel's own scroll position), Vedam's drawn-then-filled arch, and the
// interactive NFC card. Nothing here requests location or camera, loads a model
// or calls an API; the illustrations only explain the linked projects.

import { addTask, removeTask, wake } from './scheduler.js';
import { motionMode, onMotionChange, clamp } from './motion.js';
import { globeGeometry, pathFromPoints, boardGeometry } from './art.js';
import { makeCamera, projectPoint, rotation, layerZ } from './projection.js';
import { createSvgBoard, fieldRings } from './board-svg.js';
import { onThemeChange } from './theme.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const RAD = Math.PI / 180;

function svgEl(name, attrs, parent) {
  const n = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  parent?.appendChild(n);
  return n;
}

export async function initProjects({ cfg, tier, report }) {
  const cleanups = [];
  const reduced = () => motionMode().reduced;

  // ---- TideCast: globe turns and steps light from local scroll progress ----
  const tide = document.querySelector('.world-tidecast');
  if (tide) {
    const panel = tide.closest('.project');
    const svg = tide.querySelector('.globe-art');
    const globeGroup = svg.querySelector('.art-globe');
    const pingGroup = svg.querySelector('.art-ping');
    const steps = [...tide.querySelectorAll('.pipeline-step')];
    globeGroup.replaceChildren();
    const outline = svgEl('path', {}, globeGroup);
    const grid = svgEl('path', {}, globeGroup);
    const pings = [...pingGroup.querySelectorAll('circle')];
    let lastLon = NaN;
    const draw = (lon) => {
      const g = globeGeometry(200, 200, 168, { lon0: lon, lat0: 24 });
      outline.setAttribute('d', pathFromPoints(g.outline));
      grid.setAttribute('d', g.lines.map((l) => pathFromPoints(l)).join(''));
      const p = g.project(30.6, -96.3);
      pingGroup.style.display = p.visible ? '' : 'none';
      for (const c of pings) { c.setAttribute('cx', p.x.toFixed(1)); c.setAttribute('cy', p.y.toFixed(1)); }
    };
    const update = () => {
      const r = panel.getBoundingClientRect();
      const vh = window.innerHeight;
      if (r.bottom < -50 || r.top > vh + 50) return false;
      const progress = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.25));
      steps.forEach((s, i) => s.classList.toggle('is-active', progress >= (i + 1) / (steps.length + 1)));
      const lon = reduced() ? -88 : -128 + progress * 64;
      if (!(Math.abs(lon - lastLon) <= 0.1)) { lastLon = lon; draw(lon); }
      return false;
    };
    addTask('tidecast', update);
    cleanups.push(() => { removeTask('tidecast'); steps.forEach((s) => s.classList.remove('is-active')); draw(-88); });
  }

  // ---- Vedam: stroke by stroke, then fill, once on first view ----
  const vedam = document.querySelector('.vedam-svg');
  if (vedam && !reduced()) {
    const strokes = [...vedam.querySelectorAll('g:not(.art-vedam-fill) path')];
    strokes.forEach((p, i) => {
      p.setAttribute('pathLength', '1');
      p.style.strokeDasharray = '1';
      p.style.strokeDashoffset = '1';
      p.style.setProperty('--i', String(Math.min(i, 24)));
    });
    vedam.classList.add('is-armed');
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      vedam.classList.add('is-drawn');
      setTimeout(() => strokes.forEach((p) => { p.removeAttribute('pathLength'); p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; }), 2200);
    }, { threshold: 0.3 });
    io.observe(vedam);
    cleanups.push(() => { io.disconnect(); vedam.classList.remove('is-armed', 'is-drawn'); strokes.forEach((p) => { p.removeAttribute('pathLength'); p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; }); });
  }

  // ---- NFC card: drag (horizontal intent) or buttons; illustrative field ----
  const fig = document.querySelector('.world-nfc');
  if (fig) cleanups.push(await initNfc(fig, { cfg, tier, report, reduced }));

  return { destroy() { cleanups.forEach((fn) => fn?.()); } };
}

async function initNfc(fig, { cfg, tier, report, reduced }) {
  const N = cfg.illustrations.projects['nfc-card'];
  const view = fig.querySelector('[data-nfc-view]');
  const staticSvg = view.querySelector('.nfc-static');
  const controls = fig.querySelector('.nfc-controls');
  const note = fig.querySelector('.nfc-field-note');
  const status = fig.querySelector('.nfc-status');
  const fieldBtn = controls.querySelector('[data-nfc="field"]');
  const B = boardGeometry();
  const DEFAULT = { yaw: -24, pitch: -16 };
  const PITCH_MAX = 30;
  let yaw = DEFAULT.yaw, pitch = DEFAULT.pitch, velocity = 0;
  let fieldPinned = false, fieldPreview = false;
  let dirty = true;

  const live = svgEl('svg', { class: 'nfc-live', 'aria-hidden': 'true', focusable: 'false' });
  view.appendChild(live);
  const svgBoard = createSvgBoard(live);
  const overlay = svgEl('g', { class: 'art nfc-field' }, live);
  const rings = fieldRings().map(() => svgEl('path', { class: 'nfc-ring' }, overlay));
  const defs = svgEl('defs', {}, live);
  const grad = svgEl('radialGradient', { id: 'nfc-led-grad' }, defs);
  for (const [offset, alpha] of [['0', '0.9'], ['0.2', '0.5'], ['0.55', '0.14'], ['1', '0']]) {
    const s = svgEl('stop', { offset }, grad);
    s.style.stopColor = 'var(--led)';
    s.style.stopOpacity = alpha;
  }
  const glow = svgEl('circle', { class: 'led-glow', r: '0', fill: 'url(#nfc-led-grad)' }, live);
  staticSvg.style.display = 'none';
  view.classList.add('is-live');

  let gl = null;
  if (tier === 'full') {
    try {
      const mod = await import('./board.js');
      gl = await mod.createNfcGlView({ container: view, onRelease: () => { dirty = true; wake(); } });
    } catch (err) { report('NFC 3D view', err); gl = null; }
  }

  let size = { w: 1, h: 1 };
  const measure = () => {
    const r = view.getBoundingClientRect();
    size = { w: Math.max(1, r.width), h: Math.max(1, r.height) };
    live.setAttribute('viewBox', `0 0 ${size.w.toFixed(1)} ${size.h.toFixed(1)}`);
    gl?.resize(size.w, size.h, ppu());
    dirty = true;
  };
  const ppu = () => (size.w * 0.62) / B.outline.reduce((m, [x]) => Math.max(m, x), 0);

  let visible = false;
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) { measure(); if (gl && !gl.active) gl.activate(size.w, size.h, ppu()); }
    else gl?.deactivate();
    dirty = true;
    wake();
  }, { rootMargin: '120px 0px' });
  io.observe(view);

  const fieldOn = () => fieldPinned || fieldPreview;
  function render() {
    const cam = makeCamera(size.w, size.h, ppu());
    const pose = { yaw: yaw * RAD, pitch: pitch * RAD, tx: 0, ty: 0 };
    const on = fieldOn();
    if (gl?.active) {
      svgBoard.setVisible(false);
      gl.render(pose, on ? 1 : 0);
    } else {
      svgBoard.setVisible(true);
      svgBoard.render(pose, 0, cam);
    }
    overlay.style.display = on ? '' : 'none';
    note.hidden = !on;
    if (on) {
      const R = rotation(pose.yaw, pose.pitch);
      const z = layerZ(1, 0);
      fieldRings().forEach((ring, i) => {
        let d = '';
        ring.forEach(([x, y], j) => { const q = projectPoint(x, y, z, pose, cam, R); d += (j ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); });
        rings[i].setAttribute('d', d);
      });
      const q = projectPoint(B.led.x, B.led.y, z + 6, pose, cam, R);
      glow.setAttribute('cx', q[0].toFixed(1));
      glow.setAttribute('cy', q[1].toFixed(1));
      glow.setAttribute('r', (cam.ppu * 70).toFixed(1));
    } else {
      glow.setAttribute('r', '0');
    }
  }

  addTask('nfc', (time, dt) => {
    let moving = false;
    if (!pointer.dragging && Math.abs(velocity) > 0.002 && !reduced()) {
      yaw += velocity * dt;
      velocity *= Math.pow(0.85, dt / 16.7);
      moving = true;
      dirty = true;
    } else if (!pointer.dragging) {
      velocity = 0;
    }
    if (visible && dirty) { dirty = false; render(); }
    return moving;
  });

  // Pointer: rotate only after a clear horizontal intention; vertical gestures
  // keep scrolling the page (touch-action: pan-y in CSS).
  const pointer = { id: null, x: 0, y: 0, decided: false, dragging: false, lastT: 0 };
  const onDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    Object.assign(pointer, { id: e.pointerId, x: e.clientX, y: e.clientY, decided: false, dragging: false, lastT: e.timeStamp });
    velocity = 0;
  };
  const onMove = (e) => {
    if (e.pointerId !== pointer.id) return;
    const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
    if (!pointer.decided) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      pointer.decided = true;
      if (Math.abs(dx) <= Math.abs(dy)) { pointer.id = null; return; } // a scroll, not a drag
      pointer.dragging = true;
      // The pointer may already be gone (fast flick, synthetic input): drag without capture.
      try { view.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
      view.classList.add('is-dragging');
    }
    if (!pointer.dragging) return;
    const dt = Math.max(1, e.timeStamp - pointer.lastT);
    yaw += dx * 0.45;
    pitch = clamp(pitch + dy * 0.25, -PITCH_MAX, PITCH_MAX);
    velocity = clamp((dx * 0.45) / dt, -0.25, 0.25);
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.lastT = e.timeStamp;
    dirty = true;
    wake();
  };
  const end = (e, cancelled) => {
    if (e.pointerId !== pointer.id) return;
    try { if (view.hasPointerCapture(e.pointerId)) view.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    if (cancelled || reduced()) velocity = 0;
    pointer.id = null; pointer.dragging = false; pointer.decided = false;
    view.classList.remove('is-dragging');
    wake();
  };
  const onUp = (e) => end(e, false);
  const onCancel = (e) => end(e, true);
  view.addEventListener('pointerdown', onDown);
  view.addEventListener('pointermove', onMove);
  view.addEventListener('pointerup', onUp);
  view.addEventListener('pointercancel', onCancel);

  // Buttons: the keyboard and touch alternative to dragging. Stepped 15°
  // poses; focus stays on the button; a short status after explicit actions.
  const say = (msg) => { status.textContent = ''; requestAnimationFrame(() => { status.textContent = msg; }); };
  const onClick = (e) => {
    const b = e.target.closest('[data-nfc]');
    if (!b) return;
    velocity = 0;
    const action = b.dataset.nfc;
    if (action === 'left') { yaw -= 15; say(N.status.left); }
    else if (action === 'right') { yaw += 15; say(N.status.right); }
    else if (action === 'reset') { yaw = DEFAULT.yaw; pitch = DEFAULT.pitch; say(N.status.reset); }
    else if (action === 'field') {
      fieldPinned = !fieldPinned;
      b.setAttribute('aria-pressed', String(fieldPinned));
      say(fieldPinned ? N.status.fieldOn : N.status.fieldOff);
    }
    dirty = true;
    wake();
  };
  controls.addEventListener('click', onClick);
  const preview = (on) => () => { fieldPreview = on; dirty = true; wake(); };
  const previewHandlers = [['pointerenter', preview(true)], ['pointerleave', preview(false)], ['focus', preview(true)], ['blur', preview(false)]];
  for (const [t, fn] of previewHandlers) fieldBtn.addEventListener(t, fn);

  const onResize = () => { measure(); wake(); };
  window.addEventListener('resize', onResize, { passive: true });
  const offTheme = onThemeChange(() => { gl?.recolor(); dirty = true; wake(); });
  const offMotion = onMotionChange(() => { velocity = 0; dirty = true; wake(); });
  controls.hidden = false;
  measure();
  wake();

  return () => {
    removeTask('nfc');
    io.disconnect();
    gl?.dispose();
    controls.removeEventListener('click', onClick);
    for (const [t, fn] of previewHandlers) fieldBtn.removeEventListener(t, fn);
    view.removeEventListener('pointerdown', onDown);
    view.removeEventListener('pointermove', onMove);
    view.removeEventListener('pointerup', onUp);
    view.removeEventListener('pointercancel', onCancel);
    window.removeEventListener('resize', onResize);
    offTheme();
    offMotion();
    live.remove();
    staticSvg.style.display = '';
    view.classList.remove('is-live');
    controls.hidden = true;
    note.hidden = true;
  };
}
