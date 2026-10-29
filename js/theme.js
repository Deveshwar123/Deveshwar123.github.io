// Theme control. System preference applies until the visitor picks Light or
// Dark; the choice persists in guarded storage and "System" returns control to
// the OS. The inline initializer in <head> has already applied any saved choice.

const listeners = new Set();
let pref = 'system';
const darkQuery = matchMedia('(prefers-color-scheme: dark)');

export const resolvedTheme = () => (pref === 'system' ? (darkQuery.matches ? 'dark' : 'light') : pref);
export function onThemeChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function initTheme(cfg) {
  const root = document.documentElement;
  const key = cfg.theme.storageKey;
  const metas = [...document.querySelectorAll('meta[name="theme-color"]')];
  const original = metas.map((m) => m.content);
  const colors = { dark: cfg.meta.themeColorDark, light: cfg.meta.themeColorLight };

  const saved = root.getAttribute('data-theme');
  pref = saved === 'light' || saved === 'dark' ? saved : 'system';

  const apply = () => {
    if (pref === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', pref);
    metas.forEach((m, i) => { m.content = pref === 'system' ? original[i] : colors[pref]; });
    for (const fn of listeners) fn(resolvedTheme());
  };

  const control = document.querySelector('[data-theme-control]');
  if (control) {
    for (const r of control.querySelectorAll('input')) r.checked = r.value === pref;
    control.addEventListener('change', (e) => {
      if (e.target.name !== 'theme') return;
      pref = ['light', 'dark'].includes(e.target.value) ? e.target.value : 'system';
      try {
        if (pref === 'system') localStorage.removeItem(key);
        else localStorage.setItem(key, pref);
      } catch { /* storage blocked: the choice applies for this page view only */ }
      apply();
    });
  }
  darkQuery.addEventListener('change', () => { if (pref === 'system') apply(); });
}
