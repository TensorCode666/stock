import type { AppData } from '../types';

const STORAGE_KEY = 'stock-trading-system-v1';

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
};

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultAppData };
    const parsed = JSON.parse(raw) as Partial<AppData>;
    const data = {
      ...defaultAppData,
      ...parsed,
      favorites: parsed.favorites ?? [],
    };
    data.watchlist = data.watchlist.filter((w) => w.status !== 'removed');
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
