import type { AssetType } from "@/types/asset";

export interface QuantConfig {
  targetVolatility: number;
  currentDecisionLookbackDays: number;
  minDataPoints: number;
  minTradeCount: number;
  limitedSampleTradeCount: number;
  strongSampleTradeCount: number;
  maxEquityAllocation: number;
  maxETFAllocation: number;
  maxBTCEthAllocation: number;
  maxAltcoinAllocation: number;
  maxIndexAllocation: number;
  maxPortfolioCryptoExposure: number;
  maxPortfolioEquityExposure: number;
  maxSingleAssetExposure: number;
  maxTotalPortfolioVolatility: number;
  maxTotalOpenRisk: number;
  correlationExposureCap: number;
  kellyFraction: number;
  cryptoKellyFraction: number;
  feeRate: number;
  slippageRate: number;
  spreadRate: number;
  volatilityPenaltyThreshold: number;
  drawdownRiskOffThreshold: number;
  liquidityMinimums: Record<AssetType, number>;
  maxRealizedVolatility: Record<AssetType, number>;
  maxDrawdown: Record<AssetType, number>;
  dataQuality: {
    supportedAssetTypes: AssetType[];
    equityMinDataPoints: number;
    indicatorWarmupCandles: number;
    cryptoMinimumTargetCandles: number;
    maxOutlierCandleRangePct: number;
    maxOutlierCandleRate: number;
    maxOutlierCandles: number;
  };
  dataHistory: {
    yahooDefaultRange: "10y" | "max";
    cryptoLookbackDays: number | "max";
    cryptoMinimumTargetDays: number;
    cryptoPageLimit: number;
    cryptoMaxPages: number;
  };
  validation: {
    minTotalTrades: number;
    minOutOfSampleTrades: number;
    minWalkForwardTradesPerWindow: number;
  };
  signalWeights: {
    trend: number;
    momentum: number;
    regime: number;
  };
  riskWeights: {
    volatility: number;
    drawdown: number;
    liquidity: number;
    riskAdjusted: number;
  };
  validationWeights: {
    outOfSample: number;
    walkForward: number;
    parameterSensitivity: number;
  };
  optimalEntryZone: OptimalEntryZoneConfig;
}

export interface OptimalEntryZoneConfig {
  rollingVWAPWindowsDays: number[];
  pivotLeft: number;
  pivotRight: number;
  atrPeriod: number;
  atrZoneBuffer: number;
  stopATRBuffer: number;
  maxVWAPZScoreForLong: number;
  maxVWAPZScoreForShort: number;
  minimumRewardRisk: number;
  actionableScoreThreshold: number;
  watchlistScoreThreshold: number;
}

export const DEFAULT_QUANT_CONFIG: QuantConfig = {
  targetVolatility: 0.12,
  currentDecisionLookbackDays: 365,
  minDataPoints: 252,
  minTradeCount: 30,
  limitedSampleTradeCount: 100,
  strongSampleTradeCount: 200,
  maxEquityAllocation: 0.2,
  maxETFAllocation: 0.25,
  maxBTCEthAllocation: 0.12,
  maxAltcoinAllocation: 0.04,
  maxIndexAllocation: 0.3,
  maxPortfolioCryptoExposure: 0.25,
  maxPortfolioEquityExposure: 0.8,
  maxSingleAssetExposure: 0.25,
  maxTotalPortfolioVolatility: 0.18,
  maxTotalOpenRisk: 0.35,
  correlationExposureCap: 0.2,
  kellyFraction: 0.2,
  cryptoKellyFraction: 0.1,
  feeRate: 0.001,
  slippageRate: 0.001,
  spreadRate: 0,
  volatilityPenaltyThreshold: 0.35,
  drawdownRiskOffThreshold: 0.25,
  liquidityMinimums: {
    crypto: 10_000_000,
    stock: 5_000_000,
    etf: 5_000_000,
    index: 2_000_000
  },
  maxRealizedVolatility: {
    crypto: 1,
    stock: 0.45,
    etf: 0.35,
    index: 0.3
  },
  maxDrawdown: {
    crypto: -0.35,
    stock: -0.25,
    etf: -0.25,
    index: -0.22
  },
  dataQuality: {
    supportedAssetTypes: ["crypto", "stock", "etf", "index"],
    equityMinDataPoints: 240,
    indicatorWarmupCandles: 200,
    cryptoMinimumTargetCandles: 365 * 5,
    maxOutlierCandleRangePct: 0.5,
    maxOutlierCandleRate: 0.02,
    maxOutlierCandles: 2
  },
  dataHistory: {
    yahooDefaultRange: "max",
    cryptoLookbackDays: "max",
    cryptoMinimumTargetDays: 365 * 5,
    cryptoPageLimit: 1000,
    cryptoMaxPages: 10
  },
  validation: {
    minTotalTrades: 30,
    minOutOfSampleTrades: 10,
    minWalkForwardTradesPerWindow: 3
  },
  signalWeights: {
    trend: 0.4,
    momentum: 0.35,
    regime: 0.25
  },
  riskWeights: {
    volatility: 0.3,
    drawdown: 0.3,
    liquidity: 0.25,
    riskAdjusted: 0.15
  },
  validationWeights: {
    outOfSample: 0.4,
    walkForward: 0.35,
    parameterSensitivity: 0.25
  },
  optimalEntryZone: {
    rollingVWAPWindowsDays: [7, 30, 90],
    pivotLeft: 3,
    pivotRight: 3,
    atrPeriod: 14,
    atrZoneBuffer: 0.25,
    stopATRBuffer: 0.1,
    maxVWAPZScoreForLong: 2,
    maxVWAPZScoreForShort: -2,
    minimumRewardRisk: 1.5,
    actionableScoreThreshold: 75,
    watchlistScoreThreshold: 60
  }
};

export function boundedScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(Math.max(0, Math.min(100, value)));
}

export function averageDollarVolume(points: Array<{ close: number; volume: number; quoteVolume?: number }>): number {
  if (points.length === 0) return 0;
  return points.reduce((sum, point) => sum + (point.quoteVolume ?? point.close * point.volume), 0) / points.length;
}
