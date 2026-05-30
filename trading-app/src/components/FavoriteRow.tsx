import { memo } from 'react';
import { Link } from 'react-router-dom';
import { changeClass } from '../lib/market-api';
import { useQuote } from '../context/MarketDataContext';
import {
  formatAddedAt,
  formatPnlPercent,
  pnlPercentFromInitial,
} from '../lib/favorites';
import { normalizeSymbol } from '../lib/symbols';
import type { FavoriteStock } from '../types';

type FavoriteRowProps = {
  item: FavoriteStock;
  onRemove: (id: string) => void;
};

export const FavoriteRow = memo(function FavoriteRow({
  item: f,
  onRemove,
}: FavoriteRowProps) {
  const quote = useQuote(f.symbol);
  const current = quote?.price ?? 0;
  const pnl = pnlPercentFromInitial(f.initialPrice, current);
  return (
    <tr>
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
          <span className={changeClass(pnl)}>{formatPnlPercent(pnl)}</span>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td className="actions">
        <button
          type="button"
          className="btn sm danger"
          onClick={() => onRemove(f.id)}
        >
          移除
        </button>
      </td>
    </tr>
  );
});
