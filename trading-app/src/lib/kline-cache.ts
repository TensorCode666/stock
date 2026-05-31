import {
  enrichBars,
  fetchKlines,
  type EnrichedBar,
  type KlineBar,
  type KlinePeriod,
  type StockChartData,
} from './kline-indicators';
import { normalizeSymbol } from './symbols';

const TTL_MS = 5 * 60 * 1000;

const cache = new Map<string, { bars: KlineBar[]; at: number }>();
const enrichedCache = new Map<string, { bars: EnrichedBar[]; at: number }>();
const inflight = new Map<string, Promise<KlineBar[] | null>>();

function cacheKey(symbol: string, period: KlinePeriod, limit: number): string {
  return `${symbol}:${period}:${limit}`;
}

/** 带 TTL 的 K 线缓存，合并并发请求，避免重复拉取 */
export async function fetchKlinesCached(
  symbol: string,
  period: KlinePeriod = 'day',
  limit?: number
): Promise<KlineBar[] | null> {
  const barLimit = limit ?? 120;
  const key = cacheKey(symbol, period, barLimit);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return hit.bars;
  }

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = fetchKlines(symbol, period, barLimit)
    .then((bars) => {
      if (bars?.length) {
        cache.set(key, { bars, at: Date.now() });
        enrichedCache.delete(key);
      }
      return bars;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/** 带 TTL 的图表数据（含 enrichBars，enriched 结果单独缓存） */
export async function fetchStockChartDataCached(
  symbol: string,
  period: KlinePeriod = 'day',
  limit?: number
): Promise<StockChartData | null> {
  const code = normalizeSymbol(symbol);
  if (!code) return null;
  const barLimit = limit ?? 120;
  const key = cacheKey(code, period, barLimit);

  const enrichedHit = enrichedCache.get(key);
  if (enrichedHit && Date.now() - enrichedHit.at < TTL_MS) {
    return { symbol: code, period, bars: enrichedHit.bars };
  }

  const bars = await fetchKlinesCached(code, period, barLimit);
  if (!bars?.length) return null;

  const enriched = enrichBars(bars);
  enrichedCache.set(key, { bars: enriched, at: Date.now() });
  return { symbol: code, period, bars: enriched };
}

export function invalidateKlineCache(symbol?: string): void {
  if (!symbol) {
    cache.clear();
    enrichedCache.clear();
    return;
  }
  const prefix = `${symbol}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
  for (const key of enrichedCache.keys()) {
    if (key.startsWith(prefix)) enrichedCache.delete(key);
  }
}

export type { KlineBar, KlinePeriod, StockChartData };
