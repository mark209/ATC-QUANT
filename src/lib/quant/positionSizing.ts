import type { AssetType, RiskProfile } from "@/types/asset";
import type { PositionSizingResult, SampleQuality } from "@/types/quant";
import { DEFAULT_QUANT_CONFIG } from "./config";
import { drawdownRiskMode } from "./riskRegime";

function targetVolatility(assetType: AssetType): number {
  if (assetType === "crypto") return 0.18;
  if (assetType === "etf") return 0.12;
  if (assetType === "index") return 0.1;
  return 0.15;
}

function assetClassCap(assetType: AssetType, symbol: string): number {
  const normalized = symbol.toUpperCase();
  if (assetType === "crypto") {
    if (normalized.includes("BTC") || normalized.includes("ETH")) return DEFAULT_QUANT_CONFIG.maxBTCEthAllocation;
    return DEFAULT_QUANT_CONFIG.maxAltcoinAllocation;
  }
  if (assetType === "etf") return DEFAULT_QUANT_CONFIG.maxETFAllocation;
  if (assetType === "index") return DEFAULT_QUANT_CONFIG.maxIndexAllocation;
  return DEFAULT_QUANT_CONFIG.maxEquityAllocation;
}

function riskProfileMultiplier(profile: RiskProfile): number {
  if (profile === "conservative") return 0.75;
  return 1;
}

function sampleMultiplier(sampleQuality?: SampleQuality): number {
  if (sampleQuality === "Poor") return 0;
  if (sampleQuality === "Limited") return 0.25;
  if (sampleQuality === "Acceptable") return 0.75;
  return 1;
}

export function fractionalKelly(
  winRate: number,
  payoffRatio: number,
  assetType: AssetType,
  expectedValueAfterCosts = Number.POSITIVE_INFINITY,
  sampleQuality?: SampleQuality
): number {
  if (expectedValueAfterCosts <= 0) return 0;
  if (payoffRatio <= 0) return 0;
  const kelly = winRate - (1 - winRate) / payoffRatio;
  if (kelly <= 0) return 0;
  const fraction = assetType === "crypto" ? DEFAULT_QUANT_CONFIG.cryptoKellyFraction : DEFAULT_QUANT_CONFIG.kellyFraction;
  return Math.max(0, kelly * fraction * sampleMultiplier(sampleQuality));
}

export function calculatePositionSizing(input: {
  assetType: AssetType;
  symbol: string;
  realizedVolatility: number;
  currentDrawdown: number;
  winRate: number;
  payoffRatio: number;
  expectedValueAfterCosts?: number;
  tradeCount?: number;
  sampleQuality?: SampleQuality;
  riskProfile: RiskProfile;
}): PositionSizingResult {
  const risk = drawdownRiskMode(input.currentDrawdown, input.assetType);
  const warnings: string[] = [];
  const volatilityTargetAllocation = Math.min(
    assetClassCap(input.assetType, input.symbol),
    input.realizedVolatility <= 0 ? 0 : targetVolatility(input.assetType) / input.realizedVolatility
  );
  const fractionalKellyAllocation = fractionalKelly(
    input.winRate,
    input.payoffRatio,
    input.assetType,
    input.expectedValueAfterCosts,
    input.sampleQuality
  );
  const assetClassMaxAllocation = assetClassCap(input.assetType, input.symbol);
  const drawdownAdjustedAllocation = assetClassMaxAllocation * risk.adjustment;

  if ((input.expectedValueAfterCosts ?? 0) <= 0) warnings.push("Kelly allocation is zero because expected value after costs is not positive.");
  if (input.sampleQuality === "Poor") warnings.push("Kelly allocation is zero because the sample size is poor.");
  if (input.sampleQuality === "Limited") warnings.push("Kelly allocation is heavily reduced because the sample size is limited.");
  if (risk.adjustment === 0) warnings.push("Final allocation is 0.00% because drawdown regime is Risk-Off.");

  const candidates = [
    { label: "volatility targeting", value: volatilityTargetAllocation },
    { label: "fractional Kelly", value: fractionalKellyAllocation },
    { label: "asset-class cap", value: assetClassMaxAllocation },
    { label: "drawdown control", value: drawdownAdjustedAllocation }
  ];
  const limiting = candidates.reduce((lowest, candidate) => (candidate.value < lowest.value ? candidate : lowest));
  const finalAllocation = Math.max(0, limiting.value * riskProfileMultiplier(input.riskProfile));

  return {
    volatilityTargetAllocation,
    fractionalKellyAllocation,
    assetClassMaxAllocation,
    drawdownAdjustedAllocation,
    finalAllocation,
    finalPositionSize: finalAllocation,
    limitingConstraint: limiting.label,
    limitingFactor: limiting.label,
    riskMode: risk.mode,
    exposureAdjustment: risk.adjustment,
    warnings
  };
}
