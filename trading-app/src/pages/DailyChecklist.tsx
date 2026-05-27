import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  BUY_BEFORE_ITEMS,
  HOLDING_ITEMS,
  POST_MARKET_ITEMS,
  PRE_MARKET_ITEMS,
  SELL_BEFORE_ITEMS,
  emptyChecks,
} from '../lib/checklists';
import { todayStr } from '../lib/storage';
import type { DailyChecklistState } from '../types';

function CheckSection({
  title,
  items,
  checks,
  onToggle,
}: {
  title: string;
  items: readonly { key: string; label: string }[];
  checks: Record<string, boolean>;
  onToggle: (key: string, value: boolean) => void;
}) {
  const done = items.filter((i) => checks[i.key]).length;
  return (
    <div className="card section check-section">
      <div className="section-head">
        <h3>{title}</h3>
        <span className="badge">
          {done}/{items.length}
        </span>
      </div>
      <ul className="check-list">
        {items.map((item) => (
          <li key={item.key}>
            <label>
              <input
                type="checkbox"
                checked={!!checks[item.key]}
                onChange={(e) => onToggle(item.key, e.target.checked)}
              />
              {item.label}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DailyChecklist() {
  const { data, setData } = useApp();
  const today = todayStr();

  const state = useMemo(() => {
    const found = data.dailyChecklists.find((c) => c.date === today);
    if (found) return found;
    return {
      date: today,
      preMarket: emptyChecks(PRE_MARKET_ITEMS),
      buyBefore: emptyChecks(BUY_BEFORE_ITEMS),
      holding: emptyChecks(HOLDING_ITEMS),
      sellBefore: emptyChecks(SELL_BEFORE_ITEMS),
      postMarket: emptyChecks(POST_MARKET_ITEMS),
    };
  }, [data.dailyChecklists, today]);

  const persist = (next: DailyChecklistState) => {
    setData((prev) => {
      const rest = prev.dailyChecklists.filter((c) => c.date !== today);
      return { ...prev, dailyChecklists: [...rest, next] };
    });
  };

  const toggle = (
    section: keyof Pick<
      DailyChecklistState,
      'preMarket' | 'buyBefore' | 'holding' | 'sellBefore' | 'postMarket'
    >,
    key: string,
    value: boolean
  ) => {
    const next = {
      ...state,
      [section]: { ...state[section], [key]: value },
    };
    persist(next);
  };

  const allSections = [
    { key: 'preMarket' as const, title: '盘前', items: PRE_MARKET_ITEMS },
    { key: 'buyBefore' as const, title: '买入前', items: BUY_BEFORE_ITEMS },
    { key: 'holding' as const, title: '持仓中', items: HOLDING_ITEMS },
    { key: 'sellBefore' as const, title: '卖出前', items: SELL_BEFORE_ITEMS },
    { key: 'postMarket' as const, title: '盘后', items: POST_MARKET_ITEMS },
  ];

  const totalDone = allSections.reduce(
    (acc, s) => acc + s.items.filter((i) => state[s.key][i.key]).length,
    0
  );
  const totalItems = allSections.reduce((acc, s) => acc + s.items.length, 0);

  return (
    <div className="page">
      <header className="page-header">
        <h2>每日交易清单</h2>
        <p className="muted">
          {today} — 完成度 {totalDone}/{totalItems}。任意买入项无答案则不买。
        </p>
      </header>

      <div className="check-grid">
        {allSections.map((s) => (
          <CheckSection
            key={s.key}
            title={s.title}
            items={s.items}
            checks={state[s.key]}
            onToggle={(key, value) => toggle(s.key, key, value)}
          />
        ))}
      </div>
    </div>
  );
}
