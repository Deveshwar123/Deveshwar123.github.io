# Deveshwar Vankeswaram — portfolio ("Tradition → Circuit")

A one-page portfolio where an original Indian jali lattice turns into the routed copper of an illustrated NFC business card as you scroll, then gives way to the résumé. The page is fully readable with JavaScript off, with reduced motion, and without a GPU; the animation and 3D are enhancements on top.

## How it works (the interview version)

1. **One data file generates semantic HTML.** `data/resume.json` holds every fact; `data/site-config.json` holds labels, motion tokens and story ranges. `scripts/generate.mjs` writes the committed `index.html`. The site itself never builds anything at runtime.
2. **Small modules enhance it.** `js/main.js` boots theme, motion mode and navigation first, then loads the story, reveals, project panels, skills board and cursor polish in isolation. A failure in one is reported once and leaves the static page untouched.
3. **One scroll value drives a pure story.** `p = .62 × clamp((scrollY − start) / travel, 0, 1)` feeds `evaluateStory(p, viewport)` (`js/story-state.js`), which returns every visual channel. Same p and viewport → same picture, forwards or backwards, at any frame rate. The only timed sequence is the 1.8s intro.
4. **Capability tiers preserve access.** *full* (SVG + WebGL2), *compact* (SVG only: narrow screens or no WebGL2), *static* (three still frames: reduced motion or any failure). Reduced motion switches live.

```
data/*.json ──generate──▶ index.html (semantic, complete)
                               │
            js/main.js ── theme · motion · nav · contact
                │
                ├─ journey.js ── story-state.js (pure) ─▶ SVG adapter (morph.js, board-svg.js)
                │                                     └─▶ WebGL adapter (board.js ← renderer.js, one context)
                ├─ reveal.js · projects.js · skills-board.js · cursor.js
                └─ scheduler.js (the only decorative requestAnimationFrame loop; Lenis runs inside it)
```

`js/art.js` is the single source of geometry: the arch is built around the measured hero text, its five arch lines become the five antenna turns, the ogee lattice lines become bus traces and the frame becomes the board outline. `js/projection.js` is the shared camera, so the SVG traces and the 3D traces register exactly when the board is face-on.

## Run it

```sh
npm install            # dev tools only; the site has no runtime dependencies
npm run serve          # http://127.0.0.1:8080 (a static server with correct module MIME types)
```

Any static HTTP server works; opening `index.html` from the file system does not (ES modules need HTTP).

## Edit content

1. Edit `data/resume.json` (facts) or `data/site-config.json` (labels, captions, motion, ranges).
2. `npm run validate` — schema, unique ids, https/mailto only, skill links that cite a résumé line naming the skill, owner-approved revisions, and the exclusion scan.
3. `npm run generate` — rewrites `index.html`. CI fails if you forget (`npm run check:drift`).

Rules the validator enforces: the major is "Computer Engineering"; a changed bullet keeps its supplied text in `sourceText` and needs `revision.approvedBy: "owner"`; missing links are `null` (no button is rendered). Private exclusion phrases live in `qa/exclusions.local.json`, which is gitignored; generic ones are in `qa/exclusions.json`.

**Skills evidence:** add an edge to `skillRelations` as `{ skillId, entityId, evidenceRef }`, where `evidenceRef` points at a bullet (`projects.tidecast.b2`) or description (`leadership.goldman-steam.description`) that names the skill. The validator rejects edges whose evidence doesn't mention the skill.

**Artwork:** `npm run art` regenerates the inspectable SVGs in `assets/svg/` from `js/art.js`; `node scripts/build-social.mjs` renders `assets/social-card.png` (with the preview server running).

## Motion and modes

| Control | Effect |
|---|---|
| OS "reduce motion", or footer **Motion → Reduced** | Static tier: no smooth scrolling, morphs, counters, magnetism, drift or sweeps; the story is three still frames in normal flow |
| Header **Pause motion** | Halts autonomous decoration (ping, ambient board, moving skill traces, cursor ring) |
| Footer **Theme** | System (default), Light or Dark; the choice persists and survives blocked storage |

## Tests and evidence

| Command | What it covers |
|---|---|
| `npm test` | 37 unit tests: every supplied string round-trips record → data → page, counts, exclusions, JSON-LD; story determinism in any order, boundary continuity, the LED pulse, morph integrity, 45°/90° routing without crossings, SVG/3D registration, easing and spring maths |
| `npm run test:e2e` | 61 Playwright checks in Chrome (no-JS content, themes, keyboard and focus, reflow, the story, chapters and history, context loss, budgets, reveals, project panels, skills board, polish, axe scans, CSP, subdirectory hosting) plus 35 on Playwright's WebKit engine; `PW_FIREFOX=1` adds Firefox where it launches |
| `node scripts/check-contrast.mjs` | `reports/contrast.md` — every token pair in both themes |
| `node scripts/measure-budget.mjs` | `reports/budget.md` — gzip bytes of what a real load requests |
| `node scripts/serve.mjs 8090 --prod` then `node scripts/run-lighthouse.mjs` | `reports/lighthouse.md` — three cold runs per profile, median and range |
| `node scripts/build-site.mjs` | `_site/` from an allowlist, scanned for excluded content |

Measured on 29 Oct 2026 (Apple M1 Pro, Chrome 156): JS excluding Three 77 KB gz, Three subset 148 KB gz, initial transfer 130 KB; Lighthouse desktop 100/100/100/100 with LCP 0.44 s, mobile 99/100/100/100 with LCP 1.95 s, CLS 0 in both. Full results and everything still pending (real Safari/iOS/Android, screen readers, the timed recruiter test) are in `reports/verification.md`.

Screenshots are reproducible with Playwright against the preview server; the helper scripts used during the build write to a scratch folder, and the preview images are kept in the owner's notes.

## Dependencies

Pinned exactly in `package.json` and vendored as tree-shaken bundles by `npm run vendor` (`scripts/build-vendor.mjs`), with upstream integrity and SHA-256 recorded in `vendor/manifest.json`. Fonts are self-hosted, subset with `scripts/subset-fonts.py`. Licences: `THIRD_PARTY_NOTICES.md`.

## Missing assets

- **Résumé PDF** — reserved at `assets/Deveshwar_Vankeswaram_Resume.pdf`. No download control appears until the owner supplies an approved PDF and `assets.resumePdf.approved` is set to `true`. Before approving, check the PDF says Computer Engineering and contains no phone number, street address, high school or the excluded program (including in its metadata).

## Publishing (GitHub Pages) — not done; requires the owner's go-ahead

The intended home is the user site `https://deveshwar123.github.io` (repository `Deveshwar123.github.io`, which did not exist on 29 Oct 2026; GitHub allows one user site per account).

1. Set `meta.deployApproved` to `true` in `data/site-config.json` and run `npm run generate` (adds the canonical URL, `og:url` and an absolute social image URL).
2. Run the full local checks, including the private exclusion scan: `npm run test:all && node scripts/build-site.mjs`.
3. Create the repository, push, and in **Settings → Pages** choose **GitHub Actions** as the source.
4. Run the `site` workflow manually with **deploy: true**. Only the allowlisted `_site/` is published; tests, QA lists, data and reports are never served.

**Security headers:** the Content Security Policy ships as a `<meta>` tag (`default-src 'self'`, hashed inline scripts, no inline styles, `object-src 'none'`, `base-uri 'self'`, `form-action 'none'`). GitHub Pages cannot set response headers, so `frame-ancestors`, HSTS and other header-only policies are not deployed there; use a host with header control if those matter.
