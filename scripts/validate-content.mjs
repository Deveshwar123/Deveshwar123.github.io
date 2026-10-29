// Validates data/resume.json and data/site-config.json before any markup is
// generated. Exits non-zero with a list of problems when run directly.
// Usage: node scripts/validate-content.mjs
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export const ALLOWED_SCHEMES = ['https:', 'mailto:'];

export function isAllowedUrl(u) {
  try {
    return ALLOWED_SCHEMES.includes(new URL(u).protocol);
  } catch {
    return false;
  }
}

// Exclusion patterns. Generic ones are committed in qa/exclusions.json; private
// phrases live in qa/exclusions.local.json, which is gitignored so the public
// repository never names what must stay private.
export function loadExclusions() {
  const files = ['qa/exclusions.json', 'qa/exclusions.local.json'];
  const patterns = [];
  for (const f of files) {
    const p = join(root, f);
    if (!existsSync(p)) continue;
    for (const { id, pattern, flags } of JSON.parse(readFileSync(p, 'utf8')).patterns) {
      patterns.push({ id, re: new RegExp(pattern, flags ?? 'i'), source: f });
    }
  }
  return patterns;
}

export function scanExclusions(text, patterns = loadExclusions()) {
  const hits = [];
  for (const { id, re } of patterns) {
    const m = re.exec(text);
    if (m) hits.push({ id, match: m[0], at: m.index });
  }
  return hits;
}

// Resolve "experience.radicubs.b1", "projects.tidecast.b2" or
// "leadership.goldman-steam.description" to the supplied text.
export function resolveEvidence(resume, ref) {
  const [section, id, field] = ref.split('.');
  const list = resume[section];
  if (!Array.isArray(list)) return null;
  const entry = list.find((e) => e.id === id);
  if (!entry) return null;
  if (field === 'description') return entry.description ?? null;
  const bullet = entry.bullets?.find((b) => b.id === field);
  return bullet?.text ?? null;
}

const words = (label) => label.replace(/\(.*?\)/g, '').split(/[\/\s]+/).filter((w) => w.length > 1);

export function validateResume(r) {
  const errors = [];
  const err = (m) => errors.push(m);
  const str = (v, path) => { if (typeof v !== 'string' || !v.trim()) err(`${path} must be a non-empty string`); };

  if (r.schemaVersion !== 1) err('schemaVersion must be 1');
  str(r.person?.name, 'person.name');
  str(r.person?.heroSubtitle, 'person.heroSubtitle');
  if (r.person?.major !== 'Computer Engineering') err('person.major must be "Computer Engineering"');

  str(r.links?.email, 'links.email');
  if (!/^[^@\s]+@[^@\s]+\.[a-z]+$/i.test(r.links?.email ?? '')) err('links.email is not an email address');
  for (const k of ['linkedin', 'github']) {
    if (!isAllowedUrl(r.links?.[k]?.url)) err(`links.${k}.url must be https`);
    str(r.links?.[k]?.display, `links.${k}.display`);
  }

  const ids = new Set();
  const uniq = (id, path) => {
    str(id, `${path}.id`);
    if (ids.has(id)) err(`duplicate id "${id}" at ${path}`);
    ids.add(id);
  };

  for (const [i, e] of (r.education ?? []).entries()) {
    uniq(e.id, `education[${i}]`);
    for (const f of ['institution', 'location', 'degree', 'dateDisplay', 'gpa']) str(e[f], `education[${i}].${f}`);
  }
  if (!r.education?.length) err('education must not be empty');

  const checkBullets = (list, path) => {
    if (!Array.isArray(list) || !list.length) return err(`${path} must have bullets`);
    const bids = new Set();
    for (const [j, b] of list.entries()) {
      str(b.id, `${path}[${j}].id`);
      if (bids.has(b.id)) err(`duplicate bullet id ${b.id} in ${path}`);
      bids.add(b.id);
      str(b.text, `${path}[${j}].text`);
      if (b.sourceText !== undefined && b.sourceText !== b.text && b.revision?.approvedBy !== 'owner') {
        err(`${path}[${j}] differs from its supplied source text without owner approval`);
      }
    }
  };

  for (const [i, e] of (r.experience ?? []).entries()) {
    uniq(e.id, `experience[${i}]`);
    for (const f of ['organization', 'role', 'location', 'dateDisplay']) str(e[f], `experience[${i}].${f}`);
    checkBullets(e.bullets, `experience[${i}].bullets`);
  }
  for (const [i, p] of (r.projects ?? []).entries()) {
    uniq(p.id, `projects[${i}]`);
    for (const f of ['title', 'role', 'dateDisplay']) str(p[f], `projects[${i}].${f}`);
    for (const f of ['liveUrl', 'codeUrl']) {
      if (p[f] !== null && !isAllowedUrl(p[f])) err(`projects[${i}].${f} must be null or an https URL`);
    }
    checkBullets(p.bullets, `projects[${i}].bullets`);
  }
  for (const [i, l] of (r.leadership ?? []).entries()) {
    uniq(l.id, `leadership[${i}]`);
    for (const f of ['organization', 'role', 'dateDisplay']) str(l[f], `leadership[${i}].${f}`);
    if (l.description !== null) str(l.description, `leadership[${i}].description`);
  }

  const skills = [...(r.skills?.languages ?? []), ...(r.skills?.tools ?? [])];
  const skillIds = new Set();
  for (const s of skills) {
    str(s.label, `skill ${s.id}`);
    if (skillIds.has(s.id)) err(`duplicate skill id ${s.id}`);
    skillIds.add(s.id);
  }
  for (const c of r.certifications ?? []) str(c.label, `certification ${c.id}`);
  for (const c of r.interests ?? []) str(c.label, `interest ${c.id}`);
  for (const s of r.snapshot ?? []) { str(s.value, `snapshot ${s.id}.value`); str(s.label, `snapshot ${s.id}.label`); }

  const entityIds = new Set([...(r.experience ?? []), ...(r.projects ?? []), ...(r.leadership ?? [])].map((e) => e.id));
  for (const [i, rel] of (r.skillRelations ?? []).entries()) {
    if (!skillIds.has(rel.skillId)) err(`skillRelations[${i}] unknown skill ${rel.skillId}`);
    if (!entityIds.has(rel.entityId)) err(`skillRelations[${i}] unknown entity ${rel.entityId}`);
    const evidence = resolveEvidence(r, rel.evidenceRef);
    if (!evidence) { err(`skillRelations[${i}] evidenceRef ${rel.evidenceRef} does not resolve`); continue; }
    if (!rel.evidenceRef.split('.')[1] || rel.evidenceRef.split('.')[1] !== rel.entityId) err(`skillRelations[${i}] cites evidence from a different entity`);
    const label = skills.find((s) => s.id === rel.skillId)?.label ?? '';
    if (!words(label).some((w) => evidence.toLowerCase().includes(w.toLowerCase()))) {
      err(`skillRelations[${i}] evidence does not mention "${label}"`);
    }
  }
  for (const [pid, chips] of Object.entries(r.projectChips ?? {})) {
    for (const c of chips) {
      const evidence = resolveEvidence(r, c.evidenceRef);
      if (!evidence || !c.evidenceRef.startsWith(`projects.${pid}.`)) err(`projectChips.${pid} "${c.label}" lacks project evidence`);
      else if (!words(c.label).some((w) => evidence.includes(w))) err(`projectChips.${pid} "${c.label}" is not named in its evidence`);
    }
  }

  if (r.assets?.resumePdf?.path !== 'assets/Deveshwar_Vankeswaram_Resume.pdf') err('assets.resumePdf.path must be the reserved path');
  if (r.assets?.resumePdf?.approved && !existsSync(join(root, r.assets.resumePdf.path))) err('résumé marked approved but the PDF is missing');

  const hits = scanExclusions(JSON.stringify(r));
  for (const h of hits) err(`exclusion "${h.id}" found in resume.json: ${h.match}`);
  return errors;
}

export function validateConfig(c) {
  const errors = [];
  const err = (m) => errors.push(m);
  if (c.schemaVersion !== 1) err('site-config schemaVersion must be 1');
  if (c.meta?.title !== 'Deveshwar Vankeswaram — Computer Engineering, Texas A&M') err('meta.title must be the exact specified title');
  if (!isAllowedUrl(c.meta?.deployUrl)) err('meta.deployUrl must be https');
  for (const n of c.labels?.nav ?? []) if (!/^#[a-z][\w-]*$/.test(n.href)) err(`nav href ${n.href} must be an in-page anchor`);
  for (const n of c.labels?.chapters ?? []) if (!/^#[a-z][\w-]*$/.test(n.href)) err(`chapter href ${n.href} must be an in-page anchor`);
  const r = c.journey?.ranges ?? {};
  for (const [k, v] of Object.entries(r)) {
    if (!Array.isArray(v) || v.some((x, i) => typeof x !== 'number' || x < 0 || x > c.journey.end || (i && x < v[i - 1]))) err(`journey.ranges.${k} must be ascending numbers within 0–end`);
  }
  for (const b of c.illustrations?.beats ?? []) if (!(b.p >= 0 && b.p <= c.journey.end)) err(`beat ${b.id} p out of range`);
  const hits = scanExclusions(JSON.stringify(c));
  for (const h of hits) err(`exclusion "${h.id}" found in site-config.json: ${h.match}`);
  return errors;
}

export function loadData() {
  return {
    resume: JSON.parse(readFileSync(join(root, 'data/resume.json'), 'utf8')),
    config: JSON.parse(readFileSync(join(root, 'data/site-config.json'), 'utf8')),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { resume, config } = loadData();
  const errors = [...validateResume(resume), ...validateConfig(config)];
  const n = loadExclusions().length;
  if (errors.length) {
    console.error(`✗ ${errors.length} content problem(s):\n  - ` + errors.join('\n  - '));
    process.exit(1);
  }
  console.log(`✓ content valid (${n} exclusion patterns checked${existsSync(join(root, 'qa/exclusions.local.json')) ? ', including private list' : '; private list absent'})`);
}
