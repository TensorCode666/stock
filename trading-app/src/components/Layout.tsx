import { NavLink, Outlet } from 'react-router-dom';
import { MarketBreadthBar, MarketIndices } from './MarketIndices';
import { useMarketData } from '../context/MarketDataContext';

const navItems = [
  { to: '/', label: '总览', end: true },
  { to: '/env', label: '市场环境' },
  { to: '/watchlist', label: '观察池' },
  { to: '/favorites', label: '自选股' },
  { to: '/buy', label: '买入计划' },
  { to: '/position', label: '仓位计算' },
  { to: '/holdings', label: '持仓' },
  { to: '/journal', label: '交易复盘' },
  { to: '/practice', label: '历史练习' },
  { to: '/daily', label: '每日清单' },
  { to: '/rules', label: '规则库' },
];

function MarketBar() {
  const { indices, breadth, loading, refreshing, refresh, lastUpdated, error } =
    useMarketData();
  return (
    <>
      {error && (
        <div className="market-error">
          行情：{error}（请确认网络或稍后刷新）
        </div>
      )}
      <MarketIndices
        indices={indices}
        loading={loading}
        refreshing={refreshing}
        onRefresh={() => void refresh()}
        lastUpdated={lastUpdated}
      />
      {breadth && (
        <MarketBreadthBar
          up={breadth.up}
          down={breadth.down}
          flat={breadth.flat}
          scope={breadth.scope}
          total={breadth.total}
        />
      )}
    </>
  );
}

export function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">◈</span>
          <div>
            <h1>股票交易系统</h1>
            <p>决策 · 执行 · 复盘</p>
          </div>
        </div>
        <nav className="nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? 'nav-link active' : 'nav-link'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <footer className="sidebar-foot">
          规则来源：trading-system/
          <br />
          非荐股 · 非自动交易
        </footer>
      </aside>
      <main className="main">
        <MarketBar />
        <Outlet />
      </main>
    </div>
  );
}
