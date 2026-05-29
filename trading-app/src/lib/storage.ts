import type { AppData } from '../types';

const STORAGE_KEY = 'stock-trading-system-v1';

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

export const defaultAppData: AppData = {
  settings: {
    totalCapital: 100000,
    maxLossPerTradePercent: 1.5,
  },
  envScores: [],
  watchlist: [],
  favorites: [],
  tradePlans: [],
  holdings: [],
  trades: [],
  dailyChecklists: [],
  practiceAttempts: [],
};

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultAppData };
    const parsed = JSON.parse(raw) as Partial<AppData>;
    const data: AppData = {
      ...defaultAppData,
      ...parsed,
      settings: { ...defaultAppData.settings, ...(parsed.settings ?? {}) },
      envScores: asArray(parsed.envScores),
      watchlist: asArray(parsed.watchlist),
      favorites: asArray(parsed.favorites),
      tradePlans: asArray(parsed.tradePlans),
      holdings: asArray(parsed.holdings),
      trades: asArray(parsed.trades),
      dailyChecklists: asArray(parsed.dailyChecklists),
      practiceAttempts: asArray(parsed.practiceAttempts),
    };
    data.watchlist = data.watchlist.filter(
      (w) => w && typeof w === 'object' && w.status !== 'removed'
    );
    return data;
  } catch {
    return { ...defaultAppData };
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
