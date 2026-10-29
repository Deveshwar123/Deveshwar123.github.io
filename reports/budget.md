# Byte budget

Measured 2026-10-29 from the files a real Chrome load requests (gzip -9 per file; WOFF2/PNG counted as-is).

## Desktop 1440×900 (full tier)

| Measure | Size (gz) | Budget | Result |
|---|---|---|---|
| JS excluding Three (app + Lenis + GSAP) | 77.4 KB | 250.0 KB | pass |
| Three.js subset (deferred) | 147.6 KB | 250.0 KB | pass |
| All JS including Three | 225.0 KB | — | reported |
| Initial transfer (before load: HTML, CSS, fonts, entry JS) | 130.4 KB | 600.0 KB | pass |
| Everything requested | 347.7 KB | — | reported |

<details><summary>Files</summary>

| File | Raw | Gzip | Initial |
|---|---|---|---|
| vendor/three/three-board.min.js | 578.6 KB | 147.6 KB |  |
| index.html | 136.5 KB | 47.5 KB | yes |
| assets/fonts/newsreader-latin-var.woff2 | 32.5 KB | 32.5 KB | yes |
| assets/fonts/dm-sans-latin-var.woff2 | 29.7 KB | 29.7 KB | yes |
| vendor/gsap/gsap.min.mjs | 68.9 KB | 27.1 KB |  |
| js/art.js | 18.1 KB | 6.4 KB |  |
| js/journey.js | 17.6 KB | 6.1 KB |  |
| vendor/lenis/lenis.min.mjs | 19.0 KB | 5.5 KB |  |
| js/projects.js | 12.1 KB | 4.2 KB |  |
| css/sections.css | 17.2 KB | 4.1 KB | yes |
| js/skills-board.js | 12.0 KB | 3.9 KB |  |
| css/base.css | 14.4 KB | 3.8 KB | yes |
| js/reveal.js | 9.6 KB | 3.2 KB |  |
| css/journey.css | 10.9 KB | 3.0 KB | yes |
| js/board.js | 8.8 KB | 3.0 KB |  |
| js/morph.js | 5.0 KB | 2.1 KB |  |
| js/main.js | 5.4 KB | 2.1 KB | yes |
| js/motion.js | 5.3 KB | 2.0 KB | yes |
| js/nav.js | 4.8 KB | 1.9 KB | yes |
| css/tokens.css | 5.0 KB | 1.8 KB | yes |
| js/cursor.js | 4.9 KB | 1.7 KB |  |
| js/board-svg.js | 3.9 KB | 1.7 KB |  |
| js/intro.js | 3.4 KB | 1.4 KB |  |
| js/story-state.js | 2.9 KB | 1.2 KB |  |
| js/projection.js | 2.4 KB | 1.2 KB |  |
| js/renderer.js | 2.1 KB | 1.0 KB |  |
| js/theme.js | 1.9 KB | 0.8 KB | yes |
| js/scheduler.js | 1.3 KB | 0.6 KB | yes |
| js/contact.js | 0.9 KB | 0.5 KB | yes |
| assets/favicon.svg | 0.3 KB | 0.2 KB |  |

</details>

## Mobile 390×844 (compact tier)

| Measure | Size (gz) | Budget | Result |
|---|---|---|---|
| JS excluding Three (app + Lenis + GSAP) | 73.5 KB | 250.0 KB | pass |
| Three.js subset (deferred) | 0.0 KB | 250.0 KB | pass |
| All JS including Three | 73.5 KB | — | reported |
| Initial transfer (before load: HTML, CSS, fonts, entry JS) | 130.4 KB | 600.0 KB | pass |
| Everything requested | 196.1 KB | — | reported |

<details><summary>Files</summary>

| File | Raw | Gzip | Initial |
|---|---|---|---|
| index.html | 136.5 KB | 47.5 KB | yes |
| assets/fonts/newsreader-latin-var.woff2 | 32.5 KB | 32.5 KB | yes |
| assets/fonts/dm-sans-latin-var.woff2 | 29.7 KB | 29.7 KB | yes |
| vendor/gsap/gsap.min.mjs | 68.9 KB | 27.1 KB |  |
| js/art.js | 18.1 KB | 6.4 KB |  |
| js/journey.js | 17.6 KB | 6.1 KB |  |
| vendor/lenis/lenis.min.mjs | 19.0 KB | 5.5 KB |  |
| js/projects.js | 12.1 KB | 4.2 KB |  |
| css/sections.css | 17.2 KB | 4.1 KB | yes |
| js/skills-board.js | 12.0 KB | 3.9 KB |  |
| css/base.css | 14.4 KB | 3.8 KB | yes |
| js/reveal.js | 9.6 KB | 3.2 KB |  |
| css/journey.css | 10.9 KB | 3.0 KB | yes |
| js/morph.js | 5.0 KB | 2.1 KB |  |
| js/main.js | 5.4 KB | 2.1 KB | yes |
| js/motion.js | 5.3 KB | 2.0 KB | yes |
| js/nav.js | 4.8 KB | 1.9 KB | yes |
| css/tokens.css | 5.0 KB | 1.8 KB | yes |
| js/cursor.js | 4.9 KB | 1.7 KB |  |
| js/board-svg.js | 3.9 KB | 1.7 KB |  |
| js/intro.js | 3.4 KB | 1.4 KB |  |
| js/story-state.js | 2.9 KB | 1.2 KB |  |
| js/projection.js | 2.4 KB | 1.2 KB |  |
| js/theme.js | 1.9 KB | 0.8 KB | yes |
| js/scheduler.js | 1.3 KB | 0.6 KB | yes |
| js/contact.js | 0.9 KB | 0.5 KB | yes |
| assets/favicon.svg | 0.3 KB | 0.2 KB |  |

</details>
