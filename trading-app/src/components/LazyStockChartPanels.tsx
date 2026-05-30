import { lazy, Suspense } from 'react';
import type { EnrichedBar, KlinePeriod } from '../lib/kline-indicators';

const StockChartPanels = lazy(() =>
  import('./StockChartPanels').then((m) => ({ default: m.StockChartPanels }))
);

export function LazyStockChartPanels({
  bars,
  period = 'day',
  currentPrice,
}: {
  bars: EnrichedBar[];
  period?: KlinePeriod;
  currentPrice?: number;
}) {
  return (
    <Suspense fallback={<p className="muted">图表组件加载中…</p>}>
      <StockChartPanels bars={bars} period={period} currentPrice={currentPrice} />
    </Suspense>
  );
}
