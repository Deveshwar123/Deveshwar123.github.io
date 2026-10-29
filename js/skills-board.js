// Skills circuit. Desktop: skills as SMD buttons wired to the roles/projects
// (ICs) that cite them; hover/focus previews, a click pins, Escape clears.
// Narrow screens: the same graph as a filterable list. Every edge comes from
// data with an evidence reference; nothing here infers a relationship.

import { addTask, removeTask } from './scheduler.js';
import { motionMode, onMotionChange } from './motion.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const GRID = 8;
const snap = (v) => Math.round(v / GRID) * GRID;
const DASH_PERIOD = 16; // 10 on, 6 off (CSS px)

export function initSkills(cfg) {
  const section = document.getElementById('skills');
  const body = section.querySelector('[data-skills-graph]');
  const data = JSON.parse(document.getElementById('skills-data').textContent);
  const L = data.labels;
  const cleanups = [];
  const byId = (list, id) => list.find((x) => x.id === id);
  const related = (kind, id) => (kind === 'skill'
    ? data.relations.filter((r) => r.skillId === id).map((r) => r.entityId)
    : data.relations.filter((r) => r.entityId === id).map((r) => r.skillId));
  const summary = (kind, id) => {
    const item = kind === 'skill' ? byId(data.skills, id) : byId(data.entities, id);
    const names = related(kind, id).map((x) => (kind === 'skill' ? byId(data.entities, x) : byId(data.skills, x)).label);
    return names.length ? `${item.label}: ${names.join(', ')}.` : `${item.label}: ${L.noLink}.`;
  };

  // ---------------------------------------------------------------------------
  // Desktop board
  // ---------------------------------------------------------------------------
  const board = document.createElement('div');
  board.className = 'skills-board';
  const grid = document.createElement('div');
  grid.className = 'skills-board-grid';
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('class', 'skills-board-svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  grid.appendChild(svg);

  const descriptions = document.createElement('div');
  descriptions.hidden = true;
  const buttons = new Map(); // `${kind}:${id}` → button
  function column(title, items, kind, cls) {
    const col = document.createElement('div');
    col.className = 'skills-col';
    const h = document.createElement('h3');
    h.textContent = title;
    const ul = document.createElement('ul');
    ul.className = 'skills-col-list';
    for (const it of items) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = cls;
      b.dataset.kind = kind;
      b.dataset.id = it.id;
      b.setAttribute('aria-pressed', 'false');
      b.textContent = it.label;
      const desc = document.createElement('span');
      desc.id = `skill-desc-${kind}-${it.id}`;
      desc.textContent = summary(kind, it.id);
      descriptions.appendChild(desc);
      b.setAttribute('aria-describedby', desc.id);
      li.appendChild(b);
      ul.appendChild(li);
      buttons.set(`${kind}:${it.id}`, b);
    }
    col.append(h, ul);
    return col;
  }
  grid.append(
    column(L.languages, data.skills.filter((s) => s.group === 'languages'), 'skill', 'smd'),
    column(L.entities, data.entities, 'entity', 'ic'),
    column(L.tools, data.skills.filter((s) => s.group === 'tools'), 'skill', 'smd'),
  );
  const bar = document.createElement('div');
  bar.className = 'skills-board-bar';
  const status = document.createElement('p');
  status.className = 'skills-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const hint = document.createElement('p');
  hint.className = 'skills-hint meta';
  hint.textContent = L.hint;
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'button button--small skills-clear';
  clear.textContent = L.clear;
  clear.hidden = true;
  bar.append(hint, status, clear);
  board.append(grid, bar, descriptions);

  // Edge routing on an 8px grid: horizontal → vertical lane → horizontal, with
  // 45° chamfers at the bends; each edge gets its own lane so none overlap.
  const edges = data.relations.map((r) => {
    const path = document.createElementNS(SVGNS, 'path');
    svg.appendChild(path);
    return { ...r, path, pads: [] };
  });
  const padGroup = document.createElementNS(SVGNS, 'g');
  svg.appendChild(padGroup);
  function layout() {
    if (!board.isConnected || board.offsetParent === null) return;
    const g = grid.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${g.width.toFixed(1)} ${g.height.toFixed(1)}`); // 1 unit = 1 CSS px
    const rect = (b) => { const r = b.getBoundingClientRect(); return { l: r.left - g.left, r: r.right - g.left, cy: r.top - g.top + r.height / 2 }; };
    const sides = { left: [], right: [] };
    for (const e of edges) {
      const s = buttons.get(`skill:${e.skillId}`);
      const t = buttons.get(`entity:${e.entityId}`);
      const sr = rect(s), tr = rect(t);
      const side = sr.r <= tr.l ? 'left' : 'right';
      sides[side].push({ e, sr, tr });
    }
    padGroup.replaceChildren();
    const c = GRID;
    for (const side of ['left', 'right']) {
      const list = sides[side].sort((a, b) => a.sr.cy - b.sr.cy || a.tr.cy - b.tr.cy);
      if (!list.length) continue;
      const x0 = side === 'left' ? list[0].sr.r : list[0].tr.r;
      const x1 = side === 'left' ? list[0].tr.l : list[0].sr.l;
      const lanes = list.length;
      const span = x1 - x0;
      list.forEach((item, i) => {
        const laneX = snap(x0 + (span * (i + 1)) / (lanes + 1));
        const [ax, ay] = side === 'left' ? [item.sr.r, item.sr.cy] : [item.sr.l, item.sr.cy];
        const [bx, by] = side === 'left' ? [item.tr.l, item.tr.cy] : [item.tr.r, item.tr.cy];
        const dir = Math.sign(bx - ax);
        const dy = by - ay;
        let d;
        if (Math.abs(dy) < 1) d = `M${ax} ${ay}H${bx}`;
        else {
          const sy = Math.sign(dy);
          d = `M${ax} ${ay}H${laneX - dir * c}L${laneX} ${ay + sy * c}V${by - sy * c}L${laneX + dir * c} ${by}H${bx}`;
        }
        item.e.path.setAttribute('d', d);
        for (const [x, y] of [[ax, ay], [bx, by]]) {
          const pad = document.createElementNS(SVGNS, 'circle');
          pad.setAttribute('cx', x.toFixed(1));
          pad.setAttribute('cy', y.toFixed(1));
          pad.setAttribute('r', '3');
          padGroup.appendChild(pad);
        }
      });
    }
    apply();
  }

  // ---- Selection state: { pinned, transient } -------------------------------
  let pinned = null;
  let transient = null;
  const key = (sel) => (sel ? `${sel.kind}:${sel.id}` : '');
  function apply() {
    const active = transient || pinned;
    const rel = active ? new Set(related(active.kind, active.id).map((x) => `${active.kind === 'skill' ? 'entity' : 'skill'}:${x}`)) : new Set();
    for (const [k, b] of buttons) {
      b.classList.toggle('is-related', rel.has(k) || k === key(active));
      b.setAttribute('aria-pressed', String(k === key(pinned)));
    }
    for (const e of edges) {
      const on = !!active && ((active.kind === 'skill' && e.skillId === active.id) || (active.kind === 'entity' && e.entityId === active.id));
      e.path.classList.toggle('is-active', on);
      e.path.classList.toggle('is-dim', !!active && !on);
      if (!on) e.path.style.strokeDashoffset = '';
    }
    clear.hidden = !pinned;
    hint.hidden = !!pinned;
    syncDash();
  }

  // Moving dash: phase = −(elapsed × 240 px/s) mod period; static under reduced
  // motion or Pause motion.
  let dashStart = 0;
  function syncDash() {
    const m = motionMode();
    const want = !!(transient || pinned) && !m.reduced && !m.paused;
    if (want) { dashStart = 0; addTask('skills-dash', dashTick); }
    else removeTask('skills-dash');
  }
  function dashTick(time) {
    if (!dashStart) dashStart = time;
    const phase = -(((time - dashStart) / 1000) * cfg.motion.dashSpeed) % DASH_PERIOD;
    for (const e of edges) if (e.path.classList.contains('is-active')) e.path.style.strokeDashoffset = phase.toFixed(2);
    return true;
  }
  cleanups.push(() => removeTask('skills-dash'));
  cleanups.push(onMotionChange(syncDash));

  const selFrom = (b) => ({ kind: b.dataset.kind, id: b.dataset.id });
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-kind]');
    if (!b) return;
    const sel = selFrom(b);
    if (key(sel) === key(pinned)) { pinned = null; status.textContent = ''; }
    else { pinned = sel; status.textContent = summary(sel.kind, sel.id); }
    apply();
  });
  const preview = (e) => { const b = e.target.closest('button[data-kind]'); if (b) { transient = selFrom(b); apply(); } };
  const unpreview = (e) => { const b = e.target.closest('button[data-kind]'); if (b && key(transient) === key(selFrom(b))) { transient = null; apply(); } };
  grid.addEventListener('pointerover', preview);
  grid.addEventListener('pointerout', unpreview);
  grid.addEventListener('focusin', preview);
  grid.addEventListener('focusout', unpreview);
  board.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (pinned || transient)) { pinned = null; transient = null; status.textContent = ''; apply(); }
  });
  clear.addEventListener('click', () => {
    // The Clear button disappears with the selection, so focus returns to the
    // control that was pinned rather than falling to the page.
    const back = buttons.get(key(pinned));
    pinned = null;
    status.textContent = '';
    apply();
    back?.focus();
  });

  // ---------------------------------------------------------------------------
  // Narrow screens: filter the static list from the same graph
  // ---------------------------------------------------------------------------
  const filter = document.createElement('div');
  filter.className = 'skills-filter';
  const label = document.createElement('label');
  label.htmlFor = 'skills-filter-select';
  label.textContent = L.filterLabel;
  const select = document.createElement('select');
  select.id = 'skills-filter-select';
  const opt = (value, text) => { const o = document.createElement('option'); o.value = value; o.textContent = text; return o; };
  select.appendChild(opt('', L.filterAll));
  const gEnt = document.createElement('optgroup'); gEnt.label = L.entities;
  data.entities.forEach((x) => gEnt.appendChild(opt(`entity:${x.id}`, x.label)));
  const gSk = document.createElement('optgroup'); gSk.label = `${L.languages} & ${L.tools}`;
  data.skills.forEach((x) => gSk.appendChild(opt(`skill:${x.id}`, x.label)));
  select.append(gEnt, gSk);
  const filterStatus = document.createElement('p');
  filterStatus.className = 'skills-filter-status meta';
  filterStatus.setAttribute('role', 'status');
  filterStatus.setAttribute('aria-live', 'polite');
  filter.append(label, select, filterStatus);
  const items = [...body.querySelectorAll('.skill')];
  select.addEventListener('change', () => {
    const [kind, id] = select.value.split(':');
    let shown = items;
    if (kind === 'skill') shown = items.filter((li) => li.dataset.skill === id);
    if (kind === 'entity') { const ids = new Set(related('entity', id)); shown = items.filter((li) => ids.has(li.dataset.skill)); }
    for (const li of items) li.classList.toggle('is-filtered-out', !shown.includes(li));
    filterStatus.textContent = kind ? summary(kind, id) : '';
  });

  body.before(filter);
  body.after(board);
  section.classList.add('has-skills-board');

  const mq = matchMedia(`(min-width: ${cfg.journey.compactBreakpoint}px)`);
  const onMq = () => { if (mq.matches) requestAnimationFrame(layout); };
  mq.addEventListener('change', onMq);
  const ro = new ResizeObserver(() => requestAnimationFrame(layout));
  ro.observe(grid);
  document.fonts?.ready.then(() => requestAnimationFrame(layout));
  requestAnimationFrame(layout);
  cleanups.push(() => { mq.removeEventListener('change', onMq); ro.disconnect(); });

  return {
    destroy() {
      cleanups.forEach((fn) => fn());
      board.remove();
      filter.remove();
      for (const li of items) li.classList.remove('is-filtered-out');
      section.classList.remove('has-skills-board');
    },
  };
}
