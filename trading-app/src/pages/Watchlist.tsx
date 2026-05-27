import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { QuoteCell } from '../components/QuoteCell';
import { StockSearch } from '../components/StockSearch';
import { useApp } from '../context/AppContext';
import { useMarketData } from '../context/MarketDataContext';
import {
  envScoreTotal,
  stockScoreLabel,
  stockScoreTotal,
  TRADE_MODE_LABELS,
} from '../lib/calculations';
import {
  mergeCandidatesToWatchlist,
  runStockScreen,
  type ScreenCandidate,
  type ScreenProgress,
} from '../lib/stock-screener';
import { newId, todayStr } from '../lib/storage';
import type { TradeMode, WatchlistItem } from '../types';

const SCORE_FIELDS = [
  { key: 'marketEnv' as const, label: '市场环境', max: 4 },
  { key: 'sector' as const, label: '板块强度', max: 4 },
  { key: 'trend' as const, label: '个股趋势', max: 4 },
  { key: 'volumePrice' as const, label: '量价关系', max: 3 },
  { key: 'buyPointClarity' as const, label: '买点清晰度', max: 3 },
  { key: 'riskReward' as const, label: '风险收益比', max: 2 },
];

function emptyItem(): WatchlistItem {
  return {
    id: newId(),
    symbol: '',
    name: '',
    mode: 'trend',
    source: 'manual',
    scores: {
      marketEnv: 2,
      sector: 2,
      trend: 2,
      volumePrice: 1,
      buyPointClarity: 1,
      riskReward: 1,
    },
    status: 'watch',
    notes: '',
    createdAt: new Date().toISOString(),
  };
}

export function Watchlist() {
  const { data, setData } = useApp();
  const { getQuote, refresh } = useMarketData();
  const [editing, setEditing] = useState<WatchlistItem | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScreenProgress | null>(null);
  const [preview, setPreview] = useState<ScreenCandidate[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);

  const todayEnv = data.envScores.find((e) => e.date === todayStr());
  const envTotal = todayEnv ? envScoreTotal(todayEnv) : 5;

  const active = data.watchlist.filter((w) => w.status !== 'removed');
  const screened = active.filter((w) => w.source === 'screen');
  const manual = active.filter((w) => w.source !== 'screen');

  const lastScreenTime = useMemo(() => {
    const times = screened
      .map((w) => w.screenedAt)
      .filter(Boolean)
      .sort()
      .reverse();
    return times[0] ? new Date(times[0]!).toLocaleString('zh-CN') : null;
  }, [screened]);

  const runScan = async () => {
    setScanning(true);
    setScanError(null);
    setPreview([]);
    setProgress({ phase: '准备', done: 0, total: 1 });
    try {
      const results = await runStockScreen({
        envTotal,
        emotionStage: todayEnv?.emotionStage,
        onProgress: setProgress,
      });
      setPreview(results);
      if (results.length === 0) {
        setScanError('当前暂无符合规则的股票，可稍后重试或放宽环境后再扫');
        return;
      }
      setData((prev) => ({
        ...prev,
        watchlist: mergeCandidatesToWatchlist(prev.watchlist, results),
      }));
      await refresh();
    } catch (e) {
      setScanError(e instanceof Error ? e.message : '扫描失败');
    } finally {
      setScanning(false);
      setProgress(null);
    }
  };

  const saveItem = () => {
    if (!editing || !editing.symbol.trim()) return;
    setData((prev) => {
      const item = { ...editing, source: editing.source ?? ('manual' as const) };
      const exists = prev.watchlist.some((w) => w.id === item.id);
      const watchlist = exists
        ? prev.watchlist.map((w) => (w.id === item.id ? item : w))
        : [...prev.watchlist, item];
      return { ...prev, watchlist };
    });
    setEditing(null);
    void refresh();
  };

  const remove = (id: string) => {
    setData((prev) => ({
      ...prev,
      watchlist: prev.watchlist.map((w) =>
        w.id === id ? { ...w, status: 'removed' as const } : w
      ),
    }));
  };

  const renderTable = (items: WatchlistItem[], title: string) => (
    <div className="watch-section">
      <h3>
        {title}
        <span className="badge">{items.length}</span>
      </h3>
      {items.length === 0 ? (
        <p className="muted small">暂无</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>代码</th>
              <th>名称</th>
              <th>模式</th>
              <th>评分</th>
              <th>现价</th>
              <th>符合规则</th>
              <th>状态</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((w) => {
              const total = stockScoreTotal(w);
              const label = stockScoreLabel(total);
              return (
                <tr key={w.id}>
                  <td>
                    <Link
                      to={`/stock/${w.symbol}`}
                      state={{ name: w.name, watchlistId: w.id }}
                      className="stock-link"
                    >
                      {w.symbol}
                    </Link>
                  </td>
                  <td>
                    <Link
                      to={`/stock/${w.symbol}`}
                      state={{ name: w.name, watchlistId: w.id }}
                      className="stock-link"
                    >
                      {w.name}
                    </Link>
                  </td>
                  <td>{TRADE_MODE_LABELS[w.mode]}</td>
                  <td>
                    <strong>{total}</strong>/20
                    <span className="small block">{label.label}</span>
                  </td>
                  <td>
                    <QuoteCell quote={getQuote(w.symbol)} />
                  </td>
                  <td className="small reason-cell">
                    {w.screenReasons?.slice(0, 2).join('；') ||
                      w.notes?.slice(0, 40) ||
                      '—'}
                  </td>
                  <td>{w.status === 'ready' ? '待买点' : '观察'}</td>
                  <td className="actions">
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => setEditing(w)}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="btn sm danger"
                      onClick={() => remove(w.id)}
                    >
                      剔除
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div className="page">
      <header className="page-header row-between">
        <div>
          <h2>观察池</h2>
          <p className="muted">
            自动扫描符合「趋势股 / 情绪短线 / ETF」规则的真实标的，并合并到观察池。
          </p>
        </div>
        <div className="btn-row">
          <button
            type="button"
            className="btn primary"
            disabled={scanning}
            onClick={() => void runScan()}
          >
            {scanning ? '扫描中…' : '扫描并更新观察池'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setEditing(emptyItem())}
          >
            + 手动添加
          </button>
        </div>
      </header>

      <div className="card section screen-rules">
        <h3>扫描规则（基于 trading-system 文档）</h3>
        <div className="grid-3 small-cards">
          <div>
            <strong>趋势股</strong>
            <ul>
              <li>股价在 20 日线附近或上方</li>
              <li>5 / 10 / 20 日均线多头排列</li>
              <li>未远离 5 日线，当日非大涨大跌</li>
              <li>成交活跃，回调缩量特征</li>
              <li>评分 ≥12 才纳入</li>
            </ul>
          </div>
          <div>
            <strong>情绪短线</strong>
            <ul>
              <li>环境 ≥5 分或情绪修复/主升期</li>
              <li>涨幅 5%–10.5%，换手 ≥4%</li>
              <li>成交活跃，非 ST</li>
            </ul>
          </div>
          <div>
            <strong>ETF</strong>
            <ul>
              <li>主流宽基 / 行业 ETF</li>
              <li>满足趋势均线结构</li>
            </ul>
          </div>
        </div>
        <p className="small muted">
          今日环境参考分 {envTotal}/10
          {todayEnv?.emotionStage ? ` · ${todayEnv.emotionStage}` : ''}
          {lastScreenTime ? ` · 上次扫描 ${lastScreenTime}` : ''}
        </p>
      </div>

      {scanning && progress && (
        <div className="card section scan-progress">
          <strong>{progress.phase}</strong>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${
                  progress.total > 0
                    ? (progress.done / progress.total) * 100
                    : 0
                }%`,
              }}
            />
          </div>
          <span className="small">
            {progress.done} / {progress.total}
          </span>
        </div>
      )}

      {scanError && <div className="market-error">{scanError}</div>}

      {preview.length > 0 && !scanning && (
        <div className="card section ok-banner">
          本次扫描命中 {preview.length} 只，已写入观察池（手动添加的条目保留）
        </div>
      )}

      {editing && (
        <div className="card section modal-panel">
          <h3>{editing.symbol ? '编辑' : '新增'}观察标的</h3>
          <StockSearch
            onSelect={(r) => {
              setEditing({
                ...editing,
                symbol: r.symbol,
                name: r.name,
                source: 'manual',
              });
              void refresh();
            }}
          />
          <div className="form-grid">
            <label className="field">
              代码
              <input
                value={editing.symbol}
                onChange={(e) =>
                  setEditing({ ...editing, symbol: e.target.value })
                }
                placeholder="600519"
              />
            </label>
            <label className="field">
              名称
              <input
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </label>
            <label className="field">
              模式
              <select
                value={editing.mode}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    mode: e.target.value as TradeMode,
                  })
                }
              >
                <option value="trend">趋势股</option>
                <option value="emotion">情绪短线</option>
                <option value="etf">ETF</option>
              </select>
            </label>
            <label className="field">
              状态
              <select
                value={editing.status}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    status: e.target.value as WatchlistItem['status'],
                  })
                }
              >
                <option value="watch">观察中</option>
                <option value="ready">接近买点</option>
              </select>
            </label>
          </div>

          <div className="score-grid">
            {SCORE_FIELDS.map((f) => (
              <label key={f.key} className="field">
                {f.label} (0–{f.max})
                <input
                  type="number"
                  min={0}
                  max={f.max}
                  value={editing.scores[f.key]}
                  onChange={(e) => {
                    const v = Math.min(
                      f.max,
                      Math.max(0, Number(e.target.value) || 0)
                    );
                    setEditing({
                      ...editing,
                      scores: { ...editing.scores, [f.key]: v },
                    });
                  }}
                />
              </label>
            ))}
          </div>

          <p className="score-preview">
            当前总分：{stockScoreTotal(editing)}/20 —{' '}
            {stockScoreLabel(stockScoreTotal(editing)).label}
          </p>

          <label className="field">
            备注
            <textarea
              value={editing.notes ?? ''}
              onChange={(e) =>
                setEditing({ ...editing, notes: e.target.value })
              }
              rows={2}
            />
          </label>

          <div className="btn-row">
            <button type="button" className="btn primary" onClick={saveItem}>
              保存
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => setEditing(null)}
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="card section">
        {active.length === 0 ? (
          <p className="muted">
            观察池为空。点击「扫描并更新观察池」从全市场筛选符合规则的标的。
          </p>
        ) : (
          <>
            {renderTable(screened, '规则扫描 · 当前符合')}
            {manual.length > 0 && renderTable(manual, '手动添加')}
          </>
        )}
      </div>
    </div>
  );
}
