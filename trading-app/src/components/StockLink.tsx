import { Link, type LinkProps } from 'react-router-dom';
import { prefetchStockDetail } from '../lib/kline-prefetch';
import { normalizeSymbol } from '../lib/symbols';

type StockLinkProps = Omit<LinkProps, 'to' | 'state'> & {
  symbol: string;
  name?: string;
  watchlistId?: string;
};

export function StockLink({
  symbol,
  name,
  watchlistId,
  className = 'stock-link',
  onMouseEnter,
  onFocus,
  children,
  ...rest
}: StockLinkProps) {
  const code = normalizeSymbol(symbol);
  const prefetch = () => prefetchStockDetail(code);

  return (
    <Link
      to={`/stock/${code}`}
      state={{ name, watchlistId }}
      className={className}
      onMouseEnter={(e) => {
        prefetch();
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        prefetch();
        onFocus?.(e);
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}
