import { useEffect, useState } from 'react';
import { searchStocks, type StockSearchResult } from '../lib/market-api';

export function StockSearch({
  onSelect,
  query: controlledQuery,
  onQueryChange,
  placeholder = '输入代码或名称搜索…',
}: {
  onSelect: (item: StockSearchResult) => void;
  /** 受控搜索词（练习页等需在提交时读取输入） */
  query?: string;
  onQueryChange?: (q: string) => void;
  placeholder?: string;
}) {
  const [internalQuery, setInternalQuery] = useState('');
  const q = controlledQuery ?? internalQuery;
  const setQ = onQueryChange ?? setInternalQuery;
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      setLoading(true);
      searchStocks(q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="stock-search">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {loading && <span className="small">搜索中…</span>}
      {results.length > 0 && (
        <ul className="search-dropdown">
          {results.map((r) => (
            <li key={r.secid}>
              <button
                type="button"
                onClick={() => {
                  onSelect(r);
                  setQ('');
                  setResults([]);
                }}
              >
                <strong>{r.symbol}</strong> {r.name}
                <span className="small">{r.market}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
