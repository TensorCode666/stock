import { useState } from 'react';
import { useAppActions, useAppSlice } from '../context/AppContext';
import { useQuote } from '../context/MarketDataContext';
import { normalizeSymbol } from '../lib/symbols';
import {
  envScoreTotal,
  riskRewardRatio,
  TRADE_MODE_LABELS,
} from '../lib/calculations';
import { newId, todayStr } from '../lib/storage';
import type { BuyChecklist, TradeMode, TradePlan } from '../types';

const CHECK_ITEMS: { key: keyof BuyChecklist; label: string }[] = [
  { key: 'envAllowed', label: '当前环境允许交易' },
  { key: 'modeMatch', label: '模式与当前环境匹配' },
  { key: 'inWatchlist', label: '标的在观察池内' },
  { key: 'buyPointClear', label: '买点清楚（靠近支撑）' },
  { key: 'stopClear', label: '止损位明确' },
  { key: 'targetClear', label: '目标位明确' },
  { key: 'riskRewardOk', label: '盈亏比 ≥ 2:1' },
  { key: 'positionOk', label: '仓位符合规则' },
  { key: 'willingToExit', label: '买错愿意立刻认错' },
];

function defaultChecklist(): BuyChecklist {
  return {
    envAllowed: false,
    modeMatch: false,
    inWatchlist: false,
    buyPointClear: false,
    stopClear: false,
    targetClear: false,
    riskRewardOk: false,
    positionOk: false,
    willingToExit: false,
  };
}

function emptyPlan(): TradePlan {
  return {
    id: newId(),
    symbol: '',
    name: '',
    mode: 'trend',
    envScore: 0,
    stockScore: 0,
    buyReason: '',
    buyPrice: 0,
    stopLoss: 0,
    targetPrice: 0,
    plannedPositionPct: 10,
    addConditions: '回踩不破关键支撑；板块继续走强',
    sellConditions: '跌破20日线；放量破位；到达目标分批止盈',
    checklist: defaultChecklist(),
    createdAt: new Date().toISOString(),
  };
}

export function BuyPlan() {
  const { setData } = useAppActions();
  const envScores = useAppSlice('envScores');
  const watchlist = useAppSlice('watchlist');
  const tradePlans = useAppSlice('tradePlans');
  const todayEnv = envScores.find((e) => e.date === todayStr());
  const envTotal = todayEnv ? envScoreTotal(todayEnv) : 0;

  const [form, setForm] = useState<TradePlan>(() => {
    const p = emptyPlan();
    p.envScore = envTotal;
    return p;
  });

  const quote = useQuote(form.symbol ? normalizeSymbol(form.symbol) : '');

  const rr =
    form.buyPrice > 0
      ? riskRewardRatio(form.buyPrice, form.stopLoss, form.targetPrice)
      : null;

  const allChecked = CHECK_ITEMS.every((c) => form.checklist[c.key]);
  const rrOk = rr !== null && rr >= 2;

  const save = () => {
    if (!form.symbol.trim()) {
      alert('请填写代码');
      return;
    }
    if (!allChecked) {
      const ok = confirm('检查表未全部通过，仍要保存计划吗？');
      if (!ok) return;
    }
    setData((prev) => ({
      ...prev,
      tradePlans: [form, ...prev.tradePlans.filter((p) => p.id !== form.id)],
    }));
    alert('买入计划已保存');
    setForm(() => {
      const p = emptyPlan();
      p.envScore = envTotal;
      return p;
    });
  };

  const fillFromWatch = (symbol: string) => {
    const w = watchlist.find(
      (x) => x.symbol === symbol && x.status !== 'removed'
    );
    if (!w) return;
    setForm((f) => ({
      ...f,
      symbol: w.symbol,
      name: w.name,
      mode: w.mode,
      stockScore:
        w.scores.marketEnv +
        w.scores.sector +
        w.scores.trend +
        w.scores.volumePrice +
        w.scores.buyPointClarity +
        w.scores.riskReward,
    }));
  };

  return (
    <div className="page">
      <header className="page-header">
        <h2>买入计划 & 检查表</h2>
        <p className="muted">
          没有计划不允许下单。任意一项「不确定」应降仓或放弃。
        </p>
      </header>

      <div className="grid-2">
        <div className="card section">
          <h3>交易计划表单</h3>
          {watchlist.filter((w) => w.status !== 'removed').length > 0 && (
            <label className="field">
              从观察池填入
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) fillFromWatch(e.target.value);
                }}
              >
                <option value="">选择…</option>
                {watchlist
                  .filter((w) => w.status !== 'removed')
                  .map((w) => (
                    <option key={w.id} value={w.symbol}>
                      {w.symbol} {w.name}
                    </option>
                  ))}
              </select>
            </label>
          )}

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
              环境评分
              <input
                type="number"
                value={form.envScore}
                onChange={(e) =>
                  setForm({ ...form, envScore: Number(e.target.value) })
                }
              />
            </label>
            <label className="field">
              选股评分
              <input
                type="number"
                value={form.stockScore}
                onChange={(e) =>
                  setForm({ ...form, stockScore: Number(e.target.value) })
                }
              />
            </label>
            <label className="field">
              计划仓位 %
              <input
                type="number"
                value={form.plannedPositionPct}
                onChange={(e) =>
                  setForm({
                    ...form,
                    plannedPositionPct: Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="field">
              计划买入价
              <div className="inline-field">
                <input
                  type="number"
                  step="0.01"
                  value={form.buyPrice || ''}
                  onChange={(e) =>
                    setForm({ ...form, buyPrice: Number(e.target.value) })
                  }
                />
                {form.symbol && quote && (
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => {
                      if (quote) setForm({ ...form, buyPrice: quote.price });
                    }}
                  >
                    填入现价 {quote.price.toFixed(2)}
                  </button>
                )}
              </div>
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

          {rr !== null && (
            <p className={rrOk ? 'ok' : 'warn'}>
              盈亏比：{rr.toFixed(2)}:1 {rrOk ? '✓' : '（建议 ≥ 2:1）'}
            </p>
          )}

          <label className="field">
            买入理由
            <textarea
              value={form.buyReason}
              onChange={(e) =>
                setForm({ ...form, buyReason: e.target.value })
              }
              rows={2}
              placeholder="环境、板块、技术位置"
            />
          </label>
          <label className="field">
            加仓条件
            <textarea
              value={form.addConditions}
              onChange={(e) =>
                setForm({ ...form, addConditions: e.target.value })
              }
              rows={2}
            />
          </label>
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

          <button type="button" className="btn primary" onClick={save}>
            保存买入计划
          </button>
        </div>

        <div className="card section">
          <h3>买入前检查（全部勾选才可积极执行）</h3>
          <ul className="check-list">
            {CHECK_ITEMS.map((c) => (
              <li key={c.key}>
                <label>
                  <input
                    type="checkbox"
                    checked={form.checklist[c.key]}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        checklist: {
                          ...form.checklist,
                          [c.key]: e.target.checked,
                        },
                      })
                    }
                  />
                  {c.label}
                </label>
              </li>
            ))}
          </ul>
          <p className={allChecked && rrOk ? 'ok' : 'warn'}>
            {allChecked && rrOk
              ? '检查通过，可按计划执行'
              : '未完全通过 — 降低仓位或放弃交易'}
          </p>

          <hr />
          <h4>禁止买入</h4>
          <ul className="ban-list">
            <li>没有止损位</li>
            <li>盈亏比 &lt; 2:1</li>
            <li>情绪退潮期高位追入</li>
            <li>只因消息/推荐/感觉而买</li>
          </ul>
        </div>
      </div>

      {tradePlans.length > 0 && (
        <section className="card section">
          <h3>历史买入计划</h3>
          <table className="table">
            <thead>
              <tr>
                <th>日期</th>
                <th>标的</th>
                <th>模式</th>
                <th>买/止/目标</th>
                <th>仓位%</th>
              </tr>
            </thead>
            <tbody>
              {tradePlans.slice(0, 10).map((p) => (
                <tr key={p.id}>
                  <td>{p.createdAt.slice(0, 10)}</td>
                  <td>
                    {p.symbol} {p.name}
                  </td>
                  <td>{TRADE_MODE_LABELS[p.mode]}</td>
                  <td>
                    {p.buyPrice} / {p.stopLoss} / {p.targetPrice}
                  </td>
                  <td>{p.plannedPositionPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
