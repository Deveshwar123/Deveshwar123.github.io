# Content review (internal)

Status of every factual claim the site shows. Not deployed (see the deploy allowlist in the README).
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
| D6 | Résumé PDF will be supplied later | Download controls stay hidden; `assets.resumePdf.approved` is `false` |
| D7 | Build all ten phases without stopping for review; publish later | All phases built and verified locally (`reports/verification.md`); nothing published |

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
| NFC Business Card role, date, bullets | projects | supplied | Fabricated board proportions and the NT3H2111 (NTAG I²C plus) part number come from the owner's own repository; the site still labels the board an illustration |
| NFC hardware repository link | projects | externally corroborated (29 Oct 2026) | D5 |
| Six leadership/activity entries | leadership | supplied | "Selected Participant" wording preserved |
| Skills, certifications, interests | skills, beyond | supplied | "training" preserved for Ironman; no completion implied |
| Skill → role/project links | skills | supplied | Each edge cites a résumé line that names the skill (validator-enforced); Git/GitHub, Three.js, Bloomberg and CAD stay unlinked |
| Snapshot: 4.0 GPA · 3 shipped projects · 120+ tutoring hours · 20 yrs backtested | snapshot | supplied | D3 |
| Résumé PDF | header, hero, contact | unavailable | D6; reserved path `assets/Deveshwar_Vankeswaram_Resume.pdf` |
| Social preview image | metadata | supplied derivative | `assets/social-card.png`, rendered from the site's own line art by `scripts/build-social.mjs`; shows only the name, "Computer Engineering · Texas A&M University" and "Tradition → Circuit" (reviewed 29 Oct 2026) |

## Open

- Résumé PDF (D6): must say Computer Engineering and omit phone, street address, high school and the excluded program, including in PDF metadata. Run `npm run validate` and the exclusion scan on it before setting `approved: true`.
- Publication: canonical URL, `og:url` and JSON-LD `url` appear only after `meta.deployApproved` is set to `true`.
