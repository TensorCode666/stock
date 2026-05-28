import { normalizeSymbol, symbolToSecId, symbolToTencentMarket } from './symbols';

const EM =
  import.meta.env.DEV ? '/api/em' : 'https://push2.eastmoney.com';
const EM_SEARCH =
  import.meta.env.DEV ? '/api/em-search' : 'https://searchapi.eastmoney.com';
const QT = import.meta.env.DEV ? '/api/qt' : 'https://qt.gtimg.cn';

export interface IndexQuote {
  code: string;
  name: string;
  price: number;
  changePercent: number;
  changeAmount: number;
  upCount?: number;
  downCount?: number;
  flatCount?: number;
}

export interface StockQuote {
  symbol: string;
  secid: string;
  name: string;
  price: number;
  open: number;
  prevClose: number;
  changeAmount: number;
  changePercent: number;
  volume: number;
  amount: number;
  high: number;
  low: number;
}

export interface StockSearchResult {
  symbol: string;
  name: string;
  secid: string;
  market: string;
}

export interface MarketBreadth {
  up: number;
  down: number;
  flat: number;
  upRatio: number;
  /** 统计口径说明 */
  scope: string;
  total: number;
}

const INDEX_SECIDS = '1.000001,0.399001,0.399006';

const FETCH_TIMEOUT_MS = 12_000;

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`行情请求失败: ${res.status}`);
  return res.json() as Promise<T>;
}

async function fetchJsonSafe<T>(url: string): Promise<T | null> {
  try {
    return await fetchJson<T>(url);
  } catch {
    return null;
  }
}

/** 解析 qt.gtimg.cn 文本行情 v_sz300502="..." */
function parseTencentLine(line: string): StockQuote | null {
  const m = line.match(/v_(\w+)="([^"]*)"/);
  if (!m) return null;
  const tencentId = m[1]!;
  const parts = m[2]!.split('~');
  if (parts.length < 33) return null;
  const symbol = normalizeSymbol(parts[2] ?? tencentId.slice(2));
  if (!symbol) return null;
  const price = Number(parts[3]) || 0;
  const prevClose = Number(parts[4]) || 0;
  const changePercent = Number(parts[32]) || 0;
  const changeAmount =
    price && prevClose ? price - prevClose : Number(parts[31]) || 0;
  return {
    symbol,
    secid: symbolToSecId(symbol),
    name: parts[1] ?? '',
    price,
    open: Number(parts[5]) || price,
    prevClose,
    changeAmount,
    changePercent,
    volume: Number(parts[36]) || 0,
    amount: Number(parts[37]) || 0,
    high: Number(parts[33]) || price,
    low: Number(parts[34]) || price,
  };
}

function toTencentIds(symbols: string[]): string[] {
  return symbols.map((s) => {
    const t = s.trim().toLowerCase();
    if (/^(sh|sz)\d{6}$/.test(t)) return t;
    return symbolToTencentMarket(s);
  }).filter(Boolean);
}

async function fetchTencentQuotes(
  symbols: string[]
): Promise<Map<string, StockQuote>> {
  const map = new Map<string, StockQuote>();
  const ids = [...new Set(toTencentIds(symbols))];
  if (ids.length === 0) return map;

  const chunkSize = 50;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    try {
      const res = await fetch(`${QT}/q=${chunk.join(',')}`);
      if (!res.ok) continue;
      const text = await res.text();
      for (const line of text.split(';')) {
        const q = parseTencentLine(line.trim());
        if (q) map.set(q.symbol, q);
      }
    } catch {
      /* try next chunk */
    }
  }
  return map;
}

type EmListResp = {
  data?: { diff?: Record<string, unknown>[] };
};

type EmStockResp = {
  data?: Record<string, unknown>;
};

/** 主要指数 + 上证涨跌家数 */
export async function fetchIndices(): Promise<IndexQuote[]> {
  const fields = 'f2,f3,f4,f12,f14,f104,f105,f106';
  const url = `${EM}/api/qt/ulist.np/get?fltt=2&fields=${fields}&secids=${INDEX_SECIDS}`;
  const json = await fetchJsonSafe<EmListResp>(url);
  const list = json?.data?.diff ?? [];
  if (list.length > 0) {
    return list.map((row) => ({
      code: String(row.f12 ?? ''),
      name: String(row.f14 ?? ''),
      price: Number(row.f2) || 0,
      changePercent: Number(row.f3) || 0,
      changeAmount: Number(row.f4) || 0,
      upCount: row.f104 != null ? Number(row.f104) : undefined,
      downCount: row.f105 != null ? Number(row.f105) : undefined,
      flatCount: row.f106 != null ? Number(row.f106) : undefined,
    }));
  }
  const indexTencentIds = ['sh000001', 'sz399001', 'sz399006'];
  const fallback = await fetchTencentQuotes(indexTencentIds);
  const names: Record<string, string> = {
    '000001': '上证指数',
    '399001': '深证成指',
    '399006': '创业板指',
  };
  return ['000001', '399001', '399006']
    .map((code) => fallback.get(code))
    .filter((q): q is StockQuote => !!q)
    .map((q) => ({
      code: q.symbol,
      name: names[q.symbol] ?? q.name,
      price: q.price,
      changePercent: q.changePercent,
      changeAmount: q.changeAmount,
    }));
}

/**
 * 涨跌家数：合并上交所（000001）+ 深证综指（399106）口径。
 * 此前仅用上证指数 ≈ 仅沪市 ~2300 只；合并后接近沪深 A 股全市场 ~5000+。
 */
const BREADTH_SECIDS = '1.000001,0.399106';

export async function fetchMarketBreadth(): Promise<MarketBreadth | null> {
  const fields = 'f12,f14,f104,f105,f106';
  const url = `${EM}/api/qt/ulist.np/get?fltt=2&fields=${fields}&secids=${BREADTH_SECIDS}`;
  const json = await fetchJsonSafe<EmListResp>(url);
  const list = json?.data?.diff ?? [];

  let up = 0;
  let down = 0;
  let flat = 0;

  for (const row of list) {
    const u = Number(row.f104) || 0;
    const d = Number(row.f105) || 0;
    const f = Number(row.f106) || 0;
    if (u + d + f === 0) continue;
    up += u;
    down += d;
    flat += f;
  }

  // 合并接口失败时回退：仅上证（数量偏少，但优于无数据）
  if (up + down + flat === 0) {
    const indices = await fetchIndices();
    const sh = indices.find((i) => i.code === '000001');
    if (!sh?.upCount || sh.downCount == null) return null;
    up = sh.upCount;
    down = sh.downCount;
    flat = sh.flatCount ?? 0;
    const total = up + down + flat;
    return {
      up,
      down,
      flat,
      total,
      upRatio: total > 0 ? up / total : 0,
      scope: '沪市（上证口径，不含深市）',
    };
  }

  const total = up + down + flat;
  return {
    up,
    down,
    flat,
    total,
    upRatio: total > 0 ? up / total : 0,
    scope: '沪深A股（沪+深，不含北交所）',
  };
}

/** 批量实时行情（东财优先，失败则用腾讯 qt） */
export async function fetchStockQuotes(
  symbols: string[]
): Promise<Map<string, StockQuote>> {
  const map = new Map<string, StockQuote>();
  const codes = [...new Set(symbols.map(normalizeSymbol).filter(Boolean))];
  if (codes.length === 0) return map;

  let emFailed = false;
  const chunkSize = 40;
  for (let i = 0; i < codes.length; i += chunkSize) {
    const chunk = codes.slice(i, i + chunkSize);
    const secids = chunk.map(symbolToSecId).filter(Boolean).join(',');
    const fields =
      'f2,f3,f4,f12,f14,f15,f16,f17,f18,f20,f21,f47,f48,f57,f58,f60,f169,f170';
    const url = `${EM}/api/qt/ulist.np/get?fltt=2&fields=${fields}&secids=${secids}`;
    const json = await fetchJsonSafe<EmListResp>(url);
    if (!json) {
      emFailed = true;
      continue;
    }
    for (const row of json.data?.diff ?? []) {
      const symbol = String(row.f12 ?? '');
      if (!symbol) continue;
      map.set(symbol, rowToQuote(symbol, symbolToSecId(symbol), row));
    }
  }

  const missing = codes.filter((c) => !map.has(c));
  if (emFailed || missing.length > 0) {
    const tencent = await fetchTencentQuotes(missing.length ? missing : codes);
    for (const [sym, q] of tencent) {
      if (!map.has(sym)) map.set(sym, q);
    }
  }
  return map;
}

export async function fetchStockQuote(symbol: string): Promise<StockQuote | null> {
  const code = normalizeSymbol(symbol);
  if (!code) return null;
  const secid = symbolToSecId(code);
  const fields =
    'f43,f44,f45,f46,f47,f48,f57,f58,f60,f169,f170,f171,f292';
  const url = `${EM}/api/qt/stock/get?fltt=2&fields=${fields}&secid=${secid}`;
  const json = await fetchJsonSafe<EmStockResp>(url);
  const d = json?.data;
  if (d) {
    return {
      symbol: String(d.f57 ?? code),
      secid,
      name: String(d.f58 ?? ''),
      price: Number(d.f43) || 0,
      open: Number(d.f46) || 0,
      prevClose: Number(d.f60) || 0,
      changeAmount: Number(d.f169) || 0,
      changePercent: Number(d.f170) || 0,
      volume: Number(d.f47) || 0,
      amount: Number(d.f48) || 0,
      high: Number(d.f44) || 0,
      low: Number(d.f45) || 0,
    };
  }
  const fallback = await fetchTencentQuotes([code]);
  return fallback.get(code) ?? null;
}

function rowToQuote(
  symbol: string,
  secid: string,
  row: Record<string, unknown>
): StockQuote {
  return {
    symbol,
    secid,
    name: String(row.f14 ?? ''),
    price: Number(row.f2) || 0,
    open: Number(row.f17) || Number(row.f2) || 0,
    prevClose: Number(row.f18) || 0,
    changeAmount: Number(row.f4) || 0,
    changePercent: Number(row.f3) || 0,
    volume: Number(row.f47) || 0,
    amount: Number(row.f48) || 0,
    high: Number(row.f15) || 0,
    low: Number(row.f16) || 0,
  };
}

/** 搜索 A 股 / ETF */
export async function searchStocks(
  keyword: string
): Promise<StockSearchResult[]> {
  const q = keyword.trim();
  if (!q) return [];
  const url = `${EM_SEARCH}/api/suggest/get?input=${encodeURIComponent(q)}&type=14&count=10`;
  const json = await fetchJsonSafe<{
    QuotationCodeTable?: {
      Data?: {
        Code: string;
        Name: string;
        QuoteID: string;
        SecurityTypeName?: string;
      }[];
    };
  }>(url);
  if (!json) return [];
  const rows = json.QuotationCodeTable?.Data ?? [];
  return rows
    .filter((r) => r.Code && r.QuoteID)
    .map((r) => ({
      symbol: r.Code,
      name: r.Name,
      secid: r.QuoteID,
      market: r.SecurityTypeName ?? '',
    }));
}

export function formatChangePercent(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function changeClass(n: number): 'up' | 'down' | 'flat' {
  if (n > 0.001) return 'up';
  if (n < -0.001) return 'down';
  return 'flat';
}

/** 根据真实指数与涨跌家数给出环境评分建议（仍需人工确认） */
export function suggestEnvScores(indices: IndexQuote[], breadth: MarketBreadth | null): {
  indexTrend: 0 | 1 | 2;
  profitEffect: 0 | 1 | 2;
  volume: 0 | 1 | 2;
  hint: string;
} {
  const sh = indices.find((i) => i.code === '000001');
  const cp = sh?.changePercent ?? 0;

  let indexTrend: 0 | 1 | 2 = 1;
  if (cp > 0.3) indexTrend = 2;
  else if (cp < -0.3) indexTrend = 0;

  let profitEffect: 0 | 1 | 2 = 1;
  if (breadth) {
    if (breadth.upRatio >= 0.55) profitEffect = 2;
    else if (breadth.upRatio <= 0.4) profitEffect = 0;
  }

  const avgChg =
    indices.reduce((s, i) => s + i.changePercent, 0) / (indices.length || 1);
  let volume: 0 | 1 | 2 = 1;
  if (Math.abs(avgChg) > 1) volume = 2;
  else if (Math.abs(avgChg) < 0.2) volume = 0;

  const hint = breadth
    ? `上证 ${cp.toFixed(2)}%，涨跌比约 ${(breadth.upRatio * 100).toFixed(0)}% 上涨（${breadth.up}↑ ${breadth.down}↓）`
    : `上证 ${cp.toFixed(2)}%`;

  return { indexTrend, profitEffect, volume, hint };
}
