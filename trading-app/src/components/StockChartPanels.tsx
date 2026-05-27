import { useEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type LogicalRange,
  type Time,
} from 'lightweight-charts';
import { formatChangePercent } from '../lib/market-api';
import type { EnrichedBar, KlinePeriod } from '../lib/kline-indicators';
import { KLINE_PERIOD_LABELS } from '../lib/kline-indicators';

const MA_COLORS = {
  ma5: '#fbbf24',
  ma20: '#3d8bfd',
  ma30: '#a78bfa',
} as const;

function toTime(date: string): Time {
  return date.slice(0, 10) as Time;
}

type CrosshairHint = {
  x: number;
  y: number;
  refPrice: number;
  currentPrice: number;
  changePct: number;
  date?: string;
};

function pctVsCurrent(ref: number, current: number): number {
  if (!ref) return 0;
  return ((current - ref) / ref) * 100;
}

function syncCharts(charts: IChartApi[]) {
  const handlers = charts.map((_, i) => {
    const handler = (range: LogicalRange | null) => {
      if (!range) return;
      charts.forEach((c, j) => {
        if (j !== i) c.timeScale().setVisibleLogicalRange(range);
      });
    };
    charts[i]!.timeScale().subscribeVisibleLogicalRangeChange(handler);
    return handler;
  });
  return () => {
    charts.forEach((c, i) =>
      c.timeScale().unsubscribeVisibleLogicalRangeChange(handlers[i]!)
    );
  };
}

export function StockChartPanels({
  bars,
  period = 'day',
  currentPrice,
}: {
  bars: EnrichedBar[];
  period?: KlinePeriod;
  /** 现价（实时报价）；未传则用最后一根 K 线收盘价 */
  currentPrice?: number;
}) {
  const mainWrapRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const volRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);
  const [crosshairHint, setCrosshairHint] = useState<CrosshairHint | null>(
    null
  );

  const latestClose = bars.length ? bars[bars.length - 1]!.close : 0;
  const refCurrent =
    currentPrice != null && currentPrice > 0 ? currentPrice : latestClose;

  useEffect(() => {
    if (!mainRef.current || !volRef.current || !macdRef.current || !bars.length) {
      return;
    }

    const chartOpts = {
      layout: {
        background: { type: ColorType.Solid, color: '#141a24' },
        textColor: '#8b9bb4',
      },
      grid: {
        vertLines: { color: '#2a354833' },
        horzLines: { color: '#2a354833' },
      },
      rightPriceScale: { borderColor: '#2a3548' },
      timeScale: { borderColor: '#2a3548', timeVisible: true },
      crosshair: { mode: 1 },
    };

    const mainChart = createChart(mainRef.current, {
      ...chartOpts,
      height: 320,
    });
    const volChart = createChart(volRef.current, {
      ...chartOpts,
      height: 100,
    });
    const macdChart = createChart(macdRef.current, {
      ...chartOpts,
      height: 120,
    });

    const candles = mainChart.addSeries(CandlestickSeries, {
      upColor: '#f87171',
      downColor: '#34d399',
      borderUpColor: '#f87171',
      borderDownColor: '#34d399',
      wickUpColor: '#f87171',
      wickDownColor: '#34d399',
    });
    candles.setData(
      bars.map((b) => ({
        time: toTime(b.date),
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
      }))
    );

    const ma5 = mainChart.addSeries(LineSeries, {
      color: MA_COLORS.ma5,
      lineWidth: 1,
      title: 'MA5',
    });
    const ma20 = mainChart.addSeries(LineSeries, {
      color: MA_COLORS.ma20,
      lineWidth: 1,
      title: 'MA20',
    });
    const ma30 = mainChart.addSeries(LineSeries, {
      color: MA_COLORS.ma30,
      lineWidth: 1,
      title: 'MA30',
    });
    ma5.setData(
      bars
        .filter((b) => b.ma5 != null)
        .map((b) => ({ time: toTime(b.date), value: b.ma5! }))
    );
    ma20.setData(
      bars
        .filter((b) => b.ma20 != null)
        .map((b) => ({ time: toTime(b.date), value: b.ma20! }))
    );
    ma30.setData(
      bars
        .filter((b) => b.ma30 != null)
        .map((b) => ({ time: toTime(b.date), value: b.ma30! }))
    );

    const volSeries = volChart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volSeries.setData(
      bars.map((b) => ({
        time: toTime(b.date),
        value: b.volume,
        color:
          b.close >= b.open ? 'rgba(248,113,113,0.5)' : 'rgba(52,211,153,0.5)',
      }))
    );

    const macdHist = macdChart.addSeries(HistogramSeries, {
      priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
    });
    macdHist.setData(
      bars
        .filter((b) => b.macd)
        .map((b) => ({
          time: toTime(b.date),
          value: b.macd!.hist,
          color: b.macd!.hist >= 0 ? '#f8717188' : '#34d39988',
        }))
    );
    const difLine = macdChart.addSeries(LineSeries, {
      color: '#3d8bfd',
      lineWidth: 1,
      title: 'DIF',
    });
    const deaLine = macdChart.addSeries(LineSeries, {
      color: '#fb923c',
      lineWidth: 1,
      title: 'DEA',
    });
    difLine.setData(
      bars
        .filter((b) => b.macd)
        .map((b) => ({ time: toTime(b.date), value: b.macd!.dif }))
    );
    deaLine.setData(
      bars
        .filter((b) => b.macd)
        .map((b) => ({ time: toTime(b.date), value: b.macd!.dea }))
    );

    const charts = [mainChart, volChart, macdChart];
    const unsync = syncCharts(charts);
    charts.forEach((c) => c.timeScale().fitContent());

    const barByTime = new Map(bars.map((b) => [b.date.slice(0, 10), b]));

    const onCrosshairMove = (param: {
      point?: { x: number; y: number };
      time?: Time;
    }) => {
      if (!param.point || refCurrent <= 0) {
        setCrosshairHint(null);
        return;
      }

      const yPrice = candles.coordinateToPrice(param.point.y);
      if (yPrice == null || !Number.isFinite(yPrice)) {
        setCrosshairHint(null);
        return;
      }

      let date: string | undefined;
      if (param.time) {
        const t = String(param.time).slice(0, 10);
        date = barByTime.get(t)?.date.slice(0, 10) ?? t;
      }

      const changePct = pctVsCurrent(yPrice, refCurrent);
      setCrosshairHint({
        x: param.point.x,
        y: param.point.y,
        refPrice: yPrice,
        currentPrice: refCurrent,
        changePct,
        date,
      });
    };

    mainChart.subscribeCrosshairMove(onCrosshairMove);

    const onResize = () => {
      const w = mainRef.current?.clientWidth ?? 600;
      mainChart.applyOptions({ width: w });
      volChart.applyOptions({ width: w });
      macdChart.applyOptions({ width: w });
    };
    onResize();
    window.addEventListener('resize', onResize);

    return () => {
      mainChart.unsubscribeCrosshairMove(onCrosshairMove);
      unsync();
      window.removeEventListener('resize', onResize);
      mainChart.remove();
      volChart.remove();
      macdChart.remove();
      setCrosshairHint(null);
    };
  }, [bars, refCurrent]);

  const hintCls =
    crosshairHint == null
      ? ''
      : crosshairHint.changePct > 0.001
        ? 'up'
        : crosshairHint.changePct < -0.001
          ? 'down'
          : 'flat';

  return (
    <div className="stock-charts">
      <div className="chart-legend">
        <span style={{ color: MA_COLORS.ma5 }}>MA5</span>
        <span style={{ color: MA_COLORS.ma20 }}>MA20</span>
        <span style={{ color: MA_COLORS.ma30 }}>MA30</span>
        <span className="muted">
          K线红涨绿跌 · 前复权{KLINE_PERIOD_LABELS[period]}
        </span>
        {refCurrent > 0 && (
          <span className="muted chart-legend-hint">
            十字光标价位对比现价（现价 {refCurrent.toFixed(2)}）
          </span>
        )}
      </div>
      <div ref={mainWrapRef} className="chart-pane-wrap">
        <div ref={mainRef} className="chart-pane" />
        {crosshairHint && (
          <div
            className={`chart-crosshair-hint ${hintCls}`}
            style={{
              left: Math.min(
                Math.max(crosshairHint.x + 12, 8),
                (mainWrapRef.current?.clientWidth ?? 400) - 220
              ),
              top: Math.max(crosshairHint.y - 52, 8),
            }}
          >
            {crosshairHint.date && (
              <span className="hint-date">{crosshairHint.date}</span>
            )}
            <span className="hint-price">
              光标 {crosshairHint.refPrice.toFixed(2)}
            </span>
            <span className="hint-vs">
              现价 {crosshairHint.currentPrice.toFixed(2)}
            </span>
            <strong className="hint-pct">
              较光标 {formatChangePercent(crosshairHint.changePct)}
            </strong>
          </div>
        )}
      </div>
      <p className="chart-label">成交量</p>
      <div ref={volRef} className="chart-pane" />
      <p className="chart-label">MACD (12, 26, 9)</p>
      <div className="macd-legend">
        <span style={{ color: '#3d8bfd' }}>DIF</span>
        <span style={{ color: '#fb923c' }}>DEA</span>
        <span className="muted">柱 = 2×(DIF−DEA)</span>
      </div>
      <div ref={macdRef} className="chart-pane" />
    </div>
  );
}
