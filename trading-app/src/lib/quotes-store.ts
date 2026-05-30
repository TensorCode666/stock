import { useSyncExternalStore } from 'react';
import type { StockQuote } from './market-api';
import { normalizeSymbol } from './symbols';

type Listener = () => void;

let quotesMap = new Map<string, StockQuote>();
let revision = 0;
const listeners = new Set<Listener>();

function notify() {
  revision += 1;
  listeners.forEach((l) => l());
}

function quoteEqual(a: StockQuote, b: StockQuote): boolean {
  return a.price === b.price && a.changePercent === b.changePercent;
}

function quotesChanged(
  prev: Map<string, StockQuote>,
  next: Map<string, StockQuote>
): boolean {
  if (prev.size !== next.size) return true;
  for (const [sym, qa] of next) {
    const qb = prev.get(sym);
    if (!qb || !quoteEqual(qb, qa)) return true;
  }
  return false;
}

/** 合并报价并保持未变对象的引用，便于 useSyncExternalStore 细粒度订阅 */
function mergeQuotes(next: Map<string, StockQuote>): Map<string, StockQuote> {
  const merged = new Map<string, StockQuote>();
  for (const [sym, qa] of next) {
    const prev = quotesMap.get(sym);
    merged.set(sym, prev && quoteEqual(prev, qa) ? prev : qa);
  }
  return merged;
}

export const quotesStore = {
  getSnapshot(): Map<string, StockQuote> {
    return quotesMap;
  },
  getRevision(): number {
    return revision;
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setQuotes(next: Map<string, StockQuote>): boolean {
    if (!quotesChanged(quotesMap, next)) return false;
    quotesMap = mergeQuotes(next);
    notify();
    return true;
  },
  getQuote(symbol: string): StockQuote | undefined {
    return quotesMap.get(normalizeSymbol(symbol));
  },
};

export function useQuote(symbol: string): StockQuote | undefined {
  const sym = normalizeSymbol(symbol);
  return useSyncExternalStore(
    quotesStore.subscribe,
    () => quotesStore.getQuote(sym),
    () => undefined
  );
}

/** 任意报价变化时递增，用于批量 derived 计算（如持仓建议） */
export function useQuotesRevision(): number {
  return useSyncExternalStore(
    quotesStore.subscribe,
    () => quotesStore.getRevision(),
    () => 0
  );
}
