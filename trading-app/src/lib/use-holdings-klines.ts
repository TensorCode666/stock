import { useEffect, useRef, useState } from 'react';
import { fetchKlinesCached } from './kline-cache';
import type { KlineBar } from './kline-indicators';

/** 按持仓 symbol 增量拉取 K 线，已有缓存的不重复请求 */
export function useHoldingsKlines(symbolsKey: string): {
  klinesMap: Map<string, KlineBar[]>;
  loading: boolean;
} {
  const cacheRef = useRef(new Map<string, KlineBar[]>());
  const [klinesMap, setKlinesMap] = useState<Map<string, KlineBar[]>>(
    () => new Map()
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const symbols = symbolsKey ? symbolsKey.split(',').filter(Boolean) : [];

    for (const key of [...cacheRef.current.keys()]) {
      if (!symbols.includes(key)) cacheRef.current.delete(key);
    }

    if (symbols.length === 0) {
      setKlinesMap(new Map());
      setLoading(false);
      return;
    }

    const missing = symbols.filter((sym) => !cacheRef.current.get(sym)?.length);
    setKlinesMap(new Map(cacheRef.current));

    if (missing.length === 0) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void Promise.all(
      missing.map(async (sym) => {
        const bars = await fetchKlinesCached(sym, 'day', 40);
        if (!cancelled && bars?.length) {
          cacheRef.current.set(sym, bars);
        }
      })
    ).then(() => {
      if (!cancelled) {
        setKlinesMap(new Map(cacheRef.current));
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [symbolsKey]);

  return { klinesMap, loading };
}
