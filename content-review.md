# Content review (internal)

Status of every factual claim the site shows. This file is not deployed (see the deploy allowlist in the README).
Statuses: **supplied** (from the owner's build prompt, Appendix A), **externally corroborated** (checked against a public source on the date shown), **owner-confirmation-needed**, **unavailable**.

Research validates technology behaviour, not personal achievements. No personal-data enrichment was done to fill gaps.

## Decisions taken by the owner (29 Oct 2026)

| # | Decision | Effect |
|---|---|---|
| D1 | Major is **Computer Engineering** (minor Computer Science) | Enforced by the validator; "Electrical/Data Engineering" are exclusion patterns |
| D2 | Finance bullet: "go with what makes sense" | Display text uses **~9.4% annualized**; the supplied ~9.5% is kept as `sourceText` with the reason in `revision` |
| D3 | "3 shipped projects" = TideCast, Vedam and the NFC Business Card | Recorded as the snapshot's `basis` |
| D4 | NFC card drawn "to whatever looks good" | Board uses the fabricated card's real 3.5 × 2 in proportions (88.9 × 50.8 mm) instead of the spec's 85.6 × 54; still labelled an illustration |
| D5 | Public NFC hardware repository linked as "Hardware files" | `codeUrl` for the NFC card (owner's own public repo with Gerbers, BOM, v1.0 release) |
| D6 | Résumé PDF supplied (29 Oct): "its good" | The site serves a web copy of the owner's PDF with the phone number and the excluded program removed and its metadata cleared; `assets.resumePdf.approved` is `true`, so header, hero and contact link it |
| D7 | Build all ten phases without stopping for review; publish later | All phases built and verified locally (`reports/verification.md`) |
| D8 | "Make everything hyper-realistic" (29 Oct): keep the jali line-art story; the card becomes a photoreal model of the real board; add photos for projects and hobbies; objects and scenes only, no people | 3D card rendered from `hardware/gerbers/` (geometry + PBR maps); real screenshots of TideCast and Vedam in CSS device frames; five credited Wikimedia Commons photos. Supersedes the spec's "no photos/stock imagery" rule by owner decision |
| D9 | Hero redesign (29 Oct): "shouldn't be too India, make it a neutral theme"; show Computer Engineering, CS and Finance, not just the PCB | Neutral graphite / off-white with copper; jali hero, maroon and cream removed; the closing jali above Contact replaced by the card's real copper; the arch glyph for RHA replaced by a residence-hall glyph |
| D10 | "For my Projects you can add whatever else is in my github" (29 Oct) | "More on GitHub": Strategy Terminal, Resume Tailor, Insider Tracker, Swim Lessons (public repos only, each restating its README) |
| D11 | Bull-and-bear artwork: "licencing allows it" (29 Oct) | The owner confirmed the rights to the back-side engraving; it ships on the 3D card |
| D12 | "publish" (29 Oct) | `meta.deployApproved` is `true`; published to https://deveshwar123.github.io/ from the `Deveshwar123.github.io` repository |

## Claims

| Claim | Where | Status | Notes |
|---|---|---|---|
| Name, email, LinkedIn, GitHub | hero, contact, JSON-LD | supplied | LinkedIn/GitHub normalised to `https://` without changing the destination |
| B.S. Computer Engineering, Minor in Computer Science, Texas A&M, Expected May 2030 | hero, snapshot | supplied | "Expected" wording kept; dates are not auto-advanced |
| GPA 4.0/4.0, Business of Technology Certificate, University Honors Program | hero, snapshot | supplied | |
| VantaShala.com internship and its three bullets | experience | supplied | |
| Quantitative Finance Research role and bullets | experience | supplied | Backtest arithmetic: 6^(1/20) − 1 ≈ 9.37%/yr; 4.89^(1/20) − 1 ≈ 8.26%/yr. Arithmetic check only, not a verification of the backtest (D2) |
| Radicubs Robotics role and bullets | experience | supplied | |
| TideCast role, date, bullets | projects | supplied | Model download sizes in the repository README were not executed or benchmarked |
| TideCast live URL `…/backbone/` and code URL | projects | externally corroborated (29 Oct 2026) | Route `/` → `/backbone/` matches the deployed app; the free Render service may sleep, which is not a reason to remove it |
| Vedam role, date, bullet, live URL | projects | supplied | wearvedam.com returned HTTP 200 during research |
| NFC Business Card role, date, bullets | projects | supplied | The 3D card is generated from the owner's fabrication files (Gerbers + BOM: NT3H2111, KT-0805Y LED, 47 Ω, 220 nF, 25 × 48 mm antenna) and is described as such on the page |
| NFC hardware repository link | projects | externally corroborated (29 Oct 2026) | D5 |
| Six leadership/activity entries | leadership | supplied | "Selected Participant" wording preserved |
| Skills, certifications, interests | skills, beyond | supplied | "training" preserved for Ironman; no completion implied |
| Skill → role/project links | skills | supplied | Each edge cites a résumé line that names the skill (validator-enforced); Git/GitHub, Three.js, Bloomberg and CAD stay unlinked |
| Snapshot: 4.0 GPA · 3 shipped projects · 120+ tutoring hours · 20 yrs backtested | snapshot | supplied | D3 |
| Résumé PDF | header, hero, contact | supplied | D6; `assets/Deveshwar_Vankeswaram_Resume.pdf`. Checked 29 Oct 2026: says Computer Engineering; no phone number, street address, high school or excluded program in its text or metadata (text extracted and run through the private exclusion list) |
| Social preview image | metadata | supplied derivative | `assets/social-card.png`, built by `scripts/build-social.mjs` from a photoreal render of the real NFC card; shows only "Portfolio", the name and "Computer Engineering · Texas A&M University" (re-checked 29 Oct 2026 after the hero redesign) |
| More on GitHub: Strategy Terminal, Resume Tailor, Insider Tracker, Swim Lessons (summaries, points, stack chips, pictures) | projects | externally corroborated (29 Oct 2026) | Each sentence restates the owner's own public README at a pinned commit and cites verbatim phrases (test-enforced against `tests/fixtures/github/`); chips are named in the README or GitHub's language stats ("TypeScript" for Insider Tracker comes from the language stats). Pictures are the repos' own screenshots or verbatim README lines. Resume Tailor's `docs/sample-resume.png` (a fictional "Acme Corp" résumé) is deliberately not used. Not counted in "3 shipped projects" (D3) |

## Open

- Résumé PDF: a replacement must say Computer Engineering and omit phone, street address, high school and the excluded program, including in PDF metadata. The build's exclusion scan reads text files only, so extract the PDF's text and scan it before replacing the file.
- Swim Lessons link (owner-confirmation-needed before publishing): the live Swim page shows the owner's phone number. The portfolio itself never shows it. The card is kept for now because the same page is already one click from the portfolio's GitHub link (Swim is pinned on the profile), so the card adds no new exposure. To leave it off, remove the `swim` item from `data/github-projects.json` and regenerate.

## Realism pass (29 Oct 2026)

- Project screenshots are captured by `scripts/capture-projects.mjs` from the live sites. They show the sites as they looked on capture day; re-run it after redesigns. The TideCast capture shows the live landing page's "top catch" teaser; the leaderboard user's name in it is blurred (29 Oct 2026, in the committed image and by `capture-projects.mjs` for future captures).
- The back-side bull-and-bear artwork comes from the owner's board files; the owner confirmed the rights to it on 29 Oct 2026 (D11).
