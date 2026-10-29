# Byte budget

Measured 2026-10-29 from the files a real Chrome load requests (gzip -9 per file; WOFF2/PNG counted as-is).

## Desktop 1440×900 (full tier)

| Measure | Size (gz) | Budget | Result |
|---|---|---|---|
| JS excluding Three (app + Lenis + GSAP) | 80.3 KB | 250.0 KB | pass |
| Three.js subset (deferred) | 144.0 KB | 250.0 KB | pass |
| All JS including Three | 224.3 KB | — | reported |
| Initial transfer (before load: HTML, CSS, fonts, entry JS) | 157.0 KB | 600.0 KB | pass |
| Everything requested | 1190.8 KB | — | reported |

<details><summary>Files</summary>

| File | Raw | Gzip | Initial |
|---|---|---|---|
| assets/board/bottom-color-hi.webp | 206.6 KB | 204.7 KB |  |
| vendor/three/three-board.min.js | 565.4 KB | 144.0 KB |  |
| assets/projects/vedam-desktop.webp | 110.9 KB | 110.8 KB |  |
| assets/photos/campus-1600.webp | 106.0 KB | 105.9 KB |  |
| assets/board/bottom-orm-lo.webp | 74.5 KB | 74.1 KB |  |
| assets/photos/ironman-420.webp | 53.5 KB | 53.4 KB |  |
| assets/photos/cooking-420.webp | 50.5 KB | 50.4 KB |  |
| assets/photos/viola-420.webp | 43.4 KB | 43.3 KB |  |
| assets/board/card-front.webp | 38.5 KB | 37.4 KB | yes |
| assets/projects/vedam-phone.webp | 36.7 KB | 36.6 KB |  |
| assets/projects/tidecast-desktop.webp | 36.7 KB | 36.5 KB |  |
| index.html | 107.2 KB | 35.7 KB | yes |
| assets/fonts/newsreader-latin-var.woff2 | 32.5 KB | 32.5 KB | yes |
| assets/fonts/dm-sans-latin-var.woff2 | 29.7 KB | 29.7 KB | yes |
| vendor/gsap/gsap.min.mjs | 68.9 KB | 27.1 KB |  |
| assets/projects/tidecast-phone.webp | 26.6 KB | 26.4 KB |  |
| assets/board/top-silk-hi.webp | 23.7 KB | 19.7 KB |  |
| assets/photos/chess-420.webp | 17.0 KB | 16.9 KB |  |
| assets/board/top-height-hi.webp | 16.2 KB | 12.5 KB |  |
| assets/board/top-ormNoSilk-hi.webp | 13.9 KB | 9.9 KB |  |
| assets/board/top-silk-lo.webp | 10.0 KB | 8.9 KB |  |
| assets/board/top-colorNoSilk-hi.webp | 11.1 KB | 7.1 KB |  |
| js/journey.js | 18.2 KB | 6.3 KB |  |
| vendor/lenis/lenis.min.mjs | 19.0 KB | 5.5 KB |  |
| css/sections.css | 21.4 KB | 5.0 KB | yes |
| js/art.js | 13.6 KB | 4.9 KB |  |
| js/projects.js | 11.7 KB | 4.1 KB |  |
| js/skills-board.js | 12.0 KB | 3.9 KB |  |
| css/base.css | 14.4 KB | 3.8 KB | yes |
| js/board-data.js | 10.6 KB | 3.7 KB |  |
| js/board.js | 10.1 KB | 3.5 KB |  |
| js/reveal.js | 9.6 KB | 3.2 KB |  |
| css/journey.css | 11.1 KB | 3.1 KB | yes |
| js/morph.js | 5.3 KB | 2.2 KB |  |
| js/main.js | 5.4 KB | 2.1 KB | yes |
| js/motion.js | 5.3 KB | 2.0 KB | yes |
| js/nav.js | 4.8 KB | 1.9 KB | yes |
| css/tokens.css | 5.1 KB | 1.8 KB | yes |
| js/cursor.js | 4.9 KB | 1.7 KB |  |
| js/board-svg.js | 3.8 KB | 1.6 KB |  |
| js/intro.js | 3.4 KB | 1.4 KB |  |
| js/story-state.js | 3.1 KB | 1.3 KB |  |
| js/projection.js | 2.5 KB | 1.2 KB |  |
| js/renderer.js | 2.1 KB | 1.0 KB |  |
| js/theme.js | 1.9 KB | 0.8 KB | yes |
| js/scheduler.js | 1.3 KB | 0.6 KB | yes |
| js/contact.js | 0.9 KB | 0.5 KB | yes |
| assets/favicon.svg | 0.3 KB | 0.2 KB |  |

</details>

## Mobile 390×844 (compact tier)

| Measure | Size (gz) | Budget | Result |
|---|---|---|---|
| JS excluding Three (app + Lenis + GSAP) | 80.3 KB | 250.0 KB | pass |
| Three.js subset (deferred) | 144.0 KB | 250.0 KB | pass |
| All JS including Three | 224.3 KB | — | reported |
| Initial transfer (before load: HTML, CSS, fonts, entry JS) | 195.9 KB | 600.0 KB | pass |
| Everything requested | 1013.1 KB | — | reported |

<details><summary>Files</summary>

| File | Raw | Gzip | Initial |
|---|---|---|---|
| vendor/three/three-board.min.js | 565.4 KB | 144.0 KB |  |
| assets/projects/vedam-desktop.webp | 110.9 KB | 110.8 KB |  |
| assets/board/bottom-color-lo.webp | 87.3 KB | 87.0 KB |  |
| assets/board/bottom-orm-lo.webp | 74.5 KB | 74.1 KB |  |
| assets/photos/ironman-420.webp | 53.5 KB | 53.4 KB |  |
| assets/photos/cooking-420.webp | 50.5 KB | 50.4 KB |  |
| assets/photos/viola-420.webp | 43.4 KB | 43.3 KB |  |
| assets/board/card-exploded.webp | 40.8 KB | 38.9 KB | yes |
| assets/board/card-front.webp | 38.5 KB | 37.4 KB | yes |
| assets/projects/vedam-phone.webp | 36.7 KB | 36.6 KB |  |
| assets/projects/tidecast-desktop.webp | 36.7 KB | 36.5 KB |  |
| index.html | 107.2 KB | 35.7 KB | yes |
| assets/photos/campus-800.webp | 35.4 KB | 35.3 KB |  |
| assets/fonts/newsreader-latin-var.woff2 | 32.5 KB | 32.5 KB | yes |
| assets/fonts/dm-sans-latin-var.woff2 | 29.7 KB | 29.7 KB | yes |
| vendor/gsap/gsap.min.mjs | 68.9 KB | 27.1 KB |  |
| assets/projects/tidecast-phone.webp | 26.6 KB | 26.4 KB |  |
| assets/photos/chess-420.webp | 17.0 KB | 16.9 KB |  |
| assets/board/top-height-hi.webp | 16.2 KB | 12.5 KB |  |
| assets/board/top-silk-lo.webp | 10.0 KB | 8.9 KB |  |
| js/journey.js | 18.2 KB | 6.3 KB |  |
| vendor/lenis/lenis.min.mjs | 19.0 KB | 5.5 KB |  |
| css/sections.css | 21.4 KB | 5.0 KB | yes |
| assets/board/top-ormNoSilk-lo.webp | 5.8 KB | 4.9 KB |  |
| js/art.js | 13.6 KB | 4.9 KB |  |
| js/projects.js | 11.7 KB | 4.1 KB |  |
| js/skills-board.js | 12.0 KB | 3.9 KB |  |
| css/base.css | 14.4 KB | 3.8 KB | yes |
| js/board-data.js | 10.6 KB | 3.7 KB |  |
| assets/board/top-colorNoSilk-lo.webp | 4.3 KB | 3.6 KB |  |
| js/board.js | 10.1 KB | 3.5 KB |  |
| js/reveal.js | 9.6 KB | 3.2 KB |  |
| css/journey.css | 11.1 KB | 3.1 KB | yes |
| js/morph.js | 5.3 KB | 2.2 KB |  |
| js/main.js | 5.4 KB | 2.1 KB | yes |
| js/motion.js | 5.3 KB | 2.0 KB | yes |
| js/nav.js | 4.8 KB | 1.9 KB | yes |
| css/tokens.css | 5.1 KB | 1.8 KB | yes |
| js/cursor.js | 4.9 KB | 1.7 KB |  |
| js/board-svg.js | 3.8 KB | 1.6 KB |  |
| js/intro.js | 3.4 KB | 1.4 KB |  |
| js/story-state.js | 3.1 KB | 1.3 KB |  |
| js/projection.js | 2.5 KB | 1.2 KB |  |
| js/renderer.js | 2.1 KB | 1.0 KB |  |
| js/theme.js | 1.9 KB | 0.8 KB | yes |
| js/scheduler.js | 1.3 KB | 0.6 KB | yes |
| js/contact.js | 0.9 KB | 0.5 KB | yes |
| assets/favicon.svg | 0.3 KB | 0.2 KB |  |

</details>
