import {
  changeClass,
  formatChangePercent,
  type IndexQuote,
} from '../lib/market-api';

export function MarketIndices({
  indices,
  loading,
  onRefresh,
  lastUpdated,
}: {
  indices: IndexQuote[];
  loading: boolean;
  onRefresh?: () => void;
  lastUpdated?: Date | null;
}) {
  return (
    <div className="market-strip card">
      <div className="strip-head">
        <span className="strip-title">实时指数</span>
        {lastUpdated && (
          <span className="small">
            更新 {lastUpdated.toLocaleTimeString('zh-CN')}
          </span>
        )}
        {onRefresh && (
          <button
            type="button"
            className="btn sm"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? '刷新中…' : '刷新'}
          </button>
        )}
      </div>
      <div className="index-row">
        {indices.length === 0 && !loading && (
          <span className="muted">暂无指数数据</span>
        )}
        {indices.map((idx) => (
          <div key={idx.code} className="index-item">
            <div className="index-name">{idx.name}</div>
            <div className="index-price">{idx.price.toFixed(2)}</div>
            <div className={`index-chg ${changeClass(idx.changePercent)}`}>
              {formatChangePercent(idx.changePercent)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MarketBreadthBar({
  up,
  down,
  flat,
}: {
  up: number;
  down: number;
  flat: number;
}) {
  const total = up + down + flat || 1;
  return (
    <div className="breadth-bar">
      <span className="up">涨 {up}</span>
      <span className="flat">平 {flat}</span>
      <span className="down">跌 {down}</span>
      <div className="breadth-track">
        <div className="seg-up" style={{ width: `${(up / total) * 100}%` }} />
        <div
          className="seg-flat"
          style={{ width: `${(flat / total) * 100}%` }}
        />
        <div
          className="seg-down"
          style={{ width: `${(down / total) * 100}%` }}
        />
      </div>
    </div>
  );
}
