import { suggestedSinglePosition } from './calculations';
import { normalizeSymbol } from './symbols';
import { newId, todayStr } from './storage';
import type { Holding, TradeMode, UserSettings, WatchlistItem } from '../types';

export function findHoldingBySymbol(
  holdings: Holding[],
  symbol: string
): Holding | undefined {
  const sym = normalizeSymbol(symbol);
  return holdings.find((h) => normalizeSymbol(h.symbol) === sym);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 按模式给出默认止损 / 目标（相对买入价） */
export function defaultStopTarget(
  buyPrice: number,
  mode: TradeMode
): { stopLoss: number; targetPrice: number } {
  if (buyPrice <= 0) return { stopLoss: 0, targetPrice: 0 };
  if (mode === 'emotion') {
    return {
      stopLoss: round2(buyPrice * 0.93),
      targetPrice: round2(buyPrice * 1.15),
    };
  }
  return {
    stopLoss: round2(buyPrice * 0.95),
    targetPrice: round2(buyPrice * 1.12),
  };
}

export function defaultSellConditions(mode: TradeMode): string {
  if (mode === 'emotion') {
    return '龙头断板或无法修复；跌破5日线；放量滞涨';
  }
  if (mode === 'etf') {
    return '跌破20日线；指数环境转弱；到达目标分批止盈';
  }
  return '跌破20日线；放量破位；3日不创新高';
}

/** 按总资金与模式建议仓位估算股数（A 股按 100 股一手） */
export function suggestShareCount(
  buyPrice: number,
  settings: UserSettings,
  mode: TradeMode
): number {
  if (buyPrice <= 0 || settings.totalCapital <= 0) return 100;
  const band = suggestedSinglePosition(mode, 'normal');
  const pct = (band.min + band.max) / 2;
  const amount = settings.totalCapital * (pct / 100);
  const raw = Math.floor(amount / buyPrice);
  const lots = Math.max(1, Math.floor(raw / 100));
  return lots * 100;
}

export function createHoldingDraft(
  item: WatchlistItem,
  buyPrice: number,
  settings: UserSettings
): Holding {
  const { stopLoss, targetPrice } = defaultStopTarget(buyPrice, item.mode);
  const sym = normalizeSymbol(item.symbol);
  return {
    id: newId(),
    symbol: sym,
    name: item.name,
    mode: item.mode,
    buyDate: todayStr(),
    buyPrice: round2(buyPrice),
    shares: suggestShareCount(buyPrice, settings, item.mode),
    stopLoss,
    targetPrice,
    sellConditions: defaultSellConditions(item.mode),
    notes: item.screenReasons?.length
      ? `观察池买入：${item.screenReasons.slice(0, 2).join('；')}`
      : '观察池买入',
  };
}
