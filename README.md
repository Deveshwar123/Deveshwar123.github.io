# Deveshwar Vankeswaram — portfolio

A one-page portfolio for a Computer Engineering student with a Computer Science minor and a finance track. The first screen is a small workbench of the three: a code window with a verbatim excerpt from TideCast (Computer Science), a daily chart of real MCHP prices with the result of my 20-year backtest (Finance), and my real NFC business card in front of them, a photoreal 3D model built from its own fabrication files (Computer Engineering). As you scroll, the card glides out of the hero, turns over, splits into its layers and lights its LED. Then the page gives way to the résumé, with real screenshots of the projects and photos for the interests. The page is fully readable with JavaScript off, with reduced motion, and without a GPU; the animation and 3D are enhancements on top.

## How it works (the interview version)

1. **One data file generates semantic HTML.** `data/resume.json` holds every fact; `data/site-config.json` holds labels, motion tokens and story ranges. `scripts/generate.mjs` writes the committed `index.html`. The site itself never builds anything at runtime.
2. **Small modules enhance it.** `js/main.js` boots theme, motion mode and navigation first, then loads the story, reveals, project panels, skills board and cursor polish in isolation. A failure in one is reported once and leaves the static page untouched.
3. **One scroll value drives a pure story.** `p = .62 × clamp((scrollY − start) / travel, 0, 1)` feeds `evaluateStory(p, viewport)` (`js/story-state.js`), which returns every visual channel. Same p and viewport → same picture, forwards or backwards, at any frame rate. The only timed sequence is the 1.8s intro.
4. **Capability tiers preserve access.** *full* (wide screens) and *compact* (narrow screens, lighter textures) both draw the live 3D card when WebGL2 is available and an SVG card otherwise; *static* (reduced motion or any failure) shows still renders. The 3D card starts on the visitor's first scroll, pointer move, touch or key, or once the page is idle; until then the hero shows an identical still, so first paint and input never wait for shaders. Reduced motion switches live.

```
data/*.json ──generate──▶ index.html (semantic, complete)
                               │
            js/main.js ── theme · motion · nav · contact
                │
                ├─ journey.js ── story-state.js (pure) ─▶ SVG adapter (board-svg.js)
                │                                     └─▶ WebGL adapter (board.js ← renderer.js, one context)
                ├─ reveal.js · projects.js · skills-board.js · cursor.js
                └─ scheduler.js (the only decorative requestAnimationFrame loop; Lenis runs inside it)
```

`js/board-data.js` holds the card's real geometry parsed from its Gerbers, and `js/art.js` turns it (and the other line art) into paths. `js/projection.js` is the shared camera (yaw, pitch, roll and depth), so the SVG card and the photoreal 3D card take exactly the same pose. The hero pose is measured from the still image's box, so the live card lands precisely on it. The code and chart panels are generated at build time by `scripts/lib/hero-panels.mjs`: the excerpt is pinned to a commit and highlighted without changing a character; EMA 20/50 and Wilder's RSI 14 are computed from the committed price snapshot.

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

**Artwork and realism assets** (run with the preview server up where noted):

| Script | Produces |
|---|---|
| `npm run art` | the inspectable line-art SVGs in `assets/svg/` from `js/art.js` |
| `node scripts/build-board.mjs` | `js/board-data.js` (the card's real outline, five antenna turns, traces, pads, vias, parts) and the PBR texture maps in `assets/board/`, rendered from `hardware/gerbers/` with pcb-stackup |
| `node scripts/render-stills.mjs` (server) | photoreal stills of the card (`assets/board/card-*.webp`) for the no-JS frames, the NFC fallback and the social card |
| `node scripts/capture-projects.mjs` | fresh screenshots of the live TideCast and Vedam sites (`assets/projects/`) |
| `node scripts/process-photos.mjs` | crops and encodes the credited Wikimedia Commons photos listed in `site-config.json → photos` |
| `node scripts/fetch-market.mjs` | `data/market/mchp-daily.json`: a one-year snapshot of daily MCHP prices from Yahoo Finance for the hero chart (finished sessions only; the site never fetches market data itself) |
| `node scripts/build-social.mjs` | `assets/social-card.png` |

## Motion and modes

| Control | Effect |
|---|---|
| OS "reduce motion", or footer **Motion → Reduced** | Static tier: no smooth scrolling, morphs, counters, magnetism, drift or sweeps; the story is three still frames in normal flow |
| Header **Pause motion** | Halts autonomous decoration (ping, ambient board, moving skill traces, cursor ring) |
| Footer **Theme** | System (default), Light or Dark; the choice persists and survives blocked storage |

## Tests and evidence

| Command | What it covers |
|---|---|
| `npm test` | 43 unit tests: every supplied string round-trips record → data → page, counts, exclusions, JSON-LD; story determinism in any order, boundary continuity, the hero pose landing on the measured card, one caption at a time, the LED pulse, 45°/90° routing without crossings, Euler order, easing and spring maths; the code excerpt survives highlighting verbatim, EMA/RSI against hand-computed values, the price snapshot's integrity and that the finance claim is the résumé's own |
| `npm run test:e2e` | 62 Playwright checks in Chrome (no-JS content, themes, keyboard and focus, reflow, the hero and the story, chapters and history, context loss, budgets, reveals, project panels, skills board, polish, axe scans, CSP, subdirectory hosting) plus 36 on Playwright's WebKit engine; `PW_FIREFOX=1` adds Firefox where it launches |
| `node scripts/check-contrast.mjs` | `reports/contrast.md` — every token pair in both themes |
| `node scripts/measure-budget.mjs` | `reports/budget.md` — gzip bytes of what a real load requests |
| `node scripts/serve.mjs 8090 --prod` then `node scripts/run-lighthouse.mjs` | `reports/lighthouse.md` — three cold runs per profile, median and range |
| `node scripts/build-site.mjs` | `_site/` from an allowlist, scanned for excluded content |

Measured on 29 Oct 2026 after the hero redesign (Apple M1 Pro, Chrome 156): JS excluding Three 78 KB gz, Three subset 144 KB gz, initial transfer 223 KB, card textures and photos load lazily; Lighthouse desktop 100/100/100/100 with LCP 0.44 s, mobile 99/100/100/100 with LCP 1.95 s, total blocking time 0 ms and CLS 0 in both. Full results and everything still pending (real Safari/iOS/Android, screen readers, the timed recruiter test) are in `reports/verification.md`.

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
