import {
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import {
  fetchIndices,
  fetchMarketBreadth,
  fetchStockQuotes,
  type StockQuote,
} from '../lib/market-api';
import { appStore, useAppSymbolsKey } from '../lib/app-store';
import { prefetchKlinesBatched } from '../lib/kline-prefetch';
import { marketStore } from '../lib/market-store';
import { quotesStore } from '../lib/quotes-store';
import { normalizeSymbol } from '../lib/symbols';

export {
  useMarketBreadth,
  useMarketIndices,
  useMarketRefresh,
  useMarketStatus,
} from '../lib/market-store';
export { useQuote } from '../lib/quotes-store';

type RefreshOptions = { silent?: boolean };

const REFRESH_MS = 30_000;
const SYMBOLS_REFRESH_DEBOUNCE_MS = 250;
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
    const all = symbolsKeyValue.split(',').filter(Boolean);
    const holdingSyms = appStore
      .getSlice('holdings')
      .map((h) => normalizeSymbol(h.symbol))
      .filter(Boolean);
    const rest = all.filter((sym) => !holdingSyms.includes(sym));
    prefetchKlinesBatched(holdingSyms, { period: 'day', limit: 40, priority: 2 });
    prefetchKlinesBatched(rest, { period: 'day', limit: 40, priority: 0 });
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
