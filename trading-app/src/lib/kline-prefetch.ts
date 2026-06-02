import { fetchKlinesCached, fetchStockChartDataCached } from './kline-cache';
import type { KlinePeriod } from './kline-indicators';
import { normalizeSymbol } from './symbols';

const CONCURRENCY = 3;
const BATCH_GAP_MS = 80;

const scheduled = new Set<string>();

function taskKey(sym: string, period: KlinePeriod, limit: number): string {
  return `${sym}:${period}:${limit}`;
}

type PrefetchOptions = {
  period?: KlinePeriod;
  limit?: number;
  /** 越大越先执行；0 表示 idle 后执行 */
  priority?: number;
  enriched?: boolean;
};

function runBatched(
  symbols: string[],
  period: KlinePeriod,
  limit: number,
  enriched: boolean
): void {
  const queue = symbols.filter(Boolean);
  if (!queue.length) return;

  const pump = (start: number) => {
    const batch = queue.slice(start, start + CONCURRENCY);
    if (!batch.length) return;
    void Promise.all(
      batch.map((sym) =>
        enriched
          ? fetchStockChartDataCached(sym, period, limit)
          : fetchKlinesCached(sym, period, limit)
      )
    ).finally(() => {
      const next = start + CONCURRENCY;
      if (next < queue.length) {
        setTimeout(() => pump(next), BATCH_GAP_MS);
      }
    });
  };

  pump(0);
}

/** 分批预取 K 线，避免同时打满网络；重复调用同一 symbol 会去重 */
export function prefetchKlinesBatched(
  symbols: string[],
  options?: PrefetchOptions
): void {
  const period = options?.period ?? 'day';
  const limit = options?.limit ?? 40;
  const enriched = options?.enriched ?? false;
  const priority = options?.priority ?? 0;

  const pending = symbols
    .map((s) => normalizeSymbol(s))
    .filter(Boolean)
    .filter((sym) => {
      const key = taskKey(sym, period, limit);
      if (scheduled.has(key)) return false;
      scheduled.add(key);
      return true;
    });

  if (!pending.length) return;

  const start = () => runBatched(pending, period, limit, enriched);

  if (priority > 0) {
    start();
  } else if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(() => start(), { timeout: 8000 });
  } else {
    setTimeout(start, 500);
  }
}

const stockPagePrefetched = new Set<string>();

/** 悬停股票链接时预加载图表 chunk 与日/周/月 K 数据 */
export function prefetchStockDetail(symbol: string): void {
  const code = normalizeSymbol(symbol);
  if (!code || stockPagePrefetched.has(code)) return;
  stockPagePrefetched.add(code);
  void import('../components/StockChartPanels');
  prefetchChartPeriod(code, 'day');
  prefetchChartPeriod(code, 'week');
  prefetchChartPeriod(code, 'month');
}

const chartPeriodScheduled = new Set<string>();

/** 预加载指定周期 K 线（详情页 tab 悬停） */
export function prefetchChartPeriod(
  symbol: string,
  period: KlinePeriod = 'day'
): void {
  const code = normalizeSymbol(symbol);
  if (!code) return;
  const key = taskKey(code, period, 120);
  if (chartPeriodScheduled.has(key)) return;
  chartPeriodScheduled.add(key);
  void fetchStockChartDataCached(code, period, 120);
}
