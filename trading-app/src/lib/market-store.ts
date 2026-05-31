import { useCallback, useSyncExternalStore } from 'react';
import type { IndexQuote, MarketBreadth } from './market-api';

type MarketStatus = {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdated: Date | null;
};

type Listener = () => void;

let indices: IndexQuote[] = [];
let breadth: MarketBreadth | null = null;
let status: MarketStatus = {
  loading: true,
  refreshing: false,
  error: null,
  lastUpdated: null,
};

const indicesListeners = new Set<Listener>();
const breadthListeners = new Set<Listener>();
const statusListeners = new Set<Listener>();

const refreshRef: {
  current: (options?: { silent?: boolean }) => Promise<void>;
} = {
  current: async () => {},
};

function notifyIndices() {
  indicesListeners.forEach((l) => l());
}

function notifyBreadth() {
  breadthListeners.forEach((l) => l());
}

function notifyStatus() {
  statusListeners.forEach((l) => l());
}

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

export const marketStore = {
  getIndices(): IndexQuote[] {
    return indices;
  },
  getBreadth(): MarketBreadth | null {
    return breadth;
  },
  getStatus(): MarketStatus {
    return status;
  },
  setIndices(next: IndexQuote[]): boolean {
    if (!indicesChanged(indices, next)) return false;
    indices = next;
    notifyIndices();
    return true;
  },
  setBreadth(next: MarketBreadth | null): boolean {
    if (!breadthChanged(breadth, next)) return false;
    breadth = next;
    notifyBreadth();
    return true;
  },
  patchStatus(patch: Partial<MarketStatus>): boolean {
    const next = { ...status, ...patch };
    if (
      next.loading === status.loading &&
      next.refreshing === status.refreshing &&
      next.error === status.error &&
      next.lastUpdated === status.lastUpdated
    ) {
      return false;
    }
    status = next;
    notifyStatus();
    return true;
  },
  touchLastUpdated(): void {
    marketStore.patchStatus({ lastUpdated: new Date() });
  },
  setRefreshHandler(
    fn: (options?: { silent?: boolean }) => Promise<void>
  ): void {
    refreshRef.current = fn;
  },
  refresh(options?: { silent?: boolean }): Promise<void> {
    return refreshRef.current(options);
  },
  subscribeIndices(listener: Listener): () => void {
    indicesListeners.add(listener);
    return () => indicesListeners.delete(listener);
  },
  subscribeBreadth(listener: Listener): () => void {
    breadthListeners.add(listener);
    return () => breadthListeners.delete(listener);
  },
  subscribeStatus(listener: Listener): () => void {
    statusListeners.add(listener);
    return () => statusListeners.delete(listener);
  },
};

export function useMarketIndices(): IndexQuote[] {
  return useSyncExternalStore(
    marketStore.subscribeIndices,
    () => marketStore.getIndices(),
    () => []
  );
}

export function useMarketBreadth(): MarketBreadth | null {
  return useSyncExternalStore(
    marketStore.subscribeBreadth,
    () => marketStore.getBreadth(),
    () => null
  );
}

export function useMarketStatus(): MarketStatus {
  return useSyncExternalStore(
    marketStore.subscribeStatus,
    () => marketStore.getStatus(),
    () => ({
      loading: true,
      refreshing: false,
      error: null,
      lastUpdated: null,
    })
  );
}

export function useMarketRefresh(): (options?: {
  silent?: boolean;
}) => Promise<void> {
  return useCallback((options) => marketStore.refresh(options), []);
}
