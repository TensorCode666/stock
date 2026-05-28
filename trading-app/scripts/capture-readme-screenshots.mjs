/**
 * 抓取 README 配图（需先 npm run dev）
 * 用法：node scripts/capture-readme-screenshots.mjs
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

const DEMO_DATA = {
  settings: { totalCapital: 100000, maxLossPerTradePercent: 1.5 },
  envScores: [],
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
  holdings: [],
  trades: [],
  dailyChecklists: [],
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

  await browser.close();
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
