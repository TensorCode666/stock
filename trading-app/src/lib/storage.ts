import type { AppData, PracticeAttempt } from '../types';

export const STORAGE_KEY = 'stock-trading-system-v1';
export const MAX_PRACTICE_ATTEMPTS = 200;

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

/** 本地日历日期 YYYY-MM-DD（非 UTC） */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayStr(): string {
  return formatLocalDate(new Date());
}

export function normalizeAppData(parsed: Partial<AppData> | null | undefined): AppData {
  if (!parsed || typeof parsed !== 'object') {
    return { ...defaultAppData };
  }
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
  data.practiceAttempts = trimPracticeAttempts(data.practiceAttempts);
  return data;
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultAppData };
    return normalizeAppData(JSON.parse(raw) as Partial<AppData>);
  } catch {
    return { ...defaultAppData };
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...data,
      practiceAttempts: trimPracticeAttempts(data.practiceAttempts ?? []),
    })
  );
}

export function trimPracticeAttempts(
  attempts: PracticeAttempt[]
): PracticeAttempt[] {
  if (attempts.length <= MAX_PRACTICE_ATTEMPTS) return attempts;
  return attempts.slice(-MAX_PRACTICE_ATTEMPTS);
}

export function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
