# Portfolio BUGS

Tickets opened and closed against the portfolio (`~/Desktop/Projects/portfolio`). The repo has no GitHub remote yet, so tickets live here. Newest first.

---

## PF-3 — Opening a story beat by link could land up to 230 px past it · CLOSED 2026-10-29

**Fixed in** `c202266`.

**Opened.** 2026-10-29, while checking the published site. Severity: low (deep links into the story only; the in-page chapter links were fine). Opening `https://deveshwar123.github.io/#story-whole` on a phone sometimes landed at the end of the story, with no caption showing.

**Repro.** Load `/#story-whole` at 390 × 844 in fresh browser contexts against the live site. Measure `scrollY` minus the beat's top after 2.5 s: 170, 20, 58, 231, 13 and 7 px over six loads.

**Root cause.** Two systems corrected the same late layout change. Lenis made a single, correct jump to the beat (traced: one `scrollTo`, to the right y). When layout then shifted, the story kept the visitor's place itself (it re-anchors to the same progress), and the browser's CSS scroll anchoring adjusted `scrollY` again. How far depended on network timing, so the overshoot varied.

**Fix.** `overflow-anchor: none` on the page while the scroll story runs (`html[data-tier]`, full and compact). The reduced-motion and no-JS page keeps the browser's anchoring.

**Verification.**

| Check | Before | After |
|---|---|---|
| Six cold live loads of `/#story-whole` at 390 × 844 | overshoot 7–231 px | 13–20 px with anchoring off |
| New `arriving on a story beat by hash stays on it` (Chrome + WebKit) | fails | passes |
| `story.spec.mjs` | — | 26 / 26 |

---

## PF-2 — Header labels broke mid-word between 600 and 860 px · CLOSED 2026-10-29

**Fixed in** `60417e3`.

**Opened.** 2026-10-29, while checking the live site after publication. Severity: medium (first thing a tablet visitor sees). At 768 px the header read "Wo / rk", "Project / s", "Résumé / ↓", "Pause / motion".

**Repro.** Open the page at any width from 600 to 859 px (with JavaScript) or below 768 px (without). Count the text lines in each header label: all of them wrap.

**Root cause.** `css/base.css` sets `overflow-wrap: anywhere` on every `a` and `span`, so a header label's minimum width is one letter. The header row (name, four links, tools) needs about 770 px but stayed a single flex row down to 600 px, where the links collapse behind Menu, so flex shrinking split the labels mid-word. Present since phase 2 for 600–819 px; the new header Résumé link widened it to 600–859 px.

**Fix.** Header labels are `white-space: nowrap`. Below 960 px the Pause button shows only its icon, below 768 px the links collapse behind Menu (CSS and `js/nav.js` moved together from 599 px), and without JavaScript the links wrap as whole words onto a second row.

**Verification.**

| Check | Before | After |
|---|---|---|
| New `header labels stay whole and inside the header` at 320–1440 px (10 widths) | fails at 600, 680, 768, 820, 860 | passes at all 10 |
| New `header without JavaScript › labels stay whole` at 320, 600, 768 px | fails at 320 and 600 | passes, no horizontal scroll |
| Existing menu, overflow and keyboard checks | pass | pass |

---

## PF-1 — Two WebGL canvases when the story and the NFC panel start together · CLOSED 2026-10-29

**Fixed in** `d83db03`.

**Opened.** 2026-10-29, from an intermittent WebKit failure of `projects.spec.mjs › re-initialising (motion change) leaves no duplicate views or contexts` (2 of 5 runs failed with 3 parallel workers; serial runs passed). Severity: medium. The page promises one WebGL context; a second one costs GPU memory on phones and left a stale card canvas in the NFC panel.

**Repro.** Open `/#project-nfc-card` while the machine is busy (three Playwright workers). Sample `document.querySelectorAll('canvas')`: one page in four kept a canvas in `.stage` and another in the NFC view for the whole 6 s observed.

**Root cause.** `getRenderer()` in `js/renderer.js` stored its singleton only after `await import('three')`. The scroll story and the NFC panel both call it when the page opens on the NFC card; when the second call arrived during that await, it also saw no instance and created a second renderer, canvas and context. The second instance replaced the first in the module, so the first canvas was never released.

**Fix.** `getRenderer()` now shares the in-flight creation promise (`pending ??= create()`), so callers that arrive together get the same instance.

**Verification.**

| Check | Before | After |
|---|---|---|
| `re-initialising …` (`--repeat-each`, 3 workers) | WebKit: 2 of 5 and 3 of 9 failed (`canvas` count 2) | Chrome + WebKit: 16 of 16 pass |
| Canvas sampler, 4 pages in parallel | 1 of 4 pages had `stage+world-art` | 4 of 4 have only `stage` |
| New `callers that arrive together share one renderer and one canvas` | fails on the old `renderer.js` (`Expected: true, Received: false`) | passes |
