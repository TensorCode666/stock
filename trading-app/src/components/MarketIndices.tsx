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
  scope,
  total,
}: {
  up: number;
  down: number;
  flat: number;
  scope?: string;
  total?: number;
}) {
  const displayTotal = total ?? up + down + flat;
  const sum = displayTotal || 1;
  return (
    <div className="breadth-bar">
      {scope && <span className="breadth-scope muted">{scope}</span>}
      <span className="up">涨 {up}</span>
      <span className="flat">平 {flat}</span>
      <span className="down">跌 {down}</span>
      <span className="breadth-total muted">共 {displayTotal}</span>
      <div className="breadth-track">
        <div className="seg-up" style={{ width: `${(up / sum) * 100}%` }} />
        <div
          className="seg-flat"
          style={{ width: `${(flat / sum) * 100}%` }}
        />
        <div
          className="seg-down"
          style={{ width: `${(down / sum) * 100}%` }}
        />
      </div>
    </div>
  );
}
