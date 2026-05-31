import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import {
  fetchIndices,
  fetchMarketBreadth,
  fetchStockQuotes,
  type IndexQuote,
  type MarketBreadth,
  type StockQuote,
} from '../lib/market-api';
import { useAppSymbolsKey } from '../lib/app-store';
import { fetchKlinesCached } from '../lib/kline-cache';
import {
  marketStore,
  useMarketBreadth,
  useMarketIndices,
  useMarketRefresh,
  useMarketStatus,
} from '../lib/market-store';
import { quotesStore } from '../lib/quotes-store';

export {
  useMarketBreadth,
  useMarketIndices,
  useMarketRefresh,
  useMarketStatus,
} from '../lib/market-store';
export { useQuote, useQuotesRevision } from '../lib/quotes-store';

type RefreshOptions = { silent?: boolean };

/** @deprecated 请用 useMarketIndices / useMarketBreadth / useMarketStatus / useMarketRefresh */
export type MarketDataContextValue = {
  indices: IndexQuote[];
  breadth: MarketBreadth | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: (options?: RefreshOptions) => Promise<void>;
};

const REFRESH_MS = 30_000;
const SYMBOLS_REFRESH_DEBOUNCE_MS = 250;
const KLINE_PREFETCH_LIMIT = 16;

export function MarketDataProvider({ children }: { children: ReactNode }) {
  const symbolsKeyValue = useAppSymbolsKey();
  const initialDone = useRef(false);

  const refresh = useCallback(
    async (options?: RefreshOptions) => {
      const symbols = symbolsKeyValue
        ? symbolsKeyValue.split(',').filter(Boolean)
        : [];
      const silent = options?.silent ?? initialDone.current;
      if (!silent) {
        marketStore.patchStatus({ loading: true, refreshing: true });
      }
      marketStore.patchStatus({ error: null });

      const errors: string[] = [];
      const [idx, br, qMap] = await Promise.all([
        fetchIndices().catch((e) => {
          errors.push(e instanceof Error ? e.message : '指数加载失败');
          return [] as Awaited<ReturnType<typeof fetchIndices>>;
        }),
        fetchMarketBreadth().catch(() => null),
        fetchStockQuotes(symbols).catch((e) => {
          errors.push(e instanceof Error ? e.message : '个股行情失败');
          return new Map<string, StockQuote>();
        }),
      ]);

      const idxChanged = marketStore.setIndices(idx);
      const brChanged = marketStore.setBreadth(br);
      const qChanged = quotesStore.setQuotes(qMap);

      if (idxChanged || brChanged || qChanged) {
        marketStore.touchLastUpdated();
      }

      if (errors.length && idx.length === 0 && qMap.size === 0) {
        marketStore.patchStatus({ error: errors.join('；') });
      } else if (errors.length) {
        marketStore.patchStatus({
          error: `部分行情不可用（已尝试腾讯备用源）：${errors[0]}`,
        });
      }

      initialDone.current = true;
      if (!silent) {
        marketStore.patchStatus({ loading: false, refreshing: false });
      }
    },
    [symbolsKeyValue]
  );

  useEffect(() => {
    marketStore.setRefreshHandler(refresh);
  }, [refresh]);

  useEffect(() => {
    const delay = initialDone.current ? SYMBOLS_REFRESH_DEBOUNCE_MS : 0;
    const t = setTimeout(() => void refresh(), delay);
    return () => clearTimeout(t);
  }, [refresh]);

  useEffect(() => {
    if (!symbolsKeyValue) return;
    const symbols = symbolsKeyValue.split(',').filter(Boolean);
    for (const sym of symbols.slice(0, KLINE_PREFETCH_LIMIT)) {
      void fetchKlinesCached(sym, 'day', 40);
    }
  }, [symbolsKeyValue]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'hidden') return;
      void refresh({ silent: true });
    };
    const id = setInterval(tick, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refresh({ silent: true });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  return <>{children}</>;
}

/** 兼容旧代码；新页面请用 market-store 细粒度 hooks */
export function useMarketData(): MarketDataContextValue {
  const indices = useMarketIndices();
  const breadth = useMarketBreadth();
  const { loading, refreshing, error, lastUpdated } = useMarketStatus();
  const refresh = useMarketRefresh();
  return useMemo(
    () => ({
      indices,
      breadth,
      loading,
      refreshing,
      error,
      lastUpdated,
      refresh,
    }),
    [indices, breadth, loading, refreshing, error, lastUpdated, refresh]
  );
}
