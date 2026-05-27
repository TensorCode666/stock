import type { IndexQuote, MarketBreadth } from './market-api';

export interface MarketEnvAiResult {
  indexTrend: 0 | 1 | 2;
  mainSector: 0 | 1 | 2;
  profitEffect: 0 | 1 | 2;
  emotionCycle: 0 | 1 | 2;
  volume: 0 | 1 | 2;
  emotionStage: string;
  totalScore: number;
  summary: string;
  reasons: Record<string, string>;
}

const DIM_LABELS: Record<string, string> = {
  indexTrend: '指数趋势',
  mainSector: '主线板块',
  profitEffect: '赚钱效应',
  emotionCycle: '情绪周期',
  volume: '成交量',
};

function scoreIndexTrend(indices: IndexQuote[]): {
  score: 0 | 1 | 2;
  reason: string;
} {
  const sh = indices.find((i) => i.code === '000001');
  const sz = indices.find((i) => i.code === '399001');
  const cy = indices.find((i) => i.code === '399006');
  const avg =
    indices.reduce((s, i) => s + i.changePercent, 0) / (indices.length || 1);
  const cp = sh?.changePercent ?? avg;

  let score: 0 | 1 | 2 = 1;
  if (cp > 0.5) score = 2;
  else if (cp < -0.5) score = 0;
  else if (cp > 0.15) score = 2;
  else if (cp < -0.15) score = 0;

  const parts = [
    sh && `上证 ${sh.changePercent.toFixed(2)}%`,
    sz && `深证 ${sz.changePercent.toFixed(2)}%`,
    cy && `创业板 ${cy.changePercent.toFixed(2)}%`,
  ].filter(Boolean);

  return {
    score,
    reason: `${parts.join('，')}；综合判断指数${score === 2 ? '偏强' : score === 0 ? '偏弱' : '震荡'}。`,
  };
}

function scoreMainSector(indices: IndexQuote[]): {
  score: 0 | 1 | 2;
  reason: string;
} {
  if (indices.length < 2) {
    return { score: 1, reason: '指数数据不足，暂按板块轮动处理。' };
  }
  const changes = indices.map((i) => i.changePercent);
  const max = Math.max(...changes);
  const min = Math.min(...changes);
  const spread = max - min;
  const leader = indices.find((i) => i.changePercent === max);

  let score: 0 | 1 | 2 = 1;
  if (spread < 0.4 && max > 0.3 && min > -0.3) {
    score = 2;
  } else if (spread > 1.2) {
    score = 0;
  } else if (spread > 0.6) {
    score = 1;
  } else if (max > 0.4) {
    score = 2;
  }

  return {
    score,
    reason:
      score === 2
        ? `各指数涨跌接近（极差 ${spread.toFixed(2)}%），${leader?.name ?? '市场'}领涨，主线相对清晰。`
        : score === 0
          ? `指数分化大（极差 ${spread.toFixed(2)}%），缺乏统一主线。`
          : `板块快速轮动（${leader?.name ?? ''} ${max >= 0 ? '+' : ''}${max.toFixed(2)}%），主线不清晰。`,
  };
}

function scoreProfitEffect(breadth: MarketBreadth | null): {
  score: 0 | 1 | 2;
  reason: string;
} {
  if (!breadth) {
    return { score: 1, reason: '暂无涨跌家数，按中性处理。' };
  }
  const { up, down, flat, upRatio } = breadth;
  let score: 0 | 1 | 2 = 1;
  if (upRatio >= 0.58) score = 2;
  else if (upRatio <= 0.38) score = 0;
  else if (upRatio >= 0.48) score = 1;

  return {
    score,
    reason: `涨 ${up} / 跌 ${down} / 平 ${flat}，上涨占比约 ${(upRatio * 100).toFixed(0)}%，赚钱效应${score === 2 ? '较强' : score === 0 ? '偏弱' : '一般'}。`,
  };
}

function scoreEmotionCycle(
  indexTrend: 0 | 1 | 2,
  profitEffect: 0 | 1 | 2,
  breadth: MarketBreadth | null
): { score: 0 | 1 | 2; stage: string; reason: string } {
  const upRatio = breadth?.upRatio ?? 0.5;
  let stage = '修复期';
  let score: 0 | 1 | 2 = 1;

  if (indexTrend === 0 && profitEffect === 0) {
    stage = '冰点期';
    score = 0;
  } else if (indexTrend === 0 || profitEffect === 0) {
    stage = '退潮期';
    score = 0;
  } else if (indexTrend === 2 && profitEffect === 2 && upRatio >= 0.55) {
    stage = '主升期';
    score = 2;
  } else if (indexTrend === 2 && upRatio >= 0.52) {
    stage = '启动期';
    score = 2;
  } else if (profitEffect === 2 && indexTrend >= 1) {
    stage = '修复期';
    score = 1;
  } else if (upRatio > 0.65 && indexTrend === 2) {
    stage = '高潮期';
    score = 1;
  }

  return {
    score,
    stage,
    reason: `结合指数与涨跌家数，当前处于「${stage}」，情绪${score === 2 ? '适合参与' : score === 0 ? '宜防守' : '需精选'}。`,
  };
}

function scoreVolume(indices: IndexQuote[]): {
  score: 0 | 1 | 2;
  reason: string;
} {
  const avgAbs =
    indices.reduce((s, i) => s + Math.abs(i.changePercent), 0) /
    (indices.length || 1);
  const avg = indices.reduce((s, i) => s + i.changePercent, 0) / (indices.length || 1);

  let score: 0 | 1 | 2 = 1;
  if (avgAbs < 0.25) score = 0;
  else if (avgAbs > 1.2) score = 2;
  else if (avgAbs > 0.6) score = 2;
  else if (avgAbs < 0.4) score = 0;

  const volDesc =
    score === 2
      ? '波动放大，成交相对活跃'
      : score === 0
        ? '波动收窄，量能偏弱'
        : '量能平稳';

  return {
    score,
    reason: `三大指数平均波动 ${avgAbs.toFixed(2)}%，方向 ${avg >= 0 ? '偏多' : '偏空'}，${volDesc}。`,
  };
}

/** 基于实时行情的智能评分（规则引擎 + 多维度解释） */
export function scoreMarketEnvWithAi(
  indices: IndexQuote[],
  breadth: MarketBreadth | null
): MarketEnvAiResult | null {
  if (!indices.length) return null;

  const indexR = scoreIndexTrend(indices);
  const sectorR = scoreMainSector(indices);
  const profitR = scoreProfitEffect(breadth);
  const volumeR = scoreVolume(indices);
  const emotionR = scoreEmotionCycle(
    indexR.score,
    profitR.score,
    breadth
  );

  const scores = {
    indexTrend: indexR.score,
    mainSector: sectorR.score,
    profitEffect: profitR.score,
    emotionCycle: emotionR.score,
    volume: volumeR.score,
  };

  const reasons: Record<string, string> = {
    indexTrend: indexR.reason,
    mainSector: sectorR.reason,
    profitEffect: profitR.reason,
    emotionCycle: emotionR.reason,
    volume: volumeR.reason,
  };

  const totalScore = (Object.values(scores) as number[]).reduce(
    (a, b) => a + b,
    0
  );
  const weak = Object.entries(scores).filter(([, v]) => v === 0).length;
  const strong = Object.entries(scores).filter(([, v]) => v === 2).length;

  let summary = `AI 综合评分 ${totalScore}/10：`;
  if (totalScore >= 8) summary += '环境偏多，可积极按系统模式交易。';
  else if (totalScore >= 5) summary += '环境中性，宜轻仓、精选标的。';
  else if (totalScore >= 3) summary += '环境偏弱，以观察为主。';
  else summary += '环境较差，建议空仓或极轻仓。';
  if (weak >= 2) summary += ` 注意 ${weak} 项维度偏弱。`;
  if (strong >= 3) summary += ` ${strong} 项维度偏强。`;

  return {
    ...scores,
    emotionStage: emotionR.stage,
    totalScore,
    summary,
    reasons,
  };
}

export { DIM_LABELS };
