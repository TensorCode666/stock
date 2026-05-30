import {
  enrichBars,
  fetchKlines,
  type KlineBar,
  type KlinePeriod,
  type StockChartData,
} from './kline-indicators';
import { normalizeSymbol } from './symbols';

const TTL_MS = 5 * 60 * 1000;

const cache = new Map<string, { bars: KlineBar[]; at: number }>();

function cacheKey(symbol: string, period: KlinePeriod, limit: number): string {
  return `${symbol}:${period}:${limit}`;
}

/** 带 TTL 的 K 线缓存，避免重复请求 */
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
  const bars = await fetchKlines(symbol, period, barLimit);
  if (bars?.length) {
    cache.set(key, { bars, at: Date.now() });
  }
  return bars;
}

/** 带 TTL 的图表数据（含 enrichBars） */
export async function fetchStockChartDataCached(
  symbol: string,
  period: KlinePeriod = 'day',
  limit?: number
): Promise<StockChartData | null> {
  const code = normalizeSymbol(symbol);
  if (!code) return null;
  const bars = await fetchKlinesCached(code, period, limit);
  if (!bars?.length) return null;
  return { symbol: code, period, bars: enrichBars(bars) };
}

export function invalidateKlineCache(symbol?: string): void {
  if (!symbol) {
    cache.clear();
    return;
  }
  const prefix = `${symbol}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

export type { KlineBar, KlinePeriod, StockChartData };
