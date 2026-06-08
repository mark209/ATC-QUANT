import type { AssetType } from "@/types/asset";

export interface QuantConfig {
  targetVolatility: number;
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
}

export const DEFAULT_QUANT_CONFIG: QuantConfig = {
  targetVolatility: 0.12,
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
