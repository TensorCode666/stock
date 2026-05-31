import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LazyStockChartPanels } from '../components/LazyStockChartPanels';
import { StockSearch } from '../components/StockSearch';
import { useAppActions, useAppSlice } from '../context/AppContext';
import {
  stockScoreLabel,
  TRADE_MODE_LABELS,
} from '../lib/calculations';
import { formatChangePercent, searchStocks } from '../lib/market-api';
import {
  buildPracticeAttempt,
  chartBarsForPractice,
  computePracticeVerdict,
  gradePracticeAnswer,
  loadPracticeContext,
  type PracticeContext,
  type PracticeGrade,
} from '../lib/practice';
import { todayStr, trimPracticeAttempts } from '../lib/storage';
import { normalizeSymbol } from '../lib/symbols';
import type { TradeMode } from '../types';

function defaultPracticeDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 5);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type Phase = 'setup' | 'practice' | 'result';

const STATUS_LABELS = {
  watch: '观察',
  ready: '就绪（接近买点）',
  reject: '不纳入',
} as const;

export function Practice() {
  const { setData } = useAppActions();
  const practiceAttempts = useAppSlice('practiceAttempts');
  const contentRef = useRef<HTMLElement>(null);

  const [phase, setPhase] = useState<Phase>('setup');
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [date, setDate] = useState(() => defaultPracticeDate());
  const [mode, setMode] = useState<TradeMode>('trend');
  const [envTotal, setEnvTotal] = useState(6);
  const [turnoverInput, setTurnoverInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [ctx, setCtx] = useState<PracticeContext | null>(null);
  const [userInWatchlist, setUserInWatchlist] = useState<boolean | null>(null);
  const [userStatus, setUserStatus] = useState<'watch' | 'ready' | 'reject'>(
    'watch'
  );
  const [notes, setNotes] = useState('');
  const [grade, setGrade] = useState<PracticeGrade | null>(null);

  const history = useMemo(
    () =>
      [...(practiceAttempts ?? [])].sort(
        (a, b) => b.createdAt.localeCompare(a.createdAt)
      ),
    [practiceAttempts]
  );

  const effectiveSymbol = symbol || normalizeSymbol(manualCode);

  const stats = useMemo(() => {
    const total = history.length;
    const correct = history.filter((h) => h.correct).length;
    return { total, correct, rate: total ? Math.round((correct / total) * 100) : 0 };
  }, [history]);

  async function resolveStockTarget(): Promise<
    { symbol: string; name: string } | { error: string }
  > {
    if (/^\d{6}$/.test(effectiveSymbol)) {
      return { symbol: effectiveSymbol, name: name || effectiveSymbol };
    }

    const keyword = searchQuery.trim() || manualCode.trim();
    if (!keyword) {
      return { error: '请输入股票名称、代码，或从搜索结果中点选' };
    }

    const codeFromKeyword = normalizeSymbol(keyword);
    if (/^\d{6}$/.test(codeFromKeyword)) {
      return { symbol: codeFromKeyword, name: name || codeFromKeyword };
    }

    const results = await searchStocks(keyword);
    if (!results.length) {
      return { error: `未找到「${keyword}」相关股票，请换关键词或输入 6 位代码` };
    }

    const exactCode = results.find((r) => r.symbol === codeFromKeyword);
    if (exactCode) {
      return { symbol: exactCode.symbol, name: exactCode.name };
    }

    const exactName = results.find(
      (r) => r.name === keyword || r.name.includes(keyword)
    );
    const pick = exactName ?? results[0]!;
    return { symbol: pick.symbol, name: pick.name };
  }

  async function startPractice() {
    setLoading(true);
    setLoadError(null);
    setGrade(null);
    setUserInWatchlist(null);
    setUserStatus('watch');

    const turnoverOverride =
      turnoverInput.trim() === '' ? null : Number(turnoverInput);

    try {
      const target = await resolveStockTarget();
      if ('error' in target) {
        setLoadError(target.error);
        return;
      }

      const result = await loadPracticeContext({
        symbol: target.symbol,
        name: target.name,
        date,
        mode,
        envTotal,
        turnoverOverride:
          turnoverOverride != null && !Number.isNaN(turnoverOverride)
            ? turnoverOverride
            : null,
      });

      if ('error' in result) {
        setLoadError(result.error);
        return;
      }

      setSymbol(target.symbol);
      setName(target.name);
      setManualCode(target.symbol);
      setSearchQuery('');
      setCtx(result);
      setPhase('practice');
      requestAnimationFrame(() => {
        contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLoadError(
        msg.includes('timeout') || msg.includes('aborted')
          ? 'K 线请求超时，请检查网络后重试'
          : `加载失败：${msg}`
      );
    } finally {
      setLoading(false);
    }
  }

  function submitAnswer() {
    if (!ctx || userInWatchlist == null) return;
    const verdict = computePracticeVerdict(ctx);
    const g = gradePracticeAnswer(
      userInWatchlist,
      userInWatchlist ? userStatus : 'reject',
      verdict
    );
    setGrade(g);
    setPhase('result');

    const attempt = buildPracticeAttempt(
      ctx,
      userInWatchlist,
      userInWatchlist ? userStatus : 'reject',
      g,
      notes
    );
    setData((prev) => ({
      ...prev,
      practiceAttempts: trimPracticeAttempts([
        ...(prev.practiceAttempts ?? []),
        attempt,
      ]),
    }));
  }

  function resetToSetup() {
    setPhase('setup');
    setCtx(null);
    setGrade(null);
    setUserInWatchlist(null);
    setNotes('');
  }

  return (
    <div className="page practice-page">
      <header className="page-header row-between">
        <div>
          <h2>历史练习</h2>
          <p className="muted">
            任选股票与交易日，根据截止当日的 K 线做观察池判断，提交后与系统规则比对
          </p>
        </div>
        {stats.total > 0 && (
          <div className="card compact practice-stats">
            <span className="muted">累计练习</span>
            <div className="big-num accent">{stats.total}</div>
            <span className="small">
              正确 {stats.correct} 次 · 准确率 {stats.rate}%
            </span>
          </div>
        )}
      </header>

      {phase === 'setup' && (
        <section className="card section">
          <h3>选择练习标的</h3>
          <div className="practice-setup-grid">
            <label>
              股票
              {symbol ? (
                <div className="practice-selected-stock">
                  <strong>{symbol}</strong> {name}
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => {
                      setSymbol('');
                      setName('');
                      setManualCode('');
                      setSearchQuery('');
                    }}
                  >
                    更换
                  </button>
                </div>
              ) : (
                <>
                  <StockSearch
                    placeholder="输入名称或代码，可直接开始练习"
                    query={searchQuery}
                    onQueryChange={(q) => {
                      setSearchQuery(q);
                      setLoadError(null);
                    }}
                    onSelect={(r) => {
                      setSymbol(r.symbol);
                      setName(r.name);
                      setManualCode(r.symbol);
                      setSearchQuery(r.name);
                      setLoadError(null);
                    }}
                  />
                  <span className="small">也可直接输入 6 位代码</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="例如 600519"
                    value={manualCode}
                    onChange={(e) => {
                      setManualCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                      setLoadError(null);
                    }}
                  />
                </>
              )}
            </label>

            <label>
              练习日期
              <input
                type="date"
                value={date}
                max={todayStr()}
                onChange={(e) => setDate(e.target.value)}
              />
              <span className="small">
                非交易日将自动取最近的前一交易日；可选约 3 年内任意交易日
              </span>
            </label>

            <label>
              交易模式
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as TradeMode)}
              >
                <option value="trend">趋势股</option>
                <option value="emotion">情绪短线</option>
                <option value="etf">ETF / 指数</option>
              </select>
            </label>

            <label>
              假设环境总分（0–10）
              <input
                type="range"
                min={0}
                max={10}
                value={envTotal}
                onChange={(e) => setEnvTotal(Number(e.target.value))}
              />
              <span className="small">当前：{envTotal} 分</span>
            </label>

            <label>
              当日换手率 %（可选）
              <input
                type="number"
                step="0.1"
                min={0}
                placeholder="留空则按成交量估算"
                value={turnoverInput}
                onChange={(e) => setTurnoverInput(e.target.value)}
              />
            </label>
          </div>

          {loadError && <p className="market-error">{loadError}</p>}

          <button
            type="button"
            className="btn primary"
            disabled={loading}
            onClick={() => void startPractice()}
          >
            {loading ? '加载历史数据…' : '开始练习'}
          </button>
          {!loading && (
            <p className="small" style={{ marginTop: '0.5rem' }}>
              提示：输入名称后可直接点「开始练习」，系统会自动匹配股票；也可从下拉结果中点选
            </p>
          )}
        </section>
      )}

      {ctx && phase !== 'setup' && (
        <section ref={contentRef}>
          <section className="card section practice-context-bar">
            <div className="row-between">
              <div>
                <strong>{ctx.symbol}</strong> {ctx.name}
                <span className="tag">{TRADE_MODE_LABELS[ctx.mode]}</span>
              </div>
              <div className="practice-meta">
                <span>
                  截止 <strong>{ctx.asOfDate}</strong>
                  {ctx.requestedDate !== ctx.asOfDate && (
                    <span className="small">（原选 {ctx.requestedDate}）</span>
                  )}
                </span>
                <span>
                  收盘 <strong>{ctx.price.toFixed(2)}</strong>
                </span>
                <span className={ctx.changePercent >= 0 ? 'up' : 'down'}>
                  {formatChangePercent(ctx.changePercent)}
                </span>
              </div>
            </div>
            <div className="practice-ma-row small">
              MA5 {ctx.ma5.toFixed(2)} · MA10 {ctx.ma10.toFixed(2)} · MA20{' '}
              {ctx.ma20.toFixed(2)}
              {ctx.turnoverEstimated && (
                <span className="muted">
                  {' '}
                  · 估算换手 {ctx.turnoverRatio.toFixed(2)}%
                </span>
              )}
            </div>
          </section>

          <section className="card section">
            <h3>
              K 线（仅显示截止 {ctx.asOfDate}，不含之后走势）
            </h3>
            {ctx.bars.length > 0 ? (
              <LazyStockChartPanels
                bars={chartBarsForPractice(ctx.bars)}
                period="day"
              />
            ) : (
              <p className="muted">暂无 K 线数据</p>
            )}
          </section>

          {phase === 'practice' && (
            <section className="card section">
              <h3>你的判断</h3>
              <p className="muted small">
                根据截止当日的走势与规则，这只股票是否应纳入观察池？
              </p>
              <div className="practice-answer-row">
                <button
                  type="button"
                  className={`btn ${userInWatchlist === true ? 'primary' : ''}`}
                  onClick={() => setUserInWatchlist(true)}
                >
                  纳入观察池
                </button>
                <button
                  type="button"
                  className={`btn ${userInWatchlist === false ? 'primary' : ''}`}
                  onClick={() => setUserInWatchlist(false)}
                >
                  不纳入
                </button>
              </div>

              {userInWatchlist && (
                <label className="block" style={{ marginTop: '1rem' }}>
                  观察状态
                  <select
                    value={userStatus}
                    onChange={(e) =>
                      setUserStatus(e.target.value as typeof userStatus)
                    }
                  >
                    <option value="watch">观察（趋势尚可，买点未清晰）</option>
                    <option value="ready">就绪（接近理想买点）</option>
                  </select>
                </label>
              )}

              <label className="block" style={{ marginTop: '1rem' }}>
                备注（可选）
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="记录你的思考…"
                />
              </label>

              <div className="practice-actions">
                <button type="button" className="btn" onClick={resetToSetup}>
                  重新选题
                </button>
                <button
                  type="button"
                  className="btn primary"
                  disabled={userInWatchlist == null}
                  onClick={submitAnswer}
                >
                  提交验证
                </button>
              </div>
            </section>
          )}

          {phase === 'result' && grade && (
            <section
              className={`card section practice-result ${
                grade.correct && grade.statusCorrect ? 'pass' : 'fail'
              }`}
            >
              <h3>
                {grade.correct && grade.statusCorrect
                  ? '回答正确'
                  : grade.correct
                    ? '部分正确'
                    : '回答有误'}
              </h3>

              <div className="grid-2">
                <div>
                  <h4 className="small muted">你的判断</h4>
                  <p>
                    {userInWatchlist ? '纳入观察池' : '不纳入'}
                    {userInWatchlist &&
                      ` · ${STATUS_LABELS[userStatus]}`}
                  </p>
                </div>
                <div>
                  <h4 className="small muted">系统规则</h4>
                  <p>
                    {grade.verdict.shouldWatchlist
                      ? '应纳入观察池'
                      : '不应纳入'}
                    {grade.verdict.shouldWatchlist &&
                      ` · ${STATUS_LABELS[grade.verdict.status]}`}
                    {grade.verdict.totalScore > 0 && (
                      <span className="small">
                        {' '}
                        · 评分 {grade.verdict.totalScore}（
                        {stockScoreLabel(grade.verdict.totalScore).label}）
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <ul className="practice-feedback">
                {grade.feedback.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>

              {grade.verdict.scores && (
                <div className="practice-score-breakdown">
                  <h4 className="small muted">评分明细（满分约 18）</h4>
                  <ul className="small score-dims">
                    <li>市场环境 {grade.verdict.scores.marketEnv}</li>
                    <li>板块 {grade.verdict.scores.sector}</li>
                    <li>趋势 {grade.verdict.scores.trend}</li>
                    <li>量价 {grade.verdict.scores.volumePrice}</li>
                    <li>买点清晰度 {grade.verdict.scores.buyPointClarity}</li>
                    <li>风险收益比 {grade.verdict.scores.riskReward}</li>
                  </ul>
                </div>
              )}

              {grade.verdict.fails.length > 0 && (
                <div className="practice-fails">
                  <strong>规则未通过：</strong>
                  {grade.verdict.fails.join('；')}
                </div>
              )}

              <div className="practice-actions">
                <button type="button" className="btn" onClick={resetToSetup}>
                  再练一题
                </button>
                <Link
                  to={`/stock/${ctx.symbol}`}
                  className="btn"
                  state={{ name: ctx.name }}
                >
                  查看该股详情
                </Link>
              </div>
            </section>
          )}
        </section>
      )}

      {history.length > 0 && phase === 'setup' && (
        <section className="card section">
          <h3>练习记录</h3>
          <div className="table-wrap">
            <table className="table compact">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>股票</th>
                  <th>模式</th>
                  <th>你的判断</th>
                  <th>系统</th>
                  <th>结果</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 20).map((h) => (
                  <tr key={h.id}>
                    <td>{h.asOfDate}</td>
                    <td>
                      {h.symbol} {h.name}
                    </td>
                    <td>{TRADE_MODE_LABELS[h.mode]}</td>
                    <td>
                      {h.userInWatchlist
                        ? `纳入 · ${STATUS_LABELS[h.userStatus]}`
                        : '不纳入'}
                    </td>
                    <td>
                      {h.systemShouldWatchlist
                        ? `纳入 · ${STATUS_LABELS[h.systemStatus]}`
                        : '不纳入'}
                    </td>
                    <td>
                      <span
                        className={`tag ${h.correct ? 'tag-ok' : 'tag-bad'}`}
                      >
                        {h.correct ? '正确' : '错误'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
