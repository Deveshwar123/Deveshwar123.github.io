// Maintenance: snapshots one year of daily MCHP prices (Yahoo Finance) into
// data/market/mchp-daily.json for the hero's finance panel. The site never
// fetches market data at runtime; rerun this to refresh the snapshot, then
// `npm run generate`. Usage: node scripts/fetch-market.mjs [SYMBOL]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const symbol = (process.argv[2] || 'MCHP').toUpperCase();
const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1y&interval=1d`;
const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
const r = (await res.json()).chart.result[0];
const q = r.indicators.quote[0];
const day = (t) => new Date((t + r.meta.gmtoffset) * 1000).toISOString().slice(0, 10);
const today = day(Math.floor(Date.now() / 1000));
const round = (v) => Math.round(v * 100) / 100;
const bars = r.timestamp
  .map((t, i) => [day(t), round(q.open[i]), round(q.high[i]), round(q.low[i]), round(q.close[i])])
  .filter((b) => b.slice(1).every(Number.isFinite))
  // Only finished sessions: today's bar is still moving while the market is open.
  .filter((b) => b[0] !== today);

const out = join(root, `data/market/${symbol.toLowerCase()}-daily.json`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({
  symbol,
  exchange: r.meta.fullExchangeName || r.meta.exchangeName,
  source: 'Yahoo Finance',
  fetched: today,
  fields: ['date', 'open', 'high', 'low', 'close'],
  bars,
}) + '\n');
console.log(`✓ ${symbol}: ${bars.length} sessions ${bars[0][0]} → ${bars.at(-1)[0]} → ${out.replace(root + '/', '')}`);
