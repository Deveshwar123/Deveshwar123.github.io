# Verification report

29 October 2026. Every result below was measured; anything not run is marked **pending** with the reason. Emulated or engine-only results are labelled as such and are not counted as real-browser passes.

## Environment

| Item | Value |
|---|---|
| Machine | Apple M1 Pro MacBook Pro, macOS 27.0.1 (26A434), mains power |
| Browser (automation and manual review) | Google Chrome 156.0.8078.73 |
| Engines | Playwright 1.64.1 WebKit build; Playwright Firefox build (does not launch on macOS 27; see below) |
| Tooling | Node 24.15.0, @playwright/test 1.64.1, @axe-core/playwright 4.13.0, Lighthouse 13.5.0, esbuild 0.28.2 |
| Pinned runtime | three 0.186.1, lenis 1.3.27, gsap 3.15.0 (see `vendor/manifest.json`) |

## Automated results

| Suite | Command | Result |
|---|---|---|
| Content validation | `npm run validate` | pass (9 exclusion patterns incl. private list) |
| Regeneration drift | `npm run check:drift` | pass |
| Unit tests | `npm test` | **37 / 37 pass** |
| Browser tests, Chrome | `npx playwright test --project=chrome` | **61 / 61 pass** (stable across three consecutive full runs) |
| Engine tests, WebKit | `npx playwright test --project=webkit` | **35 / 35 pass** (foundation, story, projects specs; Safari keyboard model uses Option+Tab) |
| Combined run (Chrome + WebKit, 3 workers) | `npx playwright test` | 96 / 96 in the last two consecutive runs. One earlier combined run had a single intermittent failure that did not reproduce and was not captured; timing-sensitive checks under shared CPU/GPU load are the likely cause |
| Engine tests, Firefox | `PW_FIREFOX=1 npx playwright test --project=firefox` | **pending** — Playwright's Firefox (Nightly) build exits with code 1 on macOS 27; Firefox is not installed on this Mac |
| Accessibility (axe, WCAG 2.0/2.1/2.2 A+AA rules) | in `tests/e2e/release.spec.mjs` | 0 violations: dark + light × desktop + mobile, reduced-motion page, and with the skills board pinned + NFC field shown |
| Contrast | `node scripts/check-contrast.mjs` | all required pairs pass in both themes (`reports/contrast.md`) |
| CSP | `release.spec.mjs` | 0 violations in Chrome while scrolling every section, pinning a skill and switching theme. WebKit reports one `style-src-attr` violation whose source is `web-inspector://bootstrap.js` (Playwright's inspector shim), not the site |
| Subdirectory hosting | `release.spec.mjs` (served at `/portfolio/`) | pass, no 4xx or failed requests |
| Deploy artifact | `node scripts/build-site.mjs` | 68 allowlisted files, no excluded content, no tests/QA/data/reports |

## Performance (lab)

**Lighthouse 13.5.0**, three cold runs per profile against `node scripts/serve.mjs --prod` (gzip, 10-minute cache): see `reports/lighthouse.md`.

| Profile | Perf | A11y | BP | SEO | LCP | CLS | TBT |
|---|---|---|---|---|---|---|---|
| Desktop preset (1350×940, no CPU throttling) | 100 (100–100) | 100 | 100 | 100 | 0.44 s | 0 | 0 ms |
| Mobile default (Moto G Power emulation, 4× CPU, slow 4G) | 99 (99–99) | 100 | 100 | 100 | 1.95 s | 0 | 0 ms |

Targets (≥95 in all four, LCP < 2.0 s, CLS 0) are met in this lab profile. These are not field Core Web Vitals; no analytics are installed, so there is no field data.

**Bytes** (`reports/budget.md`, gzip of what a real load requests): JS excluding Three 77.4 KB (budget 250 KB) · Three subset 147.6 KB (deferred; budget 250 KB) · all JS 225 KB · initial transfer 130.4 KB (budget 600 KB) · everything requested 348 KB.

**3D budget**: under 20k triangles and 50 draw calls (asserted in `story.spec.mjs`).

**Frame times** (`node scripts/profile-frames.mjs`, Chrome 156 on the M1 Pro, 60 Hz): 10 s forward/back wheel scroll through the story — 600 frames, p50/p95/p99/max 16.7/16.7/16.8/16.8 ms, 0 long tasks. NFC drag — 266 frames, same distribution, 0 long tasks. **Pending:** the 2020 MacBook Air named in the spec (Intel or M1 not stated) and a named phone.

**CLS**: 0.0000 mean over three cold loads at 1440×900 and 390×844 (layout-shift observer).

## Defects found and fixed during verification

| Found by | Defect | Fix |
|---|---|---|
| Lighthouse (mobile) | LCP was attributed to the intro's decorative name copy, painted ~1.7 s after the real heading | The bloom is now a text-free glow layer; the heading is the LCP element |
| Lighthouse (mobile) | LCP simulation counted story modules that started before first paint | Optional modules load after first contentful paint |
| Byte budget | Fonts were 195 KB | Subset to used characters, weights 400–500, Newsreader optical size fixed → 64 KB |
| WebKit engine | `upgrade-insecure-requests` rewrote `http://127.0.0.1` previews to HTTPS, so nothing loaded | Directive removed (all URLs are relative; Pages is HTTPS already) |
| CLS observer | Intro beat box, menu collapse and Pause button appearing after paint shifted layout | Beat starts below the fold; collapse and Pause space are applied before first paint with a no-JS fail-safe |
| Unit tests | Cusp normals computed from already-moved points looped the cusped arch | Normals come from the unmodified curve |
| e2e | Synthetic/fast pointers could throw in `setPointerCapture` | Capture is attempted and safely skipped |

## Phase gates

| Phase | Status |
|---|---|
| 1 Canonical data + semantic HTML | pass — exact-string round trip, no drift, no forbidden fields, no-JS content, real links only |
| 2 Tokens, themes, navigation | pass — contrast recorded, theme persistence and blocked storage, OS preference, keyboard reach, focus never under the header, 320 px and 200% text |
| 3 Finite intro | pass — ≤ 1.8 s, links usable at t = 0, scroll/keys/hash cancel, reduced motion and no-JS show finished art, CLS 0, no loader |
| 4 Reversible morph | pass — finite coordinates, exact endpoints, forward/reverse/random equality, no spikes |
| 5 Board, explode, chapters | pass — .62 at track end, continuous boundaries, chapters/hash/history, context loss → SVG, labels without collisions (desktop column, mobile row), single renderer |
| 6 After-content motion | pass — final values for assistive tech, timeline follows measured pads, reverse retracts only decoration, focus/anchors reveal |
| 7 Project mini-worlds | pass — no geolocation/camera/model/API calls, one renderer, keyboard and touch alternatives, pan-y scrolling, pointercancel, clean re-init |
| 8 Skills evidence graph | pass — every edge cites evidence, precedence and Escape, contrast kept, 1:1 viewBox for 240 px/s, list ≡ board |
| 9 Restrained polish | pass — native cursor kept, effects off for touch/keyboard/reduced motion, hit targets fixed, loops settle, Pause halts ambient motion |
| 10 Release verification | **partially complete** — automated and lab checks above pass; the manual items below are pending; publication not authorised yet |

## Manual checks

| Check | Status |
|---|---|
| Chrome desktop, both themes, all sections (visual review of screenshots at 1440×900 and full page) | done (Chrome 156) |
| Safari desktop | **pending** — WebKit engine tests pass, but real Safari was not driven (Safari automation needs "Allow Remote Automation" turned on by the owner) |
| Firefox desktop | **pending** — not installed; Playwright's build does not launch on macOS 27 |
| iOS Safari (real device) | **pending** — no device available to this session |
| Android (named mid-range device) | **pending** |
| VoiceOver + Safari (headings, role/date reading, project actions, skills selection, copy feedback) | **pending** — needs a person at the keyboard; the DOM structure is covered by axe and the heading/landmark tests |
| Forced colours | emulated in Chrome: text, controls, focus and current chapter use system colours; decorative art stays visible. Real Windows High Contrast **pending** |
| 400% zoom | covered by the 320 px + 200% text tests; real browser zoom at 400% **pending** |
| Timed recruiter task (someone unfamiliar finds name, major, school, GPA, projects, one action, contact, résumé within ~10 s) | **pending** — needs a person. At 1440×900 the name, major, university, GPA, three project links and "See my work" are all in the first viewport (asserted); the résumé is absent until supplied |

## Outstanding owner decisions

- Supply the approved résumé PDF (see README → Missing assets).
- Authorise publication (README → Publishing); until then `meta.deployApproved` stays `false` and nothing claims a deployed URL.
