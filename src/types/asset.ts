export type AssetType = "crypto" | "stock" | "etf" | "index";

export type RiskProfile = "conservative" | "balanced" | "aggressive";

export type Timeframe = "90d" | "180d" | "1y";

export interface MarketDataPoint {
  date: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume?: number;
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
}

export interface ProviderUnavailable {
  provider: string;
  message: string;
  source: string;
}
