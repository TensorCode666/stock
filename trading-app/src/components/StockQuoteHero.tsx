import {
  changeClass,
  formatChangePercent,
  type StockQuote,
} from '../lib/market-api';

export function StockQuoteHero({
  symbol,
  name,
  quote,
  compact,
}: {
  symbol: string;
  name: string;
  quote?: StockQuote;
  compact?: boolean;
}) {
  if (!quote || quote.price <= 0) {
    return (
      <div className={`quote-hero ${compact ? 'compact' : ''} loading`}>
        <span className="muted">现价加载中…</span>
      </div>
    );
  }

  const cls = changeClass(quote.changePercent);
  const amt = quote.changeAmount;
  const sign = amt >= 0 ? '+' : '';

  return (
    <div className={`quote-hero ${cls} ${compact ? 'compact' : ''}`}>
      <div className="quote-hero-top">
        <span className="quote-hero-code">{symbol}</span>
        <span className="quote-hero-name">{name}</span>
      </div>
      <div className="quote-hero-bottom">
        <span className="quote-hero-price">{quote.price.toFixed(2)}</span>
        <span className={`quote-hero-badge ${cls}`}>
          <span className="quote-hero-amt">
            {sign}
            {amt.toFixed(2)}
          </span>
          <span className="quote-hero-pct">
            {formatChangePercent(quote.changePercent)}
          </span>
        </span>
      </div>
    </div>
  );
}
