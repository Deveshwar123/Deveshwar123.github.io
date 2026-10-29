// Maintenance script: produces the committed, pinned runtime bundles in vendor/.
// Serving the site never runs this; it only needs to be re-run when a pin changes.
// Usage: node scripts/build-vendor.mjs
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const today = new Date().toISOString().slice(0, 10);

// Only the Three.js classes the photoreal card uses. Core and the RoomEnvironment
// addon come from the same pinned package, so their versions always match.
const THREE_EXPORTS = [
  'WebGLRenderer', 'Scene', 'PerspectiveCamera', 'Group', 'Mesh', 'Object3D',
  'MeshBasicMaterial', 'MeshStandardMaterial', 'MeshPhysicalMaterial',
  'AmbientLight', 'DirectionalLight', 'PointLight', 'PMREMGenerator',
  'Shape', 'ShapeGeometry', 'ExtrudeGeometry', 'BoxGeometry', 'PlaneGeometry',
  'BufferGeometry', 'Float32BufferAttribute', 'Color', 'Vector2', 'Vector3', 'MathUtils',
  'TextureLoader', 'CanvasTexture', 'SRGBColorSpace', 'NoColorSpace', 'ACESFilmicToneMapping',
  'DoubleSide', 'FrontSide', 'BackSide',
];

const targets = [
  {
    name: 'three',
    out: 'vendor/three/three-board.min.js',
    contents:
      `export { ${THREE_EXPORTS.join(', ')} } from 'three';\n` +
      `export { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';\n`,
    license: 'node_modules/three/LICENSE',
    licenseName: 'MIT',
    homepage: 'https://github.com/mrdoob/three.js',
  },
  {
    name: 'lenis',
    out: 'vendor/lenis/lenis.min.mjs',
    contents: `export { default } from 'lenis';\n`,
    license: 'node_modules/lenis/LICENSE',
    licenseName: 'MIT',
    homepage: 'https://github.com/darkroomengineering/lenis',
  },
  {
    name: 'gsap',
    out: 'vendor/gsap/gsap.min.mjs',
    contents: `export { gsap, default } from 'gsap';\n`,
    license: null,
    licenseName: "GSAP Standard 'no charge' License (https://gsap.com/standard-license)",
    homepage: 'https://gsap.com',
  },
];

const manifest = { generated: today, note: 'Tree-shaken, minified ESM bundles of the pinned npm releases below. Rebuild with `npm run vendor`.', packages: [] };

for (const t of targets) {
  const outPath = join(root, t.out);
  mkdirSync(dirname(outPath), { recursive: true });
  await build({
    stdin: { contents: t.contents, resolveDir: root, sourcefile: `${t.name}-entry.js` },
    bundle: true, format: 'esm', minify: true, legalComments: 'inline',
    target: ['es2020'], outfile: outPath, logLevel: 'warning',
  });
  const buf = readFileSync(outPath);
  if (t.license) copyFileSync(join(root, t.license), join(dirname(outPath), 'LICENSE'));
  const pkg = lock.packages[`node_modules/${t.name}`];
  manifest.packages.push({
    name: t.name,
    version: pkg.version,
    upstream: pkg.resolved,
    upstreamIntegrity: pkg.integrity,
    homepage: t.homepage,
    license: t.licenseName,
    retrieved: today,
    file: t.out,
    sha256: createHash('sha256').update(buf).digest('hex'),
    bytes: buf.length,
    gzipBytes: gzipSync(buf, { level: 9 }).length,
  });
}

writeFileSync(join(root, 'vendor/manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
for (const p of manifest.packages) console.log(`${p.name}@${p.version}: ${p.bytes} B, ${p.gzipBytes} B gzip`);
