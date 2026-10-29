// Build-time markup for the "More on GitHub" pictures: each card shows a window
// holding either the repo's own screenshot or a verbatim README excerpt with its
// real line numbers. Pure string functions; the generator inlines the result.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Screenshot sizes: at most 1600 wide, plus a half-size copy.
export function shotWidths({ width }) {
  const big = Math.min(1600, width);
  return [big, Math.round(big / 2)];
}

// README excerpts are diagrams and folder trees: dim the comments, colour the
// connectors and folder names, leave the words alone.
const TOKEN = /(#\s.*$|\([^)]*\))|((?:->|<-|→|[├└│─]+|[\^|]))|([\w.-]+\/)|(\s+)|([^\s]+?(?=\s|->|<-|\(|$))/gm;

export function highlightText(line) {
  let out = '';
  for (const m of line.matchAll(TOKEN)) {
    const [t, com, pun, dir, ws] = m;
    if (com) out += `<span class="tok-com">${esc(t)}</span>`;
    else if (pun) out += `<span class="tok-pun">${esc(t)}</span>`;
    else if (dir) out += `<span class="tok-fn">${esc(t)}</span>`;
    else if (ws) out += t;
    else out += esc(t);
  }
  return out;
}

const bar = (title, dim) => `<div class="panel-bar"><span class="panel-dots"><i></i><i></i><i></i></span><span class="panel-title">${esc(title)}${dim ? ` <span class="panel-dim">· ${esc(dim)}</span>` : ''}</span></div>`;

export function repoWindow(item) {
  const pic = item.picture;
  if (pic.kind === 'shot') {
    const [big, small] = shotWidths(pic);
    const h = Math.round((big * pic.height) / pic.width);
    return `<div class="repo-window repo-window--shot">
              ${bar(pic.bar)}
              <img class="repo-shot" src="assets/projects/${item.id}-${big}.webp" srcset="assets/projects/${item.id}-${small}.webp ${small}w, assets/projects/${item.id}-${big}.webp ${big}w" sizes="(min-width: 960px) 560px, 88vw" width="${big}" height="${h}" alt="" loading="lazy" decoding="async" fetchpriority="low">
            </div>`;
  }
  const name = new URL(item.repo).pathname.split('/')[2];
  const lines = pic.lines.map((l, i) => `<span class="code-line"><span class="code-ln">${pic.firstLine + i}</span>${highlightText(l)}</span>`).join('');
  return `<div class="repo-window repo-window--code">
              ${bar(name, pic.path)}
              <pre class="panel-code"><code>${lines}</code></pre>
            </div>`;
}

// The commit-pinned GitHub link to the excerpt's lines.
export const excerptSource = (item) => `${item.repo}/blob/${item.commit}/${item.picture.path}#L${item.picture.firstLine}-L${item.picture.firstLine + item.picture.lines.length - 1}`;
