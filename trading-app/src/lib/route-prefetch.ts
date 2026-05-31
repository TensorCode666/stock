const prefetched = new Set<string>();

const routeLoaders: Record<string, () => Promise<unknown>> = {
  '/': () => import('../pages/Dashboard'),
  '/env': () => import('../pages/MarketEnv'),
  '/watchlist': () => import('../pages/Watchlist'),
  '/favorites': () => import('../pages/Favorites'),
  '/buy': () => import('../pages/BuyPlan'),
  '/position': () => import('../pages/PositionCalc'),
  '/holdings': () => import('../pages/Holdings'),
  '/journal': () => import('../pages/Journal'),
  '/daily': () => import('../pages/DailyChecklist'),
  '/practice': () => import('../pages/Practice'),
  '/rules': () => import('../pages/Rules'),
};

/** 悬停导航时预加载对应页面 chunk */
export function prefetchRoute(path: string): void {
  const loader = routeLoaders[path];
  if (!loader || prefetched.has(path)) return;
  prefetched.add(path);
  void loader();
}
