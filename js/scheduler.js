// The only decorative requestAnimationFrame loop on the page.
// Tasks register a function (time, dtMs) → boolean ("I need another frame").
// The loop sleeps when no task needs frames, pauses while the tab is hidden and
// clamps the first delta after resuming so nothing jumps.

const tasks = new Map();
let rafId = 0;
let last = 0;
let wantFrame = false;

function loop(time) {
  rafId = 0;
  const dt = last ? Math.min(Math.max(time - last, 0), 50) : 16.7;
  last = time;
  wantFrame = false;
  for (const [name, fn] of tasks) {
    try {
      if (fn(time, dt)) wantFrame = true;
    } catch (err) {
      tasks.delete(name);
      console.warn(`[portfolio] frame task "${name}" failed and was removed`, err);
    }
  }
  if (wantFrame && !document.hidden) rafId = requestAnimationFrame(loop);
  else last = 0;
}

export function wake() {
  if (!rafId && !document.hidden && tasks.size) rafId = requestAnimationFrame(loop);
}

export function addTask(name, fn) {
  tasks.set(name, fn);
  wake();
  return () => removeTask(name);
}

export function removeTask(name) {
  tasks.delete(name);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    last = 0;
  } else {
    wake();
  }
});
