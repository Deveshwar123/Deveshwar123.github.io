// Pure data-to-markup helpers. The maintenance generator (scripts/generate.mjs)
// uses them to write index.html; nothing here touches the DOM, and every
// interpolated value is escaped unless it is explicitly marked raw.

export class Raw {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
export const raw = (s) => new Raw(s);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
export const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ESC[c]);

function fmt(v) {
  if (v === null || v === undefined || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(fmt).join('');
  return escapeHtml(v);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += fmt(values[i]) + strings[i + 1];
  return raw(out);
}

export function safeUrl(u) {
  const url = new URL(u);
  if (url.protocol !== 'https:' && url.protocol !== 'mailto:') throw new Error(`Disallowed URL scheme: ${u}`);
  return u;
}

// JSON for <script type="application/json|ld+json">: never lets content close the tag.
export const jsonForScript = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

const glyph = (name, cls = 'glyph') => html`<svg class="${cls}" aria-hidden="true" focusable="false"><use href="#glyph-${name}"></use></svg>`;
const time = (display, iso) => (iso ? html`<time datetime="${iso}">${display}</time>` : html`<span>${display}</span>`);
const rangeIso = (r) => (r && r.start && r.end && r.start === r.end ? r.start : null);

function sectionHead(id, { kicker, title }, extraClass = '') {
  return html`
      <header class="section-head${extraClass}">
        <p class="kicker" aria-hidden="true">${kicker}</p>
        <h2 class="section-title" id="${id}-title">${title}</h2>
      </header>`;
}

// ---------------------------------------------------------------------------

export function renderHeader(d) {
  const L = d.config.labels;
  const resume = d.resume.assets.resumePdf;
  return html`
  <header class="site-header" id="site-header">
    <div class="header-inner">
      <a class="home-link" href="#top">${glyph('monogram', 'monogram')}<span class="home-name">${L.homeLink}</span></a>
      <nav class="primary-nav" aria-label="${L.primaryNav}">
        <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-links">${L.menu}</button>
        <ul class="primary-links" id="primary-links">
${L.nav.map((n) => html`          <li><a href="${n.href}">${n.label}</a></li>\n`)}        </ul>
      </nav>
      <div class="header-tools">
        ${resume.approved ? html`<a class="header-resume" href="${resume.path}" type="application/pdf">${L.hero.resume}</a>` : ''}
        <button class="pause-toggle" type="button" aria-pressed="false" hidden>${glyph('pause')}<span class="pause-label">${L.pauseMotion}</span></button>
      </div>
    </div>
  </header>`;
}

export function renderChapters(d) {
  const L = d.config.labels;
  return html`
  <nav class="chapters" aria-label="${L.chaptersNav}">
    <ol>
${L.chapters.map((c) => html`      <li><a class="chapter-link" href="${c.href}"><span class="chapter-dot" aria-hidden="true"></span><span class="chapter-label">${c.label}</span></a></li>\n`)}    </ol>
  </nav>`;
}

export function renderHero(d, art) {
  const { person } = d.resume;
  const edu = d.resume.education[0];
  const H = d.config.labels.hero;
  const resume = d.resume.assets.resumePdf;
  const [first, ...rest] = person.name.split(' ');
  return html`
    <section class="hero" id="top" aria-labelledby="hero-name">
      <div class="hero-backdrop" aria-hidden="true"></div>
      <div class="hero-copy">
        <p class="kicker hero-kicker">${H.kicker.split(' · ').map((k, i) => html`${i ? ' · ' : ''}<span class="kicker-item">${k}</span>`)}</p>
        <h1 class="hero-name" id="hero-name"><span class="hero-name-line">${first}</span> <span class="hero-name-line">${rest.join(' ')}</span></h1>
        <p class="hero-subtitle">${person.heroSubtitle}</p>
        <dl class="hero-facts">
          <div class="hero-fact"><dt>${H.majorTerm}</dt><dd>${edu.degree}, ${edu.minor}</dd></div>
          <div class="hero-fact"><dt>${H.universityTerm}</dt><dd>${edu.institution}</dd></div>
          <div class="hero-fact"><dt>${H.gpaTerm}</dt><dd>${edu.gpa}</dd></div>
        </dl>
        <nav class="hero-projects" aria-labelledby="hero-projects-label">
          <p class="hero-projects-label" id="hero-projects-label">${H.projectsLabel}</p>
          <ul>
${d.resume.projects.map((p) => html`            <li><a href="#project-${p.id}">${p.title}</a></li>\n`)}          </ul>
        </nav>
        <div class="hero-actions">
          <a class="button button--primary" href="#projects">${H.seeWork}${glyph('arrow')}</a>
          ${resume.approved ? html`<a class="button" href="${resume.path}" type="application/pdf">${H.resume}</a>` : ''}
        </div>
      </div>
      <div class="hero-visual" aria-hidden="true">
        ${raw(art.heroCode)}
        ${raw(art.heroChart)}
        <div class="hero-card-slot">${raw(art.heroCard)}</div>
        <p class="hero-card-tag"><span class="panel-tag">${d.config.heroPanels.card.discipline}</span> <span>${d.config.heroPanels.card.caption}</span></p>
      </div>
    </section>`;
}

export function renderJourney(d, art) {
  const J = d.config.labels.journey;
  const beats = d.config.illustrations.beats;
  const figures = [art.beatBoard, art.beatBack, art.beatLayers];
  return html`
    <section class="journey" id="journey" aria-labelledby="journey-title">
      <header class="journey-head">
        <h2 class="journey-title" id="journey-title">${J.title}</h2>
        <p class="journey-intro">${J.intro}</p>
      </header>
      <ol class="beats">
${beats.map((b, i) => html`        <li class="beat beat--${i + 1}" id="${b.id}" data-p="${b.p}">
          <figure class="beat-figure">
            ${raw(figures[i])}
            <figcaption class="beat-caption">
              <p class="kicker" aria-hidden="true">${b.chapter}</p>
              <h3 class="beat-title">${b.title}</h3>
              <p>${b.caption}</p>
              ${i === beats.length - 1 ? html`<ul class="layer-list">${d.config.illustrations.layerLabels.map((l) => html`<li>${l}</li>`)}</ul>` : ''}
            </figcaption>
          </figure>
        </li>\n`)}      </ol>
      <div class="stage" id="stage" aria-hidden="true"></div>
    </section>`;
}

export function renderSnapshot(d) {
  const S = d.config.labels.sections;
  const edu = d.resume.education[0];
  return html`
    <section class="section snapshot" id="snapshot" aria-labelledby="snapshot-title">
      ${sectionHead('snapshot', S.snapshot)}
      <ul class="stats">
${d.resume.snapshot.map((s) => html`        <li class="stat"><span class="stat-value" data-value="${s.value}">${s.value}</span> <span class="stat-label">${s.label}</span></li>\n`)}      </ul>
      <article class="education" aria-labelledby="edu-${edu.id}">
        ${d.config.photos.items.campus ? html`<div class="education-photo">${photo('campus', d.config.photos.items.campus, { sizes: '(min-width: 1360px) 1280px, 100vw', alt: 'The Academic Building at Texas A&M University', cls: 'education-img' })}</div>` : ''}
        <p class="kicker" aria-hidden="true">${S.education}</p>
        <h3 class="education-name" id="edu-${edu.id}">${edu.institution}</h3>
        <p class="meta"><span>${edu.location}</span> · ${time(edu.dateDisplay, edu.dateRange?.end)}</p>
        <p class="education-degree">${edu.degree}, ${edu.minor}</p>
        <ul class="education-honors">
          <li>GPA ${edu.gpa}</li>
${edu.honors.map((h) => html`          <li>${h}</li>\n`)}        </ul>
      </article>
    </section>`;
}

export function renderExperience(d) {
  const S = d.config.labels.sections;
  return html`
    <section class="section experience" id="experience" aria-labelledby="experience-title">
      ${sectionHead('experience', S.experience)}
      <div class="timeline">
        <ol class="roles">
${d.resume.experience.map((e) => html`          <li class="role" id="role-${e.id}">
            <span class="role-pad" aria-hidden="true"></span>
            <article class="role-card" aria-labelledby="role-${e.id}-title">
              <h3 class="role-org" id="role-${e.id}-title">${e.organization}</h3>
              <p class="meta"><span class="role-title">${e.role}</span> · <span>${e.location}</span> · ${time(e.dateDisplay, null)}</p>
              <ul class="bullets">
${e.bullets.map((b) => html`                <li>${b.text}</li>\n`)}              </ul>
            </article>
          </li>\n`)}        </ol>
      </div>
    </section>`;
}

function projectActions(p, L) {
  const actions = [];
  if (p.liveUrl) actions.push(html`<a class="button button--small" href="${safeUrl(p.liveUrl)}"><span class="visually-hidden">${p.title} </span>${L.live}${glyph('external')}</a>`);
  if (p.codeUrl) {
    const label = p.id === 'nfc-card' ? L.hardware : L.code;
    actions.push(html`<a class="button button--small" href="${safeUrl(p.codeUrl)}"><span class="visually-hidden">${p.title} </span>${label}${glyph('external')}</a>`);
  }
  return actions.length ? html`<p class="project-actions">${actions}</p>` : '';
}

// Real screenshots of a live project in CSS-drawn laptop and phone frames.
function devices(id) {
  return html`<div class="devices" aria-hidden="true">
              <div class="laptop"><div class="laptop-screen"><img src="assets/projects/${id}-desktop.webp" width="1280" height="800" alt="" loading="lazy" decoding="async" fetchpriority="low"></div><div class="laptop-base"></div></div>
              <div class="phone"><div class="phone-screen"><img src="assets/projects/${id}-phone.webp" width="390" height="844" alt="" loading="lazy" decoding="async" fetchpriority="low"></div></div>
            </div>`;
}

function projectWorld(p, d, art) {
  const W = d.config.illustrations.projects[p.id];
  const N = d.config.illustrations.projects['nfc-card'];
  if (p.id === 'tidecast') {
    return html`
          <figure class="project-world world-tidecast">
            <div class="world-art">${devices('tidecast')}</div>
            <div class="pipeline">
              <p class="pipeline-label">${W.modeLabel}</p>
              <ol class="pipeline-steps">
${W.steps.map((s, i) => html`                <li class="pipeline-step" data-step="${i}">${s}</li>\n`)}              </ol>
            </div>
            <figcaption class="world-caption">${W.description}</figcaption>
          </figure>`;
  }
  if (p.id === 'vedam') {
    return html`
          <figure class="project-world world-vedam">
            <div class="world-art vedam-art">${devices('vedam')}</div>
            <figcaption class="world-caption">${W.description}</figcaption>
          </figure>`;
  }
  return html`
          <figure class="project-world world-nfc">
            <div class="world-art nfc-view" data-nfc-view>
              ${raw(art.nfcStill)}
            </div>
            <div class="nfc-controls" role="group" aria-label="${N.controlsLabel}" hidden>
              <button type="button" class="icon-button" data-nfc="left">${glyph('rotate-left')}<span>${N.rotateLeft}</span></button>
              <button type="button" class="icon-button" data-nfc="right">${glyph('rotate-right')}<span>${N.rotateRight}</span></button>
              <button type="button" class="icon-button" data-nfc="reset">${glyph('reset')}<span>${N.reset}</span></button>
              <button type="button" class="icon-button nfc-field-toggle" data-nfc="field" aria-pressed="false">${glyph('field')}<span>${N.fieldToggle}</span></button>
            </div>
            <p class="nfc-field-note" hidden>${N.hotspot}</p>
            <p class="visually-hidden nfc-status" role="status" aria-live="polite"></p>
            <figcaption class="world-caption">${W.description}</figcaption>
          </figure>`;
}

export function renderProjects(d, art) {
  const S = d.config.labels.sections;
  const L = d.config.labels.project;
  return html`
    <section class="section projects" id="projects" aria-labelledby="projects-title">
      ${sectionHead('projects', S.projects)}
${d.resume.projects.map((p) => html`      <article class="project project--${p.id}" id="project-${p.id}" aria-labelledby="project-${p.id}-title">
        <div class="project-text">
          <h3 class="project-title" id="project-${p.id}-title">${p.title}</h3>
          <p class="meta"><span>${p.role}</span> · ${time(p.dateDisplay, rangeIso(p.dateRange))}</p>
          <ul class="bullets">
${p.bullets.map((b) => html`            <li>${b.text}</li>\n`)}          </ul>
          <ul class="chips" aria-label="${L.chipsLabel}">
${(d.resume.projectChips[p.id] ?? []).map((c) => html`            <li>${c.label}</li>\n`)}          </ul>
          ${projectActions(p, L)}
        </div>
${projectWorld(p, d, art)}
      </article>\n`)}    </section>`;
}

function entityName(d, id) {
  const e = [...d.resume.experience, ...d.resume.projects, ...d.resume.leadership].find((x) => x.id === id);
  return e.title ?? e.organization;
}
function entityAnchor(d, id) {
  if (d.resume.experience.some((e) => e.id === id)) return `#role-${id}`;
  if (d.resume.projects.some((e) => e.id === id)) return `#project-${id}`;
  return `#activity-${id}`;
}

export function skillGraphData(d) {
  const skills = [
    ...d.resume.skills.languages.map((s) => ({ ...s, group: 'languages' })),
    ...d.resume.skills.tools.map((s) => ({ ...s, group: 'tools' })),
  ];
  const entityIds = [...new Set(d.resume.skillRelations.map((r) => r.entityId))];
  const order = [...d.resume.experience, ...d.resume.projects, ...d.resume.leadership].map((e) => e.id);
  entityIds.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return {
    skills: skills.map(({ id, label, group }) => ({ id, label, group })),
    entities: entityIds.map((id) => ({ id, label: entityName(d, id), href: entityAnchor(d, id) })),
    relations: d.resume.skillRelations.map(({ skillId, entityId, evidenceRef }) => ({ skillId, entityId, evidenceRef })),
  };
}

export function renderSkills(d) {
  const S = d.config.labels.sections;
  const K = d.config.labels.skills;
  const g = skillGraphData(d);
  const linksFor = (sid) => g.relations.filter((r) => r.skillId === sid).map((r) => g.entities.find((e) => e.id === r.entityId));
  const item = (s) => {
    const links = linksFor(s.id);
    return html`            <li class="skill" data-skill="${s.id}"><span class="skill-name">${s.label}</span>${links.length ? html`<span class="skill-links"><span class="visually-hidden">: </span>${links.map((e, i) => html`${i ? ', ' : ''}<a href="${e.href}" data-entity="${e.id}">${e.label}</a>`)}</span>` : ''}</li>\n`;
  };
  return html`
    <section class="section skills" id="skills" aria-labelledby="skills-title">
      ${sectionHead('skills', S.skills)}
      <p class="skills-intro">${K.relationsIntro}</p>
      <div class="skills-body" data-skills-graph>
        <div class="skill-group">
          <h3 class="skill-group-title">${K.languages}</h3>
          <ul class="skill-items">
${d.resume.skills.languages.map(item)}          </ul>
        </div>
        <div class="skill-group">
          <h3 class="skill-group-title">${K.tools}</h3>
          <ul class="skill-items">
${d.resume.skills.tools.map(item)}          </ul>
        </div>
      </div>
      <div class="certifications">
        <h3 class="skill-group-title">${K.certifications}</h3>
        <ul class="cert-items">
${d.resume.certifications.map((c) => html`          <li>${c.label}</li>\n`)}        </ul>
      </div>
      <script type="application/json" id="skills-data">${raw(jsonForScript({ ...g, labels: { hint: K.boardHint, clear: K.clear, noLink: K.noLink, filterLabel: K.filterLabel, filterAll: K.filterAll, languages: K.languages, tools: K.tools, entities: K.entities, linkedTo: K.linkedTo } }))}</script>
    </section>`;
}

export function renderLeadership(d) {
  const S = d.config.labels.sections;
  return html`
    <section class="section leadership" id="leadership" aria-labelledby="leadership-title">
      ${sectionHead('leadership', S.leadership)}
      <ul class="activities">
${d.resume.leadership.map((l) => html`        <li class="activity" id="activity-${l.id}">
          ${glyph(l.glyph, 'glyph activity-glyph')}
          <div class="activity-body">
            <h3 class="activity-org">${l.organization}</h3>
            <p class="meta"><span>${l.role}</span> · ${time(l.dateDisplay, null)}</p>
            ${l.description ? html`<p class="activity-desc">${l.description}</p>` : ''}
          </div>
        </li>\n`)}      </ul>
    </section>`;
}

// Responsive photo markup for a credited image processed into assets/photos/.
function photo(id, item, { sizes, alt = '', cls }) {
  const [aw, ah] = item.aspect;
  const [big, small] = aw > ah ? [1600, 800] : [720, 420];
  return html`<img class="${cls}" src="assets/photos/${id}-${big}.webp" srcset="assets/photos/${id}-${small}.webp ${small}w, assets/photos/${id}-${big}.webp ${big}w" sizes="${sizes}" width="${big}" height="${Math.round((big * ah) / aw)}" alt="${alt}" loading="lazy" decoding="async" fetchpriority="low">`;
}

export function renderBeyond(d) {
  const S = d.config.labels.sections;
  const P = d.config.photos.items;
  return html`
    <section class="section beyond" id="beyond" aria-labelledby="beyond-title">
      ${sectionHead('beyond', S.beyond)}
      <ul class="interests">
${d.resume.interests.map((i) => html`        <li class="interest">
          ${P[i.id] ? html`<div class="interest-photo">${photo(i.id, P[i.id], { sizes: '(min-width: 860px) 300px, 46vw', cls: 'interest-img' })}</div>` : ''}
          <span class="interest-text">${glyph(i.glyph, 'glyph interest-glyph')}<span class="interest-label">${i.label}</span></span>
        </li>\n`)}      </ul>
    </section>`;
}

export function renderContact(d, art) {
  const S = d.config.labels.sections.contact;
  const C = d.config.labels.contact;
  const { links } = d.resume;
  const resume = d.resume.assets.resumePdf;
  return html`
    <section class="section contact" id="contact" aria-labelledby="contact-title">
      <div class="contact-art" aria-hidden="true">${raw(art.closing)}</div>
      <p class="kicker" aria-hidden="true">${S.kicker}</p>
      <h2 class="section-title contact-title" id="contact-title">${S.title}</h2>
      <div class="contact-email">
        <p class="contact-label">${C.emailLabel}</p>
        <p class="email-address">${links.email}</p>
        <p class="contact-email-actions">
          <a class="button button--primary" href="${safeUrl('mailto:' + links.email)}">${C.emailAction}${glyph('arrow')}</a>
          <button class="button copy-email" type="button" data-email="${links.email}" hidden><span class="copy-icon">${glyph('copy')}${glyph('check', 'glyph glyph-check')}</span><span class="copy-label">${C.copy}</span></button>
          <span class="copy-status" role="status" aria-live="polite"></span>
        </p>
      </div>
      <ul class="contact-links">
        <li><a href="${safeUrl(links.linkedin.url)}"><span class="contact-link-kind">${C.linkedin}</span> <span class="contact-link-url">${links.linkedin.display}</span></a></li>
        <li><a href="${safeUrl(links.github.url)}"><span class="contact-link-kind">${C.github}</span> <span class="contact-link-url">${links.github.display}</span></a></li>
        ${resume.approved ? html`<li><a href="${resume.path}" type="application/pdf"><span class="contact-link-kind">${d.config.labels.hero.resume}</span></a></li>` : ''}
      </ul>
    </section>`;
}

export function renderFooter(d) {
  const F = d.config.labels.footer;
  const radios = (name, opts) => opts.map(([value, label]) => html`<label class="segment"><input type="radio" name="${name}" value="${value}"><span>${label}</span></label>`);
  return html`
  <footer class="site-footer">
    <div class="footer-inner">
      <p class="footer-name">${d.resume.person.name}</p>
      <div class="footer-controls" hidden>
        <fieldset class="segmented" data-theme-control>
          <legend>${F.theme}</legend>
          ${radios('theme', [['system', F.themeSystem], ['light', F.themeLight], ['dark', F.themeDark]])}
        </fieldset>
        <fieldset class="segmented" data-motion-control>
          <legend>${F.motion}</legend>
          ${radios('motion', [['system', F.motionSystem], ['reduced', F.motionReduced]])}
        </fieldset>
      </div>
      <p class="footer-note">${F.note}</p>
      <details class="photo-credits">
        <summary>${F.credits}</summary>
        <ul>
${Object.values(d.config.photos.items).map((c) => html`          <li><a href="${safeUrl(c.source)}">${c.title}</a> by ${c.author}, <a href="${safeUrl(c.licenseUrl)}">${c.license}</a> (${F.creditsChanges})</li>\n`)}        </ul>
      </details>
    </div>
  </footer>`;
}

export function personJsonLd(d) {
  const { person, links, education } = d.resume;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: person.name,
    description: person.heroSubtitle,
    email: `mailto:${links.email}`,
    affiliation: { '@type': 'CollegeOrUniversity', name: education[0].institution },
    sameAs: [links.linkedin.url, links.github.url],
  };
  if (d.config.meta.deployApproved) ld.url = d.config.meta.deployUrl;
  return ld;
}
