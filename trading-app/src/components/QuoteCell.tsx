import {
  changeClass,
  formatChangePercent,
  type StockQuote,
} from '../lib/market-api';

export function QuoteCell({ quote }: { quote?: StockQuote }) {
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
}

export function HoldingPnl({
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
}
