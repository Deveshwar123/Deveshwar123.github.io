// Illustrative NFC board in Three.js: shared geometry, materials and absolute
// transforms. It has no animation loop of its own; the story (or the NFC panel)
// calls render() from the page scheduler. Lines use the screen-space wide-line
// addon so copper keeps the SVG's 1.25px weight.

import { boardGeometry, BOARD } from './art.js';
import { makeCamera, FOV_DEG, layerZ } from './projection.js';
import { getRenderer, claim, release } from './renderer.js';

function cssColor(name) {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  let m = /^#([0-9a-f]{6})$/i.exec(raw);
  if (m) return { hex: parseInt(m[1], 16), a: 1 };
  m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)\s*(?:[,/]\s*([\d.]+))?\s*\)$/.exec(raw);
  if (m) return { hex: (+m[1] << 16) | (+m[2] << 8) | +m[3], a: m[4] === undefined ? 1 : +m[4] };
  return { hex: 0xc98a4b, a: 1 };
}

const toLocal = ([x, y]) => [x - BOARD.CX, BOARD.CY - y];

function segments(lines) {
  const out = [];
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const [ax, ay] = toLocal(line[i - 1]);
      const [bx, by] = toLocal(line[i]);
      out.push(ax, ay, 0, bx, by, 0);
    }
  }
  return out;
}

const ring = ([x, y], r, n = 16) => Array.from({ length: n + 1 }, (_, i) => [x + r * Math.cos((i / n) * Math.PI * 2), y + r * Math.sin((i / n) * Math.PI * 2)]);

// Build the board object: four layer groups plus chip and LED meshes.
export function createBoardObject(THREE) {
  const B = boardGeometry();
  const tc = B.topCopper;
  const root = new THREE.Group();
  const layers = [0, 1, 2, 3].map(() => new THREE.Group());
  layers.forEach((g) => root.add(g));
  const lineMats = [];
  const disposables = [];

  const lineSet = (lines, token, alpha = 1) => {
    const geo = new THREE.LineSegmentsGeometry();
    geo.setPositions(segments(lines));
    const mat = new THREE.LineMaterial({ linewidth: 1.25, transparent: true, depthWrite: false });
    mat.userData = { token, alpha };
    lineMats.push(mat);
    disposables.push(geo, mat);
    return new THREE.LineSegments2(geo, mat);
  };

  // Silkscreen
  layers[0].add(lineSet([B.outline, ...B.silkscreen], '--line-silk'));
  // Top copper: antenna spiral, bus traces, feeds, pads and vias
  const chipRect = [[B.chip.x, B.chip.y], [B.chip.x + B.chip.w, B.chip.y], [B.chip.x + B.chip.w, B.chip.y + B.chip.h], [B.chip.x, B.chip.y + B.chip.h], [B.chip.x, B.chip.y]];
  layers[1].add(lineSet([...B.antenna, ...B.busTraces.map((t) => t.pts), ...tc.feeds, ...tc.pinStubs, ...tc.ledTraces, ...tc.ledPads], '--copper'));
  layers[1].add(lineSet([...B.vias.map((v) => ring(v, 8)), ...B.pads.map(([x, y]) => [[x - 12, y - 10], [x + 12, y - 10], [x + 12, y + 10], [x - 12, y + 10], [x - 12, y - 10]]), chipRect], '--gold'));
  // Substrate: rounded FR-4 slab
  const shape = new THREE.Shape();
  const o = B.outline.map(toLocal);
  shape.moveTo(o[0][0], o[0][1]);
  for (let i = 1; i < o.length; i++) shape.lineTo(o[i][0], o[i][1]);
  const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: 20, bevelEnabled: false, curveSegments: 4 });
  slabGeo.translate(0, 0, -10);
  const slabMat = new THREE.MeshLambertMaterial({ transparent: false });
  slabMat.userData = { token: '--board-fill' };
  disposables.push(slabGeo, slabMat);
  layers[2].add(new THREE.Mesh(slabGeo, slabMat));
  layers[2].add(lineSet([B.outline], '--line-board'));
  // Bottom copper: ground hatch and the antenna bridge
  layers[3].add(lineSet([B.outline, ...B.bottomCopper, B.bridge], '--copper', 0.55));

  // Chip and LED bodies sit on the top copper layer.
  const box = (w, h, d) => { const g = new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-w / 2, -h / 2), new THREE.Vector2(w / 2, -h / 2), new THREE.Vector2(w / 2, h / 2), new THREE.Vector2(-w / 2, h / 2)]), { depth: d, bevelEnabled: false }); disposables.push(g); return g; };
  const chipMat = new THREE.MeshLambertMaterial({ color: 0x0d0f12 });
  const chip = new THREE.Mesh(box(B.chip.w - 8, B.chip.h - 8, 8), chipMat);
  chip.position.set(B.chip.x + B.chip.w / 2 - BOARD.CX, BOARD.CY - (B.chip.y + B.chip.h / 2), 0);
  const ledMat = new THREE.MeshLambertMaterial({ color: 0x3a1208, emissive: 0xff5a2a, emissiveIntensity: 0 });
  const led = new THREE.Mesh(box(B.led.w - 8, B.led.h - 6, 8), ledMat);
  led.position.set(B.led.x - BOARD.CX, BOARD.CY - B.led.y, 0);
  disposables.push(chipMat, ledMat);
  layers[1].add(chip, led);

  const lightA = new THREE.AmbientLight(0xffffff, 1.6);
  const lightD = new THREE.DirectionalLight(0xffffff, 1.4);
  lightD.position.set(-0.4, 0.6, 1);
  root.add(lightA, lightD);

  function recolor() {
    for (const m of lineMats) {
      const c = cssColor(m.userData.token);
      m.color.setHex(c.hex);
      m.opacity = c.a * m.userData.alpha;
    }
    slabMat.color.setHex(cssColor('--board-fill').hex);
  }
  recolor();

  return {
    root,
    layers,
    setExplode(explode) { layers.forEach((g, i) => { g.position.z = layerZ(i, explode); }); },
    setLed(v) { ledMat.emissiveIntensity = v * 2.2; },
    setResolution(w, h) { for (const m of lineMats) m.resolution.set(w, h); },
    recolor,
    dispose() { disposables.forEach((d) => d.dispose()); },
  };
}

// Story adapter: owns the stage canvas while the visitor is inside the track.
export async function createBoardView({ stage, onLost }) {
  const R = await getRenderer();
  if (!R) throw new Error('WebGL unavailable');
  const { THREE, renderer, canvas } = R;
  const scene = new THREE.Scene();
  const board = createBoardObject(THREE);
  scene.add(board.root);
  const camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 1, 10000);
  const owner = {
    onLost() { canvas.style.opacity = '0'; onLost(); },
    onRelease() { canvas.style.opacity = '0'; },
  };
  let parked = false;
  let size = { vw: 1, vh: 1 };
  claim(owner, stage);

  return {
    resize(vw, vh, ppu) {
      size = { vw, vh };
      const cam = makeCamera(vw, vh, ppu);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(vw, vh, false);
      camera.aspect = vw / vh;
      camera.near = cam.D / 20;
      camera.far = cam.D * 4;
      camera.position.set(0, 0, cam.D);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      board.setResolution(vw, vh);
    },
    render(s) {
      if (parked || R.lost) return;
      canvas.style.opacity = String(s.glOpacity);
      if (s.glOpacity <= 0) return;
      board.root.rotation.set(s.pose.pitch, s.pose.yaw, 0, 'XYZ');
      board.root.position.set(s.pose.tx, s.pose.ty, 0);
      board.setExplode(s.explode);
      board.setLed(s.led);
      renderer.render(scene, camera);
    },
    park() { parked = true; release(owner); },
    unpark() { parked = false; claim(owner, stage); },
    recolor() { board.recolor(); },
    get size() { return size; },
    get info() { return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }; },
    dispose() { release(owner); board.dispose(); },
  };
}
