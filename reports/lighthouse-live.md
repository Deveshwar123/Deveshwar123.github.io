# Lighthouse (lab, live site)

Lighthouse 13.5.0, Google Chrome 156.0.8078.73, headless, three cold runs per profile against the live site, https://deveshwar123.github.io/ (GitHub Pages), on an Apple M1 Pro (macOS 27.0.1, mains power). 2026-10-29 (US Central). Lab results are not field data.

## Desktop (preset=desktop: 1350×940, no CPU throttling, 40ms RTT)

| Metric | Median | Range | Target |
|---|---|---|---|
| Performance | 100 | 100 – 100 | meets target |
| Accessibility | 100 | 100 – 100 | meets target |
| Best Practices | 100 | 100 – 100 | meets target |
| SEO | 100 | 100 – 100 | meets target |
| LCP | 0.33 s | 0.33 s – 0.33 s | meets target |
| CLS | 0.000 | 0.000 – 0.000 | meets target |
| TBT | 0 ms | 0 ms – 0 ms | meets target |
| FCP | 0.27 s | 0.26 s – 0.27 s | meets target |

Audits below 0.9 in any run: unminified-javascript, unused-javascript, cache-insight, image-delivery-insight, network-dependency-tree-insight, render-blocking-insight

## Mobile (default: Moto G Power emulation, 4× CPU slowdown, simulated slow 4G)

| Metric | Median | Range | Target |
|---|---|---|---|
| Performance | 97 | 97 – 100 | meets target |
| Accessibility | 100 | 100 – 100 | meets target |
| Best Practices | 100 | 100 – 100 | meets target |
| SEO | 100 | 100 – 100 | meets target |
| LCP | 1.95 s | 1.35 s – 1.98 s | meets target |
| CLS | 0.000 | 0.000 – 0.000 | meets target |
| TBT | 4 ms | 0 ms – 15 ms | meets target |
| FCP | 1.12 s | 1.02 s – 1.15 s | meets target |

Audits below 0.9 in any run: speed-index, unminified-javascript, cache-insight, image-delivery-insight, network-dependency-tree-insight, render-blocking-insight, unused-javascript
