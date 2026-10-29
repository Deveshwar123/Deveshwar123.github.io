# Lighthouse (lab)

Lighthouse 13.5.0, Google Chrome 156.0.8078.73, headless, three cold runs per profile against `node scripts/serve.mjs --prod` (gzip, 10-minute cache) on an Apple M1 Pro (macOS 27.0.1, mains power). 2026-10-29. Lab results are not field data.

## Desktop (preset=desktop: 1350×940, no CPU throttling, 40ms RTT)

| Metric | Median | Range | Target |
|---|---|---|---|
| Performance | 100 | 100 – 100 | meets target |
| Accessibility | 100 | 100 – 100 | meets target |
| Best Practices | 100 | 100 – 100 | meets target |
| SEO | 100 | 100 – 100 | meets target |
| LCP | 0.44 s | 0.44 s – 0.45 s | meets target |
| CLS | 0.000 | 0.000 – 0.000 | meets target |
| TBT | 0 ms | 0 ms – 0 ms | meets target |
| FCP | 0.33 s | 0.33 s – 0.33 s | meets target |

Audits below 0.9 in any run: unminified-javascript, unused-javascript, cache-insight, image-delivery-insight, network-dependency-tree-insight, render-blocking-insight

## Mobile (default: Moto G Power emulation, 4× CPU slowdown, simulated slow 4G)

| Metric | Median | Range | Target |
|---|---|---|---|
| Performance | 99 | 99 – 99 | meets target |
| Accessibility | 100 | 100 – 100 | meets target |
| Best Practices | 100 | 100 – 100 | meets target |
| SEO | 100 | 100 – 100 | meets target |
| LCP | 1.95 s | 1.95 s – 1.95 s | meets target |
| CLS | 0.000 | 0.000 – 0.000 | meets target |
| TBT | 0 ms | 0 ms – 0 ms | meets target |
| FCP | 1.22 s | 1.22 s – 1.22 s | meets target |

Audits below 0.9 in any run: unminified-javascript, unused-javascript, cache-insight, image-delivery-insight, network-dependency-tree-insight, render-blocking-insight
