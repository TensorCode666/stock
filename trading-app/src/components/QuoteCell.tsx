import { memo } from 'react';
import {
  changeClass,
  formatChangePercent,
  type StockQuote,
} from '../lib/market-api';

function quoteEqual(a?: StockQuote, b?: StockQuote): boolean {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  return a.price === b.price && a.changePercent === b.changePercent;
}

export const QuoteCell = memo(function QuoteCell({
  quote,
}: {
  quote?: StockQuote;
}) {
  if (!quote) return <span className="muted">—</span>;
  const cls = changeClass(quote.changePercent);
  return (
    <span className={`quote-inline ${cls}`}>
      <strong className="quote-inline-price">{quote.price.toFixed(2)}</strong>
      <span className={`quote-inline-pct ${cls}`}>
        {formatChangePercent(quote.changePercent)}
      </span>
    </span>
  );
}, (prev, next) => quoteEqual(prev.quote, next.quote));

export const HoldingPnl = memo(function HoldingPnl({
  quote,
  buyPrice,
  shares,
}: {
  quote?: StockQuote;
  buyPrice: number;
  shares: number;
}) {
  if (!quote || !buyPrice || !shares) return <span className="muted">—</span>;
  const pnl = (quote.price - buyPrice) * shares;
  const pct = ((quote.price - buyPrice) / buyPrice) * 100;
  const cls = pnl >= 0 ? 'up' : 'down';
  return (
    <span className={`pnl-badge ${cls}`}>
      {pnl >= 0 ? '+' : ''}
      {pnl.toFixed(0)}
      <span className="pnl-pct">
        ({pct >= 0 ? '+' : ''}
        {pct.toFixed(2)}%)
      </span>
    </span>
  );
}, (prev, next) =>
  prev.buyPrice === next.buyPrice &&
  prev.shares === next.shares &&
  quoteEqual(prev.quote, next.quote)
);
