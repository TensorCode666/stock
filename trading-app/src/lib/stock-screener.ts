import { envToScorePart, stockScoreTotal } from './calculations';
import { fetchKlines, ma, type KlineBar } from './kline-indicators';
import { newId } from './storage';
import { normalizeSymbol } from './symbols';
import type { TradeMode, WatchlistItem } from '../types';

export interface ScreenCandidate {
  symbol: string;
  name: string;
  mode: TradeMode;
  price: number;
  changePercent: number;
  ma5: number;
  ma10: number;
  ma20: number;
  reasons: string[];
  scores: WatchlistItem['scores'];
  status: WatchlistItem['status'];
  totalScore: number;
}

export interface ScreenProgress {
  phase: string;
  done: number;
  total: number;
}

type SinaRow = {
  symbol: string;
  code: string;
  name: string;
  trade: string;
  changepercent: string;
  turnoverratio: string;
};

const SINA = import.meta.env.DEV
  ? '/api/sina'
  : 'https://vip.stock.finance.sina.com.cn';

export type { KlineBar } from './kline-indicators';

function isStName(name: string): boolean {
  return /ST|退/i.test(name);
}

async function fetchLiquidUniverse(pages = 3, pageSize = 50): Promise<SinaRow[]> {
  const all: SinaRow[] = [];
  for (let page = 1; page <= pages; page++) {
    const url = `${SINA}/quotes_service/api/json_v2.php/Market_Center.getHQNodeData?page=${page}&num=${pageSize}&sort=amount&asc=0&node=hs_a`;
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      const rows = (await res.json()) as SinaRow[];
      if (!Array.isArray(rows)) break;
      all.push(...rows);
    } catch {
      if (all.length === 0 && page === 1) {
        throw new Error(
          '无法获取全市场列表（网络或跨域限制）。请用本地 npm run dev，或稍后重试。'
        );
      }
      break;
    }
  }
  return all.filter((r) => r.code && r.name && !isStName(r.name));
}

function volumeShrinkOnPullback(bars: KlineBar[]): boolean {
  if (bars.length < 8) return true;
  const recent = bars.slice(-8);
  let downVol = 0;
  let downN = 0;
  let upVol = 0;
  let upN = 0;
  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1];
    const cur = recent[i];
    if (cur.close < prev.close) {
      downVol += cur.volume;
      downN++;
    } else if (cur.close > prev.close) {
      upVol += cur.volume;
      upN++;
    }
  }
  if (downN === 0 || upN === 0) return true;
  return downVol / downN <= (upVol / upN) * 1.2;
}

export interface TrendEvalResult {
  passed: boolean;
  fails: string[];
  failTags: TrendFailTag[];
  reasons: string[];
  price: number;
  changePercent: number;
  ma5: number;
  ma10: number;
  ma20: number;
  scores: WatchlistItem['scores'];
  status: WatchlistItem['status'];
}

export type TrendFailTag =
  | 'ma20'
  | 'ma_align'
  | 'chase'
  | 'volatility'
  | 'turnover'
  | 'volume_shrink';

/** 趋势股规则（对齐 02_选股体系 趋势股观察池），含通过/失败明细 */
export function evaluateTrendStockDetailed(
  bars: KlineBar[],
  changePercent: number,
  turnoverRatio: number,
  envScorePart: number
): TrendEvalResult | null {
  if (bars.length < 22) return null;
  const closes = bars.map((b) => b.close);
  const price = closes[closes.length - 1]!;
  const ma5 = ma(closes, 5);
  const ma10 = ma(closes, 10);
  const ma20 = ma(closes, 20);
  if (!ma5 || !ma10 || !ma20) return null;

  const reasons: string[] = [];
  const fails: string[] = [];
  const failTags: TrendFailTag[] = [];

  if (price < ma20 * 0.97) {
    fails.push('跌破20日线过多');
    failTags.push('ma20');
  } else reasons.push('股价在20日线附近或上方');

  if (!(ma5 > ma10 && ma10 > ma20)) {
    fails.push('均线非多头排列');
    failTags.push('ma_align');
  } else reasons.push('5/10/20日均线多头');

  if (price > ma5 * 1.12) {
    fails.push('远离5日线，不宜追高');
    failTags.push('chase');
  } else if (price > ma5 * 1.05) reasons.push('贴近5日线运行');
  else reasons.push('靠近短期均线');

  if (changePercent > 7) {
    fails.push('当日涨幅过大');
    failTags.push('volatility');
  } else if (changePercent < -5) {
    fails.push('当日跌幅过大');
    failTags.push('volatility');
  } else reasons.push('当日波动适中');

  if (turnoverRatio < 0.8) {
    fails.push('换手偏低');
    failTags.push('turnover');
  } else reasons.push('成交活跃');

  const volShrink = volumeShrinkOnPullback(bars);
  if (!volShrink) {
    fails.push('回调未明显缩量');
    failTags.push('volume_shrink');
  } else reasons.push('回调缩量特征尚可');

  const nearMa20 = price <= ma20 * 1.03 && price >= ma20 * 0.98;
  const status: WatchlistItem['status'] = nearMa20 ? 'ready' : 'watch';
  if (nearMa20 && fails.length === 0) reasons.push('接近20日线支撑，可关注买点');

  const scores: WatchlistItem['scores'] = {
    marketEnv: envScorePart,
    sector: 2,
    trend: 4,
    volumePrice: volShrink ? 3 : 2,
    buyPointClarity: nearMa20 ? 3 : 2,
    riskReward: 2,
  };

  return {
    passed: fails.length === 0,
    fails,
    failTags,
    reasons,
    price,
    changePercent,
    ma5,
    ma10,
    ma20,
    scores,
    status,
  };
}

/** 趋势股规则（对齐 02_选股体系 趋势股观察池） */
export function evaluateTrendStock(
  bars: KlineBar[],
  changePercent: number,
  turnoverRatio: number,
  envScorePart: number
): Omit<ScreenCandidate, 'symbol' | 'name' | 'mode'> | null {
  const ev = evaluateTrendStockDetailed(
    bars,
    changePercent,
    turnoverRatio,
    envScorePart
  );
  if (!ev?.passed) return null;
  return {
    price: ev.price,
    changePercent: ev.changePercent,
    ma5: ev.ma5,
    ma10: ev.ma10,
    ma20: ev.ma20,
    reasons: ev.reasons,
    scores: ev.scores,
    status: ev.status,
    totalScore: 0,
  };
}

export interface EmotionEvalResult {
  passed: boolean;
  fails: string[];
  reasons: string[];
  scores: WatchlistItem['scores'];
}

/** 情绪短线：强势、高换手（仅在情绪环境启用） */
export function evaluateEmotionStockDetailed(
  changePercent: number,
  turnoverRatio: number,
  envScorePart: number
): EmotionEvalResult {
  const fails: string[] = [];
  const reasons: string[] = [];

  if (changePercent < 5) fails.push('涨幅不足 5%');
  else reasons.push(`当日涨幅 ${changePercent.toFixed(2)}%`);

  if (turnoverRatio < 4) fails.push('换手率低于 4%');
  else reasons.push(`换手率 ${turnoverRatio.toFixed(2)}%`);

  if (changePercent > 10.5) fails.push('涨幅过大，追高风险高');

  const scores: WatchlistItem['scores'] = {
    marketEnv: envScorePart,
    sector: 3,
    trend: 2,
    volumePrice: 3,
    buyPointClarity: 1,
    riskReward: 1,
  };

  return {
    passed: fails.length === 0,
    fails,
    reasons,
    scores,
  };
}

export function evaluateEmotionStock(
  changePercent: number,
  turnoverRatio: number,
  envScorePart: number
): WatchlistItem['scores'] | null {
  const ev = evaluateEmotionStockDetailed(
    changePercent,
    turnoverRatio,
    envScorePart
  );
  if (!ev.passed) return null;
  return ev.scores;
}

const ETF_CODES = [
  { symbol: '510300', name: '沪深300ETF', market: 'sh' },
  { symbol: '510500', name: '中证500ETF', market: 'sh' },
  { symbol: '159915', name: '创业板ETF', market: 'sz' },
  { symbol: '588000', name: '科创50ETF', market: 'sh' },
  { symbol: '512880', name: '证券ETF', market: 'sh' },
];

export function evaluateEtf(
  bars: KlineBar[],
  envScorePart: number
): Omit<ScreenCandidate, 'symbol' | 'name' | 'mode'> | null {
  const base = evaluateTrendStock(bars, 0, 2, envScorePart);
  if (!base) return null;
  return {
    ...base,
    reasons: [...base.reasons, 'ETF 分散个股风险，适合分批'],
    scores: {
      ...base.scores,
      sector: 3,
      riskReward: 2,
    },
  };
}

function allowEmotionScreen(envTotal: number, emotionStage?: string): boolean {
  if (envTotal >= 5) return true;
  if (!emotionStage) return false;
  return ['修复期', '启动期', '主升期'].some((s) => emotionStage.includes(s));
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R | null>
): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      const r = await fn(items[idx]!);
      if (r) out.push(r);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker)
  );
  return out;
}

export async function runStockScreen(options: {
  envTotal: number;
  emotionStage?: string;
  onProgress?: (p: ScreenProgress) => void;
}): Promise<ScreenCandidate[]> {
  const envPart = envToScorePart(options.envTotal);
  const emotionOn = allowEmotionScreen(options.envTotal, options.emotionStage);
  const candidates: ScreenCandidate[] = [];

  options.onProgress?.({ phase: '获取成交活跃股票', done: 0, total: 1 });
  const universe = await fetchLiquidUniverse(3, 50);
  options.onProgress?.({
    phase: '扫描趋势股（均线+量价）',
    done: 0,
    total: universe.length,
  });

  let done = 0;
  const trendHits = await mapPool(universe, 6, async (row) => {
    const symbol = normalizeSymbol(row.code);
    const bars = await fetchKlines(symbol, 'day', 40);
    done++;
    options.onProgress?.({
      phase: '扫描趋势股（均线+量价）',
      done,
      total: universe.length,
    });
    if (!bars) return null;
    const ev = evaluateTrendStock(
      bars,
      Number(row.changepercent) || 0,
      Number(row.turnoverratio) || 0,
      envPart
    );
    if (!ev) return null;
    const totalScore = stockScoreTotal({
      id: '',
      symbol,
      name: row.name,
      mode: 'trend',
      scores: ev.scores,
      status: ev.status,
      createdAt: '',
    });
    if (totalScore < 12) return null;
    return {
      symbol,
      name: row.name,
      mode: 'trend' as const,
      ...ev,
      totalScore,
    };
  });

  candidates.push(...trendHits);

  if (emotionOn) {
    const hot = [...universe]
      .sort(
        (a, b) =>
          (Number(b.changepercent) || 0) - (Number(a.changepercent) || 0)
      )
      .slice(0, 40);
    options.onProgress?.({
      phase: '扫描情绪短线（强势+高换手）',
      done: 0,
      total: hot.length,
    });
    done = 0;
    for (const row of hot) {
      const cp = Number(row.changepercent) || 0;
      const tr = Number(row.turnoverratio) || 0;
      const scores = evaluateEmotionStock(cp, tr, envPart);
      done++;
      options.onProgress?.({
        phase: '扫描情绪短线（强势+高换手）',
        done,
        total: hot.length,
      });
      if (!scores) continue;
      const symbol = normalizeSymbol(row.code);
      const totalScore = stockScoreTotal({
        id: '',
        symbol,
        name: row.name,
        mode: 'emotion',
        scores,
        status: 'watch',
        createdAt: '',
      });
      if (totalScore < 10) continue;
      if (candidates.some((c) => c.symbol === symbol)) continue;
      candidates.push({
        symbol,
        name: row.name,
        mode: 'emotion',
        price: Number(row.trade) || 0,
        changePercent: cp,
        ma5: 0,
        ma10: 0,
        ma20: 0,
        reasons: [
          '当日强势上涨',
          `换手率 ${tr.toFixed(2)}%`,
          '情绪环境允许下纳入观察',
        ],
        scores,
        status: 'watch',
        totalScore,
      });
    }
  }

  options.onProgress?.({
    phase: '扫描 ETF',
    done: 0,
    total: ETF_CODES.length,
  });
  for (let i = 0; i < ETF_CODES.length; i++) {
    const etf = ETF_CODES[i]!;
    const bars = await fetchKlines(etf.symbol, 'day', 40);
    options.onProgress?.({
      phase: '扫描 ETF',
      done: i + 1,
      total: ETF_CODES.length,
    });
    if (!bars) continue;
    const ev = evaluateEtf(bars, envPart);
    if (!ev) continue;
    if (candidates.some((c) => c.symbol === etf.symbol)) continue;
    const totalScore = stockScoreTotal({
      id: '',
      symbol: etf.symbol,
      name: etf.name,
      mode: 'etf',
      scores: ev.scores,
      status: ev.status,
      createdAt: '',
    });
    candidates.push({
      symbol: etf.symbol,
      name: etf.name,
      mode: 'etf',
      ...ev,
      totalScore,
    });
  }

  candidates.sort((a, b) => b.totalScore - a.totalScore);
  return candidates.slice(0, 30);
}

export function mergeCandidatesToWatchlist(
  existing: WatchlistItem[],
  candidates: ScreenCandidate[]
): WatchlistItem[] {
  const map = new Map(
    existing.map((w) => [normalizeSymbol(w.symbol), w])
  );

  for (const c of candidates) {
    const sym = normalizeSymbol(c.symbol);
    const prev = map.get(sym);
    const notes = `【规则扫描】${c.reasons.join('；')}`;
    if (prev && prev.status !== 'removed') {
      map.set(sym, {
        ...prev,
        name: c.name,
        mode: c.mode,
        scores: c.scores,
        status: c.status,
        source: prev.source === 'manual' ? 'manual' : 'screen',
        screenReasons: c.reasons,
        notes:
          prev.source === 'manual'
            ? [prev.notes, `【扫描参考】${c.reasons.slice(0, 2).join('；')}`]
                .filter(Boolean)
                .join('\n')
            : notes,
        screenedAt: new Date().toISOString(),
      });
    } else {
      map.set(sym, {
        id: newId(),
        symbol: sym,
        name: c.name,
        mode: c.mode,
        scores: c.scores,
        status: c.status,
        notes,
        source: 'screen',
        screenReasons: c.reasons,
        screenedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    }
  }

  return [...map.values()];
}
