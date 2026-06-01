import { useEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
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
  ma5?: number | null;
  ma20?: number | null;
  ma30?: number | null;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
};

const SERIES_LABEL_OPTS = {
  title: '',
  lastValueVisible: false,
  priceLineVisible: false,
} as const;

const CHART_OPTS = {
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
} as const;

type ChartBundle = {
  mainChart: IChartApi;
  volChart: IChartApi;
  macdChart: IChartApi;
  candles: ISeriesApi<'Candlestick'>;
  ma5: ISeriesApi<'Line'>;
  ma20: ISeriesApi<'Line'>;
  ma30: ISeriesApi<'Line'>;
  volSeries: ISeriesApi<'Histogram'>;
  macdHist: ISeriesApi<'Histogram'>;
  difLine: ISeriesApi<'Line'>;
  deaLine: ISeriesApi<'Line'>;
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

function applyBarsToCharts(
  bundle: ChartBundle,
  bars: EnrichedBar[],
  fitContent: boolean
) {
  bundle.candles.setData(
    bars.map((b) => ({
      time: toTime(b.date),
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }))
  );
  bundle.ma5.setData(
    bars
      .filter((b) => b.ma5 != null)
      .map((b) => ({ time: toTime(b.date), value: b.ma5! }))
  );
  bundle.ma20.setData(
    bars
      .filter((b) => b.ma20 != null)
      .map((b) => ({ time: toTime(b.date), value: b.ma20! }))
  );
  bundle.ma30.setData(
    bars
      .filter((b) => b.ma30 != null)
      .map((b) => ({ time: toTime(b.date), value: b.ma30! }))
  );
  bundle.volSeries.setData(
    bars.map((b) => ({
      time: toTime(b.date),
      value: b.volume,
      color:
        b.close >= b.open ? 'rgba(248,113,113,0.5)' : 'rgba(52,211,153,0.5)',
    }))
  );
  bundle.macdHist.setData(
    bars
      .filter((b) => b.macd)
      .map((b) => ({
        time: toTime(b.date),
        value: b.macd!.hist,
        color: b.macd!.hist >= 0 ? '#f8717188' : '#34d39988',
      }))
  );
  bundle.difLine.setData(
    bars
      .filter((b) => b.macd)
      .map((b) => ({ time: toTime(b.date), value: b.macd!.dif }))
  );
  bundle.deaLine.setData(
    bars
      .filter((b) => b.macd)
      .map((b) => ({ time: toTime(b.date), value: b.macd!.dea }))
  );
  const charts = [bundle.mainChart, bundle.volChart, bundle.macdChart];
  if (fitContent) {
    charts.forEach((c) => c.timeScale().fitContent());
  }
}

function createChartBundle(
  mainEl: HTMLDivElement,
  volEl: HTMLDivElement,
  macdEl: HTMLDivElement
): ChartBundle {
  const mainChart = createChart(mainEl, { ...CHART_OPTS, height: 320 });
  const volChart = createChart(volEl, { ...CHART_OPTS, height: 100 });
  const macdChart = createChart(macdEl, { ...CHART_OPTS, height: 120 });

  const candles = mainChart.addSeries(CandlestickSeries, {
    upColor: '#f87171',
    downColor: '#34d399',
    borderUpColor: '#f87171',
    borderDownColor: '#34d399',
    wickUpColor: '#f87171',
    wickDownColor: '#34d399',
    ...SERIES_LABEL_OPTS,
  });
  const ma5 = mainChart.addSeries(LineSeries, {
    color: MA_COLORS.ma5,
    lineWidth: 1,
    ...SERIES_LABEL_OPTS,
  });
  const ma20 = mainChart.addSeries(LineSeries, {
    color: MA_COLORS.ma20,
    lineWidth: 1,
    ...SERIES_LABEL_OPTS,
  });
  const ma30 = mainChart.addSeries(LineSeries, {
    color: MA_COLORS.ma30,
    lineWidth: 1,
    ...SERIES_LABEL_OPTS,
  });
  const volSeries = volChart.addSeries(HistogramSeries, {
    priceFormat: { type: 'volume' },
    priceScaleId: '',
  });
  const macdHist = macdChart.addSeries(HistogramSeries, {
    priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
  });
  const difLine = macdChart.addSeries(LineSeries, {
    color: '#3d8bfd',
    lineWidth: 1,
    ...SERIES_LABEL_OPTS,
  });
  const deaLine = macdChart.addSeries(LineSeries, {
    color: '#fb923c',
    lineWidth: 1,
    ...SERIES_LABEL_OPTS,
  });

  return {
    mainChart,
    volChart,
    macdChart,
    candles,
    ma5,
    ma20,
    ma30,
    volSeries,
    macdHist,
    difLine,
    deaLine,
  };
}

export function StockChartPanels({
  bars,
  period = 'day',
  currentPrice,
}: {
  bars: EnrichedBar[];
  period?: KlinePeriod;
  currentPrice?: number;
}) {
  const mainWrapRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const volRef = useRef<HTMLDivElement>(null);
  const macdRef = useRef<HTMLDivElement>(null);
  const bundleRef = useRef<ChartBundle | null>(null);
  const barByTimeRef = useRef<Map<string, EnrichedBar>>(new Map());
  const barsRef = useRef(bars);
  barsRef.current = bars;
  const shouldFitRef = useRef(true);
  const lastPeriodRef = useRef(period);
  const priceRef = useRef(0);
  const crosshairRaf = useRef(0);
  const [crosshairHint, setCrosshairHint] = useState<CrosshairHint | null>(
    null
  );
  const [wrapWidth, setWrapWidth] = useState(720);

  const latestClose = bars.length ? bars[bars.length - 1]!.close : 0;
  const refCurrent =
    currentPrice != null && currentPrice > 0 ? currentPrice : latestClose;

  useEffect(() => {
    priceRef.current = refCurrent;
  }, [refCurrent]);

  useEffect(() => {
    const el = mainWrapRef.current;
    if (!el) return;
    const update = () => setWrapWidth(el.clientWidth || 720);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!mainRef.current || !volRef.current || !macdRef.current) return;

    const bundle = createChartBundle(
      mainRef.current,
      volRef.current,
      macdRef.current
    );
    bundleRef.current = bundle;

    if (barsRef.current.length) {
      barByTimeRef.current = new Map(
        barsRef.current.map((b) => [b.date.slice(0, 10), b])
      );
      applyBarsToCharts(bundle, barsRef.current, true);
      shouldFitRef.current = false;
    }

    const charts = [bundle.mainChart, bundle.volChart, bundle.macdChart];
    const unsync = syncCharts(charts);

    const onCrosshairMove = (param: {
      point?: { x: number; y: number };
      time?: Time;
    }) => {
      cancelAnimationFrame(crosshairRaf.current);
      crosshairRaf.current = requestAnimationFrame(() => {
        const livePrice = priceRef.current;
        if (!param.point || livePrice <= 0) {
          setCrosshairHint(null);
          return;
        }

        const yPrice = bundle.candles.coordinateToPrice(param.point.y);
        if (yPrice == null || !Number.isFinite(yPrice)) {
          setCrosshairHint(null);
          return;
        }

        let date: string | undefined;
        let bar: EnrichedBar | undefined;
        if (param.time) {
          const t = String(param.time).slice(0, 10);
          bar = barByTimeRef.current.get(t);
          date = bar?.date.slice(0, 10) ?? t;
        }

        setCrosshairHint({
          x: param.point.x,
          y: param.point.y,
          refPrice: yPrice,
          currentPrice: livePrice,
          changePct: pctVsCurrent(yPrice, livePrice),
          date,
          ma5: bar?.ma5,
          ma20: bar?.ma20,
          ma30: bar?.ma30,
          open: bar?.open,
          high: bar?.high,
          low: bar?.low,
          close: bar?.close,
        });
      });
    };

    bundle.mainChart.subscribeCrosshairMove(onCrosshairMove);

    const onResize = () => {
      const w = mainRef.current?.clientWidth ?? 600;
      bundle.mainChart.applyOptions({ width: w });
      bundle.volChart.applyOptions({ width: w });
      bundle.macdChart.applyOptions({ width: w });
    };
    onResize();
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(crosshairRaf.current);
      bundle.mainChart.unsubscribeCrosshairMove(onCrosshairMove);
      unsync();
      window.removeEventListener('resize', onResize);
      bundle.mainChart.remove();
      bundle.volChart.remove();
      bundle.macdChart.remove();
      bundleRef.current = null;
      setCrosshairHint(null);
    };
  }, []);

  useEffect(() => {
    const bundle = bundleRef.current;
    if (!bundle || !bars.length) return;
    if (lastPeriodRef.current !== period) {
      lastPeriodRef.current = period;
      shouldFitRef.current = true;
    }
    barByTimeRef.current = new Map(bars.map((b) => [b.date.slice(0, 10), b]));
    const fit = shouldFitRef.current;
    applyBarsToCharts(bundle, bars, fit);
    if (fit) shouldFitRef.current = false;
  }, [bars, period]);

  useEffect(() => {
    const bundle = bundleRef.current;
    if (!bundle || period !== 'day' || !bars.length) return;
    if (currentPrice == null || currentPrice <= 0) return;

    const last = bars[bars.length - 1]!;
    if (
      last.close === currentPrice &&
      last.high >= currentPrice &&
      last.low <= currentPrice
    ) {
      return;
    }

    const time = toTime(last.date);
    bundle.candles.update({
      time,
      open: last.open,
      high: Math.max(last.high, currentPrice),
      low: Math.min(last.low, currentPrice),
      close: currentPrice,
    });
  }, [currentPrice, bars, period]);

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
          <>
            {crosshairHint.date && (
              <div className="chart-series-legend">
                <div className="chart-series-legend-date">
                  {crosshairHint.date}
                </div>
                <div className="chart-series-legend-rows">
                  {crosshairHint.ma5 != null && (
                    <div className="chart-series-legend-row">
                      <span style={{ color: MA_COLORS.ma5 }}>MA5</span>
                      <span>{crosshairHint.ma5.toFixed(2)}</span>
                    </div>
                  )}
                  {crosshairHint.ma20 != null && (
                    <div className="chart-series-legend-row">
                      <span style={{ color: MA_COLORS.ma20 }}>MA20</span>
                      <span>{crosshairHint.ma20.toFixed(2)}</span>
                    </div>
                  )}
                  {crosshairHint.ma30 != null && (
                    <div className="chart-series-legend-row">
                      <span style={{ color: MA_COLORS.ma30 }}>MA30</span>
                      <span>{crosshairHint.ma30.toFixed(2)}</span>
                    </div>
                  )}
                  {crosshairHint.close != null && (
                    <div className="chart-series-legend-row chart-series-legend-close">
                      <span>收盘</span>
                      <span>{crosshairHint.close.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div
              className={`chart-crosshair-hint ${hintCls}`}
              style={{
                left: Math.min(
                  Math.max(crosshairHint.x + 14, 8),
                  wrapWidth - 168
                ),
                top: Math.min(Math.max(crosshairHint.y + 14, 8), 280),
              }}
            >
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
          </>
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
