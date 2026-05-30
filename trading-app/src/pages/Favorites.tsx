import { Link } from 'react-router-dom';
import { FavoriteRow } from '../components/FavoriteRow';
import { useApp } from '../context/AppContext';

export function Favorites() {
  const { data, setData } = useApp();
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
              {list.map((f) => (
                <FavoriteRow key={f.id} item={f} onRemove={remove} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
