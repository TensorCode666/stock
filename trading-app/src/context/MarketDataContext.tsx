import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import { normalizeSymbol } from '../lib/symbols';

type MarketDataContextValue = {
  indices: IndexQuote[];
  breadth: MarketBreadth | null;
  quotes: Map<string, StockQuote>;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
  getQuote: (symbol: string) => StockQuote | undefined;
};

const MarketDataContext = createContext<MarketDataContextValue | null>(null);

const REFRESH_MS = 30_000;

export function MarketDataProvider({ children }: { children: ReactNode }) {
  const { data } = useApp();
  const [indices, setIndices] = useState<IndexQuote[]>([]);
  const [breadth, setBreadth] = useState<MarketBreadth | null>(null);
  const [quotes, setQuotes] = useState<Map<string, StockQuote>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const symbolsToFetch = useMemo(() => {
    const set = new Set<string>();
    for (const w of data.watchlist) {
      if (w.status !== 'removed') set.add(normalizeSymbol(w.symbol));
    }
    for (const h of data.holdings) {
      set.add(normalizeSymbol(h.symbol));
    }
    return [...set].filter(Boolean);
  }, [data.watchlist, data.holdings]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const errors: string[] = [];
    const [idx, br, qMap] = await Promise.all([
      fetchIndices().catch((e) => {
        errors.push(e instanceof Error ? e.message : '指数加载失败');
        return [] as Awaited<ReturnType<typeof fetchIndices>>;
      }),
      fetchMarketBreadth().catch(() => null),
      fetchStockQuotes(symbolsToFetch).catch((e) => {
        errors.push(e instanceof Error ? e.message : '个股行情失败');
        return new Map<string, import('../lib/market-api').StockQuote>();
      }),
    ]);
    setIndices(idx);
    setBreadth(br);
    setQuotes(qMap);
    setLastUpdated(new Date());
    if (errors.length && idx.length === 0 && qMap.size === 0) {
      setError(errors.join('；'));
    } else if (errors.length) {
      setError(`部分行情不可用（已尝试腾讯备用源）：${errors[0]}`);
    }
    setLoading(false);
  }, [symbolsToFetch]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const id = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const getQuote = useCallback(
    (symbol: string) => quotes.get(normalizeSymbol(symbol)),
    [quotes]
  );

  const value = useMemo(
    () => ({
      indices,
      breadth,
      quotes,
      loading,
      error,
      lastUpdated,
      refresh,
      getQuote,
    }),
    [
      indices,
      breadth,
      quotes,
      loading,
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
