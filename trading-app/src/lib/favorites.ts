import type { FavoriteStock } from '../types';
import { normalizeSymbol } from './symbols';

export function isFavorite(
  favorites: FavoriteStock[],
  symbol: string
): boolean {
  const code = normalizeSymbol(symbol);
  return favorites.some((f) => normalizeSymbol(f.symbol) === code);
}

/** 相对加入时价格的涨跌幅（%） */
export function pnlPercentFromInitial(
  initialPrice: number,
  currentPrice: number
): number | null {
  if (initialPrice <= 0 || currentPrice <= 0) return null;
  return ((currentPrice - initialPrice) / initialPrice) * 100;
}

export function formatPnlPercent(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function formatAddedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
