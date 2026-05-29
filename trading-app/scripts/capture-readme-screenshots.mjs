/**
 * 抓取 README 配图（需先 npm run dev）
 * 用法：npm run capture-screenshots
 * 或：APP_URL=http://localhost:5173 node scripts/capture-readme-screenshots.mjs
 */
import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const ASSETS = path.join(ROOT, 'assets');
const DOCS = path.join(ROOT, 'docs', 'screenshots');
const BASE = process.env.APP_URL || 'http://localhost:5174';

const today = new Date().toISOString().slice(0, 10);

const DEMO_DATA = {
  settings: { totalCapital: 100000, maxLossPerTradePercent: 1.5 },
  envScores: [
    {
      date: today,
      indexTrend: 2,
      mainSector: 1,
      profitEffect: 2,
      emotionCycle: 1,
      volume: 2,
    },
  ],
  favorites: [
    {
      id: 'fav-510300',
      symbol: '510300',
      name: '沪深300ETF',
      initialPrice: 4.12,
      addedAt: new Date().toISOString(),
    },
  ],
  watchlist: [
    {
      id: 'w-510300',
      symbol: '510300',
      name: '沪深300ETF',
      mode: 'etf',
      scores: {
        marketEnv: 3,
        sector: 3,
        trend: 4,
        volumePrice: 2,
        buyPointClarity: 3,
        riskReward: 3,
      },
      status: 'ready',
      source: 'screen',
      screenReasons: [
        '股价在20日线附近或上方',
        '5/10/20日均线多头',
      ],
      createdAt: new Date().toISOString(),
      screenedAt: new Date().toISOString(),
    },
  ],
  tradePlans: [],
  holdings: [
    {
      id: 'h-300394',
      symbol: '300394',
      name: '天孚通信',
      mode: 'trend',
      buyDate: '2026-04-15',
      buyPrice: 95,
      shares: 200,
      stopLoss: 88,
      targetPrice: 115,
      sellConditions: '跌破20日线；放量破位；3日不创新高',
      notes: '',
    },
    {
      id: 'h-510300',
      symbol: '510300',
      name: '沪深300ETF',
      mode: 'etf',
      buyDate: '2026-03-20',
      buyPrice: 3.95,
      shares: 1000,
      stopLoss: 3.75,
      targetPrice: 4.35,
      sellConditions: '跌破20日线',
      notes: '',
    },
  ],
  trades: [],
  dailyChecklists: [],
  practiceAttempts: [
    {
      id: 'p-demo-1',
      symbol: '300394',
      name: '天孚通信',
      asOfDate: '2025-05-22',
      mode: 'trend',
      envTotal: 6,
      turnoverRatio: 2.5,
      userInWatchlist: true,
      userStatus: 'watch',
      systemShouldWatchlist: true,
      systemStatus: 'watch',
      correct: true,
      totalScore: 14,
      systemReasons: ['5/10/20日均线多头', '股价在20日线附近或上方'],
      systemFails: [],
      createdAt: new Date().toISOString(),
    },
  ],
};

async function saveBoth(page, name) {
  const file = path.join(ASSETS, name);
  await page.screenshot({ path: file, fullPage: true });
  await copyFile(file, path.join(DOCS, name));
  console.log('saved', name);
}

async function navBySidebar(page, label, heading) {
  await page.locator('.nav-link', { hasText: label }).click();
  await page.locator('h2', { hasText: heading }).waitFor({
    state: 'visible',
    timeout: 20000,
  });
  await page.waitForTimeout(1500);
  const h = await page.locator('.page h2').first().textContent();
  console.log(`nav ${label} → ${h?.trim()}`);
}

async function capturePractice(page) {
  await navBySidebar(page, '历史练习', '历史练习');
  await page.getByPlaceholder('输入名称或代码').fill('300394');
  await page.getByRole('button', { name: '开始练习' }).click();
  try {
    await page.locator('.practice-context-bar').waitFor({
      state: 'visible',
      timeout: 45000,
    });
    await page.waitForTimeout(3000);
    const chart = page.locator('.chart-pane').first();
    const box = await chart.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.waitForTimeout(800);
    }
  } catch {
    console.warn('practice K-line load timeout, capture setup page');
    await navBySidebar(page, '历史练习', '历史练习');
    await page.getByPlaceholder('输入名称或代码').fill('天孚通信');
    await page.waitForTimeout(500);
  }
  await saveBoth(page, 'practice.png');
}

async function captureHoldingsAdvice(page) {
  await navBySidebar(page, '持仓', '持仓管理');
  await page.locator('h3', { hasText: '规则建议' }).waitFor({
    state: 'visible',
    timeout: 15000,
  });
  // 等待 K 线加载后建议理由更完整
  await page.waitForTimeout(8000);
  await saveBoth(page, 'holdings-advice.png');
}

async function main() {
  await mkdir(ASSETS, { recursive: true });
  await mkdir(DOCS, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });

  await context.addInitScript((data) => {
    localStorage.setItem('stock-trading-system-v1', JSON.stringify(data));
  }, DEMO_DATA);

  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForSelector('.app-shell .nav-link', { timeout: 30000 });
  await page.waitForTimeout(3000);

  await navBySidebar(page, '总览', '今日总览');
  await saveBoth(page, 'dashboard.png');

  await navBySidebar(page, '市场环境', '市场环境判断');
  const aiBtn = page.getByRole('button', { name: 'AI 智能评分' });
  if (await aiBtn.isVisible()) {
    await aiBtn.click();
    await page.locator('.ai-score-panel').waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForTimeout(500);
  }
  await saveBoth(page, 'market-env-ai.png');

  await navBySidebar(page, '观察池', '观察池');
  await saveBoth(page, 'watchlist.png');

  const buyBtn = page.getByRole('button', { name: /买入|加仓/ }).first();
  if (await buyBtn.isVisible()) {
    await buyBtn.click();
    await page.locator('.buy-modal').waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForTimeout(500);
    await saveBoth(page, 'watchlist-buy.png');
    await page.getByRole('button', { name: '取消' }).click();
    await page.waitForTimeout(300);
  }

  await navBySidebar(page, '自选股', '自选股');
  await saveBoth(page, 'favorites.png');

  await navBySidebar(page, '观察池', '观察池');
  await page.locator('a.stock-link', { hasText: '510300' }).first().click();
  await page.waitForURL(/\/stock\/510300/, { timeout: 15000 });
  await page.locator('.stock-detail').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(6000);

  const chart = page.locator('.chart-pane').first();
  try {
    await chart.waitFor({ state: 'visible', timeout: 25000 });
    const box = await chart.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.45);
      await page.waitForTimeout(600);
    }
  } catch {
    console.warn('chart not visible, capture detail without crosshair');
  }
  await saveBoth(page, 'stock-detail.png');

  await capturePractice(page);
  await captureHoldingsAdvice(page);

  await browser.close();
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
