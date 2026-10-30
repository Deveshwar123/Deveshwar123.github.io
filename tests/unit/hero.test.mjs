// The hero's discipline panels: real code shown verbatim, real prices, correct indicators.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ema, rsi, highlightJs, codePanel, chartPanel } from '../../scripts/lib/hero-panels.mjs';

const read = (rel) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
const cfg = JSON.parse(read('data/site-config.json'));
const market = JSON.parse(read(cfg.heroPanels.chart.data));
const html = read('index.html');
const text = (s) => s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

test('highlighting never changes the code: every excerpt line survives verbatim', () => {
  for (const line of cfg.heroPanels.code.lines) assert.equal(text(highlightJs(line)), line);
  const panel = codePanel(cfg.heroPanels.code);
  assert.ok(html.includes(panel), 'index.html carries the generated code panel');
  const shown = [...panel.matchAll(/<span class="code-line"><span class="code-ln">(\d+)<\/span>(.*?)(?:<span class="code-caret"><\/span>)?<\/span>(?=<span class="code-line">|<\/code>)/g)];
  assert.equal(shown.length, cfg.heroPanels.code.lines.length);
  shown.forEach((m, i) => {
    assert.equal(+m[1], cfg.heroPanels.code.firstLine + i);
    assert.equal(text(m[2]), cfg.heroPanels.code.lines[i]);
  });
  assert.match(cfg.heroPanels.code.source, /^https:\/\/github\.com\/Deveshwar123\/[^/]+\/blob\/[0-9a-f]{40}\//, 'excerpt pinned to a commit');
});

test('EMA and RSI match hand-computed values', () => {
  const v = [1, 2, 3, 4, 5, 6];
  const e = ema(v, 3); // seed = mean(1,2,3) = 2, k = 0.5
  assert.deepEqual(e, [null, null, 2, 3, 4, 5]);
  const flat = rsi(Array(20).fill(10));
  assert.equal(flat[14], 100); // no losses
  const up = rsi(Array.from({ length: 20 }, (_, i) => (i % 2 ? 11 : 10)));
  assert.ok(up[14] > 40 && up[14] < 60, 'alternating moves sit near 50');
});

test('the chart is drawn from the committed price snapshot, finished sessions only', () => {
  assert.equal(market.symbol, 'MCHP');
  assert.ok(market.bars.length >= cfg.heroPanels.chart.sessions + Math.max(...cfg.heroPanels.chart.emas));
  for (const [d, o, h, l, c] of market.bars) {
    assert.match(d, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(l <= Math.min(o, c) && h >= Math.max(o, c), `bad bar ${d}`);
    assert.ok(d < market.fetched, `unfinished session ${d}`);
  }
  const panel = chartPanel(cfg.heroPanels.chart, market);
  assert.ok(html.includes(panel), 'index.html carries the generated chart panel');
  assert.ok(panel.includes(market.bars.at(-1)[4].toFixed(2)), 'last close shown');
  assert.match(panel, /Yahoo Finance/);
  // The owner dropped the backtest line (29 Oct): the chart shows prices only. Any
  // claim brought back must be the résumé's own result, not a made-up curve.
  assert.doesNotMatch(panel, /backtest|20-year|panel-stat/);
  const note = cfg.heroPanels.chart.note;
  if (note) {
    const resume = JSON.parse(read('data/resume.json'));
    const bullet = resume.experience.find((e) => e.id === 'quant-research').bullets.find((b) => b.id === 'b2').text;
    for (const n of note.match(/\d+%/g)) assert.ok(bullet.includes(n), `${n} is in the résumé bullet`);
  }
});
