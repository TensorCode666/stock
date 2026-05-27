export type TradeMode = 'trend' | 'emotion' | 'etf';

export type TradeClassification =
  | 'system_profit'
  | 'system_loss'
  | 'violation_profit'
  | 'violation_loss';

export interface MarketEnvScore {
  date: string;
  indexTrend: 0 | 1 | 2;
  mainSector: 0 | 1 | 2;
  profitEffect: 0 | 1 | 2;
  emotionCycle: 0 | 1 | 2;
  volume: 0 | 1 | 2;
  emotionStage?: string;
  notes?: string;
}

export interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  mode: TradeMode;
  scores: {
    marketEnv: number;
    sector: number;
    trend: number;
    volumePrice: number;
    buyPointClarity: number;
    riskReward: number;
  };
  status: 'watch' | 'ready' | 'removed';
  notes?: string;
  createdAt: string;
  /** 手动添加 or 规则扫描 */
  source?: 'manual' | 'screen';
  screenReasons?: string[];
  screenedAt?: string;
}

export interface TradePlan {
  id: string;
  symbol: string;
  name: string;
  mode: TradeMode;
  envScore: number;
  stockScore: number;
  buyReason: string;
  buyPrice: number;
  stopLoss: number;
  targetPrice: number;
  plannedPositionPct: number;
  addConditions: string;
  sellConditions: string;
  checklist: BuyChecklist;
  createdAt: string;
}

export interface BuyChecklist {
  envAllowed: boolean;
  modeMatch: boolean;
  inWatchlist: boolean;
  buyPointClear: boolean;
  stopClear: boolean;
  targetClear: boolean;
  riskRewardOk: boolean;
  positionOk: boolean;
  willingToExit: boolean;
}

export interface Holding {
  id: string;
  symbol: string;
  name: string;
  mode: TradeMode;
  buyDate: string;
  buyPrice: number;
  shares: number;
  stopLoss: number;
  targetPrice: number;
  sellConditions: string;
  notes?: string;
}

export interface TradeRecord {
  id: string;
  symbol: string;
  name: string;
  mode: TradeMode;
  buyDate: string;
  sellDate: string;
  buyPrice: number;
  sellPrice: number;
  shares: number;
  buyReason: string;
  sellReason: string;
  plannedStop: number;
  plannedTarget: number;
  followedPlan: boolean;
  classification: TradeClassification;
  improvements: string;
  pnl?: number;
  pnlPercent?: number;
}

export interface UserSettings {
  totalCapital: number;
  maxLossPerTradePercent: number;
}

export interface DailyChecklistState {
  date: string;
  preMarket: Record<string, boolean>;
  buyBefore: Record<string, boolean>;
  holding: Record<string, boolean>;
  sellBefore: Record<string, boolean>;
  postMarket: Record<string, boolean>;
}

export interface AppData {
  settings: UserSettings;
  envScores: MarketEnvScore[];
  watchlist: WatchlistItem[];
  tradePlans: TradePlan[];
  holdings: Holding[];
  trades: TradeRecord[];
  dailyChecklists: DailyChecklistState[];
}
