// Lab measurement: pinned Lighthouse (package.json), three cold runs per
// profile against the --prod preview server (gzip, 10-minute cache). Writes
// reports/lighthouse.md with median and range; raw JSON in reports/lighthouse/.
// Usage: node scripts/serve.mjs 8090 --prod & node scripts/run-lighthouse.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.URL || 'http://127.0.0.1:8090/';
const version = JSON.parse(readFileSync(join(root, 'node_modules/lighthouse/package.json'), 'utf8')).version;
const chromeVersion = execFileSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--version']).toString().trim();
mkdirSync(join(root, 'reports/lighthouse'), { recursive: true });
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const lines = ['# Lighthouse (lab)', '', `Lighthouse ${version}, ${chromeVersion}, headless, three cold runs per profile against \`node scripts/serve.mjs --prod\` (gzip, 10-minute cache) on an Apple M1 Pro (macOS ${execFileSync('sw_vers', ['-productVersion']).toString().trim()}, mains power). ${new Date().toISOString().slice(0, 10)}. Lab results are not field data.`, ''];
let failures = 0;
for (const [name, args] of [['Desktop (preset=desktop: 1350×940, no CPU throttling, 40ms RTT)', ['--preset=desktop']], ['Mobile (default: Moto G Power emulation, 4× CPU slowdown, simulated slow 4G)', []]]) {
  const runs = [];
  for (let i = 0; i < 3; i++) {
    const out = join(root, `reports/lighthouse/${args.length ? 'desktop' : 'mobile'}-${i + 1}.json`);
    execFileSync(join(root, 'node_modules/.bin/lighthouse'), [url, ...args, '--quiet', '--output=json', `--output-path=${out}`, '--chrome-flags=--headless=new --no-first-run', '--only-categories=performance,accessibility,best-practices,seo'], { stdio: 'pipe' });
    const r = JSON.parse(readFileSync(out, 'utf8'));
    runs.push({
      perf: r.categories.performance.score * 100, a11y: r.categories.accessibility.score * 100,
      bp: r.categories['best-practices'].score * 100, seo: r.categories.seo.score * 100,
      lcp: r.audits['largest-contentful-paint'].numericValue, cls: r.audits['cumulative-layout-shift'].numericValue,
      tbt: r.audits['total-blocking-time'].numericValue, fcp: r.audits['first-contentful-paint'].numericValue,
      failed: Object.values(r.audits).filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== 'informative' && a.scoreDisplayMode !== 'notApplicable').map((a) => a.id),
    });
  }
  const row = (label, key, fmt, target) => {
    const vals = runs.map((r) => r[key]);
    const m = median(vals);
    const ok = target(m);
    if (!ok) failures++;
    return `| ${label} | ${fmt(m)} | ${fmt(Math.min(...vals))} – ${fmt(Math.max(...vals))} | ${ok ? 'meets target' : '**misses target**'} |`;
  };
  lines.push(`## ${name}`, '', '| Metric | Median | Range | Target |', '|---|---|---|---|',
    row('Performance', 'perf', (v) => v.toFixed(0), (v) => v >= 95),
    row('Accessibility', 'a11y', (v) => v.toFixed(0), (v) => v >= 95),
    row('Best Practices', 'bp', (v) => v.toFixed(0), (v) => v >= 95),
    row('SEO', 'seo', (v) => v.toFixed(0), (v) => v >= 95),
    row('LCP', 'lcp', (v) => `${(v / 1000).toFixed(2)} s`, (v) => v < 2000),
    row('CLS', 'cls', (v) => v.toFixed(3), (v) => v === 0),
    row('TBT', 'tbt', (v) => `${v.toFixed(0)} ms`, () => true),
    row('FCP', 'fcp', (v) => `${(v / 1000).toFixed(2)} s`, () => true),
    '', `Audits below 0.9 in any run: ${[...new Set(runs.flatMap((r) => r.failed))].join(', ') || 'none'}`, '');
}
writeFileSync(join(root, 'reports/lighthouse.md'), lines.join('\n'));
console.log(lines.join('\n'));
