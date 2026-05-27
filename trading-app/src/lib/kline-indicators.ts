import { normalizeSymbol, symbolToTencentMarket } from './symbols';

const QQ = import.meta.env.DEV ? '/api/qq' : 'https://web.ifzq.gtimg.cn';

export interface KlineBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MacdPoint {
  dif: number;
  dea: number;
  hist: number;
}

export interface EnrichedBar extends KlineBar {
  ma5: number | null;
  ma20: number | null;
  ma30: number | null;
  macd: MacdPoint | null;
}

export interface StockChartData {
  symbol: string;
  bars: EnrichedBar[];
}

function sma(values: number[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    const slice = values.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

function emaSeries(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0] ?? 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    prev = i === 0 ? v : v * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

/** MACD(12,26,9)：DIF、DEA、柱 = 2×(DIF−DEA) */
export function computeMacd(closes: number[]): MacdPoint[] {
  const ema12 = emaSeries(closes, 12);
  const ema26 = emaSeries(closes, 26);
  const dif = closes.map((_, i) => ema12[i]! - ema26[i]!);
  const dea = emaSeries(dif, 9);
  return dif.map((d, i) => {
    const delta = d - dea[i]!;
    return { dif: d, dea: dea[i]!, hist: 2 * delta };
  });
}

export function enrichBars(bars: KlineBar[]): EnrichedBar[] {
  const closes = bars.map((b) => b.close);
  const ma5 = sma(closes, 5);
  const ma20 = sma(closes, 20);
  const ma30 = sma(closes, 30);
  const macd = computeMacd(closes);
  return bars.map((b, i) => ({
    ...b,
    ma5: ma5[i] ?? null,
    ma20: ma20[i] ?? null,
    ma30: ma30[i] ?? null,
    macd: macd[i] ?? null,
  }));
}

/** 腾讯前复权日 K，约 120 根 */
export async function fetchDailyKlines(symbol: string): Promise<KlineBar[] | null> {
  const marketSymbol = symbolToTencentMarket(symbol);
  if (!marketSymbol) return null;
  const url = `${QQ}/appstock/app/fqkline/get?param=${marketSymbol},day,,,120,qfq`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: Record<string, { qfqday?: string[][] }>;
    };
    const key = Object.keys(json.data ?? {})[0];
    const rows = key ? json.data![key]?.qfqday : undefined;
    if (!rows?.length) return null;
    return rows.map((r) => ({
      date: r[0]!,
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

export async function fetchStockChartData(symbol: string): Promise<StockChartData | null> {
  const code = normalizeSymbol(symbol);
  if (!code) return null;
  const bars = await fetchDailyKlines(code);
  if (!bars?.length) return null;
  return { symbol: code, bars: enrichBars(bars) };
}
