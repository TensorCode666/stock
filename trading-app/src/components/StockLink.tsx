import { memo, useCallback, type FocusEvent, type MouseEvent } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { prefetchStockDetail } from '../lib/kline-prefetch';
import { normalizeSymbol } from '../lib/symbols';

type StockLinkProps = Omit<LinkProps, 'to' | 'state'> & {
  symbol: string;
  name?: string;
  watchlistId?: string;
};

export const StockLink = memo(function StockLink({
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
  const prefetch = useCallback(() => prefetchStockDetail(code), [code]);

  const handleMouseEnter = useCallback(
    (e: MouseEvent<HTMLAnchorElement>) => {
      prefetch();
      onMouseEnter?.(e);
    },
    [prefetch, onMouseEnter]
  );
  const handleFocus = useCallback(
    (e: FocusEvent<HTMLAnchorElement>) => {
      prefetch();
      onFocus?.(e);
    },
    [prefetch, onFocus]
  );

  return (
    <Link
      to={`/stock/${code}`}
      state={{ name, watchlistId }}
      className={className}
      onMouseEnter={handleMouseEnter}
      onFocus={handleFocus}
      {...rest}
    >
      {children}
    </Link>
  );
});
