import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useMarketData } from '../context/MarketDataContext';
import { changeClass } from '../lib/market-api';
import {
  formatAddedAt,
  formatPnlPercent,
  pnlPercentFromInitial,
} from '../lib/favorites';
import { normalizeSymbol } from '../lib/symbols';

export function Favorites() {
  const { data, setData } = useApp();
  const { getQuote } = useMarketData();
  const list = data.favorites;

  const remove = (id: string) => {
    setData((prev) => ({
      ...prev,
      favorites: prev.favorites.filter((f) => f.id !== id),
    }));
  };

  return (
    <div className="page">
      <header className="page-header row-between">
        <div>
          <h2>自选股</h2>
          <p className="muted">
            从观察池添加自选时记录加入价与时间；涨跌幅为现价相对加入价的变动。
          </p>
        </div>
        <span className="badge">{list.length} 只</span>
      </header>

      <div className="card section">
        {list.length === 0 ? (
          <p className="muted">
            暂无自选股。在{' '}
            <Link to="/watchlist">观察池</Link> 中点击「加自选」添加。
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>代码</th>
                <th>名称</th>
                <th>初始添加价格</th>
                <th>初始添加时间</th>
                <th>现价</th>
                <th>相对加入涨跌</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.map((f) => {
                const quote = getQuote(f.symbol);
                const current = quote?.price ?? 0;
                const pnl = pnlPercentFromInitial(f.initialPrice, current);
                return (
                  <tr key={f.id}>
                    <td>
                      <Link
                        to={`/stock/${f.symbol}`}
                        state={{ name: f.name }}
                        className="stock-link"
                      >
                        {f.symbol}
                      </Link>
                    </td>
                    <td>
                      <Link
                        to={`/stock/${normalizeSymbol(f.symbol)}`}
                        state={{ name: f.name }}
                        className="stock-link"
                      >
                        {f.name}
                      </Link>
                    </td>
                    <td>{f.initialPrice.toFixed(2)}</td>
                    <td className="small">{formatAddedAt(f.addedAt)}</td>
                    <td>
                      {current > 0 ? (
                        <strong>{current.toFixed(2)}</strong>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      {pnl !== null ? (
                        <span className={changeClass(pnl)}>
                          {formatPnlPercent(pnl)}
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="actions">
                      <button
                        type="button"
                        className="btn sm danger"
                        onClick={() => remove(f.id)}
                      >
                        移除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
