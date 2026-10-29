// Maintenance generator: data/resume.json + data/site-config.json → index.html.
// The committed index.html is the site; serving it needs no build step.
// Usage: node scripts/generate.mjs           (write index.html)
//        node scripts/generate.mjs --check   (fail if index.html is out of date)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateResume, validateConfig, loadData, scanExclusions } from './validate-content.mjs';
import * as R from '../js/render.js';
import { codePanel, chartPanel } from './lib/hero-panels.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const { resume, config } = loadData();
const errors = [...validateResume(resume), ...validateConfig(config)];
if (errors.length) {
  console.error('✗ refusing to generate; content problems:\n  - ' + errors.join('\n  - '));
  process.exit(1);
}
const d = { resume, config };

// --- SVG artwork ------------------------------------------------------------
function parseSvg(rel) {
  const src = read(rel);
  const viewBox = /viewBox="([^"]+)"/.exec(src)[1];
  const inner = src.replace(/^[\s\S]*?<svg[^>]*>\s*/, '').replace(/\s*<\/svg>\s*$/, '');
  return { viewBox, inner };
}
function inlineSvg(rel, cls, extra = '') {
  const { viewBox, inner } = parseSvg(rel);
  return `<svg class="art ${cls}" viewBox="${viewBox}"${extra} aria-hidden="true" focusable="false">\n${inner}\n</svg>`;
}
const HP = config.heroPanels;
const art = {
  // The hero's three disciplines: real code (CS), real prices (Finance), the real card (CE).
  heroCode: codePanel(HP.code),
  heroChart: chartPanel(HP.chart, JSON.parse(readFileSync(join(root, HP.chart.data), 'utf8'))),
  // The hero's card: a photoreal still, replaced by the live 3D card when it runs.
  // It is often the largest thing on the first screen, so it loads early and small.
  heroCard: `<img class="hero-card" src="assets/board/card-hero-800.webp" srcset="assets/board/card-hero-800.webp 800w, assets/board/card-hero.webp 1600w" sizes="(min-width: 860px) 48vw, 84vw" width="1600" height="1100" alt="" fetchpriority="high">`,
  // Photoreal stills of the real card (scripts/render-stills.mjs); decorative, the
  // captions carry the meaning.
  beatBoard: `<img class="beat-art beat-photo" src="assets/board/card-front.webp" width="1600" height="1000" alt="" loading="lazy" decoding="async" fetchpriority="low">`,
  beatBack: `<img class="beat-art beat-photo" src="assets/board/card-back.webp" width="1600" height="1000" alt="" loading="lazy" decoding="async" fetchpriority="low">`,
  beatLayers: `<img class="beat-art beat-photo" src="assets/board/card-exploded.webp" width="1600" height="1100" alt="" loading="lazy" decoding="async" fetchpriority="low">`,
  nfcStill: `<img class="nfc-static" src="assets/board/card-front.webp" width="1600" height="1000" alt="" loading="lazy" decoding="async" fetchpriority="low">`,
  closing: inlineSvg('assets/svg/closing-jali.svg', 'closing-art'),
};
const symbols = [];
{
  for (const f of readdirSync(join(root, 'assets/svg/glyphs')).sort()) {
    const g = parseSvg(`assets/svg/glyphs/${f}`);
    symbols.push(`<symbol id="glyph-${f.replace('.svg', '')}" viewBox="${g.viewBox}">${g.inner}</symbol>`);
  }
}

// --- Head -----------------------------------------------------------------------
const THEME_KEY = config.theme.storageKey;
const MOTION_KEY = config.theme.motionStorageKey;
// Runs before first paint: applies the saved theme/motion choice and tolerates
// blocked storage. Its hash is allowed by the Content Security Policy below.
const themeInit = `(function(){var d=document.documentElement,t='system',m='system';d.classList.remove('no-js');d.classList.add('js','nav-collapsible');setTimeout(function(){if(!d.classList.contains('is-enhanced'))d.classList.remove('nav-collapsible')},4000);try{t=localStorage.getItem('${THEME_KEY}')||t;m=localStorage.getItem('${MOTION_KEY}')||m}catch(e){}if(t==='light'||t==='dark')d.setAttribute('data-theme',t);if(m==='reduced')d.setAttribute('data-motion','reduced');else if(!location.hash&&window.matchMedia&&!matchMedia('(prefers-reduced-motion: reduce)').matches)d.classList.add('intro-pending')})();`;
const importMap = JSON.stringify({
  imports: {
    three: './vendor/three/three-board.min.js',
    lenis: './vendor/lenis/lenis.min.mjs',
    gsap: './vendor/gsap/gsap.min.mjs',
  },
});
const sha = (s) => `'sha256-${createHash('sha256').update(s, 'utf8').digest('base64')}'`;
const csp = [
  "default-src 'self'",
  `script-src 'self' ${sha(themeInit)} ${sha(importMap)}`,
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');
// No upgrade-insecure-requests: every URL is relative (HTTPS on Pages already),
// and WebKit applies it to http://127.0.0.1 previews, breaking local Safari tests.

// The subset of site-config.json the enhancement scripts read (no fetch needed).
const runtimeConfig = {
  theme: config.theme,
  meta: { themeColorDark: config.meta.themeColorDark, themeColorLight: config.meta.themeColorLight },
  labels: { pauseMotion: config.labels.pauseMotion, contact: config.labels.contact, skills: config.labels.skills },
  illustrations: config.illustrations,
  motion: config.motion,
  journey: config.journey,
  board: config.board,
};
const M = config.meta;
const absolute = (p) => (M.deployApproved ? new URL(p, M.deployUrl).href : p);
const head = R.html`<!doctype html>
<html lang="en" class="no-js">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <title>${M.title}</title>
  <meta name="description" content="${M.description}">
  <meta name="author" content="${resume.person.name}">
  <meta name="color-scheme" content="dark light">
  <meta name="theme-color" media="(prefers-color-scheme: dark)" content="${M.themeColorDark}">
  <meta name="theme-color" media="(prefers-color-scheme: light)" content="${M.themeColorLight}">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
${M.deployApproved ? R.html`  <link rel="canonical" href="${M.deployUrl}">\n  <meta property="og:url" content="${M.deployUrl}">\n` : ''}  <meta property="og:type" content="profile">
  <meta property="og:title" content="${M.title}">
  <meta property="og:description" content="${M.description}">
  <meta property="og:image" content="${absolute(M.socialImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${M.socialImageAlt}">
  <meta name="twitter:card" content="summary_large_image">
  <script>${R.raw(themeInit)}</script>
  <link rel="preload" href="assets/fonts/newsreader-latin-var.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="assets/fonts/dm-sans-latin-var.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="css/tokens.css">
  <link rel="stylesheet" href="css/base.css">
  <link rel="stylesheet" href="css/journey.css">
  <link rel="stylesheet" href="css/sections.css">
  <script type="importmap">${R.raw(importMap)}</script>
  <script type="module" src="js/main.js"></script>
  <script type="application/ld+json">${R.raw(R.jsonForScript(R.personJsonLd(d)))}</script>
  <script type="application/json" id="site-config">${R.raw(R.jsonForScript(runtimeConfig))}</script>
</head>`;

const body = R.html`
<body>
  <a class="skip-link" href="#main">${config.labels.skipLink}</a>
  <svg class="sprite" width="0" height="0" aria-hidden="true" focusable="false">
${R.raw(symbols.join('\n'))}
  </svg>
${R.renderHeader(d)}
${R.renderChapters(d)}
  <main id="main" tabindex="-1">
${R.renderHero(d, art)}
${R.renderJourney(d, art)}
    <div class="after" id="after">
${R.renderSnapshot(d)}
${R.renderExperience(d)}
${R.renderProjects(d, art)}
${R.renderSkills(d)}
${R.renderLeadership(d)}
${R.renderBeyond(d)}
${R.renderContact(d, art)}
    </div>
  </main>
${R.renderFooter(d)}
</body>
</html>
`;

const page = `<!-- Generated by scripts/generate.mjs from data/*.json. Edit the data, then run \`npm run generate\`. -->\n${head}${body}`;

const leaks = scanExclusions(page);
if (leaks.length) {
  console.error('✗ generated page contains excluded content:', leaks);
  process.exit(1);
}

const target = join(root, 'index.html');
if (process.argv.includes('--check')) {
  let current = '';
  try { current = readFileSync(target, 'utf8'); } catch {}
  if (current !== page) {
    console.error('✗ index.html is out of date with data/; run `npm run generate` and commit the result.');
    process.exit(1);
  }
  console.log('✓ index.html matches the data (no drift)');
} else {
  writeFileSync(target, page);
  console.log(`✓ wrote index.html (${(page.length / 1024).toFixed(1)} KB)`);
}
