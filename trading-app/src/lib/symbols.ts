/** A 股代码 → 东方财富 secid（市场.代码） */
export function symbolToSecId(symbol: string): string {
  const code = symbol.replace(/\D/g, '').slice(0, 6);
  if (!code) return '';
  // 沪市：60/68/51 等
  if (/^(5|6|9)/.test(code)) return `1.${code}`;
  // 深市：00/30/15 等
  return `0.${code}`;
}

export function normalizeSymbol(input: string): string {
  return input.replace(/\D/g, '').slice(0, 6);
}

export function isValidSymbol(symbol: string): boolean {
  const code = normalizeSymbol(symbol);
  return /^\d{6}$/.test(code);
}

/** 腾讯行情 / K 线前缀：沪市 sh，深市 sz */
export function symbolToTencentMarket(symbol: string): string {
  const code = normalizeSymbol(symbol);
  if (!code) return '';
  const prefix = /^(5|6|9)/.test(code) ? 'sh' : 'sz';
  return `${prefix}${code}`;
}
