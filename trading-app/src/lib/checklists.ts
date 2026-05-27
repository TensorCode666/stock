export const PRE_MARKET_ITEMS = [
  { key: 'suitable', label: '今天是否适合交易？' },
  { key: 'marketType', label: '当前市场是多头、空头还是震荡？' },
  { key: 'emotionStage', label: '当前情绪周期处于哪个阶段？' },
  { key: 'mainSector', label: '今天重点板块是什么？' },
  { key: 'totalPosition', label: '总仓位是否合理？' },
  { key: 'holdingRisk', label: '持仓股是否有风险信号？' },
  { key: 'watchlistReady', label: '观察池是否有接近买点的标的？' },
  { key: 'buyPlan', label: '今天是否有明确买入计划？' },
  { key: 'sellPlan', label: '今天是否有明确卖出计划？' },
] as const;

export const BUY_BEFORE_ITEMS = [
  { key: 'mode', label: '这笔交易属于哪种模式？' },
  { key: 'env', label: '是否符合当前市场环境？' },
  { key: 'watchlist', label: '是否在观察池内？' },
  { key: 'buyPoint', label: '买点是否清楚？' },
  { key: 'stop', label: '止损位是否清楚？' },
  { key: 'target', label: '目标位是否清楚？' },
  { key: 'rr', label: '盈亏比是否合适（≥2:1）？' },
  { key: 'position', label: '仓位是否低于上限？' },
  { key: 'exit', label: '如果买错，是否愿意立刻认错？' },
] as const;

export const HOLDING_ITEMS = [
  { key: 'trend', label: '趋势是否仍然存在？' },
  { key: 'support', label: '是否跌破关键支撑？' },
  { key: 'stall', label: '是否出现放量滞涨？' },
  { key: 'weakSector', label: '是否弱于板块？' },
  { key: 'takeProfit', label: '是否达到止盈位置？' },
  { key: 'reduce', label: '是否需要降仓？' },
  { key: 'addImpulse', label: '是否有情绪化加仓冲动？' },
] as const;

export const SELL_BEFORE_ITEMS = [
  { key: 'rule', label: '卖出是因为规则，还是因为害怕？' },
  { key: 'stop', label: '当前是否触发止损？' },
  { key: 'profit', label: '当前是否触发止盈？' },
  { key: 'trendBreak', label: '趋势是否破坏？' },
  { key: 'emotionDown', label: '情绪是否退潮？' },
  { key: 'batch', label: '是否可以分批处理？' },
] as const;

export const POST_MARKET_ITEMS = [
  { key: 'followPlan', label: '今天是否按计划交易？' },
  { key: 'outside', label: '有无系统外交易？' },
  { key: 'chase', label: '有无追高？' },
  { key: 'lossAdd', label: '有无亏损加仓？' },
  { key: 'delayStop', label: '有无止损拖延？' },
  { key: 'adjustHold', label: '持仓是否需要调整？' },
  { key: 'updateWatch', label: '观察池是否需要更新？' },
  { key: 'tomorrowPlan', label: '明天的计划是否已经写好？' },
] as const;

export function emptyChecks(
  items: readonly { key: string; label: string }[]
): Record<string, boolean> {
  return Object.fromEntries(items.map((i) => [i.key, false]));
}
