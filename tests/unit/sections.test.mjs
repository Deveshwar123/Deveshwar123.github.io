// Section refinements after the hero redesign: field tags and role chips tie each
// card to the hero's disciplines, and the closing ornament is the real card's copper.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateResume, validateConfig, DISCIPLINES, resolveEvidence } from '../../scripts/validate-content.mjs';
import { REAL_BOARD } from '../../js/board-data.js';
import { escapeHtml } from '../../js/render.js';

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const resume = JSON.parse(read('data/resume.json'));
const config = JSON.parse(read('data/site-config.json'));
const html = read('index.html');
const clone = (o) => JSON.parse(JSON.stringify(o));
const card = (id) => html.slice(html.indexOf(`id="${id}"`), html.indexOf('</article>', html.indexOf(`id="${id}"`)));

test('every role and featured project carries a field tag from the hero\'s disciplines', () => {
  const ids = [...resume.experience, ...resume.projects].map((e) => e.id);
  assert.deepEqual(Object.keys(config.fields.items).sort(), [...ids].sort());
  for (const [id, fields] of Object.entries(config.fields.items)) for (const f of fields) assert.ok(DISCIPLINES.includes(f), `${id}: ${f}`);
  for (const e of resume.experience) {
    const c = card(`role-${e.id}`);
    for (const f of config.fields.items[e.id]) assert.ok(c.includes(`<li>${f}</li>`), `${e.id}: ${f}`);
  }
  for (const p of resume.projects) {
    const c = card(`project-${p.id}`);
    for (const f of config.fields.items[p.id]) assert.ok(c.includes(`<li>${f}</li>`), `${p.id}: ${f}`);
  }
});

test('headings come before their field tags, so screen readers reach the heading first', () => {
  for (const m of html.matchAll(/<div class="titled">([\s\S]*?)<\/div>/g)) {
    assert.match(m[1], /^<h[34][^>]*>[\s\S]*?<\/h[34]><ul class="field-tags" aria-label="Fields">/);
  }
  assert.equal((html.match(/<div class="titled">/g) || []).length, resume.experience.length + resume.projects.length + JSON.parse(read('data/github-projects.json')).items.length);
});

test('role chips cite a bullet of the same role that names them, and show on that card', () => {
  for (const [id, chips] of Object.entries(resume.experienceChips)) {
    const c = card(`role-${id}`);
    for (const chip of chips) {
      assert.ok(chip.evidenceRef.startsWith(`experience.${id}.`));
      assert.ok(resolveEvidence(resume, chip.evidenceRef).includes(chip.label.split('/')[0]), chip.label);
      assert.ok(c.includes(`<li>${chip.label}</li>`), `${id}: ${chip.label}`);
    }
  }
  const r1 = clone(resume); r1.experienceChips.radicubs.push({ label: 'Rust', evidenceRef: 'experience.radicubs.b1' });
  assert.ok(validateResume(r1).some((e) => /not named in its evidence/.test(e)));
  const r2 = clone(resume); r2.experienceChips.vantashala.push({ label: 'Pine Script', evidenceRef: 'experience.quant-research.b1' });
  assert.ok(validateResume(r2).some((e) => /lacks experience evidence/.test(e)));
  const c1 = clone(config); c1.fields.items.vedam = ['Fashion'];
  assert.ok(validateConfig(c1).some((e) => /fields\.items\.vedam/.test(e)));
});

test('the closing ornament is the real card\'s copper with its LED, not the jali', () => {
  const art = html.slice(html.indexOf('<div class="contact-art"'), html.indexOf('</svg>', html.indexOf('<div class="contact-art"')));
  assert.match(art, /class="art closing-art"/);
  assert.equal((art.match(/<path data-pair="arch-\d+"/g) || []).length, REAL_BOARD.antenna.length, 'one path per antenna turn');
  const [lx, ly] = REAL_BOARD.parts.LED1.at;
  assert.ok(art.includes(`class="art-led-core" cx="${lx}" cy="${ly}"`), 'the LED sits at its real position');
  assert.doesNotMatch(art, /art-arches|art-waves|art-ornament/);
  assert.doesNotMatch(html, /closing-jali|Line art and 3D are original illustrations/);
  assert.doesNotMatch(html, /#glyph-arch"/);
});

test('the TideCast screenshot hides the leaderboard name, now and on recapture', () => {
  const capture = read('scripts/capture-projects.mjs');
  assert.match(capture, /teaser-sub/);
  assert.match(capture, /blur\(5px\)/);
  assert.match(capture, /await s\.redact\?\.\(page\)/);
});

test('each of the card\'s four layers is one skill, backed by résumé lines, in story order', () => {
  const layers = config.illustrations.layers;
  assert.deepEqual(layers.map((l) => l.layer), ['Silkscreen', 'Copper', 'FR-4 core', 'Back'], 'top to bottom, as projection.js stacks them');
  for (const l of layers) for (const ref of l.evidence) assert.ok(resolveEvidence(resume, ref), `${l.layer}: ${ref}`);
  const list = html.slice(html.indexOf('<ul class="layer-list">'), html.indexOf('</ul>', html.indexOf('<ul class="layer-list">')));
  for (const l of layers) assert.ok(list.includes(`<strong class="layer-skill">${escapeHtml(l.skill)}</strong>`) && list.includes(escapeHtml(l.text)), l.layer);
  const c1 = clone(config); c1.illustrations.layers[3].evidence = ['experience.quant-research.b9'];
  assert.ok(validateConfig(c1, resume).some((e) => /does not resolve/.test(e)));
  const c2 = clone(config); c2.illustrations.layers.pop();
  assert.ok(validateConfig(c2, resume).some((e) => /four layers/.test(e)));
});

test('the story ends whole: the layers rejoin and the last beat shows the lit card', () => {
  const beats = config.illustrations.beats;
  assert.deepEqual(beats.map((b) => b.id), ['story-board', 'story-back', 'story-layers', 'story-whole']);
  assert.equal(beats.length, config.journey.captionWindows.length);
  const whole = html.slice(html.indexOf('id="story-whole"'), html.indexOf('</li>', html.indexOf('id="story-whole"')));
  assert.match(whole, /src="assets\/board\/card-lit\.webp"/);
  assert.doesNotMatch(html, /yrs backtested/, 'the snapshot no longer counts backtest years');
});
