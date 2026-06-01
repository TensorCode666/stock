import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { LazyStockChartPanels } from '../components/LazyStockChartPanels';
import { StockQuoteHero } from '../components/StockQuoteHero';
import { useWatchlistItem } from '../context/AppContext';
import { useQuote } from '../context/MarketDataContext';
import {
  stockScoreLabel,
  stockScoreTotal,
  TRADE_MODE_LABELS,
} from '../lib/calculations';
import { fetchKlinesCached, fetchStockChartDataCached, getStockChartDataSync } from '../lib/kline-cache';
import {
  KLINE_PERIOD_LABELS,
  type EnrichedBar,
  type KlinePeriod,
} from '../lib/kline-indicators';
import { fetchStockQuote, type StockQuote } from '../lib/market-api';
import { normalizeSymbol } from '../lib/symbols';

type LocationState = {
  name?: string;
  watchlistId?: string;
};

export function StockDetail() {
  const { symbol: symbolParam } = useParams<{ symbol: string }>();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;
  const symbol = normalizeSymbol(symbolParam ?? '');
  const watchItem = useWatchlistItem(symbol, state.watchlistId);

  const displayName = watchItem?.name || state.name || symbol;
  const [period, setPeriod] = useState<KlinePeriod>('day');
  const [bars, setBars] = useState<EnrichedBar[]>(() => {
    if (!symbol) return [];
    return getStockChartDataSync(symbol, 'day')?.bars ?? [];
  });
  const storeQuote = useQuote(symbol);
  const [fallbackQuote, setFallbackQuote] = useState<StockQuote | undefined>();
  const quote = storeQuote ?? fallbackQuote;
  const [loading, setLoading] = useState(() => {
    if (!symbol) return false;
    return !getStockChartDataSync(symbol, 'day')?.bars.length;
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;

    const cached = getStockChartDataSync(symbol, period);
    if (cached?.bars.length) {
      setBars(cached.bars);
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
      setError(null);
    }

    void fetchStockChartDataCached(symbol, period).then((chart) => {
      if (cancelled) return;
      if (!chart?.bars.length) {
        if (!cached?.bars.length) {
          setError(
            `${KLINE_PERIOD_LABELS[period]}数据加载失败，请检查网络或稍后重试`
          );
          setBars([]);
        }
      } else {
        setBars(chart.bars);
        setError(null);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [symbol, period]);

  useEffect(() => {
    if (!symbol || loading || !bars.length) return;
    if (period === 'day') {
      void fetchKlinesCached(symbol, 'week', 120);
      void fetchKlinesCached(symbol, 'month', 120);
    }
  }, [symbol, period, loading, bars.length]);

  useEffect(() => {
    if (!symbol || storeQuote) {
      setFallbackQuote(undefined);
      return;
    }
    let cancelled = false;
    void fetchStockQuote(symbol).then((q) => {
      if (!cancelled && q) setFallbackQuote(q);
    });
    return () => {
      cancelled = true;
    };
  }, [symbol, storeQuote]);

  if (!symbol) {
    return (
      <div className="page">
        <p className="market-error">无效股票代码</p>
        <Link to="/watchlist">← 返回观察池</Link>
      </div>
    );
  }

  const scoreTotal = watchItem ? stockScoreTotal(watchItem) : null;

  return (
    <div className="page stock-detail">
      <header className="page-header">
        <Link to="/watchlist" className="back-link">
          ← 返回观察池
        </Link>
        <div className="stock-detail-head row-between">
          <StockQuoteHero symbol={symbol} name={displayName} quote={quote} />
          {watchItem && (
            <div className="stock-meta card compact">
              <div>
                <span className="muted">模式</span>{' '}
                {TRADE_MODE_LABELS[watchItem.mode]}
              </div>
              {scoreTotal != null && (
                <div>
                  <span className="muted">评分</span>{' '}
                  <strong>{scoreTotal}</strong>/20 —{' '}
                  {stockScoreLabel(scoreTotal).label}
                </div>
              )}
              <div>
                <span className="muted">状态</span>{' '}
                {watchItem.status === 'ready' ? '待买点' : '观察中'}
              </div>
              {watchItem.screenReasons && watchItem.screenReasons.length > 0 && (
                <div className="screen-reasons">
                  <span className="muted">符合规则</span>
                  <ul>
                    {watchItem.screenReasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
              {watchItem.notes && (
                <div>
                  <span className="muted">备注</span> {watchItem.notes}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="kline-period-tabs">
        {(['day', 'week', 'month'] as const).map((p) => (
          <button
            key={p}
            type="button"
            className={period === p ? 'period-btn active' : 'period-btn'}
            disabled={loading && period === p}
            onClick={() => setPeriod(p)}
          >
            {KLINE_PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {error && <div className="market-error">{error}</div>}

      {loading && bars.length === 0 && <p className="muted">图表加载中…</p>}

      {bars.length > 0 && (
        <LazyStockChartPanels
          bars={bars}
          period={period}
          currentPrice={quote?.price}
        />
      )}
    </div>
  );
}
