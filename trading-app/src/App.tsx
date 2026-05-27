import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AppProvider } from './context/AppContext';
import { MarketDataProvider } from './context/MarketDataContext';
import { BuyPlan } from './pages/BuyPlan';
import { DailyChecklist } from './pages/DailyChecklist';
import { Dashboard } from './pages/Dashboard';
import { Holdings } from './pages/Holdings';
import { Journal } from './pages/Journal';
import { MarketEnv } from './pages/MarketEnv';
import { PositionCalc } from './pages/PositionCalc';
import { Rules } from './pages/Rules';
import { StockDetail } from './pages/StockDetail';
import { Favorites } from './pages/Favorites';
import { Watchlist } from './pages/Watchlist';

export default function App() {
  return (
    <AppProvider>
      <MarketDataProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="env" element={<MarketEnv />} />
            <Route path="watchlist" element={<Watchlist />} />
            <Route path="favorites" element={<Favorites />} />
            <Route path="stock/:symbol" element={<StockDetail />} />
            <Route path="buy" element={<BuyPlan />} />
            <Route path="position" element={<PositionCalc />} />
            <Route path="holdings" element={<Holdings />} />
            <Route path="journal" element={<Journal />} />
            <Route path="daily" element={<DailyChecklist />} />
            <Route path="rules" element={<Rules />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </MarketDataProvider>
    </AppProvider>
  );
}
