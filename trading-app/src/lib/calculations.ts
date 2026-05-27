import type { MarketEnvScore, WatchlistItem } from '../types';

export function envScoreTotal(s: MarketEnvScore): number {
  return (
    s.indexTrend +
    s.mainSector +
    s.profitEffect +
    s.emotionCycle +
    s.volume
  );
}

export function envScoreLabel(total: number): {
  label: string;
  action: string;
  positionRange: string;
  color: 'green' | 'yellow' | 'orange' | 'red';
} {
  if (total >= 8) {
    return {
      label: '积极交易',
      action: '允许趋势持股、回踩加仓、情绪前排',
      positionRange: '总仓位 60%–90%',
      color: 'green',
    };
  }
  if (total >= 5) {
    return {
      label: '谨慎交易',
      action: '只做低风险机会，轻仓试错',
      positionRange: '总仓位 20%–50%',
      color: 'yellow',
    };
  }
  if (total >= 3) {
    return {
      label: '轻仓观察',
      action: '以观察为主，极少开仓',
      positionRange: '总仓位 0%–20%',
      color: 'orange',
    };
  }
  return {
    label: '空仓等待',
    action: '不选股、不交易，复盘与等待',
    positionRange: '总仓位 0%',
    color: 'red',
  };
}

export function stockScoreTotal(item: WatchlistItem): number {
  const { scores } = item;
  return (
    scores.marketEnv +
    scores.sector +
    scores.trend +
    scores.volumePrice +
    scores.buyPointClarity +
    scores.riskReward
  );
}

export function stockScoreLabel(total: number): {
  label: string;
  action: string;
} {
  if (total >= 16) {
    return { label: '重点观察', action: '可等待买点，符合模式后可计划买入' };
  }
  if (total >= 12) {
    return { label: '普通观察', action: '仅允许轻仓，需更严格买点' };
  }
  if (total >= 8) {
    return { label: '只观察', action: '不交易，继续跟踪' };
  }
  return { label: '剔除', action: '移出观察池' };
}

export function riskRewardRatio(
  buy: number,
  stop: number,
  target: number
): number | null {
  if (buy <= 0 || stop >= buy || target <= buy) return null;
  const risk = buy - stop;
  const reward = target - buy;
  if (risk <= 0) return null;
  return reward / risk;
}

export function positionFromRisk(
  totalCapital: number,
  maxLossPercent: number,
  stopLossPercent: number
): number {
  if (stopLossPercent <= 0) return 0;
  const maxLoss = totalCapital * (maxLossPercent / 100);
  return maxLoss / (stopLossPercent / 100);
}

export function suggestedSinglePosition(
  mode: 'trend' | 'emotion' | 'etf',
  quality: 'high' | 'normal' | 'trial'
): { min: number; max: number; label: string } {
  if (mode === 'etf') {
    return { min: 5, max: 10, label: 'ETF 分批每次 5%–10%' };
  }
  if (mode === 'emotion') {
    return { min: 5, max: 15, label: '情绪短线 5%–15%' };
  }
  if (quality === 'high') {
    return { min: 15, max: 25, label: '高质量趋势股 15%–25%' };
  }
  if (quality === 'trial') {
    return { min: 0, max: 10, label: '试错仓不超过 10%' };
  }
  return { min: 10, max: 15, label: '普通趋势股 10%–15%' };
}

export const TRADE_MODE_LABELS: Record<string, string> = {
  trend: '趋势股',
  emotion: '情绪短线',
  etf: 'ETF / 指数',
};

export const CLASSIFICATION_LABELS: Record<string, string> = {
  system_profit: '系统内盈利',
  system_loss: '系统内亏损',
  violation_profit: '系统外盈利（风险）',
  violation_loss: '系统外亏损',
};
