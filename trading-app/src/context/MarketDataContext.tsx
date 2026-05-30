import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useApp } from './AppContext';
import {
  fetchIndices,
  fetchMarketBreadth,
  fetchStockQuotes,
  type IndexQuote,
  type MarketBreadth,
  type StockQuote,
} from '../lib/market-api';
import { quotesStore } from '../lib/quotes-store';
import { normalizeSymbol, symbolsKey } from '../lib/symbols';

export { useQuote, useQuotesRevision } from '../lib/quotes-store';

type RefreshOptions = { silent?: boolean };

type MarketDataContextValue = {
  indices: IndexQuote[];
  breadth: MarketBreadth | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: (options?: RefreshOptions) => Promise<void>;
  /** @deprecated 优先使用 useQuote(symbol) 以减少无关重渲染 */
  getQuote: (symbol: string) => StockQuote | undefined;
};

const MarketDataContext = createContext<MarketDataContextValue | null>(null);

const REFRESH_MS = 30_000;

function indicesChanged(prev: IndexQuote[], next: IndexQuote[]): boolean {
  if (prev.length !== next.length) return true;
  for (let i = 0; i < next.length; i++) {
    const a = prev[i];
    const b = next[i];
    if (!a || !b || a.code !== b.code) return true;
    if (a.price !== b.price || a.changePercent !== b.changePercent) return true;
  }
  return false;
}

function breadthChanged(
  prev: MarketBreadth | null,
  next: MarketBreadth | null
): boolean {
  if (prev === next) return false;
  if (!prev || !next) return true;
  return (
    prev.up !== next.up ||
    prev.down !== next.down ||
    prev.flat !== next.flat ||
    prev.total !== next.total
  );
}

export function MarketDataProvider({ children }: { children: ReactNode }) {
  const { data } = useApp();
  const [indices, setIndices] = useState<IndexQuote[]>([]);
  const [breadth, setBreadth] = useState<MarketBreadth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const initialDone = useRef(false);
  const indicesRef = useRef<IndexQuote[]>([]);
  const breadthRef = useRef<MarketBreadth | null>(null);

  const symbolsKeyValue = useMemo(() => {
    const set = new Set<string>();
    for (const w of data.watchlist) {
      if (w.status !== 'removed') set.add(normalizeSymbol(w.symbol));
    }
    for (const h of data.holdings) {
      set.add(normalizeSymbol(h.symbol));
    }
    for (const f of data.favorites) {
      set.add(normalizeSymbol(f.symbol));
    }
    return symbolsKey([...set]);
  }, [data.watchlist, data.holdings, data.favorites]);

  const refresh = useCallback(
    async (options?: RefreshOptions) => {
      const symbols = symbolsKeyValue
        ? symbolsKeyValue.split(',').filter(Boolean)
        : [];
      const silent = options?.silent ?? initialDone.current;
      if (!silent) {
        setLoading(true);
        setRefreshing(true);
      }
      setError(null);
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
      const idxChanged = indicesChanged(indicesRef.current, idx);
      const brChanged = breadthChanged(breadthRef.current, br);
      const qChanged = quotesStore.setQuotes(qMap);

      if (idxChanged) {
        indicesRef.current = idx;
        setIndices(idx);
      }
      if (brChanged) {
        breadthRef.current = br;
        setBreadth(br);
      }
      if (idxChanged || brChanged || qChanged) {
        setLastUpdated(new Date());
      }
      if (errors.length && idx.length === 0 && qMap.size === 0) {
        setError(errors.join('；'));
      } else if (errors.length) {
        setError(`部分行情不可用（已尝试腾讯备用源）：${errors[0]}`);
      }
      initialDone.current = true;
      if (!silent) {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [symbolsKeyValue]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  const getQuote = useCallback(
    (symbol: string) => quotesStore.getQuote(symbol),
    []
  );

  const value = useMemo(
    () => ({
      indices,
      breadth,
      loading,
      refreshing,
      error,
      lastUpdated,
      refresh,
      getQuote,
    }),
    [
      indices,
      breadth,
      loading,
      refreshing,
      error,
      lastUpdated,
      refresh,
      getQuote,
    ]
  );

  return (
    <MarketDataContext.Provider value={value}>
      {children}
    </MarketDataContext.Provider>
  );
}

export function useMarketData() {
  const ctx = useContext(MarketDataContext);
  if (!ctx) {
    throw new Error('useMarketData must be used within MarketDataProvider');
  }
  return ctx;
}
