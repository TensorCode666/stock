import { useSyncExternalStore } from 'react';
import type { AppData, WatchlistItem } from '../types';
import { loadData } from './storage';
import { normalizeSymbol, symbolsKey } from './symbols';

type Listener = () => void;

type AppSliceKey = keyof AppData;

let appData: AppData = loadData();
let symbolsKeyValue = computeSymbolsKey(appData);

const sliceListeners = new Map<AppSliceKey, Set<Listener>>();
const symbolsKeyListeners = new Set<Listener>();

function computeSymbolsKey(data: AppData): string {
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
}

function notifySlice(key: AppSliceKey) {
  sliceListeners.get(key)?.forEach((l) => l());
}

function notifySymbolsKey() {
  symbolsKeyListeners.forEach((l) => l());
}

function ensureSliceListeners(key: AppSliceKey) {
  if (!sliceListeners.has(key)) {
    sliceListeners.set(key, new Set());
  }
}

export const appStore = {
  getData(): AppData {
    return appData;
  },
  getSlice<K extends AppSliceKey>(key: K): AppData[K] {
    return appData[key];
  },
  getSymbolsKey(): string {
    return symbolsKeyValue;
  },
  findWatchlistItem(
    symbol: string,
    watchlistId?: string
  ): WatchlistItem | undefined {
    const code = normalizeSymbol(symbol);
    return appData.watchlist.find(
      (w) =>
        w.status !== 'removed' &&
        (w.id === watchlistId || normalizeSymbol(w.symbol) === code)
    );
  },
  syncData(next: AppData): void {
    const prev = appData;
    appData = next;
    const keys = Object.keys(next) as AppSliceKey[];
    for (const key of keys) {
      if (next[key] !== prev[key]) {
        notifySlice(key);
      }
    }
    const nextSymbolsKey = computeSymbolsKey(next);
    if (nextSymbolsKey !== symbolsKeyValue) {
      symbolsKeyValue = nextSymbolsKey;
      notifySymbolsKey();
    }
  },
  subscribeSlice(key: AppSliceKey, listener: Listener): () => void {
    ensureSliceListeners(key);
    sliceListeners.get(key)!.add(listener);
    return () => sliceListeners.get(key)!.delete(listener);
  },
  subscribeSymbolsKey(listener: Listener): () => void {
    symbolsKeyListeners.add(listener);
    return () => symbolsKeyListeners.delete(listener);
  },
};

export function useAppSlice<K extends AppSliceKey>(key: K): AppData[K] {
  return useSyncExternalStore(
    (listener) => appStore.subscribeSlice(key, listener),
    () => appStore.getSlice(key),
    () => appStore.getSlice(key)
  );
}

export function useAppSymbolsKey(): string {
  return useSyncExternalStore(
    appStore.subscribeSymbolsKey,
    () => appStore.getSymbolsKey(),
    () => appStore.getSymbolsKey()
  );
}

export function useWatchlistItem(
  symbol: string,
  watchlistId?: string
): WatchlistItem | undefined {
  const code = normalizeSymbol(symbol);
  return useSyncExternalStore(
    (listener) => appStore.subscribeSlice('watchlist', listener),
    () => appStore.findWatchlistItem(code, watchlistId),
    () => undefined
  );
}
