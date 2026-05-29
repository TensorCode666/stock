import { envScoreLabel, envScoreTotal } from './calculations';
import {
  evaluateTrendStockDetailed,
  type KlineBar,
} from './stock-screener';
import type { Holding, MarketEnvScore } from '../types';
import type { StockQuote } from './market-api';

export type HoldingAdviceAction = 'add' | 'reduce' | 'hold' | 'clear';
export type AdviceUrgency = 'low' | 'medium' | 'high';

export interface HoldingAdvice {
  action: HoldingAdviceAction;
  label: string;
  reasons: string[];
  confidence: number;
  urgency: AdviceUrgency;
}

export const ADVICE_LABELS: Record<HoldingAdviceAction, string> = {
  add: '加仓',
  reduce: '减仓',
  hold: '持有',
  clear: '清仓',
};

export const ADVICE_TAG_CLASS: Record<HoldingAdviceAction, string> = {
  add: 'tag-ok',
  hold: 'tag',
  reduce: 'tag-bad',
  clear: 'tag-bad',
};

interface AdviceSignal {
  action: HoldingAdviceAction;
  reason: string;
  weight: number;
  urgency: AdviceUrgency;
}

export interface HoldingAdviceInput {
  holding: Holding;
  quote?: StockQuote;
  bars?: KlineBar[] | null;
  envScore?: MarketEnvScore | null;
}

function ma(closes: number[], n: number): number {
  if (closes.length < n) return 0;
  const slice = closes.slice(-n);
  return slice.reduce((a, b) => a + b, 0) / n;
}

function tradingDaysSinceBuy(buyDate: string, bars: KlineBar[]): number {
  const buy = buyDate.slice(0, 10);
  return bars.filter((b) => b.date >= buy).length;
}

function daysSinceNewHigh(bars: KlineBar[]): number {
  if (bars.length < 4) return 0;
  const recent = bars.slice(-10);
  const maxHigh = Math.max(...recent.map((b) => b.high));
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i]!.high >= maxHigh * 0.998) {
      return recent.length - 1 - i;
    }
  }
  return recent.length;
}

function volumeStagnationAtHigh(bars: KlineBar[]): boolean {
  if (bars.length < 6) return false;
  const last = bars[bars.length - 1]!;
  const prev5 = bars.slice(-6, -1);
  const avgVol = prev5.reduce((s, b) => s + b.volume, 0) / prev5.length;
  const nearHigh = last.close >= Math.max(...prev5.map((b) => b.high)) * 0.97;
  return nearHigh && last.volume > avgVol * 1.5 && last.close <= last.open;
}

function buildAdvice(signals: AdviceSignal[]): HoldingAdvice {
  if (signals.length === 0) {
    return {
      action: 'hold',
      label: ADVICE_LABELS.hold,
      reasons: ['暂无足够数据，默认持有观察'],
      confidence: 30,
      urgency: 'low',
    };
  }

  const byAction = new Map<HoldingAdviceAction, AdviceSignal[]>();
  for (const s of signals) {
    const list = byAction.get(s.action) ?? [];
    list.push(s);
    byAction.set(s.action, list);
  }

  const score = (action: HoldingAdviceAction) =>
    (byAction.get(action) ?? []).reduce((sum, s) => sum + s.weight, 0);

  const urgencyRank: Record<AdviceUrgency, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  const pickAction = (): HoldingAdviceAction => {
    const clear = byAction.get('clear') ?? [];
    if (clear.some((s) => s.urgency === 'high') || score('clear') >= 8) {
      return 'clear';
    }
    if (score('reduce') >= 6 || score('clear') >= 4) {
      return score('clear') > score('reduce') ? 'clear' : 'reduce';
    }
    if (score('add') >= 5 && score('clear') === 0 && score('reduce') < 4) {
      return 'add';
    }
    if (score('reduce') >= 3) return 'reduce';
    if (score('add') >= 3 && score('reduce') === 0) return 'add';
    return 'hold';
  };

  const action = pickAction();
  const matched =
    action === 'hold'
      ? signals.filter((s) => s.action === 'hold')
      : (byAction.get(action) ?? []);

  const holdFallback =
    matched.length === 0
      ? [{ action: 'hold' as const, reason: '趋势未破坏，继续持有', weight: 2, urgency: 'low' as const }]
      : matched;

  const reasons = holdFallback.map((s) => s.reason);
  const totalWeight = holdFallback.reduce((s, x) => s + x.weight, 0);
  const maxWeight = holdFallback.length * 5;
  const confidence = Math.min(
    95,
    Math.max(35, Math.round((totalWeight / Math.max(maxWeight, 1)) * 100))
  );
  const urgency = holdFallback.reduce<AdviceUrgency>(
    (best, s) => (urgencyRank[s.urgency] > urgencyRank[best] ? s.urgency : best),
    'low'
  );

  return {
    action,
    label: ADVICE_LABELS[action],
    reasons,
    confidence,
    urgency,
  };
}

/** 基于 trading-system 卖出/加仓规则，对单条持仓给出建议（仅参考，不自动交易） */
export function evaluateHoldingAdvice(input: HoldingAdviceInput): HoldingAdvice {
  const { holding, quote, bars, envScore } = input;
  const signals: AdviceSignal[] = [];
  const price = quote?.price ?? (bars?.length ? bars[bars.length - 1]!.close : 0);
  const changePercent = quote?.changePercent ?? 0;

  if (price <= 0) {
    return {
      action: 'hold',
      label: ADVICE_LABELS.hold,
      reasons: ['暂无行情，无法评估'],
      confidence: 0,
      urgency: 'low',
    };
  }

  const envTotal = envScore ? envScoreTotal(envScore) : null;
  const pnlPct =
    holding.buyPrice > 0
      ? ((price - holding.buyPrice) / holding.buyPrice) * 100
      : 0;

  // —— 硬止损 / 清仓信号 ——
  if (holding.stopLoss > 0 && price <= holding.stopLoss) {
    signals.push({
      action: 'clear',
      reason: `现价 ${price.toFixed(2)} 已触及/跌破计划止损 ${holding.stopLoss.toFixed(2)}`,
      weight: 10,
      urgency: 'high',
    });
  }

  if (holding.stopLoss > 0 && price <= holding.stopLoss * 1.02) {
    signals.push({
      action: 'reduce',
      reason: '接近止损价，宜提前减仓降低风险',
      weight: 4,
      urgency: 'medium',
    });
  }

  // —— K 线 / 均线结构 ——
  let ma5 = 0;
  let ma10 = 0;
  let ma20 = 0;
  if (bars && bars.length >= 20) {
    const closes = bars.map((b) => b.close);
    ma5 = ma(closes, 5);
    ma10 = ma(closes, 10);
    ma20 = ma(closes, 20);

    if (ma20 > 0 && price < ma20 * 0.97) {
      signals.push({
        action: 'clear',
        reason: '跌破20日线过多，硬止损规则',
        weight: 8,
        urgency: 'high',
      });
    } else if (ma20 > 0 && price < ma20) {
      signals.push({
        action: 'clear',
        reason: '跌破20日线且未收回，趋势破坏',
        weight: 6,
        urgency: 'high',
      });
    }

    if (ma5 && ma10 && ma20 && !(ma5 > ma10 && ma10 > ma20)) {
      signals.push({
        action: 'clear',
        reason: '均线非多头排列，趋势转弱',
        weight: 5,
        urgency: 'medium',
      });
    }

    const days = tradingDaysSinceBuy(holding.buyDate, bars);
    if (days >= 5 && days <= 10 && pnlPct < 3) {
      signals.push({
        action: 'reduce',
        reason: `买入后约 ${days} 个交易日涨幅不足，时间止损`,
        weight: 5,
        urgency: 'medium',
      });
    }

    const noHighDays = daysSinceNewHigh(bars);
    if (noHighDays >= 3 && holding.mode !== 'etf') {
      signals.push({
        action: 'reduce',
        reason: `${noHighDays} 日未创新高，短线转弱`,
        weight: 4,
        urgency: 'medium',
      });
    }

    if (volumeStagnationAtHigh(bars)) {
      signals.push({
        action: 'reduce',
        reason: '高位放量滞涨，考虑分批止盈',
        weight: 5,
        urgency: 'medium',
      });
    }

    // 加仓：回踩支撑 + 趋势完好
    const nearMa20 =
      ma20 > 0 && price <= ma20 * 1.03 && price >= ma20 * 0.98;
    const bullAlign = ma5 > ma10 && ma10 > ma20;
    if (bullAlign && nearMa20 && price > holding.stopLoss) {
      signals.push({
        action: 'add',
        reason: '趋势完好且接近20日线支撑，可考虑计划内加仓',
        weight: 6,
        urgency: 'low',
      });
    } else if (bullAlign && price >= ma20 && price <= ma5 * 1.05) {
      signals.push({
        action: 'add',
        reason: '均线多头，贴近短期均线运行',
        weight: 4,
        urgency: 'low',
      });
    }

    if (bullAlign && ma20 > 0 && price > ma20) {
      signals.push({
        action: 'hold',
        reason: '趋势未破坏，5/10/20 日均线多头',
        weight: 4,
        urgency: 'low',
      });
    }
  }

  // 复用选股规则做趋势/ETF 结构参考
  if (bars && bars.length >= 22 && (holding.mode === 'trend' || holding.mode === 'etf')) {
    const trendEv = evaluateTrendStockDetailed(
      bars,
      changePercent,
      2,
      envTotal !== null ? Math.min(4, Math.ceil(envTotal / 2.5)) : 2
    );
    if (trendEv) {
      for (const f of trendEv.fails) {
        if (f.includes('20日线') || f.includes('均线')) {
          signals.push({ action: 'clear', reason: f, weight: 4, urgency: 'medium' });
        } else if (f.includes('涨幅') || f.includes('跌幅')) {
          signals.push({ action: 'reduce', reason: f, weight: 3, urgency: 'medium' });
        }
      }
      if (trendEv.passed && trendEv.status === 'ready') {
        signals.push({
          action: 'add',
          reason: '仍符合趋势观察规则，接近买点',
          weight: 3,
          urgency: 'low',
        });
      }
    }
  }

  // —— 止盈 / 目标价 ——
  if (holding.targetPrice > 0 && price >= holding.targetPrice) {
    signals.push({
      action: 'reduce',
      reason: `到达目标价 ${holding.targetPrice.toFixed(2)}，建议分批止盈 1/3`,
      weight: 7,
      urgency: 'medium',
    });
  } else if (
    holding.targetPrice > 0 &&
    price >= holding.targetPrice * 0.95
  ) {
    signals.push({
      action: 'reduce',
      reason: '接近目标价，可提前减部分仓位',
      weight: 4,
      urgency: 'low',
    });
  }

  // —— 模式差异 ——
  if (holding.mode === 'emotion') {
    if (changePercent <= -5) {
      signals.push({
        action: 'clear',
        reason: '情绪票大跌，按计划快速退出',
        weight: 7,
        urgency: 'high',
      });
    } else if (changePercent >= 8 && pnlPct > 5) {
      signals.push({
        action: 'reduce',
        reason: '情绪票高位强势，宜止盈不恋战',
        weight: 6,
        urgency: 'medium',
      });
    } else if (changePercent >= 5 && pnlPct < 0) {
      signals.push({
        action: 'clear',
        reason: '情绪票弱势反弹，不符合持股逻辑',
        weight: 4,
        urgency: 'medium',
      });
    }
  }

  if (holding.mode === 'etf' && envTotal !== null && envTotal <= 2) {
    signals.push({
      action: 'reduce',
      reason: '市场环境极差，ETF 宜降仓防守',
      weight: 5,
      urgency: 'medium',
    });
  }

  // —— 环境分 ——
  if (envTotal !== null) {
    const envInfo = envScoreLabel(envTotal);
    if (envTotal <= 2) {
      signals.push({
        action: 'reduce',
        reason: `环境 ${envTotal}/10（${envInfo.label}），降低仓位`,
        weight: 5,
        urgency: 'medium',
      });
    } else if (envTotal >= 8 && holding.mode === 'trend') {
      signals.push({
        action: 'add',
        reason: `环境 ${envTotal}/10 积极，趋势股允许回踩加仓`,
        weight: 3,
        urgency: 'low',
      });
    } else if (envTotal >= 5) {
      signals.push({
        action: 'hold',
        reason: `环境 ${envTotal}/10，${envInfo.action}`,
        weight: 2,
        urgency: 'low',
      });
    }
  }

  // 默认持有
  if (signals.filter((s) => s.action !== 'hold').length === 0) {
    signals.push({
      action: 'hold',
      reason:
        pnlPct >= 0
          ? `浮盈 ${pnlPct.toFixed(1)}%，无卖出信号，继续持有`
          : `浮亏 ${Math.abs(pnlPct).toFixed(1)}%，未触发止损，继续观察`,
      weight: 3,
      urgency: 'low',
    });
  }

  return buildAdvice(signals);
}
