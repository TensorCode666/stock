import { useSyncExternalStore } from 'react';
import type { StockQuote } from './market-api';
import { normalizeSymbol } from './symbols';

type Listener = () => void;

let quotesMap = new Map<string, StockQuote>();
let revision = 0;
const globalListeners = new Set<Listener>();
const symbolListeners = new Map<string, Set<Listener>>();

function notifyGlobal() {
  revision += 1;
  globalListeners.forEach((l) => l());
}

function notifySymbol(sym: string) {
  symbolListeners.get(sym)?.forEach((l) => l());
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

function collectChangedSymbols(
  prev: Map<string, StockQuote>,
  merged: Map<string, StockQuote>
): Set<string> {
  const changed = new Set<string>();
  for (const [sym, qa] of merged) {
    const pb = prev.get(sym);
    if (!pb || pb !== qa) changed.add(sym);
  }
  for (const sym of prev.keys()) {
    if (!merged.has(sym)) changed.add(sym);
  }
  return changed;
}

export const quotesStore = {
  getSnapshot(): Map<string, StockQuote> {
    return quotesMap;
  },
  getRevision(): number {
    return revision;
  },
  subscribe(listener: Listener): () => void {
    globalListeners.add(listener);
    return () => globalListeners.delete(listener);
  },
  subscribeSymbol(symbol: string, listener: Listener): () => void {
    const sym = normalizeSymbol(symbol);
    if (!sym) return () => {};
    let set = symbolListeners.get(sym);
    if (!set) {
      set = new Set();
      symbolListeners.set(sym, set);
    }
    set.add(listener);
    return () => {
      const listeners = symbolListeners.get(sym);
      if (!listeners) return;
      listeners.delete(listener);
      if (listeners.size === 0) symbolListeners.delete(sym);
    };
  },
  setQuotes(next: Map<string, StockQuote>): boolean {
    if (!quotesChanged(quotesMap, next)) return false;
    const merged = mergeQuotes(next);
    const changed = collectChangedSymbols(quotesMap, merged);
    quotesMap = merged;
    for (const sym of changed) notifySymbol(sym);
    notifyGlobal();
    return true;
  },
  getQuote(symbol: string): StockQuote | undefined {
    return quotesMap.get(normalizeSymbol(symbol));
  },
};

export function useQuote(symbol: string): StockQuote | undefined {
  const sym = normalizeSymbol(symbol);
  return useSyncExternalStore(
    (listener) => quotesStore.subscribeSymbol(sym, listener),
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
