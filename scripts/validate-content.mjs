// Validates data/resume.json, data/site-config.json and data/github-projects.json
// before any markup is generated. Exits non-zero with a list of problems when run directly.
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

// The hero's three disciplines plus Web: the only field tags a card may carry.
export const DISCIPLINES = ['Computer Engineering', 'Computer Science', 'Finance', 'Web'];

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
  // Technology chips on projects and roles: each cites a line of that same entry that names it.
  for (const [key, section] of [['projectChips', 'projects'], ['experienceChips', 'experience']]) {
    for (const [id, chips] of Object.entries(r[key] ?? {})) {
      for (const c of chips) {
        const evidence = resolveEvidence(r, c.evidenceRef);
        if (!evidence || !c.evidenceRef.startsWith(`${section}.${id}.`)) err(`${key}.${id} "${c.label}" lacks ${section} evidence`);
        else if (!words(c.label).some((w) => evidence.includes(w))) err(`${key}.${id} "${c.label}" is not named in its evidence`);
      }
    }
  }

  if (r.assets?.resumePdf?.path !== 'assets/Deveshwar_Vankeswaram_Resume.pdf') err('assets.resumePdf.path must be the reserved path');
  if (r.assets?.resumePdf?.approved && !existsSync(join(root, r.assets.resumePdf.path))) err('résumé marked approved but the PDF is missing');

  const hits = scanExclusions(JSON.stringify(r));
  for (const h of hits) err(`exclusion "${h.id}" found in resume.json: ${h.match}`);
  return errors;
}

export function validateConfig(c, resume) {
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
  if ((c.illustrations?.beats ?? []).length !== (c.journey?.captionWindows ?? []).length) err('each story beat needs exactly one caption window');
  if (!(r.join?.[0] >= r.explode?.[1])) err('journey.ranges.join must start after the layers are apart');
  // The four layers of the card, one skill each: every claim cites a résumé line.
  const layers = c.illustrations?.layers ?? [];
  if (layers.length !== 4) err('illustrations.layers must name the card\'s four layers');
  for (const l of layers) {
    for (const k of ['layer', 'skill', 'text']) if (typeof l[k] !== 'string' || !l[k].trim()) err(`illustrations.layers: ${k} is required`);
    if (!Array.isArray(l.evidence) || !l.evidence.length) err(`layer ${l.layer} cites no evidence`);
    if (resume) for (const ref of l.evidence ?? []) if (!resolveEvidence(resume, ref)) err(`layer ${l.layer}: evidence ${ref} does not resolve`);
  }
  for (const [id, list] of Object.entries(c.fields?.items ?? {})) {
    if (!Array.isArray(list) || !list.length || list.some((x) => !DISCIPLINES.includes(x))) err(`fields.items.${id} must come from ${DISCIPLINES.join(', ')}`);
  }
  const hits = scanExclusions(JSON.stringify(c));
  for (const h of hits) err(`exclusion "${h.id}" found in site-config.json: ${h.match}`);
  return errors;
}

// "More on GitHub": public repos of my own account, each pinned to a commit.

export function validateGithub(g) {
  const errors = [];
  const err = (m) => errors.push(m);
  const str = (v, path) => { if (typeof v !== 'string' || !v.trim()) err(`${path} must be a non-empty string`); };
  const cited = (o, path) => {
    str(o?.text, `${path}.text`);
    if (!Array.isArray(o?.evidence) || !o.evidence.length) err(`${path} must cite README evidence`);
    for (const [k, e] of (o?.evidence ?? []).entries()) str(e, `${path}.evidence[${k}]`);
  };
  if (g.schemaVersion !== 1) err('github-projects schemaVersion must be 1');
  if (!Array.isArray(g.items) || !g.items.length) err('github-projects items must not be empty');
  const ids = new Set();
  for (const [i, p] of (g.items ?? []).entries()) {
    const at = `githubProjects[${i}]`;
    if (!/^[a-z][a-z0-9-]*$/.test(p.id ?? '')) err(`${at}.id must be a lowercase slug`);
    if (ids.has(p.id)) err(`duplicate github project id ${p.id}`);
    ids.add(p.id);
    str(p.title, `${at}.title`);
    if (!/^https:\/\/github\.com\/Deveshwar123\/[\w.-]+$/.test(p.repo ?? '')) err(`${at}.repo must be an https URL of a Deveshwar123 repository`);
    if (!/^[0-9a-f]{40}$/.test(p.commit ?? '')) err(`${at}.commit must be a full commit SHA`);
    if (p.liveUrl !== null && !isAllowedUrl(p.liveUrl)) err(`${at}.liveUrl must be null or an https URL`);
    if (!Array.isArray(p.disciplines) || !p.disciplines.length || p.disciplines.some((x) => !DISCIPLINES.includes(x))) err(`${at}.disciplines must come from ${DISCIPLINES.join(', ')}`);
    cited(p.summary, `${at}.summary`);
    if (!Array.isArray(p.points) || !p.points.length || p.points.length > 3) err(`${at} must have one to three points`);
    for (const [j, pt] of (p.points ?? []).entries()) cited(pt, `${at}.points[${j}]`);
    if (!Array.isArray(p.stack) || !p.stack.length) err(`${at}.stack must not be empty`);
    for (const [j, s] of (p.stack ?? []).entries()) str(s, `${at}.stack[${j}]`);
    const pic = p.picture ?? {};
    if (pic.kind === 'shot') {
      if (!(Number.isInteger(pic.width) && Number.isInteger(pic.height) && pic.width > 0 && pic.height > 0)) err(`${at}.picture needs its pixel size`);
      str(pic.path, `${at}.picture.path`);
      str(pic.bar, `${at}.picture.bar`);
    } else if (pic.kind === 'excerpt') {
      str(pic.path, `${at}.picture.path`);
      if (!(Number.isInteger(pic.firstLine) && pic.firstLine > 0)) err(`${at}.picture.firstLine must be a line number`);
      if (!Array.isArray(pic.lines) || !pic.lines.length) err(`${at}.picture.lines must not be empty`);
    } else err(`${at}.picture.kind must be "shot" or "excerpt"`);
  }
  const hits = scanExclusions(JSON.stringify(g));
  for (const h of hits) err(`exclusion "${h.id}" found in github-projects.json: ${h.match}`);
  return errors;
}

export function loadData() {
  return {
    resume: JSON.parse(readFileSync(join(root, 'data/resume.json'), 'utf8')),
    config: JSON.parse(readFileSync(join(root, 'data/site-config.json'), 'utf8')),
    github: JSON.parse(readFileSync(join(root, 'data/github-projects.json'), 'utf8')),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { resume, config, github } = loadData();
  const errors = [...validateResume(resume), ...validateConfig(config, resume), ...validateGithub(github)];
  const n = loadExclusions().length;
  if (errors.length) {
    console.error(`✗ ${errors.length} content problem(s):\n  - ` + errors.join('\n  - '));
    process.exit(1);
  }
  console.log(`✓ content valid (${n} exclusion patterns checked${existsSync(join(root, 'qa/exclusions.local.json')) ? ', including private list' : '; private list absent'})`);
}
