// Build-time markup for the hero's two discipline panels: a code window with a
// verbatim excerpt from one of my projects (Computer Science) and a daily chart
// of real MCHP prices with EMAs and RSI (Finance). Pure string functions: the
// generator inlines the result, so the page fetches nothing for them.

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f1 = (v) => +v.toFixed(1);

// ---------------------------------------------------------------------------
// Code window
// ---------------------------------------------------------------------------

const KEYWORDS = new Set(['const', 'let', 'var', 'await', 'async', 'try', 'catch', 'if', 'else', 'throw', 'return', 'new', 'function', 'null', 'true', 'false', 'self', 'for', 'of']);
const TOKEN = /(\/\/.*$)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)|(\s+)|([^\sA-Za-z_$\d'"`/]+|\/)/gm;

// A small JavaScript highlighter: comments, strings, numbers, keywords and calls.
export function highlightJs(line) {
  let out = '';
  for (const m of line.matchAll(TOKEN)) {
    const [t, com, str, num, call, word, ws] = m;
    if (com) out += `<span class="tok-com">${esc(t)}</span>`;
    else if (str) out += `<span class="tok-str">${esc(t)}</span>`;
    else if (num) out += `<span class="tok-num">${esc(t)}</span>`;
    else if (call) out += `<span class="tok-fn">${esc(t)}</span>`;
    else if (word) out += KEYWORDS.has(t) ? `<span class="tok-kw">${esc(t)}</span>` : esc(t);
    else if (ws) out += t;
    else out += `<span class="tok-pun">${esc(t)}</span>`;
  }
  return out;
}

export function codePanel(code) {
  // Block-level lines joined without newlines (a newline inside <pre> would add a blank line);
  // the caret sits at the end of the last line.
  const lines = code.lines.map((l, i, all) => `<span class="code-line"><span class="code-ln">${code.firstLine + i}</span>${highlightJs(l)}${i === all.length - 1 ? '<span class="code-caret"></span>' : ''}</span>`).join('');
  return `<div class="hero-panel hero-panel--code">
          <div class="panel-bar"><span class="panel-dots"><i></i><i></i><i></i></span><span class="panel-title">${esc(code.project)} <span class="panel-dim">· ${esc(code.file)}</span></span><span class="panel-tag">${esc(code.discipline)}</span></div>
          <pre class="panel-code"><code>${lines}</code></pre>
        </div>`;
}

// ---------------------------------------------------------------------------
// Market chart
// ---------------------------------------------------------------------------

export function ema(values, n) {
  const k = 2 / (n + 1);
  const out = new Array(values.length).fill(null);
  if (values.length < n) return out;
  let e = values.slice(0, n).reduce((a, b) => a + b, 0) / n; // seeded with the simple average
  out[n - 1] = e;
  for (let i = n; i < values.length; i++) out[i] = e = values[i] * k + e * (1 - k);
  return out;
}

// Wilder's RSI.
export function rsi(values, n = 14) {
  const out = new Array(values.length).fill(null);
  if (values.length <= n) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = values[i] - values[i - 1];
    if (d > 0) gain += d; else loss -= d;
  }
  gain /= n; loss /= n;
  const at = (g, l) => (l === 0 ? 100 : 100 - 100 / (1 + g / l));
  out[n] = at(gain, loss);
  for (let i = n + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = at(gain, loss);
  }
  return out;
}

// Round price levels for the grid: 3–5 steps of 1, 2 or 5 × 10^k.
function niceTicks(lo, hi) {
  const raw = (hi - lo) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const ticks = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(+v.toFixed(6));
  return ticks;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (d) => `${MONTHS[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}, ${d.slice(0, 4)}`;

// The résumé result with its numbers emphasised ("500%", "389%").
const statLine = (note) => esc(note).replace(/(\d+(?:\.\d+)?%)/g, '<b>$1</b>');

export function chartPanel(chart, market) {
  const W = 600, PLOT = 552, P0 = 10, P1 = 178, R0 = 198, R1 = 246;
  const closes = market.bars.map((b) => b[4]);
  const emas = chart.emas.map((n) => ({ n, v: ema(closes, n) }));
  const rs = rsi(closes, 14);
  const from = market.bars.length - chart.sessions;
  const bars = market.bars.slice(from);
  const lo = Math.min(...bars.map((b) => b[3]), ...emas.flatMap((e) => e.v.slice(from)));
  const hi = Math.max(...bars.map((b) => b[2]), ...emas.flatMap((e) => e.v.slice(from)));
  const pad = (hi - lo) * 0.06;
  const yMin = lo - pad, yMax = hi + pad;
  const y = (v) => P1 - ((v - yMin) / (yMax - yMin)) * (P1 - P0);
  const slot = PLOT / bars.length;
  const x = (i) => slot * (i + 0.5);
  const body = Math.max(1.6, slot * 0.62);

  let upBody = '', upWick = '', dnBody = '', dnWick = '';
  bars.forEach(([, o, h, l, c], i) => {
    const cx = f1(x(i));
    const top = y(Math.max(o, c)), bot = y(Math.min(o, c));
    const rect = `M${f1(cx - body / 2)} ${f1(top)}h${f1(body)}v${f1(Math.max(0.8, bot - top))}h${f1(-body)}Z`;
    const wick = `M${cx} ${f1(y(h))}V${f1(y(l))}`;
    if (c >= o) { upBody += rect; upWick += wick; } else { dnBody += rect; dnWick += wick; }
  });
  const line = (vals, yy) => vals.map((v, i) => `${i ? 'L' : 'M'}${f1(x(i))} ${f1(yy(v))}`).join('');
  const emaPaths = emas.map((e, k) => `<path class="chart-ema chart-ema--${k + 1}" d="${line(e.v.slice(from), y)}"/>`).join('');
  const ry = (v) => R1 - (v / 100) * (R1 - R0);
  const rsiPath = `<path class="chart-rsi" d="${line(rs.slice(from), ry)}"/>`;

  const grid = niceTicks(yMin, yMax).map((t) => `<path class="chart-grid" d="M0 ${f1(y(t))}H${PLOT}"/><text class="chart-axis" x="${W - 2}" y="${f1(y(t) + 3.5)}" text-anchor="end">${t.toFixed(0)}</text>`).join('');
  const months = bars.map((b, i) => (i && b[0].slice(5, 7) !== bars[i - 1][0].slice(5, 7) ? `<text class="chart-axis" x="${f1(x(i))}" y="${P1 + 13}" text-anchor="middle">${MONTHS[+b[0].slice(5, 7) - 1]}</text>` : '')).join('');
  const last = bars.at(-1), prev = market.bars[market.bars.length - 2];
  const change = ((last[4] - prev[4]) / prev[4]) * 100;
  const ly = f1(y(last[4]));
  const priceTag = `<path class="chart-last" d="M0 ${ly}H${PLOT}"/><rect class="chart-tag ${change >= 0 ? 'is-up' : 'is-down'}" x="${PLOT + 1}" y="${f1(ly - 7.5)}" width="${W - PLOT - 1}" height="15" rx="2"/><text class="chart-tag-text" x="${W - 2}" y="${f1(ly + 3.5)}" text-anchor="end">${last[4].toFixed(2)}</text>`;
  const rsiFrame = `<path class="chart-grid" d="M0 ${f1(ry(70))}H${PLOT}M0 ${f1(ry(30))}H${PLOT}"/><text class="chart-axis" x="4" y="${R0 + 9}">RSI 14</text><text class="chart-axis" x="${W - 2}" y="${f1(ry(70) + 3.5)}" text-anchor="end">70</text><text class="chart-axis" x="${W - 2}" y="${f1(ry(30) + 3.5)}" text-anchor="end">30</text>`;
  const legend = emas.map((e, k) => `<tspan class="chart-legend--${k + 1}">EMA ${e.n}</tspan>`).join('  ');

  return `<div class="hero-panel hero-panel--chart">
          <div class="panel-bar"><span class="panel-title">${esc(market.symbol)} <span class="panel-dim">· ${esc(market.exchange)} · 1D</span></span><span class="panel-quote">${last[4].toFixed(2)} <span class="${change >= 0 ? 'is-up' : 'is-down'}">${change >= 0 ? '+' : '−'}${Math.abs(change).toFixed(2)}%</span></span><span class="panel-tag">${esc(chart.discipline)}</span></div>
          ${chart.note ? `<p class="panel-stat">${statLine(chart.note)}</p>` : ''}
          <svg class="panel-chart" viewBox="0 0 ${W} 250" focusable="false">
            <g class="chart-frame">${grid}${rsiFrame}${months}</g>
            <g class="chart-candles"><path class="chart-wick is-up" d="${upWick}"/><path class="chart-wick is-down" d="${dnWick}"/><path class="chart-body is-up" d="${upBody}"/><path class="chart-body is-down" d="${dnBody}"/></g>
            <g class="chart-lines">${emaPaths}${rsiPath}</g>
            ${priceTag}
            <text class="chart-axis chart-legend" x="4" y="${P0 + 9}">${legend}</text>
          </svg>
          <p class="panel-note panel-dim">${esc(market.source)} · ${fmtDate(bars[0][0])} – ${fmtDate(last[0])}</p>
        </div>`;
}
