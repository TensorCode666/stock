import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  envScoreLabel,
  envScoreTotal,
  positionFromRisk,
  suggestedSinglePosition,
} from '../lib/calculations';
import { todayStr } from '../lib/storage';

export function PositionCalc() {
  const { data, update } = useApp();
  const { settings } = data;
  const todayEnv = data.envScores.find((e) => e.date === todayStr());
  const envTotal = todayEnv ? envScoreTotal(todayEnv) : null;
  const envInfo = envTotal !== null ? envScoreLabel(envTotal) : null;

  const [buyPrice, setBuyPrice] = useState(10);
  const [stopPrice, setStopPrice] = useState(9.5);
  const [mode, setMode] = useState<'trend' | 'emotion' | 'etf'>('trend');
  const [quality, setQuality] = useState<'high' | 'normal' | 'trial'>('normal');

  const stopPct = useMemo(() => {
    if (buyPrice <= 0 || stopPrice >= buyPrice) return 0;
    return ((buyPrice - stopPrice) / buyPrice) * 100;
  }, [buyPrice, stopPrice]);

  const maxBuyAmount = positionFromRisk(
    settings.totalCapital,
    settings.maxLossPerTradePercent,
    stopPct
  );

  const suggested = suggestedSinglePosition(mode, quality);
  const maxPctAmount =
    (settings.totalCapital * suggested.max) / 100;
  const recommended = Math.min(maxBuyAmount, maxPctAmount);

  return (
    <div className="page">
      <header className="page-header">
        <h2>仓位计算器</h2>
        <p className="muted">
          可买金额 = 单笔最大可亏金额 ÷ 止损幅度。先定义亏多少，再考虑赚多少。
        </p>
      </header>

      <div className="grid-2">
        <div className="card section">
          <h3>账户设置</h3>
          <label className="field">
            总资金（元）
            <input
              type="number"
              value={settings.totalCapital}
              onChange={(e) =>
                update({
                  settings: {
                    ...settings,
                    totalCapital: Number(e.target.value) || 0,
                  },
                })
              }
            />
          </label>
          <label className="field">
            单笔最大亏损（占总资金 %）
            <input
              type="number"
              step="0.1"
              value={settings.maxLossPerTradePercent}
              onChange={(e) =>
                update({
                  settings: {
                    ...settings,
                    maxLossPerTradePercent: Number(e.target.value) || 1,
                  },
                })
              }
            />
          </label>
          <p className="small">
            单笔最大可亏：¥
            {(
              (settings.totalCapital * settings.maxLossPerTradePercent) /
              100
            ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>

          {envInfo && envTotal !== null && (
            <div className={`env-hint result-${envInfo.color}`}>
              <strong>今日环境 {envTotal}/10 — {envInfo.label}</strong>
              <p className="small">{envInfo.positionRange}</p>
            </div>
          )}
        </div>

        <div className="card section">
          <h3>本笔交易计算</h3>
          <label className="field">
            交易模式
            <select
              value={mode}
              onChange={(e) =>
                setMode(e.target.value as 'trend' | 'emotion' | 'etf')
              }
            >
              <option value="trend">趋势股</option>
              <option value="emotion">情绪短线</option>
              <option value="etf">ETF</option>
            </select>
          </label>
          <label className="field">
            标的质量
            <select
              value={quality}
              onChange={(e) =>
                setQuality(e.target.value as 'high' | 'normal' | 'trial')
              }
            >
              <option value="high">高质量</option>
              <option value="normal">普通</option>
              <option value="trial">试错</option>
            </select>
          </label>
          <p className="small">{suggested.label}</p>

          <label className="field">
            计划买入价
            <input
              type="number"
              step="0.01"
              value={buyPrice}
              onChange={(e) => setBuyPrice(Number(e.target.value))}
            />
          </label>
          <label className="field">
            止损价
            <input
              type="number"
              step="0.01"
              value={stopPrice}
              onChange={(e) => setStopPrice(Number(e.target.value))}
            />
          </label>

          {stopPct > 0 ? (
            <>
              <p>止损幅度：<strong>{stopPct.toFixed(2)}%</strong></p>
              <div className="result-box">
                <div>按风险计算可买</div>
                <div className="big-num">
                  ¥{maxBuyAmount.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </div>
                <div className="small">
                  单票上限 {suggested.max}% ≈ ¥
                  {maxPctAmount.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </div>
                <hr />
                <div>建议取较小值</div>
                <div className="big-num accent">
                  ¥{recommended.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </div>
                {buyPrice > 0 && (
                  <p className="small">
                    约 {Math.floor(recommended / buyPrice / 100) * 100} 股（按
                    100 股取整需自行调整）
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="warn">止损价须低于买入价</p>
          )}
        </div>
      </div>

      <section className="card section">
        <h3>加仓结构（盈利加仓）</h3>
        <div className="pyramid">
          <div>首仓 10% — 试错</div>
          <div>确认 +10%–15% — 走势符合预期</div>
          <div>主升 +10% — 趋势明确</div>
          <div>高位 — 不加仓，只管理卖出</div>
        </div>
        <p className="small warn">
          禁止：亏损补仓、摊低成本、情绪退潮加仓
        </p>
      </section>
    </div>
  );
}
