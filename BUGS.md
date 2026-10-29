# Portfolio BUGS

Tickets opened and closed against the portfolio (`~/Desktop/Projects/portfolio`). The repo has no GitHub remote yet, so tickets live here. Newest first.

---

## PF-1 — Two WebGL canvases when the story and the NFC panel start together · CLOSED 2026-10-29

**Fixed in** `530f4f5`.

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
