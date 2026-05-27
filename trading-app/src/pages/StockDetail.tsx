import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { StockChartPanels } from '../components/StockChartPanels';
import { useApp } from '../context/AppContext';
import { useMarketData } from '../context/MarketDataContext';
import {
  stockScoreLabel,
  stockScoreTotal,
  TRADE_MODE_LABELS,
} from '../lib/calculations';
import { fetchStockChartData } from '../lib/kline-indicators';
import type { EnrichedBar } from '../lib/kline-indicators';
import {
  changeClass,
  fetchStockQuote,
  formatChangePercent,
  type StockQuote,
} from '../lib/market-api';
import { normalizeSymbol } from '../lib/symbols';

type LocationState = {
  name?: string;
  watchlistId?: string;
};

export function StockDetail() {
  const { symbol: symbolParam } = useParams<{ symbol: string }>();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;
  const { data } = useApp();
  const { getQuote, refresh } = useMarketData();

  const symbol = normalizeSymbol(symbolParam ?? '');
  const watchItem = useMemo(
    () =>
      data.watchlist.find(
        (w) =>
          w.status !== 'removed' &&
          (w.id === state.watchlistId || normalizeSymbol(w.symbol) === symbol)
      ),
    [data.watchlist, state.watchlistId, symbol]
  );

  const displayName = watchItem?.name || state.name || symbol;
  const [bars, setBars] = useState<EnrichedBar[]>([]);
  const [quote, setQuote] = useState<StockQuote | undefined>(() =>
    symbol ? getQuote(symbol) : undefined
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      const [chart, q] = await Promise.all([
        fetchStockChartData(symbol),
        getQuote(symbol) ? Promise.resolve(getQuote(symbol)!) : fetchStockQuote(symbol),
      ]);
      if (cancelled) return;
      if (!chart?.bars.length) {
        setError('K 线数据加载失败，请检查网络或稍后重试');
        setBars([]);
      } else {
        setBars(chart.bars);
      }
      if (q) setQuote(q);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [symbol, getQuote]);

  useEffect(() => {
    if (symbol) void refresh();
  }, [symbol, refresh]);

  useEffect(() => {
    const q = getQuote(symbol);
    if (q) setQuote(q);
  }, [getQuote, symbol]);

  if (!symbol) {
    return (
      <div className="page">
        <p className="market-error">无效股票代码</p>
        <Link to="/watchlist">← 返回观察池</Link>
      </div>
    );
  }

  const price = quote?.price;
  const chg = quote?.changePercent ?? 0;
  const scoreTotal = watchItem ? stockScoreTotal(watchItem) : null;

  return (
    <div className="page stock-detail">
      <header className="page-header">
        <Link to="/watchlist" className="back-link">
          ← 返回观察池
        </Link>
        <div className="stock-detail-head row-between">
          <div>
            <h2>
              {symbol}{' '}
              <span className="stock-name">{displayName}</span>
            </h2>
            {price != null && price > 0 ? (
              <p className={`stock-price ${changeClass(chg)}`}>
                <strong>{price.toFixed(2)}</strong>
                <span className="chg">
                  {quote?.changeAmount != null && quote.changeAmount >= 0 ? '+' : ''}
                  {quote?.changeAmount?.toFixed(2) ?? '—'} (
                  {formatChangePercent(chg)})
                </span>
              </p>
            ) : (
              <p className="muted">现价加载中…</p>
            )}
          </div>
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

      {error && <div className="market-error">{error}</div>}

      {loading && <p className="muted">图表加载中…</p>}

      {!loading && bars.length > 0 && <StockChartPanels bars={bars} />}
    </div>
  );
}
