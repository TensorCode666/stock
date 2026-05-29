import { stockScoreTotal } from './calculations';
import { enrichBars, fetchKlines, type EnrichedBar } from './kline-indicators';
import {
  evaluateEmotionStockDetailed,
  evaluateEtf,
  evaluateTrendStockDetailed,
  type KlineBar,
} from './stock-screener';
import { normalizeSymbol } from './symbols';
import type { PracticeAttempt, TradeMode, WatchlistItem } from '../types';

export type PracticeContext = {
  symbol: string;
  name: string;
  asOfDate: string;
  requestedDate: string;
  mode: TradeMode;
  envTotal: number;
  turnoverRatio: number;
  turnoverEstimated: boolean;
  changePercent: number;
  bars: EnrichedBar[];
  price: number;
  ma5: number;
  ma10: number;
  ma20: number;
};

export type PracticeVerdict = {
  shouldWatchlist: boolean;
  status: 'watch' | 'ready' | 'reject';
  totalScore: number;
  passedRules: boolean;
  reasons: string[];
  fails: string[];
  scores?: WatchlistItem['scores'];
};

export type PracticeGrade = {
  correct: boolean;
  statusCorrect: boolean;
  verdict: PracticeVerdict;
  feedback: string[];
};

function envToScorePart(envTotal: number): number {
  if (envTotal >= 8) return 4;
  if (envTotal >= 5) return 3;
  if (envTotal >= 3) return 2;
  return 1;
}

/** 练习需至少 22 根日 K；腾讯接口单次最多约 640 根 */
const PRACTICE_KLINE_LIMIT = 640;
const MIN_BARS_FOR_TREND = 22;

/** 截取截至指定日期的 K 线（含当日） */
export function sliceBarsAsOf(bars: KlineBar[], asOfDate: string): KlineBar[] {
  return bars.filter((b) => b.date.slice(0, 10) <= asOfDate.slice(0, 10));
}

/** 解析为最近的有效交易日（不晚于指定日期） */
export function resolveTradingDate(
  bars: KlineBar[],
  date: string
): string | null {
  const sliced = sliceBarsAsOf(bars, date);
  if (!sliced.length) return null;
  return sliced[sliced.length - 1]!.date.slice(0, 10);
}

/** 当日涨跌幅（相对前收） */
export function changePercentOnDate(bars: KlineBar[]): number {
  if (bars.length < 2) return 0;
  const cur = bars[bars.length - 1]!;
  const prev = bars[bars.length - 2]!;
  if (!prev.close) return 0;
  return ((cur.close - prev.close) / prev.close) * 100;
}

/** 用成交量相对 20 日均量估算换手率（历史练习无真实换手数据时的近似） */
export function estimateTurnoverRatio(bars: KlineBar[]): number {
  if (bars.length < 5) return 1;
  const recent = bars.slice(-20);
  const last = recent[recent.length - 1]!;
  const avgVol =
    recent.reduce((s, b) => s + b.volume, 0) / recent.length || 1;
  const ratio = last.volume / avgVol;
  return Math.min(15, Math.max(0.3, ratio * 1.5));
}

export async function loadPracticeContext(options: {
  symbol: string;
  name: string;
  date: string;
  mode: TradeMode;
  envTotal: number;
  turnoverOverride?: number | null;
}): Promise<PracticeContext | { error: string }> {
  const symbol = normalizeSymbol(options.symbol);
  if (!/^\d{6}$/.test(symbol)) {
    return { error: '无效股票代码' };
  }

  const raw = await fetchKlines(symbol, 'day', PRACTICE_KLINE_LIMIT);
  if (!raw?.length) {
    return { error: 'K 线数据加载失败，请检查网络或股票代码' };
  }

  const earliest = raw[0]!.date.slice(0, 10);

  const asOfDate = resolveTradingDate(raw, options.date);
  if (!asOfDate) {
    return {
      error: `所选日期早于可用历史（最早约 ${earliest}），请选更晚的日期`,
    };
  }

  const sliced = sliceBarsAsOf(raw, asOfDate);
  if (sliced.length < MIN_BARS_FOR_TREND) {
    const needFrom = new Date(asOfDate);
    needFrom.setDate(needFrom.getDate() - 45);
    const suggestFrom = needFrom.toISOString().slice(0, 10);
    return {
      error: `截止 ${asOfDate} 仅有 ${sliced.length} 根 K 线（需至少 ${MIN_BARS_FOR_TREND} 根）。请选 ${suggestFrom} 之后的日期，或选更近的交易日`,
    };
  }

  const turnoverEstimated = options.turnoverOverride == null;
  const turnoverRatio =
    options.turnoverOverride ?? estimateTurnoverRatio(sliced);
  const changePercent = changePercentOnDate(sliced);
  const enriched = enrichBars(sliced);
  const last = enriched[enriched.length - 1]!;
  const closes = sliced.map((b) => b.close);
  const ma10 =
    closes.length >= 10
      ? closes.slice(-10).reduce((a, b) => a + b, 0) / 10
      : 0;

  return {
    symbol,
    name: options.name,
    asOfDate,
    requestedDate: options.date.slice(0, 10),
    mode: options.mode,
    envTotal: options.envTotal,
    turnoverRatio,
    turnoverEstimated,
    changePercent,
    bars: enriched,
    price: last.close,
    ma5: last.ma5 ?? 0,
    ma10,
    ma20: last.ma20 ?? 0,
  };
}

function toPracticeStatus(
  status: WatchlistItem['status']
): 'watch' | 'ready' | 'reject' {
  return status === 'ready' ? 'ready' : status === 'watch' ? 'watch' : 'reject';
}

export function computePracticeVerdict(ctx: PracticeContext): PracticeVerdict {
  const envPart = envToScorePart(ctx.envTotal);
  const minScore = ctx.mode === 'emotion' ? 10 : 12;

  if (ctx.mode === 'emotion') {
    const ev = evaluateEmotionStockDetailed(
      ctx.changePercent,
      ctx.turnoverRatio,
      envPart
    );
    const totalScore = stockScoreTotal({
      id: '',
      symbol: ctx.symbol,
      name: ctx.name,
      mode: 'emotion',
      scores: ev.scores,
      status: 'watch',
      createdAt: '',
    });
    const shouldWatchlist = ev.passed && totalScore >= minScore;
    return {
      shouldWatchlist,
      status: shouldWatchlist ? 'watch' : 'reject',
      totalScore,
      passedRules: ev.passed,
      reasons: ev.reasons,
      fails: ev.fails,
      scores: ev.scores,
    };
  }

  if (ctx.mode === 'etf') {
    const ev = evaluateEtf(
      ctx.bars.map(({ date, open, high, low, close, volume }) => ({
        date,
        open,
        high,
        low,
        close,
        volume,
      })),
      envPart
    );
    if (!ev) {
      const detail = evaluateTrendStockDetailed(
        ctx.bars.map(({ date, open, high, low, close, volume }) => ({
          date,
          open,
          high,
          low,
          close,
          volume,
        })),
        ctx.changePercent,
        ctx.turnoverRatio,
        envPart
      );
      return {
        shouldWatchlist: false,
        status: 'reject',
        totalScore: 0,
        passedRules: false,
        reasons: detail?.reasons ?? [],
        fails: detail?.fails ?? ['不符合 ETF 趋势规则'],
      };
    }
    const totalScore = stockScoreTotal({
      id: '',
      symbol: ctx.symbol,
      name: ctx.name,
      mode: 'etf',
      scores: ev.scores,
      status: ev.status,
      createdAt: '',
    });
    const shouldWatchlist = totalScore >= minScore;
    return {
      shouldWatchlist,
      status: shouldWatchlist ? toPracticeStatus(ev.status) : 'reject',
      totalScore,
      passedRules: true,
      reasons: ev.reasons,
      fails: [],
      scores: ev.scores,
    };
  }

  const bars = ctx.bars.map(({ date, open, high, low, close, volume }) => ({
    date,
    open,
    high,
    low,
    close,
    volume,
  }));
  const ev = evaluateTrendStockDetailed(
    bars,
    ctx.changePercent,
    ctx.turnoverRatio,
    envPart
  );
  if (!ev) {
    return {
      shouldWatchlist: false,
      status: 'reject',
      totalScore: 0,
      passedRules: false,
      reasons: [],
      fails: ['数据不足，无法评估'],
    };
  }

  const totalScore = stockScoreTotal({
    id: '',
    symbol: ctx.symbol,
    name: ctx.name,
    mode: 'trend',
    scores: ev.scores,
    status: ev.status,
    createdAt: '',
  });
  const shouldWatchlist = ev.passed && totalScore >= minScore;

  return {
    shouldWatchlist,
    status: shouldWatchlist ? toPracticeStatus(ev.status) : 'reject',
    totalScore,
    passedRules: ev.passed,
    reasons: ev.reasons,
    fails: ev.fails,
    scores: ev.scores,
  };
}

export function gradePracticeAnswer(
  userInWatchlist: boolean,
  userStatus: 'watch' | 'ready' | 'reject',
  verdict: PracticeVerdict
): PracticeGrade {
  const correct = userInWatchlist === verdict.shouldWatchlist;
  const statusCorrect =
    !verdict.shouldWatchlist ||
    userStatus === 'reject' ||
    userStatus === verdict.status;

  const feedback: string[] = [];
  if (correct) {
    feedback.push(
      verdict.shouldWatchlist
        ? '✓ 判断正确：系统规则认为应纳入观察池'
        : '✓ 判断正确：系统规则认为不应纳入观察池'
    );
  } else {
    feedback.push(
      verdict.shouldWatchlist
        ? '✗ 你选择了不纳入，但系统规则认为符合条件'
        : '✗ 你选择了纳入，但系统规则认为不符合条件'
    );
  }

  if (verdict.shouldWatchlist && userInWatchlist) {
    if (statusCorrect) {
      feedback.push(
        verdict.status === 'ready'
          ? '✓ 状态判断正确：接近 20 日线，可标记为「就绪」'
          : '✓ 状态判断正确：趋势尚可但买点未完全清晰，宜「观察」'
      );
    } else {
      feedback.push(
        verdict.status === 'ready'
          ? '△ 系统建议状态为「就绪」（接近 20 日线支撑）'
          : '△ 系统建议状态为「观察」（尚未到理想买点）'
      );
    }
  }

  if (verdict.fails.length > 0) {
    feedback.push(`未通过项：${verdict.fails.join('；')}`);
  }
  if (verdict.shouldWatchlist && verdict.reasons.length > 0) {
    feedback.push(`通过理由：${verdict.reasons.join('；')}`);
  }

  return {
    correct,
    statusCorrect,
    verdict,
    feedback,
  };
}

export function buildPracticeAttempt(
  ctx: PracticeContext,
  userInWatchlist: boolean,
  userStatus: 'watch' | 'ready' | 'reject',
  grade: PracticeGrade,
  notes?: string
): PracticeAttempt {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    symbol: ctx.symbol,
    name: ctx.name,
    asOfDate: ctx.asOfDate,
    mode: ctx.mode,
    envTotal: ctx.envTotal,
    turnoverRatio: ctx.turnoverRatio,
    userInWatchlist,
    userStatus,
    systemShouldWatchlist: grade.verdict.shouldWatchlist,
    systemStatus: grade.verdict.status,
    correct: grade.correct && grade.statusCorrect,
    totalScore: grade.verdict.totalScore,
    systemReasons: grade.verdict.reasons,
    systemFails: grade.verdict.fails,
    notes,
    createdAt: new Date().toISOString(),
  };
}
