import { useState } from 'react';
import { useAppActions, useAppSlice } from '../context/AppContext';
import {
  useMarketBreadth,
  useMarketIndices,
  useMarketStatus,
} from '../context/MarketDataContext';
import { envScoreLabel, envScoreTotal } from '../lib/calculations';
import {
  DIM_LABELS,
  scoreMarketEnvWithAi,
  type MarketEnvAiResult,
} from '../lib/market-env-ai';
import { suggestEnvScores } from '../lib/market-api';
import { todayStr } from '../lib/storage';
import type { MarketEnvScore } from '../types';

const SCORE_DIMS = [
  { key: 'indexTrend' as const, label: '指数趋势', desc: '0下跌 / 1震荡 / 2上升' },
  { key: 'mainSector' as const, label: '主线板块', desc: '0无主线 / 1轮动快 / 2主线清晰' },
  { key: 'profitEffect' as const, label: '赚钱效应', desc: '0差 / 1一般 / 2强' },
  { key: 'emotionCycle' as const, label: '情绪周期', desc: '0退潮 / 1修复 / 2主升' },
  { key: 'volume' as const, label: '成交量', desc: '0缩量弱 / 1平稳 / 2放量健康' },
];

const EMOTION_STAGES = [
  '冰点期',
  '修复期',
  '启动期',
  '主升期',
  '高潮期',
  '退潮期',
];

const emptyScore = (): MarketEnvScore => ({
  date: todayStr(),
  indexTrend: 1,
  mainSector: 1,
  profitEffect: 1,
  emotionCycle: 1,
  volume: 1,
  emotionStage: '修复期',
  notes: '',
});

export function MarketEnv() {
  const { setData } = useAppActions();
  const envScores = useAppSlice('envScores');
  const indices = useMarketIndices();
  const breadth = useMarketBreadth();
  const { loading: marketLoading } = useMarketStatus();
  const existing = envScores.find((e) => e.date === todayStr());
  const [form, setForm] = useState<MarketEnvScore>(existing ?? emptyScore());
  const [aiResult, setAiResult] = useState<MarketEnvAiResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const total = envScoreTotal(form);
  const info = envScoreLabel(total);

  const setDim = (key: keyof MarketEnvScore, value: 0 | 1 | 2) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const runAiScore = () => {
    if (!indices.length) {
      alert('请先等待行情加载完成');
      return;
    }
    setAiLoading(true);
    const result = scoreMarketEnvWithAi(indices, breadth);
    setAiLoading(false);
    if (!result) {
      alert('无法生成评分，请稍后重试');
      return;
    }
    setAiResult(result);
    setForm((f) => ({
      ...f,
      indexTrend: result.indexTrend,
      mainSector: result.mainSector,
      profitEffect: result.profitEffect,
      emotionCycle: result.emotionCycle,
      volume: result.volume,
      emotionStage: result.emotionStage,
      notes: [f.notes, `【AI 评分 ${result.totalScore}/10】${result.summary}`]
        .filter(Boolean)
        .join('\n'),
    }));
  };

  const save = () => {
    const entry = { ...form, date: todayStr() };
    setData((prev) => {
      const rest = prev.envScores.filter((e) => e.date !== entry.date);
      return { ...prev, envScores: [...rest, entry] };
    });
    alert('市场环境评分已保存');
  };

  return (
    <div className="page">
      <header className="page-header">
        <h2>市场环境判断</h2>
        <p className="muted">
          交易第一步：环境决定模式，模式决定仓位。评分不清时默认不交易。
        </p>
      </header>

      <div className="grid-2">
        <div className="card section">
          <h3>今日评分（每项 0–2，总分 10）</h3>
          {SCORE_DIMS.map((d) => (
            <div key={d.key} className="score-row">
              <div>
                <strong>{d.label}</strong>
                <span className="small block">{d.desc}</span>
              </div>
              <div className="seg">
                {([0, 1, 2] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    className={
                      form[d.key] === v ? 'seg-btn active' : 'seg-btn'
                    }
                    onClick={() => setDim(d.key, v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <label className="field">
            情绪周期阶段
            <select
              value={form.emotionStage ?? ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, emotionStage: e.target.value }))
              }
            >
              {EMOTION_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            备注
            <textarea
              value={form.notes ?? ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              rows={3}
              placeholder="指数状态、主线、亏钱效应等"
            />
          </label>

          <div className="btn-row">
            <button
              type="button"
              className="btn primary"
              disabled={aiLoading || marketLoading || !indices.length}
              onClick={runAiScore}
            >
              {aiLoading ? 'AI 分析中…' : 'AI 智能评分'}
            </button>
            {indices.length > 0 && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const s = suggestEnvScores(indices, breadth);
                  setForm((f) => ({
                    ...f,
                    indexTrend: s.indexTrend,
                    profitEffect: s.profitEffect,
                    volume: s.volume,
                    notes: [f.notes, `【行情参考】${s.hint}`]
                      .filter(Boolean)
                      .join('\n'),
                  }));
                }}
              >
                快速填充（仅 3 项）
              </button>
            )}
          </div>

          {aiResult && (
            <div className="ai-score-panel card">
              <h4>AI 评分说明（可手调后保存）</h4>
              <p className="ai-summary">{aiResult.summary}</p>
              <ul className="ai-reasons">
                {(
                  [
                    'indexTrend',
                    'mainSector',
                    'profitEffect',
                    'emotionCycle',
                    'volume',
                  ] as const
                ).map((key) => (
                  <li key={key}>
                    <strong>
                      {DIM_LABELS[key]}：{aiResult[key]} 分
                    </strong>
                    <span className="block small">{aiResult.reasons[key]}</span>
                  </li>
                ))}
              </ul>
              <p className="small muted">
                建议情绪阶段：{aiResult.emotionStage}（已写入表单，可修改）
              </p>
            </div>
          )}

          <button type="button" className="btn primary" onClick={save}>
            保存今日评分
          </button>
        </div>

        <div className={`card section result-${info.color}`}>
          <h3>环境结论</h3>
          <div className="big-num">{total} / 10</div>
          <p className="tag">{info.label}</p>
          <p>{info.action}</p>
          <p className="small">{info.positionRange}</p>

          <hr />
          <h4>环境 × 模式对照</h4>
          <table className="table compact">
            <thead>
              <tr>
                <th>环境</th>
                <th>优先模式</th>
                <th>避免</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>多头主升</td>
                <td>趋势持股、回踩加仓</td>
                <td>满仓追高</td>
              </tr>
              <tr>
                <td>情绪上升</td>
                <td>情绪前排、龙头</td>
                <td>高潮接力</td>
              </tr>
              <tr>
                <td>震荡</td>
                <td>高抛低吸、ETF</td>
                <td>追涨杀跌</td>
              </tr>
              <tr>
                <td>空头/退潮</td>
                <td>空仓、极轻仓</td>
                <td>补仓死扛</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <section className="card section">
        <h3>历史评分</h3>
        {envScores.length === 0 ? (
          <p className="muted">暂无记录</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>日期</th>
                <th>总分</th>
                <th>结论</th>
                <th>情绪阶段</th>
              </tr>
            </thead>
            <tbody>
              {[...envScores]
                .reverse()
                .slice(0, 14)
                .map((e) => {
                  const t = envScoreTotal(e);
                  const l = envScoreLabel(t);
                  return (
                    <tr key={e.date}>
                      <td>{e.date}</td>
                      <td>{t}</td>
                      <td>{l.label}</td>
                      <td>{e.emotionStage ?? '—'}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
