# Portfolio BUGS

Tickets opened and closed against the portfolio (`~/Desktop/Projects/portfolio`). The repo has no GitHub remote yet, so tickets live here. Newest first.

---

## PF-5 — The hero name lost its "m" on screens 1730 px and wider · CLOSED 2026-10-29

**Fixed in** `COMMIT`.

**Opened.** 2026-10-29, reported by the owner: "the m is pushed to the next line" on the home page. Severity: high (the first thing anyone sees, on a common laptop: a 16-inch MacBook Pro is 1728 px wide by default, right at the edge).

**Repro.** Open the page at any width of 1730 px or more and look at the second line of the name: "Vankeswara / m". A scan of 320–1920 px in 10 px steps broke at every width from 1730 up.

**Root cause.** `--name-size` was `clamp(46px, 6.1vw, 108px)`. "Vankeswaram" is about 5.63 em wide (with the heading's −0.035 em tracking), so at 105 px and up it needs more than the copy column's 592 px. The global `overflow-wrap: anywhere` then split the word instead of overflowing.

**Fix.** The cap is now 100 px (563 px for the word), so it fits the column at every width.

**Verification.**

| Check | Before | After |
|---|---|---|
| New `the hero name keeps each word whole at every width from 320 to 2560 px` (40 px steps) | fails at 23 widths, 1760 px and up | passes in Chrome and WebKit |
| Screenshot at 1728 × 1117 | "Vankeswara / m" | "Vankeswaram" on one line |

---

## PF-4 — Deep links into the story still overshoot on some cold loads · OPEN 2026-10-29

**Opened.** 2026-10-29, re-measuring PF-3 on the live site after its fix. Severity: low (deep links into the story only; in-page chapter links land correctly).

**Repro.** Eight fresh loads of `https://deveshwar123.github.io/#story-whole` at 390 × 844 (headless Chrome 156), measured 2.5 s after load: 29, 29, 139, 20, 13, 20, 96 and 13 px past the beat. The beat's caption showed in 7 of 8. Locally the overshoot stays under 40 px (covered by the PF-3 test).

**Known so far.** Scroll anchoring is off (PF-3), and Lenis makes one correct jump. The remaining drift happens later and depends on network timing. Next suspects: a resize-triggered re-measure (the scrollbar appearing) re-anchoring to progress computed before the jump, and Lenis carrying momentum from the browser's own early hash scroll.

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
| Cold live loads of `/#story-whole` at 390 × 844 | overshoot 7–231 px (6 loads) | 13–29 px in 6 of 8 loads after deploying; 96 and 139 px in the other two (PF-4) |
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
