// Assembles the deployable site into _site/ from an allowlist, so tests, QA
// patterns, data files, reports and tooling are never published, then scans
// every shipped text file for excluded content.
// Usage: node scripts/build-site.mjs
import { cpSync, rmSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanExclusions, loadExclusions } from './validate-content.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, '_site');
const ALLOW = ['index.html', '.nojekyll', 'css', 'js', 'vendor', 'assets'];
const SKIP = [/^assets\/fonts\/source\//];

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const item of ALLOW) {
  cpSync(join(root, item), join(out, item), {
    recursive: true,
    filter: (src) => !SKIP.some((re) => re.test(relative(root, src))),
  });
}

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
})(out);

const patterns = loadExclusions();
const problems = [];
let bytes = 0;
for (const f of files) {
  const rel = relative(out, f);
  bytes += statSync(f).size;
  if (/(^|\/)(tests|qa|data|reports|node_modules|scripts)\//.test(rel) || /content-review|\.local\./.test(rel)) problems.push(`not allowed in the site: ${rel}`);
  if (/\.(html|css|js|mjs|json|svg|txt|md)$/.test(f)) {
    for (const hit of scanExclusions(readFileSync(f, 'utf8'), patterns)) problems.push(`${rel}: excluded "${hit.id}" → ${hit.match}`);
  }
}
if (problems.length) {
  console.error('✗ site artifact failed:\n  - ' + problems.join('\n  - '));
  process.exit(1);
}
console.log(`✓ _site/ has ${files.length} files (${(bytes / 1024).toFixed(0)} KB raw); ${patterns.length} exclusion patterns found nothing`);
