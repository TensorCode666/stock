import { useState } from 'react';
import { HoldingPnl, QuoteCell } from '../components/QuoteCell';
import { StockSearch } from '../components/StockSearch';
import { useApp } from '../context/AppContext';
import { useMarketData } from '../context/MarketDataContext';
import { TRADE_MODE_LABELS } from '../lib/calculations';
import { newId } from '../lib/storage';
import type { Holding, TradeMode } from '../types';

function emptyHolding(): Holding {
  return {
    id: newId(),
    symbol: '',
    name: '',
    mode: 'trend',
    buyDate: new Date().toISOString().slice(0, 10),
    buyPrice: 0,
    shares: 0,
    stopLoss: 0,
    targetPrice: 0,
    sellConditions: '跌破20日线；放量破位；3日不创新高',
    notes: '',
  };
}

export function Holdings() {
  const { data, setData } = useApp();
  const { getQuote, refresh } = useMarketData();
  const [form, setForm] = useState<Holding | null>(null);

  const save = () => {
    if (!form?.symbol.trim()) return;
    setData((prev) => {
      const exists = prev.holdings.some((h) => h.id === form.id);
      const holdings = exists
        ? prev.holdings.map((h) => (h.id === form.id ? form : h))
        : [...prev.holdings, form];
      return { ...prev, holdings };
    });
    setForm(null);
  };

  const remove = (id: string) => {
    if (!confirm('确认删除该持仓记录？')) return;
    setData((prev) => ({
      ...prev,
      holdings: prev.holdings.filter((h) => h.id !== id),
    }));
  };

  return (
    <div className="page">
      <header className="page-header row-between">
        <div>
          <h2>持仓管理</h2>
          <p className="muted">
            买入前写好卖出条件。趋势没坏持有，趋势破坏退出。
          </p>
        </div>
        <button
          type="button"
          className="btn primary"
          onClick={() => setForm(emptyHolding())}
        >
          + 记录持仓
        </button>
      </header>

      {form && (
        <div className="card section">
          <h3>持仓信息</h3>
          <StockSearch
            onSelect={(r) => {
              setForm({
                ...form,
                symbol: r.symbol,
                name: r.name,
              });
              void refresh();
            }}
          />
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
              股数
              <input
                type="number"
                value={form.shares || ''}
                onChange={(e) =>
                  setForm({ ...form, shares: Number(e.target.value) })
                }
              />
            </label>
            <label className="field">
              止损价
              <input
                type="number"
                step="0.01"
                value={form.stopLoss || ''}
                onChange={(e) =>
                  setForm({ ...form, stopLoss: Number(e.target.value) })
                }
              />
            </label>
            <label className="field">
              目标价
              <input
                type="number"
                step="0.01"
                value={form.targetPrice || ''}
                onChange={(e) =>
                  setForm({ ...form, targetPrice: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <label className="field">
            卖出条件
            <textarea
              value={form.sellConditions}
              onChange={(e) =>
                setForm({ ...form, sellConditions: e.target.value })
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
        <h3>卖出信号速查</h3>
        <div className="grid-2 small-cards">
          <div>
            <strong>硬止损</strong>
            <ul>
              <li>跌破计划止损价</li>
              <li>跌破20日线且无法收回</li>
              <li>放量破位</li>
            </ul>
          </div>
          <div>
            <strong>时间止损</strong>
            <ul>
              <li>5–7 交易日无明显上涨</li>
              <li>走势弱于板块</li>
            </ul>
          </div>
          <div>
            <strong>止盈</strong>
            <ul>
              <li>到达目标分批 1/3</li>
              <li>高位放量滞涨</li>
              <li>情绪高潮</li>
            </ul>
          </div>
          <div>
            <strong>情绪票</strong>
            <ul>
              <li>龙头断板无法修复</li>
              <li>后排大跌、题材不扩散</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="card section">
        {data.holdings.length === 0 ? (
          <p className="muted">暂无持仓记录</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>标的</th>
                <th>模式</th>
                <th>买入</th>
                <th>股数</th>
                <th>现价</th>
                <th>浮动盈亏</th>
                <th>止损</th>
                <th>目标</th>
                <th>成本</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.holdings.map((h) => (
                <tr key={h.id}>
                  <td>
                    {h.symbol} {h.name}
                  </td>
                  <td>{TRADE_MODE_LABELS[h.mode]}</td>
                  <td>
                    {h.buyDate} @ {h.buyPrice}
                  </td>
                  <td>{h.shares}</td>
                  <td>
                    <QuoteCell quote={getQuote(h.symbol)} />
                  </td>
                  <td>
                    <HoldingPnl
                      quote={getQuote(h.symbol)}
                      buyPrice={h.buyPrice}
                      shares={h.shares}
                    />
                  </td>
                  <td>{h.stopLoss}</td>
                  <td>{h.targetPrice}</td>
                  <td>¥{(h.buyPrice * h.shares).toFixed(0)}</td>
                  <td className="actions">
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => setForm(h)}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="btn sm danger"
                      onClick={() => remove(h.id)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
