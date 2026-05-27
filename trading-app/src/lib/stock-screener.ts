import { stockScoreTotal } from './calculations';
import { newId } from './storage';
import { normalizeSymbol } from './symbols';
import type { TradeMode, WatchlistItem } from '../types';

const QQ = import.meta.env.DEV ? '/api/qq' : 'https://web.ifzq.gtimg.cn';
const SINA = import.meta.env.DEV
  ? '/api/sina'
  : 'https://vip.stock.finance.sina.com.cn';

export interface KlineBar {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

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

function ma(closes: number[], n: number): number {
  if (closes.length < n) return 0;
  const slice = closes.slice(-n);
  return slice.reduce((a, b) => a + b, 0) / n;
}

function isStName(name: string): boolean {
  return /ST|退/i.test(name);
}

/** 腾讯前复权日 K */
export async function fetchKlines(
  marketSymbol: string
): Promise<KlineBar[] | null> {
  const url = `${QQ}/appstock/app/fqkline/get?param=${marketSymbol},day,,,40,qfq`;
  try {
    const res = await fetch(url);
    const json = (await res.json()) as {
      data?: Record<string, { qfqday?: string[][] }>;
    };
    const key = Object.keys(json.data ?? {})[0];
    const rows = key ? json.data![key]?.qfqday : undefined;
    if (!rows?.length) return null;
    return rows.map((r) => ({
      date: r[0],
      open: Number(r[1]),
      close: Number(r[2]),
      high: Number(r[3]),
      low: Number(r[4]),
      volume: Number(r[5]),
    }));
  } catch {
    return null;
  }
}

async function fetchLiquidUniverse(pages = 3, pageSize = 50): Promise<SinaRow[]> {
  const all: SinaRow[] = [];
  for (let page = 1; page <= pages; page++) {
    const url = `${SINA}/quotes_service/api/json_v2.php/Market_Center.getHQNodeData?page=${page}&num=${pageSize}&sort=amount&asc=0&node=hs_a`;
    const res = await fetch(url);
    const rows = (await res.json()) as SinaRow[];
    if (!Array.isArray(rows)) break;
    all.push(...rows);
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

/** 趋势股规则（对齐 02_选股体系 趋势股观察池） */
export function evaluateTrendStock(
  bars: KlineBar[],
  changePercent: number,
  turnoverRatio: number,
  envScorePart: number
): Omit<ScreenCandidate, 'symbol' | 'name' | 'mode'> | null {
  if (bars.length < 22) return null;
  const closes = bars.map((b) => b.close);
  const price = closes[closes.length - 1]!;
  const ma5 = ma(closes, 5);
  const ma10 = ma(closes, 10);
  const ma20 = ma(closes, 20);
  if (!ma5 || !ma10 || !ma20) return null;

  const reasons: string[] = [];
  const fails: string[] = [];

  if (price < ma20 * 0.97) fails.push('跌破20日线过多');
  else reasons.push('股价在20日线附近或上方');

  if (!(ma5 > ma10 && ma10 > ma20)) fails.push('均线非多头排列');
  else reasons.push('5/10/20日均线多头');

  if (price > ma5 * 1.12) fails.push('远离5日线，不宜追高');
  else if (price > ma5 * 1.05) reasons.push('贴近5日线运行');
  else reasons.push('靠近短期均线');

  if (changePercent > 7) fails.push('当日涨幅过大');
  else if (changePercent < -5) fails.push('当日跌幅过大');
  else reasons.push('当日波动适中');

  if (turnoverRatio < 0.8) fails.push('换手偏低');
  else reasons.push('成交活跃');

  if (!volumeShrinkOnPullback(bars)) fails.push('回调未明显缩量');
  else reasons.push('回调缩量特征尚可');

  if (fails.length > 0) return null;

  const nearMa20 = price <= ma20 * 1.03 && price >= ma20 * 0.98;
  const status: WatchlistItem['status'] = nearMa20 ? 'ready' : 'watch';
  if (nearMa20) reasons.push('接近20日线支撑，可关注买点');

  const scores: WatchlistItem['scores'] = {
    marketEnv: envScorePart,
    sector: 2,
    trend: 4,
    volumePrice: volumeShrinkOnPullback(bars) ? 3 : 2,
    buyPointClarity: nearMa20 ? 3 : 2,
    riskReward: 2,
  };

  return {
    price,
    changePercent,
    ma5,
    ma10,
    ma20,
    reasons,
    scores,
    status,
    totalScore: 0,
  };
}

/** 情绪短线：强势、高换手（仅在情绪环境启用） */
export function evaluateEmotionStock(
  changePercent: number,
  turnoverRatio: number,
  envScorePart: number
): WatchlistItem['scores'] | null {
  if (changePercent < 5 || turnoverRatio < 4) return null;
  if (changePercent > 10.5) return null;
  return {
    marketEnv: envScorePart,
    sector: 3,
    trend: 2,
    volumePrice: 3,
    buyPointClarity: 1,
    riskReward: 1,
  };
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

function envToScorePart(envTotal: number): number {
  if (envTotal >= 8) return 4;
  if (envTotal >= 5) return 3;
  if (envTotal >= 3) return 2;
  return 1;
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
    const bars = await fetchKlines(row.symbol);
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
    const symbol = normalizeSymbol(row.code);
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
    const bars = await fetchKlines(`${etf.market}${etf.symbol}`);
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
