import { Link } from 'react-router-dom';
import { QuoteCell } from '../components/QuoteCell';
import { useApp } from '../context/AppContext';
import { useMarketData } from '../context/MarketDataContext';
import {
  envScoreLabel,
  envScoreTotal,
  stockScoreTotal,
} from '../lib/calculations';
import { todayStr } from '../lib/storage';

export function Dashboard() {
  const { data } = useApp();
  const { getQuote } = useMarketData();
  const today = todayStr();
  const todayEnv = [...data.envScores]
    .reverse()
    .find((e) => e.date === today);
  const envTotal = todayEnv ? envScoreTotal(todayEnv) : null;
  const envInfo = envTotal !== null ? envScoreLabel(envTotal) : null;
  const activeWatch = data.watchlist.filter((w) => w.status !== 'removed');
  const readyWatch = activeWatch.filter((w) => w.status === 'ready');

  return (
    <div className="page">
      <header className="page-header">
        <h2>今日总览</h2>
        <p className="muted">{today}</p>
      </header>

      <div className="grid-3">
        <div className={`card highlight-${envInfo?.color ?? 'yellow'}`}>
          <h3>市场环境</h3>
          {envTotal !== null && envInfo ? (
            <>
              <div className="big-num">{envTotal}/10</div>
              <p className="tag">{envInfo.label}</p>
              <p className="small">{envInfo.positionRange}</p>
            </>
          ) : (
            <p className="warn">今日尚未评分</p>
          )}
          <Link to="/env" className="btn-link">
            去评分 →
          </Link>
        </div>

        <div className="card">
          <h3>观察池</h3>
          <div className="big-num">{activeWatch.length}</div>
          <p className="small">
            重点观察 {readyWatch.length} · 持仓 {data.holdings.length}
          </p>
          <Link to="/watchlist" className="btn-link">
            管理观察池 →
          </Link>
        </div>

        <div className="card">
          <h3>资金设置</h3>
          <div className="big-num">
            ¥{data.settings.totalCapital.toLocaleString()}
          </div>
          <p className="small">
            单笔最大亏损 {data.settings.maxLossPerTradePercent}%
          </p>
          <Link to="/position" className="btn-link">
            仓位计算 →
          </Link>
        </div>
      </div>

      <section className="card section">
        <h3>核心原则</h3>
        <ol className="principles">
          <li>先判断市场环境，再选择交易模式</li>
          <li>先写交易计划，再决定是否下单</li>
          <li>只做能定义买点、卖点、止损和仓位的交易</li>
          <li>盈利加仓，亏损不加仓</li>
          <li>每笔交易必须复盘</li>
        </ol>
      </section>

      {activeWatch.length > 0 && (
        <section className="card section">
          <h3>观察池摘要</h3>
          <table className="table">
            <thead>
              <tr>
                <th>代码</th>
                <th>名称</th>
                <th>模式</th>
                <th>评分</th>
                <th>现价</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {activeWatch.slice(0, 8).map((w) => (
                <tr key={w.id}>
                  <td>{w.symbol}</td>
                  <td>{w.name}</td>
                  <td>{w.mode}</td>
                  <td>{stockScoreTotal(w)}/20</td>
                  <td>
                    <QuoteCell quote={getQuote(w.symbol)} />
                  </td>
                  <td>{w.status === 'ready' ? '待买点' : '观察'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="card section flow">
        <h3>标准交易流程</h3>
        <div className="flow-steps">
          {[
            '市场环境判断',
            '选择交易模式',
            '建立观察池',
            '等待买点',
            '交易前检查',
            '仓位计算',
            '执行买入',
            '持仓管理',
            '卖出/止损',
            '复盘归档',
          ].map((step, i) => (
            <span key={step} className="flow-step">
              {i > 0 && <span className="arrow">→</span>}
              {step}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
