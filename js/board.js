// The card in Three.js, built from its real fabrication data: physically based
// materials with texture maps rendered from the Gerbers (scripts/build-board.mjs),
// image-based lighting from RoomEnvironment, the four parts from the BOM at
// their pad positions, and a real point light for the yellow LED. It has no
// animation loop of its own; the story or the NFC panel calls render().

import { boardGeometry, BOARD } from './art.js';
import { makeCamera, FOV_DEG, layerZ } from './projection.js';
import { getRenderer, claim, release } from './renderer.js';

const THICK = 20.16; // 1.6 mm in board units
const texUrl = (name, q) => `assets/board/${name}-${q}.webp`;
const toLocal = ([x, y]) => [x - BOARD.CX, BOARD.CY - y];

function outlineShape(THREE) {
  const pts = boardGeometry().outline.map(toLocal);
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  return shape;
}

// A flat face of the card with UVs spanning the board (u mirrored for the back,
// whose texture is drawn as seen from below).
function faceGeometry(THREE, shape, mirror) {
  const g = new THREE.ShapeGeometry(shape, 4);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const u = (pos.getX(i) + BOARD.CX) / BOARD.W;
    uv.setXY(i, mirror ? 1 - u : u, (pos.getY(i) + BOARD.CY) / BOARD.H);
  }
  return g;
}

// Environment lighting is generated once per renderer and shared.
const envCache = new WeakMap();
function environment(THREE, renderer) {
  if (!envCache.has(renderer)) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    envCache.set(renderer, env);
  }
  return envCache.get(renderer);
}

export function createBoardObject(THREE, renderer, { quality = 'hi', onUpdate } = {}) {
  const disposables = [];
  const loader = new THREE.TextureLoader();
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  // `ready` settles once every texture has loaded (or failed), so a view can
  // wait for a finished card before it shows.
  const pending = [];
  const tex = (name, srgb, q = quality) => {
    let done;
    pending.push(new Promise((r) => { done = r; }));
    const t = loader.load(texUrl(name, q), () => { done(); onUpdate?.(); }, undefined, () => done());
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = aniso;
    disposables.push(t);
    return t;
  };

  const root = new THREE.Group();
  const layers = [0, 1, 2, 3].map(() => new THREE.Group());
  layers.forEach((g) => root.add(g));
  const shape = outlineShape(THREE);

  // Top: black solder mask with a clear-coat sheen, copper relief, silver pads.
  const topOrm = tex('top-ormNoSilk', false);
  const topMat = new THREE.MeshPhysicalMaterial({
    map: tex('top-colorNoSilk', true), roughnessMap: topOrm, metalnessMap: topOrm, roughness: 1, metalness: 1,
    bumpMap: tex('top-height', false, 'hi'), bumpScale: 0.3, clearcoat: 0.3, clearcoatRoughness: 0.35, alphaTest: 0.5,
  });
  const silkMat = new THREE.MeshStandardMaterial({ map: tex('top-silk', true), roughness: 0.85, metalness: 0, transparent: true, alphaTest: 0.35, polygonOffset: true, polygonOffsetFactor: -2 });
  const bottomOrm = tex('bottom-orm', false, 'lo');
  const bottomMat = new THREE.MeshPhysicalMaterial({
    map: tex('bottom-color', true), roughnessMap: bottomOrm, metalnessMap: bottomOrm, roughness: 1, metalness: 1,
    // Double-sided so the bull & bear also shows from above when the layers separate.
    clearcoat: 0.3, clearcoatRoughness: 0.35, alphaTest: 0.5, side: THREE.DoubleSide,
  });
  // FR-4 core: the pale fibreglass seen at the edge and between exploded layers.
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x8c7b52, roughness: 0.78, metalness: 0 });
  disposables.push(topMat, silkMat, bottomMat, coreMat);

  const topGeo = faceGeometry(THREE, shape, false);
  const bottomGeo = faceGeometry(THREE, shape, true);
  const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: THICK, bevelEnabled: false, curveSegments: 4 });
  slabGeo.translate(0, 0, -THICK / 2);
  disposables.push(topGeo, bottomGeo, slabGeo);
  layers[0].add(new THREE.Mesh(topGeo, silkMat));
  layers[1].add(new THREE.Mesh(topGeo, topMat));
  layers[2].add(new THREE.Mesh(slabGeo, coreMat));
  layers[3].add(new THREE.Mesh(bottomGeo, bottomMat));

  // Parts from the BOM, seated on the top surface.
  const B = boardGeometry();
  const mat = (o) => { const m = new THREE.MeshPhysicalMaterial(o); disposables.push(m); return m; };
  const box = (w, h, d, m, x, y, z) => {
    const g = new THREE.BoxGeometry(w, h, d);
    disposables.push(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    return mesh;
  };
  const tin = mat({ color: 0xd7d7d4, metalness: 1, roughness: 0.28 });
  const epoxy = mat({ color: 0x141414, roughness: 0.42, clearcoat: 0.3 });
  const resistorBody = mat({ color: 0x1b1b1b, roughness: 0.55 });
  const ceramic = mat({ color: 0xb59a6b, roughness: 0.62 });
  const ledBody = mat({ color: 0xf1ead7, roughness: 0.25, emissive: 0xffb000, emissiveIntensity: 0, clearcoat: 0.6 });
  const parts = new THREE.Group();
  for (const p of Object.values(B.parts)) {
    const [x, y] = toLocal([p.x, p.y]);
    const alongX = p.w >= p.h;
    const L = alongX ? p.w : p.h, Wd = alongX ? p.h : p.w, cap = L * 0.18;
    const g = new THREE.Group();
    if (p.kind === 'qfn') g.add(box(p.w, p.h, p.d, epoxy, 0, 0, p.d / 2));
    else {
      const body = p.kind === 'led' ? ledBody : p.kind === 'resistor' ? resistorBody : ceramic;
      g.add(box(L - 2 * cap, Wd, p.d, body, 0, 0, p.d / 2));
      g.add(box(cap, Wd, p.d, tin, -(L - cap) / 2, 0, p.d / 2));
      g.add(box(cap, Wd, p.d, tin, (L - cap) / 2, 0, p.d / 2));
      if (!alongX) g.rotation.z = Math.PI / 2;
    }
    g.position.set(x, y, 0.2);
    parts.add(g);
  }
  layers[1].add(parts);

  // The LED's own light: lights the mask around it when the field powers it.
  const [lx, ly] = toLocal([B.led.x, B.led.y]);
  const ledLight = new THREE.PointLight(0xffb52e, 0, 260, 1.6);
  ledLight.position.set(lx, ly, 14);
  layers[1].add(ledLight);

  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(-0.35, 0.65, 1);
  root.add(key);

  return {
    root,
    layers,
    ready: Promise.all(pending),
    setExplode(explode) { layers.forEach((g, i) => { g.position.z = layerZ(i, explode); }); },
    setLed(v) { ledBody.emissiveIntensity = v * 3.2; ledLight.intensity = v * 900; },
    environment: () => environment(THREE, renderer),
    dispose() { disposables.forEach((d) => d.dispose()); },
  };
}

function prepareRenderer(THREE, renderer) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
}

function fitCamera(camera, renderer, w, h, ppu, dprCap) {
  const cam = makeCamera(w, h, ppu);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.near = cam.D / 20;
  camera.far = cam.D * 4;
  camera.position.set(0, 0, cam.D);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

// Story adapter: owns the stage canvas while the visitor is inside the track.
export async function createBoardView({ stage, onLost, quality = 'hi', onUpdate }) {
  const R = await getRenderer();
  if (!R) throw new Error('WebGL unavailable');
  const { THREE, renderer, canvas } = R;
  prepareRenderer(THREE, renderer);
  const scene = new THREE.Scene();
  const board = createBoardObject(THREE, renderer, { quality, onUpdate });
  scene.environment = board.environment();
  scene.environmentIntensity = 0.45;
  scene.add(board.root);
  const camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 1, 10000);
  // Soft contact shadow behind the floating hero card (fades as the card leaves).
  const shadowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(0,0,0,0.75)');
    r.addColorStop(0.55, 'rgba(0,0,0,0.25)');
    r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 });
  const shadowGeo = new THREE.PlaneGeometry(1, 1);
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  scene.add(shadow);
  const owner = {
    onLost() { canvas.style.opacity = '0'; onLost(); },
    onRelease() { canvas.style.opacity = '0'; },
  };
  let parked = false;
  let size = { vw: 1, vh: 1, ppu: 1 };
  const dprCap = quality === 'hi' ? 2 : 1.5;
  claim(owner, stage);
  const applySize = () => fitCamera(camera, renderer, size.vw, size.vh, size.ppu, dprCap);

  return {
    // Textures loaded and shaders compiled: the card can be shown.
    ready: board.ready.then(() => { if (!R.lost) renderer.compile(scene, camera); }),
    resize(vw, vh, ppu) { size = { vw, vh, ppu }; applySize(); },
    render(s) {
      if (parked || R.lost) return;
      canvas.style.opacity = String(s.glOpacity);
      if (s.glOpacity <= 0) return;
      board.root.rotation.set(s.pose.pitch, s.pose.yaw, s.pose.roll || 0, 'XYZ');
      board.root.position.set(s.pose.tx, s.pose.ty, s.pose.tz || 0);
      const sh = 0.55 * (s.heroShadow || 0);
      shadow.visible = sh > 0.01;
      shadowMat.opacity = sh;
      shadow.position.set(s.pose.tx + 20, s.pose.ty - BOARD.H * 0.62, (s.pose.tz || 0) - 140);
      shadow.scale.set(BOARD.W * 1.15, BOARD.H * 0.42, 1);
      board.setExplode(s.explode);
      board.setLed(s.led);
      renderer.render(scene, camera);
    },
    park() { parked = true; release(owner); },
    unpark() { parked = false; if (claim(owner, stage)) applySize(); },
    recolor() {},
    get size() { return size; },
    dispose() { release(owner); board.dispose(); shadowTex.dispose(); shadowMat.dispose(); shadowGeo.dispose(); },
  };
}

// NFC panel adapter: borrows the same renderer while the panel is on screen and
// the story is parked. It never opens a second context.
export async function createNfcGlView({ container, onRelease, quality = 'hi', onUpdate }) {
  const R = await getRenderer();
  if (!R) throw new Error('WebGL unavailable');
  const { THREE, renderer, canvas } = R;
  prepareRenderer(THREE, renderer);
  const scene = new THREE.Scene();
  const board = createBoardObject(THREE, renderer, { quality, onUpdate });
  scene.environment = board.environment();
  scene.environmentIntensity = 0.6;
  scene.add(board.root);
  board.setExplode(0);
  const camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 1, 10000);
  let active = false;
  let size = { w: 1, h: 1, ppu: 1 };
  const owner = {
    onLost() { active = false; onRelease(); },
    onRelease() { active = false; onRelease(); },
  };
  const applySize = () => fitCamera(camera, renderer, size.w, size.h, size.ppu, 2);
  return {
    get active() { return active && !R.lost; },
    activate(w, h, ppu) {
      size = { w, h, ppu };
      if (!claim(owner, container)) return false;
      active = true;
      canvas.style.opacity = '1';
      applySize();
      return true;
    },
    deactivate() { if (active) { active = false; release(owner); } },
    resize(w, h, ppu) { size = { w, h, ppu }; if (active) applySize(); },
    render(pose, led) {
      if (!active || R.lost) return;
      board.root.rotation.set(pose.pitch, pose.yaw, 0, 'XYZ');
      board.root.position.set(pose.tx, pose.ty, 0);
      board.setLed(led);
      renderer.render(scene, camera);
    },
    recolor() {},
    dispose() { this.deactivate(); board.dispose(); },
  };
}
