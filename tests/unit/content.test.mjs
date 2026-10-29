// Content contract: the supplied résumé record (tests/fixtures/appendix-a.txt),
// data/resume.json and the generated index.html must agree string for string.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateResume, validateConfig, scanExclusions, loadExclusions, resolveEvidence } from '../../scripts/validate-content.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const resume = JSON.parse(readFileSync(join(root, 'data/resume.json'), 'utf8'));
const config = JSON.parse(readFileSync(join(root, 'data/site-config.json'), 'utf8'));
const html = readFileSync(join(root, 'index.html'), 'utf8');
const clone = (o) => JSON.parse(JSON.stringify(o));
const norm = (s) => s.replace(/\s+/g, ' ').trim();

// --- Supplied record: rejoin the PDF's wrapped lines --------------------------
const fixtureLines = (() => {
  const out = [];
  for (const raw of readFileSync(join(root, 'tests/fixtures/appendix-a.txt'), 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const starts = /^(•|Name:|Links:|Education$|Experience$|Projects$|Leadership & Activities$|Skills$)/.test(line);
    const prevIsHeader = out.length && /^(Education|Experience|Projects|Leadership & Activities|Skills)$/.test(out[out.length - 1]);
    if (starts || !out.length || prevIsHeader) out.push(line);
    else out[out.length - 1] += ' ' + line;
  }
  return out.map(norm);
})();
const fixture = norm(fixtureLines.join(' \n '));
const bulletsOf = (section) => {
  const i = fixtureLines.indexOf(section);
  const end = fixtureLines.findIndex((l, j) => j > i && /^(Education|Experience|Projects|Leadership & Activities|Skills)$/.test(l));
  return fixtureLines.slice(i + 1, end === -1 ? undefined : end).map((l) => l.replace(/^• /, ''));
};

// --- Visible text of the generated page (scripts, styles and SVG removed) -----
const visibleText = norm(
  html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
);

function displayStrings(r) {
  const s = [r.person.name, r.links.email, r.links.linkedin.display, r.links.github.display];
  for (const e of r.education) s.push(e.institution, e.location, e.degree, e.minor, e.dateDisplay, `GPA ${e.gpa}`, ...e.honors);
  for (const e of r.experience) s.push(e.organization, e.role, e.location, e.dateDisplay, ...e.bullets.map((b) => b.text));
  for (const p of r.projects) s.push(p.title, p.role, p.dateDisplay, ...p.bullets.map((b) => b.text));
  for (const l of r.leadership) s.push(l.organization, l.role, l.dateDisplay, ...(l.description ? [l.description] : []));
  for (const k of [...r.skills.languages, ...r.skills.tools, ...r.certifications, ...r.interests]) s.push(k.label);
  return s;
}

test('data validates and the generated page has no drift', () => {
  assert.deepEqual(validateResume(resume), []);
  assert.deepEqual(validateConfig(config), []);
  execFileSync('node', [join(root, 'scripts/generate.mjs'), '--check'], { stdio: 'pipe' });
});

test('every data string comes from the supplied record (except approved revisions)', () => {
  for (const s of displayStrings(resume)) {
    const revised = [...resume.experience, ...resume.projects].flatMap((e) => e.bullets).find((b) => b.text === s && b.sourceText);
    const source = revised ? revised.sourceText : s;
    assert.ok(fixture.includes(norm(source)), `not in supplied record: ${source}`);
  }
});

test('role, project and activity header lines reconstruct exactly', () => {
  const exp = bulletsOf('Experience');
  for (const e of resume.experience) assert.ok(exp.includes(`${e.organization}, ${e.role}, ${e.location}, ${e.dateDisplay}`), e.id);
  const proj = bulletsOf('Projects');
  for (const p of resume.projects) assert.ok(proj.some((l) => l.startsWith(`${p.title}, ${p.role}, ${p.dateDisplay}`)), p.id);
  const lead = bulletsOf('Leadership & Activities');
  for (const l of resume.leadership) {
    const line = `${l.organization}: ${l.role}, ${l.dateDisplay}.` + (l.description ? ` ${l.description}` : '');
    assert.ok(lead.includes(line), line);
  }
  const edu = fixtureLines[fixtureLines.indexOf('Education') + 1];
  const e = resume.education[0];
  assert.equal(edu, `${e.institution}, ${e.location}. ${e.degree}, ${e.minor}. ${e.dateDisplay}. GPA ${e.gpa} · ${e.honors.join(' · ')}`);
});

test('every supplied bullet is present in the data', () => {
  const dataBullets = [...resume.experience, ...resume.projects].flatMap((e) => e.bullets.map((b) => b.sourceText ?? b.text));
  const supplied = [...bulletsOf('Experience'), ...bulletsOf('Projects')].filter((l) => /\.$/.test(l) && !/Live:|Code:/.test(l));
  assert.equal(supplied.length, 15);
  for (const b of supplied) assert.ok(dataBullets.includes(b), `missing bullet: ${b}`);
});

test('skills, certifications and interests match the supplied lists in order', () => {
  const skills = bulletsOf('Skills');
  const list = (prefix, sep) => skills.find((l) => l.startsWith(prefix)).slice(prefix.length).split(sep);
  assert.deepEqual(resume.skills.languages.map((s) => s.label), list('Languages: ', ', '));
  assert.deepEqual(resume.skills.tools.map((s) => s.label), list('Tools: ', ', '));
  assert.deepEqual(resume.certifications.map((s) => s.label), list('Certifications: ', '; '));
  assert.deepEqual(resume.interests.map((s) => s.label), list('Interests: ', /, (?![^(]*\))/));
});

test('counts: 3 roles, 3 projects, 6 activities, 15 skills, 3 certifications, 4 interests', () => {
  assert.equal(resume.experience.length, 3);
  assert.equal(resume.projects.length, 3);
  assert.equal(resume.leadership.length, 6);
  assert.equal(resume.skills.languages.length + resume.skills.tools.length, 15);
  assert.equal(resume.certifications.length, 3);
  assert.equal(resume.interests.length, 4);
  assert.equal((html.match(/class="role" id="role-/g) || []).length, 3);
  assert.equal((html.match(/<article class="project /g) || []).length, 3);
  assert.equal((html.match(/class="activity" id=/g) || []).length, 6);
});

test('every data string appears verbatim in the generated page', () => {
  for (const s of displayStrings(resume)) assert.ok(visibleText.includes(norm(s)), `missing from page: ${s}`);
  assert.ok(visibleText.includes(resume.person.heroSubtitle));
  for (const s of resume.snapshot) assert.ok(visibleText.includes(`${s.value} ${s.label}`), s.id);
  assert.ok(visibleText.includes('Let’s build something.'));
});

test('hero: one h1 with the name; the three projects, major, university and GPA are in the hero', () => {
  assert.equal((html.match(/<h1[\s>]/g) || []).length, 1);
  const hero = html.slice(html.indexOf('<section class="hero"'), html.indexOf('<section class="journey"'));
  assert.match(hero, /<h1[^>]*>.*Deveshwar.*Vankeswaram.*<\/h1>/s);
  for (const p of resume.projects) assert.ok(hero.includes(`href="#project-${p.id}">${p.title.replace(/&/g, '&amp;')}</a>`), p.id);
  assert.ok(hero.includes('B.S. Computer Engineering, Minor in Computer Science'));
  assert.ok(hero.includes('Texas A&amp;M University'));
  assert.ok(hero.includes('4.0/4.0'));
  assert.ok(hero.includes('href="#projects"'), 'See my work skips the journey');
});

test('heading levels never skip and match the section structure', () => {
  const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => +m[1]);
  assert.equal(levels[0], 1);
  for (let i = 1; i < levels.length; i++) assert.ok(levels[i] <= levels[i - 1] + 1, `h${levels[i - 1]} → h${levels[i]}`);
});

test('ids are unique and every in-page link has a target', () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'duplicate id');
  for (const [, href] of html.matchAll(/\shref="([^"]+)"/g)) {
    if (href.startsWith('#')) {
      assert.notEqual(href, '#', 'placeholder link');
      if (!href.startsWith('#glyph-') && !href.startsWith('#art-')) assert.ok(ids.includes(href.slice(1)), `missing anchor ${href}`);
    } else if (/^(https:|mailto:)/.test(href)) {
      new URL(href);
    } else {
      assert.ok(existsSync(join(root, href)), `missing local file ${href}`);
    }
  }
  assert.doesNotMatch(html, /href="http:/);
});

test('missing destinations render no buttons; supplied ones do', () => {
  const article = (id) => html.slice(html.indexOf(`id="project-${id}"`), html.indexOf('</article>', html.indexOf(`id="project-${id}"`)));
  assert.match(article('tidecast'), /href="https:\/\/tidecast-kdl9\.onrender\.com\/backbone\/"/);
  assert.match(article('tidecast'), /href="https:\/\/github\.com\/Deveshwar123\/HowdyHackathon"/);
  assert.match(article('vedam'), /href="https:\/\/wearvedam\.com"/);
  assert.doesNotMatch(article('vedam'), /Source code/);
  assert.match(article('nfc-card'), /href="https:\/\/github\.com\/Deveshwar123\/nfc-pcb-business-card"/);
  assert.doesNotMatch(article('nfc-card'), /Live site/);
  assert.equal(resume.assets.resumePdf.approved, false);
  assert.doesNotMatch(html, /Deveshwar_Vankeswaram_Resume\.pdf/, 'no résumé link until an approved PDF exists');
});

test('no excluded content in the page, data or metadata', () => {
  assert.ok(loadExclusions().length >= 5);
  assert.deepEqual(scanExclusions(html), []);
  assert.deepEqual(scanExclusions(readFileSync(join(root, 'data/resume.json'), 'utf8')), []);
  assert.doesNotMatch(html, /Electrical Engineering|Data Engineering/);
});

test('JSON-LD is valid and uses only supplied facts', () => {
  const ld = JSON.parse(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html)[1]);
  assert.equal(ld['@type'], 'Person');
  assert.equal(ld.name, resume.person.name);
  assert.deepEqual(ld.sameAs, [resume.links.linkedin.url, resume.links.github.url]);
  assert.equal(ld.affiliation.name, 'Texas A&M University');
  assert.ok(!('url' in ld) || config.meta.deployApproved, 'no deployed URL claimed before approval');
  assert.ok(!html.includes('rel="canonical"') || config.meta.deployApproved);
});

test('every skill edge cites a supplied line that names the skill', () => {
  for (const rel of resume.skillRelations) {
    const ev = resolveEvidence(resume, rel.evidenceRef);
    assert.ok(ev, rel.evidenceRef);
  }
  // Standalone skills stay listed without invented edges.
  const linked = new Set(resume.skillRelations.map((r) => r.skillId));
  for (const id of ['git-github', 'threejs', 'bloomberg', 'cad']) assert.ok(!linked.has(id), id);
});

test('the validator rejects bad content', () => {
  const r1 = clone(resume); r1.projects[0].codeUrl = 'http://example.com';
  assert.ok(validateResume(r1).some((e) => /https/.test(e)));
  const r2 = clone(resume); r2.skillRelations.push({ skillId: 'cad', entityId: 'tidecast', evidenceRef: 'projects.tidecast.b1', sourceType: 'supplied' });
  assert.ok(validateResume(r2).some((e) => /does not mention/.test(e)));
  const r3 = clone(resume); r3.experience[1].bullets[1].revision = undefined;
  assert.ok(validateResume(r3).some((e) => /owner approval/.test(e)));
  const r4 = clone(resume); r4.person.major = 'Data Engineering';
  assert.ok(validateResume(r4).length >= 2);
  const r5 = clone(resume); r5.leadership[0].description = 'Call 979-555-0142 any time.';
  assert.ok(validateResume(r5).some((e) => /phone-number/.test(e)));
  const r6 = clone(resume); r6.projects[1].liveUrl = 'javascript:alert(1)';
  assert.ok(validateResume(r6).some((e) => /https/.test(e)));
});
