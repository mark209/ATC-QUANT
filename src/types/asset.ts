export type AssetType = "crypto" | "stock" | "etf" | "index";

export type RiskProfile = "conservative" | "balanced" | "aggressive";

export type Timeframe = "1y" | "3y" | "5y" | "10y" | "max";
export type DataRange = "1y" | "3y" | "5y" | "10y" | "max";

export interface MarketDataPoint {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume?: number;
  rawClose?: number;
  adjustedClose?: number;
  closeAdjustmentSource?: "adjusted" | "unadjusted";
  ohlcAdjustmentSource?: "derived-from-adjusted-close" | "provider-split-adjusted" | "unadjusted";
}

export interface AssetOverview {
  symbol: string;
  name: string;
  assetType: AssetType;
  market: string;
  exchange: string;
  currentPrice: number;
  dailyChangePercent: number;
  dailyVolume: number;
  quoteVolume?: number;
  lastUpdated: string;
  liveSource: string;
}

export interface MarketDataset {
  overview: AssetOverview;
  prices: MarketDataPoint[];
  benchmark?: MarketDataPoint[];
  dataRanges?: DataFetchResult;
}

export interface ProviderUnavailable {
  provider: string;
  message: string;
  source: string;
}

export interface CandleDensityResult {
  requestedRange: string;
  actualCandleCount: number;
  firstTimestamp: number | null;
  lastTimestamp: number | null;
  actualSpanDays: number;
  expectedMinCandles: number;
  densityRatio: number;
  isSparse: boolean;
  gapCount: number;
  largestGapDays: number;
  duplicateCount: number;
  isSorted: boolean;
  isStale: boolean;
  issues: string[];
  warnings: string[];
}

export interface DataFetchResult {
  symbol: string;
  assetType: AssetType;
  overview: AssetOverview;
  chartRangeRequested: string;
  chartDataRangeUsed: string;
  engineRangeUsed: string;
  backtestRangeUsed: string;
  validationRangeUsed: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
  chartCandles: MarketDataPoint[];
  engineCandles: MarketDataPoint[];
  backtestCandles: MarketDataPoint[];
  validationCandles: MarketDataPoint[];
  density: {
    chart: CandleDensityResult;
    engine: CandleDensityResult;
    backtest: CandleDensityResult;
    validation: CandleDensityResult;
  };
  warnings: string[];
  issues: string[];
}
