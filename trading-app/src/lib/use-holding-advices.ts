import { useMemo } from 'react';
import {
  DEFAULT_HOLDING_ADVICE,
  evaluateHoldingAdvice,
  type HoldingAdvice,
} from './holding-advice';
import type { KlineBar } from './kline-indicators';
import { quotesStore, useQuotesRevision } from './quotes-store';
import { normalizeSymbol } from './symbols';
import type { Holding, MarketEnvScore } from '../types';

/** 持仓页批量建议：仅在报价 revision 变化时重算，避免每行重复 evaluate */
export function useHoldingAdvices(
  holdings: Holding[],
  klinesMap: Map<string, KlineBar[]>,
  envScore: MarketEnvScore | null | undefined
): Map<string, HoldingAdvice> {
  const quotesRevision = useQuotesRevision();

  return useMemo(() => {
    const map = new Map<string, HoldingAdvice>();
    for (const h of holdings) {
      const sym = normalizeSymbol(h.symbol);
      const bars = klinesMap.get(sym);
      map.set(
        h.id,
        bars?.length
          ? evaluateHoldingAdvice({
              holding: h,
              quote: quotesStore.getQuote(sym),
              bars,
              envScore: envScore ?? null,
            })
          : DEFAULT_HOLDING_ADVICE
      );
    }
    return map;
    // quotesRevision 驱动报价变化后的重算
  }, [holdings, klinesMap, envScore, quotesRevision]);
}
