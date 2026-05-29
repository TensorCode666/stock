import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AppProvider } from './context/AppContext';
import { MarketDataProvider } from './context/MarketDataContext';
import { Dashboard } from './pages/Dashboard';
import { Rules } from './pages/Rules';

const BuyPlan = lazy(() =>
  import('./pages/BuyPlan').then((m) => ({ default: m.BuyPlan }))
);
const DailyChecklist = lazy(() =>
  import('./pages/DailyChecklist').then((m) => ({ default: m.DailyChecklist }))
);
const Favorites = lazy(() =>
  import('./pages/Favorites').then((m) => ({ default: m.Favorites }))
);
const Holdings = lazy(() =>
  import('./pages/Holdings').then((m) => ({ default: m.Holdings }))
);
const Journal = lazy(() =>
  import('./pages/Journal').then((m) => ({ default: m.Journal }))
);
const MarketEnv = lazy(() =>
  import('./pages/MarketEnv').then((m) => ({ default: m.MarketEnv }))
);
const PositionCalc = lazy(() =>
  import('./pages/PositionCalc').then((m) => ({ default: m.PositionCalc }))
);
const Practice = lazy(() =>
  import('./pages/Practice').then((m) => ({ default: m.Practice }))
);
const StockDetail = lazy(() =>
  import('./pages/StockDetail').then((m) => ({ default: m.StockDetail }))
);
const Watchlist = lazy(() =>
  import('./pages/Watchlist').then((m) => ({ default: m.Watchlist }))
);

function PageFallback() {
  return <p className="muted page-loading">加载中…</p>;
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

export default function App() {
  return (
    <AppProvider>
      <MarketDataProvider>
        <BrowserRouter
          basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}
        >
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route
                path="env"
                element={
                  <LazyPage>
                    <MarketEnv />
                  </LazyPage>
                }
              />
              <Route
                path="watchlist"
                element={
                  <LazyPage>
                    <Watchlist />
                  </LazyPage>
                }
              />
              <Route
                path="favorites"
                element={
                  <LazyPage>
                    <Favorites />
                  </LazyPage>
                }
              />
              <Route
                path="stock/:symbol"
                element={
                  <LazyPage>
                    <StockDetail />
                  </LazyPage>
                }
              />
              <Route
                path="buy"
                element={
                  <LazyPage>
                    <BuyPlan />
                  </LazyPage>
                }
              />
              <Route
                path="position"
                element={
                  <LazyPage>
                    <PositionCalc />
                  </LazyPage>
                }
              />
              <Route
                path="holdings"
                element={
                  <LazyPage>
                    <Holdings />
                  </LazyPage>
                }
              />
              <Route
                path="journal"
                element={
                  <LazyPage>
                    <Journal />
                  </LazyPage>
                }
              />
              <Route
                path="daily"
                element={
                  <LazyPage>
                    <DailyChecklist />
                  </LazyPage>
                }
              />
              <Route
                path="practice"
                element={
                  <LazyPage>
                    <Practice />
                  </LazyPage>
                }
              />
              <Route path="rules" element={<Rules />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </MarketDataProvider>
    </AppProvider>
  );
}
