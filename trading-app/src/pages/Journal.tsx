import { memo, useMemo, useState } from 'react';
import { useAppActions, useAppSlice } from '../context/AppContext';
import { StockLink } from '../components/StockLink';
import { CLASSIFICATION_LABELS, TRADE_MODE_LABELS } from '../lib/calculations';
import { newId } from '../lib/storage';
import type { TradeClassification, TradeMode, TradeRecord } from '../types';

function emptyTrade(): TradeRecord {
  return {
    id: newId(),
    symbol: '',
    name: '',
    mode: 'trend',
    buyDate: '',
    sellDate: new Date().toISOString().slice(0, 10),
    buyPrice: 0,
    sellPrice: 0,
    shares: 0,
    buyReason: '',
    sellReason: '',
    plannedStop: 0,
    plannedTarget: 0,
    followedPlan: true,
    classification: 'system_profit',
    improvements: '',
  };
}

const TradeRow = memo(function TradeRow({ trade: t }: { trade: TradeRecord }) {
  const pnl = t.pnl ?? (t.sellPrice - t.buyPrice) * t.shares;
  return (
    <tr>
      <td>
        <StockLink symbol={t.symbol} name={t.name}>
          {t.symbol} {t.name}
        </StockLink>
      </td>
      <td>{TRADE_MODE_LABELS[t.mode]}</td>
      <td className={pnl >= 0 ? 'ok' : 'warn'}>¥{pnl.toFixed(0)}</td>
      <td>{CLASSIFICATION_LABELS[t.classification]}</td>
      <td>{t.followedPlan ? '是' : '否'}</td>
      <td>{t.sellDate}</td>
    </tr>
  );
});

export function Journal() {
  const { setData } = useAppActions();
  const trades = useAppSlice('trades');
  const [form, setForm] = useState<TradeRecord | null>(null);

  const stats = useMemo(() => {
    if (trades.length === 0) return null;
    const pnlOf = (t: TradeRecord) =>
      t.pnl ?? (t.sellPrice - t.buyPrice) * t.shares;
    const wins = trades.filter((t) => pnlOf(t) > 0);
    const losses = trades.filter((t) => pnlOf(t) <= 0);
    const avgWin =
      wins.length > 0
        ? wins.reduce((s, t) => s + pnlOf(t), 0) / wins.length
        : 0;
    const avgLoss =
      losses.length > 0
        ? Math.abs(losses.reduce((s, t) => s + pnlOf(t), 0) / losses.length)
        : 0;
    const violations = trades.filter((t) =>
      t.classification.startsWith('violation')
    );
    return {
      count: trades.length,
      winRate: ((wins.length / trades.length) * 100).toFixed(1),
      avgWin,
      avgLoss,
      profitLossRatio:
        avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '—',
      violations: violations.length,
      totalPnl: trades.reduce((s, t) => s + pnlOf(t), 0),
    };
  }, [trades]);

  const save = () => {
    if (!form?.symbol.trim()) return;
    const pnl = (form.sellPrice - form.buyPrice) * form.shares;
    const pnlPercent =
      form.buyPrice > 0
        ? ((form.sellPrice - form.buyPrice) / form.buyPrice) * 100
        : 0;
    const record = { ...form, pnl, pnlPercent };
    setData((prev) => ({
      ...prev,
      trades: [record, ...prev.trades.filter((t) => t.id !== record.id)],
    }));
    setForm(null);
  };

  const updatePnlPreview = (f: TradeRecord) => {
    const pnl = (f.sellPrice - f.buyPrice) * f.shares;
    return pnl;
  };

  return (
    <div className="page">
      <header className="page-header row-between">
        <div>
          <h2>交易复盘</h2>
          <p className="muted">
            每笔交易归类：系统内盈利/亏损、系统外盈利/亏损。
          </p>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={() => setForm(emptyTrade())}
        >
          + 记录平仓
        </button>
      </header>

      {stats && (
        <div className="grid-4 stats-row">
          <div className="stat">
            <span>交易次数</span>
            <strong>{stats.count}</strong>
          </div>
          <div className="stat">
            <span>胜率</span>
            <strong>{stats.winRate}%</strong>
          </div>
          <div className="stat">
            <span>盈亏比</span>
            <strong>{stats.profitLossRatio}</strong>
          </div>
          <div className="stat">
            <span>违规次数</span>
            <strong className={stats.violations > 0 ? 'warn' : ''}>
              {stats.violations}
            </strong>
          </div>
          <div className="stat wide">
            <span>累计盈亏</span>
            <strong className={stats.totalPnl >= 0 ? 'ok' : 'warn'}>
              ¥{stats.totalPnl.toFixed(0)}
            </strong>
          </div>
        </div>
      )}

      {form && (
        <div className="card section">
          <h3>单笔交易复盘</h3>
          <div className="form-grid">
            <label className="field">
              代码
              <input
                value={form.symbol}
                onChange={(e) =>
                  setForm({ ...form, symbol: e.target.value })
                }
              />
            </label>
            <label className="field">
              名称
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="field">
              模式
              <select
                value={form.mode}
                onChange={(e) =>
                  setForm({ ...form, mode: e.target.value as TradeMode })
                }
              >
                <option value="trend">趋势股</option>
                <option value="emotion">情绪短线</option>
                <option value="etf">ETF</option>
              </select>
            </label>
            <label className="field">
              归类
              <select
                value={form.classification}
                onChange={(e) =>
                  setForm({
                    ...form,
                    classification: e.target.value as TradeClassification,
                  })
                }
              >
                {Object.entries(CLASSIFICATION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              买入日期
              <input
                type="date"
                value={form.buyDate}
                onChange={(e) =>
                  setForm({ ...form, buyDate: e.target.value })
                }
              />
            </label>
            <label className="field">
              卖出日期
              <input
                type="date"
                value={form.sellDate}
                onChange={(e) =>
                  setForm({ ...form, sellDate: e.target.value })
                }
              />
            </label>
            <label className="field">
              买入价
              <input
                type="number"
                step="0.01"
                value={form.buyPrice || ''}
                onChange={(e) =>
                  setForm({ ...form, buyPrice: Number(e.target.value) })
                }
              />
            </label>
            <label className="field">
              卖出价
              <input
                type="number"
                step="0.01"
                value={form.sellPrice || ''}
                onChange={(e) =>
                  setForm({ ...form, sellPrice: Number(e.target.value) })
                }
              />
            </label>
            <label className="field">
              股数
              <input
                type="number"
                value={form.shares || ''}
                onChange={(e) =>
                  setForm({ ...form, shares: Number(e.target.value) })
                }
              />
            </label>
            <label className="field checkbox-field">
              <input
                type="checkbox"
                checked={form.followedPlan}
                onChange={(e) =>
                  setForm({ ...form, followedPlan: e.target.checked })
                }
              />
              按计划执行
            </label>
          </div>
          <p>
            预估盈亏：
            <strong
              className={
                updatePnlPreview(form) >= 0 ? 'ok' : 'warn'
              }
            >
              ¥{updatePnlPreview(form).toFixed(2)}
            </strong>
          </p>
          <label className="field">
            买入理由
            <textarea
              value={form.buyReason}
              onChange={(e) =>
                setForm({ ...form, buyReason: e.target.value })
              }
              rows={2}
            />
          </label>
          <label className="field">
            卖出理由
            <textarea
              value={form.sellReason}
              onChange={(e) =>
                setForm({ ...form, sellReason: e.target.value })
              }
              rows={2}
            />
          </label>
          <label className="field">
            改进点
            <textarea
              value={form.improvements}
              onChange={(e) =>
                setForm({ ...form, improvements: e.target.value })
              }
              rows={2}
            />
          </label>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={save}>
              保存
            </button>
            <button type="button" className="btn" onClick={() => setForm(null)}>
              取消
            </button>
          </div>
        </div>
      )}

      <div className="card section">
        {trades.length === 0 ? (
          <p className="muted">暂无交易记录</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>标的</th>
                <th>模式</th>
                <th>盈亏</th>
                <th>归类</th>
                <th>按计划</th>
                <th>卖出日</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <TradeRow key={t.id} trade={t} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
