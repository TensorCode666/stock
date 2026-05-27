const RULE_SECTIONS = [
  {
    title: '核心原则',
    items: [
      '先判断市场环境，再选择交易模式',
      '先写交易计划，再决定是否下单',
      '只做能定义买点、卖点、止损和仓位的交易',
      '不追高、不满仓、不在亏损中盲目加仓',
      '盈利加仓，亏损不加仓',
      '趋势没坏持有，趋势破坏退出',
      '每笔交易必须复盘',
    ],
  },
  {
    title: '三种交易模式',
    items: [
      '趋势股：多头/震荡偏强；20日线上、回踩不破、三周期共振',
      '情绪短线：情绪修复/启动/主升；主线前排、分歧转一致',
      'ETF：长期低位、分批定投；牛市高潮退出',
    ],
  },
  {
    title: '环境评分（0–10）',
    items: [
      '8–10：积极交易，总仓 60%–90%',
      '5–7：谨慎，总仓 20%–50%',
      '3–4：轻仓观察 0%–20%',
      '0–2：空仓',
    ],
  },
  {
    title: '选股评分（0–20）',
    items: [
      '16–20：重点观察，等待买点',
      '12–15：普通观察，仅轻仓',
      '8–11：只观察不交易',
      '<8：剔除',
    ],
  },
  {
    title: '卖出要点',
    items: [
      '硬止损：跌破支撑、20日线、计划止损 — 到位就执行',
      '时间止损：5–7 日不涨考虑退出',
      '分批止盈：目标 1/3 → 趋势延续保留 → 破坏清仓',
      '情绪票：龙头断板、后排大跌、高潮次日不及预期',
    ],
  },
  {
    title: '风险红线',
    items: [
      '连续亏损 3 笔暂停并复盘',
      '单日亏损超计划停止当日交易',
      '情绪失控不交易',
      '看不懂时空仓',
    ],
  },
];

export function Rules() {
  return (
    <div className="page">
      <header className="page-header">
        <h2>规则库</h2>
        <p className="muted">
          摘自 trading-system/ 规则文档。完整细则见项目目录下各 md 文件。
        </p>
      </header>

      <div className="rules-grid">
        {RULE_SECTIONS.map((s) => (
          <div key={s.title} className="card section">
            <h3>{s.title}</h3>
            <ul>
              {s.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <section className="card section">
        <h3>文档索引</h3>
        <table className="table compact">
          <tbody>
            {[
              ['01_市场环境判断.md', '能不能交易、用什么模式'],
              ['02_选股体系.md', '观察池、三周期、好股标准'],
              ['03_买入规则.md', '买点、买入前清单'],
              ['04_卖出规则.md', '止损、止盈、时间退出'],
              ['05_仓位与风险控制.md', '总仓、单票、加仓'],
              ['06_复盘模板.md', '每日/单笔/月度复盘'],
              ['07_每日交易清单.md', '盘前盘中盘后'],
              ['交易系统设计方案.md', '系统总设计'],
            ].map(([file, desc]) => (
              <tr key={file}>
                <td>
                  <code>{file}</code>
                </td>
                <td>{desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
