import { useMemo } from 'react';
import {
  DEFAULT_HOLDING_ADVICE,
  evaluateHoldingAdvice,
  type HoldingAdvice,
} from './holding-advice';
import type { KlineBar } from './kline-indicators';
import { quotesStore, useQuotesFingerprint } from './quotes-store';
import { normalizeSymbol, symbolsKey } from './symbols';
import type { Holding, MarketEnvScore } from '../types';

/** 持仓页批量建议：仅持仓 symbol 报价变化时重算 */
export function useHoldingAdvices(
  holdings: Holding[],
  klinesMap: Map<string, KlineBar[]>,
  envScore: MarketEnvScore | null | undefined,
  holdingSymbolsKey?: string
): Map<string, HoldingAdvice> {
  const symbolsKeyValue =
    holdingSymbolsKey ??
    symbolsKey(holdings.map((h) => normalizeSymbol(h.symbol)).filter(Boolean));
  const quotesFingerprint = useQuotesFingerprint(symbolsKeyValue);

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
  }, [holdings, klinesMap, envScore, quotesFingerprint]);
}
