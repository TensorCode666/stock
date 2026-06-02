import { memo, useCallback, useState } from 'react';
import { HoldingPnl, QuoteCell } from '../components/QuoteCell';
import { StockLink } from '../components/StockLink';
import { StockSearch } from '../components/StockSearch';
import { useAppActions, useAppSlice, useTodayEnvScore } from '../context/AppContext';
import { useQuote } from '../context/MarketDataContext';
import { envScoreTotal, TRADE_MODE_LABELS } from '../lib/calculations';
import {
  ADVICE_TAG_CLASS,
  DEFAULT_HOLDING_ADVICE,
  type HoldingAdvice,
} from '../lib/holding-advice';
import { useHoldingAdvices } from '../lib/use-holding-advices';
import { useHoldingsKlines } from '../lib/use-holdings-klines';
import { newId, todayStr } from '../lib/storage';
import { isValidSymbol, normalizeSymbol, symbolsKey } from '../lib/symbols';
import type { Holding, TradeMode } from '../types';

const URGENCY_LABELS = {
  low: '低',
  medium: '中',
  high: '高',
} as const;

function emptyHolding(): Holding {
  return {
    id: newId(),
    symbol: '',
    name: '',
    mode: 'trend',
    buyDate: todayStr(),
    buyPrice: 0,
    shares: 0,
    stopLoss: 0,
    targetPrice: 0,
    sellConditions: '跌破20日线；放量破位；3日不创新高',
    notes: '',
  };
}

const AdviceCard = memo(function AdviceCard({
  holding,
  advice,
  adviceLoading,
}: {
  holding: Holding;
  advice: HoldingAdvice;
  adviceLoading: boolean;
}) {
  return (
    <div className={`advice-card advice-${advice.action}`}>
      <div className="advice-card-head">
        <div>
          <strong>
            {holding.symbol} {holding.name}
          </strong>
          <span className="small block">
            {TRADE_MODE_LABELS[holding.mode]}
          </span>
        </div>
        <span className={`tag ${ADVICE_TAG_CLASS[advice.action]}`}>
          {advice.label}
        </span>
      </div>
      {adviceLoading ? (
        <p className="small muted">正在加载 K 线…</p>
      ) : (
        <>
          <p className="small advice-meta">
            置信度 {advice.confidence}% · 紧迫度{' '}
            {URGENCY_LABELS[advice.urgency]}
          </p>
          <ul className="advice-reasons">
            {advice.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
});

const HoldingTableRow = memo(function HoldingTableRow({
  holding: h,
  advice,
  adviceLoading,
  onEdit,
  onRemove,
}: {
  holding: Holding;
  advice: HoldingAdvice;
  adviceLoading: boolean;
  onEdit: (h: Holding) => void;
  onRemove: (id: string) => void;
}) {
  const quote = useQuote(h.symbol);
  return (
    <tr>
      <td>
        <StockLink symbol={h.symbol} name={h.name}>
          {h.symbol} {h.name}
        </StockLink>
      </td>
      <td>{TRADE_MODE_LABELS[h.mode]}</td>
      <td>
        {adviceLoading ? (
          <span className="muted small">—</span>
        ) : (
          <span
            className={`tag ${ADVICE_TAG_CLASS[advice.action]}`}
            title={advice.reasons.join('；')}
          >
            {advice.label}
          </span>
        )}
      </td>
      <td>
        {h.buyDate} @ {h.buyPrice}
      </td>
      <td>{h.shares}</td>
      <td>
        <QuoteCell quote={quote} />
      </td>
      <td>
        <HoldingPnl quote={quote} buyPrice={h.buyPrice} shares={h.shares} />
      </td>
      <td>{h.stopLoss}</td>
      <td>{h.targetPrice}</td>
      <td>¥{(h.buyPrice * h.shares).toFixed(0)}</td>
      <td className="actions">
        <button type="button" className="btn sm" onClick={() => onEdit(h)}>
          编辑
        </button>
        <button
          type="button"
          className="btn sm danger"
          onClick={() => onRemove(h.id)}
        >
          删除
        </button>
      </td>
    </tr>
  );
});

export function Holdings() {
  const { setData } = useAppActions();
  const holdings = useAppSlice('holdings');
  const todayEnv = useTodayEnvScore();
  const [form, setForm] = useState<Holding | null>(null);

  const holdingSymbolsKey = symbolsKey(
    holdings.map((h) => normalizeSymbol(h.symbol)).filter(Boolean)
  );

  const { klinesMap, loading: klinesLoading } =
    useHoldingsKlines(holdingSymbolsKey);

  const adviceById = useHoldingAdvices(
    holdings,
    klinesMap,
    todayEnv,
    holdingSymbolsKey
  );

  const save = () => {
    if (!form?.symbol.trim()) return;
    const sym = normalizeSymbol(form.symbol);
    if (!isValidSymbol(sym)) {
      alert('请输入有效的 6 位股票代码');
      return;
    }
    if (form.buyPrice <= 0) {
      alert('请填写有效买入价');
      return;
    }
    if (form.shares <= 0) {
      alert('请填写买入股数');
      return;
    }
    const payload = { ...form, symbol: sym };
    setData((prev) => {
      const exists = prev.holdings.some((h) => h.id === form.id);
      const nextHoldings = exists
        ? prev.holdings.map((h) => (h.id === form.id ? payload : h))
        : [...prev.holdings, payload];
      return { ...prev, holdings: nextHoldings };
    });
    setForm(null);
  };

  const remove = useCallback((id: string) => {
    if (!confirm('确认删除该持仓记录？')) return;
    setData((prev) => ({
      ...prev,
      holdings: prev.holdings.filter((h) => h.id !== id),
    }));
  }, [setData]);

  const openEdit = useCallback((h: Holding) => setForm(h), []);

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

      {holdings.length > 0 && (
        <div className="card section">
          <h3>
            规则建议
            <span className="badge">参考 · 非自动交易</span>
          </h3>
          <p className="small muted">
            基于止损/目标、均线结构、时间止损与环境评分，对齐 trading-system
            卖出规则。
            {todayEnv
              ? ` 今日环境 ${envScoreTotal(todayEnv)}/10。`
              : ' 今日尚未录入环境评分。'}
          </p>
          <div className="advice-grid">
            {holdings.map((h) => {
              const sym = normalizeSymbol(h.symbol);
              const advice = adviceById.get(h.id) ?? DEFAULT_HOLDING_ADVICE;
              const adviceLoading =
                klinesLoading && !klinesMap.get(sym)?.length;
              return (
                <AdviceCard
                  key={h.id}
                  holding={h}
                  advice={advice}
                  adviceLoading={adviceLoading}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="card section">
        {holdings.length === 0 ? (
          <p className="muted">暂无持仓记录</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>标的</th>
                <th>模式</th>
                <th>建议</th>
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
              {holdings.map((h) => {
                const sym = normalizeSymbol(h.symbol);
                const advice = adviceById.get(h.id) ?? DEFAULT_HOLDING_ADVICE;
                const adviceLoading =
                  klinesLoading && !klinesMap.get(sym)?.length;
                return (
                  <HoldingTableRow
                    key={h.id}
                    holding={h}
                    advice={advice}
                    adviceLoading={adviceLoading}
                    onEdit={openEdit}
                    onRemove={remove}
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
