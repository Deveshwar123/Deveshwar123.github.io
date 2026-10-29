// "More on GitHub": every card restates its own repo's README at the pinned
// commit (tests/fixtures/github/<id>/, saved by scripts/fetch-github-projects.mjs),
// excerpts are shown verbatim with their real line numbers, and every link is safe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { validateGithub, scanExclusions } from '../../scripts/validate-content.mjs';
import { highlightText, repoWindow, excerptSource, shotWidths } from '../../scripts/lib/repo-windows.mjs';

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const exists = (rel) => existsSync(new URL(`../../${rel}`, import.meta.url));
const github = JSON.parse(read('data/github-projects.json'));
const resume = JSON.parse(read('data/resume.json'));
const html = read('index.html');
const clone = (o) => JSON.parse(JSON.stringify(o));
const text = (s) => s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
// Compare prose without Markdown emphasis or line wrapping.
const plain = (s) => s.replace(/[*`]/g, '').replace(/\s+/g, ' ').trim();
const readme = (id) => read(`tests/fixtures/github/${id}/README.md`);
const words = (label) => label.replace(/\(.*?\)/g, '').split(/[\s/]+/).filter((w) => w.length > 1);

test('the data validates and the page shows one card per repo, after the three featured projects', () => {
  assert.deepEqual(validateGithub(github), []);
  const block = html.slice(html.indexOf('id="more-on-github"'), html.indexOf('</section>', html.indexOf('id="more-on-github"')));
  assert.ok(html.indexOf('id="more-on-github"') > html.indexOf('id="project-nfc-card"'));
  assert.equal((block.match(/<article class="repo /g) || []).length, github.items.length);
  for (const p of github.items) {
    assert.ok(block.includes(`id="repo-${p.id}-title">${p.title}</h4>`), p.id);
    assert.ok(block.includes(repoWindow(p)), `${p.id}: index.html carries the generated window`);
  }
});

test('every summary and point cites phrases found verbatim in the repo README', () => {
  for (const p of github.items) {
    const src = plain(readme(p.id));
    for (const c of [p.summary, ...p.points]) {
      for (const e of c.evidence) assert.ok(src.includes(plain(e)), `${p.id}: README lacks "${e}"`);
      assert.ok(html.includes(c.text.replace(/&/g, '&amp;')), `${p.id}: page lacks "${c.text}"`);
    }
  }
});

test('every stack chip is named in the README or in GitHub\'s language stats', () => {
  for (const p of github.items) {
    const src = readme(p.id).toLowerCase();
    const langs = Object.keys(JSON.parse(read(`tests/fixtures/github/${p.id}/languages.json`)));
    for (const chip of p.stack) {
      assert.ok(langs.includes(chip) || words(chip).every((w) => src.includes(w.toLowerCase())), `${p.id}: "${chip}" has no source`);
    }
  }
});

test('README excerpts match the pinned README line for line, and highlighting changes nothing', () => {
  for (const p of github.items.filter((x) => x.picture.kind === 'excerpt')) {
    const lines = readme(p.id).split('\n');
    p.picture.lines.forEach((l, i) => {
      assert.equal(lines[p.picture.firstLine - 1 + i], l, `${p.id} line ${p.picture.firstLine + i}`);
      assert.equal(text(highlightText(l)), l);
    });
    const shown = [...repoWindow(p).matchAll(/<span class="code-line"><span class="code-ln">(\d+)<\/span>(.*?)<\/span>(?=<span class="code-line">|<\/code>)/g)];
    assert.equal(shown.length, p.picture.lines.length);
    shown.forEach((m, i) => {
      assert.equal(+m[1], p.picture.firstLine + i);
      assert.equal(text(m[2]), p.picture.lines[i]);
    });
    assert.match(excerptSource(p), /^https:\/\/github\.com\/Deveshwar123\/[\w.-]+\/blob\/[0-9a-f]{40}\/README\.md#L\d+-L\d+$/);
  }
});

test('screenshots exist at both sizes, and the window bar shows a real address', () => {
  for (const p of github.items.filter((x) => x.picture.kind === 'shot')) {
    for (const w of shotWidths(p.picture)) assert.ok(exists(`assets/projects/${p.id}-${w}.webp`), `${p.id}-${w}.webp`);
    const bar = p.picture.bar;
    assert.ok(readme(p.id).includes(bar) || (p.liveUrl ?? '').includes(bar), `${p.id}: bar "${bar}" has no source`);
  }
});

test('links: my own public repos over https, live sites only where they exist, nothing private', () => {
  for (const p of github.items) {
    const name = new URL(p.repo).pathname.split('/')[2];
    assert.ok(readme(p.id).length > 0, `${p.id}: a README fixture was saved from ${name}`);
    const card = html.slice(html.indexOf(`id="repo-${p.id}"`), html.indexOf('</article>', html.indexOf(`id="repo-${p.id}"`)));
    assert.ok(card.includes(`href="${p.repo}"`), `${p.id}: code link`);
    if (p.liveUrl) assert.ok(card.includes(`href="${p.liveUrl}"`), `${p.id}: live link`);
    else assert.doesNotMatch(card, /Live site/);
    assert.doesNotMatch(card, /href="(#"|http:)/);
  }
  // The featured projects are not repeated, and the "3 shipped projects" count stays as it is.
  const featured = new Set([...resume.projects.map((p) => p.codeUrl), ...resume.projects.map((p) => p.liveUrl)]);
  for (const p of github.items) assert.ok(!featured.has(p.repo), `${p.id} is already featured`);
  assert.deepEqual(scanExclusions(JSON.stringify(github)), []);
});

test('the validator rejects bad GitHub cards', () => {
  const g1 = clone(github); g1.items[0].repo = 'http://github.com/Deveshwar123/strategy-terminal';
  assert.ok(validateGithub(g1).some((e) => /Deveshwar123 repository/.test(e)));
  const g2 = clone(github); g2.items[0].repo = 'https://github.com/someone-else/strategy-terminal';
  assert.ok(validateGithub(g2).some((e) => /Deveshwar123 repository/.test(e)));
  const g3 = clone(github); g3.items[1].commit = 'main';
  assert.ok(validateGithub(g3).some((e) => /commit SHA/.test(e)));
  const g4 = clone(github); g4.items[3].liveUrl = 'javascript:alert(1)';
  assert.ok(validateGithub(g4).some((e) => /liveUrl/.test(e)));
  const g5 = clone(github); g5.items[2].points[0].evidence = [];
  assert.ok(validateGithub(g5).some((e) => /evidence/.test(e)));
  const g6 = clone(github); g6.items[3].summary.text = 'Book a lesson: 979-555-0142.';
  assert.ok(validateGithub(g6).some((e) => /phone-number/.test(e)));
  const g7 = clone(github); g7.items[0].disciplines = ['Astrology'];
  assert.ok(validateGithub(g7).some((e) => /disciplines/.test(e)));
});
