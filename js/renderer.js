// The page's single WebGL renderer. The scroll story and the NFC panel take
// turns owning it (the canvas moves between their containers) instead of
// opening a second context. Context loss falls back to SVG; recovery is
// attempted a bounded number of times and never reloads the page.

let instance = null;
let pending = null;
let owner = null;
let restores = 0;
const MAX_RESTORES = 2;

// Callers that arrive while the first renderer is still being created (the story
// and the NFC panel can both start on one load) share that creation, so there is
// never a second canvas or context.
export function getRenderer() {
  if (instance) return Promise.resolve(instance.lost ? null : instance);
  pending ??= create().finally(() => { pending = null; });
  return pending;
}

async function create() {
  const THREE = await import('three');
  const canvas = document.createElement('canvas');
  canvas.className = 'stage-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: true });
  } catch (err) {
    throw new Error('WebGL2 renderer could not be created', { cause: err });
  }
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  instance = { THREE, renderer, canvas, lost: false };

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    instance.lost = true;
    owner?.onLost?.();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    restores++;
    if (restores > MAX_RESTORES) return; // stay on the SVG fallback
    instance.lost = false;
    owner?.onRestored?.();
  });
  return instance;
}

// Move the canvas into `container` and make `who` the owner. A previous owner
// is told to release (it falls back to its static/SVG art).
export function claim(who, container) {
  if (!instance || instance.lost) return false;
  if (owner && owner !== who) owner.onRelease?.();
  owner = who;
  if (instance.canvas.parentNode !== container) container.appendChild(instance.canvas);
  return true;
}

export function release(who) {
  if (owner !== who) return;
  owner = null;
  instance?.canvas.remove();
}

export const currentOwner = () => owner;

export function rendererInfo() {
  if (!instance) return null;
  const { calls, triangles } = instance.renderer.info.render;
  return { calls, triangles, lost: instance.lost, restores };
}
